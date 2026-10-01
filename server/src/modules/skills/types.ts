import type { AgentVersionSkill, Skill, SkillSource, SkillType } from '@devdigest/shared';

/**
 * Types and the cross-module port of the skills module (L02, D16).
 *
 * The skills module owns `skills`, `skill_versions` and `agent_skills`. Other
 * modules reach them ONLY through `SkillsPort` via `container.skillsRepo` —
 * never by importing this folder (they type it as `Container['skillsRepo']`).
 */

/** A skill as stored — the `Skill` contract minus `body_tokens` (the service counts those). */
export type StoredSkill = Omit<Skill, 'body_tokens'>;

/** One link of an agent's ordered list, with the linked skill (before token counting). */
export interface StoredAgentSkill {
  skill_id: string;
  order: number;
  enabled: boolean;
  skill: StoredSkill;
}

/** A skill that reaches an agent's prompt (`agent_skills.enabled AND skills.enabled`). */
export interface EffectiveSkill {
  id: string;
  name: string;
  body: string;
  source: SkillSource;
  version: number;
}

/** The state `PUT /skills/:id` decides on (version bump, ack rule). */
export interface SkillEditState {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  enabled: boolean;
  source: SkillSource;
  version: number;
  acknowledgedAt: Date | null;
}

/** Column values a skill update writes (camelCase, persistence side). */
export interface SkillUpdateValues {
  name?: string;
  description?: string;
  type?: SkillType;
  body?: string;
  enabled?: boolean;
  version?: number;
  acknowledgedAt?: Date;
  /** Files an extracted skill cites (HW02 D18); untouched when absent. */
  evidenceFiles?: string[] | null;
}

/** Values of a create (`SkillInput` after zod defaults, an import, or an extraction). */
export interface NewSkillValues {
  name: string;
  description: string;
  type: SkillType;
  source: SkillSource;
  body: string;
  enabled: boolean;
  /** Files an extracted skill cites (HW02 D18); `null` / absent otherwise. */
  evidenceFiles?: string[] | null;
}

/**
 * A skill built from accepted convention candidates (HW02 D18): the create
 * input of `createExtracted` and the full new state of `updateExtracted`.
 * `source` is always `extracted` and is set by the service.
 */
export interface ExtractedSkillInput {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  enabled: boolean;
  evidenceFiles: string[];
}

/** Why the outbound fetch of a skill URL did not return bytes (HW02 D21). */
export type UrlFetchFailure =
  | 'not_https'
  | 'blocked_address'
  | 'redirect'
  | 'timeout'
  | 'too_large'
  | 'bad_status'
  | 'network';

export type UrlFetchResult =
  | { ok: true; bytes: Uint8Array; finalUrl: string }
  | { ok: false; code: UrlFetchFailure; detail?: string };

/**
 * Outbound HTTP port of the skill URL import (HW02 D21), used by this module
 * only; the adapter is `src/adapters/http/url-fetcher.ts`, wired as
 * `container.urlFetcher`. It never throws across the port: every refusal
 * is a `UrlFetchResult` failure the service maps to a `SkillErrorCode`.
 */
export interface UrlFetcher {
  fetch(url: string, limits: { maxBytes: number; timeoutMs: number }): Promise<UrlFetchResult>;
}

/**
 * Cross-module port onto skills and agent links (`container.skillsRepo`).
 * Consumers: agents (`skill_count`, version snapshots), reviews (Stage 4b:
 * `enabledForAgent`), skill import (Stage 3b: `namesInWorkspace`).
 */
export interface SkillsPort {
  /** Effective skills per agent (`agent_skills.enabled AND skills.enabled`); agents without any are absent. */
  effectiveSkillCounts(agentIds: string[]): Promise<Map<string, number>>;
  /** Every link of the agent (enabled or not), ordered — the `AgentVersionConfig.skills` snapshot. */
  snapshotLinks(agentId: string): Promise<AgentVersionSkill[]>;
  /** The agent's effective skills in prompt order. */
  enabledForAgent(agentId: string): Promise<EffectiveSkill[]>;
  /** Every skill name in the workspace. */
  namesInWorkspace(workspaceId: string): Promise<string[]>;
}
