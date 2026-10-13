# server — review-flow

Last verified: 2026-09-27 against df960d2 (every `path:line` re-checked)

## Scope

What must stay true for a review run: the trigger route, background
execution, grounding/score persistence, the SSE stream, cancellation, the
read routes for reviews / runs / traces, finding actions, and the PR-list
columns that are derived from runs (score, cost, findings, status). Engine
internals (prompt shape, grounding rules, score formula) belong to the
reviewer-core package (`../reviewer-core/specs/`); UI behaviour to the client
package (`../client/specs/`); import/clone routes to `README.md` (API map).

Paths below are relative to `server/`; the engine is `../reviewer-core/`.
Inside a section, short names resolve as follows: `routes.ts`, `service.ts`,
`run-executor.ts`, `diff-loader.ts`, `helpers.ts`, `constants.ts` →
`src/modules/reviews/`; `run.repo.ts`, `review.repo.ts`, `pull.repo.ts` →
`src/modules/reviews/repository/`; `latest-batch.ts`, `run-cost.ts` →
`src/modules/_shared/`; `pulls/service.ts` → `src/modules/pulls/service.ts`;
`container.ts`, `sse.ts` → `src/platform/`; `review-api.ts`, `platform.ts`,
`trace.ts` → `src/vendor/shared/contracts/`. The two `findings.ts` files are
always written in full.

## Contract

### Trigger — `POST /pulls/:id/review`

- `:id` must be a uuid, otherwise 422 `validation_error` before the handler
  runs (evidence: `src/modules/reviews/routes.ts:29`,
  `src/modules/_shared/schemas.ts:11`, handler `src/app.ts:118-127`).
- Body is `RunRequest { agentId?, all? }`, parsed by hand so an empty body is
  accepted (`src/modules/reviews/routes.ts:32`,
  `src/vendor/shared/contracts/platform.ts:294-297`).
- `all: true` targets every agent with `enabled = true` in the workspace;
  `agentId` targets that agent or 404 `not_found`; neither → 400
  `invalid_run_request` (`resolveTargets`, `src/modules/reviews/service.ts:51-62`,
  `src/modules/agents/repository.ts:57-62`).
- PR and its repo must exist in the workspace, else 404
  (`src/modules/reviews/service.ts:129-132`).
- One `agent_runs` row per target is inserted **before** responding with
  `status = 'running'`, `source = 'local'`, and one `batchId` shared by all
  runs of this call (`src/modules/reviews/service.ts:141-153`,
  `src/modules/reviews/repository/run.repo.ts:119-145`; test
  `test/reviews.it.test.ts:297-314`).
- Response is `ReviewRunResponse { pr_id, runs: [{ run_id, agent_id,
  agent_name }], reviews }` and `reviews` is always `[]`: execution is
  fire-and-forget (`void this.executor.executeRuns(...)`) and the client
  refetches after the SSE stream ends
  (`src/modules/reviews/service.ts:157-161`,
  `src/vendor/shared/contracts/review-api.ts:53-57`; test
  `test/reviews.it.test.ts:176-191`).
- Per-route `rateLimit` 10/min; the global 120/min applies outside
  `NODE_ENV=test` (`src/modules/reviews/routes.ts:29`, `src/app.ts:95-97`).

### Execution — `ReviewRunExecutor` (`src/modules/reviews/run-executor.ts`)

- The diff is loaded once per batch: `git diff base..head_sha` through
  `container.git`; when that throws or yields zero files, a unified diff is
  rebuilt from `pr_files.patch` (`src/modules/reviews/diff-loader.ts:12-44`; test
  `test/reviews-row-fields.it.test.ts` "falls back to the persisted pr_files").
  A diff-load failure marks **every** queued run `failed` with the error,
  persists a trace built from the event buffer and completes the bus
  (`run-executor.ts:85-115`).
- Agents run sequentially (`runOneAgent` per job); a failure or cancel in one
  does not abort the others (`run-executor.ts:118-145`).
- The provider comes from `container.llm(agent.provider)`; a missing key is a
  `ConfigError` and the run is persisted as `failed` with that message
  (`run-executor.ts:169-173`, `buildLlm` in `src/platform/container.ts:233-253`).
- Repo-intel enrichment runs only when `agent.repo_intel !== false`: callers
  digest (≤10 signatures), cached repo map, and a rank note when any changed
  file is in the top 5 % by rank. Each is best-effort: on error or a degraded
  facade the section is omitted and the run continues
  (`run-executor.ts:179-193`, `376-450`; facade gate `getRepoMap` in
  `src/modules/repo-intel/service.ts:404-421`).
- Skills (L02): before the engine call the executor asks
  `container.skillsRepo.enabledForAgent(agent.id)` for the agent's effective
  skills (`agent_skills.enabled AND skills.enabled`, in `agent_skills.order`),
  passes them as `ReviewSkill { name, body, source, version }`, logs exactly
  one line per injected skill (`Skill "<name>" v<N> (<source>) · ≈ <T> tok`;
  nothing at all when the agent has none, so such a run's log is unchanged)
  and counts tokens per
  rendered block (`renderSkillBlock` from reviewer-core, `container.tokenizer`
  = cl100k, approximate). A skill disabled by either flag appears in neither
  the prompt, the trace nor the log (`run-executor.ts:196-199`, `:358-375`).
- The task line always names the PR and tells the model to review the entire
  diff and never withhold a security/correctness finding
  (`taskLine`, `src/modules/reviews/helpers.ts:41-51`; test
  `test/reviews-helpers.test.ts:19-23`).
- The engine is called with `strategy = agent.strategy ?? 'single-pass'`,
  `prDescription` only when the PR has a body, `sessionId =
  "<owner>/<repo>#<number>:<agent name>"`, `onEvent` bound to the run logger and
  `checkCancelled` throwing `RunCancelledError`
  (`run-executor.ts:205-229`, `src/modules/reviews/constants.ts:12`; test
  `test/reviews-row-fields.it.test.ts` for map-reduce, `repo_intel: false`,
  `ci_fail_on: never`, `sessionId` and `last_reviewed_sha`).
- Persisted findings are exactly the engine's grounded set and the persisted
  score is `scoreFromFindings(kept)`, never the model's self-reported score
  (`run-executor.ts:232-246`; `../reviewer-core/src/review/run.ts:196-208`,
  `../reviewer-core/src/review/reduce.ts:13-30`; test
  `test/reviews.it.test.ts:193-215` expects score 65, 1 finding, `1/2 passed`).
- One `reviews` row (`kind = 'review'`, `runId`, `agentId`, `model =
  agent.model`) and its `findings` rows are inserted, then
  `pull_requests.last_reviewed_sha = head_sha` (`markReviewed`)
  (`run-executor.ts:235-251`, `src/modules/reviews/repository/review.repo.ts:53-94`,
  `src/modules/reviews/repository/pull.repo.ts:50-55`).
- On success `agent_runs` is updated with `status = 'done'`, `duration_ms`,
  `tokens_in` / `tokens_out`, `cost_usd` as returned by the engine (null when unknown),
  `findings_count`, `grounding`, `score`, `blockers = countBlockers(kept,
  agent.ci_fail_on)`, `error = null` (`run-executor.ts:257-274`,
  `../reviewer-core/src/output/to-review.ts:48`).
- One `RunTrace` document is upserted into `run_traces` (PK = run id) with
  `stats.cost_usd`, `prompt_assembly` (plus `skill_blocks`
  `[{skill_id, name, version, source, tokens}]` when at least one skill was
  injected; absent otherwise and in pre-L02 traces), one `tool_calls` entry per engine chunk,
  `raw_output`, and `log` = the run's **full** event buffer including the shared
  diff-load lines; the bus is completed only after the trace is saved
  (`run-executor.ts:276-312`, `run.repo.ts:200-205`).
- On failure or cancel the row gets `status = 'failed' | 'cancelled'`, `error`
  (`'Cancelled by user'` for cancels), zero tokens, `cost_usd = null`,
  `grounding = '0/0 passed'`; a trace built from the buffer is still saved and
  the bus completed (`run-executor.ts:315-339`, `457-481`).

### Live events — `GET /runs/:id/events`

- SSE, exempt from rate limiting (`src/modules/reviews/routes.ts:48-51`).
- Buffered events are replayed first, then live ones; the stream ends when the
  bus fires `done`. A subscriber arriving after completion gets the replay and
  an immediate end (`routes.ts:55-91`; `subscribe` replays the buffer
  `src/platform/sse.ts:63-68`; `onDone` fires at once for a completed run
  `90-100`; test `test/reviews.it.test.ts:271-295`).
- Frame: `id = seq`, `event = kind`, `data = JSON RunEvent { runId, seq, kind,
  msg, t, data? }`; `kind ∈ info | tool | result | error`
  (`routes.ts:80-84`, `src/vendor/shared/contracts/trace.ts:9-28`).
- Pre-work events (diff load) are published to every run of the batch
  (`run-executor.ts:75-80`; `RunLogger.event` loops over `runIds`,
  `src/platform/run-logger.ts:50-53`).

### Cancel — `POST /runs/:id/cancel`

- Publishes an `info` event, sets the bus cancel flag, sets `agent_runs.status
  = 'cancelled'` only if it is still `running`, and completes the bus; returns
  `{ ok: true }` even for unknown or finished runs
  (`cancelRun`, `src/modules/reviews/service.ts:105-110`; `run.repo.ts:96-103`).
- A live runner observes the flag at the engine checkpoint before each chunk
  LLM call and throws `RunCancelledError` (`run-executor.ts:226-228`,
  `../reviewer-core/src/review/run.ts:164`).
- Boot reaping: `buildApp()` sets every `running` run to `failed` (no error
  text) before registering plugins (`src/app.ts:80-85`, `run.repo.ts:107-114`).

### Reads

- `GET /pulls/:id/reviews` → `ReviewRecord[]`, newest first, each with its
  findings and `agent_name` resolved from the agents table; 404 when the PR is
  not in the workspace. `grounding` is not populated by this route
  (`reviewsForPull`, `service.ts:184-199`; row → DTO mapping `toReviewDto` /
  `toFindingDto` in `review.repo.ts:12-49`, `97-112`; `review-api.ts:23-38`;
  golden test `test/reviews-golden.it.test.ts`).
- `GET /pulls/:id/runs` → `RunSummary[]`, newest first, every status. `cost_usd`
  = stored `agent_runs.cost_usd` (a stored 0 counts) else, for `done` runs with
  a model and tokens, `PriceBook.estimate(model, tokens_in, tokens_out)`; else
  null (`listRuns`, `service.ts:75-92`; `run.repo.ts:42-71`,
  `src/modules/_shared/run-cost.ts:21-30`,
  `src/vendor/shared/contracts/trace.ts:97-119`; tests `test/run-cost.test.ts`,
  `test/reviews.it.test.ts:316`).
- `GET /pulls/:id/runs/active` → only `status = 'running'` rows
  (`run.repo.ts:12-39`).
- `GET /runs/:id/trace` → the stored `RunTrace` or 404 `not_found`. When the
  document predates `stats.cost_usd`, the value is filled on read from the
  `agent_runs` row with the same rule as above and never written back
  (`routes.ts:121-126`; `getRunTrace`, `service.ts:201-214`; test
  `test/reviews.it.test.ts:372-381`).
- `DELETE /runs/:id` deletes the review rows with that `run_id` (findings
  cascade), then the run (trace cascades); returns `{ ok }` where `ok` is
  false for an unknown run — no 404 (`routes.ts:107-111`; `deleteAgentRun`,
  `run.repo.ts:80-93`).
- `DELETE /reviews/:id` deletes one review (+ findings) scoped to the
  workspace; 404 when absent (`routes.ts:135-140`; `deleteReview`,
  `review.repo.ts:116-126`).

### Finding actions — `POST /findings/:id/accept` · `/dismiss`

- Only `accept` and `dismiss` are routed; `learn` and `reply` exist in
  `FindingActionKind` but have no route (`routes.ts:18`, `143-149`,
  `src/vendor/shared/contracts/findings.ts:82`).
- The finding must resolve (finding → review → PR) to the caller's workspace,
  else 404 (`findingWorkspace` check, `src/modules/reviews/findings.ts:26-29`;
  test `test/reviews-row-fields.it.test.ts` "finding actions").
- `accept` sets `accepted_at = now()` and clears `dismissed_at`; `dismiss` is
  the mirror. Response `{ finding: FindingRecord }`
  (`setFindingAccepted` / `setFindingDismissed`, `review.repo.ts:153-177`;
  test `test/reviews.it.test.ts:240`).

### PR list — `GET /repos/:id/pulls` (`PrMeta[]`)

Evidence for the whole section: the `score` / `cost_usd` / `latest_batch`
aggregation in `src/modules/pulls/service.ts:99-148` (rows from the reviews
module's `ReviewRepository` via `container.reviewRepo`: `review.repo.ts`
`reviewScoresNewestFirst` / `findingSeveritiesForRuns`, `run.repo.ts`
`batchRunsForPulls`),
`src/modules/_shared/latest-batch.ts`, and the `PrMeta` contract
`src/vendor/shared/contracts/platform.ts:158-199`.

- `score` = `score` of the newest `reviews` row with `kind = 'review'` for the
  PR, else null (`pulls/service.ts:102-105`, `138`).
- **`cost_usd` (COST column)** = the sum over **every** `agent_runs` row of the
  PR with `status = 'done'`, in any batch, of `resolveRunCost(run)` (stored
  cost first, incl. 0; else tokens × PriceBook; unresolvable runs are skipped).
  `running`, `failed` and `cancelled` runs never count, even with a stored
  cost. Null when no settled run resolved to a cost — never a fabricated 0
  (`pulls/service.ts:107-110`, `139`; `latest-batch.ts:65-77`;
  `run-cost.ts:21-30`; tests `test/latest-batch.test.ts:57-113`,
  `test/reviews.it.test.ts:316` expects 0.002 after two batches and 0.0012
  once both stored costs are nulled).
- **`latest_batch` (FINDINGS column)**: rows are read newest-first by
  `ran_at`; the first row per PR fixes the batch. With a `batch_id`, every run
  sharing it belongs (running ones included); a legacy row with `batch_id =
  null` forms a batch of one. `run_ids` is newest-first
  (`latest-batch.ts:34-55`; tests `test/latest-batch.test.ts:23-55`).
- `latest_batch.findings_by_severity` = plain COUNT of `findings.severity`
  over the reviews whose `run_id ∈ run_ids` and `kind = 'review'`; all-zero
  when the batch has no findings yet; severities outside
  `CRITICAL | WARNING | SUGGESTION` are ignored (`pulls/service.ts:111-113`,
  `140-145`; `countFindingsBySeverity`, `latest-batch.ts:89-102`; tests
  `test/latest-batch.test.ts:115-133`, `test/reviews.it.test.ts:386`).
- `latest_batch` is null for a PR that never had a run — including the seeded
  PR #482, whose sample review is inserted into `t.reviews` with no run
  (`pulls/service.ts:140-145`, `src/db/seed.ts:136-149`; test
  `test/reviews.it.test.ts:398-399`).
- `opened_at` comes from GitHub on first import — through the PR list AND
  through `POST /repos/:id/poll` — and a stored null is filled on any later
  sync; a known date is never overwritten (`coalesce` in
  `src/modules/pulls/repository.ts:113`; tests
  `test/pulls-sync.it.test.ts` "fills a stored null opened_at…",
  `test/polling.it.test.ts` "fills a stored null opened_at on poll…").
- `status`: `merged` / `closed` pass through from GitHub; otherwise
  `needs_review` when `last_reviewed_sha` is null or differs from `head_sha`,
  `stale` when the current head was reviewed but `updated_at` is older than 7
  days, else `reviewed` (`src/modules/pulls/status.ts:40-55`; test
  `test/pulls-status.test.ts`).

### Persistence shapes

- `agent_runs`: `status` ∈ `running | done | failed | cancelled`, `batch_id`
  nullable (legacy), `cost_usd` double nullable, `score`, `blockers`, `error`
  (`src/db/schema/runs.ts:8-35`). `agent_id` / `pr_id` are `set null` on
  delete, so rows can outlive their PR (`latest-batch.ts:38`, `71` skip them).
- `run_traces.run_id` is the PK and cascades from `agent_runs`
  (`src/db/schema/runs.ts:38-43`).
- `reviews.run_id` has **no** FK to `agent_runs`; that is why `DELETE /runs/:id`
  removes the review explicitly (`src/db/schema/reviews.ts:19`,
  `run.repo.ts:73-87`). `findings` cascade from `reviews`
  (`src/db/schema/reviews.ts:28-32`).

## States & edge cases

- **Empty or field-less body** on the trigger → 400 `invalid_run_request`
  (`service.ts:61`).
- **Invalid uuid** on any `/:id` route → 422 envelope `{ error: { code:
  'validation_error', … } }` (`src/app.ts:118-127`; test
  `test/routes-smoke.test.ts:56-66` for the envelope shape).
- **No provider key** → run row `failed`, `error = '<KEY> is not configured'`,
  trace saved, SSE ends (`ConfigError` throws in `container.ts:236`, `244`,
  `251`).
- **Server restart mid-run** → the row becomes `failed` at next boot; cancel
  still works on it because it updates the DB directly (`src/app.ts:80-85`;
  `cancelRun`, `service.ts:105-110`).
- **Late SSE subscriber** → replay + immediate end; `complete` keeps the buffer
  and drops only the emitter (`sse.ts:81-82`); `onDone` fires immediately for
  a completed run (`93-96`).
- **Legacy data**: runs without `batch_id` (batch of one), runs without
  `cost_usd` (estimated on read when `done` with tokens), traces without
  `stats.cost_usd` (backfilled on read), reviews without a run (seed) — all
  handled without migration (`latest-batch.ts:45-51`, `run-cost.ts:25-29`,
  `service.ts:204-213`).
- **Seed**: three enabled agents on `DEFAULT_PROVIDER = 'openrouter'` /
  `DEFAULT_MODEL = 'deepseek/deepseek-v4-flash'`, so `all: true` on a fresh
  database queues three runs (`src/db/seed.ts:13-14`, `181-215`).

## Enforced by

| Rule | Test |
|---|---|
| Grounding drops off-diff findings; score recomputed (65); trace + run row written | `test/reviews.it.test.ts:164` |
| Effective skills in `prompt_assembly.skills` in order, `skill_blocks` with tokens > 0, one log line each; a skill disabled by either flag absent from prompt, trace, log and LLM request; a trace without `skill_blocks` parses | `test/skills-in-run.it.test.ts` |
| Same Review shape from the anthropic provider | `test/reviews.it.test.ts:220` |
| accept / dismiss toggle the timestamps | `test/reviews.it.test.ts:240` |
| SSE replays the buffer and completes | `test/reviews.it.test.ts:271` |
| `all: true` runs every enabled agent; one `batch_id` per call | `test/reviews.it.test.ts:297` |
| Cost persisted; runs/trace/PR-list surfaces; sum over settled runs; legacy estimate | `test/reviews.it.test.ts:316` |
| `latest_batch` run_ids + per-severity counts; null before the first run | `test/reviews.it.test.ts:386` |
| Latest-batch grouping incl. legacy and set-null rows | `test/latest-batch.test.ts:23-55` |
| COST sums only `done` runs, any batch, never fabricates 0 | `test/latest-batch.test.ts:57-113` |
| Severity counts ignore unknown severities | `test/latest-batch.test.ts:115-133` |
| `resolveRunCost` precedence (stored → estimate → null) | `test/run-cost.test.ts` |
| Review status derivation (`needs_review` / `stale` / `reviewed`) | `test/pulls-status.test.ts` |
| Task line keeps the never-withhold rule | `test/reviews-helpers.test.ts` |
| Grounding gate rules (kept/dropped, summary string) | `test/grounding.test.ts` |
| Validation envelope is 422 `validation_error` | `test/routes-smoke.test.ts:56-66` |
| Background runs reach a `TERMINAL` status the tests wait on (`waitForPrRuns`) | `test/helpers/runs.ts:12-34` |
