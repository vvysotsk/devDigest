# onion-architecture — research notes

Research date: 2026-09-26. Scope: `server/` (Fastify 5 API) and
`reviewer-core/` (pure review engine). Source ids (`O1`, `T12`, `R3`…) refer
to `sources.md`. This file records what the code is and what the sources
say; decisions belong in `plan.md`.

---

## 1. Inventory — the code as it is

All paths relative to the repo root; line numbers verified 2026-09-26 at
`dfd7ab8`.

### 1.1 Tools that shape the architecture

| Tool | Where | Architectural role today |
|---|---|---|
| Fastify 5 | `server/src/app.ts:1-19`, `:67-169` | One app; every module is a plain async plugin registered from `server/src/modules/index.ts:24-33`; one global error handler `server/src/app.ts:116-164`; `container` decorated on the instance. |
| fastify-type-provider-zod + zod 3 | `server/src/app.ts:6-11`; route `schema: { params: IdParams }` everywhere | Validates params/body and serializes responses. One route still parses its body by hand (`server/src/modules/reviews/routes.ts:32`). |
| zod contracts | `server/src/vendor/shared/contracts/*.ts` (master), mirrored to `client/src/vendor/shared` | Wire DTOs AND the types the engine and services work with (`Finding`, `Review`, `RunSummary`, `RunTrace`); no separate domain types. |
| Port interfaces | `server/src/vendor/shared/adapters.ts:82-281` (`LLMProvider`, `Embedder`, `GitHubClient`, `GitClient`, `CodeIndex`, `AuthProvider`, `SecretsProvider`) | Ports live in the shared contract package, so the client sees them too. Two ports live next to their adapter instead: `Tokenizer` (`server/src/adapters/tokenizer/index.ts:16`) and `DepGraph` (`server/src/adapters/depgraph/index.ts`). `RepoIntel` facade is a port inside a module (`server/src/modules/repo-intel/types.ts`). |
| Adapters | `server/src/adapters/{llm,github,git,secrets,auth,codeindex,embedder,depgraph,tokenizer,astgrep}/` + `mocks.ts` | Real implementations + hand-written fakes (`server/src/adapters/mocks.ts:58-325`). |
| Drizzle ORM + postgres-js | `server/src/db/client.ts`, `server/src/db/schema/*.ts` (13 domain files), `server/src/db/rows.ts:12-16` | Repositories per module; row types (`$inferSelect`) exported from `db/rows.ts` and from repositories. No transaction anywhere in `server/src` (grep `transaction(` → 0 hits). |
| DI Container | `server/src/platform/container.ts:40-219` | Hand-written composition root: eager config/db/secrets/auth/jobs/runBus (`:80-87`), lazy adapters and shared repositories (`:89-208`), `ContainerOverrides` for tests (`:40-54`). |
| JobRunner / p-queue | `server/src/platform/jobs.ts:1-40` | In-process queue mirrored into the `jobs` table; handlers registered by route plugins at boot. Review runs are NOT jobs: un-awaited promise (`server/src/modules/reviews/service.ts:153-155`). |
| SSE RunBus | `server/src/platform/sse.ts:19`, singleton `:103`; bridge in `server/src/modules/reviews/routes.ts:55-91` | In-memory per-run buffer + emitter; route turns it into an async iterator for fastify-sse-v2. |
| Errors | `server/src/platform/errors.ts:7-41` | `AppError(code, message, statusCode)`: domain errors carry HTTP status codes. |
| reviewer-core | `reviewer-core/src/index.ts`, `reviewer-core/src/review/run.ts` | Pure engine behind an injected `LLMProvider` — except `reviewer-core/src/llm/openrouter.ts:1`, `:124` (OpenAI SDK + `fetch`), an adapter living in the core. |
| Vitest + testcontainers | `server/test/*.test.ts` (24 files: 18 hermetic, 6 `*.it.test.ts`), `server/test/helpers/pg.ts`; `reviewer-core/test/*.test.ts` (3) | Fakes via `ContainerOverrides`; `app.inject()` in 6 test files; DB tests via testcontainers. |
| dependency-cruiser | `server/package.json` dependencies; used by `server/src/adapters/depgraph/index.ts` | A PRODUCT dependency (repo-intel graphs the analysed repo). No `.dependency-cruiser.*` config exists for checking this codebase. |

### 1.2 Layers and dependency direction as they are

```
presentation   modules/<m>/routes.ts  (Fastify plugin, zod schemas, getContext)
     ↓ new XService(container)                                   reviews/routes.ts:22
application    modules/<m>/service.ts, run-executor.ts, findings.ts, helpers.ts
     ↓ new XRepository(container.db)                             reviews/service.ts:35
     ↓ container.git / container.llm() / container.repoIntel     run-executor.ts:161, :343
infrastructure modules/<m>/repository.ts (Drizzle), adapters/*, platform/{jobs,sse}.ts, db/*
core (pure)    reviewer-core/src/*  ← called from run-executor.ts:3, :191
shared kernel  vendor/shared (zod contracts + port interfaces), imported by every layer
composition    platform/container.ts, app.ts
```

What holds:
- Routes → service → repository in 5 of 8 modules (`agents`, `repos`,
  `reviews`, `repo-intel`, and partly `settings`).
- Adapters implement ports from `vendor/shared/adapters.ts`; services reach
  adapters only through the container (`reviews/run-executor.ts:161`,
  `repos/service.ts:55`); fakes swap in via `ContainerOverrides`
  (`platform/container.ts:40-54`).
- The review engine is a pure function over ports:
  `reviewer-core/src/review/run.ts` gets `llm`, `onEvent`, `checkCancelled`
  injected; persistence, SSE, cancellation live in the server
  (`server/src/modules/reviews/run-executor.ts:191-293`).
- Only one cross-module folder import exists (below); cross-module reads go
  through `container.agentsRepo` / `container.repoIntel`
  (`platform/container.ts:95-118`) or `modules/_shared/`.
- Composition root (`platform/container.ts:26-29`, `app.ts:18-19`) imports
  concrete module classes — expected for a composition root.

### 1.3 Deviations from onion

| # | Deviation | Evidence |
|---|---|---|
| D-1 | **Drizzle in routes ("thin" modules).** `pulls` (19 `container.db` calls, incl. GitHub sync with delete→insert of `pr_files`/`pr_commits` without a transaction), `polling` (3; inserts `pull_requests` and updates `repos`, tables of other modules), `settings` (3 + `feature-models.ts`; own table only), `workspace` (1; reads `repos`). `pulls` also reads `reviews`, `agent_runs`, `findings` tables that belong to the reviews module. | `server/src/modules/pulls/routes.ts:3`, `:6`, `:34`, `:126-180`, `:251-285`; `polling/routes.ts`; `settings/routes.ts`; `settings/feature-models.ts:41`; `workspace/routes.ts` |
| D-2 | **Drizzle row types in the application layer.** Services, executor and helpers take and return `$inferSelect` rows (`AgentRow`, `PullRow`, `ReviewRow`, `FindingRow`, `typeof schema.repos.$inferSelect`); row → contract mapping happens in `helpers.ts`, not in the repository. Some repository functions already return contracts (`listRunsForPull` → `RunSummary`), others rows — inconsistent. | `reviews/service.ts:4`; `reviews/run-executor.ts:5-7`, `:31-32`, `:58`; `reviews/helpers.ts:6`, `:34-74`; `reviews/diff-loader.ts:4`, `:17`; `reviews/repository.ts:16-19`, `:34-39`; `reviews/repository/run.repo.ts:40-60`; `db/rows.ts:12-16` |
| D-3 | **Services build their own repositories** from `container.db` instead of receiving them; `ReviewService` ignores `container.reviewRepo`. | `agents/service.ts:55`, `repos/service.ts:37`, `reviews/service.ts:35`, `repo-intel/service.ts:105`; `platform/container.ts:99-101` |
| D-4 | **Service locator.** Every service, the executor and `diff-loader` take the whole `Container`; `RepoIntelService` is built with `this` (`platform/container.ts:116`). Dependencies are implicit. | `reviews/service.ts:34`, `reviews/run-executor.ts:45`, `reviews/diff-loader.ts:13`, `repos/service.ts` |
| D-5 | **Direct I/O in services/pipeline.** `repo-intel` reads the clone with `node:fs` instead of a port. | `modules/repo-intel/service.ts:29`, `:763`; `pipeline/full.ts:22`, `:144`; `pipeline/incremental.ts:17`, `:154`; `pipeline/walk.ts:23-24`, `:81` |
| D-6 | **Application imports a concrete adapter module.** | `reviews/diff-loader.ts:3` (`adapters/git/diff-parser.js`); `repo-intel/service.ts:22` (`adapters/codeindex/extract.js`) |
| D-7 | **Cross-module import.** | `modules/repos/service.ts:11-14` imports `../repo-intel/constants.js` |
| D-8 | **Domain errors carry HTTP status codes**; services throw `AppError(..., 400)`. | `platform/errors.ts:7-41`; `reviews/service.ts:57`; `reviews/findings.ts:32` |
| D-9 | **No transactions.** The review executor writes review → findings → markReviewed → completeAgentRun → saveRunTrace as five independent statements; `pulls` replaces `pr_files`/`pr_commits` by delete→insert. | `reviews/run-executor.ts:219-292`; `pulls/routes.ts:251-285` |
| D-10 | **Adapter inside the pure core.** `OpenRouterProvider` (OpenAI SDK + `fetch`) is exported from reviewer-core and built by the server container. | `reviewer-core/src/llm/openrouter.ts:1`, `:124`; `server/src/platform/container.ts:22`, `:185` |
| D-11 | **Core depends on the server's folder** for contracts and, in tests, for fakes. | `reviewer-core/tsconfig.json:21-23`; `reviewer-core/test/run.test.ts:3` |
| D-12 | **Ports split across three places**: `vendor/shared/adapters.ts` (shared with the client), next to adapters (`Tokenizer`, `DepGraph`), inside a module (`RepoIntel`). | see 1.1 |
| D-13 | **Manual body parse in a route** bypasses the type provider (tolerant empty body). | `reviews/routes.ts:32` |
| D-14 | **No response schemas.** 0 of 37 routes declare `schema.response`; the serializer compiler installed in `app.ts` never runs, so nothing filters what leaves the API (docs claim the opposite). | grep `response:` over `server/src/modules/**/routes.ts` → 0; `server/CLAUDE.md` "Non-default conventions" |

Deliberately NOT deviations (documented design):
- Review runs as un-awaited promises instead of jobs, with a boot reaper
  (`server/docs/architecture.md` "Background work"; `app.ts:81`).
- `RunBus` as a module singleton (`platform/sse.ts:103`) — single process by
  design.
- Secrets read only by `LocalSecretsProvider` (`server/CLAUDE.md`).

---

## 2. Onion, Hexagonal, Clean — what the pattern is

### Consensus
- One rule matters: source dependencies point inward, toward policy. Onion,
  Hexagonal and Clean are the same idea — layering plus dependency inversion
  (O9, O6, O8).
- The core owns the abstractions it needs (ports); infrastructure implements
  them; the core never imports the DB driver, HTTP framework or vendor SDKs
  (O2 tenet 2, O5, O8).
- The core compiles and runs without infrastructure, which is what makes it
  testable with fakes (O2 tenet 4, O5, O6).
- Database and web framework are details at the edge (O1, O6, O7).
- Data crossing a boundary is plain data — DTOs or parsed objects — never ORM
  rows or framework objects (O6, R4).
- A DI container is optional; hand wiring in one composition root is enough
  (O3, O4, T33, T34, K9).
- Organise the top level by domain/feature and layer inside each module, not
  global `controllers/ services/ repositories/` folders (O12, O8, O15, K2, K7).
- Folders are not the architecture; import direction is (K10).
- A pure functional core with I/O at the edges satisfies the pattern without
  interfaces (O10, O11, O14).
- Every proponent scopes it to long-lived, complex applications (O1, O13,
  O14, R4 README).

### Contested
- **Rings inside the core.** Clean splits Entities / Use Cases (O6); Graça
  splits Domain / Application (O8); Cockburn has only inside/outside (O5);
  Palermo allows any number (O2).
- **Rich domain model required?** Palermo 2008 centres an object model (O1);
  Palermo 2013 says it also fits forms-over-data (O4); Seemann and Bespoyasov
  accept a pure-function core (O10, O14).

### Quotes
- "All code can depend on layers more central, but code cannot depend on
  layers further out from the core." (O1)
- Tenets: "Inner layers define interfaces. Outer layers implement interfaces"
  · "Direction of coupling is toward the center" · "All application core code
  can be compiled and run separate from infrastructure" (O2)
- "This architecture is not appropriate for small websites." (O1)
- "Isolated, simple, data structures are passed across the boundaries. We
  don't want to cheat and pass Entities or Database rows." (O6)
- "If you apply the Dependency Inversion Principle to Layered Architecture,
  you end up with Ports and Adapters." (O9)

---

## 3. Critique and limits

### Consensus among the critics
- Layering for testability alone produces "test-induced design damage":
  indirection without a design benefit (K1, K6, K9).
- A repository in front of a capable ORM or query builder often duplicates
  it and grows `FindXWithY` methods; reads rarely need it (K3, K4, K5, T30).
- Technical layers scatter a single feature change across folders; cohesion
  per feature beats cohesion per layer (K2, K7, K8).
- An interface with one implementation and no realistic second one is a smell
  unless it marks a real boundary (K6, K9).

### When onion is overkill (conditions from the sources)
- Small or short-lived apps; CRUD where routes → ORM is the whole job (O1,
  O13, O14, R4, T30).
- A port with exactly one adapter whose only purpose is mocking; prefer a real
  DB in integration tests or a pure core (K6, K1, K9, T45).
- A repository that mirrors the query builder method by method (K3, K5).
- Logic that fits the impure → pure → impure sandwich (O11).
- A change that has to touch five or more files in separate top-level folders
  (K2, K8).

### When layering pays
- Long-lived code with real rules (O1); logic driven by several actors — HTTP,
  jobs, CLI, tests (O5); volatile infrastructure likely to be swapped —
  LLM providers, VCS APIs (O1); a core that must be tested without I/O (O2).
- In this repo, `reviewer-core` with an injected `LLMProvider` is the
  textbook pure core with a driven port (O10, T33).

### Contested
- **Repository over an ORM.** For: O1, R4, T29, T30, T32. Against: K1, K3,
  K4, K5. Middle: ports/repositories for writes and aggregates, direct
  queries for reads (K4, R4 read side).
- **Interfaces for testability.** For: O5, O6. Against: K1, K6.
- **Layers vs slices.** Layers: O1, O6. Slices: K2, K7, K8. Reconciled by
  modules at the top with layers inside (O8, O12, O15).
- Fowler's Yagni cuts both ways: effort that makes change cheaper is not a
  Yagni violation (K11).

---

## 4. Practices per tool

### 4.1 Fastify — the driving adapter (outer layer)
Consensus:
- Routes parse input, call one application service, map result or error to
  HTTP; no business logic, no SQL in handlers (O5, O6, T10, T12, R3).
- Validation on the route with `schema` + the zod type provider; declare
  response schemas too — they speed serialization and stop accidental data
  leaks (T4, T5, T6, T11).
- One plugin per feature module; shared infrastructure via `fastify-plugin`
  or decorators; `getDecorator`/`dependencies` make a missing dependency fail
  at boot (T1, T2, T3, O15).
- One central `setErrorHandler` mapping error classes to status codes with a
  stable body; never leak stacks (T6, T7, T63).
- Release pools and queues in `onClose` (T9, T38).
- `buildApp()` separate from `listen()`; test with `inject` (T10).
Contested:
- Fastify decorators as the DI mechanism (O15, T14) vs a framework-agnostic
  container usable from jobs and scripts (T33, T36, T38). The official DI
  guide is still an open PR (T14).
- `@fastify/error` couples errors to Fastify → edge only (T8, T62).

### 4.2 zod — contracts at the boundary
Consensus:
- Parse untrusted or uncontrolled data once, at the edge: HTTP input, LLM
  JSON, third-party payloads, config (T15, T16, T17).
- Shared zod schemas are wire DTOs; mapping DTO ↔ internal types is a
  boundary concern (O6, T20).
Contested:
- zod types as domain types (single source of truth, branded types, T21,
  T22, T25) vs a library-free domain (O6, T18). Pragmatic middle: zod at the
  edges, `z.infer` of wire DTOs inside the service, separate DB row types
  (T17, T19). No maintainer ruling (T18).

### 4.3 Drizzle — persistence adapter
Consensus:
- `$inferSelect`/`$inferInsert` and table objects stay inside repositories;
  repositories return application types through explicit mapping (O6, T24,
  T30, T32, R3, R7).
- The use case owns the transaction boundary; repositories accept a
  `Db | Tx` executor so they work inside or outside a transaction; nested
  `tx.transaction` = savepoint (T23, T26, T31).
- Drizzle has no built-in unit of work; a thin `runInTransaction(fn)` or
  explicit `tx` passing is the whole implementation (T27, T28, T31).
- Repositories are tested against real Postgres (testcontainers), not mocks
  (T45, T56, T59).
- Map driver errors (PG `23505` etc.) to domain errors inside the adapter
  (R1, R3).
Contested:
- Explicit `tx` passing (typed, visible, verbose) vs AsyncLocalStorage
  ambient transactions (implicit; silently broken by any query that bypasses
  the accessor — observed in R2) (T26, T27, R2).
- drizzle-zod contracts derived from tables (T25, R2) vs separate contracts
  (R1, R3, R4).

### 4.4 DI — composition root
Consensus:
- One composition root near the entry point; only it knows concrete
  adapters; libraries have no root and only accept injected ports (T33).
- Pure DI is enough for a small hand-written graph with explicit test
  overrides (T34, T35, O4, K9).
- Never reference the container from outside the root — that is a service
  locator (T33).
- If a container is adopted, prefer a decorator-free one (awilix) over
  reflect-metadata containers (T36, T38, T39, T40).
Contested:
- Container vs Pure DI (T35 vs T34, T37); Fastify decorators vs container
  (O15, T14).

### 4.5 Ports and adapters for LLM, GitHub, git
Consensus:
- Ports are defined in the core's language; adapters are thin wrappers over
  octokit, simple-git, OpenAI/Anthropic SDKs (O1, O5, T41, T42).
- Don't mock SDKs you don't own; fake your own port; cover adapters with a
  few contract or integration tests (T41, T42, T43, T46).
- Prefer working fakes over interaction mocks (T44, T46, T47).
- LLM ports leak on provider-specific features (structured output, tools):
  keep the port minimal and test each adapter (T48).
- Managed dependencies (own Postgres) real in tests; unmanaged (GitHub, LLM)
  faked (T45).

### 4.6 Background work and SSE
Consensus:
- A queue is an outbound port; p-queue is one in-memory adapter and by its
  own README not durable (T49).
- If jobs must survive restarts, a Postgres-backed adapter (pg-boss,
  Graphile Worker) behind the same port can enqueue inside the domain
  transaction — an outbox without a broker (T50, T51, T52).
- In-process domain events vs integration/infrastructure events (after
  commit, async) are different things (T53); in-process event flows are hard
  to follow (T54).
- SSE is an outbound adapter: the core publishes progress to an event port;
  the route adapts it to `reply.sse(asyncIterable)` and cleans up on close
  (T55).

### 4.7 Testing per layer
Consensus:
- Domain/application tests without I/O, built with fakes through the root's
  test overrides; repositories against testcontainers; API through `inject`;
  few end-to-end tests (T10, T45, T56, T59).
- Service-shaped backends weight integration tests (honeycomb), with narrow
  unit tests for complex isolated logic such as the grounding gate (T60,
  T61).
- Test every serialization point: mappers, zod contracts, LLM JSON parsing
  (T59).
- Split suites with Vitest projects; prefer DI over hoisted `vi.mock` (T57,
  T58, T46).
Contested:
- Pyramid (T59) vs honeycomb/trophy (T60, T61); Khorikov's managed/unmanaged
  split settles it per dependency (T45).

### 4.8 Errors
- Errors are domain concepts; mapping to HTTP belongs to the edge (T62, T7).
- Exceptions (Fastify's native model, T7) vs Result types (T62, R3, R4) —
  contested; both appear in the reference repos.
- Response bodies carry no implementation details (T63, T7).

---

## 5. Reference repositories — what is worth copying

| Pattern | Seen in | Fit for a small Fastify + Drizzle service |
|---|---|---|
| Repository port next to the domain, adapter maps rows with a private `toDomain` | R1, R3, R4, R7 | Copy the mapping; skip the port interface when there is one adapter (K6). |
| One hand-wired composition root | R3 (`makeDependencies()`), R7, R5 | Matches our `Container`; R3's type-import of the root from a use case is the inversion to avoid. |
| Use cases as `(input, deps)` functions, Fastify-agnostic | R3, R6 | Our services already take plain args; the `deps` part is where our Container leaks in. |
| dependency-cruiser `forbidden` rules: layer regex arrays, ports allowed, `$1` cross-module rule, `tsPreCompilationDeps: true` | R1, R4, R2 | Copy nearly verbatim; match on folder names, not renamed suffixes (R2 decay). |
| Explicit `Db | Tx` executor for multi-repository writes | T26, R1 (unwired) | Safer than ambient ALS (R2's silent gap). |
| PG error codes → domain errors in the adapter | R1, R3 | Cheap and local. |
| Vitest projects unit / integration | R3 | Mirrors our `*.test.ts` / `*.it.test.ts`. |

Overkill here: command/query/event buses, glob-autoloaded awilix, value
objects for every primitive, aggregate roots and domain-event dispatch,
three-way mappers for CRUD tables, multiple controllers per command,
ambient transactions, eslint-plugin-boundaries without an ESLint setup
(R1, R2, R4, R5).

---

## 6. Enforcement

- When layering is enforced in TS/Node repos, it is dependency-cruiser with a
  `forbidden` list (R1, R2, R4, R8). eslint-plugin-boundaries does the same
  inside ESLint (R10, R11), which this repo deliberately does not run.
- `tsPreCompilationDeps: true` is required, or `import type` edges — exactly
  our row-type leaks — are invisible (R9).
- `tsConfig` must be set so `@devdigest/shared` and `@devdigest/reviewer-core`
  aliases resolve (R9).
- Rules decay when they key on file suffixes that get renamed (R2); key on
  folders.
- dependency-cruiser is already installed in `server/` as a product dependency
  (§1.1), so a config + `npx depcruise` run needs no new package.

---

## 7. reviewer-core ↔ server in onion terms

- reviewer-core is the innermost ring for the review domain: pure functions
  over contracts, one driven port (`LLMProvider`) injected, no composition
  root of its own — exactly what T33 prescribes for a library and O10 calls
  functional ports and adapters.
- The server is the application + infrastructure + presentation rings around
  it: `run-executor.ts` is the application service that does the impure
  steps (load diff, persist, publish) around the pure call
  (`reviewer-core/src/review/run.ts`) — an impureim sandwich (O11).
- Two points break the picture: an adapter (`OpenRouterProvider`, network
  I/O) lives in the core (D-10), and the core's contracts and test fakes live
  in the server's folder (D-11). The first is a direction violation in
  substance (core ships infrastructure) though not in imports; the second is
  a physical-location issue, since `vendor/shared` is effectively a shared
  kernel that both packages consume.

---

## 8. Fit with DevDigest server

| As it is now | What onion says | Gap |
|---|---|---|
| Module shape `routes → service → repository`, cross-module via container (§1.2) | Feature modules with layers inside (O8, O12, O15) | None for 5 of 8 modules; this is the shape to keep. |
| "Thin" modules query Drizzle from routes; `pulls` does GitHub sync + 19 DB calls + reads reviews tables (D-1) | Routes carry no SQL (O6, T10) — but CRUD modules may skip layers (O1, T30, K2) | Small for `settings` (own table) and `workspace` (read of `repos`, `workspace/routes.ts:20`); real for `polling` (inserts `pull_requests` `:33` and updates `repos` `:61` — other modules' tables, no transaction) and for `pulls` (writes without a transaction, reads another module's tables, 393-line route). |
| Services and executor use Drizzle row types; mapping to contracts in `helpers.ts` (D-2) | Rows stay in the adapter; boundary data is plain (O6, T24, T32) | Medium: type-level coupling only, but every schema change ripples into services. |
| Services `new` their repository from `container.db` (D-3) | Dependencies injected from the root (T33) | Small: tests still use a real DB for repositories, but `container.reviewRepo` and `ReviewService` diverge. |
| Every service receives the whole `Container` (D-4) | No container outside the root (T33) | Medium: dependencies implicit; tests override adapters, not services. Works today because the Container only holds ports and repos. |
| `repo-intel` reads files with `node:fs` (D-5) | I/O behind a port (O2) | Small: the clone dir is local and owned; a port would have one adapter (K6). |
| `diff-loader` imports `adapters/git/diff-parser` (D-6) | Application imports ports, not adapters (O2) | Small: the parser is a pure function misplaced in `adapters/`. |
| `repos/service.ts` imports `repo-intel/constants` (D-7) | Modules independent (R1 `$1` rule) | Tiny: constants only. |
| `AppError(code, message, statusCode)` thrown from services (D-8) | Mapping to HTTP at the edge (T62, T7) | Small: one handler maps them; status codes in the domain are a convention, not a bug. |
| No transactions; five sequential writes in the executor; delete→insert in `pulls` (D-9) | Use case owns the transaction; `Db | Tx` executor (T23, T26, T31) | Real for `pulls` (partial replace on failure) and for the executor (review row without its run completion). |
| `OpenRouterProvider` inside reviewer-core (D-10) | Adapters outside the core (O2, O5) | Medium: the core ships infrastructure; purity rule in `reviewer-core/CLAUDE.md` is already violated in substance. |
| Contracts + ports in `server/src/vendor/shared`, consumed by client and reviewer-core (D-11, D-12) | Ports owned by the core (O2, O8) | Structural: ports shared with the client are wider than the core needs; physical home in `server/` makes the core depend on the server folder. |
| Response schemas: 0 of 37 routes declare `schema.response` (grep `response:` in `server/src/modules/**/routes.ts`), so the zod serializer compiler never runs and responses go out through plain `JSON.stringify`. `server/CLAUDE.md` ("serializes every response") and `server/docs/architecture.md` "Request flow" step 3 claim otherwise. | Response schemas are the outbound filter that keeps rows and internals from leaking (T4, T11, O6) | Real and cheap to close per route; the doc claim is inaccurate (not edited in this task — shared file). |
| Tests: fakes via `ContainerOverrides`, testcontainers for `*.it.test.ts`, `inject` in 6 files | Fakes over mocks; real DB for repositories; inject for API (T45, T46, T56) | None; already the recommended shape. |
| No enforcement; dependency-cruiser already installed | dependency-cruiser `forbidden` rules (R1, R8, R9) | Decision for the user (plan.md, open decision 3). |
