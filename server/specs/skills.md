# server — skills

Last verified: 2026-09-27 (L02 Stage 7: seed wired)

## Scope

What must stay true for skills on the server: the tables, the contracts, the
skills routes (`src/modules/skills/`) and what agents expose about their skill
links. The feature
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
  `import_description_missing`, `import_invalid_name` and
  `import_invalid_field` — `details: {field, limit}` for a description > 500,
  a body > 50,000 or an empty body — for the save).
- `Skill.agent_count` = agents with a link to the skill, enabled or not
  (the delete confirm's "Used by N agents").
- `Agent.skill_count` = the agent's **effective** skills
  (`agent_skills.enabled AND skills.enabled` — what reaches the prompt); every
  `Agent` the agents module returns carries it, read through the port
  (`SkillsRepository.effectiveSkillCounts`,
  `src/modules/skills/repository.ts:218`).
- Agent version snapshots store `skills: [{skill_id, order, enabled}]`
  (`SkillsRepository.links`, `src/modules/skills/repository.ts:172`, written by
  `AgentsRepository.snapshotVersion` / `bumpVersion`,
  `src/modules/agents/repository.ts:184-200`). `AgentVersionConfig` reads a
  pre-L02 `string[]` snapshot as `{skill_id, order: index, enabled: true}`.
- `PromptAssembly.skill_blocks` (`trace.ts`) is optional: traces saved before
  L02 stay valid.

## Routes (`src/modules/skills/routes.ts`)

Every route declares `schema.response`; errors use the envelope
`{ error: { code, message, details } }`; everything is workspace-scoped and a
foreign or unknown id is 404 `not_found`.

| Route | Response | Errors |
|---|---|---|
| `GET /skills` (`:42`) | `Skill[]`, sorted by name | — |
| `POST /skills` (`:47`, body `SkillInput`) | 201 `Skill` (v1) | 409 `skill_name_taken` |
| `POST /skills/import/preview` (`:57`, body `SkillImportRequest`) | `SkillImportPreview`; stores nothing | 413 `import_too_large`, 415 `import_unsupported_file`, 422 other `import_*` |
| `POST /skills/import` (`:66`, body `SkillImportSave`) | 201 `Skill` — `imported_file`, disabled, `acknowledged_at` null, v1 | as above + 409 `skill_name_taken`, 422 `import_description_missing` / `import_invalid_name` / `import_invalid_field` |
| `GET /skills/:id` (`:76`) | `Skill` | 404 |
| `PUT /skills/:id` (`:81`, body `SkillPatch`) | `Skill` | 404, 409 `skill_name_taken`, 409 `skill_ack_required` |
| `DELETE /skills/:id` (`:90`) | 204, empty body (`reply.status(204).send(null)`) | 404 |
| `GET /skills/:id/versions` (`:100`) | `SkillVersion[]`, newest first | 404 |
| `GET /agents/:id/skills` (`:109`) | `AgentSkill[]` by `order` | 404 |
| `PUT /agents/:id/skills` (`:118`, body `AgentSkillsPut`) | `AgentSkillsResult` | 404, 400 `skill_not_in_workspace` (`details.skill_ids`) |

## Rules (`src/modules/skills/service.ts`, `helpers.ts`)

- **Create** (`service.ts:64`): one transaction inserts the skill at v1 and its
  `skill_versions` v1 row. A unique violation on `skills_ws_name_uq` maps to
  409 `skill_name_taken` (`helpers.ts:89`).
- **Update** (`service.ts:122`): one transaction locks the row
  (`SELECT … FOR UPDATE`, `repository.ts:75`), applies the ack rule and the
  version rule, writes, and snapshots the body on a bump.
  - Version rule (`bumpsVersion`, `helpers.ts:25`): a name / description /
    type / body value **different from the stored one** bumps; sending a
    field with its current value, or `enabled` only, does not.
  - Ack rule (`needsAck`, `helpers.ts:39`): `enabled: true` on an
    `imported_file` skill whose `acknowledged_at` is null needs
    `acknowledge_injection: true` (else 409 `skill_ack_required`); with it,
    `acknowledged_at` is stored once and never needed again.
- **Import** (`previewImport`, `saveImport` in `service.ts`): both decode the
  upload and run `buildImportPreview` with the workspace's skill names
  (`namesInWorkspace` → `name_exists`); the save re-runs it on the FILE,
  applies only the name / description / type overrides via
  `resolveImportSave`, and inserts the skill itself as `imported_file`,
  disabled, unacknowledged, with a v1 body snapshot — a body, source or
  enabled flag sent by the client is dropped by the `SkillImportSave` schema.
  Pipeline failures become `SkillImportError` (413 / 415 / 422,
  `errors.ts`).
- **Delete** cascades the skill's versions and agent links (FK).
- **Link save** (`setAgentSkills`, `service.ts:172`): one transaction locks the
  agent row (`AgentsRepository.lockVersion`), checks that every skill is in
  the workspace, compares the new `[{skill_id, order = index, enabled}]` list
  with the stored one (`linksChanged`, `helpers.ts:53` — stored `order`
  values count, so a legacy list with gaps changes once), and only when it
  differs replaces the links and bumps the agent version once with a snapshot
  (`AgentsRepository.bumpVersion`). An unchanged list writes nothing and
  returns the current version.
- `Skill.body_tokens` = `container.tokenizer` (cl100k) over the body.
- **In a review run** the executor reads `skillsRepo.enabledForAgent` and
  writes `prompt_assembly.skill_blocks` — see `review-flow.md` ("Skills").

## Import pipeline (`src/modules/skills/import/`, pure — no I/O, no DB)

Public surface (`index.ts`): `decodeImportBase64`, `buildImportPreview`,
`resolveImportSave` (`pipeline.ts:37`, `:63`, `:160`); failures are
`{ ok: false, code: SkillErrorCode, message, details? }`. The routes that call
them (`POST /skills/import/preview`, `POST /skills/import`) come in Stage 3b.

- **Decode:** base64 over `SKILL_IMPORT_MAX_BYTES` → `import_too_large`
  (checked before decoding); malformed base64 → `import_bad_archive`; a
  `data:` URL prefix is NOT stripped (the client sends bare base64).
- **File type:** `.md` → one entry; `.zip` → unzipped in memory with fflate;
  anything else → `import_unsupported_file`.
- **Zip checks** (`zip.ts`): an own central-directory read runs before any
  inflate (`readCentralDirectory`, `zip.ts:80`): ≤ 200 entries
  (`ZIP_MAX_ENTRIES`) and ≤ 1 MiB declared total (`ZIP_MAX_UNCOMPRESSED_BYTES`,
  `types.ts:17-18`) → else `import_too_large`; paths normalised (`\` → `/`,
  `.` and empty segments dropped) and `..`, leading `/`, drive letters, NUL
  and symlink entries (`S_IFLNK` in the external attributes, any host) →
  `import_unsafe_path`; ZIP64, encrypted entries and duplicate paths →
  `import_bad_archive`. After inflating only the vetted entries, each size
  must equal the declared size and its CRC-32 must match (`zip.ts:199-200`),
  else `import_bad_archive`.
- **SKILL.md:** the only candidates are a case-sensitive `SKILL.md` at the
  root or directly inside one top-level folder; exactly one is required —
  none or several (`details.candidates`) → `import_no_skill_md`
  (`pipeline.ts:219`). Decoded as strict UTF-8 (else `import_bad_archive`);
  a BOM stays in `raw_source` and is warned.
- **Frontmatter** (`frontmatter.ts:12`): `---` fenced YAML via `yaml`
  (`uniqueKeys`, `maxAliasCount: 100`); none/empty → `{}`; invalid, not a
  mapping or never closed → `import_bad_frontmatter`. Body = the text after
  the closing fence, leading blank lines and trailing whitespace trimmed.
- **Draft:** name from frontmatter normalised to kebab-case (`name.ts:9`,
  warning `name_normalized`), fallback folder / file name; `name_exists` when
  it is in the workspace's names; `type` must match exactly, else `custom` +
  `type_defaulted`; missing description → `''` + `description_missing`.
- **Files:** every non-directory entry: `imported` (SKILL.md), `reference`
  (`references/**/*.md`, "not imported (v1)"), `skipped` (everything else,
  "skipped — never executed or stored").
- **Warnings** (`warnings.ts:13`) on `raw_source` lines: `html_comment`,
  `invisible_char`, `long_line` (> 500) — warned, never stripped. Order:
  name/type/description warnings (`line: null`) first, then by line.
- **Save** (`resolveImportSave`): overrides win for name / description / type
  only; the body is always the parsed body. Final name not a `SkillName` →
  `import_invalid_name`; no description → `import_description_missing`;
  description > 500, body > 50,000 or an empty body → `import_invalid_field`
  with `details: {field, limit}`.
- `pnpm skill:pack <dir> <out.zip>` (`scripts/pack-skill.mjs`, fflate,
  forward-slash paths) packs a folder such as
  `test/fixtures/skills/api-deprecation-policy/` for a manual import.

## Seed data (`src/db/seed-skills.ts`, `src/db/seed-prs.ts`)

Plain typed data written by `src/db/seed.ts` (idempotent: skills by name
with a v1 body snapshot, PRs by number, and an agent's links only while it has
none, so user edits survive a re-seed — `test/seed.it.test.ts`):
`SEED_SKILLS` (10 manual skills), `SEED_AGENT_SKILL_LINKS` (per agent, array
order = `agent_skills.order`; Security 6 linked / 3 enabled; no API Contract
Reviewer — the user creates that agent and its skills in the UI,
`../specs/HW02-conventions-and-api-contract.md` D9),
`SEED_EXPERIMENT_PRS` (#483, #484 for L02 and #485, #486 for HW02 on
`acme/payments-api`, with `pr_files` patches in GitHub format, read by
`diffFromPrFiles` when there is no clone). `upsertExperimentPr`
(`src/db/seed.ts`) inserts each PR once. A PR with `refreshOnSeed` (#485, #486)
is rewritten, row + files + commits in one transaction, when its fixture has a
new `headSha`. That is how a calibration edit reaches a running DB
(`../specs/HW02-conventions-and-api-contract.md` D13).
Skill bodies and prompts stay generic — they never name the experiment PRs'
defects (see `../specs/L02-skills.md` D8).

## Known limitations

- ZIP64 archives and encrypted entries are rejected, not supported.

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
| CRUD, v1 + snapshot, version rule, no bump on enabled-only / unchanged values, 409 duplicate create + rename, ack 409 → OK → not needed again, `agent_count` incl. disabled links, delete cascade, workspace scope, R3 shapes | `test/skills.it.test.ts` |
| link order/enabled, one bump per changed save, no bump on unchanged list, detach-all bump, 400 foreign/unknown skill with nothing written, 404 agent, effective `skill_count`, config edit snapshots links, port `enabledForAgent` / `namesInWorkspace`, R3 shapes | `test/agent-skills.it.test.ts` |
| import routes + trust path: preview stores nothing and lists skipped scripts; save ignores a client body/source/enabled, stores `imported_file` disabled with the parsed body; `name_exists` then 409 duplicate; enable → 409 `skill_ack_required` → with ack 200 + `acknowledged_at`, no bump; overrides on a `.md`; 415 / 422 codes incl. `import_invalid_field` details; R3 shapes | `test/skill-import.it.test.ts` |
| seed idempotent (second run adds nothing); 4 agents, 10 skills + v1 snapshots, 12 links, PRs #482–#486 with `@@` patches; a refreshable PR is rewritten only on a new head sha, never an L02 PR, and counts are unchanged afterwards; Security 6 linked / 3 enabled in design order; a re-seed keeps a user's unticked link | `test/seed.it.test.ts` |
| experiment PR fixtures: additions / deletions and hunk headers match each patch; only #485 / #486 refresh on seed | `test/seed-prs.test.ts` |
| pure rules: `bumpsVersion`, `needsAck`, `linksChanged`, `missingIds`, DTO mapping, unique-violation detection | `test/skills-helpers.test.ts` |
| import: `.md` and folder zip; quoted / colon / `>` / `\|` / nested frontmatter; `..`, absolute, drive, backslash, symlink paths; > 200 entries; declared and inflated size + CRC; references and skipped files; no or several SKILL.md; bad frontmatter; unsupported file; base64 limit and malformed base64; every warning kind; `resolveImportSave` overrides, `import_description_missing`, `import_invalid_name`, `import_invalid_field` (description, empty body, long body), body never overridable | `test/skill-import.test.ts` |
