import { z } from 'zod';

/**
 * Conformance, Onboarding, Eval, Memory, Conventions, Skills,
 * Agents and their DTOs.
 */

// ---- Conformance ----
export const ConformanceStatus = z.enum(['implemented', 'missing', 'out_of_scope']);
export type ConformanceStatus = z.infer<typeof ConformanceStatus>;

export const ConformanceItem = z.object({
  requirement: z.string(),
  status: ConformanceStatus,
  evidence_file: z.string().nullish(),
  notes: z.string().nullish(),
});
export type ConformanceItem = z.infer<typeof ConformanceItem>;

export const Conformance = z.object({
  spec_id: z.string(),
  spec_title: z.string(),
  items: z.array(ConformanceItem),
  completeness_pct: z.number().min(0).max(100),
});
export type Conformance = z.infer<typeof Conformance>;

// ---- Onboarding ----
export const OnboardingLink = z.object({
  label: z.string(),
  path: z.string(),
});
export type OnboardingLink = z.infer<typeof OnboardingLink>;

export const OnboardingSection = z.object({
  kind: z.string(),
  title: z.string(),
  body: z.string(), // markdown
  diagram: z.string().nullish(), // mermaid
  links: z.array(OnboardingLink),
});
export type OnboardingSection = z.infer<typeof OnboardingSection>;

export const Onboarding = z.object({
  sections: z.array(OnboardingSection),
});
export type Onboarding = z.infer<typeof Onboarding>;

// ---- Eval ----
export const EvalPerTrace = z.object({
  name: z.string(),
  pass: z.boolean(),
  expected: z.unknown(),
  actual: z.unknown(),
});
export type EvalPerTrace = z.infer<typeof EvalPerTrace>;

export const EvalRun = z.object({
  recall: z.number().min(0).max(1),
  precision: z.number().min(0).max(1),
  citation_accuracy: z.number().min(0).max(1),
  traces_passed: z.number().int(),
  traces_total: z.number().int(),
  duration_ms: z.number().int(),
  cost_usd: z.number().nullable(),
  per_trace: z.array(EvalPerTrace),
});
export type EvalRun = z.infer<typeof EvalRun>;

export const EvalOwnerKind = z.enum(['skill', 'agent']);
export type EvalOwnerKind = z.infer<typeof EvalOwnerKind>;

export const EvalCase = z.object({
  id: z.string(),
  owner_kind: EvalOwnerKind,
  owner_id: z.string(),
  name: z.string(),
  input_diff: z.string(),
  input_files: z.unknown(),
  input_meta: z.unknown(),
  expected_output: z.unknown(),
  notes: z.string().nullish(),
});
export type EvalCase = z.infer<typeof EvalCase>;

// ---- Memory ----
export const MemoryScope = z.enum(['repo', 'global', 'team']);
export type MemoryScope = z.infer<typeof MemoryScope>;

export const MemoryKind = z.enum([
  'decision',
  'convention',
  'preference',
  'fact',
  'learning',
]);
export type MemoryKind = z.infer<typeof MemoryKind>;

export const MemorySource = z.object({
  pr: z.number().int().nullish(),
  context: z.string(),
});
export type MemorySource = z.infer<typeof MemorySource>;

export const MemoryItem = z.object({
  content: z.string(),
  scope: MemoryScope,
  kind: MemoryKind,
  confidence: z.number().min(0).max(1),
  sources: z.array(MemorySource),
});
export type MemoryItem = z.infer<typeof MemoryItem>;

// ---- Skills ----
// A skill is TEXT ONLY: a markdown body injected into an agent's prompt as its
// own block (L02, `specs/L02-skills.md`). It never carries tools or code.
export const SkillType = z.enum(['rubric', 'convention', 'security', 'custom']);
export type SkillType = z.infer<typeof SkillType>;

// `imported_file` = saved from `POST /skills/import/preview` (a .md or .zip the
// user uploaded). The DB column is plain text (no CHECK), so new values need no
// migration.
export const SkillSource = z.enum([
  'manual',
  'imported_url',
  'imported_file',
  'extracted',
  'community',
]);
export type SkillSource = z.infer<typeof SkillSource>;

/** kebab-case, 1–64 chars — the name is also the `### Skill: <name>` header. */
export const SkillName = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'kebab-case: lowercase letters, digits and single dashes');
export type SkillName = z.infer<typeof SkillName>;

export const SKILL_DESCRIPTION_MAX = 500;
export const SKILL_BODY_MAX = 50_000;

export const Skill = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: SkillType,
  source: SkillSource,
  body: z.string(),
  enabled: z.boolean(),
  version: z.number().int(),
  evidence_files: z.array(z.string()).nullish(),
  /** Agents with a link to this skill, enabled or not ("Used by N agents"). */
  agent_count: z.number().int().nonnegative(),
  /** Tokens of `body` (js-tiktoken cl100k — approximate for other models). */
  body_tokens: z.number().int().nonnegative(),
  /** ISO time the first enable of an imported skill was acknowledged; null otherwise. */
  acknowledged_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Skill = z.infer<typeof Skill>;

/**
 * `POST /skills` body — MANUAL create only. Imports are saved by
 * `POST /skills/import` (SkillImportSave), where the server itself parses the
 * file and sets source/enabled/acknowledged_at — the client never supplies an
 * imported body or claims a source.
 */
export const SkillInput = z.object({
  name: SkillName,
  description: z.string().trim().min(1).max(SKILL_DESCRIPTION_MAX),
  type: SkillType,
  body: z.string().min(1).max(SKILL_BODY_MAX),
  source: z.literal('manual').default('manual'),
  enabled: z.boolean().default(true),
});
export type SkillInput = z.infer<typeof SkillInput>;

/** `PUT /skills/:id` body. name/description/type/body changes bump the version. */
export const SkillPatch = z
  .object({
    name: SkillName.optional(),
    description: z.string().trim().min(1).max(SKILL_DESCRIPTION_MAX).optional(),
    type: SkillType.optional(),
    body: z.string().min(1).max(SKILL_BODY_MAX).optional(),
    enabled: z.boolean().optional(),
    /** Required with `enabled: true` the first time an imported skill is enabled. */
    acknowledge_injection: z.literal(true).optional(),
  })
  .refine(
    (p) =>
      p.name !== undefined ||
      p.description !== undefined ||
      p.type !== undefined ||
      p.body !== undefined ||
      p.enabled !== undefined,
    { message: 'empty patch' },
  );
export type SkillPatch = z.infer<typeof SkillPatch>;

/**
 * One row of `skill_versions` — the BODY as of that version. Snapshots hold
 * only the body, so a metadata-only edit (name/description/type) bumps the
 * version with an unchanged body (the UI labels it "metadata change").
 */
export const SkillVersion = z.object({
  skill_id: z.string(),
  version: z.number().int(),
  body: z.string(),
  created_at: z.string(),
});
export type SkillVersion = z.infer<typeof SkillVersion>;

/** Error codes of the skills routes (envelope `error.code`). */
export const SkillErrorCode = z.enum([
  'skill_name_taken', // 409 — (workspace, name) already exists
  'skill_ack_required', // 409 — first enable of an imported skill without acknowledge_injection
  'skill_not_in_workspace', // 400 — PUT /agents/:id/skills references an unknown/foreign skill
  'import_unsupported_file', // 415 — neither .md nor .zip
  'import_too_large', // 413 — upload > 512 KB, > 1 MB uncompressed or > 200 entries
  'import_bad_archive', // 422 — unreadable .zip or SKILL.md is not UTF-8 text
  'import_unsafe_path', // 422 — `..`, absolute, drive-letter or symlink entry
  'import_no_skill_md', // 422 — no SKILL.md at the root or in one top-level folder
  'import_bad_frontmatter', // 422 — frontmatter is not valid YAML or not a mapping
  'import_description_missing', // 422 — save: no frontmatter description and no override
  'import_invalid_name', // 422 — save: the final name is not a valid SkillName
  // 422 — save: a field breaks a SkillInput limit; details { field, limit }:
  // description > SKILL_DESCRIPTION_MAX, body > SKILL_BODY_MAX, empty body (limit 1)
  'import_invalid_field',
]);
export type SkillErrorCode = z.infer<typeof SkillErrorCode>;

export const SKILL_IMPORT_MAX_BYTES = 512 * 1024;

/** `POST /skills/import/preview` body. The server stores nothing for it. */
export const SkillImportRequest = z.object({
  filename: z.string().min(1).max(255),
  // base64 of ≤ 512 KB → ≤ 699 052 chars
  content_base64: z.string().min(1).max(Math.ceil(SKILL_IMPORT_MAX_BYTES / 3) * 4),
});
export type SkillImportRequest = z.infer<typeof SkillImportRequest>;

/**
 * `POST /skills/import` body → 201 Skill. The server re-runs the import pipeline
 * on the file, applies ONLY these overrides and itself sets
 * source = 'imported_file', enabled = false, acknowledged_at = null; the body is
 * always the parsed body.
 */
export const SkillImportSave = SkillImportRequest.extend({
  name: SkillName.optional(),
  description: z.string().trim().min(1).max(SKILL_DESCRIPTION_MAX).optional(),
  type: SkillType.optional(),
});
export type SkillImportSave = z.infer<typeof SkillImportSave>;

/** Unvalidated draft extracted from SKILL.md — the user edits it, then saves it as SkillInput. */
export const SkillDraft = z.object({
  name: z.string(),
  description: z.string(),
  type: SkillType,
  body: z.string(),
});
export type SkillDraft = z.infer<typeof SkillDraft>;

export const SkillImportFileStatus = z.enum(['imported', 'reference', 'skipped']);
export type SkillImportFileStatus = z.infer<typeof SkillImportFileStatus>;

export const SkillImportFile = z.object({
  path: z.string(),
  status: SkillImportFileStatus,
  /** Why, e.g. "not imported (v1)" or "skipped — never executed or stored". */
  reason: z.string(),
  /** Uncompressed size in bytes. */
  size: z.number().int().nonnegative(),
});
export type SkillImportFile = z.infer<typeof SkillImportFile>;

export const SkillImportWarningKind = z.enum([
  'html_comment', // <!-- … --> — invisible when rendered, still reaches the prompt
  'invisible_char', // zero-width / bidi control characters
  'long_line', // a line longer than 500 characters
  'name_exists', // the workspace already has a skill with the draft's name
  'name_normalized', // the frontmatter name was rewritten to kebab-case
  'type_defaulted', // the frontmatter type is missing or unknown → 'custom'
  'description_missing', // no description in the frontmatter — the user must write one
]);
export type SkillImportWarningKind = z.infer<typeof SkillImportWarningKind>;

export const SkillImportWarning = z.object({
  kind: SkillImportWarningKind,
  /** 1-based line of `raw_source` (frontmatter included); null when not about one line. */
  line: z.number().int().positive().nullable(),
  detail: z.string(),
});
export type SkillImportWarning = z.infer<typeof SkillImportWarning>;

export const SkillImportPreview = z.object({
  filename: z.string(),
  draft: SkillDraft,
  /** SKILL.md exactly as found (frontmatter + body) — shown raw, never rendered. */
  raw_source: z.string(),
  /** Every frontmatter key as parsed (only name/description/type are used). */
  frontmatter: z.record(z.unknown()),
  /** Every entry of the upload (a .md upload = one entry). */
  files: z.array(SkillImportFile),
  warnings: z.array(SkillImportWarning),
});
export type SkillImportPreview = z.infer<typeof SkillImportPreview>;

export const CommunitySkill = z.object({
  name: z.string(),
  repo: z.string(),
  stars: z.number().int(),
  lang: z.string(),
  desc: z.string(),
});
export type CommunitySkill = z.infer<typeof CommunitySkill>;

// ---- Conventions ----
export const ConventionCandidate = z.object({
  id: z.string(),
  rule: z.string(),
  evidence_path: z.string(),
  evidence_snippet: z.string(),
  confidence: z.number().min(0).max(1),
  accepted: z.boolean(),
});
export type ConventionCandidate = z.infer<typeof ConventionCandidate>;

// ---- Agents ----
// 'openrouter' routes through the OpenAI-compatible API (OpenAIProvider with a
// custom baseURL) — used by the CI runner for cheap models (DeepSeek/GLM/MiniMax).
export const Provider = z.enum(['openai', 'anthropic', 'openrouter']);
export type Provider = z.infer<typeof Provider>;

// Review execution strategy (matches @devdigest/reviewer-core's ReviewStrategy):
//  - single-pass: send the WHOLE diff in ONE model call (default)
//  - map-reduce:  one model call PER changed file (for very large diffs)
//  - auto:        single-pass, switching to map-reduce when the diff is large
export const ReviewStrategy = z.enum(['single-pass', 'map-reduce', 'auto']);
export type ReviewStrategy = z.infer<typeof ReviewStrategy>;

// CI gate policy — when a review should BLOCK (REQUEST_CHANGES + fail the check)
// vs just comment. Deterministic from finding severities, NOT the model's verdict:
//  - never:    never block, always comment (advisory only)
//  - critical: block iff >=1 CRITICAL finding (default)
//  - warning:  block iff >=1 WARNING or CRITICAL finding
//  - any:      block iff >=1 finding of any severity
export const CiFailOn = z.enum(['never', 'critical', 'warning', 'any']);
export type CiFailOn = z.infer<typeof CiFailOn>;

export const Agent = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  provider: Provider,
  model: z.string(),
  system_prompt: z.string(),
  output_schema: z.unknown().nullish(),
  enabled: z.boolean(),
  version: z.number().int(),
  strategy: ReviewStrategy.default('single-pass'),
  ci_fail_on: CiFailOn.default('critical'),
  // Inject repo-intel context (repo skeleton + callers + rank note) into this
  // agent's review prompt. Default on; gated again by the global flag.
  repo_intel: z.boolean().default(true),
  /** Effective skills: links with agent_skills.enabled AND skills.enabled (= what reaches the prompt). */
  skill_count: z.number().int().nonnegative(),
});
export type Agent = z.infer<typeof Agent>;

/** @deprecated pre-L02 link shape of the old POST /agents/:id/skills — use AgentSkill. */
export const AgentSkillLink = z.object({
  agent_id: z.string(),
  skill_id: z.string(),
  order: z.number().int(),
});
export type AgentSkillLink = z.infer<typeof AgentSkillLink>;

/** One link of an agent's ordered skill list (`GET /agents/:id/skills`). */
export const AgentSkill = z.object({
  skill_id: z.string(),
  /** 0-based position = order of the `### Skill:` blocks in the prompt. */
  order: z.number().int().nonnegative(),
  /** Per-agent switch; the skill is injected only when this AND skill.enabled. */
  enabled: z.boolean(),
  skill: Skill,
});
export type AgentSkill = z.infer<typeof AgentSkill>;

/** `PUT /agents/:id/skills` body — the full ordered list replaces the links. */
export const AgentSkillsPut = z.object({
  skills: z
    .array(z.object({ skill_id: z.string().uuid(), enabled: z.boolean() }))
    .max(100)
    .refine((xs) => new Set(xs.map((x) => x.skill_id)).size === xs.length, {
      message: 'duplicate skill_id',
    }),
});
export type AgentSkillsPut = z.infer<typeof AgentSkillsPut>;

/** `PUT /agents/:id/skills` response — the agent's version (bumped once when the list changed). */
export const AgentSkillsResult = z.object({
  version: z.number().int(),
  skills: z.array(AgentSkill),
});
export type AgentSkillsResult = z.infer<typeof AgentSkillsResult>;

/** A skill link as captured in an agent version snapshot. */
export const AgentVersionSkill = z.object({
  skill_id: z.string(),
  order: z.number().int().nonnegative(),
  enabled: z.boolean(),
});
export type AgentVersionSkill = z.infer<typeof AgentVersionSkill>;

// The immutable config snapshot captured in `agent_versions` whenever an agent's
// config changes (everything but `enabled`). Mirrors the shape written by the
// agents repository — provider/model/prompt/output_schema/strategy/gate/repo_intel
// plus the skill links at snapshot time. Used for reproducibility (eval replays
// a past version) and for surfacing an agent's edit history. Snapshots written
// before L02 stored `skills` as ordered ids; they are read as enabled links.
export const AgentVersionConfig = z.object({
  provider: Provider,
  model: z.string(),
  system_prompt: z.string(),
  output_schema: z.unknown().nullish(),
  strategy: ReviewStrategy,
  ci_fail_on: CiFailOn,
  repo_intel: z.boolean(),
  skills: z.preprocess(
    (v) =>
      Array.isArray(v)
        ? v.map((x, i) => (typeof x === 'string' ? { skill_id: x, order: i, enabled: true } : x))
        : v,
    z.array(AgentVersionSkill),
  ),
});
export type AgentVersionConfig = z.infer<typeof AgentVersionConfig>;

export const AgentVersion = z.object({
  agent_id: z.string(),
  version: z.number().int(),
  config: AgentVersionConfig,
  created_at: z.string(),
});
export type AgentVersion = z.infer<typeof AgentVersion>;
