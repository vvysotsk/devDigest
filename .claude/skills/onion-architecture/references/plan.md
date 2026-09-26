# onion-architecture — skill plan

**Decided 2026-09-26 (SKILL.md v1.0.0):** 1 → A (exception = own tables +
read-only to others; `pulls`, `polling` fired and deferred) · 2 → A · 3 → B
(`pnpm deps:check`, advisory) · 4 → A · 5 → as proposed, 5a accept + trigger,
5b accept · 6 → B · 7 → keep `AppError.statusCode` · 8 → required for new
and changed routes, with a response-shape test · 9 → one skill. The rest of
this file is the option analysis as it was before the decisions.

Status: plan for review, 2026-09-26. No `SKILL.md` yet. Evidence:
`research.md` (§1 inventory with `path:line`, §2–§8 findings) and
`sources.md` (104 sources, ids O/K/T/R).

## 0. Goal and non-goals

- **Goal.** Pin down the layering that already works in `server/` and
  `reviewer-core/`, make the import direction explicit, give per-tool rules
  for new code, and name the triggers that justify the heavier patterns
  (transactions, separate domain types, durable queue, enforcement).
- **Non-goals.** No large refactor. Existing deviations (research §1.3) are
  recorded, not fixed by the skill; each gets either "accepted exception" or
  "fix when touched" from the open decisions below.
- **Why not full onion.** The sources agree it is overkill for CRUD and small
  services (O1, O13, O14, R4, K1–K9). Two parts of this repo earn it: the
  review pipeline (volatile LLM providers, a pure core, several drivers:
  HTTP, CI runner, tests) and repo-intel. The CRUD-shaped modules do not.

## 1. Layer map onto our folders

| Ring | Meaning here | `server/` | `reviewer-core/` |
|---|---|---|---|
| Domain (core) | Pure rules and types, no I/O | `src/vendor/shared/contracts/*` (shared kernel types); pure functions: `modules/*/helpers.ts`, `modules/_shared/{latest-batch,run-cost}.ts`, `modules/pulls/status.ts`, `modules/repo-intel/pipeline/{rank,repo-map}.ts` | `src/grounding.ts`, `src/prompt.ts`, `src/review/*`, `src/output/*`, `src/llm/structured.ts` |
| Ports | Interfaces the core/application needs | `src/vendor/shared/adapters.ts`; `modules/repo-intel/types.ts` (`RepoIntel`); `adapters/{tokenizer,depgraph}/index.ts` interfaces | `LLMProvider` from `@devdigest/shared` (consumed, not declared) |
| Application | Use cases: orchestrate ports, own transaction boundaries, no framework | `modules/<m>/service.ts`, `modules/reviews/{run-executor,findings,diff-loader}.ts`, `modules/repo-intel/{service.ts,pipeline/{full,incremental,walk}.ts}` | `src/review/run.ts` `reviewPullRequest` (the engine's single use case) |
| Infrastructure | Adapters implementing ports; persistence | `modules/<m>/repository.ts` + `repository/`; `adapters/*`; `db/*`; `platform/{jobs,sse,run-logger,price-book,resilience,config}.ts` | `src/llm/openrouter.ts` (exception, decision 5) |
| Presentation | Driving adapter (HTTP) | `modules/<m>/routes.ts`; `modules/_shared/{context,schemas}.ts`; error handler in `app.ts` | — |
| Composition root | The only place that knows concrete classes | `platform/container.ts`, `app.ts`, `server.ts`, `modules/index.ts` | none (a library has no root, T33) |

## 2. Dependency direction — the import matrix

Allowed arrows point inward. "✗" = forbidden for new and changed code.

| From ↓ / imports → | contracts, ports | domain fns | application | repository | adapters/, db/ | platform/{jobs,sse} | routes | container |
|---|---|---|---|---|---|---|---|---|
| **domain fns** | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **application** | ✓ | ✓ | same module ✓ | via injected instance ✓ (type import ✓) | ✗ (only through a port) | via port type ✓ | ✗ | type only (decision 6) |
| **repository** | ✓ | ✓ | ✗ | same module ✓ | `db/` ✓ | ✗ | ✗ | ✗ |
| **adapters/** | ✓ | ✓ | ✗ | ✗ | own folder ✓ | resilience ✓ | ✗ | ✗ |
| **routes** | ✓ | ✓ | same module ✓ | ✗ (decision 1) | ✗ | via `app.container` ✓ | ✗ | via `app.container` ✓ |
| **reviewer-core/src** | ✓ | ✓ (own) | own ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |

Cross-cutting rules:
- A module never imports another module's folder; shared code goes to
  `modules/_shared/` (pure) or through the container (instances). Constants
  shared by two modules move to `_shared/` (today: D-7).
- `@devdigest/reviewer-core` may only be imported by application code
  (`run-executor.ts`) and the composition root (for the provider, decision 5).
- `drizzle-orm` and `db/schema` imports are allowed only in
  `modules/*/repository*`, `db/`, `adapters/auth/local.ts`, `platform/jobs.ts`,
  and `app.ts` (`/health/ready`) — plus the thin-module exception if
  decision 1 keeps it.
- `node:fs`, SDKs (`openai`, `@anthropic-ai/sdk`, `octokit`, `simple-git`)
  are adapter-only; `repo-intel` `node:fs` reads are a documented exception
  (D-5) until its trigger fires.

## 3. Rules per tool (for new and changed code)

### Fastify (presentation)
- A route: parse (`schema.params/body/querystring`), `getContext`, call one
  service method, return a contract-shaped object. No Drizzle, no SDK calls,
  no multi-step logic (T10, O5).
- New or changed routes declare `schema.response` with the contract schema
  (T4, T11) — closes D-14 incrementally (decision 8).
- Errors: throw `AppError` subclasses; the single handler in `app.ts` maps
  them; no per-route `reply.code()` for domain failures (T7, T62).
- SSE stays a route-level adapter over `RunBus` (T55); services publish via
  `RunLogger`/`runBus`, never touch `reply`.
- Defer plugin mechanics to `fastify-best-practices`.

### zod (boundary)
- Parse at the edge only: HTTP input (route schema), LLM output
  (`reviewer-core/src/llm/structured.ts`), GitHub/git payloads in adapters,
  env in `platform/config.ts`. Do not re-parse trusted data inside services
  (T15, T17).
- Contract types (`z.infer`) are the application's types (decision 2); rows
  are not.
- Contract edits follow the vendor/shared mirroring rule in `server/CLAUDE.md`.
- Defer schema style to the `zod` skill.

### Drizzle (persistence adapter)
- Queries live in `modules/<m>/repository.ts` or `repository/*.repo.ts`.
- New repository methods return contract types or small named
  application types, mapped inside the repository; they do not return
  `$inferSelect` rows to services (O6, T24, T32, R7). Existing row-returning
  methods stay until touched (decision 2).
- Workspace scoping is a parameter of every repository read, as today.
- Multi-table writes that must be atomic: see the transaction trigger (§5)
  and decision 4 — `Db | Tx` executor (T26), never ambient ALS (R2).
- Map PG error codes to `AppError` subclasses inside the repository (R1, R3).
- Defer query/schema mechanics to `drizzle-orm-patterns` and
  `postgresql-table-design`.

### Container (composition root)
- New adapters: interface → implementation in `adapters/<kind>/` → getter +
  `ContainerOverrides` key → fake in `adapters/mocks.ts` (existing extension
  point, `server/docs/architecture.md`).
- New services receive what they use (decision 6), and repositories come
  from the container, not `new XRepository(container.db)` inside the service
  (D-3).
- No DI framework; Pure DI is the documented choice (T33–T35, O4).

### Adapters (LLM, GitHub, git, secrets)
- Thin wrappers over the SDK; no business rules; SDK types never leave the
  adapter (T41, T42).
- Every adapter has a fake in `adapters/mocks.ts`; tests fake our ports, not
  the SDK (`vi.mock('openai')` is a smell) (T41, T46).
- Pure helpers that ended up in `adapters/` (e.g. `git/diff-parser.ts`) may be
  imported by application code only as pure functions; new pure helpers go to
  the domain side (D-6).

### Jobs and SSE
- `JobRunner` is the queue port's only adapter (p-queue, in-memory, T49).
  Handlers are registered in route plugins at boot, as today.
- Review runs stay un-awaited promises with the boot reaper (documented
  design); any change goes through the durable-queue trigger (§5).
- `RunBus` is infrastructure; application code publishes through
  `RunLogger`; routes adapt the bus to SSE.

### Tests
- Domain functions and reviewer-core: hermetic unit tests, no fakes needed.
- Application services: hermetic with `ContainerOverrides` fakes, or
  `*.it.test.ts` when the service's value is its SQL.
- Repositories: `*.it.test.ts` against testcontainers — never mocked (T45,
  T56).
- API: `app.inject()` (T10).
- Prefer injected fakes over `vi.mock` of modules (T46, T58).

## 4. Review checks (no linter — checked in review)

The skill's checklist, each tied to a rule above:

1. Route contains no `drizzle-orm`/`db/schema` import (except decision-1
   exceptions) and no SDK call.
2. New/changed route declares `schema.response`.
3. No file outside the allowed list imports `drizzle-orm` or `db/schema`.
4. No service returns or accepts a `$inferSelect` row in a NEW signature.
5. No module imports another module's folder.
6. No `new XRepository(` / `new <Adapter>(` outside `platform/container.ts`
   (and repository-internal helpers).
7. No SDK or `node:fs` import outside `adapters/` (repo-intel exception
   listed).
8. Multi-table writes in one use case either run in a transaction or the
   report says why partial state is acceptable.
9. reviewer-core: no new import of `node:*`, DB, HTTP, SDK outside
   `src/llm/openrouter.ts`; no import from `server/` except
   `@devdigest/shared` (and test fakes, D-11).
10. New adapter came with a port, a `ContainerOverrides` key and a fake.

Report line, same convention as `frontend-architecture`:
```
Layers: <file> <check #> — kept: <reason> | fixed: <how>
```

## 5. Architecture-change triggers

Firing = propose to the user, record the decision in
`server/docs/architecture.md` ("Architecture decisions" section, created with
the skill), do not restructure silently. A deferred trigger is not
re-proposed until its revisit condition appears.

| Trigger | Fires when | Change |
|---|---|---|
| Transactions for a use case | A use case writes ≥2 tables whose partial state is visible to users or breaks an invariant (today: `pulls` delete→insert of `pr_files`/`pr_commits`, executor review + completion), OR a bug report traces to partial writes | Wrap that use case in `db.transaction`; the involved repository functions take a `Db | Tx` executor (T23, T26). No generic UoW class. |
| Thin module → layered | A thin module's route writes to the DB, reads another module's tables, exceeds ~150 lines of data code, or its logic is needed outside HTTP (job, CI) | Extract `service.ts` + `repository.ts` for that module (first candidate: `pulls`). |
| Separate domain types | A contract change for the client forces changes in service logic that doesn't care, OR a service needs invariants the wire DTO cannot express | Introduce application types for that aggregate only, mapped in the repository and at the route. |
| Durable queue | Review runs or jobs must survive a restart, OR a second API instance per database is planned (boot reaper would misfire) | `JobQueue` port with a Postgres-backed adapter (pg-boss) behind it (T50, T52). |
| Enforcement upgrade | Per decision 3; e.g. a boundary violation from checks 1/3/5/7 slips through review twice | Promote the dependency-cruiser config from advisory to a required step. |
| Port for repo-intel file access | A second storage for clones appears (remote workspace, sandbox) | `ClonedRepoReader` port; `node:fs` moves into an adapter. |
| OpenRouter adapter out of the core | reviewer-core gets a consumer that must not ship the OpenAI SDK/network code, OR a second provider implementation is added to the core | Move `OpenRouterProvider` to `server/src/adapters/llm/` and a CI-runner-side adapter; core exports only the port consumer. |
| Split ports from shared contracts | A port changes only for server needs and the client copy drifts again (already 5 drifted files) | Move `adapters.ts` ports out of `vendor/shared` into a server-owned (or core-owned) module. |

## 6. Open decisions for the user

1. **"Thin" modules with Drizzle in routes.**
   - A — allowed exception, codified: a module may skip service/repository
     if it touches only its own tables and has no multi-table write.
     Checked against the code:
     - `settings` qualifies (only `settings`, single-table upsert;
       `settings/routes.ts`, `settings/feature-models.ts`).
     - `workspace` reads `repos` (`workspace/routes.ts:20`) — read-only,
       another module's table; qualifies only if "read-only access to
       another module's table" is part of the exception.
     - `polling` does NOT qualify: it inserts into `pull_requests`
       (`polling/routes.ts:33`) and updates `repos` (`:61`), two tables
       owned by other modules, without a transaction.
     - `pulls` does NOT qualify: GitHub sync, delete→insert of
       `pr_files`/`pr_commits` (`pulls/routes.ts:251-285`), reads of the
       reviews module's tables (`:126-180`), 393 lines.
   - B — rule without exceptions; refactor thin modules when touched.
   - Recommendation: **A** (exception = own tables, plus read-only access to
     another module's table), with `pulls` and `polling` logged in
     "Architecture decisions" as deviations whose trigger has already fired
     — deferred or scheduled, your call.
2. **Domain types vs zod contracts as the domain.**
   - A — contracts (`z.infer`) are the application/domain types; no separate
     domain model; Drizzle rows must not cross the repository boundary in
     new code.
   - B — separate domain types per aggregate with mappers at both edges.
   - Recommendation: **A** (sources: T17, T19, R4 "overkill for smaller
     applications"); B only via its trigger.
3. **Enforcement: dependency-cruiser vs review checks.**
   - A — review checks only (as `frontend-architecture`).
   - B — a `server/.dependency-cruiser.cjs` modelled on R1 (layer regexes,
     `$1` cross-module rule, `tsPreCompilationDeps: true`, `tsConfig`) run on
     demand (`npx depcruise src --config`), advisory, existing violations
     listed as known; no new package (already installed).
   - C — B plus a required step in CI / before commit.
   - Note: root `CLAUDE.md` forbids adding a linter unprompted; this is a
     dependency checker, but the call is yours.
   - Recommendation: **B**.
4. **Unit of work for transactions.**
   - A — no UoW abstraction; per-use-case `db.transaction` + `Db | Tx`
     executor, introduced only by the trigger.
   - B — a `runInTransaction(fn)` helper with tx-bound repositories now.
   - C — ambient AsyncLocalStorage transaction context.
   - Recommendation: **A** (T26, T28, T31; R2 shows C failing silently).
5. **reviewer-core ↔ server boundary.**
   - Proposed wording: reviewer-core is the domain ring of the review
     pipeline — pure, no composition root, one driven port (`LLMProvider`);
     the server holds application, infrastructure and presentation around it;
     `vendor/shared` is a shared kernel both packages consume.
   - Sub-decision 5a: `OpenRouterProvider` in the core — accept as a
     documented exception (shared with the CI runner) or move it out now?
     Recommendation: accept + trigger.
   - Sub-decision 5b: reviewer-core tests importing server fakes (D-11) —
     accept, or give the core its own minimal fake? Recommendation: accept.
6. **Container as service locator (D-4).**
   - A — keep passing `Container`; document it.
   - B — new services declare `deps: Pick<Container, 'git' | 'llm' | …>`
     plus injected repositories; existing services unchanged.
   - Recommendation: **B** for new code only (T33, R3's `Pick<Dependencies>`).
7. **Errors with HTTP status codes in the domain (D-8).** Keep `AppError`
   with `statusCode` as is (recommended: one handler already maps them), or
   move status mapping into the handler by error class.
8. **Response schemas (D-14).** Require `schema.response` for new and
   changed routes (recommended), for all routes in one sweep, or not at all?
   Separately: the inaccurate claim in `server/CLAUDE.md` and
   `server/docs/architecture.md` needs a fix in a task that may touch them.
9. **Skill scope.** One skill for both packages (recommended: the import
   matrix spans them) or two (`onion-architecture` for server, purity rules
   stay in `reviewer-core/CLAUDE.md`)?

## 7. Proposed skill layout

```
.claude/skills/onion-architecture/
  SKILL.md        ~250 lines: layer map, import matrix, per-tool rules,
                  review checks, triggers, checklist; metadata.version 1.0.0
  README.md       for humans: version, changelog, sources per rule
  references/
    research.md   (this research)
    sources.md
```

- `description` draft: "Where backend code lives in server/ and
  reviewer-core/ and which way imports may point. Use when adding or
  changing a route, service, repository, adapter, job or port, moving code
  between modules, touching reviewer-core's public API, or deciding whether
  a use case needs a transaction, a port or a separate type."
- Cross-links, no duplication: `fastify-best-practices` (plugin mechanics),
  `drizzle-orm-patterns` and `postgresql-table-design` (queries/schema),
  `zod` (schema style), `typescript-expert` (types).
- Shared-file follow-ups for the SKILL.md task (not this one):
  `.claude/skills/README.md` row, `server/CLAUDE.md` and
  `reviewer-core/CLAUDE.md` "Read when" lines, "Architecture decisions"
  section in `server/docs/architecture.md`.

## 8. Draft dependency-cruiser rules (only if decision 3 = B or C)

Sketch, to be validated against the real tree before use:

```js
// server/.dependency-cruiser.cjs — advisory
module.exports = {
  forbidden: [
    { name: 'no-cross-module', severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to:   { path: '^src/modules/', pathNot: ['^src/modules/$1/', '^src/modules/_shared/'] } },
    { name: 'no-drizzle-outside-persistence', severity: 'warn',
      from: { path: '^src/', pathNot: ['/repository', '^src/db/', '^src/adapters/auth/', '^src/platform/jobs', '^src/app\\.ts$'] },
      to:   { path: ['node_modules/drizzle-orm', '^src/db/(schema|rows|client)'] } },
    { name: 'no-sdk-outside-adapters', severity: 'warn',
      from: { path: '^src/', pathNot: ['^src/adapters/', '^src/platform/container'] },
      to:   { path: 'node_modules/(openai|@anthropic-ai|octokit|simple-git)' } },
    { name: 'no-new-outside-root', severity: 'info', /* not expressible; review check 6 */ },
    { name: 'no-circular', severity: 'warn', from: {}, to: { circular: true } },
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    doNotFollow: { path: 'node_modules' },
  },
};
```

Known violations the first run would report: D-1 (thin modules), D-2/D-6
(row and adapter imports), D-7 (repos → repo-intel constants).
