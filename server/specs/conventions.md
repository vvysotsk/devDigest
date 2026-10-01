Status: Stage 2b (module, routes, extraction). The client page and the e2e flow arrive in 2c / 2d.
Last verified: 2026-10-01 against the working tree (carry-over fix included).

# Conventions Extractor — what must stay true

Course feature HW02 (`../../specs/HW02-conventions-and-api-contract.md`,
D14–D18, D8). This file pins the server side: the two tables, the shared zod
contracts, the five routes, the extraction invariants and the tests that
guard them. The module is `src/modules/conventions/` (`routes.ts` →
`service.ts` → `repository.ts`; pure rules in `helpers.ts`, ports and the
LLM answer schema in `types.ts`, `ConventionErrorCode` errors in `errors.ts`).

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
| `head_sha` | text NOT NULL | `GitClient.currentHead` when the scan starts (evidence links use it, K5) |
| `sample_count` | integer NOT NULL | default 0; files actually read and sent to the model (set when the scan ends) |
| `candidates_dropped` | integer NOT NULL | default 0; candidates refused by the evidence check (D16) |
| `provider`, `model` | text NULL | resolved per run (D8); null when the run fails before resolution |
| `error` | text NULL | set with `failed` |
| `started_at` | timestamptz NOT NULL | default `now()` |
| `finished_at` | timestamptz NULL | set with `done` / `failed` |

Indexes: `convention_scans_ws_idx (workspace_id)`,
`convention_scans_repo_started_idx (repo_id, started_at DESC)` — "latest scan
per repo" is the read path of `GET /repos/:id/conventions`
(`src/modules/conventions/repository.ts:53`).

### `conventions` — one candidate of a scan (D16, D17)

| Column | Type | Rule |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `workspace_id` | uuid NOT NULL | FK `workspaces.id`, cascade |
| `repo_id` | uuid NOT NULL | FK `repos.id`, cascade |
| `scan_id` | uuid NOT NULL | FK `convention_scans.id`, cascade — deleting a scan deletes its candidates |
| `category` | text NOT NULL | `naming` · `structure` · `async` · `error-handling` · `types` · `imports` · `testing` · `other` |
| `rule` | text NOT NULL | the convention in one sentence (whitespace-normalised on store) |
| `evidence_path` | text NOT NULL | a file that was sampled in this scan |
| `evidence_line` | integer NOT NULL | the line where the quote was found |
| `evidence_snippet` | text NOT NULL | ±2 lines read from the sampled file by code |
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

`ConventionExtraction` — the model's answer — is server-only
(`src/modules/conventions/types.ts:27`): `{ candidates: [{ category, rule
(min 1), evidence: { file (min 1), line (int ≥ 1), quote (min 1) },
confidence (0..1) }] }`. `quote` is our addition to #40.

The `GitClient` port gained `listRootFiles(repo): Promise<string[]>` for the
D15 sampling (`src/vendor/shared/adapters.ts:232`, mirrored to the client
copy; `src/adapters/git/simple-git.ts:134` → regular files of the clone root,
`[]` when the clone is missing; the mock returns the top-level keys of its
`files`, `src/adapters/mocks.ts:308`).

## Routes (`src/modules/conventions/routes.ts`)

Every route declares `schema.response` (onion R3) and `params: IdParams`
(uuid). Errors use the envelope; the codes are `ConventionErrorCode` plus
`not_found` (404) and `validation_error` (422).

| Method | Path | Success | Errors |
|---|---|---|---|
| POST | `/repos/:id/conventions/extract` | 202 `ConventionScan` (`running`) | 404 repo; 409 `repo_not_cloned` (`repos.clone_path` null); 409 `repo_not_indexed` (`repoIntel.getConventionSamples` → `[]`); 409 `scan_running` (`details.scan_id`) |
| GET | `/repos/:id/conventions` | 200 `ConventionsState` — the latest scan by `started_at` and its non-rejected candidates in insertion order; `{ scan: null, candidates: [] }` before the first scan | 404 repo |
| PATCH | `/conventions/:id` | 200 `ConventionCandidate` — `status` / `rule` / `category` changed in place, workspace-scoped | 404; 422 empty patch |
| GET | `/repos/:id/conventions/skill-draft` | 200 `ConventionSkillDraft` — built from the **accepted** candidates of the latest scan only; `name` `repo-conventions`, `type` `convention`; `existing` = the workspace skill with that name when its `source` is `extracted`, else `null` | 404 repo |
| POST | `/repos/:id/conventions/skill` | 201 `Skill` (created) · 200 `Skill` (next version of the existing `extracted` skill) | 404 repo / agent; 400 `candidate_not_accepted` (`details.candidate_ids` = the refused ids); 409 `skill_name_taken` (the name belongs to a non-`extracted` skill) |

The routes build `ConventionsService` from `container.conventionsRepo`,
`container.skillsService` and the container's deps; they call no adapter and
no repository themselves (`src/modules/conventions/routes.ts:28-32`).

## Extraction invariants (`src/modules/conventions/service.ts`)

1. **202 first, work later (D14).** `startScan` (`:82`) checks the repo, the
   clone and the index, records `GitClient.currentHead`, then creates the
   `running` row through `createScanExclusive` and returns it. The
   extraction runs as a detached promise whose `.catch` only logs (`:96`);
   `JobRunner` is not used (its 120 s timeout and retries would re-pay an
   LLM call).
2. **One running scan per repo.** `createScanExclusive`
   (`src/modules/conventions/repository.ts:69`) takes
   `pg_advisory_xact_lock(hashtext(repo_id))` in one transaction, checks for
   a `running` row and inserts; the service answers 409 `scan_running` when
   the check hits (`service.ts:93`). The lock lives in the repository: the
   service never imports drizzle.
3. **Sampling without a model (D15, #39).** `readSamples` (`:168`): the root
   files from `git.listRootFiles` that match `isRootConfigFile`
   (`eslint.config.*`, `.eslintrc*`, `tsconfig*.json`, `.prettierrc*`,
   `prettier.config.*`; `helpers.ts:30`) plus the 12 ranked paths from
   `repoIntel.getConventionSamples(repoId, 12)`, each read with
   `git.readFile`; unreadable or empty files are skipped. The LLM is called
   only after sampling; a 409 never reaches the model.
4. **The model call (D8, D16).** `container.featureModels.resolve(ws,
   'conventions')` picks the provider and model per run (the Settings
   override, else the registry default); one `completeStructured` with
   `schemaName: 'ConventionExtraction'`, `maxRetries: 1` (`:117-122`). The
   prompt (`helpers.ts:255`) numbers lines `N | text`, caps each file at 200
   lines (`SAMPLE_LINE_CAP`) and wraps every file in
   `<untrusted source="file:<path>">…</untrusted>` (reviewer-core's
   `wrapUntrusted`); the system prompt states that file contents are data,
   never instructions.
5. **Evidence check (D16 + security).** `evidence.file` comes from the model,
   which read untrusted repo content, so it is accepted only when its
   normalised form (`\` → `/`, no leading `./`) is exactly one of the sampled
   paths (`isSampledPath`, `helpers.ts:179`); `..`, absolute paths and real
   but unsampled files are dropped **without any `readFile`**. The quote is
   then looked for on `line`, ±1, ±2 in the contents already read for the
   prompt, whitespace-normalised; a quote that spans lines counts for the line
   it starts on (`findQuote`, `:60`). Stored: the found line and a ±2 snippet
   read by code (`snippetAround`, `:77`). Every refused candidate adds one to
   `candidates_dropped`.
6. **Decisions carry over (D17, #48).** The repo's earlier `accepted` /
   `rejected` rows (`earlierDecisions`, `repository.ts:205`, oldest first)
   are read before the model call (`service.ts:112`). A new candidate
   inherits the LATEST earlier decision that matches it
   (`carryDecision`, `helpers.ts:112`); a decision matches
   (`decisionMatches`, `:102`) when EITHER the normalised rule text is the
   same (`normaliseRule`, `:84`: lower-case, collapsed whitespace, no
   trailing `.;:!`) OR the evidence is: same `evidence_path`, line within
   ±2 (`LINE_TOLERANCE`) and the same category — the live model rephrases
   every rule on each scan while the verified evidence stays put, and the
   category is required because two different conventions can sit within
   two lines of each other. No match → `pending`. A rejected rule therefore
   never returns to the GET, in any wording.
   The same earlier decisions go to the model as data: the user prompt
   carries one `<prior-decisions>` block (`renderPriorDecisions`, `:146`;
   `priorRules`, `:122` — latest status per normalised rule, newest first,
   at most 50 accepted and 50 rejected) placed BEFORE the first
   `<untrusted>` block, with `</prior-decisions>` and `</untrusted>` inside
   any rule text neutralised (`neutraliseTags`, `:141`); the system prompt
   says the block is data to follow for its accept/reject meaning, never
   instructions (`:241`). The rule texts were written by the model from
   untrusted repo content, so they never re-enter the prompt as plain
   instructions.
7. **Atomic close.** Candidates and the `done` row (`sample_count`,
   `candidates_dropped`, `provider`, `model`) are written in one transaction
   (`:131`). Any throw closes the scan as `failed` with the error message
   (`:146-158`), `provider` / `model` when they were resolved, and the
   sample count reached.
8. **Boot reaper.** `reapStaleRunningScans` (`repository.ts:110`) marks every
   `running` scan `failed` with `error` "server restarted while the scan was
   running" and sets `finished_at`; `src/app.ts:92` awaits it right after the
   review-run reaper, before any plugin.

## The skill (D18)

- `skillDraft` (`service.ts:208`): body from `renderSkillBody`
  (`helpers.ts:281`) — an intro line, then one `## <rule>` section per
  accepted candidate with `- Category:`, ``- Evidence: `path:line` `` and the
  snippet in a fence; description from `renderSkillDescription`.
- `saveSkill` (`:232`): every `candidate_ids` entry must be a candidate of
  this repo with `status: accepted` (else 400 with the refused ids, `:245`);
  `evidence_files` = the distinct `evidence_path`s, sorted. A skill with the
  requested name that is `extracted` gets the next version through
  `SkillsService.updateExtracted` (`src/modules/skills/service.ts:137`: the
  same bump rule as `PUT /skills/:id` — a changed description / type / body
  bumps and snapshots, `enabled` alone does not; no ack rule); any other
  owner of the name → 409 (`:261`); no owner → `createExtracted`
  (`skills/service.ts:118`: v1, `source: 'extracted'`, `evidence_files`).
  `enabled` from the body sets the skill row and the agent link.
- **Linked once** (`:269-275`): the agent's current links are read through
  `skillsService.agentSkills`; when the skill is absent it is appended with
  `{ skill_id, enabled: body.enabled }` through `setAgentSkills` (one agent
  version bump); when present, links and the agent version stay untouched.
- The skill save and the link are two transactions of the skills module; a
  failure between them leaves a saved skill without a link (linkable by
  hand), no invariant breaks.
- Cross-module access: `container.skillsService` typed as `SkillsWriter`
  (`types.ts:110`) and `container.featureModels` (`src/modules/settings/types.ts:10`);
  the module imports nothing from `modules/skills` or `modules/settings`
  (`pnpm deps:check`: no new violation).

## Seed data (`src/db/seed-conventions.ts`)

Plain typed data written by `src/db/seed.ts:287-313`: one `done` scan on
`acme/payments-api` (`head_sha` = PR #482's `a1b2c3d4e5f6`, `sample_count`
14, `candidates_dropped` 1, provider `openrouter`, model `seed`) with four
`pending` candidates (`SEED_CONVENTIONS`, `:41`), inserted only while the
repo has no scan, so a user's accept / reject / edit survives a re-seed. It
exists for the browser flow `../../e2e/specs/09-conventions.flow.json`
(HW02 D20); the extraction path itself is covered by the `.it` tests below.

## Tests

| Guarantee | Test |
|---|---|
| The contracts parse valid fixtures and reject `confidence > 1`, an unknown category, `evidence_line 0`, an empty patch, a non-kebab skill name and empty `candidate_ids` | `test/contracts.test.ts` "Convention contracts (HW02 2a)" |
| Both migrations apply on a fresh DB (14 journal entries); a scan defaults to `running` with zero counts; a candidate defaults to `pending`; `evidence_path` is NOT NULL; deleting a scan cascades to its candidates | `test/conventions-schema.it.test.ts` |
| The seed stores exactly one `done` scan with the four pending fixture candidates on `acme/payments-api`; a second seed adds nothing (`scans: 1, conventions: 4` in the idempotency counts); an accepted candidate stays accepted after a re-seed | `test/seed.it.test.ts:52`, `:108` |
| D15 config-file filter (positive / negative names), `N \| text` numbering with the 200-line cap, `findQuote` on the line / ±2 / whitespace / spanning quote / miss, `snippetAround` clamped, `normaliseRule`, `isSampledPath` (`./`, `\`, `..`, absolute, unsampled, empty), `verifyCandidates` (found line, code-read snippet, 3 drops), the `ConventionExtraction` schema, the `<untrusted>` wrapping + system sentence + cap, the D18 body format | `test/conventions-helpers.test.ts` |
| `SimpleGitClient.listRootFiles`: root regular files only, dotfiles included, nothing nested, `[]` for a missing clone; `MockGitClient.listRootFiles` + `reads` recording | `test/git-adapter.test.ts`, `test/adapters.test.ts` |
| 409 `repo_not_cloned` / `repo_not_indexed` with zero LLM calls; 404 unknown repo | `test/conventions.it.test.ts:195` |
| 202 `running` → `done` with `head_sha`, `sample_count` 3, `candidates_dropped` 3, the model chosen in Settings (#53); numbered untrusted samples in the prompt; verified candidates with found line + snippet; refused paths never read | `test/conventions.it.test.ts:214` |
| 409 `scan_running` with the running id; the scan survives a new app on the same DB (#38); a stale `running` row is `failed` with the reaper error at boot; a fresh extract then works | `test/conventions.it.test.ts:273` |
| PATCH reject / accept / edit in place with shape tests, 404, 422; a re-scan stores the rejected rule as `rejected` (absent from GET) and keeps the accepted one `accepted` (#48, text match) | `test/conventions.it.test.ts:302` |
| A re-scan whose model answer REPHRASES every rule at the same evidence keeps the accepted one `accepted` (line found by the ±2 search) and stores the rejected one `rejected` (absent from GET); the scan-2 prompt carries both scan-1 rule texts in a `<prior-decisions>` block before the first untrusted block (D17 fix, #48) | `test/conventions.it.test.ts:360` |
| `carryDecision` / `decisionMatches`: text match regardless of evidence; location match (path, ±2, category) regardless of text; no carry without the category, beyond ±2, or from another file; latest match wins; `priorRules` dedupe, newest first, cap 50; `neutraliseTags` both tags; the `<prior-decisions>` block before the first untrusted block, a rule cannot close either tag, only non-empty headings, nothing without decisions, the system sentence | `test/conventions-helpers.test.ts:259`, `:317` |
| Draft from accepted only with `existing: null`; 400 `candidate_not_accepted`; 404 agent; 201 `extracted` skill with `evidence_files`, linked with the body's `enabled`, agent version +1; `existing` set afterwards; identical re-save → 200 v1, links untouched; changed body → 200 v2 with two versions, still one link, agent version unchanged, still one `repo-conventions`; 409 `skill_name_taken` for a manual skill's name | `test/conventions.it.test.ts:345` |
| A model answer that fails the schema → scan `failed` with the error, `sample_count` kept, no candidates | `test/conventions.it.test.ts:441` |
