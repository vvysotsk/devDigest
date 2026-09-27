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

- 2026-09-27: A two-step import ("preview returns the parsed text, the client
  POSTs it back to the normal create route") makes every server-side trust
  rule client-enforced: the client can send any body and claim any `source`,
  so the first-enable acknowledgement for imported skills could be skipped by
  posting the text as `manual`. Save imports on their own route that
  re-parses the uploaded FILE and sets `source` / `enabled` /
  `acknowledged_at` itself; the manual create accepts `source: 'manual'` only
  (evidence: `src/vendor/shared/contracts/knowledge.ts:170`, `:247`;
  reviewer correction during L02 Stage 1 review).

- 2026-09-27: Updating `specs/review-flow.md` only for the sections a change
  "touches" lets its `path:line` evidence rot: after the onion stages a–e,
  63 of ~135 references were off by 1–10 lines (new imports / types at the
  top of `run-executor.ts`, `reviews/service.ts`, `container.ts`, new tests
  in `test/reviews.it.test.ts`), though no claim was wrong. Any edit that
  adds or removes lines above cited code shifts every later reference: after
  such an edit, re-check all references into that file (a read-only agent
  pass took ~2.5 min) and bump the "Last verified" line
  (evidence: `specs/review-flow.md:3`).
- 2026-09-27: An it-test that calls a route touching GitHub without
  `overrides.github` is machine-dependent: `container.github()` then reads a
  real token from `~/.devdigest/secrets.json` / `GITHUB_TOKEN` and calls the
  real API for the test's fake `acme/*` repos (the route swallows the error,
  so it passes by accident). Always inject `MockGitHubClient`, or force the
  offline path with `overrides.secrets: new MockSecretsProvider({})`
  (evidence: `test/reviews.it.test.ts:113-126` builds apps without a github
  override; `src/platform/container.ts:153-160`; the pattern to copy is
  `test/pulls-sync.it.test.ts` `appWith`).
  - 2026-09-27 update: a real `OPENROUTER_API_KEY` has the same effect on
    `container.priceBook` (live prices instead of the static table), and the
    L01 run-cost test in `reviews.it` failed once under full-suite load
    (4 later full runs green). Fixed in 2712a6e: `reviews.it` `appWith` now
    passes `secrets: new MockSecretsProvider({})`
    (evidence: `test/reviews.it.test.ts:117-121`).

## Codebase Patterns

- 2026-09-27: A port shared by two modules cannot live in `src/vendor/shared`
  while contracts are frozen, and the consumer may not import it from the
  owning module. Declare it in the owner's `types.ts` (types the container
  getter) and let each consumer declare its own narrow structural interface;
  the container wires one instance into both (evidence:
  `src/modules/skills/types.ts:69` `SkillsPort`, `src/modules/agents/types.ts:9`
  `AgentSkillLinks`, `src/platform/container.ts:109-128`).
- 2026-09-27: A cross-module write that must share a transaction goes through
  the owning module's repository method taking `DbOrTx`; the calling service
  opens `deps.db.transaction` and passes `tx`. Do not import `db/client` in the
  service even as a type — dependency-cruiser flags it as
  `no-drizzle-outside-persistence` (evidence: `src/modules/skills/service.ts:143`,
  `src/modules/agents/repository.ts:170`, `:184`).

- 2026-09-27: `Pick<Container, 'llm' | 'github' | 'embedder' | …>` picks
  METHODS that read `this` (`this.overrides`, `this.secrets`,
  `src/platform/container.ts:195-196`). Pass the container itself as `deps`
  and call `this.deps.llm(id)` (`src/modules/reviews/run-executor.ts:163`);
  never destructure (`const { llm } = deps`) or pass `deps.llm` as a
  callback — the call then runs with `this` undefined and throws. Getters
  (`git`, `repoIntel`, `jobs`) are safe either way.
- 2026-09-27: A service that needs another module's repository types it as
  `Container['reposRepo']` / `Container['reviewRepo']`, never with
  `import type { RepoRepository } from '../repos/repository.js'`: the
  advisory `no-cross-module` rule runs with `tsPreCompilationDeps: true`, so a
  type-only import of another module's folder is a new violation too. The
  instance comes from the container in the route (evidence:
  `src/modules/pulls/service.ts:27`, `:29`; `src/modules/pulls/routes.ts:26`;
  `.dependency-cruiser.cjs` `options.tsPreCompilationDeps`).

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
- 2026-09-27: An offline (never cloned) repo is still reviewable: with
  `repos.clone_path = null`, `git.diff` throws and `loadDiff` falls back to
  `diffFromPrFiles`, which silently SKIPS every `pr_files` row without a
  `patch`. Seeded PR #482 has no patches, so a review on it gets an empty
  diff. Seed PRs meant for real runs must carry `patch` text (GitHub patch
  format starting at `@@`); repo-intel then degrades to empty callers / repo map
  instead of failing (evidence: `src/modules/reviews/diff-loader.ts:19-29`,
  `:37`; `src/db/seed.ts:121-126`; `src/modules/repo-intel/service.ts:467-468`).

## Tool & Library Notes

- 2026-09-27: fflate `unzipSync` inflates each entry into
  `new Uint8Array(declaredSize)` and never checks CRC-32: a header that
  under-declares the size is silently truncated (memory stays capped, content
  is corrupted). Compare the inflated length AND CRC-32 with the central
  directory (evidence: `src/modules/skills/import/zip.ts:199-200`;
  `node_modules/fflate/esm/index.mjs:2704`; `test/skill-import.test.ts`).
- 2026-09-27: fflate `unzipSync` keys its result by entry name (duplicates
  collapse into one) and exposes neither external attributes nor the host OS,
  so symlink / duplicate detection needs an own central-directory read. Decode
  names with fflate's `strFromU8(bytes, !(flags & 0x800))` so they match its
  keys (evidence: `src/modules/skills/import/zip.ts:131`, `:169`).
- 2026-09-27: fflate follows a ZIP64 locator whenever one is present, even if
  the classic EOCD fields are not maxed out — a pre-check that reads only the
  classic EOCD would see a different entry list than fflate. Reject (or
  parse) ZIP64 before inflating (evidence: `src/modules/skills/import/zip.ts:91-98`;
  `node_modules/fflate/esm/index.mjs:2682-2690`).

- 2026-09-27: With the zod type provider a 204 route declared as
  `response: { 204: z.null() }` must reply `reply.status(204).send(null)`;
  `send()` without an argument fails typecheck (TS2554). Fastify sends no body
  for 204 either way (evidence: `src/modules/skills/routes.ts:66-72`).

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

- 2026-09-27: A snapshot of `GET /runs/:id/trace` is not stable after
  normalizing ids and ISO timestamps: log entries carry a wall-clock number
  `t`, stage durations sit in `ms` / `duration_ms`, and messages embed
  `(Nms)` ("Loading PR diff done (0ms)"). Normalize all three, as
  `test/reviews-golden.it.test.ts:75-95` does, or the snapshot flakes on
  timing only.
- 2026-09-27: `MockGitClient.diff()` ignores its arguments and records no
  calls (`src/adapters/mocks.ts:281`), so no test can assert which
  `base` / `head_sha` the review diff was requested for; only typecheck
  guards that wiring. Add call recording to the mock before relying on it.

- 2026-09-27: `src/adapters/depgraph/index.ts:82` and
  `src/modules/repo-intel/pipeline/repo-map.ts:64` contain a literal NUL byte
  inside a template-literal dedup key (`${from}\0${to}`). git and grep treat
  both files as binary: `git diff` prints `Bin 4246 -> 4082 bytes` (no hunks,
  so diff-based review sees nothing), `grep` prints "Binary file matches".
  Use `grep -a` / `git diff --text`, and edit them byte-wise (Python `rb`) or
  with the Edit tool — never round-trip them through a text tool that drops
  the byte (changing the key changes dedup behaviour).
  - 2026-09-27 correction: the literal byte is now the `\u0000` escape (same
    string at runtime), so both files are plain text for git and grep again.
    Keep the separator as the escape, never a raw control character (evidence:
    `src/adapters/depgraph/index.ts:82`,
    `src/modules/repo-intel/pipeline/repo-map.ts:64`).

## Recurring Errors & Fixes

- 2026-09-27: `pnpm typecheck` checks only `src/` (`tsconfig.json:28`
  `"include": ["src/**/*.ts"]`) and vitest does not typecheck, so a change to
  a reviewer-core or contract API can leave `test/*.ts` calling the old shape
  with a green typecheck: L02 Stage 4a (`ReviewSkill[]` instead of `string[]`)
  broke `test/prompt-structured.test.ts:17` and only the unit run caught it.
  After an API change in reviewer-core or `src/vendor/shared`, run the server
  unit tests too, not just the typecheck.

- 2026-09-27: In a fresh checkout or git worktree, `pnpm typecheck` fails
  with `Cannot find module 'openai'` / `'zod'` inside
  `../reviewer-core/src/llm/*.ts` until `cd reviewer-core && npm ci`: the
  `@devdigest/reviewer-core` path alias compiles reviewer-core's SOURCES,
  which resolve their imports from reviewer-core's own `node_modules`
  (evidence: `tsconfig.json:24-25`; `../reviewer-core/src/llm/structured.ts:1`;
  hit by three L02 Wave-2 tracks).

- 2026-09-27: repo-intel tests build a partial `Container` with
  `as unknown as Container` (`test/indexer-pipeline.test.ts:140`,
  `test/repo-intel-resync.test.ts:50`, `test/repo-intel-phantom.test.ts:36`),
  so typecheck does not notice a container member the code newly reads — the
  test fails at runtime with "Cannot read properties of undefined". When the
  service or a pipeline starts using a new port (`codeParser` in stage d),
  add it to every such fake: the real adapter where the test pins real
  parsing, `MockCodeParser` where it pins service logic.
- 2026-09-26: Path splitting on `'/'` breaks on Windows: `join()` yields
  backslashes, so `full.lastIndexOf('/')` is -1. It made the 6
  `test/indexer-pipeline.test.ts` tests fail with ENOENT (no `mkdir` for
  `src\`) — wrongly logged on 2026-09-22 as an environment issue — and only
  worked by accident in `test/indexer-walk.test.ts`. Use `dirname()` from
  `node:path` (evidence: `test/indexer-pipeline.test.ts:140-145`,
  `test/indexer-walk.test.ts:18-23`).
- 2026-09-22: `pnpm db:migrate` exits 0 WITHOUT applying migrations on
  Windows — the CLI guard `import.meta.url === \`file://${process.argv[1]}\``
  in `src/db/migrate.ts:37` never matches (`file:///C:/...` vs `C:\...`).
  Fix: call the export directly:
  `pnpm exec tsx -e "import('./src/db/migrate.ts').then(m => m.runMigrations(process.env.DATABASE_URL))"`,
  then verify the columns actually exist (evidence: 0010 columns absent from
  information_schema after a "successful" `pnpm db:migrate`).
  - 2026-09-27 correction: fixed in 653defa — `migrate.ts` and `seed.ts` use
    `isEntryPoint()` (`src/db/cli.ts`, `pathToFileURL(resolve(argv1)).href`);
    the `tsx -e` workaround is no longer needed. `./scripts/dev.sh --db-only`
    in Git Bash now prints `✓ migrations applied` and `✓ seeded`;
    `test/db-cli-entry.test.ts` guards the CLI branch (evidence:
    `src/db/migrate.ts:38`, `src/db/seed.ts:228`).
  - 2026-09-27 note: on an already-migrated DB `pnpm db:migrate` prints three
    Postgres NOTICE objects (`42710` vector exists, `42P06` schema drizzle
    exists, `42P07` `__drizzle_migrations` exists, `file: 'parse_utilcmd.c'`)
    before `✓ migrations applied` — they come from the `IF NOT EXISTS`
    statements (`src/db/migrate.ts:24,31`) and are not failures; judge success
    by `select count(*) from drizzle.__drizzle_migrations` = number of journal
    entries (12 after `0011_white_sumo`).

- 2026-09-27: `waitForPrRuns` does not make `GET /runs/:id/trace` safe: the
  executor writes `agent_runs.status = done` (`completeAgentRun`) before
  `saveRunTrace` (`src/modules/reviews/run-executor.ts:243`, `:289`), so a
  trace read right after the wait intermittently 404s ("Cannot read properties
  of undefined (reading map)" on `trace.tool_calls`, about 1 run in 4 under
  the full .it suite; it predates the onion refactor and also hit
  `test/reviews.it.test.ts:344` L01 on the old code). Also wait with `waitForRunTrace`
  (`test/helpers/runs.ts`) before reading a trace.

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
- 2026-09-27: Onion stage c: the reviews service/executor no longer see
  Drizzle rows (agents arrive as the `Agent` contract from
  `container.agentsRepo`, PRs/repos as narrow types in
  `src/modules/reviews/types.ts`); golden responses pinned before the change
  (`test/reviews-golden.it.test.ts`) match unchanged; non-default agent fields
  covered by `test/reviews-row-fields.it.test.ts`.
- 2026-09-27: Onion stage d: `parseUnifiedDiff`, the regex extractor and the
  job kinds moved inward (`src/modules/_shared/{diff-parser,job-kinds}.ts`,
  `src/modules/repo-intel/extract.ts`); repo-intel reaches ast-grep only via
  the `CodeParser` port (`src/modules/repo-intel/types.ts`,
  `container.codeParser`, fake `MockCodeParser` in `src/adapters/mocks.ts`,
  service rule pinned by `test/repo-intel-phantom.test.ts`);
  dependency-cruiser baseline 10 → 1 (`src/modules/repos/helpers.ts`).
- 2026-09-27: Onion stage e: one `RepoIntelService` per container
  (`container.repoIntelService`, `src/platform/container.ts`); the repo-intel
  plugin registers job handlers on it, `repoIntel` = override ?? it.
  `RepoIntelService`, the pipelines and `ReviewService` (+ executor,
  `loadDiff`) take `Pick<Container, …>`; `test/repo-intel-registration.test.ts`
  pins the single instance and the three job kinds via `JobRunner.hasHandler`.

## Open Questions
