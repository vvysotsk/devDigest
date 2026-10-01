import type {
  AgentSkill,
  AgentSkillsPut,
  AgentSkillsResult,
  Skill,
  SkillImportPreview,
  SkillImportRequest,
  SkillImportSave,
  SkillImportUrlPreview,
  SkillImportUrlRequest,
  SkillImportUrlSave,
  SkillInput,
  SkillPatch,
  SkillVersion,
} from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { NotFoundError } from '../../platform/errors.js';
import { SkillAckRequiredError, SkillImportError, SkillNotInWorkspaceError } from './errors.js';
import { SKILL_IMPORT_MAX_BYTES } from '@devdigest/shared';
import {
  IMPORT_URL_TIMEOUT_MS,
  buildImportPreview,
  checkImportUrl,
  decodeImportBase64,
  fetchFailureMessage,
  mapFetchFailure,
  resolveImportSave,
  sha256Hex,
} from './import/index.js';
import {
  INITIAL_SKILL_VERSION,
  bumpsVersion,
  linksChanged,
  missingIds,
  needsAck,
  toAgentSkillDto,
  toLinks,
  toSkillDto,
} from './helpers.js';
import type { SkillsRepository } from './repository.js';
import type { ExtractedSkillInput, NewSkillValues, SkillUpdateValues } from './types.js';

export type SkillsServiceDeps = Pick<Container, 'db' | 'tokenizer' | 'urlFetcher'>;

export interface SkillsServiceRepos {
  skills: SkillsRepository;
  /** Owner of `agents` / `agent_versions` (agents module), reached through the container. */
  agents: Container['agentsRepo'];
}

/**
 * L02 skills use cases: CRUD with body versioning (D5), the first-enable
 * acknowledgement of imported skills (D4), and an agent's ordered skill list
 * saved in one transaction with at most one agent version bump (D17).
 * Workspace-scoped: an unknown or foreign id is a 404.
 */
export class SkillsService {
  constructor(
    private deps: SkillsServiceDeps,
    private repos: SkillsServiceRepos,
  ) {}

  private countTokens = (text: string): number => this.deps.tokenizer.count(text);

  async list(workspaceId: string): Promise<Skill[]> {
    const rows = await this.repos.skills.list(workspaceId);
    return rows.map((s) => toSkillDto(s, this.countTokens));
  }

  async get(workspaceId: string, id: string): Promise<Skill> {
    const stored = await this.repos.skills.get(workspaceId, id);
    if (!stored) throw new NotFoundError('Skill not found');
    return toSkillDto(stored, this.countTokens);
  }

  /** The workspace's skill with this exact name, or `undefined` (HW02 D18 draft / save). */
  async findByName(workspaceId: string, name: string): Promise<Skill | undefined> {
    const stored = await this.repos.skills.findByName(workspaceId, name);
    return stored ? toSkillDto(stored, this.countTokens) : undefined;
  }

  /** Manual create: the skill at v1 plus its `skill_versions` v1 row, atomically. */
  async create(workspaceId: string, input: SkillInput): Promise<Skill> {
    return this.insertAtV1(workspaceId, {
      name: input.name,
      description: input.description,
      type: input.type,
      source: input.source,
      body: input.body,
      enabled: input.enabled,
    });
  }

  /** `POST /skills/import/preview` — parse the upload; stores nothing (D3). */
  async previewImport(workspaceId: string, req: SkillImportRequest): Promise<SkillImportPreview> {
    return this.parseUpload(workspaceId, req.filename, req.content_base64);
  }

  /**
   * `POST /skills/import` — re-run the pipeline on the uploaded FILE, apply only
   * the name / description / type overrides, and save it ourselves as
   * `imported_file`, disabled, unacknowledged. The body is always the parsed
   * one: the client never supplies it, so the first-enable acknowledgement (D4)
   * cannot be bypassed.
   */
  async saveImport(workspaceId: string, req: SkillImportSave): Promise<Skill> {
    const preview = await this.parseUpload(workspaceId, req.filename, req.content_base64);
    const resolved = resolveImportSave(preview, {
      name: req.name,
      description: req.description,
      type: req.type,
    });
    if (!resolved.ok) throw new SkillImportError(resolved);
    return this.insertAtV1(workspaceId, { ...resolved.skill, source: 'imported_file', enabled: false });
  }

  private async parseUpload(workspaceId: string, filename: string, contentBase64: string): Promise<SkillImportPreview> {
    const decoded = decodeImportBase64(contentBase64);
    if (!decoded.ok) throw new SkillImportError(decoded);
    return this.parseBytes(workspaceId, filename, decoded.bytes);
  }

  private async parseBytes(workspaceId: string, filename: string, bytes: Uint8Array): Promise<SkillImportPreview> {
    const names = new Set(await this.repos.skills.namesInWorkspace(workspaceId));
    const built = buildImportPreview({ filename, bytes }, names);
    if (!built.ok) throw new SkillImportError(built);
    return built.preview;
  }

  /** `POST /skills/import-url/preview` (HW02 D21) — fetch the URL and parse it; stores nothing. */
  async previewImportUrl(workspaceId: string, req: SkillImportUrlRequest): Promise<SkillImportUrlPreview> {
    const { preview, sha256 } = await this.fetchForImport(workspaceId, req.url);
    return { ...preview, sha256 };
  }

  /**
   * `POST /skills/import-url` — fetch the URL AGAIN, refuse it when the bytes
   * differ from the previewed ones (409 `import_url_changed`), apply only the
   * name / description / type overrides, and save it ourselves as
   * `imported_url`, disabled, unacknowledged — the same trust path as the
   * file import.
   */
  async saveImportUrl(workspaceId: string, req: SkillImportUrlSave): Promise<Skill> {
    const { preview, sha256 } = await this.fetchForImport(workspaceId, req.url);
    if (sha256 !== req.sha256) {
      throw new SkillImportError({
        code: 'import_url_changed',
        message: 'The file changed since the preview — fetch the preview again.',
        details: { url: req.url },
      });
    }
    const resolved = resolveImportSave(preview, { name: req.name, description: req.description, type: req.type });
    if (!resolved.ok) throw new SkillImportError(resolved);
    return this.insertAtV1(workspaceId, { ...resolved.skill, source: 'imported_url', enabled: false });
  }

  /**
   * The URL half of the import pipeline (D21): the pure URL check, the fetch
   * through the port (its refusals become `import_url_*` errors), then the
   * same `buildImportPreview` as a file upload — the zip limits apply unchanged.
   */
  private async fetchForImport(workspaceId: string, rawUrl: string): Promise<{ preview: SkillImportPreview; sha256: string }> {
    const checked = checkImportUrl(rawUrl);
    if (!checked.ok) throw new SkillImportError(checked);
    const fetched = await this.deps.urlFetcher.fetch(checked.url, {
      maxBytes: SKILL_IMPORT_MAX_BYTES,
      timeoutMs: IMPORT_URL_TIMEOUT_MS,
    });
    if (!fetched.ok) {
      throw new SkillImportError({
        code: mapFetchFailure(fetched.code),
        message: fetchFailureMessage(fetched.code),
        details: fetched.detail === undefined ? { url: checked.url } : { url: checked.url, detail: fetched.detail },
      });
    }
    const preview = await this.parseBytes(workspaceId, checked.filename, fetched.bytes);
    return { preview, sha256: sha256Hex(fetched.bytes) };
  }

  /**
   * HW02 D18: a skill built from accepted convention candidates, at v1 with
   * `source: 'extracted'` and its `evidence_files`. 409 `skill_name_taken` on
   * a duplicate name (the unique index).
   */
  async createExtracted(workspaceId: string, input: ExtractedSkillInput): Promise<Skill> {
    return this.insertAtV1(workspaceId, {
      name: input.name,
      description: input.description,
      type: input.type,
      source: 'extracted',
      body: input.body,
      enabled: input.enabled,
      evidenceFiles: input.evidenceFiles,
    });
  }

  /**
   * HW02 D18: save a re-extraction as the next version of an existing
   * `extracted` skill — the same transaction and bump rule as `update`
   * (description / type / body changes bump and snapshot; `enabled` alone does
   * not), plus the new `evidence_files`. No ack rule: the skill is ours, not
   * an import. The caller checks that the skill is `extracted`.
   */
  async updateExtracted(workspaceId: string, id: string, input: ExtractedSkillInput): Promise<Skill> {
    await this.deps.db.transaction(async (tx) => {
      const current = await this.repos.skills.lockForEdit(tx, workspaceId, id);
      if (!current) throw new NotFoundError('Skill not found');
      const patch: SkillPatch = {
        description: input.description,
        type: input.type,
        body: input.body,
        enabled: input.enabled,
      };
      const bump = bumpsVersion(current, patch);
      const version = bump ? current.version + 1 : current.version;
      await this.repos.skills.update(tx, id, {
        description: input.description,
        type: input.type,
        body: input.body,
        enabled: input.enabled,
        evidenceFiles: input.evidenceFiles,
        ...(bump ? { version } : {}),
      });
      if (bump) await this.repos.skills.insertVersion(tx, id, version, input.body);
    });
    return this.get(workspaceId, id);
  }

  private async insertAtV1(workspaceId: string, values: NewSkillValues): Promise<Skill> {
    const id = await this.deps.db.transaction(async (tx) => {
      const skillId = await this.repos.skills.insert(tx, workspaceId, values, INITIAL_SKILL_VERSION);
      await this.repos.skills.insertVersion(tx, skillId, INITIAL_SKILL_VERSION, values.body);
      return skillId;
    });
    return this.get(workspaceId, id);
  }

  /**
   * Edit a skill. name/description/type/body changes bump the version and
   * snapshot the body in the same transaction; an `enabled`-only change does
   * not. First enable of an unacknowledged imported skill → 409 unless
   * `acknowledge_injection: true` (then `acknowledged_at` is stored).
   */
  async update(workspaceId: string, id: string, patch: SkillPatch): Promise<Skill> {
    await this.deps.db.transaction(async (tx) => {
      const current = await this.repos.skills.lockForEdit(tx, workspaceId, id);
      if (!current) throw new NotFoundError('Skill not found');

      const ack = needsAck(current, patch);
      if (ack && patch.acknowledge_injection !== true) throw new SkillAckRequiredError();

      const bump = bumpsVersion(current, patch);
      const version = bump ? current.version + 1 : current.version;
      const values: SkillUpdateValues = {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.type !== undefined ? { type: patch.type } : {}),
        ...(patch.body !== undefined ? { body: patch.body } : {}),
        ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
        ...(bump ? { version } : {}),
        ...(ack ? { acknowledgedAt: new Date() } : {}),
      };
      await this.repos.skills.update(tx, id, values);
      if (bump) await this.repos.skills.insertVersion(tx, id, version, patch.body ?? current.body);
    });
    return this.get(workspaceId, id);
  }

  /** Delete a skill; its versions and agent links cascade. */
  async delete(workspaceId: string, id: string): Promise<void> {
    const ok = await this.repos.skills.delete(workspaceId, id);
    if (!ok) throw new NotFoundError('Skill not found');
  }

  async listVersions(workspaceId: string, id: string): Promise<SkillVersion[]> {
    const stored = await this.repos.skills.get(workspaceId, id);
    if (!stored) throw new NotFoundError('Skill not found');
    return this.repos.skills.listVersions(id);
  }

  /** An agent's links (enabled or not) in `order`, each with its skill. */
  async agentSkills(workspaceId: string, agentId: string): Promise<AgentSkill[]> {
    const agent = await this.repos.agents.getAgent(workspaceId, agentId);
    if (!agent) throw new NotFoundError('Agent not found');
    return this.linksWithSkills(agentId);
  }

  /**
   * Replace an agent's skill list (order = array index) in ONE transaction.
   * A list that differs from the stored one bumps the agent version once and
   * writes an `agent_versions` snapshot with the new links; an unchanged list
   * writes nothing.
   */
  async setAgentSkills(
    workspaceId: string,
    agentId: string,
    body: AgentSkillsPut,
  ): Promise<AgentSkillsResult> {
    const next = toLinks(body);
    const version = await this.deps.db.transaction(async (tx) => {
      // Locks the agent row: concurrent saves of one agent serialize here.
      const current = await this.repos.agents.lockVersion(tx, workspaceId, agentId);
      if (current === undefined) throw new NotFoundError('Agent not found');

      const ids = next.map((l) => l.skill_id);
      const missing = missingIds(ids, await this.repos.skills.idsInWorkspace(tx, workspaceId, ids));
      if (missing.length > 0) throw new SkillNotInWorkspaceError(missing);

      const before = await this.repos.skills.links(tx, agentId);
      if (!linksChanged(before, next)) return current;

      await this.repos.skills.replaceLinks(tx, agentId, next);
      const bumped = await this.repos.agents.bumpVersion(tx, workspaceId, agentId, next);
      if (bumped === undefined) throw new NotFoundError('Agent not found');
      return bumped;
    });
    return { version, skills: await this.linksWithSkills(agentId) };
  }

  private async linksWithSkills(agentId: string): Promise<AgentSkill[]> {
    const links = await this.repos.skills.agentSkills(agentId);
    return links.map((l) => toAgentSkillDto(l, this.countTokens));
  }
}
