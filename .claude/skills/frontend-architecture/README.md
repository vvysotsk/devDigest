# frontend-architecture — README

The agent loads `SKILL.md` only; this file is for people maintaining the skill.

## What it does

Tells the agent where frontend code lives in `client/` and how it is split:
the placement map, the `index.ts` component boundary, `helpers.ts` vs
`lib/<topic>.ts`, hooks by domain, Next.js route boundaries, API contract
types, review signals with thresholds, and the triggers that would change the
architecture. It fires when the agent creates, moves or splits a component,
hook, helper or constant in `client/`, adds a route, or has to decide where
code should live.

## How it works

The skill is a set of decisions for this repo, not a general style guide.
The agent uses it in four steps:

1. **Place.** The Map says where each kind of code lives: route-local
   `_components/`, shared `components/`, hooks by domain in `lib/hooks/`,
   helpers in `helpers.ts` or `lib/<topic>.ts`. The placement ladder:
   colocate first, promote on the second consumer.
2. **Write to the rules.** R1–R7: `index.ts` is a component boundary and
   never a layer barrel, pure helpers are named by scope, error boundaries
   sit at the root (and next to a nested layout), there is no Next.js
   server layer, and API types come only from the contract.
3. **Check signals.** Size and shape limits (lines, props, effects,
   nesting) are signals, not caps. A changed file that trips one gets a
   `Signals:` line in the report: kept with a reason, or split.
4. **Escalate, do not improvise.** When a trigger fires (for example, a
   domain spreads over several folders and routes), the agent proposes the
   change to the user. The decision goes to `client/docs/ui-architecture.md`
   → "Architecture decisions". A deferred trigger is not proposed again
   until its condition changes.

**In self-review.** The skill is blocking and covers `client/src/` and
`client/messages/`, but not the mirrored `vendor/`. A broken must/never rule
is CRITICAL. A signal is at most a SUGGESTION.

## Version

**2.0.0** — see `metadata.version` in `SKILL.md` and the row in
`.claude/skills/README.md`.

When you change `SKILL.md`, bump the version and add a Changelog line:
- **patch** — wording, examples, pointers (no rule changes);
- **minor** — a new rule, review signal or trigger;
- **major** — a settled decision (R1–R7, a trigger's condition) is changed.

## Changelog

- **2.0.0 — 2026-09-28** — the `features/` layer exists: R4 (was "No
  `features/` layer now") now places a grown domain's shared UI, hooks and
  pure functions in `src/features/<domain>/` (today `reviews`, `skills`);
  R2 extends the dependency direction to `lib/ → components/ → features/ →
  app/` (no feature imports another feature; `lib/` and `components/` import
  no feature); new Map row "Domain feature"; the Data hooks / Shared pure
  functions rows name the feature locations; the `features/<domain>/` trigger
  became a standing rule for the next domain (e.g. `agents`, `trace`)
  instead of an open decision. Major: a settled decision (R4, a trigger's
  outcome) changed; every client file is re-checked for this skill in the
  next self-review. Decision: `client/docs/ui-architecture.md`
  ("Architecture decisions", 2026-09-27/28), L02 Stage 9.

- **1.1.0 — 2026-09-27** — new Map row "Shared test factories":
  `src/test/fixtures.ts` holds one factory per contract type (`finding`,
  `pr`, `review`); tests pass overrides instead of copying the shape. Minor
  (a new placement rule); it re-checks every client file for this skill in
  the next self-review.
- **1.0.1 — 2026-09-26** — metadata only, no rule changes: `applies_to`: `client/src/**, client/messages/**, !client/src/vendor/**` and `blocking: "true"`, read by `pr-self-review` for routing (comma-separated string, as Agent Skills metadata values are strings).
- **1.0.0 — 2026-09-26** — first version: decisions R1–R7, review signals,
  architecture-change triggers, and the deferred `features/reviews/`
  trigger recorded in `client/docs/ui-architecture.md` ("Architecture
  decisions").

## Sources used

Only the sources the rules were built on, grouped by the rule they shaped.
Ids are the ones cited in the `references/research.md` sections that
`SKILL.md` points to (§1, §2, §3, §4, §6, §7.1, §7.3, §7.5, §7.8–7.9,
§7.12). Format: id — author, title — URL. Sources only read during the
research but not behind a rule are not listed here; the full catalogue is in
`references/sources.md`.

### R1 — `index.ts` as a component boundary, no layer barrels

- D18 — TkDodo (Dominik Dorfmeister), Please Stop Using Barrel Files — https://tkdodo.eu/blog/please-stop-using-barrel-files
- D35 — Marvin Hagemeister, The barrel file debacle — https://marvinh.dev/blog/speeding-up-javascript-ecosystem-part-7/
- D36 — Atlassian Engineering, 75 % faster builds by removing barrel files — https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files
- F15 — Vite, Performance ("Avoid barrel files") — https://vite.dev/guide/performance
- B10 — Vercel (Shu Ding), How we optimized package imports in Next.js — https://vercel.com/blog/how-we-optimized-package-imports-in-next-js
- C1 — bulletproof-react, Project Structure — https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
- C6 — Feature-Sliced Design, Public API — https://feature-sliced.design/docs/reference/public-api
- D37 — Maksym Kuzmitskyi, Barrel Files: The Import You Love and the Bundle You Hate — https://ma-x.im/blog/react-playbook-barrel-files
- E4 — Basarat, TypeScript Deep Dive: Barrel — https://basarat.gitbook.io/typescript/main-1/barrel
- E1 — Airbnb, Airbnb React/JSX Style Guide — https://github.com/airbnb/javascript/tree/master/react
- D20 — Josh W. Comeau, Delightful React File/Directory Structure — https://www.joshwcomeau.com/react/file-structure/
- D22 — Robin Wieruch, React Folder Structure in 5 Steps — https://www.robinwieruch.de/react-folder-structure/
- A3 — react.dev, Importing and Exporting Components — https://react.dev/learn/importing-and-exporting-components
- B4 — Next.js docs, Fast Refresh — https://nextjs.org/docs/architecture/fast-refresh
- B5 — Next.js docs, `page.js` file convention — https://nextjs.org/docs/app/api-reference/file-conventions/page
- F26 — eslint-plugin-react-refresh — https://github.com/ArnaudBarre/eslint-plugin-react-refresh
- E3 — Google, Google TypeScript Style Guide — https://google.github.io/styleguide/tsguide.html
- D34 — Nicholas C. Zakas, Why I've stopped exporting defaults — https://humanwhocodes.com/blog/2019/01/stop-using-default-exports-javascript-module/
- E6 — Basarat, TypeScript Deep Dive: Avoid Export Default — https://basarat.gitbook.io/typescript/main-1/defaultisbad
- F19 — eslint-plugin-import, `no-default-export` — https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-default-export.md

### R2 — placement ladder, colocation, dependency direction

- D1 — Kent C. Dodds, Colocation — https://kentcdodds.com/blog/colocation
- C2 — bulletproof-react, Components and Styling — https://github.com/alan2207/bulletproof-react/blob/master/docs/components-and-styling.md
- D20 — Josh W. Comeau, Delightful React File/Directory Structure — https://www.joshwcomeau.com/react/file-structure/
- D22 — Robin Wieruch, React Folder Structure in 5 Steps — https://www.robinwieruch.de/react-folder-structure/
- D28 — Kyle Cook, How To Structure React Projects From Beginner To Advanced — https://blog.webdevsimplified.com/2022-07/react-folder-structure/
- A14 — legacy.reactjs.org, File Structure FAQ (legacy) — https://legacy.reactjs.org/docs/faq-structure.html
- A18 — Dan Abramov, "Scalable file structure" — https://react-file-structure.surge.sh/
- B1 — Next.js docs, Project structure and organization — https://nextjs.org/docs/app/getting-started/project-structure
- D2 — Kent C. Dodds, AHA Programming — https://kentcdodds.com/blog/aha-programming
- D30 — Sandi Metz, The Wrong Abstraction — https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction
- D45 — Wikipedia, Rule of three (computer programming) — https://en.wikipedia.org/wiki/Rule_of_three_(computer_programming)
- C1 — bulletproof-react, Project Structure — https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
- C4 — Feature-Sliced Design, Overview — https://feature-sliced.design/docs/get-started/overview
- D24 — Nadia Makarevich, React project structure for scale — https://www.developerway.com/posts/react-project-structure
- D27 — Johannes Kettmann, Screaming Architecture (dev.to mirror) — https://dev.to/profydev/screaming-architecture-evolution-of-a-react-folder-structure-4g25 *(original profy.dev URL unverified; dev.to mirror verified)*
- A11 — react.dev, Removing Effect Dependencies — https://react.dev/learn/removing-effect-dependencies
- A12 — react.dev, React Compiler: Introduction — https://react.dev/learn/react-compiler/introduction
- F6 — next-intl, Messages — https://next-intl.dev/docs/usage/messages
- F10 — i18next, Best Practices — https://www.i18next.com/principles/best-practices

### R3 — `helpers.ts` local, `lib/<topic>.ts` shared, no junk drawer

- D20 — Josh W. Comeau, Delightful React File/Directory Structure — https://www.joshwcomeau.com/react/file-structure/
- D40 — Indie Starter, Lib vs Utils vs Services Folders — https://indie-starter.dev/blog/lib-vs-utils-vs-services-folders-simple-explanation-for-developers
- D46 — Stephen Charles Weiss, utils vs helpers — https://stephencharlesweiss.com/utils-vs-helpers/ *(unverified)*
- C1 — bulletproof-react, Project Structure — https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
- C14 — shadcn/ui, Manual installation — https://ui.shadcn.com/docs/installation/manual
- C5 — Feature-Sliced Design, Layers — https://feature-sliced.design/docs/reference/layers
- C8 — Feature-Sliced Design, Migration from a custom architecture — https://feature-sliced.design/docs/guides/migration/from-custom
- C11 — Steiger, `segments-by-purpose` rule — https://github.com/feature-sliced/steiger/blob/master/packages/steiger-plugin-fsd/src/segments-by-purpose/README.md
- D42 — Matti Lehtinen, Dunghill Anti-Pattern — https://mattilehtinen.com/articles/dunghill-anti-pattern-why-utility-classes-and-modules-smell/
- D41 — Ndeye Fatou Diop, 29 React Codebase Red Flags — https://dev.to/_ndeyefatoudiop/29-react-codebase-red-flags-from-a-senior-frontend-developer-5013
- D23 — Alex Kondov, Tao of React — https://alexkondov.com/tao-of-react/
- A13 — react.dev, Components and Hooks must be pure — https://react.dev/reference/rules/components-and-hooks-must-be-pure
- A5 — react.dev, Keeping Components Pure — https://react.dev/learn/keeping-components-pure
- A8 — react.dev, Reusing Logic with Custom Hooks — https://react.dev/learn/reusing-logic-with-custom-hooks
- D11 — Kent C. Dodds, Write tests. Not too many. Mostly integration. — https://kentcdodds.com/blog/write-tests
- D12 — Kent C. Dodds, The Testing Trophy and Testing Classifications — https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications
- C3 — bulletproof-react, Project Standards — https://github.com/alan2207/bulletproof-react/blob/master/docs/project-standards.md
- B11 — vercel/commerce, `components/` — https://github.com/vercel/commerce/tree/main/components

### R4 — `_components/` per route, `components/` shared, no `features/` yet

- B1 — Next.js docs, Project structure and organization — https://nextjs.org/docs/app/getting-started/project-structure
- H33 — Next.js, Client-side data fetching with TanStack Query — https://nextjs.org/docs/app/guides/client-side-data-fetching/tanstack-query
- H34 — vercel-labs/next-spa-patterns — https://github.com/vercel-labs/next-spa-patterns
- H36 — vercel/ai-chatbot — https://github.com/vercel/ai-chatbot
- H37 — vercel/next-app-router-playground — https://github.com/vercel/next-app-router-playground
- H38 — vercel/platforms — https://github.com/vercel/platforms
- B11 — vercel/commerce, `components/` — https://github.com/vercel/commerce/tree/main/components
- C13 — shadcn/ui, `components.json` — https://ui.shadcn.com/docs/components-json
- C1 — bulletproof-react, Project Structure — https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
- D22 — Robin Wieruch, React Folder Structure in 5 Steps — https://www.robinwieruch.de/react-folder-structure/
- D23 — Alex Kondov, Tao of React — https://alexkondov.com/tao-of-react/
- H40 — calcom/cal.com — https://github.com/calcom/cal.com
- H41 — create-t3-app, Folder Structure (App Router) — https://create.t3.gg/en/folder-structure-app
- H42 — pipipi-dev, App Router Directory Design — https://dev.to/pipipi-dev/app-router-directory-design-nextjs-project-structure-patterns-31eo

### R5 — root `error.tsx` / `not-found.tsx`, segment boundaries only with a layout

- H1 — Next.js, Layouts and Pages — https://nextjs.org/docs/app/getting-started/layouts-and-pages
- H2 — Next.js, `layout.js` reference — https://nextjs.org/docs/app/api-reference/file-conventions/layout
- H4 — Next.js, Linking and Navigating — https://nextjs.org/docs/app/getting-started/linking-and-navigating
- H5 — Next.js, Route Groups — https://nextjs.org/docs/app/api-reference/file-conventions/route-groups
- H6 — Next.js, `not-found.js` / `global-not-found.js` — https://nextjs.org/docs/app/api-reference/file-conventions/not-found
- H13 — Discussion #50034, Multiple root layouts and root not-found — https://github.com/vercel/next.js/discussions/50034
- H14 — Next.js, `loading.js` reference — https://nextjs.org/docs/app/api-reference/file-conventions/loading
- H15 — Next.js, Error Handling — https://nextjs.org/docs/app/getting-started/error-handling
- H16 — Next.js, `error.js` reference — https://nextjs.org/docs/app/api-reference/file-conventions/error
- H35 — shadcn-ui/taxonomy — https://github.com/shadcn-ui/taxonomy
- B11 — vercel/commerce, `components/` — https://github.com/vercel/commerce/tree/main/components

### R6 — no Next.js server layer (what the guard excludes)

- G43 — Next.js, How to think about data security — https://nextjs.org/docs/app/guides/data-security
- G46 — Next.js, Authentication (DAL section) — https://nextjs.org/docs/app/guides/authentication
- H23 — Next.js, Proxy (getting started) — https://nextjs.org/docs/app/getting-started/proxy
- H24 — Next.js, `proxy.js` reference — https://nextjs.org/docs/app/api-reference/file-conventions/proxy
- H25 — Vercel, Postmortem on Next.js Middleware bypass (CVE-2025-29927) — https://vercel.com/blog/postmortem-on-next-js-middleware-bypass
- H43 — Next.js, Mutating Data — https://nextjs.org/docs/app/getting-started/mutating-data
- H44 — Next.js, How to create forms with Server Actions — https://nextjs.org/docs/app/guides/forms
- H45 — react.dev, `useActionState` — https://react.dev/reference/react/useActionState
- H49 — next-safe-action, Action result — https://next-safe-action.dev/docs/concepts/action-result
- H52 — leerob/next-saas-starter, `lib/auth/middleware.ts` — https://github.com/leerob/next-saas-starter/blob/main/lib/auth/middleware.ts
- H53 — leerob/next-saas-starter, `app/(login)/actions.ts` — https://github.com/leerob/next-saas-starter/blob/main/app/(login)/actions.ts
- H54 — vercel/ai-chatbot, `app/(chat)/actions.ts` — https://github.com/vercel/ai-chatbot/blob/main/app/(chat)/actions.ts
- H55 — vercel/ai-chatbot, `lib/db/queries.ts` — https://github.com/vercel/ai-chatbot/blob/main/lib/db/queries.ts
- H59 — Next.js, Caching (Cache Components) — https://nextjs.org/docs/app/getting-started/caching
- H60 — Next.js, `use cache` directive — https://nextjs.org/docs/app/api-reference/directives/use-cache
- H61 — Next.js, Revalidating — https://nextjs.org/docs/app/getting-started/revalidating
- H63 — Next.js, Caching and Revalidating (Previous Model) — https://nextjs.org/docs/app/guides/caching-without-cache-components
- H65 — Next.js 15 release post — https://nextjs.org/blog/next-15
- H66 — Next.js 16 release post — https://nextjs.org/blog/next-16

### R7 — API types only from the contract

- F11 — Zod, Basic usage — https://zod.dev/basics
- D33 — Alexis King, Parse, don't validate — https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/
- D32 — Matt Pocock, Where to put your types in application code — https://www.totaltypescript.com/where-to-put-your-types-in-application-code
- H78 — Turborepo, Internal packages — https://turborepo.dev/docs/core-concepts/internal-packages
- H82 — Serghei, Where Your Types Live Matters (Pocock's rules secondhand) — https://blog.serghei.pl/posts/where-your-types-live-matters/
- H79 — openapi-typescript, Introduction — https://openapi-ts.dev/introduction
- H80 — openapi-fetch — https://openapi-ts.dev/openapi-fetch/
- H81 — orval — https://orval.dev/ *(docs page `/overview` unverified (404))*
- H76 — tRPC, Docs intro — https://trpc.io/docs
- H77 — tRPC, Concepts — https://trpc.io/docs/concepts
- H49 — next-safe-action, Action result — https://next-safe-action.dev/docs/concepts/action-result

### Review signals (thresholds as signals, not caps)

- D23 — Alex Kondov, Tao of React — https://alexkondov.com/tao-of-react/
- D25 — Nadia Makarevich, Components composition: how to get it right — https://www.developerway.com/posts/components-composition-how-to-get-it-right
- D44 — Medium, How Many Lines of Code Until I Need to Refactor — https://medium.com/geekculture/how-many-lines-of-code-until-i-need-to-refactor-a-react-component-c1b8d16f5a5b *(unverified)*
- D3 — Kent C. Dodds, When to break up a component into multiple components — https://kentcdodds.com/blog/when-to-break-up-a-component-into-multiple-components
- A15 — legacy.reactjs.org, Building Your Own Hooks (legacy) — https://legacy.reactjs.org/docs/hooks-custom.html
- D43 — 137Foundry, When to Split a React Component — https://dev.to/137foundry/when-to-split-a-react-component-and-when-youre-over-engineering-2a6e
- A1 — react.dev, Thinking in React — https://react.dev/learn/thinking-in-react
- D2 — Kent C. Dodds, AHA Programming — https://kentcdodds.com/blog/aha-programming
- D30 — Sandi Metz, The Wrong Abstraction — https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction
- D45 — Wikipedia, Rule of three (computer programming) — https://en.wikipedia.org/wiki/Rule_of_three_(computer_programming)
- A14 — legacy.reactjs.org, File Structure FAQ (legacy) — https://legacy.reactjs.org/docs/faq-structure.html
- D24 — Nadia Makarevich, React project structure for scale — https://www.developerway.com/posts/react-project-structure
- A8 — react.dev, Reusing Logic with Custom Hooks — https://react.dev/learn/reusing-logic-with-custom-hooks
- D15 — Dan Abramov, Presentational and Container Components (2015, note 2019) — https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0
- C23 — patterns.dev, Container/Presentational — https://www.patterns.dev/react/presentational-container-pattern/

### Triggers — `features/<domain>/`

- C1 — bulletproof-react, Project Structure — https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
- C4 — Feature-Sliced Design, Overview — https://feature-sliced.design/docs/get-started/overview
- D22 — Robin Wieruch, React Folder Structure in 5 Steps — https://www.robinwieruch.de/react-folder-structure/
- D24 — Nadia Makarevich, React project structure for scale — https://www.developerway.com/posts/react-project-structure
- D27 — Johannes Kettmann, Screaming Architecture (dev.to mirror) — https://dev.to/profydev/screaming-architecture-evolution-of-a-react-folder-structure-4g25 *(original profy.dev URL unverified; dev.to mirror verified)*
- D28 — Kyle Cook, How To Structure React Projects From Beginner To Advanced — https://blog.webdevsimplified.com/2022-07/react-folder-structure/
- C9 — Feature-Sliced Design, Mastering ESLint config — https://feature-sliced.design/blog/mastering-eslint-config
- D29 — Sandro Roth, How to structure your React projects — https://sandroroth.com/blog/project-structure/

### Triggers — Next.js server layer

- G43 — Next.js, How to think about data security — https://nextjs.org/docs/app/guides/data-security
- H43 — Next.js, Mutating Data — https://nextjs.org/docs/app/getting-started/mutating-data
- H59 — Next.js, Caching (Cache Components) — https://nextjs.org/docs/app/getting-started/caching
- H23 — Next.js, Proxy (getting started) — https://nextjs.org/docs/app/getting-started/proxy
- H25 — Vercel, Postmortem on Next.js Middleware bypass (CVE-2025-29927) — https://vercel.com/blog/postmortem-on-next-js-middleware-bypass

### Triggers — OpenAPI instead of the contract copy

- H78 — Turborepo, Internal packages — https://turborepo.dev/docs/core-concepts/internal-packages
- H79 — openapi-typescript, Introduction — https://openapi-ts.dev/introduction
- H80 — openapi-fetch — https://openapi-ts.dev/openapi-fetch/
- H81 — orval — https://orval.dev/ *(docs page `/overview` unverified (404))*

### Triggers — segment `error.tsx`

- H2 — Next.js, `layout.js` reference — https://nextjs.org/docs/app/api-reference/file-conventions/layout
- H15 — Next.js, Error Handling — https://nextjs.org/docs/app/getting-started/error-handling
- H16 — Next.js, `error.js` reference — https://nextjs.org/docs/app/api-reference/file-conventions/error

---

Full catalogue (275 sources): `references/sources.md`. Findings, consensus
vs contested, and the fit with this client: `references/research.md`.
