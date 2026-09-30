Status: Stage 2a (data model and contracts). Routes and the module arrive in 2b.
Last verified: 2026-09-30 against the working tree.

# Conventions Extractor — what must stay true

Course feature HW02 (`../../specs/HW02-conventions-and-api-contract.md`,
D14–D18). This file pins the server-side contracts of the feature: the two
tables, the shared zod schemas and the tests that guard them. The module
(`src/modules/conventions/`), its routes and the LLM answer schema are added
in Stage 2b and documented here when they land.

## Data model

Both tables live in `src/db/schema/knowledge.ts`; `src/db/schema.ts` exports
them in the `schema` object. Migrations (drizzle-kit output, never edited):

| Migration | Change |
|---|---|
| `0012_ordinary_sway.sql` | `ALTER TABLE conventions DROP COLUMN accepted` |
| `0013_mute_namorita.sql` | `CREATE TABLE convention_scans`; `conventions`: `repo_id`, `evidence_path`, `evidence_snippet`, `confidence` → NOT NULL; new columns `scan_id`, `category`, `evidence_line`, `status`, `created_at`, `updated_at`; FKs and indexes |

Two files instead of one because drizzle-kit 0.30 in strict mode asks
"renamed or created?" interactively when one table drops and adds columns in
the same `generate`; the drop was generated first, the rest second.

### `convention_scans` — one extraction run (D14, D17)

| Column | Type | Rule |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `workspace_id` | uuid NOT NULL | FK `workspaces.id`, cascade |
| `repo_id` | uuid NOT NULL | FK `repos.id`, cascade |
| `status` | text NOT NULL | `running` (default) · `done` · `failed` |
| `head_sha` | text NOT NULL | the clone head when the scan starts (evidence links use it, K5) |
| `sample_count` | integer NOT NULL | default 0 |
| `candidates_dropped` | integer NOT NULL | default 0; candidates whose quote was not found (D16) |
| `provider`, `model` | text NULL | resolved per run (D8); null when the run fails before resolution |
| `error` | text NULL | set with `failed` |
| `started_at` | timestamptz NOT NULL | default `now()` |
| `finished_at` | timestamptz NULL | set with `done` / `failed` |

Indexes: `convention_scans_ws_idx (workspace_id)`,
`convention_scans_repo_started_idx (repo_id, started_at DESC)` — "latest scan
per repo" is the read path of `GET /repos/:id/conventions`.

### `conventions` — one candidate of a scan (D16, D17)

| Column | Type | Rule |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `workspace_id` | uuid NOT NULL | FK `workspaces.id`, cascade |
| `repo_id` | uuid NOT NULL | FK `repos.id`, cascade |
| `scan_id` | uuid NOT NULL | FK `convention_scans.id`, cascade — deleting a scan deletes its candidates |
| `category` | text NOT NULL | `naming` · `structure` · `async` · `error-handling` · `types` · `imports` · `testing` · `other` |
| `rule` | text NOT NULL | the convention in one sentence |
| `evidence_path` | text NOT NULL | file in the clone |
| `evidence_line` | integer NOT NULL | the line where the quote was found |
| `evidence_snippet` | text NOT NULL | ±2 lines read from the file by code |
| `confidence` | double precision NOT NULL | 0..1 |
| `status` | text NOT NULL | `pending` (default) · `accepted` · `rejected` |
| `created_at`, `updated_at` | timestamptz NOT NULL | default `now()`; `updated_at` bumped by Drizzle `$onUpdate` |

Index: `conventions_scan_idx (scan_id)`. Every evidence column is NOT NULL on
purpose: a candidate whose evidence check fails is dropped before it is
stored, so a stored row always has a verified file, line and snippet.

## Contracts (`src/vendor/shared/contracts/knowledge.ts`, "Conventions")

Mirrored byte-for-byte to `client/src/vendor/shared/contracts/knowledge.ts`.
Wire fields are snake_case; dates are ISO strings.

| Schema | Shape | Used by |
|---|---|---|
| `ConventionCategory` | the 8 categories above | candidates, patches, the LLM answer |
| `ConventionStatus` | `pending` · `accepted` · `rejected` | candidates, patches |
| `ConventionScanStatus` | `running` · `done` · `failed` | scans |
| `ConventionCandidate` | `id, scan_id, category, rule, evidence_path, evidence_line (int ≥ 1), evidence_snippet, confidence (0..1), status, created_at, updated_at` | `GET …/conventions`, `PATCH /conventions/:id` |
| `ConventionScan` | `id, repo_id, status, head_sha, sample_count, candidates_dropped, provider \| null, model \| null, error \| null, started_at, finished_at \| null` | `POST …/extract` (202), `GET …/conventions` |
| `ConventionsState` | `{ scan: ConventionScan \| null, candidates: ConventionCandidate[] }` — non-rejected candidates only | `GET …/conventions` |
| `ConventionPatch` | `{ status?, rule? (min 1), category? }`, at least one key | `PATCH /conventions/:id` body |
| `ConventionSkillDraft` | `{ name: SkillName, description, type: SkillType, body, existing: { id, version } \| null }` | `GET …/skill-draft` |
| `ConventionSkillSave` | `{ name: SkillName, description, type: SkillType, enabled, body (min 1), agent_id (uuid), candidate_ids (uuid[], min 1) }` | `POST …/skill` body |
| `ConventionErrorCode` | `scan_running` (409) · `repo_not_cloned` (409) · `repo_not_indexed` (409) · `candidate_not_accepted` (400) · `skill_name_taken` (409) | `error.code` of the routes |

`ConventionExtraction` — the model's answer `{ candidates: [{ category,
rule, evidence: { file, line, quote }, confidence }] }` — is server-only and
is defined inside the 2b module, not in the shared kernel.

## Tests

| Guarantee | Test |
|---|---|
| The contracts parse valid fixtures and reject `confidence > 1`, an unknown category, `evidence_line 0`, an empty patch, a non-kebab skill name and empty `candidate_ids` | `test/contracts.test.ts` "Convention contracts (HW02 2a)" |
| Both migrations apply on a fresh DB (14 journal entries); a scan defaults to `running` with zero counts; a candidate defaults to `pending`; `evidence_path` is NOT NULL; deleting a scan cascades to its candidates | `test/conventions-schema.it.test.ts` |
