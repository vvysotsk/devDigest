import type {
  AgentSkill,
  AgentSkillsPut,
  AgentSkillsResult,
  Skill,
  SkillInput,
  SkillPatch,
  SkillVersion,
} from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { NotFoundError } from '../../platform/errors.js';
import { SkillAckRequiredError, SkillNotInWorkspaceError } from './errors.js';
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
import type { SkillUpdateValues } from './types.js';

export type SkillsServiceDeps = Pick<Container, 'db' | 'tokenizer'>;

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

  /** Manual create: the skill at v1 plus its `skill_versions` v1 row, atomically. */
  async create(workspaceId: string, input: SkillInput): Promise<Skill> {
    const id = await this.deps.db.transaction(async (tx) => {
      const skillId = await this.repos.skills.insert(
        tx,
        workspaceId,
        {
          name: input.name,
          description: input.description,
          type: input.type,
          source: input.source,
          body: input.body,
          enabled: input.enabled,
        },
        INITIAL_SKILL_VERSION,
      );
      await this.repos.skills.insertVersion(tx, skillId, INITIAL_SKILL_VERSION, input.body);
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
