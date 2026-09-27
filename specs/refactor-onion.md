# Onion refactor of server/ (pulls, polling, reviews, repo-intel)

Status: in-progress

Approved by the user on 2026-09-27. Branch `lesson-2`, one commit per stage,
one PR at the end. Evidence: `.claude/skills/onion-architecture/` (SKILL.md,
`references/research.md` §1.3), `server/.dependency-cruiser-known-violations.json`.

## Progress

| Stage | Status | Commit | Baseline after |
|---|---|---|---|
| 0 docs | done | 53f4149 | 18 |
| T characterization tests | done | 7879581 (+ fix 653defa, docs fbcd0e8) | 18 |
| a pulls | done | 160b523 (+ tests 2712a6e, ed642df) | 16 |
| b polling | done | fe1cd55 | 14 |
| b′ polling `opened_at` fix | done | b57c30b | 14 |
| c reviews rows | done | 649250a (+ golden test d0dd9ce) | 10 |
| d adapters + cross-module + skill 1.1.0 | done | 6fef5fe (d1 pure moves + job kinds, baseline 5), this commit (d2 `CodeParser` port, `Tokenizer`/`DepGraph` interfaces, skill 1.1.0) | 1 |
| e `Pick<Container>` (registration design approved first) | pending | | 1 |
| docs wrap-up | pending | | 1 |

## Context

The `onion-architecture` skill (introduced in cc1c0e2, now 1.0.1) recorded `pulls` and
`polling` as "thin module → layered" triggers that had fired, and the `pulls`
detail sync (five writes, no transaction) as the first transaction candidate
— all deferred. The user has now decided to execute them, and to use the same
pass to clear most of the advisory baseline
(`server/.dependency-cruiser-known-violations.json`, 18 entries). Goal: move
every refactored route to route → service → repository, keep the API
contract byte-for-byte (client unchanged), make the `pulls` sync atomic, and
leave the baseline with only documented exceptions. No behaviour change except
one explicit, separately committed fix (polling `opened_at`).

## Decisions

1. **Polling `opened_at`** — unify onto one upsert; new PRs via poll get
   `opened_at`. On conflict `opened_at = coalesce(existing, excluded)` (never
   overwritten with null). Separate commit after the refactor: first the
   characterization test pins today's behaviour, then a `fix` commit changes
   it and updates the test explicitly.
2. **`PollResult`** — new contract in `server/src/vendor/shared/contracts/platform.ts`,
   mirrored to `client/src/vendor/shared` (the contract describes the API,
   not one consumer).
3. **PR-list aggregates** — the reviews module's `ReviewRepository` (table
   owner) gets narrow read methods, reached via the existing, unused
   `container.reviewRepo`. It returns narrow types (`CostableRun`, …); the
   COST / FINDINGS rules stay in `modules/_shared/{run-cost,latest-batch}.ts`.
4. **Module-only ports** (`Tokenizer`, new `CodeParser` over astgrep) live in
   `modules/repo-intel/types.ts`; adapters implement them. The skill is
   updated accordingly: R5 wording, Map "Ports" row, minor version bump
   (1.1.0) + changelog.
5. **`DepGraph`** — its interface also moves to `repo-intel/types.ts` in
   stage d (consistency with `Tokenizer`).
6. **Ownership leak** — the reviews module writing `pull_requests`
   (`markReviewed`) is only recorded in "Architecture decisions", not fixed.
7. **Branching** — one branch `lesson-2`, one commit per stage, one PR at
   the end.
8. **Gate** — after every stage `pr-self-review --mode blocking` with
   0 CRITICAL (see §4).

## Step 0 — before any code (one docs commit, done)

- Memory: update `onion-architecture-skill.md` — pulls/polling refactor and
  the pulls transaction are no longer deferred (in progress).
- `server/docs/architecture.md` → "Architecture decisions": new line dated
  the day it is written (2026-09-27 or later) — both triggers and the pulls-sync transaction are now being
  executed per `specs/refactor-onion.md`; earlier entries untouched.
- `specs/refactor-onion.md` — this file.

## 1. Classification

### Baseline entries (18)

| # | Violation | Kind / evidence | Decision |
|---|---|---|---|
| 1 | `reviews/diff-loader.ts` → `adapters/git/diff-parser` | PURE: one function `parseUnifiedDiff` (`adapters/git/diff-parser.ts:14`), also used by adapters `simple-git.ts:13`, `mocks.ts:35` | **Fix (d)**: move to `modules/_shared/diff-parser.ts`; adapters import it inward. |
| 2–4 | `repo-intel/{service,pipeline/full,pipeline/incremental}.ts` → `adapters/codeindex/extract` | PURE regex, no imports (`extract.ts:78-202`); also used by `adapters/codeindex/ripgrep.ts:12`, `astgrep/index.ts:24` (types) | **Fix (d)**: move to `modules/repo-intel/extract.ts`. |
| 5–7 | same three → `adapters/astgrep/index.ts` | REAL: native `@ast-grep/napi` (`:20`), `node:fs` (`:21`); no port, no container key | **Fix (d)**: `CodeParser` port in `repo-intel/types.ts`, `AstGrepCodeParser` class in the adapter, `container.codeParser` + `ContainerOverrides.codeParser`; service/pipelines get it via deps. |
| 8 | `repo-intel/pipeline/repo-map.ts` → `adapters/tokenizer` | Type-only `import type { Tokenizer }` (`repo-map.ts:12`); adapter `TiktokenTokenizer` already behind `container.tokenizer` (`container.ts:128`) | **Fix (d)**: move `Tokenizer` interface (+ pure `approxTokens`) to `repo-intel/types.ts`; adapter implements. |
| 9 | `reviews/service.ts` → `db/rows` (`AgentRow`) | `service.ts:4`, `:47-58`, `:119-147` | **Fix (c)**. |
| 10–11 | `reviews/run-executor.ts` → `db/schema`, `db/rows` | `run-executor.ts:5-7`, `:30-35`, `:55-60` | **Fix (c)**. |
| 12 | `reviews/diff-loader.ts` → `db/schema` | `diff-loader.ts:4`, `:17` | **Fix (c)**. |
| 13 | `repos/helpers.ts` → `db/schema` | Type-only, `toRepoDto(row)` (`repos/helpers.ts:2`, `:44`) | **Out of scope**: repos module is not refactored; R1 "fix when touched". Stays in baseline (last entry). |
| 14–15 | `pulls/routes.ts` → `db/schema`, `drizzle-orm` | D-1 | **Fix (a)**. |
| 16–17 | `polling/routes.ts` → `db/schema`, `drizzle-orm` | D-1 | **Fix (b)**. |
| 18 | `repos/service.ts` → `repo-intel/constants.ts` | Job kinds `INDEX`/`REFRESH` (`repos/service.ts:11-14`, `:68`, `:129`) | **Fix (d)**: `modules/_shared/job-kinds.ts` (CLONE, INDEX, REFRESH, RESYNC); `repo-intel/constants.ts` re-exports, string values unchanged. |

Expected baseline after all stages: **1 entry** (#13).

### D-items (research §1.3)

| D | Decision |
|---|---|
| D-1 thin modules | **Fix** pulls (a), polling (b). `settings`, `workspace` stay the documented exception. |
| D-2 rows in application | **Fix** reviews (c). Other modules (agents, repo-intel internals, repos/helpers) out of scope, R1 "when touched". |
| D-3 services build own repos | **Fix** for new services (pulls, polling) and `ReviewService` (uses `container.reviewRepo`, one instance) (c). agents/repos out of scope. |
| D-4 service locator | **Fix (e)** `RepoIntelService` + pipelines → `Pick<Container, …>`; remove the second instance built in `repo-intel/routes.ts:29`. New services use `Pick` from the start. Others out of scope. |
| D-5 `node:fs` in repo-intel | **Documented exception** (trigger "port for clone file access" not fired). |
| D-6 app imports adapter module | **Fix (d)** via #1–#8. |
| D-7 cross-module import | **Fix (d)** via #18. |
| D-8 `AppError.statusCode` | **Documented exception** (R7). |
| D-9 no transactions | **Fix** pulls detail sync (a), polling upserts + `last_polled_at` (b). Executor's five writes (`run-executor.ts:219-292`): **out of scope** — trigger not decided; note as next candidate. |
| D-10 OpenRouter in core | **Out of scope** (trigger not fired). |
| D-11 core ↔ server folder | **Out of scope**. |
| D-12 ports in three places | **Partial fix (d)**: `Tokenizer` and `DepGraph` interfaces (`adapters/tokenizer/index.ts:16`, `adapters/depgraph/index.ts`) → `repo-intel/types.ts`. `vendor/shared/adapters.ts` keeps the ports shared across modules/client. |
| D-13 manual body parse (`reviews/routes.ts:32`) | **Out of scope** (route not refactored). |
| D-14 no response schemas | **Fix** for refactored routes only: 4 pulls routes + poll. |
| New: reviews writes `pull_requests` (`reviews/repository/pull.repo.ts:40` `markReviewed`) and reads `pr_files`/`repos` | **Out of scope, record** in "Architecture decisions" as a known ownership leak. |

## 2. Stages (each its own commit; order by risk)

Shared plumbing introduced in stage a and reused:
- `db/client.ts`: `export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]; export type DbOrTx = Db | Tx;`
- `container.ts`: getters `pullsRepo` (new `PullsRepository`), `reposRepo` (`RepoRepository`, today only built in `repos/service.ts:37`); `reviewRepo` gets its first consumer.
- Services take `deps: Pick<Container, …>` + repositories; routes build them once per plugin.

### T — characterization tests (commit before a/b)
Files: `server/test/pulls-sync.it.test.ts`, `server/test/polling.it.test.ts`.
Pattern: own repo + PR per test (`pulls-comments.it.test.ts:17-41` `setupRepoAndPr`), `MockGitHubClient` ALWAYS injected explicitly (unlike `reviews.it.test.ts:113-126`, which silently hits real GitHub when a token exists).
- List `GET /repos/:id/pulls`: insert values; conflict updates only title/head_sha/status/updated_at (author, branch, stats, opened_at kept); stat backfill for 0/0/0 rows (mock `pulls` with zero stats + `detail`), cap 10; GitHub throwing → persisted rows served; 404 foreign/unknown repo; derived `status`, `score`, `cost_usd`, `latest_batch` from seeded review.
- Detail `GET /pulls/:id`: `pr_files`/`pr_commits` replaced (incl. empty arrays), body + stats updated, response = GitHub detail + `id`; offline fallback returns persisted rows with DB `status`; 404.
- Poll `POST /repos/:id/poll`: rows upserted, `synced` count, `last_polled_at` bumped, **new PR gets `opened_at = null` (today's behaviour)**, 404, no token → 500 `config_error`.
- Every response also asserted with `Contract.strict().parse(res.json())` — this becomes the R3 shape test.
Must pass on current code unchanged.

### a — pulls (feat/refactor, highest value)
Files: `modules/pulls/{routes,service,repository}.ts` (new service + repository), `modules/reviews/repository.ts` + `repository/{review,run}.repo.ts` (3 read methods: latest review score per PR, runs as `CostableRun[]` per PR, finding severities per run ids), `modules/repos/repository.ts` (new `getRef(workspaceId, id)` → `{ id, owner, name }`, R1-conform), `platform/container.ts`, `db/client.ts`.
- `PullsRepository` owns `pull_requests`, `pr_files`, `pr_commits`; returns contract types (`PrMeta`-shaped rows mapped inside) or small named types; methods take `DbOrTx` where used in a transaction.
- Detail sync: GitHub fetch outside the transaction; `db.transaction(tx => replaceFiles, replaceCommits, updateDetail)`. On any DB error: rollback, then the existing offline fallback serves the previous rows (today it would serve half-deleted rows — this is the intended fix; covered by a new rollback test, e.g. `detail.commits` with `message: null` violating NOT NULL).
- Logging: service receives the request logger (same messages as today).
- `schema.response`: `PrMeta.array()`, `PrDetail`, `PrReviewComment.array()`, `PrReviewComment`.
Risks: response schema rejecting a real payload → 500 (mitigated: adapter returns only contract fields, `octokit.ts:50-110`; T's strict parse passes first). Aggregate query regression (covered by `reviews.it.test.ts:351-420` + T).
Baseline: −#14, −#15.

### b — polling (refactor) then b′ (fix)
b: `modules/polling/{routes,service}.ts`; writes only via `container.pullsRepo.upsertFromGitHub(tx, …)` and `container.reposRepo.markPolled(tx, id)`; one `db.transaction` for all upserts + `last_polled_at`; GitHub fetch before it. Keeps `opened_at` omitted (behaviour-identical). `PollResult` contract (server + client mirror) + `schema.response` + shape test. No import of another module folder.
b′ (`fix(polling): record opened_at for PRs first seen by poll`): pass `opened_at`; conflict `openedAt = coalesce(pull_requests.opened_at, excluded.opened_at)`. The test covers BOTH paths: a PR first seen by poll gets `opened_at`, and an existing row with `opened_at = null` gets it filled by the next PR-list sync; a non-null value is never overwritten. The commit message states that `coalesce` also fills null `opened_at` on the PR-list path. The T assertion that pinned `null` is updated explicitly in this commit.
Baseline: −#16, −#17.

### c — reviews rows (R1)
Files: `modules/reviews/{service,run-executor,diff-loader,helpers,findings}.ts`, `repository.ts`, `repository/*.repo.ts`, `modules/agents/repository.ts` (methods returning the `Agent` contract for review targets, `contracts/knowledge.ts:176`).
- Repository returns contracts/narrow types: `ReviewDto` mapping moves into `review.repo.ts`; `PullForReview` `{ id, repoId, number, title, author, body, base, headSha }` and `RepoRef`+id replace `PullRow` / `repos` rows; `RunOutcome` keeps only what is read (`findings.length`, `grounding`).
- `ReviewService` uses `container.reviewRepo` / `container.agentsRepo` (no own instance).
Risk: the executor path (background runs) — covered only by `reviews.it.test.ts` (Docker) and `reviewer-core/test/run.test.ts`; field renames snake/camel. Mitigation: pure mechanical mapping, no logic moves.
Baseline: −#9…#12.

### d — adapters + cross-module + skill 1.1.0
Files: `modules/_shared/{diff-parser,job-kinds}.ts`, `modules/repo-intel/{extract,types,constants}.ts`, `adapters/{astgrep,tokenizer,git/simple-git,codeindex/ripgrep,mocks}.ts`, `platform/container.ts`, tests `grounding.test.ts`, `extract.test.ts`, `astgrep.test.ts`, `repo-intel-rank-map.test.ts` (import paths), `repos/service.ts`.
- `CodeParser` port = the five functions repo-intel uses (`parseSymbols`, `parseReferences`, `parseImports`, `parseInvocationHeads`, `langForFile`) + their result types, in `repo-intel/types.ts`. `AstGrepCodeParser` implements it; `container.codeParser` + `ContainerOverrides.codeParser`.
- `MockCodeParser` is added to `adapters/mocks.ts` (onion check 10: every port has a fake). Hermetic tests of `RepoIntelService`/pipelines that need deterministic symbols use it; `astgrep.test.ts` keeps testing the real adapter directly as the adapter's contract test. No SKILL exception.
- `Tokenizer` and `DepGraph` interfaces move to `repo-intel/types.ts`; the adapters only implement them.
- Skill: R5 wording ("a port used by one module lives in that module's `types.ts`; ports shared across modules or with the client live in `vendor/shared/adapters.ts`"), Map "Ports" row, version 1.1.0, README changelog line.
Risk: native addon load path unchanged (still inside the adapter). Largest diff by file count, low logic risk.
Baseline: −#1…#8, −#18 → 1 entry left.

### e — `Pick<Container, …>` (R5)
Files: `modules/repo-intel/{service,routes}.ts`, `pipeline/{full,incremental}.ts`, `platform/container.ts`.
- `RepoIntelService(deps: Pick<Container, 'db'|'config'|'git'|'jobs'|'codeIndex'|'depgraph'|'tokenizer'|'codeParser'>)`; pipelines `Pick<Container, 'git'|'depgraph'|'tokenizer'|'codeParser'>`.
- Job handlers must be registered through the container's single `RepoIntelService` instance (today `repo-intel/routes.ts:29-30` builds a second one, and the `RepoIntel` facade, `types.ts:140-171`, has no `registerIndexJobHandlers`). **Before stage e starts: present the registration design to the user and wait for approval.**
Baseline: unchanged (the Container cycles are type-only).

## 3. After the last stage (docs commit)
- `server/docs/architecture.md`: "Architecture decisions" dated line — done; what changed. Layout/request-flow/DI tables updated (pulls/polling layered, new repos/getters, `Tx`).
- SKILL.md (patch 1.1.1): Known violations → only `repos/helpers.ts`; R2 exception text (pulls/polling now layered); "First candidate" wording in R4 and triggers table. README changelog.
- "Architecture decisions" also records the reviews → `pull_requests` ownership leak (decision 6).
- `server/specs/review-flow.md` "PR list" section: note the PR-list sync is unchanged; add `POST /repos/:id/poll` shape if the spec lists it.
- INSIGHTS per stage (engineering-insights), memory note → done.

## 4. Readiness criteria (every stage)
`server`: `pnpm typecheck`; hermetic `pnpm exec vitest run --exclude '**/*.it.test.ts'` (all green; indexer-pipeline fixed in a2e4dae); integration `pnpm exec vitest run .it.test` (Docker) incl. T suites green before AND after. `client`: `pnpm typecheck` + `pnpm test` (b adds the mirror). `pnpm deps:check`: no new violations; `pnpm deps:baseline` run and the file only loses entries (check 12). docs/specs + INSIGHTS lines in each report. **`pr-self-review --mode blocking` after every stage, 0 CRITICAL** before the next stage starts (and before the final PR from `lesson-2`).

## 5. Size and fallback

| Stage | Est. diff | If it goes wrong |
|---|---|---|
| T | +300 test lines | — (must land first) |
| a | ~+450 / −300 | Ship without the reviews-repo aggregate move (keep reads in PullsRepository as read-only exception) and do the move later. |
| b / b′ | ~+150 / −60; b′ ~+15 | b′ can be dropped without affecting b. |
| c | ~+220 / −180 | Defer entirely; baseline keeps #9–#12. |
| d | ~+300 / −200, many files | Split: pure moves + job kinds first; astgrep port + skill last (can be deferred, #5–#7 stay). |
| e | ~+60 / −30 | Defer; depends on d's `codeParser` key only for its Pick list. |

## 6. Out of scope (explicit)
`OpenRouterProvider`; durable queue; separate domain types; response schemas for other routes; reviewer-core; executor transaction; repos/agents module refactors; D-5 fs port.

## Open questions

- Windows compatibility of the e2e runner itself — separate task AFTER this
  refactor: `e2e/run.ts:40` spawns `agent-browser` with `execFile`, which
  cannot start the npm `.cmd` shim on win32, and `npm run e2e:hermetic`
  (`e2e/package.json:9`) runs the bash script through `cmd.exe`. Until then
  the workaround in `e2e/CLAUDE.md` (Git Bash + `AGENT_BROWSER_BIN`) is used
  for the per-stage `pr-self-review` gate.

## Verification (end to end)
1. T suites green on `main`-equivalent code, then after each stage.
2. `pnpm deps:check` → "no dependency violations"; baseline diff shows only removals; final baseline = 1 entry.
3. Client unchanged except the `PollResult` mirror: `pnpm typecheck && pnpm test` in `client/`.
4. Manual: `./scripts/dev.sh`, open PR list and PR detail with and without a GitHub token; values identical to before.
