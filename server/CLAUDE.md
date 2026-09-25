# server/ — Fastify API (@devdigest/api)

## Commands

- `pnpm dev` · `pnpm typecheck` · `pnpm db:migrate` · `pnpm db:generate` · `pnpm db:seed`
- Unit tests (hermetic): `pnpm exec vitest run --exclude '**/*.it.test.ts'`
- Integration (Docker): `pnpm exec vitest run .it.test`

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

- zod type-provider validates every request AND serializes every response;
  errors use the envelope `{ error: { code, message, details } }`.
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
  to `client/src/vendor/shared`. WARNING: the copies ALREADY differ in 5 files
  (`adapters.ts`, `contracts/eval-ci.ts`, `contracts/knowledge.ts`,
  `contracts/productionize.ts`, `contracts/trace.ts` — e.g. LLMProvider knows
  `openrouter`/`sessionId` only server-side). Diff before assuming sync;
  mirror only the parts your change touches, don't blind-copy whole files.
- Stale-run reaping order in reviews (awaited before listeners) and SSE
  cancellation checkpoints — the await order prevents races; comments in
  place explain each one.
- The review score is recomputed from findings that survived grounding —
  never trust or persist the model's self-reported score.

## Read when

- DI container, modules/adapters, request flow → read `docs/architecture.md`
- Review run end to end (what must stay true) → read `specs/review-flow.md`
- API surface, DI/request flow → read `README.md`
- repo-intel internals (indexer, repo map) → read `src/modules/repo-intel/README.md`
- Schema questions → read `src/db/schema/` (14 domains; 6 are future lessons)
- Past lessons here → read `INSIGHTS.md`
