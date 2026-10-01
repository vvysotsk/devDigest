import { z } from 'zod';
import {
  ConventionCategory,
  type AgentSkill,
  type AgentSkillsPut,
  type AgentSkillsResult,
  type ConventionStatus,
  type Skill,
  type SkillType,
} from '@devdigest/shared';
import type { Container } from '../../platform/container.js';

/**
 * Types and ports of the conventions module (HW02 D14–D18).
 *
 * The module owns `convention_scans` and `conventions`. It reaches the
 * skills module (create / version / link the `repo-conventions` skill) and
 * the settings module (the feature model, D8) ONLY through container members
 * typed here structurally — it never imports `modules/skills` or
 * `modules/settings`.
 */

/**
 * The model's answer (D16, #40) — server-only, never in the shared kernel.
 * `quote` is our addition: the evidence check looks for it on `line` ±2.
 */
export const ConventionExtraction = z.object({
  candidates: z.array(
    z.object({
      category: ConventionCategory,
      rule: z.string().min(1),
      evidence: z.object({
        file: z.string().min(1),
        line: z.number().int().positive(),
        quote: z.string().min(1),
      }),
      confidence: z.number().min(0).max(1),
    }),
  ),
});
export type ConventionExtraction = z.infer<typeof ConventionExtraction>;
export type ExtractedCandidate = ConventionExtraction['candidates'][number];

/** A sampled file as read from the clone: its path as sent to the model and its lines. */
export interface SampledFile {
  path: string;
  lines: string[];
}

/** A candidate that passed the evidence check (D16), ready to store. */
export interface VerifiedCandidate {
  category: ExtractedCandidate['category'];
  rule: string;
  evidencePath: string;
  /** The line where the quote was found (not necessarily the model's claim). */
  evidenceLine: number;
  /** ±2 lines around `evidenceLine`, read from the sampled file by code. */
  evidenceSnippet: string;
  confidence: number;
}

/** Column values of one stored candidate (the verified fields plus the carried-over decision, D17). */
export interface NewCandidateValues extends VerifiedCandidate {
  status: ConventionStatus;
}

/** What `finishScan` writes when the background work ends. */
export interface ScanOutcome {
  status: 'done' | 'failed';
  sampleCount: number;
  candidatesDropped: number;
  provider: string | null;
  model: string | null;
  error: string | null;
}

/** The skill as the save route builds it (D18); `source: 'extracted'` is set by the skills module. */
export interface SkillWriteInput {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  enabled: boolean;
  evidenceFiles: string[];
}

/**
 * What this module needs from the skills module (D18). Satisfied by
 * `container.skillsService` (a `SkillsService`), wired in the composition
 * root — a structural interface, so this folder never imports `modules/skills`.
 */
export interface SkillsWriter {
  get(workspaceId: string, id: string): Promise<Skill>;
  findByName(workspaceId: string, name: string): Promise<Skill | undefined>;
  createExtracted(workspaceId: string, input: SkillWriteInput): Promise<Skill>;
  updateExtracted(workspaceId: string, id: string, input: SkillWriteInput): Promise<Skill>;
  agentSkills(workspaceId: string, agentId: string): Promise<AgentSkill[]>;
  setAgentSkills(workspaceId: string, agentId: string, body: AgentSkillsPut): Promise<AgentSkillsResult>;
}

/** Container members the service reads (onion R5). `featureModels` is the settings port (D8). */
export type ConventionsDeps = Pick<
  Container,
  'db' | 'git' | 'llm' | 'repoIntel' | 'reposRepo' | 'agentsRepo' | 'featureModels'
>;

/** The route's logger, structurally (Fastify's `app.log` fits). */
export type ScanLogger = {
  info: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
};
