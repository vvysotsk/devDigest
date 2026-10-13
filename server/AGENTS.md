# server/ — Fastify API (@devdigest/api)

## Commands

- `pnpm dev` · `pnpm typecheck` · `pnpm db:migrate` · `pnpm db:generate` · `pnpm db:seed`
- `pnpm skill:pack <dir> <out.zip>` — zip a skill folder (e.g.
  `test/fixtures/skills/api-deprecation-policy`) for a manual import.
- `pnpm deps:check` — advisory layer check (dependency-cruiser, never fails);
  shows only violations missing from `.dependency-cruiser-known-violations.json`.
  `pnpm deps:baseline` rewrites that file — only after fixing a known one.
- Unit tests (hermetic): `pnpm exec vitest run --exclude '**/*.it.test.ts'`
- Integration (Docker): `DEVDIGEST_REQUIRE_DOCKER=1 pnpm exec vitest run .it.test`
  — the flag makes a missing Docker daemon FAIL the files instead of skipping
  them; without it they self-skip and report green.

## Before answering

Always search this package's `docs/`, `specs/` and `INSIGHTS.md` for what the
user asks about first — these are curated and may already answer it — then
read code.

## Module shape — every module follows it

`modules/<name>/routes.ts` (Fastify plugin, zod schemas) → `service.ts` →
`repository.ts` (Drizzle). Registered statically in `modules/index.ts`.
Cross-module access ONLY through the DI container (`container.agentsRepo`,
`container.repoIntel`…) — never import another module's folder.

## Non-default conventions

- zod type-provider validates every request schema; it serializes a response
  ONLY when the route declares `schema.response` (so far the `pulls`,
  `polling`, `skills` and `conventions` routes do — plain `JSON.stringify` otherwise). New and changed routes declare one
  plus a response-shape test (`onion-architecture` skill, R3). Errors use the
  envelope `{ error: { code, message, details } }`.
- Tests swap dependencies via ContainerOverrides; services never construct
  their own I/O (that is what `adapters/` are for).
- `*.it.test.ts` = DB-backed (testcontainers); all other tests must stay hermetic.
- ZodError is matched by shape, not instanceof — duplicate zod instances.
- All env config goes through `src/platform/config.ts` (single zod schema).

## Do not touch

- `src/db/migrations/**` (incl. `meta/_journal.json` and snapshots) — never
  edit, rename, reorder or delete an applied migration. Schema change = edit
  `src/db/schema/*` → `pnpm db:generate` → `pnpm db:migrate`.
- `pnpm-lock.yaml` — never edit by hand or regenerate unprompted; it changes
  only with an intentional `package.json` change, committed together.
- `src/vendor/shared` — master copy of `@devdigest/shared`; mirror every edit
  to `client/src/vendor/shared`. WARNING: the copies ALREADY differ in 3 files
  (`adapters.ts`, `contracts/eval-ci.ts`, `contracts/productionize.ts` — e.g.
  LLMProvider knows `openrouter`/`sessionId` only server-side;
  `contracts/knowledge.ts` and `contracts/trace.ts` are identical since L02
  Stage 1 — keep them so). Diff before assuming sync;
  mirror only the parts your change touches, don't blind-copy whole files.
- Stale-run reaping order in reviews (awaited before listeners) and SSE
  cancellation checkpoints — the await order prevents races; comments in
  place explain each one.
- The review score is recomputed from findings that survived grounding —
  never trust or persist the model's self-reported score.

## Read when

- Where backend code lives, import direction, transactions, response schemas,
  when to add a port → use the `onion-architecture` skill (`.claude/skills/onion-architecture/SKILL.md`)
- DI container, modules/adapters, request flow → read `docs/architecture.md`
- Review run end to end (what must stay true) → read `specs/review-flow.md`
- Skills CRUD, import, agent links → read `specs/skills.md`
- Conventions extractor (scan, evidence check, the `repo-conventions` skill) → read `specs/conventions.md`
- API surface, DI/request flow → read `README.md`
- repo-intel internals (indexer, repo map) → read `src/modules/repo-intel/README.md`
- Schema questions → read `src/db/schema/` (14 domains; 6 are future lessons)
- Past lessons here → read `INSIGHTS.md`
