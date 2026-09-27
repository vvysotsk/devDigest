# onion-architecture — README

The agent loads `SKILL.md` only; this file is for people maintaining the skill.

## What it does

Tells the agent where backend code lives in `server/` and
`reviewer-core/` and which way imports may point: the ring map onto our
folders, import rules, per-tool rules (Fastify routes and response schemas,
zod contracts as domain types, Drizzle repositories and transactions, the
DI container, adapters, jobs and SSE), review checks, an advisory
dependency-cruiser run, and the triggers for heavier patterns. It fires when
the agent adds or changes a route, service, repository, adapter, job or port,
moves code between modules, touches reviewer-core's public API, or decides
whether a use case needs a transaction, a port, a response schema or a
separate type.

## How it works

The skill is a set of decisions for this repo, not a general style guide.
The agent uses it in four steps:

1. **Place.** The Map assigns each role (route, service, repository,
   adapter, port, job) to a ring and a folder. New code goes where the Map
   says.
2. **Write to the rules.** R1–R9: imports point inward, contracts are the
   domain types, routes are thin and have a response schema and a shape
   test, transactions belong to the use case, and wiring happens only in the
   container.
3. **Check.** Before it reports a change, the agent runs the 12 review
   checks. A kept exception gets a `Layers:` line in the report.
   `pnpm deps:check` (dependency-cruiser) shows only violations that are new
   against the baseline file, and that file may only shrink.
4. **Escalate, do not improvise.** When a trigger fires (for example, a use
   case writes two tables), the agent proposes the change to the user. The
   decision goes to `server/docs/architecture.md` → "Architecture
   decisions". A deferred trigger is not proposed again until its condition
   changes.

**In self-review.** The skill is blocking and covers `server/src/` and
`reviewer-core/src/`, but not tests. A broken must/never rule is CRITICAL.
A new entry in the baseline file is a mechanical CRITICAL in
`pr-self-review`.

## Version

**1.1.1** — see `metadata.version` in `SKILL.md` and the row in
`.claude/skills/README.md`.

When you change `SKILL.md`, bump the version and add a Changelog line:
- **patch** — wording, examples, pointers, baseline count (no rule changes);
- **minor** — a new rule, review check or trigger;
- **major** — a settled decision (R1–R9, a trigger's condition) is changed.

## Changelog

- **1.1.1 — 2026-09-27** — wording only, no rule changes, after `specs/refactor-onion.md` finished: Known violations lists the one remaining baseline entry (`repos/helpers.ts`, was 18); R2 no longer describes `pulls`/`polling` as deferred (they are layered); R4 and the triggers table record the `pulls`/`polling` transactions as done and name the executor's five writes as the next candidate.
- **1.1.0 — 2026-09-27** — R5: a port used by one module lives in that module's `types.ts`, ports shared across modules or with the client stay in `vendor/shared/adapters.ts`, adapters only implement ports; Map "Ports" row lists `modules/repo-intel/types.ts` (`RepoIntel`, `CodeParser`, `Tokenizer`, `DepGraph`), and the domain-core row gains `modules/_shared/{diff-parser,job-kinds}.ts` and `modules/repo-intel/extract.ts` (stage d of `specs/refactor-onion.md`).
- **1.0.1 — 2026-09-26** — metadata only, no rule changes: `applies_to` narrowed and fixed from a YAML list to a string: `server/src/**, reviewer-core/src/**, server/.dependency-cruiser.cjs`, tests excluded and `blocking: "true"`, read by `pr-self-review` for routing (comma-separated string, as Agent Skills metadata values are strings).
- **1.0.0 — 2026-09-26** — first version: rules R1–R9 (contracts as domain
  types, thin-module exception, response schema + shape test, use-case
  transactions with a `Db | Tx` executor, `Pick<Container, …>` for new
  services, thin adapters, `AppError` kept, jobs/SSE as infrastructure,
  reviewer-core as the core with the OpenRouter exception), 12 review
  checks, advisory `pnpm deps:check` that shows only violations missing
  from `server/.dependency-cruiser-known-violations.json` (18 known,
  refreshed with `pnpm deps:baseline`; type-only cycles excluded), 8
  triggers; `pulls`/`polling` recorded as fired-and-deferred in
  `server/docs/architecture.md` ("Architecture decisions").

## Sources used

Only the sources behind a rule, grouped by the rule they shaped. Format:
id — author, title — URL. The full catalogue (104 sources, including those
read but not behind a rule) is `references/sources.md`.

### Import rules — dependencies point inward, modules independent

- O1 — Jeffrey Palermo — The Onion Architecture: part 1 (2008) — https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/
- O2 — Jeffrey Palermo — The Onion Architecture: part 2 (2008) — https://jeffreypalermo.com/2008/07/the-onion-architecture-part-2/
- O5 — Alistair Cockburn — Hexagonal Architecture (2005) — https://alistair.cockburn.us/hexagonal-architecture/
- O6 — Robert C. Martin — The Clean Architecture (2012) — https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
- O8 — Herberto Graça — DDD, Hexagonal, Onion, Clean, CQRS… how I put it all together (2017) — https://herbertograca.com/2017/11/16/explicit-architecture-01-ddd-hexagonal-onion-clean-cqrs-how-i-put-it-all-together/
- O9 — Mark Seemann — Layers, Onions, Ports, Adapters: it's all the same (2013) — https://blog.ploeh.dk/2013/12/03/layers-onions-ports-adapters-its-all-the-same/
- O12 — Martin Fowler — PresentationDomainDataLayering (bliki) — https://martinfowler.com/bliki/PresentationDomainDataLayering.html
- O15 — Matteo Collina — Building a modular monolith with Fastify (talk) — https://gitnation.com/contents/building-a-modular-monolith-with-fastify
- K10 — tbuss — How to do the package structure in a Ports and Adapters architecture (2023) — https://tbuss.de/posts/2023/9-how-to-do-the-package-structure-in-a-ports-and-adapter-architecture/
- T33 — Mark Seemann — Composition Root (2011) — https://blog.ploeh.dk/2011/07/28/CompositionRoot/
- R1 — marcoturi/fastify-boilerplate (~465★, Fastify 5, raw SQL, awilix, dependency-cruiser) — https://github.com/marcoturi/fastify-boilerplate
- R8 — dependency-cruiser — rules reference — https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md

### R1 — contracts are the domain types; rows stay in the repository

- O6 — Robert C. Martin — The Clean Architecture (2012) — https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
- T15 — Alexis King — Parse, don't validate (2019) — https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/
- T16 — Zod — Basics — https://zod.dev/basics
- T17 — Matt Pocock — When should you use Zod? — https://www.totaltypescript.com/when-should-you-use-zod
- T18 — zod issue #813 — How to use zod in a clean architecture setup? (2021) — https://github.com/colinhacks/zod/issues/813
- T19 — zod discussion #5576 — Zod type or TS types (2025) — https://github.com/colinhacks/zod/discussions/5576
- T24 — Drizzle — Type inference (Goodies) — https://orm.drizzle.team/docs/goodies
- T32 — Khalil Stemmler — Entities (TypeScript DDD, 2019) — https://khalilstemmler.com/articles/typescript-domain-driven-design/entities/
- R4 — Sairyss/domain-driven-hexagon (~15k★, NestJS) — https://github.com/Sairyss/domain-driven-hexagon
- R7 — zandrij/microservice-template (Fastify + Drizzle, 0★) — https://github.com/zandrij/microservice-template
- K3 — Oren Eini (Ayende) — Repository is the new Singleton (2009) — https://ayende.com/blog/3955/repository-is-the-new-singleton
- K5 — Jon P Smith — Is the repository pattern useful with Entity Framework Core? — https://www.thereformedprogrammer.net/is-the-repository-pattern-useful-with-entity-framework-core/

### R2 — thin routes; Drizzle in routes only for the listed exception

- O1 — Jeffrey Palermo — The Onion Architecture: part 1 (2008) — https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/
- O6 — Robert C. Martin — The Clean Architecture (2012) — https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
- O13 — Khalil Stemmler — Organizing App Logic with the Clean Architecture — https://khalilstemmler.com/articles/software-design-architecture/organizing-app-logic/
- T10 — Fastify — Testing Guide — https://fastify.dev/docs/latest/Guides/Testing/
- T12 — Fastify — fastify-cli (README) — https://github.com/fastify/fastify-cli
- T30 — Percival & Gregory — Cosmic Python, ch. 2: Repository (2020) — https://www.cosmicpython.com/book/chapter_02_repository.html
- K1 — David Heinemeier Hansson — Test-induced design damage (2014) — https://dhh.dk/2014/test-induced-design-damage.html
- K2 — Jimmy Bogard — Vertical Slice Architecture (2018) — https://www.jimmybogard.com/vertical-slice-architecture/
- R3 — JamieLivingstone/node-clean-architecture (~183★, Fastify, Prisma, zod, Vitest) — https://github.com/JamieLivingstone/node-clean-architecture

### R3 — response schema + shape test

- T4 — Fastify — Validation and Serialization — https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/
- T5 — Fastify — Type Providers — https://fastify.dev/docs/latest/Reference/Type-Providers/
- T6 — turkerdev — fastify-type-provider-zod (README) — https://github.com/turkerdev/fastify-type-provider-zod
- T11 — Fastify — Recommendations — https://fastify.dev/docs/latest/Guides/Recommendations/
- T59 — Ham Vocke — The Practical Test Pyramid (2018) — https://martinfowler.com/articles/practical-test-pyramid.html

### R4 — transactions at the use case, `Db | Tx` executor, no UoW

- T23 — Drizzle — Transactions — https://orm.drizzle.team/docs/transactions
- T26 — Drizzle discussion #3271 — Correct TypeScript type for tx — https://github.com/drizzle-team/drizzle-orm/discussions/3271
- T27 — Drizzle discussion #2777 — Implicit Transaction Context — https://github.com/drizzle-team/drizzle-orm/discussions/2777
- T28 — Drizzle issue #2543 — unit of work — https://github.com/drizzle-team/drizzle-orm/issues/2543
- T31 — Percival & Gregory — Cosmic Python, ch. 6: Unit of Work (2020) — https://www.cosmicpython.com/book/chapter_06_uow.html
- R1 — marcoturi/fastify-boilerplate (~465★, Fastify 5, raw SQL, awilix, dependency-cruiser) — https://github.com/marcoturi/fastify-boilerplate
- R2 — 256Taras/fastify-typescript-drizzle-starter-kit (Fastify 5 + Drizzle) — https://github.com/256Taras/fastify-typescript-drizzle-starter-kit

### R5 — composition root, Pure DI, `Pick<Container, …>`

- T33 — Mark Seemann — Composition Root (2011) — https://blog.ploeh.dk/2011/07/28/CompositionRoot/
- T34 — Mark Seemann — Pure DI (2014) — https://blog.ploeh.dk/2014/06/10/pure-di/
- T35 — Mark Seemann — When to use a DI Container (2012) — https://blog.ploeh.dk/2012/11/06/WhentouseaDIContainer/
- O3 — Jeffrey Palermo — The Onion Architecture: part 3 (2008) — https://jeffreypalermo.com/2008/08/the-onion-architecture-part-3/
- O4 — Jeffrey Palermo — Onion Architecture: Part 4 – After Four Years (2013) — https://jeffreypalermo.com/2013/08/onion-architecture-part-4-after-four-years/
- K9 — Three Dots Labs (Smółka, Laszczak) — Is Clean Architecture Overengineering? (podcast) — https://threedots.tech/episode/is-clean-architecture-overengineering/
- R3 — JamieLivingstone/node-clean-architecture (~183★, Fastify, Prisma, zod, Vitest) — https://github.com/JamieLivingstone/node-clean-architecture

### R6 — thin adapters; fake our ports, not SDKs

- T41 — Google Testing Blog — Don't Mock Types You Don't Own (2020) — https://testing.googleblog.com/2020/07/testing-on-toilet-dont-mock-types-you.html
- T42 — Hynek Schlawack — "Don't Mock What You Don't Own" in 5 Minutes (2022) — https://hynek.me/articles/what-to-mock-in-5-mins/
- T43 — Martin Fowler — Contract Test (bliki) — https://martinfowler.com/bliki/ContractTest.html
- T44 — Martin Fowler — Mocks Aren't Stubs (2007) — https://martinfowler.com/articles/mocksArentStubs.html
- T45 — Vladimir Khorikov — When to Mock (2020) — https://enterprisecraftsmanship.com/posts/when-to-mock/
- T46 — Percival & Gregory — Cosmic Python, ch. 3: Coupling and Abstractions (2020) — https://www.cosmicpython.com/book/chapter_03_abstractions.html
- T47 — Vercel — AI SDK Core: Testing — https://ai-sdk.dev/docs/ai-sdk-core/testing
- T48 — Ideas-to-Life — LLM Provider Abstraction Boundary (2026) — https://ideas-to-life.ai/architecture/patterns/llm-provider-abstraction-boundary/

### R7 — errors mapped at the edge

- T7 — Fastify — Errors — https://fastify.dev/docs/latest/Reference/Errors/
- T8 — Fastify — @fastify/error — https://github.com/fastify/fastify-error
- T62 — Khalil Stemmler — Functional Error Handling (2019) — https://khalilstemmler.com/articles/enterprise-typescript-nodejs/functional-error-handling/
- T63 — IETF — RFC 9457: Problem Details for HTTP APIs (2023) — https://www.rfc-editor.org/rfc/rfc9457.html

### R8 — background work and SSE as infrastructure

- T49 — Sindre Sorhus — p-queue (README) — https://github.com/sindresorhus/p-queue
- T50 — Tim Jones — pg-boss (README) — https://github.com/timgit/pg-boss
- T52 — Chris Richardson — Pattern: Transactional Outbox — https://microservices.io/patterns/data/transactional-outbox.html
- T53 — Microsoft — Domain events: design and implementation — https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/domain-events-design-implementation
- T54 — Martin Fowler — What do you mean by "Event-Driven"? (2017) — https://martinfowler.com/articles/201701-event-driven.html
- T55 — mpetrunic — fastify-sse-v2 (README) — https://github.com/mpetrunic/fastify-sse-v2

### R9 — reviewer-core as the domain core

- O10 — Mark Seemann — Functional architecture is Ports and Adapters (2016) — https://blog.ploeh.dk/2016/03/18/functional-architecture-is-ports-and-adapters/
- O11 — Mark Seemann — Impureim sandwich (2020) — https://blog.ploeh.dk/2020/03/02/impureim-sandwich/
- O5 — Alistair Cockburn — Hexagonal Architecture (2005) — https://alistair.cockburn.us/hexagonal-architecture/
- T33 — Mark Seemann — Composition Root (2011) — https://blog.ploeh.dk/2011/07/28/CompositionRoot/

### Tests per ring

- T10 — Fastify — Testing Guide — https://fastify.dev/docs/latest/Guides/Testing/
- T45 — Vladimir Khorikov — When to Mock (2020) — https://enterprisecraftsmanship.com/posts/when-to-mock/
- T56 — Testcontainers for Node.js — PostgreSQL module — https://node.testcontainers.org/modules/postgresql/
- T57 — Vitest — Projects — https://vitest.dev/guide/projects
- T58 — Vitest — Mocking — https://vitest.dev/guide/mocking
- T59 — Ham Vocke — The Practical Test Pyramid (2018) — https://martinfowler.com/articles/practical-test-pyramid.html
- T60 — Spotify — Testing of Microservices (honeycomb, 2018) — https://engineering.atspotify.com/2018/01/testing-of-microservices

### Advisory check (dependency-cruiser)

- R8 — dependency-cruiser — rules reference — https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md
- R9 — dependency-cruiser — options reference — https://github.com/sverweij/dependency-cruiser/blob/main/doc/options-reference.md
- R1 — marcoturi/fastify-boilerplate (~465★, Fastify 5, raw SQL, awilix, dependency-cruiser) — https://github.com/marcoturi/fastify-boilerplate
- R2 — 256Taras/fastify-typescript-drizzle-starter-kit (Fastify 5 + Drizzle) — https://github.com/256Taras/fastify-typescript-drizzle-starter-kit
- R4 — Sairyss/domain-driven-hexagon (~15k★, NestJS) — https://github.com/Sairyss/domain-driven-hexagon
- R10 — eslint-plugin-boundaries — https://github.com/javierbrea/eslint-plugin-boundaries

### Why not full onion — limits the rules respect

- O1 — Jeffrey Palermo — The Onion Architecture: part 1 (2008) — https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/
- O13 — Khalil Stemmler — Organizing App Logic with the Clean Architecture — https://khalilstemmler.com/articles/software-design-architecture/organizing-app-logic/
- O14 — Alex Bespoyasov — Clean Architecture on Frontend (2021) — https://bespoyasov.me/blog/clean-architecture-on-frontend/
- K1 — David Heinemeier Hansson — Test-induced design damage (2014) — https://dhh.dk/2014/test-induced-design-damage.html
- K2 — Jimmy Bogard — Vertical Slice Architecture (2018) — https://www.jimmybogard.com/vertical-slice-architecture/
- K3 — Oren Eini (Ayende) — Repository is the new Singleton (2009) — https://ayende.com/blog/3955/repository-is-the-new-singleton
- K4 — Oren Eini (Ayende) — Architecting in the pit of doom: the evils of the repository abstraction layer (2011) — https://ayende.com/blog/4784/architecting-in-the-pit-of-doom-the-evils-of-the-repository-abstraction-layer
- K5 — Jon P Smith — Is the repository pattern useful with Entity Framework Core? — https://www.thereformedprogrammer.net/is-the-repository-pattern-useful-with-entity-framework-core/
- K6 — Mark Seemann — Interfaces are not abstractions (2010) — https://blog.ploeh.dk/2010/12/02/Interfacesarenotabstractions/
- K7 — Dan North — CUPID: for joyful coding (2022) — https://dannorth.net/blog/cupid-for-joyful-coding/
- K8 — James Hickey — Clean Architecture Disadvantages — https://www.jamesmichaelhickey.com/clean-architecture/
- K9 — Three Dots Labs (Smółka, Laszczak) — Is Clean Architecture Overengineering? (podcast) — https://threedots.tech/episode/is-clean-architecture-overengineering/
- K11 — Martin Fowler — Yagni (bliki) — https://martinfowler.com/bliki/Yagni.html

### Triggers

- T23 — Drizzle — Transactions — https://orm.drizzle.team/docs/transactions
- T26 — Drizzle discussion #3271 — Correct TypeScript type for tx — https://github.com/drizzle-team/drizzle-orm/discussions/3271
- K2 — Jimmy Bogard — Vertical Slice Architecture (2018) — https://www.jimmybogard.com/vertical-slice-architecture/
- T18 — zod issue #813 — How to use zod in a clean architecture setup? (2021) — https://github.com/colinhacks/zod/issues/813
- R4 — Sairyss/domain-driven-hexagon (~15k★, NestJS) — https://github.com/Sairyss/domain-driven-hexagon
- T49 — Sindre Sorhus — p-queue (README) — https://github.com/sindresorhus/p-queue
- T50 — Tim Jones — pg-boss (README) — https://github.com/timgit/pg-boss
- T52 — Chris Richardson — Pattern: Transactional Outbox — https://microservices.io/patterns/data/transactional-outbox.html
- O2 — Jeffrey Palermo — The Onion Architecture: part 2 (2008) — https://jeffreypalermo.com/2008/07/the-onion-architecture-part-2/
- O5 — Alistair Cockburn — Hexagonal Architecture (2005) — https://alistair.cockburn.us/hexagonal-architecture/
- K6 — Mark Seemann — Interfaces are not abstractions (2010) — https://blog.ploeh.dk/2010/12/02/Interfacesarenotabstractions/
- O8 — Herberto Graça — DDD, Hexagonal, Onion, Clean, CQRS… how I put it all together (2017) — https://herbertograca.com/2017/11/16/explicit-architecture-01-ddd-hexagonal-onion-clean-cqrs-how-i-put-it-all-together/
- R8 — dependency-cruiser — rules reference — https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md
- R9 — dependency-cruiser — options reference — https://github.com/sverweij/dependency-cruiser/blob/main/doc/options-reference.md

---

Full catalogue: `references/sources.md`. Findings and the inventory of the
code: `references/research.md`. The options behind each decision:
`references/plan.md`.
