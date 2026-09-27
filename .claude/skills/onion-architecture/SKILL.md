---
name: onion-architecture
description: "Where backend code lives in server/ and reviewer-core/ and which way imports may point (onion / ports and adapters). Use when adding or changing a route, service, repository, adapter, job or port, moving code between modules, touching reviewer-core's public API, or deciding whether a use case needs a transaction, a port, a response schema or a separate type."
metadata:
  version: 1.1.0
  applies_to: "server/src/**, reviewer-core/src/**, server/.dependency-cruiser.cjs, !**/*.test.ts, !**/*.it.test.ts"
  blocking: "true"
---

# Onion architecture (server/ + reviewer-core/)

One rule: **source dependencies point inward**. The review engine is the
core, ports are owned by the inside, adapters and HTTP live at the edge.
This skill pins down the layering that already works and names the triggers
for the heavier patterns. It does not ask for refactors of existing code.

Related skills, do not duplicate: `fastify-best-practices` (plugin
mechanics), `drizzle-orm-patterns` and `postgresql-table-design`
(queries, schema), `zod` (schema style), `typescript-expert`,
`package-docs` (update `server/docs/architecture.md` after a change here).

Evidence: `references/research.md` (inventory with `path:line`, findings),
`references/sources.md` (104 sources), `references/plan.md` (options behind
each decision). Section pointers below are to `research.md`.

## Map — rings onto our folders

| Ring | `server/` | `reviewer-core/` |
|---|---|---|
| Domain core — pure rules and types | `src/vendor/shared/contracts/*` (shared kernel); pure functions in `modules/*/helpers.ts`, `modules/_shared/{latest-batch,run-cost,diff-parser,job-kinds}.ts`, `modules/pulls/status.ts`, `modules/repo-intel/extract.ts`, `modules/repo-intel/pipeline/{rank,repo-map}.ts` | everything in `src/` except `src/llm/openrouter.ts` |
| Ports | shared across modules or with the client: `src/vendor/shared/adapters.ts`; used by one module: that module's `types.ts` — `modules/repo-intel/types.ts` (`RepoIntel` facade, `CodeParser`, `Tokenizer`, `DepGraph`) | consumes `LLMProvider` from `@devdigest/shared` |
| Application — use cases | `modules/<m>/service.ts`, `modules/reviews/{run-executor,findings,diff-loader}.ts`, `modules/repo-intel/service.ts` + `pipeline/{full,incremental,walk}.ts` | `src/review/run.ts` `reviewPullRequest()` |
| Infrastructure — adapters, persistence | `modules/<m>/repository.ts` + `repository/*.repo.ts`; `adapters/*`; `db/*`; `platform/{jobs,sse,run-logger,price-book,resilience,config}.ts` | `src/llm/openrouter.ts` (exception, R9) |
| Presentation — HTTP | `modules/<m>/routes.ts`; `modules/_shared/{context,schemas}.ts`; error handler in `app.ts` | — |
| Composition root | `platform/container.ts`, `app.ts`, `server.ts`, `modules/index.ts` | none — a library has no root |

`vendor/shared` is the **shared kernel**: contracts and port interfaces both
packages (and the client copy) consume. Its mirroring rule lives in
`server/CLAUDE.md`.

## Import rules

| From ↓ may import → | contracts, ports | domain fns | application | repository | `adapters/`, `db/` | `platform/{jobs,sse}` |
|---|---|---|---|---|---|---|
| domain fns | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| application | ✓ | ✓ | same module | injected instance (type import ✓) | ✗ — through a port | via `RunLogger`/port type |
| repository | ✓ | ✓ | ✗ | same module | `db/` ✓ | ✗ |
| `adapters/` | ✓ | ✓ | ✗ | ✗ | own folder | `resilience` ✓ |
| routes | ✓ | ✓ | same module's service | ✗ | ✗ (thin-module exception, R2) | via `app.container` |
| reviewer-core `src/` | ✓ (`@devdigest/shared` only) | own | own | ✗ | ✗ | ✗ |

- A module never imports another module's folder. Shared pure code goes to
  `modules/_shared/`; shared instances come from the container.
- `drizzle-orm` and `db/{schema,rows,client}` only in repositories, `db/`,
  `adapters/auth/local.ts`, `platform/jobs.ts`, the composition root, and the
  thin-module exception.
- Vendor SDKs (`openai`, `@anthropic-ai/sdk`, `octokit`, `simple-git`) and
  `node:fs` only in `adapters/` (plus the documented exceptions in
  "Known violations").

## Rules

### R1 — Contracts are the domain types; rows stay in the repository
- zod contracts from `@devdigest/shared` (`z.infer`) are the application's
  types. There is no separate domain model.
- New and changed repository methods return contract types (or a small named
  type declared in the module), mapped inside the repository. Drizzle
  `$inferSelect` rows never cross the repository boundary in new or changed
  code. Existing row-returning methods stay until touched (research §1.3 D-2).
- Separate domain types only through the trigger below.

### R2 — Routes are thin; Drizzle in routes only for the listed exception
- A route: zod `schema` for params/body/querystring, `getContext`, one
  service call, return a contract-shaped object. No SDK calls, no multi-step
  logic.
- **Thin-module exception:** a module may query Drizzle from its routes only
  for its own tables plus read-only access to another module's tables.
  Qualifying today: `settings`, `workspace`. `pulls` and `polling` do NOT
  qualify; their trigger has fired and the refactor is deferred (see
  `server/docs/architecture.md` "Architecture decisions"). New routes in
  those two modules go through a service.

### R3 — Response schema + shape test for every new or changed route
- Declare `schema.response` with the contract, e.g.
  `schema: { params: IdParams, response: { 200: PrMeta.array() } }`.
- The zod serializer (`fastify-type-provider-zod` 4.x) runs
  `schema.safeParse(data)` and sends `result.data`: fields outside the schema
  are dropped, and a shape mismatch becomes a 500
  (`ResponseSerializationError`). Therefore every route that gains a response
  schema gets a test: `app.inject()` → status 200 →
  `Contract.strict().parse(res.json())`.
- Exception: a schema built with `.passthrough()` (`Settings`,
  `src/vendor/shared/contracts/platform.ts:99`) keeps extra fields.
- Today 0 of 37 routes declare one (research §1.3 D-14); do not add them in
  bulk as a side effect.

### R4 — Transactions at the use case, `Db | Tx` executor, no UoW
- A use case that must write ≥2 tables atomically wraps them in
  `db.transaction(async (tx) => …)` in the service; the repository functions
  involved take an executor parameter typed `Db | Tx`
  (`type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]`).
- No unit-of-work class, no AsyncLocalStorage transaction context.
- Introduced only by the transaction trigger. First candidate: the `pulls`
  sync delete→insert (`server/src/modules/pulls/routes.ts:251-285`).
- Map PG error codes (`23505` …) to `AppError` subclasses inside the
  repository.

### R5 — Composition root and dependencies
- `platform/container.ts` is the only place that constructs adapters and
  shared repositories. No DI framework.
- New services take `deps: Pick<Container, 'git' | 'llm' | …>` plus the
  repositories they use, not the whole `Container`. Existing services keep
  their constructor until touched (research §1.3 D-3, D-4).
- A port lives with its consumers: a port used by one module lives in that
  module's `types.ts`; ports shared across modules or with the client live
  in `src/vendor/shared/adapters.ts` (mirror to client). Adapters only
  implement a port; they never declare one.
- New adapter: port interface (see above) → implementation in
  `src/adapters/<kind>/` → getter + `ContainerOverrides` key → fake in
  `src/adapters/mocks.ts`.

### R6 — Adapters are thin; tests fake our ports, not SDKs
- Adapters wrap the SDK and translate types; SDK types never leave them.
- Tests use the fakes in `adapters/mocks.ts` via `buildApp({ overrides })`;
  `vi.mock('openai')` or mocking octokit is a smell.
- Pure helpers do not belong in `adapters/`; new ones go to the domain side.

### R7 — Errors
- Throw `AppError` subclasses (`platform/errors.ts`); they keep their
  `statusCode`. The single handler in `app.ts` maps them; routes do not set
  status codes for domain failures.

### R8 — Background work and SSE are infrastructure
- `JobRunner` (p-queue, in-memory) is the only queue adapter; handlers are
  registered in route plugins at boot.
- Review runs stay un-awaited promises with the boot reaper (documented in
  `server/docs/architecture.md`); changing that goes through the durable-queue
  trigger.
- Application code publishes through `RunLogger`/`runBus`; only routes adapt
  the bus to SSE.

### R9 — reviewer-core is the domain core
- Pure: no DB, fs, process state or HTTP; the only side effect is the
  injected `LLMProvider`. No composition root, no imports from `server/`
  except `@devdigest/shared`.
- **Documented exception:** `src/llm/openrouter.ts` (`OpenRouterProvider`,
  OpenAI SDK + `fetch`) is an adapter living in the core, shared with the CI
  runner. `src/llm/structured.ts` may import the pure `openai/helpers/zod`.
  No other network code in the core.
- Tests may import fakes from `../server/src/adapters/mocks.ts`.

## Tests per ring

| Ring | Test |
|---|---|
| Domain functions, reviewer-core | hermetic unit tests, no fakes needed |
| Application services | hermetic with `ContainerOverrides` fakes, or `*.it.test.ts` when the value is the SQL |
| Repositories | `*.it.test.ts` against testcontainers; never mocked |
| Routes | `app.inject()`; response-shape test per R3 |

## Advisory check

`cd server && pnpm deps:check` runs dependency-cruiser with
`server/.dependency-cruiser.cjs` over `src` and `../reviewer-core/src` with
`--ignore-known`: it prints only violations that are NOT in
`server/.dependency-cruiser-known-violations.json`. All rules are `warn`: it
reports, never fails, and is not a linter or a CI step. Goal after any
change: **`deps:check` shows no new violations.**

After you fix a known violation, refresh the baseline so it cannot come back
unnoticed: `cd server && pnpm deps:baseline`, and commit the rewritten
`.dependency-cruiser-known-violations.json` with the fix. Never refresh it to
hide a violation your change introduced. `--no-ignore-known` shows the full
list.

The baseline file may only **lose** entries in a diff. A diff that adds an
entry means a new violation was accepted without a decision — that is a
CRITICAL review finding (check 12), whatever the change's size. Accepting a
violation on purpose goes through a trigger and an "Architecture decisions"
entry first, never through `deps:baseline` alone.

**Known violations** (the baseline file is the source of truth; this is the
explanation, 18 entries on 2026-09-26) — do not fix in passing:
- `no-module-to-adapter` ×8: `reviews/diff-loader.ts` → `adapters/git/diff-parser`;
  `repo-intel` service and pipeline → `adapters/{codeindex/extract,astgrep,tokenizer}`.
- `no-drizzle-outside-persistence` ×9: row/schema types in `reviews/{service,run-executor,diff-loader}.ts`,
  `repos/helpers.ts`; Drizzle in `pulls/routes.ts`, `polling/routes.ts`.
- `no-cross-module` ×1: `repos/service.ts` → `repo-intel/constants.ts`.
- Not covered by rules: `repo-intel` reads clones with `node:fs`
  (`modules/repo-intel/service.ts:29`, `pipeline/{full,incremental,walk}.ts`).

`no-circular` reports runtime cycles only (`viaOnly.dependencyTypesNot:
['type-only']`): a cycle with any `import type` edge is erased at compile
time. That excludes today's `platform/container.ts` ↔ `repo-intel/service.ts`
(+ pipeline) loops, closed by `import type { Container }`, and
`agents/helpers.ts` ↔ `agents/repository.ts`, closed by
`import type { AgentRow }` (`agents/helpers.ts:3`). They are not load-order
risks; the underlying smells are covered by R1 and R5.

## Review checks

1. No Drizzle/`db/schema` import in a route outside the thin-module exception (R2).
2. New or changed route has `schema.response` + a shape test (R3).
3. No `$inferSelect` row in a new or changed service/repository signature (R1).
4. No import of another module's folder (import rules).
5. No `new <Repository|Adapter>(` outside `platform/container.ts` in new code (R5).
6. New service takes `Pick<Container, …>` (R5).
7. No SDK or `node:fs` import outside `adapters/` (import rules, R9).
8. A multi-table write is in a transaction, or the report says why partial
   state is acceptable (R4).
9. reviewer-core gained no I/O import and no global `fetch` outside
   `src/llm/openrouter.ts`, and no `server/` import (R9). dependency-cruiser
   cannot see the global `fetch`: grep the diff for it.
10. New adapter came with port, `ContainerOverrides` key and fake (R5).
11. `pnpm deps:check` shows no new violations.
12. **CRITICAL:** in the diff, `server/.dependency-cruiser-known-violations.json`
    only loses entries. Any added entry = a violation accepted without a
    decision.

Report one line per finding:
```
Layers: <file> <check #> — kept: <reason> | fixed: <how>
```

## Architecture-change triggers

Firing = propose to the user; when decided, record it in
`server/docs/architecture.md` → "Architecture decisions" and update this
skill. **Before proposing, read that section:** a deferred trigger is not
proposed again until its revisit condition appears; mention the entry in the
report instead.

| Trigger | Fires when | Change |
|---|---|---|
| Transaction for a use case | A use case writes ≥2 tables whose partial state is visible or breaks an invariant, or a bug traces to a partial write. First candidate: `pulls` sync. | R4: `db.transaction` in the service, `Db | Tx` executor on the involved repository functions. |
| Thin module → layered | A thin module writes to another module's tables, grows past ~150 lines of data code, or its logic is needed outside HTTP. Fired for `pulls`, `polling`. | Extract `service.ts` + `repository.ts` for that module. |
| Separate domain types | A contract change for the client forces changes in service logic that does not care, or a service needs invariants the wire DTO cannot express. | Application types for that aggregate only, mapped in the repository and at the route. |
| Durable queue | Runs or jobs must survive a restart, or a second API instance per database is planned. | A `JobQueue` port with a Postgres-backed adapter (pg-boss). |
| OpenRouter adapter out of the core | reviewer-core gets a consumer that must not ship the OpenAI SDK, or a second provider is added to the core. | Move `OpenRouterProvider` to `server/src/adapters/llm/` and a runner-side adapter. |
| Port for clone file access | A second storage for clones appears (remote workspace, sandbox). | `ClonedRepoReader` port; `node:fs` moves into an adapter. |
| Ports out of the shared kernel | A port changes only for server needs and the client copy drifts again. | Move port interfaces from `vendor/shared` to a server-owned module. |
| Enforcement upgrade | A violation of checks 1/3/4/7 slips through review twice. | Promote `deps:check` rules to `error` and make it a required step. |

## Checklist — before reporting a change in server/ or reviewer-core/

- [ ] New code sits in the ring the Map assigns to its role.
- [ ] Review checks 1–12 hold, or each exception has a `Layers:` line.
- [ ] `pnpm deps:check` shows no new violations (baseline refreshed with `pnpm deps:baseline` only when a known one was fixed).
- [ ] A trigger that fired was checked against "Architecture decisions" and
      proposed, not applied.
- [ ] `server/docs/architecture.md` / `reviewer-core/docs/pipeline.md`
      updated if a boundary, port or ring changed (`package-docs`).
- [ ] Typecheck and tests pass in every package touched.

## References

- `references/research.md` — §1 inventory and deviations (D-1…D-14), §2
  pattern, §3 critique and limits, §4 practices per tool, §5 reference
  repos, §6 enforcement, §7 reviewer-core ↔ server, §8 fit table.
- `references/sources.md` — every cited source with URL.
- `references/plan.md` — the options behind each decision.
