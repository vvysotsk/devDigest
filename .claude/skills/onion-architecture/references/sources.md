# onion-architecture — source catalogue

Research date: 2026-09-26. Every URL was opened and read by a research agent
(WebFetch, or the GitHub API for repository trees) unless marked
**unverified** (fetch failed or found only via search) or **paywalled**.
Quotes in `research.md` came back through a summarising fetch tool; re-check
wording against the page before quoting it verbatim in the skill.

Id prefixes: **O** foundations · **K** critique and limits · **T** practices
per tool · **R** reference repositories and enforcement tooling.
Type: docs · essay · book · talk · repo · tool · standard · issue.

---

## O. Foundations — Onion, Hexagonal, Clean and how they relate

| # | Author — Title | Type | Why it matters | URL |
|---|---|---|---|---|
| O1 | Jeffrey Palermo — The Onion Architecture: part 1 (2008) | essay | Origin of the pattern: "all coupling is toward the center"; "the database is not the center"; the author's own scope limit: "not appropriate for small websites". | https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/ |
| O2 | Jeffrey Palermo — The Onion Architecture: part 2 (2008) | essay | The four tenets verbatim; same-layer use is direct, outer layers only through interfaces. | https://jeffreypalermo.com/2008/07/the-onion-architecture-part-2/ |
| O3 | Jeffrey Palermo — The Onion Architecture: part 3 (2008) | essay | Infrastructure = "a commodity"; an IoC container is convenient but not a tenet. | https://jeffreypalermo.com/2008/08/the-onion-architecture-part-3/ |
| O4 | Jeffrey Palermo — Onion Architecture: Part 4 – After Four Years (2013) | essay | Works "just fine without" a DI container; also fits forms-over-data. | https://jeffreypalermo.com/2013/08/onion-architecture-part-4-after-four-years/ |
| O5 | Alistair Cockburn — Hexagonal Architecture (2005) | essay | Ports and adapters; driving vs driven actors; ports grouped by purpose, not technology. | https://alistair.cockburn.us/hexagonal-architecture/ |
| O6 | Robert C. Martin — The Clean Architecture (2012) | essay | The Dependency Rule; boundary data is "simple data structures", never entities or database rows. | https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html |
| O7 | Robert C. Martin — Screaming Architecture (2011) | essay | Top level should name the domain, not the framework; use cases testable without frameworks. | https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html |
| O8 | Herberto Graça — DDD, Hexagonal, Onion, Clean, CQRS… how I put it all together (2017) | essay | Synthesis: ports inside, adapters outside; application vs domain layers; package by component. | https://herbertograca.com/2017/11/16/explicit-architecture-01-ddd-hexagonal-onion-clean-cqrs-how-i-put-it-all-together/ |
| O9 | Mark Seemann — Layers, Onions, Ports, Adapters: it's all the same (2013) | essay | Layering + Dependency Inversion = Ports and Adapters; one skill can cover all three names. | https://blog.ploeh.dk/2013/12/03/layers-onions-ports-adapters-its-all-the-same/ |
| O10 | Mark Seemann — Functional architecture is Ports and Adapters (2016) | essay | A pure-function core with an I/O shell satisfies the pattern without interfaces. | https://blog.ploeh.dk/2016/03/18/functional-architecture-is-ports-and-adapters/ |
| O11 | Mark Seemann — Impureim sandwich (2020) | essay | Read → compute purely → write; the lightweight alternative to a port per dependency. | https://blog.ploeh.dk/2020/03/02/impureim-sandwich/ |
| O12 | Martin Fowler — PresentationDomainDataLayering (bliki) | essay | Classic direction presentation → domain → data; split into domain modules once layers grow. | https://martinfowler.com/bliki/PresentationDomainDataLayering.html |
| O13 | Khalil Stemmler — Organizing App Logic with the Clean Architecture | essay | TypeScript framing: domain most stable, use cases = features; overkill for small apps. | https://khalilstemmler.com/articles/software-design-architecture/organizing-app-logic/ |
| O14 | Alex Bespoyasov — Clean Architecture on Frontend (2021) | essay | Minimum viable version: extract the domain + obey the dependency rule; ports as TS types. | https://bespoyasov.me/blog/clean-architecture-on-frontend/ |
| O15 | Matteo Collina — Building a modular monolith with Fastify (talk) | talk | Fastify lead: structure by domain/feature; plugins + decorators as simple DI; avoid module singletons. | https://gitnation.com/contents/building-a-modular-monolith-with-fastify |

## K. Critique and limits

| # | Author — Title | Type | Why it matters | URL |
|---|---|---|---|---|
| K1 | David Heinemeier Hansson — Test-induced design damage (2014) | essay | Hexagonal misapplied for testability; a repository in front of the ORM "is not better". | https://dhh.dk/2014/test-induced-design-damage.html |
| K2 | Jimmy Bogard — Vertical Slice Architecture (2018) | essay | The counter-model: cohesion per request, abstractions only when smells demand them. | https://www.jimmybogard.com/vertical-slice-architecture/ |
| K3 | Oren Eini (Ayende) — Repository is the new Singleton (2009) | essay | The ORM is already the abstraction; repositories grow `FindXWithY` methods. | https://ayende.com/blog/3955/repository-is-the-new-singleton |
| K4 | Oren Eini (Ayende) — Architecting in the pit of doom: the evils of the repository abstraction layer (2011) | essay | Queries are unique to their caller; minimal abstraction for reads. | https://ayende.com/blog/4784/architecting-in-the-pit-of-doom-the-evils-of-the-repository-abstraction-layer |
| K5 | Jon P Smith — Is the repository pattern useful with Entity Framework Core? | essay | The ORM already implements repository/UoW; query objects + entity methods instead. | https://www.thereformedprogrammer.net/is-the-repository-pattern-useful-with-entity-framework-core/ |
| K6 | Mark Seemann — Interfaces are not abstractions (2010) | essay | One implementation per interface is a smell (Reused Abstractions Principle). | https://blog.ploeh.dk/2010/12/02/Interfacesarenotabstractions/ |
| K7 | Dan North — CUPID: for joyful coding (2022) | essay | Layout should mirror the domain; technical layering scatters every change. | https://dannorth.net/blog/cupid-for-joyful-coding/ |
| K8 | James Hickey — Clean Architecture Disadvantages | essay | "Pieces of the same feature are too far apart"; things that change together live together. | https://www.jamesmichaelhickey.com/clean-architecture/ |
| K9 | Three Dots Labs (Smółka, Laszczak) — Is Clean Architecture Overengineering? (podcast) | talk | If the architecture slows you down it is the wrong one; hand-wired DI; no single-implementation interfaces. | https://threedots.tech/episode/is-clean-architecture-overengineering/ |
| K10 | tbuss — How to do the package structure in a Ports and Adapters architecture (2023) | essay | Reports Cockburn: the package structure is "orthogonal" to the style; imports matter, not folders. Second-hand. | https://tbuss.de/posts/2023/9-how-to-do-the-package-structure-in-a-ports-and-adapter-architecture/ |
| K11 | Martin Fowler — Yagni (bliki) | essay | Presumptive features cost; but effort that makes change cheaper is not a Yagni violation. | https://martinfowler.com/bliki/Yagni.html |
| K12 | InfoQ — North/Kerr on complexity in code (2015) | essay | "Layers like Lego blocks by color". **unverified** (not fetched). | https://www.infoq.com/news/2015/04/north-kerr-complexity-code/ |

## T. Practices per tool

### Fastify (outer layer)

| # | Title | Type | Why it matters | URL |
|---|---|---|---|---|
| T1 | Fastify — Encapsulation | docs | Child contexts inherit from parents only; `fastify-plugin` breaks encapsulation deliberately. | https://fastify.dev/docs/latest/Reference/Encapsulation/ |
| T2 | Fastify — Plugins Guide | docs | "Everything is a plugin"; `register` creates a new context; plugins load on `ready`/`inject`. | https://fastify.dev/docs/latest/Guides/Plugins-Guide/ |
| T3 | Fastify — Decorators | docs | Decorators shape instances up front; `getDecorator` fails at boot when a dependency is missing. | https://fastify.dev/docs/latest/Reference/Decorators/ |
| T4 | Fastify — Validation and Serialization | docs | Route schemas validate input; response schemas speed serialization and prevent data leaks. | https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/ |
| T5 | Fastify — Type Providers | docs | Types inferred from schemas; `withTypeProvider` per plugin. | https://fastify.dev/docs/latest/Reference/Type-Providers/ |
| T6 | turkerdev — fastify-type-provider-zod (README) | tool | Validator/serializer compilers; error guards for a custom handler; v7+ needs Zod 4.2 (server pins ^4.0.2 with zod 3). | https://github.com/turkerdev/fastify-type-provider-zod |
| T7 | Fastify — Errors | docs | Error handlers are encapsulated; replace messages of errors you did not raise. | https://fastify.dev/docs/latest/Reference/Errors/ |
| T8 | Fastify — @fastify/error | tool | `createError(code, message, statusCode)`; couples errors to Fastify, so edge layer only. | https://github.com/fastify/fastify-error |
| T9 | Fastify — Hooks | docs | `onClose` is where plugins release pools and queues. | https://fastify.dev/docs/latest/Reference/Hooks/ |
| T10 | Fastify — Testing Guide | docs | Separate `buildApp()` from `listen`; test with `inject` (light-my-request). | https://fastify.dev/docs/latest/Guides/Testing/ |
| T11 | Fastify — Recommendations | docs | Define response schemas; prefer plugins/hooks over middleware. | https://fastify.dev/docs/latest/Guides/Recommendations/ |
| T12 | Fastify — fastify-cli (README) | tool | Canonical split: infrastructure in `plugins/`, presentation in `routes/`. | https://github.com/fastify/fastify-cli |
| T13 | Platformatic — Fastify Fundamentals: plugins and encapsulation | essay | Encapsulation lets an app be written as sub-apps. No byline. | https://blog.platformatic.dev/fastify-fundamentals-a-quick-guide-to-plugins-and-encapsulation-with-platformatic |
| T14 | Fastify issue #5190 / PR #6737 — DI via the plugin system | issue | Proposed official DI guide without an IoC container; PR open, not merged. | https://github.com/fastify/fastify/issues/5190 |

### zod (contracts at the boundary)

| # | Title | Type | Why it matters | URL |
|---|---|---|---|---|
| T15 | Alexis King — Parse, don't validate (2019) | essay | Parse at the boundary once; no "shotgun parsing". | https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/ |
| T16 | Zod — Basics | docs | `parse` returns a typed deep clone; `safeParse`; `z.input`/`z.output`. | https://zod.dev/basics |
| T17 | Matt Pocock — When should you use Zod? | essay | Validate what you don't trust or don't control; not your own trusted data. | https://www.totaltypescript.com/when-should-you-use-zod |
| T18 | zod issue #813 — How to use zod in a clean architecture setup? (2021) | issue | The open question: can core entities be zod objects? Closed without a ruling. | https://github.com/colinhacks/zod/issues/813 |
| T19 | zod discussion #5576 — Zod type or TS types (2025) | issue | Pragmatic middle (zod for API types, separate DB types); answered by a bot, low weight. | https://github.com/colinhacks/zod/discussions/5576 |
| T20 | Arnaud Renaud — Clean Architecture in Practice with TypeScript, Prisma, Next.js (2024) | essay | zod in the route layer; ORM code moved out of the service. | https://www.arnaudrenaud.com/articles/clean-architecture-typescript-prisma-next/ |
| T21 | Steve Kinney — Type Branding with Zod | essay | The "zod as domain value object" view (branded types). | https://stevekinney.com/courses/full-stack-typescript/type-branding-with-zod |
| T22 | egghead — Treat zod Schemas as Single Source of Truth | essay | The other side of the debate. **unverified** (search only). | https://egghead.io/treat-zod-schemas-as-single-source-of-truth~8fli2 |

### Drizzle (repositories, transactions, mapping)

| # | Title | Type | Why it matters | URL |
|---|---|---|---|---|
| T23 | Drizzle — Transactions | docs | `db.transaction(async tx => …)`; `tx` has the `db` API; nested = savepoint; isolation options. | https://orm.drizzle.team/docs/transactions |
| T24 | Drizzle — Type inference (Goodies) | docs | `$inferSelect`/`$inferInsert` are persistence types. | https://orm.drizzle.team/docs/goodies |
| T25 | Drizzle — drizzle-zod | docs | Table-derived zod schemas; convenient for CRUD, couples the wire to the table. | https://orm.drizzle.team/docs/zod |
| T26 | Drizzle discussion #3271 — Correct TypeScript type for tx | issue | The `Db | Tx` executor type used by repositories. | https://github.com/drizzle-team/drizzle-orm/discussions/3271 |
| T27 | Drizzle discussion #2777 — Implicit Transaction Context | issue | AsyncLocalStorage transactions; CPU overhead; "passing db as the last param" alternative. | https://github.com/drizzle-team/drizzle-orm/discussions/2777 |
| T28 | Drizzle issue #2543 — unit of work | issue | No built-in UoW; implement `runInTransaction(fn)` yourself. | https://github.com/drizzle-team/drizzle-orm/issues/2543 |
| T29 | Martin Fowler — P of EAA: Repository | book | "A collection-like interface for accessing domain objects". | https://martinfowler.com/eaaCatalog/repository.html |
| T30 | Percival & Gregory — Cosmic Python, ch. 2: Repository (2020) | book | ORM imports the domain, not the reverse; "a simple CRUD wrapper… doesn't need a repository". | https://www.cosmicpython.com/book/chapter_02_repository.html |
| T31 | Percival & Gregory — Cosmic Python, ch. 6: Unit of Work (2020) | book | UoW = abstraction over atomic operations; explicit commit; fake UoW + fake repo. | https://www.cosmicpython.com/book/chapter_06_uow.html |
| T32 | Khalil Stemmler — Entities (TypeScript DDD, 2019) | essay | Mapper `toDomain`/`toPersistence` between domain objects and rows. | https://khalilstemmler.com/articles/typescript-domain-driven-design/entities/ |

### DI (composition root)

| # | Title | Type | Why it matters | URL |
|---|---|---|---|---|
| T33 | Mark Seemann — Composition Root (2011) | essay | One place near the entry point; "only applications should have composition roots, libraries shouldn't"; container referenced only there. | https://blog.ploeh.dk/2011/07/28/CompositionRoot/ |
| T34 | Mark Seemann — Pure DI (2014) | essay | DI without a container is legitimate. | https://blog.ploeh.dk/2014/06/10/pure-di/ |
| T35 | Mark Seemann — When to use a DI Container (2012) | essay | "Don't use a DI Container just to use one." | https://blog.ploeh.dk/2012/11/06/WhentouseaDIContainer/ |
| T36 | Jeff Hansen — Awilix (README) | tool | Decorator-free container; lifetimes; strict mode against lifetime leaks. | https://github.com/jeffijoe/awilix |
| T37 | Jeff Hansen — Dependency Injection in Node.js, 2016 edition | essay | Manual DI gets tedious. **unverified** (403). | https://medium.com/@Jeffijoe/dependency-injection-in-node-js-2016-edition-f2a88efdd427 |
| T38 | Fastify — @fastify/awilix | tool | Per-request scope; dispose in `onClose`. | https://github.com/fastify/fastify-awilix |
| T39 | Microsoft — tsyringe (README) | tool | Needs legacy decorators + `reflect-metadata`; string tokens for interfaces. | https://github.com/microsoft/tsyringe |
| T40 | InversifyJS — Getting started | docs | Same decorator/metadata cost. | https://inversify.io/docs/introduction/getting-started/ |

### Ports and adapters for external systems

| # | Title | Type | Why it matters | URL |
|---|---|---|---|---|
| T41 | Google Testing Blog — Don't Mock Types You Don't Own (2020) | essay | Wrap the third-party type and mock the wrapper; prefer fakes. | https://testing.googleblog.com/2020/07/testing-on-toilet-dont-mock-types-you.html |
| T42 | Hynek Schlawack — "Don't Mock What You Don't Own" in 5 Minutes (2022) | essay | Thin façade over the SDK, kept cyclomatically simple; traces the rule to GOOS (book not fetched). | https://hynek.me/articles/what-to-mock-in-5-mins/ |
| T43 | Martin Fowler — Contract Test (bliki) | essay | Periodically check that doubles behave like the real service. | https://martinfowler.com/bliki/ContractTest.html |
| T44 | Martin Fowler — Mocks Aren't Stubs (2007) | essay | Fakes vs stubs vs mocks; classicist vs mockist. | https://martinfowler.com/articles/mocksArentStubs.html |
| T45 | Vladimir Khorikov — When to Mock (2020) | essay | Managed dependencies (own DB) real in integration tests; unmanaged (GitHub, LLM) faked. | https://enterprisecraftsmanship.com/posts/when-to-mock/ |
| T46 | Percival & Gregory — Cosmic Python, ch. 3: Coupling and Abstractions (2020) | book | Patching out a dependency does not improve design; fakes over mocks. | https://www.cosmicpython.com/book/chapter_03_abstractions.html |
| T47 | Vercel — AI SDK Core: Testing | docs | A real LLM port with an official deterministic fake model. | https://ai-sdk.dev/docs/ai-sdk-core/testing |
| T48 | Ideas-to-Life — LLM Provider Abstraction Boundary (2026) | essay | LLM ports leak on tools/structured output; test each adapter. Low weight. | https://ideas-to-life.ai/architecture/patterns/llm-provider-abstraction-boundary/ |

### Background work and SSE

| # | Title | Type | Why it matters | URL |
|---|---|---|---|---|
| T49 | Sindre Sorhus — p-queue (README) | tool | In-memory; "for servers, you probably want a Redis-backed job queue instead"; `onIdle()`. | https://github.com/sindresorhus/p-queue |
| T50 | Tim Jones — pg-boss (README) | tool | Postgres-backed durable queue; enqueue inside an existing transaction. | https://github.com/timgit/pg-boss |
| T51 | Benjie Gillam — Graphile Worker | tool | Postgres queue with LISTEN/NOTIFY. Landing page only. | https://worker.graphile.org/ |
| T52 | Chris Richardson — Pattern: Transactional Outbox | essay | Write the message in the same transaction as the entity. | https://microservices.io/patterns/data/transactional-outbox.html |
| T53 | Microsoft — Domain events: design and implementation | docs | Domain events (in-process) vs integration events (after commit, async). | https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/domain-events-design-implementation |
| T54 | Martin Fowler — What do you mean by "Event-Driven"? (2017) | essay | Event flows are hard to see in code; caution against an in-process bus. | https://martinfowler.com/articles/201701-event-driven.html |
| T55 | mpetrunic — fastify-sse-v2 (README) | tool | `reply.sse(asyncIterable)`; cleanup on socket close. | https://github.com/mpetrunic/fastify-sse-v2 |

### Testing per layer and error modelling

| # | Title | Type | Why it matters | URL |
|---|---|---|---|---|
| T56 | Testcontainers for Node.js — PostgreSQL module | docs | Throwaway Postgres; snapshot/restore between tests. | https://node.testcontainers.org/modules/postgresql/ |
| T57 | Vitest — Projects | docs | Split `unit` and `integration` suites in one config. | https://vitest.dev/guide/projects |
| T58 | Vitest — Mocking | docs | `vi.mock` is hoisted; restore mocks; no DI guidance of its own. | https://vitest.dev/guide/mocking |
| T59 | Ham Vocke — The Practical Test Pyramid (2018) | essay | Integration-test every serialization/deserialization point. | https://martinfowler.com/articles/practical-test-pyramid.html |
| T60 | Spotify — Testing of Microservices (honeycomb, 2018) | essay | Weight integration tests for service-shaped code. | https://engineering.atspotify.com/2018/01/testing-of-microservices |
| T61 | Kent C. Dodds — The Testing Trophy and Testing Classifications (2021) | essay | Typecheck as the static base layer; ROI framing. | https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications |
| T62 | Khalil Stemmler — Functional Error Handling (2019) | essay | Errors as domain concepts; map to HTTP in the controller. | https://khalilstemmler.com/articles/enterprise-typescript-nodejs/functional-error-handling/ |
| T63 | IETF — RFC 9457: Problem Details for HTTP APIs (2023) | standard | Machine-readable error bodies; no implementation details in responses. | https://www.rfc-editor.org/rfc/rfc9457.html |

## R. Reference repositories and enforcement tooling

Trees verified through the GitHub API on 2026-09-26.

| # | Repo / tool | Type | What it shows | URL |
|---|---|---|---|---|
| R1 | marcoturi/fastify-boilerplate (~465★, Fastify 5, raw SQL, awilix, dependency-cruiser) | repo | Per-module domain / commands / queries / database with a repository port; the closest Fastify 5 `.dependency-cruiser.cjs` (layer regexes, ports allowed, `$1` cross-module rule, `tsPreCompilationDeps`). CQRS buses are overkill here. | https://github.com/marcoturi/fastify-boilerplate |
| R2 | 256Taras/fastify-typescript-drizzle-starter-kit (Fastify 5 + Drizzle) | repo | "Lite" layering with Drizzle types as the contract; ambient-transaction gap (queries bypassing the tx accessor); depcruise rules that decayed after file renames. | https://github.com/256Taras/fastify-typescript-drizzle-starter-kit |
| R3 | JamieLivingstone/node-clean-architecture (~183★, Fastify, Prisma, zod, Vitest) | repo | Right-sized: hand-wired `makeDependencies()`, use cases as `(params, deps)`, adapter-private `toEntity`, Prisma P2002 → domain error, Vitest projects unit/integration. One inversion: use case type-imports the composition root. | https://github.com/JamieLivingstone/node-clean-architecture |
| R4 | Sairyss/domain-driven-hexagon (~15k★, NestJS) | repo | Canonical TS reference and depcruise template; its README marks separate persistence models and value objects as "overkill for smaller applications"; read side bypasses repositories. | https://github.com/Sairyss/domain-driven-hexagon |
| R5 | stemmlerjs/ddd-forum (~2k★, Express, Sequelize) | repo | Use-case folders, mappers, per-use-case composition; aggregate saves without a transaction. | https://github.com/stemmlerjs/ddd-forum |
| R6 | jbuget/nodejs-clean-architecture-app (~1.5k★, JS, hapi) | repo | Classic domain / application / interfaces / infrastructure; in-memory repository as a test double; service locator. | https://github.com/jbuget/nodejs-clean-architecture-app |
| R7 | zandrij/microservice-template (Fastify + Drizzle, 0★) | repo | Smallest Drizzle-behind-a-port example: `private toDomain(record: typeof items.$inferSelect)`. Not authoritative. | https://github.com/zandrij/microservice-template |
| R8 | dependency-cruiser — rules reference | docs | `forbidden`/`allowed`/`required`; regex `path`/`pathNot`; `$1` capture groups for sibling isolation; `circular`. | https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md |
| R9 | dependency-cruiser — options reference | docs | `tsPreCompilationDeps: true` needed to see `import type`; `tsConfig` for path aliases. | https://github.com/sverweij/dependency-cruiser/blob/main/doc/options-reference.md |
| R10 | eslint-plugin-boundaries | tool | Element types and allow policies for layered/hexagonal code; requires ESLint. | https://github.com/javierbrea/eslint-plugin-boundaries |
| R11 | JS Boundaries — policies docs | docs | Current `boundaries/dependencies` policy syntax. | https://www.jsboundaries.dev/docs/policies/ |
| R12 | Ken Miyashita — Validate Dependencies According to Clean Architecture | essay | dependency-cruiser clean-architecture walkthrough. **unverified** (403). | https://betterprogramming.pub/validate-dependencies-according-to-clean-architecture-743077ea084c |
| R13 | MrKeyoor — dependency-cruiser guide | essay | "Domain must not import infrastructure / npm packages" rules. **unverified**. | https://mrkeyoor.com/libs/dependency-cruiser/ |
| R14 | Stefanos Lignos — Three Ways to Enforce Module Boundaries in an Nx Monorepo | essay | Boundary enforcement options. **unverified**. | https://www.stefanos-lignos.dev/posts/nx-module-boundaries |

---

## Counts

| Section | Entries | Unverified / low weight |
|---|---|---|
| O Foundations | 15 | 0 |
| K Critique | 12 | 1 (K12); K10 second-hand |
| T Tools | 63 | 2 unverified (T22, T37); T19, T48 low weight; T51 landing page only |
| R Repos & tooling | 14 | 3 (R12, R13, R14) |
| **Total** | **104** | **6 unverified** |
