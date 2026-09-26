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
- 2026-09-26: `polling` is not a read-only "thin" module: its route inserts
  into `pull_requests` and updates `repos` — tables owned by `pulls` and
  `repos` — as two separate statements with no transaction. Do not treat it
  as covered by the thin-module exception; new write paths go through a
  service (evidence: `src/modules/polling/routes.ts:33`, `:61`;
  `docs/architecture.md` "Architecture decisions").
- 2026-09-26: No route declares `schema.response` (0 of 37), so the zod
  `serializerCompiler` installed in `app.ts` never runs and responses go out
  via plain `JSON.stringify` — nothing strips fields a service adds. The docs
  claimed "serializes every response" until today. When you add a response
  schema, add a shape test (`Contract.strict().parse(res.json())`): the
  serializer (`fastify-type-provider-zod` 4.0.2) drops unknown keys and turns a
  mismatch into a 500 (evidence: `src/app.ts:64-65`;
  `node_modules/fastify-type-provider-zod/dist/src/core.js:85-92`;
  grep `response:` over `src/modules/**/routes.ts` → 0).

## Tool & Library Notes

- 2026-09-26: To ignore type-only cycles in dependency-cruiser, put the
  filter in `to.viaOnly.dependencyTypesNot: ['type-only']`, not in
  `to.dependencyTypesNot`: the top-level one checks only the single edge a
  cycle is reported from, so `platform/container.ts` → `repo-intel/service.ts`
  (a runtime import) kept reporting a cycle that is closed by
  `import type { Container }`. All five cycles in the first run were
  type-only (evidence: `.dependency-cruiser.cjs` rule `no-circular`;
  `node_modules/dependency-cruiser/src/validate/matchers.mjs:186-191`;
  `src/modules/repo-intel/service.ts:21`, `src/modules/agents/helpers.ts:3`).
- 2026-09-26: dependency-cruiser 17.4.3 rejects `enhancedResolveOptions.extensionAlias`
  ("must NOT have additional properties"); it is not needed — with
  `tsConfig` set, `.js` specifiers resolve to `.ts` files (466 of 466
  dependencies resolved). Keep `tsPreCompilationDeps: true`, otherwise
  `import type` row leaks are invisible (evidence: `.dependency-cruiser.cjs`
  options; first `pnpm deps:check` run).

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
- 2026-09-26: Added the `onion-architecture` skill and the advisory
  `pnpm deps:check` (`.dependency-cruiser.cjs`, `--ignore-known` against
  `.dependency-cruiser-known-violations.json`, 18 known violations);
  `docs/architecture.md` gained "Architecture decisions" (pulls/polling
  deferred, pulls sync without a transaction at
  `src/modules/pulls/routes.ts:251-285`) and a corrected serialization
  description.

## Open Questions
