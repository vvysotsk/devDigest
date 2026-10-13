import type {
  ConventionCandidate,
  ConventionPatch,
  ConventionScan,
  ConventionSkillDraft,
  ConventionSkillSave,
  ConventionsState,
  FeatureModelChoice,
  RepoRef,
  Skill,
} from '@devdigest/shared';
import { NotFoundError } from '../../platform/errors.js';
import {
  CandidateNotAcceptedError,
  RepoNotClonedError,
  RepoNotIndexedError,
  ScanRunningError,
  SkillNameTakenError,
} from './errors.js';
import {
  DEFAULT_SKILL_NAME,
  SAMPLE_COUNT,
  buildExtractionMessages,
  carryDecision,
  isRootConfigFile,
  priorRules,
  renderSkillBody,
  renderSkillDescription,
  splitLines,
  verifyCandidates,
} from './helpers.js';
import type { ConventionsRepository } from './repository.js';
import {
  ConventionExtraction,
  type ConventionsDeps,
  type NewCandidateValues,
  type SampledFile,
  type ScanLogger,
  type SkillsWriter,
} from './types.js';

export interface ConventionsServiceRepos {
  conventions: ConventionsRepository;
  /** The skills module, reached through `container.skillsService` (D18). */
  skills: SkillsWriter;
}

/** What the background run needs to know about the repo being scanned. */
interface ScanTarget {
  workspaceId: string;
  repoId: string;
  ref: RepoRef;
  samplePaths: string[];
}

/**
 * HW02 Conventions Extractor use cases (D14–D18):
 *   extract   → 202 `running` scan, then sampling → one structured LLM call →
 *               evidence check → candidates stored with carried-over decisions
 *   state     → the latest scan and its non-rejected candidates
 *   patch     → accept / reject / edit a candidate
 *   draft     → the default `repo-conventions` skill from the accepted ones
 *   save      → create that skill (or its next version) and link it to an agent
 * Workspace-scoped: an unknown or foreign id is a 404.
 */
export class ConventionsService {
  constructor(
    private deps: ConventionsDeps,
    private repos: ConventionsServiceRepos,
    private logger?: ScanLogger,
  ) {}

  // ---- extract (D14, D15) --------------------------------------------------

  /**
   * Refuse a repo without a clone or an index (409, no fallback), record the
   * clone head, create the `running` scan under the per-repo lock (409 while
   * one runs), and return it; the extraction continues in the background with
   * the review-run pattern (a detached promise whose `.catch` only logs — the
   * run itself marks the scan `failed`).
   */
  async startScan(workspaceId: string, repoId: string): Promise<ConventionScan> {
    const repo = await this.deps.reposRepo.getById(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repo not found');
    if (!repo.clonePath) throw new RepoNotClonedError();

    const samplePaths = await this.deps.repoIntel.getConventionSamples(repoId, SAMPLE_COUNT);
    if (samplePaths.length === 0) throw new RepoNotIndexedError();

    const ref: RepoRef = { owner: repo.owner, name: repo.name };
    const headSha = await this.deps.git.currentHead(ref);
    const result = await this.repos.conventions.createScanExclusive(workspaceId, repoId, headSha);
    if ('running' in result) throw new ScanRunningError(result.running.id);

    const scan = result.created;
    void this.runExtraction(scan, { workspaceId, repoId, ref, samplePaths }).catch((err) => {
      this.logger?.error({ scanId: scan.id, repoId, err: (err as Error).message }, 'conventions: background extraction crashed');
    });
    return scan;
  }

  /** The background half of `startScan`. Every exit path closes the scan row. */
  private async runExtraction(scan: ConventionScan, target: ScanTarget): Promise<void> {
    let sampleCount = 0;
    let chosen: FeatureModelChoice | undefined;
    try {
      // 1. Sampling — code only, no LLM (D15, #39).
      const samples = await this.readSamples(target.ref, target.samplePaths);
      sampleCount = samples.length;

      // 2. Earlier decisions (D17): listed to the model as data, and applied below.
      const decisions = await this.repos.conventions.earlierDecisions(target.repoId);

      // 3. The one structured call, on the feature's model (D8, D16).
      chosen = await this.deps.featureModels.resolve(target.workspaceId, 'conventions');
      const llm = await this.deps.llm(chosen.provider);
      const answer = await llm.completeStructured({
        model: chosen.model,
        schema: ConventionExtraction,
        schemaName: 'ConventionExtraction',
        messages: buildExtractionMessages(samples, priorRules(decisions)),
        maxRetries: 1,
      });

      // 4. Evidence check against the sampled contents (D16) and decision carry-over
      //    by rule text OR evidence location + category (D17, #48).
      const { kept, dropped } = verifyCandidates(answer.data.candidates, samples);
      const rows: NewCandidateValues[] = kept.map((c) => ({ ...c, status: carryDecision(c, decisions) }));

      // 5. Persist the candidates and close the scan atomically.
      await this.deps.db.transaction(async (tx) => {
        await this.repos.conventions.insertCandidates(tx, target.workspaceId, target.repoId, scan.id, rows);
        await this.repos.conventions.finishScan(tx, scan.id, {
          status: 'done',
          sampleCount,
          candidatesDropped: dropped,
          provider: chosen!.provider,
          model: chosen!.model,
          error: null,
        });
      });
      this.logger?.info(
        { scanId: scan.id, repoId: target.repoId, sampleCount, kept: kept.length, dropped },
        'conventions: scan done',
      );
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      await this.repos.conventions
        .finishScan(this.deps.db, scan.id, {
          status: 'failed',
          sampleCount,
          candidatesDropped: 0,
          provider: chosen?.provider ?? null,
          model: chosen?.model ?? null,
          error: message,
        })
        .catch(() => undefined);
      throw err;
    }
  }

  /**
   * D15: the root config files (`eslint.config.*`, `.eslintrc*`, `tsconfig*.json`,
   * `.prettierrc*`, `prettier.config.*`) plus the ranked sample paths, read
   * from the clone. Unreadable or empty files are skipped; the paths kept here
   * are the only ones a candidate may cite (D16).
   */
  private async readSamples(ref: RepoRef, samplePaths: string[]): Promise<SampledFile[]> {
    const rootFiles = await this.deps.git.listRootFiles(ref);
    const configs = rootFiles.filter(isRootConfigFile).sort();
    const paths = [...new Set([...configs, ...samplePaths])];
    const samples: SampledFile[] = [];
    for (const path of paths) {
      let text: string;
      try {
        text = await this.deps.git.readFile(ref, path);
      } catch {
        continue;
      }
      if (text.trim() === '') continue;
      samples.push({ path, lines: splitLines(text) });
    }
    return samples;
  }

  // ---- state and decisions (D17) -------------------------------------------

  /** `GET /repos/:id/conventions`: the latest scan and its non-rejected candidates. */
  async state(workspaceId: string, repoId: string): Promise<ConventionsState> {
    const repo = await this.deps.reposRepo.getById(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repo not found');
    const scan = await this.repos.conventions.latestScan(workspaceId, repoId);
    if (!scan) return { scan: null, candidates: [] };
    const candidates = await this.repos.conventions.listCandidates(workspaceId, scan.id, { excludeRejected: true });
    return { scan, candidates };
  }

  /** `PATCH /conventions/:id`: accept / reject, or edit the rule and category in place. */
  async patchCandidate(workspaceId: string, id: string, patch: ConventionPatch): Promise<ConventionCandidate> {
    const updated = await this.repos.conventions.updateCandidate(workspaceId, id, patch);
    if (!updated) throw new NotFoundError('Convention candidate not found');
    return updated;
  }

  // ---- the skill (D18) -----------------------------------------------------

  /** `GET /repos/:id/conventions/skill-draft`: the default skill from the ACCEPTED candidates only. */
  async skillDraft(workspaceId: string, repoId: string): Promise<ConventionSkillDraft> {
    const repo = await this.deps.reposRepo.getById(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repo not found');
    const scan = await this.repos.conventions.latestScan(workspaceId, repoId);
    const accepted = scan
      ? await this.repos.conventions.listCandidates(workspaceId, scan.id, { status: 'accepted' })
      : [];
    const existing = await this.repos.skills.findByName(workspaceId, DEFAULT_SKILL_NAME);
    return {
      name: DEFAULT_SKILL_NAME,
      description: renderSkillDescription(repo.fullName),
      type: 'convention',
      body: renderSkillBody(repo.fullName, accepted),
      existing: existing && existing.source === 'extracted' ? { id: existing.id, version: existing.version } : null,
    };
  }

  /**
   * `POST /repos/:id/conventions/skill`: refuse non-accepted candidates (400);
   * create the skill as `extracted` (201), or save the body as the next
   * version of an existing `extracted` skill with that name (200); a name
   * owned by any other skill is a 409. Then append it to the agent's links
   * once, through the skills module's `setAgentSkills` (never twice).
   */
  async saveSkill(
    workspaceId: string,
    repoId: string,
    body: ConventionSkillSave,
  ): Promise<{ skill: Skill; created: boolean }> {
    const repo = await this.deps.reposRepo.getById(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repo not found');
    const agent = await this.deps.agentsRepo.getAgent(workspaceId, body.agent_id);
    if (!agent) throw new NotFoundError('Agent not found');

    const found = await this.repos.conventions.candidatesByIds(workspaceId, repoId, body.candidate_ids);
    const accepted = new Set(found.filter((c) => c.status === 'accepted').map((c) => c.id));
    const refused = body.candidate_ids.filter((id) => !accepted.has(id));
    if (refused.length > 0) throw new CandidateNotAcceptedError(refused);

    const evidenceFiles = [...new Set(found.map((c) => c.evidence_path))].sort();
    const input = {
      name: body.name,
      description: body.description,
      type: body.type,
      body: body.body,
      enabled: body.enabled,
      evidenceFiles,
    };

    const existing = await this.repos.skills.findByName(workspaceId, body.name);
    let skill: Skill;
    let created: boolean;
    if (existing) {
      if (existing.source !== 'extracted') throw new SkillNameTakenError(body.name);
      skill = await this.repos.skills.updateExtracted(workspaceId, existing.id, input);
      created = false;
    } else {
      skill = await this.repos.skills.createExtracted(workspaceId, input);
      created = true;
    }

    // Link once: an already-linked skill leaves the list (and the agent version) untouched.
    const links = await this.repos.skills.agentSkills(workspaceId, body.agent_id);
    if (!links.some((l) => l.skill_id === skill.id)) {
      await this.repos.skills.setAgentSkills(workspaceId, body.agent_id, {
        skills: [
          ...links.map((l) => ({ skill_id: l.skill_id, enabled: l.enabled })),
          { skill_id: skill.id, enabled: body.enabled },
        ],
      });
      skill = await this.repos.skills.get(workspaceId, skill.id); // fresh `agent_count`
    }
    return { skill, created };
  }
}
