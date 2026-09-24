# Insights — server

Append-only lessons about `server/` that the code cannot tell you.
A lesson that spans packages gets an entry here AND in each other package
it touches; the root `INSIGHTS.md` is for repo tooling only.

Entry format, quality gate, and capture rules live in the
`engineering-insights` skill (`.claude/skills/engineering-insights/SKILL.md`).
Entries: `- YYYY-MM-DD: <actionable statement> (evidence: path:line[, command/error])` — date and path:line are required.
Never rewrite existing entries — correct with a dated note.

## What Works

## What Doesn't Work

- 2026-09-22: `test/indexer-pipeline.test.ts` (6 tests) fails on this Windows
  box with ENOENT on temp-dir files — pre-existing environment issue, not
  caused by unrelated diffs; don't chase it unless working on repo-intel
  (evidence: `ENOENT: open 'C:\Users\...\Temp\repo-intel-full-*\src\util.ts'`
  on a clean tree).
- 2026-09-24: UPDATE to the 2026-09-22 entry — evidence lines: the temp clone
  comes from `mkdtemp(join(tmpdir(), 'repo-intel-full-'))` at
  `test/indexer-pipeline.test.ts:155` (`:267` for the incremental suite).

## Codebase Patterns

- 2026-09-24: `POST /pulls/:id/review` ALWAYS answers `reviews: []` —
  `runReview` starts `executeRuns` un-awaited and returns before any review
  exists. Consumers must wait for the SSE `done` and refetch
  `GET /pulls/:id/reviews` (tests use `waitForPrRuns`). The contract comment in
  `review-api.ts` claimed the reviews came back after a synchronous run until
  it was fixed today (evidence: `src/modules/reviews/service.ts:153-157`,
  `src/vendor/shared/contracts/review-api.ts:40-44`, `test/helpers/runs.ts:5-10`).
- 2026-09-24: `resolveRunCost()` returns the STORED cost for ANY status —
  failed/cancelled runs included; its `status !== 'done'` check only guards the
  tokens × PriceBook estimate. A "successful runs only" sum must filter
  `status === 'done'` itself, as `sumSettledRunCost` does (evidence:
  `src/modules/_shared/run-cost.ts:25`, `:28`;
  `src/modules/_shared/latest-batch.ts:71`; `test/latest-batch.test.ts:70`).

## Tool & Library Notes

- 2026-09-24: Starting the API from WSL via `/mnt/c/...` crashes at boot with
  `Error: unable to determine transport target for "pino-pretty"`
  (`pino/lib/transport.js`): the pnpm symlinks under `node_modules/.pnpm` on
  NTFS do not resolve inside pino's transport worker thread. Run
  `./scripts/dev.sh` / `pnpm dev` from Git Bash on Windows instead (evidence:
  `src/app.ts:55-58` sets `transport.target = 'pino-pretty'` in development;
  stack on 2026-09-22 ended in
  `at buildApp (/mnt/c/OSPanel/home/devDigest/server/src/app.ts:46:15)`).

## Recurring Errors & Fixes

- 2026-09-22: `pnpm db:migrate` exits 0 WITHOUT applying migrations on
  Windows — the CLI guard `import.meta.url === \`file://${process.argv[1]}\``
  in `src/db/migrate.ts:37` never matches (`file:///C:/...` vs `C:\...`).
  Fix: call the export directly:
  `pnpm exec tsx -e "import('./src/db/migrate.ts').then(m => m.runMigrations(process.env.DATABASE_URL))"`,
  then verify the columns actually exist (evidence: 0010 columns absent from
  information_schema after a "successful" `pnpm db:migrate`).

## Session Notes

- 2026-09-24: Seeded `docs/architecture.md` + `specs/review-flow.md` (every
  `path:line` verified by a line-check script); fixed the stale
  `review-api.ts` response comment (mirrored to the client copy) and the
  "seed has 2 enabled agents" comment in `test/reviews.it.test.ts:298`
  (seed creates three).

## Open Questions
