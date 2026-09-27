# server — skills

Last verified: 2026-09-27 (L02 Stages 1–1b: schema + contracts; no skills routes yet)

## Scope

What must stay true for skills on the server: the tables, the contracts the
routes will serve, and what agents expose about their skill links. The feature
plan, stages and UI live in the root spec `../specs/L02-skills.md`. Prompt
rendering of skills belongs to reviewer-core (`../reviewer-core/specs/`).

Paths are relative to `server/`. `knowledge.ts`, `trace.ts` →
`src/vendor/shared/contracts/` (mirrored byte-for-byte to
`../client/src/vendor/shared/contracts/`).

## Data model

- `skills` (`src/db/schema/skills.ts:16-48`): unique
  `(workspace_id, name)` (`skills_ws_name_uq`), index `skills_ws_idx`;
  `acknowledged_at` (null until the first enable of an imported skill is
  acknowledged); `updated_at` refreshed by Drizzle `$onUpdate` on every
  `db.update(skills)` — services never set it by hand.
- `source` / `type` enums exist only in TypeScript; the SQL columns are `text`
  without a CHECK, so a new enum value (`imported_file`) needs no migration.
- `agent_skills.enabled` (`src/db/schema/agents.ts:60-63`): per-agent switch,
  default true. A skill is injected only when `agent_skills.enabled AND
  skills.enabled`.
- Migration `src/db/migrations/0011_white_sumo.sql` adds the three columns and
  the two indexes.

## Contracts

- `Skill` (`knowledge.ts`) carries `agent_count`, `body_tokens` (cl100k),
  `acknowledged_at` (ISO or null), `created_at`, `updated_at`.
- Inputs: `SkillInput` (manual create only: kebab-case `SkillName`,
  `source` is the literal `manual`), `SkillImportSave` (the import save: the
  file again + optional `name` / `description` / `type` overrides — never a
  body, source or enabled flag; the server re-parses the file and sets
  `source = imported_file`, `enabled = false`, `acknowledged_at = null`),
  `SkillPatch` (non-empty; `acknowledge_injection` is the
  literal `true`), `AgentSkillsPut` (ordered, unique `skill_id`s, ≤ 100).
- Outputs: `SkillVersion`, `AgentSkill`, `AgentSkillsResult {version,
  skills}`, `SkillImportPreview` (`raw_source`, `frontmatter`, `files`,
  `warnings` with kinds `SkillImportWarningKind`; `warnings[].line` is a
  1-based line of `raw_source`), error codes `SkillErrorCode` (incl.
  `import_description_missing`, `import_invalid_name` for the save).
- `Skill.agent_count` = agents with a link to the skill, enabled or not
  (the delete confirm's "Used by N agents").
- `Agent.skill_count` = the agent's **effective** skills
  (`agent_skills.enabled AND skills.enabled` — what reaches the prompt); every
  `Agent` the agents module returns carries it
  (`AgentsRepository.enabledSkillCounts`, `src/modules/agents/repository.ts:236`; used by `service.ts:58-72,114` and
  `repository.ts:66-78`).
- Agent version snapshots store `skills: [{skill_id, order, enabled}]`
  (`AgentsRepository.skillLinksForSnapshot`,
  `src/modules/agents/repository.ts:218`). `AgentVersionConfig` reads a
  pre-L02 `string[]` snapshot as `{skill_id, order: index, enabled: true}`.
- `PromptAssembly.skill_blocks` (`trace.ts`) is optional: traces saved before
  L02 stay valid.

## Known limitations

- `skill_versions` holds only the body: a metadata-only edit bumps
  `skills.version` with an unchanged body (the UI labels it "metadata
  change"). No migration planned.

## Tests

| Rule | Enforced by |
|---|---|
| old `string[]` snapshot → ordered enabled links; object links kept | `test/contracts.test.ts` ("L02 skills contracts") |
| `PromptAssembly` parses with and without `skill_blocks` | `test/contracts.test.ts` |
| `Skill` requires the L02 fields; `SkillInput` kebab-case + defaults, rejects `source: imported_file`; `SkillImportSave` overrides only (client body/source/enabled dropped); `SkillPatch` non-empty + ack literal; `AgentSkillsPut` unique ids | `test/contracts.test.ts` |
| agent version snapshots still written and read | `test/agents-versions.it.test.ts` |
| `skill_count` = effective links only; snapshot stores every link as `{skill_id, order, enabled}` | `test/agents-versions.it.test.ts:179` |
