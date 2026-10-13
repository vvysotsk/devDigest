# frontend-architecture — source catalogue

Research date: 2026-09-26. Every URL below was fetched and read during the
research unless marked **unverified** (fetch failed) or **thin** (page loaded
but held nothing quotable). This file is the raw material for the future
skill's `README.md` / `references.md`; keep it in sync when sources are added
or dropped. The findings distilled from these sources live in `research.md`.

Legend for the "type" column: docs = official documentation · repo = source
repository or its docs · guide = style guide · essay = blog post or article ·
book · tool = tool README/docs.

---

## A. React — official docs (react.dev, legacy.reactjs.org)

| # | Title | Type | Why it matters | URL |
|---|---|---|---|---|
| A1 | Thinking in React | docs | Canonical decomposition procedure: single responsibility, component ≈ one piece of the data model, where state lives. Gives no folder or size rules. | https://react.dev/learn/thinking-in-react |
| A2 | Your First Component | docs | Component names start with a capital; never nest component definitions. | https://react.dev/learn/your-first-component |
| A3 | Importing and Exporting Components | docs | Default vs named exports are a team choice; anonymous default exports discouraged; several components per file allowed. | https://react.dev/learn/importing-and-exporting-components |
| A4 | Passing Props to a Component | docs | `children` as the composition "hole"; wrappers (panels, grids) use it. | https://react.dev/learn/passing-props-to-a-component |
| A5 | Keeping Components Pure | docs | Purity is what makes extracted components/hooks safe to compose; side effects belong in handlers. | https://react.dev/learn/keeping-components-pure |
| A6 | Extracting State Logic into a Reducer | docs | Reducer = pure, exportable, testable update logic separated from the component. | https://react.dev/learn/extracting-state-logic-into-a-reducer |
| A7 | Scaling Up with Reducer and Context | docs | Provider file (reducer + contexts + `useX()` hooks) as the modern replacement for containers. | https://react.dev/learn/scaling-up-with-reducer-and-context |
| A8 | Reusing Logic with Custom Hooks | docs | Hook only if it calls hooks; no `use` prefix otherwise; no lifecycle hooks; some duplication is fine. | https://react.dev/learn/reusing-logic-with-custom-hooks |
| A9 | Passing Data Deeply with Context | docs | "Before you use context": pass props, extract components and pass JSX as `children` first. | https://react.dev/learn/passing-data-deeply-with-context |
| A10 | Sharing State Between Components | docs | Lifting state to the closest common parent; single source of truth per piece of state. | https://react.dev/learn/sharing-state-between-components |
| A11 | Removing Effect Dependencies | docs | Static objects/functions go to module scope so they are not reactive. | https://react.dev/learn/removing-effect-dependencies |
| A12 | React Compiler: Introduction | docs | Compiler memoizes inside components; does not replace hoisting truly static data. | https://react.dev/learn/react-compiler/introduction |
| A13 | Components and Hooks must be pure | docs | Definition of "pure" used by the extraction criteria. | https://react.dev/reference/rules/components-and-hooks-must-be-pure |
| A14 | File Structure FAQ (legacy) | docs | "React doesn't have opinions"; max 3–4 nested folders; don't spend more than five minutes choosing. | https://legacy.reactjs.org/docs/faq-structure.html |
| A15 | Building Your Own Hooks (legacy) | docs | "Resist adding abstraction too early"; longer function components are normal. | https://legacy.reactjs.org/docs/hooks-custom.html |
| A16 | Hooks FAQ (legacy) | docs | Hooks replace render props / HOCs for single-child logic sharing; split state by what changes together. | https://legacy.reactjs.org/docs/hooks-faq.html |
| A17 | Composition vs Inheritance (legacy) | docs | Containment (`children`, multiple slots) and specialization; no inheritance hierarchies. | https://legacy.reactjs.org/docs/composition-vs-inheritance.html |
| A18 | Dan Abramov — "Scalable file structure" | essay | "Move files around until it feels right" — the React core anti-prescription. | https://react-file-structure.surge.sh/ |

## B. Next.js / Vercel

| # | Title | Type | Why it matters | URL |
|---|---|---|---|---|
| B1 | Project structure and organization | docs | Unopinionated; colocation inside `app/` is safe; `_private` folders; `(groups)`; three sanctioned strategies. | https://nextjs.org/docs/app/getting-started/project-structure |
| B2 | Server and Client Components | docs | Push `'use client'` to interactive leaves; slots via `children`; providers as client wrappers. | https://nextjs.org/docs/app/getting-started/server-and-client-components |
| B3 | The Server and Client Boundary | docs | Code crosses via imports, data via serializable props; compound static members break at the boundary → named exports. | https://nextjs.org/docs/app/guides/server-and-client-boundary |
| B4 | Fast Refresh | docs | Files should export only components; anonymous defaults lose state; import paths are case-sensitive. | https://nextjs.org/docs/architecture/fast-refresh |
| B5 | `page.js` file convention | docs | The one place default exports are mandatory (also layout/loading/error). | https://nextjs.org/docs/app/api-reference/file-conventions/page |
| B6 | TypeScript config (path aliases) | docs | `@/*` via `paths`; `tsc --noEmit` in CI. | https://nextjs.org/docs/app/api-reference/config/typescript |
| B7 | Testing with Vitest | docs | `__tests__` convention or colocated in `app/`; async Server Components need e2e. | https://nextjs.org/docs/app/guides/testing/vitest |
| B8 | `with-vitest` example | repo | Concrete colocated test layout. | https://github.com/vercel/next.js/tree/canary/examples/with-vitest |
| B9 | `optimizePackageImports` | docs | Framework-level admission that barrel files cost; targets third-party packages only. | https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports |
| B10 | How we optimized package imports in Next.js | essay | Measured cost of barrels: 2,225 modules for one `@mui/material` import; 200–800 ms per package. | https://vercel.com/blog/how-we-optimized-package-imports-in-next-js |
| B11 | vercel/commerce — `components/` | repo | Vercel house style evidence: kebab-case files, folders by domain, no barrels. | https://github.com/vercel/commerce/tree/main/components |
| B12 | vercel/ai-chatbot — `components/` | repo | Same convention plus shadcn `ui/` subfolder. | https://github.com/vercel/ai-chatbot/tree/main/components |

## C. Reference architectures and methodologies

| # | Title | Type | Why it matters | URL |
|---|---|---|---|---|
| C1 | bulletproof-react — Project Structure | repo | `app/components/config/features/hooks/lib/stores/types/utils`; shared → features → app; no cross-feature imports; now recommends direct imports over `index.ts`. | https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md |
| C2 | bulletproof-react — Components and Styling | repo | Colocate; extract render helpers into components; too many props → split or compose. | https://github.com/alan2207/bulletproof-react/blob/master/docs/components-and-styling.md |
| C3 | bulletproof-react — Project Standards | repo | Absolute imports; kebab-case enforced with `eslint-plugin-check-file`. | https://github.com/alan2207/bulletproof-react/blob/master/docs/project-standards.md |
| C4 | Feature-Sliced Design — Overview | docs | Layers App/Pages/Widgets/Features/Entities/Shared; slices; segments `ui/api/model/lib/config`. | https://feature-sliced.design/docs/get-started/overview |
| C5 | Feature-Sliced Design — Layers | docs | Import only from layers strictly below; `shared/lib` ≠ utils dump; `shared/config` for constants/env. | https://feature-sliced.design/docs/reference/layers |
| C6 | Feature-Sliced Design — Public API | docs | Index file as a contract; documented barrel costs (cycles, tree-shaking, dev server). | https://feature-sliced.design/docs/reference/public-api |
| C7 | Feature-Sliced Design — Usage with Next.js | docs | Keep `app/` at root; `src/_app`, `src/_pages`; `index.server.ts` for server-only exports. | https://feature-sliced.design/docs/guides/tech/with-nextjs |
| C8 | Feature-Sliced Design — Migration from a custom architecture | docs | Where legacy `utils/`, `constants/`, `types/` go (group by purpose). | https://feature-sliced.design/docs/guides/migration/from-custom |
| C9 | Feature-Sliced Design — Mastering ESLint config | essay | `no-restricted-imports` patterns that enforce layers and public APIs. | https://feature-sliced.design/blog/mastering-eslint-config |
| C10 | Steiger — FSD linter | tool | `fsd/forbidden-imports`, `fsd/public-api`, `fsd/no-public-api-sidestep`, `fsd/excessive-slicing`. | https://github.com/feature-sliced/steiger |
| C11 | Steiger — `segments-by-purpose` rule | tool | Bans `utils`, `helpers`, `constants`, `types`, `hooks`, `services` as folder names. | https://github.com/feature-sliced/steiger/blob/master/packages/steiger-plugin-fsd/src/segments-by-purpose/README.md |
| C12 | shadcn/ui — Introduction | docs | "Not a component library; how you build yours" — small composable parts you own. | https://ui.shadcn.com/docs |
| C13 | shadcn/ui — `components.json` | docs | Default aliases `components`, `components/ui`, `lib`, `lib/utils`, `hooks`; kebab-case flat files, no barrels. | https://ui.shadcn.com/docs/components-json |
| C14 | shadcn/ui — Manual installation | docs | `lib/utils.ts` as the single re-export point for `cn()`. | https://ui.shadcn.com/docs/installation/manual |
| C15 | shadcn/ui — Button | docs | `cva` variants + `cn` + `React.ComponentProps`; named exports. | https://ui.shadcn.com/docs/components/button |
| C16 | shadcn/ui — Tailwind v4 | docs | `@theme inline`, no `forwardRef`, `data-slot` attributes. | https://ui.shadcn.com/docs/tailwind-v4 |
| C17 | Radix Primitives — Introduction | docs | Headless compound components; `asChild`; controlled/uncontrolled. | https://www.radix-ui.com/primitives/docs/overview/introduction |
| C18 | Brad Frost — Atomic Web Design | essay | Origin of atoms/molecules/organisms; a design-system model, not a folder spec. | https://bradfrost.com/blog/post/atomic-web-design/ |
| C19 | Brad Frost — Atomic Design, ch. 2 | book | "Not rigid dogma"; levels may be renamed. | https://atomicdesign.bradfrost.com/chapter-2/ |
| C20 | Sparkbox — Iterating on Atomic Design | essay | Atom/molecule boundaries "too fuzzy"; prefers a flat hierarchy. | https://sparkbox.com/foundry/iterating_on_atomic_design |
| C21 | Jay Freestone — Perils of Atomic Design | essay | Components designed in isolation fail to compose. | https://www.jayfreestone.com/writing/perils-of-atomic-design/ |
| C22 | Dennis Reimann — Atomic Design is messy | essay | Anti-taxonomy critique. **unverified** (DNS failure). | https://dennisreimann.de/articles/atomic-design-is-messy.html |
| C23 | patterns.dev — Container/Presentational | docs | Pattern "can be replaced with React Hooks"; overkill for small apps. | https://www.patterns.dev/react/presentational-container-pattern/ |
| C24 | Juntao Qiu (martinfowler.com) — Headless Component | essay | Logic/state in a hook, UI free; indirection cost acknowledged. | https://martinfowler.com/articles/headless-component.html |

## D. Essays by well-known authors

### Kent C. Dodds

| # | Title | Why it matters | URL |
|---|---|---|---|
| D1 | Colocation | "Place code as close to where it's relevant as possible"; shared `utils/` become forgotten. | https://kentcdodds.com/blog/colocation |
| D2 | AHA Programming | Avoid Hasty Abstractions; duplicate twice, never three times. | https://kentcdodds.com/blog/aha-programming |
| D3 | When to break up a component into multiple components | Split when you feel a listed pain, "NOT BEFORE". | https://kentcdodds.com/blog/when-to-break-up-a-component-into-multiple-components |
| D4 | Prop Drilling | Drilling can be fine; "unnecessary component breakdowns" cause it. | https://kentcdodds.com/blog/prop-drilling |
| D5 | State Colocation will make your React app faster | State stays in its user or the closest common parent. | https://kentcdodds.com/blog/state-colocation-will-make-your-react-app-faster |
| D6 | Inversion of Control | "Apropcalypse": boolean flags explode; make the abstraction do less. | https://kentcdodds.com/blog/inversion-of-control |
| D7 | When to useMemo and useCallback | Optimizations always cost; split first, memo later. | https://kentcdodds.com/blog/usememo-and-usecallback |
| D8 | Compound Components with React Hooks | Implicit state via context; the pattern behind Radix/shadcn. | https://kentcdodds.com/blog/compound-components-with-react-hooks |
| D9 | The State Reducer Pattern with React Hooks | Hooks beat render props for headless logic. | https://kentcdodds.com/blog/the-state-reducer-pattern-with-react-hooks |
| D10 | One React mistake that's slowing you down | Layout components accept JSX; structural vs stateful split. | https://www.epicreact.dev/one-react-mistake-thats-slowing-you-down |
| D11 | Write tests. Not too many. Mostly integration. | Testing Trophy: pure helpers are the natural unit. | https://kentcdodds.com/blog/write-tests |
| D12 | The Testing Trophy and Testing Classifications | Definitions of unit vs integration. | https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications |
| D13 | How to know what to test | Test use cases, not code; coverage past ~70 % has diminishing returns. | https://kentcdodds.com/blog/how-to-know-what-to-test |
| D14 | How I structure Express apps | Evidence of colocated `__tests__/` folders. | https://kentcdodds.com/blog/how-i-structure-express-apps |

### Dan Abramov

| # | Title | Why it matters | URL |
|---|---|---|---|
| D15 | Presentational and Container Components (2015, note 2019) | The pattern and its retraction: "I don't suggest splitting your components like this anymore." Origin 403s to fetchers; verified via https://readmedium.com/smart-and-dumb-components-7ca2f9a7c7d0 | https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0 |
| D16 | Before You memo() | "Move State Down" and "Lift Content Up". | https://overreacted.io/before-you-memo/ |
| D17 | Impossible Components | Split along the server/client boundary inside one composable unit. | https://overreacted.io/impossible-components/ |

### TkDodo (Dominik Dorfmeister)

| # | Title | Why it matters | URL |
|---|---|---|---|
| D18 | Please Stop Using Barrel Files | 11k → 3.5k modules after removing internal barrels; only a library entry point qualifies. | https://tkdodo.eu/blog/please-stop-using-barrel-files |
| D19 | Component Composition is great btw | Early returns per state + layout wrapper instead of nested conditionals. | https://tkdodo.eu/blog/component-composition-is-great-btw |

### Josh W. Comeau

| # | Title | Why it matters | URL |
|---|---|---|---|
| D20 | Delightful React File/Directory Structure | Folder per component + `index.ts` redirect; helpers (project-specific) vs utils (generic); by function, not feature. | https://www.joshwcomeau.com/react/file-structure/ |
| D21 | Making Sense of React Server Components | Client boundary explained; keep `'use client'` low. | https://www.joshwcomeau.com/react/server-components/ |

### Other authors

| # | Author — Title | Why it matters | URL |
|---|---|---|---|
| D22 | Robin Wieruch — React Folder Structure in 5 Steps | Staged growth; "used by two features → promote"; features don't import each other. | https://www.robinwieruch.de/react-folder-structure/ |
| D23 | Alex Kondov — Tao of React | Group by module from the start; helpers above the component; >5 props → reconsider; "lines of code are not an objective measure". | https://alexkondov.com/tao-of-react/ |
| D24 | Nadia Makarevich — React project structure for scale | Features as black-box packages; strict parent → child imports. | https://www.developerway.com/posts/react-project-structure |
| D25 | Nadia Makarevich — Components composition: how to get it right | "Implements" vs "composes"; component fits one laptop screen. | https://www.developerway.com/posts/components-composition-how-to-get-it-right |
| D26 | Nadia Makarevich — React re-renders guide | Nested component definitions are the biggest perf killer; children-as-props. | https://www.developerway.com/posts/react-re-renders-guide |
| D27 | Johannes Kettmann — Screaming Architecture (dev.to mirror) | Evolution to feature folders; kebab-case for cross-OS safety. Original https://profy.dev/article/react-folder-structure **unverified**. | https://dev.to/profydev/screaming-architecture-evolution-of-a-react-folder-structure-4g25 |
| D28 | Kyle Cook — How To Structure React Projects From Beginner To Advanced | Explicit tiers: <10–15 components simple; advanced = features + lib + services. | https://blog.webdevsimplified.com/2022-07/react-folder-structure/ |
| D29 | Sandro Roth — How to structure your React projects | bulletproof-react vs FSD comparison. | https://sandroroth.com/blog/project-structure/ |
| D30 | Sandi Metz — The Wrong Abstraction | "Duplication is far cheaper than the wrong abstraction." | https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction |
| D31 | Matt Pocock — Why I Don't Like TypeScript Enums | `as const` objects over `enum`. | https://www.totaltypescript.com/why-i-dont-like-typescript-enums |
| D32 | Matt Pocock — Where to put your types in application code | One use → same file; many → shared `*.types.ts` at narrowest scope; many packages → shared package. | https://www.totaltypescript.com/where-to-put-your-types-in-application-code |
| D33 | Alexis King — Parse, don't validate | Parse at the boundary once; no "shotgun parsing". | https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/ |
| D34 | Nicholas C. Zakas — Why I've stopped exporting defaults | Named exports: canonical names, loud failures, refactorable. | https://humanwhocodes.com/blog/2019/01/stop-using-default-exports-javascript-module/ |
| D35 | Marvin Hagemeister — The barrel file debacle | Module-graph size vs test start-up time; 60–80 % faster without barrels. | https://marvinh.dev/blog/speeding-up-javascript-ecosystem-part-7/ |
| D36 | Atlassian Engineering — 75 % faster builds by removing barrel files | Industrial-scale numbers and the encapsulation trade-off. | https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files |
| D37 | Maksym Kuzmitskyi — Barrel Files: The Import You Love and the Bundle You Hate | Middle-ground rule: barrels only at real boundaries, named re-exports, never `export *`. | https://ma-x.im/blog/react-playbook-barrel-files |
| D38 | Bressain Dyer — A Case For Kebab-Casing | Case-insensitive FS, git renames, acronyms. | https://bressain.com/blog/kebab-casing/ |
| D39 | Codemzy — My React file/folder structure 2025 changes | Practitioner drift: kebab-case, named exports, no barrels. | https://www.codemzy.com/blog/react-file-structure |
| D40 | Indie Starter — Lib vs Utils vs Services Folders | The clearest folk definitions of the three folders. | https://indie-starter.dev/blog/lib-vs-utils-vs-services-folders-simple-explanation-for-developers |
| D41 | Ndeye Fatou Diop — 29 React Codebase Red Flags | Junk-drawer `utils.ts`, `export *` coupling, magic values. | https://dev.to/_ndeyefatoudiop/29-react-codebase-red-flags-from-a-senior-frontend-developer-5013 |
| D42 | Matti Lehtinen — Dunghill Anti-Pattern | Why unrelated helpers in one module smell; alternatives. | https://mattilehtinen.com/articles/dunghill-anti-pattern-why-utility-classes-and-modules-smell/ |
| D43 | 137Foundry — When to Split a React Component | Over-splitting articulated; low authority (anonymous dev.to). | https://dev.to/137foundry/when-to-split-a-react-component-and-when-youre-over-engineering-2a6e |
| D44 | Medium — How Many Lines of Code Until I Need to Refactor | Line-count folklore (~200–250). **unverified** (403). | https://medium.com/geekculture/how-many-lines-of-code-until-i-need-to-refactor-a-react-component-c1b8d16f5a5b |
| D45 | Wikipedia — Rule of three (computer programming) | "Three strikes and you refactor" (Roberts via Fowler). | https://en.wikipedia.org/wiki/Rule_of_three_(computer_programming) |
| D46 | Stephen Charles Weiss — utils vs helpers | Echoes Comeau's distinction. **unverified** (503). | https://stephencharlesweiss.com/utils-vs-helpers/ |
| D47 | erikras issue #808 — helpers vs utils? | Shows the ambiguity is old. **thin** (question only). | https://github.com/erikras/react-redux-universal-hot-example/issues/808 |

## E. Style guides and language docs

| # | Title | Type | Why it matters | URL |
|---|---|---|---|---|
| E1 | Airbnb React/JSX Style Guide | guide | One component per file; PascalCase filenames; directory root = `index.jsx`. Class-era, unmaintained. | https://github.com/airbnb/javascript/tree/master/react |
| E2 | Airbnb JavaScript Style Guide | guide | 10.6 prefer default export for single-export modules; 23.x naming; filename = export name. | https://github.com/airbnb/javascript |
| E3 | Google TypeScript Style Guide | guide | Named exports only; no `const enum`; `CONSTANT_CASE` only for module-level immutables; minimize exported surface. | https://google.github.io/styleguide/tsguide.html |
| E4 | Basarat — TypeScript Deep Dive: Barrel | book | Origin of the term; the "pro" position. | https://basarat.gitbook.io/typescript/main-1/barrel |
| E5 | Basarat — TypeScript Deep Dive: StyleGuide | book | camelCase files, PascalCase only for component files. | https://basarat.gitbook.io/typescript/styleguide |
| E6 | Basarat — TypeScript Deep Dive: Avoid Export Default | book | IntelliSense, auto-import, re-export arguments for named exports. | https://basarat.gitbook.io/typescript/main-1/defaultisbad |
| E7 | TypeScript Handbook — Enums | docs | "You may not need an enum when an object with `as const` could suffice"; `const enum` pitfalls. | https://www.typescriptlang.org/docs/handbook/enums.html |
| E8 | TypeScript Handbook — Modules reference (`paths`) | docs | `paths` is type-only; no `baseUrl` needed since 4.1; libraries must not ship aliases. | https://www.typescriptlang.org/docs/handbook/modules/reference.html |

## F. Libraries and tooling

### Styling

| # | Title | Why it matters | URL |
|---|---|---|---|
| F1 | Tailwind v4 — Styling with utility classes | Reuse by extracting a component, not CSS abstractions. | https://tailwindcss.com/docs/styling-with-utility-classes |
| F2 | Tailwind v3 — Reusing Styles | "Don't use `@apply` just to make things look cleaner." | https://v3.tailwindcss.com/docs/reusing-styles |
| F3 | Tailwind v4 — Functions and directives | CSS-first config, `@theme`, `@utility`. | https://tailwindcss.com/docs/functions-and-directives |
| F4 | Tailwind v4 — Upgrade guide | JS config no longer auto-detected; separate stylesheets need `@reference`. | https://tailwindcss.com/docs/upgrade-guide |
| F5 | class-variance-authority — Variants | `cva` + `VariantProps` for variant strings outside JSX. | https://cva.style/docs/getting-started/variants |

### i18n, validation, config

| # | Title | Why it matters | URL |
|---|---|---|---|
| F6 | next-intl — Messages | Namespaces per component/page; no `.` in keys; lowest common namespace per component. | https://next-intl.dev/docs/usage/messages |
| F7 | next-intl — Extraction (`useExtracted`) | Inline messages with auto-hashed keys; PO files. | https://next-intl.dev/docs/usage/extraction |
| F8 | next-intl course — Organizing keys | Paywalled; URL verified, content **unverified**. | https://learn.next-intl.dev/chapters/03-translations/03-keys |
| F9 | FormatJS — Message Extraction | "We recommend against explicit IDs"; content-hash IDs. | https://formatjs.github.io/docs/getting-started/message-extraction/ |
| F10 | i18next — Best Practices | Whole sentences, semantic keys, interpolation sparingly. | https://www.i18next.com/principles/best-practices |
| F11 | Zod — Basic usage | Schema once, `z.infer`/`z.input`/`z.output`; parse untrusted data at the boundary. | https://zod.dev/basics |
| F12 | T3 Env — Introduction | One typed `env.ts`; never `process.env` at call sites. | https://env.t3.gg/docs/introduction |

### Testing

| # | Title | Why it matters | URL |
|---|---|---|---|
| F13 | Vitest — `include` | Default glob is location-agnostic; colocated and `__tests__` both work. | https://vitest.dev/config/include |
| F14 | React Testing Library — Setup | Custom `render` in `test-utils.tsx` via alias. | https://testing-library.com/docs/react-testing-library/setup/ |

### Bundlers and structure-enforcing tools

| # | Title | Why it matters | URL |
|---|---|---|---|
| F15 | Vite — Performance ("Avoid barrel files") | Dev-server waterfall argument against barrels. | https://vite.dev/guide/performance |
| F16 | eslint-plugin-import — `order` | Import ordering groups and `pathGroups` for `@/`. | https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/order.md |
| F17 | eslint-plugin-import — `no-restricted-paths` | Zones that forbid cross-feature imports (bulletproof-react's enforcer). | https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-restricted-paths.md |
| F18 | eslint-plugin-import — `no-cycle` | Circular import detection. | https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-cycle.md |
| F19 | eslint-plugin-import — `no-default-export` | Rule exists alongside `prefer-default-export`; the community is split. | https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-default-export.md |
| F20 | eslint-plugin-boundaries | Element types, `entry-point`, `no-private`; the most expressive ESLint-native option. | https://github.com/javierbrea/eslint-plugin-boundaries |
| F21 | dependency-cruiser | CI-level forbidden rules and graphs outside ESLint. | https://github.com/sverweij/dependency-cruiser |
| F22 | Sheriff — Introduction | Module encapsulation via `index.ts` or config; zero deps. | https://sheriff.softarc.io/docs/introduction |
| F23 | Sheriff — Dependency rules | Tag-based `depRules`. | https://sheriff.softarc.io/docs/dependency-rules |
| F24 | Knip | Unused files, exports, dependencies; catches dead barrel re-exports. | https://knip.dev/ |
| F25 | eslint-plugin-check-file | Filename/folder casing enforcement (`PASCAL_CASE`/`KEBAB_CASE`), `no-index`. | https://github.com/dukeluo/eslint-plugin-check-file |
| F26 | eslint-plugin-react-refresh | `only-export-components`; `allowConstantExport`; Next.js config. | https://github.com/ArnaudBarre/eslint-plugin-react-refresh |

## G. Business logic, state and data layers

### React docs on state and effects

| # | Title | Why it matters | URL |
|---|---|---|---|
| G1 | react.dev — Choosing the State Structure | Group related state; avoid redundant, duplicated, contradictory, deeply nested state; mirror props only as `initialX`. | https://react.dev/learn/choosing-the-state-structure |
| G2 | react.dev — You Might Not Need an Effect | The "why does this run" rule: interaction → handler; on-screen synchronization → Effect; derive during render. | https://react.dev/learn/you-might-not-need-an-effect |
| G3 | react.dev — Separating Events from Effects | Handler logic is not reactive; Effect logic is; `useEffectEvent`. | https://react.dev/learn/separating-events-from-effects |
| G4 | react.dev — Lifecycle of Reactive Effects | One Effect per independent synchronization process. | https://react.dev/learn/lifecycle-of-reactive-effects |
| G5 | react.dev — Server Functions | Client Components call server async functions via serialized references. | https://react.dev/reference/rsc/server-functions |

### Layering and clean architecture

| # | Title | Why it matters | URL |
|---|---|---|---|
| G6 | bulletproof-react — State Management | Five state categories: component, application, server cache, form, URL; "avoid unnecessarily globalizing". | https://github.com/alan2207/bulletproof-react/blob/master/docs/state-management.md |
| G7 | bulletproof-react — API Layer | One file per request: schema + fetcher + hook, colocated in `features/<x>/api/`; single preconfigured client. | https://github.com/alan2207/bulletproof-react/blob/master/docs/api-layer.md |
| G8 | FSD blog — Clean Architecture in Frontend: A How-To Guide | Dependencies point inward; API calls inside components are the anti-pattern; overkill for small apps. | https://feature-sliced.design/blog/frontend-clean-architecture |
| G9 | Martin Fowler — Presentation Domain Data Layering | Presentation → domain → data; domain holds validations and calculations. | https://martinfowler.com/bliki/PresentationDomainDataLayering.html |
| G10 | Khalil Stemmler — Client-Side Architecture Basics (introduction) | Presentation / application / domain / infrastructure for React; components stay presentational. | https://khalilstemmler.com/articles/client-side-architecture/introduction/ |
| G11 | Khalil Stemmler — Client-Side Architecture Basics (architecture) | Same series, the layer diagram. | https://khalilstemmler.com/articles/client-side-architecture/architecture/ |
| G12 | Alex Bespoyasov — Clean Architecture on Frontend | Domain = pure functions; application = use cases; React is an adapter; "overkill if small". | https://bespoyasov.me/blog/clean-architecture-on-frontend/ |
| G13 | Dave Martin — Critique of Pure Hooks | Contrarian: hooks push toward half-baked OO; compose logic in plain functions. | https://blog.davemartin.me/posts/critique-of-pure-hooks/ |
| G14 | Redux Style Guide | Logic in reducers; actions as events not setters; derive don't store; feature folders with one slice file. | https://redux.js.org/style-guide/ |

### Server state (TanStack Query)

| # | Title | Why it matters | URL |
|---|---|---|---|
| G15 | TanStack Query — Overview | Definition of server state: remote, async, shared ownership, goes stale. | https://tanstack.com/query/latest/docs/framework/react/overview |
| G16 | TanStack Query — Does this replace client state? | Server-state library, not a client-state replacement; leftover global client state "is usually very tiny". | https://tanstack.com/query/latest/docs/framework/react/guides/does-this-replace-client-state |
| G17 | TanStack Query — `queryOptions` | Define a query once; key carries the inferred type; reusable across hooks and imperative APIs. | https://tanstack.com/query/latest/docs/framework/react/reference/queryOptions |
| G18 | TanStack Query — Advanced Server Rendering | Server Components as a prefetch place, "nothing more"; provider in a client file. | https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr |
| G19 | TkDodo — React Query as a State Manager | "Async state manager"; the frontend doesn't own the data; wrap `useQuery` in custom hooks; set `staleTime`. | https://tkdodo.eu/blog/react-query-as-a-state-manager |
| G20 | TkDodo — Practical React Query | Custom hook per query; key = dependency array; don't copy query data into local state; `setQueryData` only for optimistic updates. | https://tkdodo.eu/blog/practical-react-query |
| G21 | TkDodo — Thinking in React Query (talk) | "Not a data fetching library"; params go in the key; "stale time is your best friend". Page is a client-rendered deck; transcript at https://gitnation.com/contents/thinking-in-react-query | https://tkdodo.eu/blog/thinking-in-react-query |
| G22 | TkDodo — Effective React Query Keys | Keys colocated per feature; key factories from generic to specific. Partially superseded by G23. | https://tkdodo.eu/blog/effective-react-query-keys |
| G23 | TkDodo — The Query Options API | "Separating QueryKey from QueryFunction was a mistake"; `queryOptions` as the main abstraction. | https://tkdodo.eu/blog/the-query-options-api |
| G24 | TkDodo — You Might Not Need React Query | Server-fetched reads in Next.js/Remix don't need it; still needed for polling, infinite lists, offline, non-fetch async state. | https://tkdodo.eu/blog/you-might-not-need-react-query |
| G25 | TkDodo — React Query and Forms | The sanctioned exception: server state as form initial data, deliberately. | https://tkdodo.eu/blog/react-query-and-forms |
| G26 | TkDodo — Don't over useState | Computable → not state; setter used only in an effect → delete the state. | https://tkdodo.eu/blog/dont-over-use-state |
| G27 | TkDodo — Putting props to useState | Initial value is discarded on re-render; lift, `key`-remount, or conditional render instead of sync effects. | https://tkdodo.eu/blog/putting-props-to-use-state |
| G28 | Kent C. Dodds — Application State Management with React | Server cache vs UI state; "lifting state up is the answer"; context via composition. | https://kentcdodds.com/blog/application-state-management-with-react |
| G29 | Remix — State Management | URL, cookies, sessions, server cache; "if your React state manages anything network-related you're duplicating the framework". | https://v2.remix.run/docs/discussion/state-management |

### Client stores, URL state, forms

| # | Title | Why it matters | URL |
|---|---|---|---|
| G30 | Zustand — Slices Pattern | Split a growing store into slices combined into one bounded store. | https://zustand.docs.pmnd.rs/learn/guides/slices-pattern |
| G31 | Zustand — Practice with no store actions | Colocated actions recommended; module-level actions "no downsides". | https://zustand.docs.pmnd.rs/learn/guides/practice-with-no-store-actions.html |
| G32 | Zustand — Flux-inspired practice | Single store, always `set`, actions in the store. | https://zustand.docs.pmnd.rs/learn/guides/flux-inspired-practice.html |
| G33 | Zustand — Comparison | Zustand single store vs Jotai atoms; selectors for render optimization. | https://zustand.docs.pmnd.rs/learn/getting-started/comparison.html |
| G34 | TkDodo — Working with Zustand | Only export custom hooks; atomic selectors; actions as events; many small stores. | https://tkdodo.eu/blog/working-with-zustand |
| G35 | Jotai — Concepts | Bottom-up atoms; derived atoms; async atoms suspend. | https://jotai.org/docs/basics/concepts |
| G36 | nuqs — README | "Like useState, but stored in the URL"; the URL is the source of truth. | https://github.com/47ng/nuqs |
| G37 | nuqs — Basic usage | Parsers, defaults, `null` removes the key, shallow mode. | https://nuqs.dev/docs/basic-usage |
| G38 | Next.js — `useSearchParams` | Client-only hook; Server Components read the `searchParams` page prop; Suspense on static routes. | https://nextjs.org/docs/app/api-reference/functions/use-search-params |
| G39 | TanStack Router — Search Params | "Search params represent application state"; must be validated (`validateSearch`). | https://tanstack.com/router/latest/docs/framework/react/guide/search-params |
| G40 | Kent C. Dodds — URL as source of truth (tweet) | "Treat the URL as the source of truth and ditch your local state." **unverified** (search snippet). | https://x.com/kentcdodds/status/1349173470567964673 |
| G41 | React Hook Form — Get started | Uncontrolled inputs; schema validation via resolvers (zod); `Controller` for controlled UI libs. Site 403s; verified from https://github.com/react-hook-form/documentation/blob/master/src/content/get-started.mdx | https://react-hook-form.com/get-started |

### Next.js data access, Server Actions, Route Handlers

| # | Title | Why it matters | URL |
|---|---|---|---|
| G42 | Next.js — Fetching Data | Fetch in the Server Component that needs the data; `React.cache` for non-fetch access; preload next to the consumer. | https://nextjs.org/docs/app/getting-started/fetching-data |
| G43 | Next.js — How to think about data security | Pick one approach (HTTP API / Data Access Layer / component-level); DAL is server-only, authorizes, returns minimal DTOs; only the DAL reads `process.env`. | https://nextjs.org/docs/app/guides/data-security |
| G44 | Sebastian Markbåge — How to Think About Security in Next.js | DAL + DTOs; Server Action arguments are hostile; rendering never mutates. | https://nextjs.org/blog/security-nextjs-server-components-actions |
| G45 | Next.js — Server Actions and Mutations | Every action: authenticate, validate, constrain return values; actions run sequentially per client. | https://nextjs.org/docs/app/guides/server-actions |
| G46 | Next.js — Authentication (DAL section) | `app/lib/dal.ts` with `server-only`, cached `verifySession`, `dto.ts`. | https://nextjs.org/docs/app/guides/authentication |
| G47 | Next.js — Backend for Frontend | Route Handlers are public endpoints for non-UI clients/webhooks; don't fetch from your own Route Handlers in Server Components; SWR/React Query for polling and client-only APIs. | https://nextjs.org/docs/app/guides/backend-for-frontend |

### Boundary parsing

| # | Title | Why it matters | URL |
|---|---|---|---|
| G48 | Josh Karamuth — Stop Trusting Your API: Zod + React Query DTOs | Schema with `.transform()` in the queryFn as the DTO → domain boundary. | https://joshkaramuth.com/blog/tanstack-zod-dto/ |
| G49 | Brenley Dueck — Using Zod To Validate API Responses | `schema.parse(await res.json())` in the fetcher; `z.infer` types. | https://www.brenelz.com/posts/using-zod-to-validate-api-responses/ |

(Also relevant here and already listed: A1, A6, A7, A8, A9, A10, B2, B3, C1, C4, C5, D5, D15, D22, D23, D33, F11.)

## H. Next.js App Router — architecture (routing, composition, data layer)

Research date: 2026-09-26, second pass at the user's request. Architecture
only; performance and plain API reference are excluded (the
`next-best-practices` skill already covers file conventions and RSC rules).

### Layouts, templates, route groups

| # | Title | Type | Why it matters | URL |
|---|---|---|---|---|
| H1 | Next.js — Layouts and Pages | docs | Layouts persist and never rerender on navigation; `searchParams` is page-only. | https://nextjs.org/docs/app/getting-started/layouts-and-pages |
| H2 | Next.js — `layout.js` reference | docs | Layouts cannot read request/searchParams/pathname (by design), cannot pass data to children; uncached fetches in a layout block `loading.js`. | https://nextjs.org/docs/app/api-reference/file-conventions/layout |
| H3 | Next.js — `template.js` reference | docs | Remounts children per navigation; only for state/effect reset. | https://nextjs.org/docs/app/api-reference/file-conventions/template |
| H4 | Next.js — Linking and Navigating | docs | Shared layouts stay interactive; `loading.tsx` makes navigation interruptible. | https://nextjs.org/docs/app/getting-started/linking-and-navigating |
| H5 | Next.js — Route Groups | docs | Organize by team/section; multiple root layouts cause full reloads. | https://nextjs.org/docs/app/api-reference/file-conventions/route-groups |
| H6 | Next.js — `not-found.js` / `global-not-found.js` | docs | Root not-found needs a single root layout; `global-not-found` (experimental) for multiple. | https://nextjs.org/docs/app/api-reference/file-conventions/not-found |
| H7 | Next.js — `src` folder | docs | Optional; `app`, `components`, `lib` and `proxy.ts` move under it together. | https://nextjs.org/docs/app/api-reference/file-conventions/src-folder |
| H8 | Lee Robinson — Next.js Layouts RFC in 5 minutes | essay | Original intent of layouts and route groups. | https://vercel.com/blog/next-js-layouts-rfc-in-5-minutes |
| H9 | Lee Robinson — Common mistakes with the Next.js App Router | essay | Providers as client components with `children`; Suspense above the async component; don't `'use client'` everything; don't call own Route Handlers. | https://vercel.com/blog/common-mistakes-with-the-next-js-app-router-and-how-to-fix-them |
| H10 | Sam Selikoff & Ryan Toronto — Global progress in Next.js | essay | Global client UI as a provider in the layout; layout stays a Server Component. | https://buildui.com/posts/global-progress-in-nextjs |
| H11 | Vishwas Gopinath — Layouts vs Templates | essay | "Default to layouts"; templates for isolation and reset. | https://www.builder.io/blog/nextjs-14-layouts-templates |
| H12 | This Dot Labs — Next.js Route Groups | essay | Vocabulary: groups by section, intent, team. | https://www.thisdot.co/blog/next-js-route-groups |
| H13 | Discussion #50034 — Multiple root layouts and root not-found | repo | The real cost of multiple root layouts. | https://github.com/vercel/next.js/discussions/50034 |

### Boundaries, parallel and intercepting routes

| # | Title | Type | Why it matters | URL |
|---|---|---|---|---|
| H14 | Next.js — `loading.js` reference | docs | Wraps only what is below it; recommended on dynamic routes. | https://nextjs.org/docs/app/api-reference/file-conventions/loading |
| H15 | Next.js — Error Handling | docs | Expected errors as return values; boundaries per segment; `catchError`. | https://nextjs.org/docs/app/getting-started/error-handling |
| H16 | Next.js — `error.js` reference | docs | Granularity rules; `global-error` has no theme/styles. | https://nextjs.org/docs/app/api-reference/file-conventions/error |
| H17 | Next.js — Parallel Routes | docs | Slots as layout props; `default.js` mandatory; all slots render on the server (authorize inside each). | https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes |
| H18 | Next.js — Intercepting Routes | docs | `(.)` relative to route segments, not the file system. | https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes |
| H19 | Next.js — `default.js` | docs | Fallback for slots on hard navigation. | https://nextjs.org/docs/app/api-reference/file-conventions/default |
| H20 | vercel-labs/nextgram | repo | Reference tree for the URL-addressable modal. | https://github.com/vercel-labs/nextgram |
| H21 | Devya — Parallel & Intercepting Routes field notes | essay | Use only when the content deserves its own address; `default.tsx` and `router.back()` traps. | https://www.devya.dev/blogs/parallel-intercepting-routes-nextjs-app-router-field-notes |
| H22 | Discussion #71586 — Parallel and Intercepting Route Modals | repo | Multi-slot stacking pitfalls. | https://github.com/vercel/next.js/discussions/71586 |

### Proxy (middleware), auth placement, i18n routing

| # | Title | Type | Why it matters | URL |
|---|---|---|---|---|
| H23 | Next.js — Proxy (getting started) | docs | What belongs in `proxy.ts`: headers, rewrites, optimistic redirects; "last resort"; not session management. | https://nextjs.org/docs/app/getting-started/proxy |
| H24 | Next.js — `proxy.js` reference | docs | Execution order; matcher skips Server Function POSTs too; middleware → proxy migration. | https://nextjs.org/docs/app/api-reference/file-conventions/proxy |
| H25 | Vercel — Postmortem on Next.js Middleware bypass (CVE-2025-29927) | essay | Why middleware must never be the only auth check. | https://vercel.com/blog/postmortem-on-next-js-middleware-bypass |
| H26 | Next.js — Internationalization guide | docs | `app/[lang]` segment, proxy locale detection, `next/root-params`. | https://nextjs.org/docs/app/guides/internationalization |
| H27 | next-intl — App Router overview | docs | Two modes: with or without i18n routing. | https://next-intl.dev/docs/getting-started/app-router |
| H28 | next-intl — with i18n routing | docs | `i18n/{routing,request,navigation}.ts`, `proxy.ts`, `app/[locale]/`. | https://next-intl.dev/docs/getting-started/app-router/with-i18n-routing |
| H29 | next-intl — without i18n routing | docs | Our mode: `i18n/request.ts` + provider in root layout, plain `next/link`, no proxy. | https://next-intl.dev/docs/getting-started/app-router/without-i18n-routing |
| H30 | next-intl — Navigation APIs | docs | `createNavigation` lives in `src/i18n/navigation.ts`; only with routing. | https://next-intl.dev/docs/routing/navigation |

### SPA mode and client-side data on App Router

| # | Title | Type | Why it matters | URL |
|---|---|---|---|---|
| H31 | Next.js — Single-Page Applications guide | docs | Layout as the server shell; start promises in layouts, `use()` in client providers; SWR/TanStack for revalidation and mutations. | https://nextjs.org/docs/app/guides/single-page-applications |
| H32 | Next.js — Client-side data fetching | docs | When a client cache library is warranted; pattern table. | https://nextjs.org/docs/app/guides/client-side-data-fetching |
| H33 | Next.js — Client-side data fetching with TanStack Query | docs | Provider at the nearest shared layout; `queryOptions` "cache contract" module with no server/client-only imports. | https://nextjs.org/docs/app/guides/client-side-data-fetching/tanstack-query |
| H34 | vercel-labs/next-spa-patterns | repo | Official companion: `providers.tsx`, `get-query-client.ts`, `hooks/` colocated in the route. | https://github.com/vercel-labs/next-spa-patterns |

### Real-world App Router trees (verified via GitHub)

| # | Repo | Type | What it shows | URL |
|---|---|---|---|---|
| H35 | shadcn-ui/taxonomy | repo | `(auth)/(dashboard)/(docs)/(editor)/(marketing)` groups, one root layout; `loading.tsx` per dashboard page. | https://github.com/shadcn-ui/taxonomy |
| H36 | vercel/ai-chatbot | repo | Root layout = theme/session providers; `(chat)/layout.tsx` holds request-dependent providers; `actions.ts` and route handlers colocated per group; `proxy.ts`. | https://github.com/vercel/ai-chatbot |
| H37 | vercel/next-app-router-playground | repo | Nested groups, `@slot` layouts with `default.tsx`, `_hooks`/`_patterns` private folders. | https://github.com/vercel/next-app-router-playground |
| H38 | vercel/platforms | repo | Small app, no groups, `actions.ts` at app root. | https://github.com/vercel/platforms |
| H39 | dubinc/dub | repo | Host-based folders with groups per product surface; `app/providers.tsx`. | https://github.com/dubinc/dub |
| H40 | calcom/cal.com | repo | Groups as wrapper shells; features in `apps/web/modules/` (30+ folders). | https://github.com/calcom/cal.com |
| H41 | create-t3-app — Folder Structure (App Router) | docs | `app/` routing-only; `server/`, `trpc/`, `env.js`. | https://create.t3.gg/en/folder-structure-app |
| H42 | pipipi-dev — App Router Directory Design | essay | The articulated "routing-only `app/`" position; `client/` vs `server/` split. | https://dev.to/pipipi-dev/app-router-directory-design-nextjs-project-structure-patterns-31eo |

### Server Actions and forms

| # | Title | Type | Why it matters | URL |
|---|---|---|---|---|
| H43 | Next.js — Mutating Data | docs | File-level `'use server'` for anything a Client Component imports; mutate → revalidate → redirect; actions are not a read API. | https://nextjs.org/docs/app/getting-started/mutating-data |
| H44 | Next.js — How to create forms with Server Actions | docs | Schema next to the action; return `{ errors }`; `useActionState` signature; `.bind` for extra args. | https://nextjs.org/docs/app/guides/forms |
| H45 | react.dev — `useActionState` | docs | Known errors returned as state; unknown errors thrown to the boundary; `permalink` for progressive enhancement. | https://react.dev/reference/react/useActionState |
| H46 | next-safe-action — Getting started | tool | One `lib/safe-action.ts` client; middleware-chained clients. | https://next-safe-action.dev/docs/getting-started |
| H47 | next-safe-action — Action client | tool | `actionClient.use(authMiddleware)` hierarchies. | https://next-safe-action.dev/docs/define-actions/create-the-client |
| H48 | next-safe-action — Validation errors | tool | `returnValidationErrors()` for business-rule failures. | https://next-safe-action.dev/docs/define-actions/validation-errors |
| H49 | next-safe-action — Action result | tool | `data | validationErrors | serverError` union; thrown errors masked by default; `redirect` re-thrown. | https://next-safe-action.dev/docs/concepts/action-result |
| H50 | next-safe-action — `useStateAction` | tool | Built on `useActionState` but loses no-JS progressive enhancement. | https://next-safe-action.dev/docs/execute-actions/hooks/usestateaction |
| H51 | zsa — Introduction | tool | Tuple `[data, err]` result; procedures as middleware. | https://zsa.vercel.app/docs/introduction |
| H52 | leerob/next-saas-starter — `lib/auth/middleware.ts` | repo | Hand-rolled `validatedAction(schema, action)` wrapper returning `{ error }`. | https://github.com/leerob/next-saas-starter/blob/main/lib/auth/middleware.ts |
| H53 | leerob/next-saas-starter — `app/(login)/actions.ts` | repo | Per-route-group actions file; schemas colocated; DAL in `lib/db/`. | https://github.com/leerob/next-saas-starter/blob/main/app/(login)/actions.ts |
| H54 | vercel/ai-chatbot — `app/(chat)/actions.ts` | repo | Thin actions importing only from `lib/db/queries`; they throw rather than return. | https://github.com/vercel/ai-chatbot/blob/main/app/(chat)/actions.ts |
| H55 | vercel/ai-chatbot — `lib/db/queries.ts` | repo | `server-only`; DB client in the module; one exported function per query; rich errors. | https://github.com/vercel/ai-chatbot/blob/main/lib/db/queries.ts |
| H56 | vercel/ai-chatbot — `lib/errors.ts` | repo | Error taxonomy `type:surface`, per-surface visibility, `toResponse()` status mapping. | https://github.com/vercel/ai-chatbot/blob/main/lib/errors.ts |
| H57 | Robin Wieruch — Next.js Server Actions | essay | Extract actions into feature folders, not next to pages. | https://www.robinwieruch.de/next-server-actions/ |
| H58 | Discussion #49426 — Error handling for Server Actions | repo | Why "return values" exists: production masks thrown messages. | https://github.com/vercel/next.js/discussions/49426 |

### Data Access Layer, cache and revalidation

| # | Title | Type | Why it matters | URL |
|---|---|---|---|---|
| H59 | Next.js — Caching (Cache Components) | docs | `use cache` at data or UI level; pair with `cacheLife`; runtime values passed as arguments; async work deep in the tree. | https://nextjs.org/docs/app/getting-started/caching |
| H60 | Next.js — `use cache` directive | docs | Cache key = location + args + closures; no `cookies()`/`headers()` inside; serializable I/O. | https://nextjs.org/docs/app/api-reference/directives/use-cache |
| H61 | Next.js — Revalidating | docs | Prefer tags over paths; `updateTag` in actions for read-your-writes; `revalidateTag(tag, profile)` elsewhere. | https://nextjs.org/docs/app/getting-started/revalidating |
| H62 | Next.js — `cacheTag` | docs | Tags declared inside the data function; may derive from returned data. | https://nextjs.org/docs/app/api-reference/functions/cacheTag |
| H63 | Next.js — Caching and Revalidating (Previous Model) | docs | Next 15 dynamic by default; `React.cache` + `preload()` for non-fetch reads. | https://nextjs.org/docs/app/guides/caching-without-cache-components |
| H64 | Next.js — `unstable_cache` | docs | "Replaced by `use cache` in Next.js 16" yet still the cross-deploy persistence option. | https://nextjs.org/docs/app/api-reference/functions/unstable_cache |
| H65 | Next.js 15 release post | essay | Fetch/GET/navigation no longer cached by default; async request APIs. | https://nextjs.org/blog/next-15 |
| H66 | Next.js 16 release post | essay | Cache Components opt-in; `middleware` → `proxy`; `publicRuntimeConfig` removed. | https://nextjs.org/blog/next-16 |
| H67 | Vercel — Fetching data faster with the App Router (2023) | essay | The component-level fetching stance that the 2025 Data Security guide demoted to "prototypes". | https://vercel.com/blog/nextjs-app-router-data-fetching |

### Config and environment

| # | Title | Type | Why it matters | URL |
|---|---|---|---|---|
| H68 | Next.js — Environment variables | docs | `NEXT_PUBLIC_` inlined at build; dynamic lookups not inlined; `.env` stays at root even with `src/`. | https://nextjs.org/docs/app/guides/environment-variables |
| H69 | T3 Env — Next.js | tool | `createEnv({ server, client, runtimeEnv })`; split `env/server.ts` and `env/client.ts`; import from `next.config.ts`. | https://env.t3.gg/docs/nextjs |
| H70 | T3 Env — Core | tool | Standard Schema validators; `emptyStringAsUndefined`. | https://env.t3.gg/docs/core |
| H71 | create-t3-app — Environment Variables | docs | Destructure manually so the bundler keeps the variable. | https://create.t3.gg/en/usage/env-variables |

### TanStack Query in App Router

| # | Title | Type | Why it matters | URL |
|---|---|---|---|---|
| H72 | TanStack Query — Server Rendering & Hydration | docs | Never a module-level `QueryClient` on the server; `staleTime > 0` with SSR; prefetch → dehydrate → `HydrationBoundary`. | https://tanstack.com/query/latest/docs/framework/react/guides/ssr |
| H73 | TanStack Query — Query Options | docs | `queryOptions` shares key + fn across `useQuery`, `useSuspenseQuery`, `prefetchQuery`, `setQueryData`. | https://tanstack.com/query/latest/docs/framework/react/guides/query-options |
| H74 | TkDodo — Seeding the Query Cache | essay | Prefer prefetch/hydration over `initialData`. | https://tkdodo.eu/blog/seeding-the-query-cache |
| H75 | tRPC — Server Components setup | docs | The most explicit file layout for RQ + App Router: `trpc/{init,query-client,client,server}.ts`, `getQueryClient = cache(...)`. | https://trpc.io/docs/client/tanstack-react-query/server-components |

### API contracts with a separate backend

| # | Title | Type | Why it matters | URL |
|---|---|---|---|---|
| H76 | tRPC — Docs intro | docs | Typesafe APIs without codegen; TS monorepos only. | https://trpc.io/docs |
| H77 | tRPC — Concepts | docs | Procedure, router, context, middleware vocabulary. | https://trpc.io/docs/concepts |
| H78 | Turborepo — Internal packages | docs | JIT / compiled / publishable package strategies for a shared contracts package. | https://turborepo.dev/docs/core-concepts/internal-packages |
| H79 | openapi-typescript — Introduction | tool | Runtime-free types from an OpenAPI schema. | https://openapi-ts.dev/introduction |
| H80 | openapi-fetch | tool | `{ data, error }` typed client from `paths`; 6 KB. | https://openapi-ts.dev/openapi-fetch/ |
| H81 | orval | tool | OpenAPI → React Query hooks + zod + MSW mocks. Docs `/overview` 404s. | https://orval.dev/ |
| H82 | Serghei — Where Your Types Live Matters (Pocock's rules secondhand) | essay | Shared schema at the narrowest boundary; `z.infer` importable by both form and action. | https://blog.serghei.pl/posts/where-your-types-live-matters/ |

### Testing App Router

| # | Title | Type | Why it matters | URL |
|---|---|---|---|---|
| H83 | Next.js — Testing overview | docs | Async Server Components → e2e. | https://nextjs.org/docs/app/guides/testing |
| H84 | Next.js — Playwright guide | docs | Run e2e against a production build. | https://nextjs.org/docs/app/guides/testing/playwright |
| H85 | Discussion #46528 — async RSC unit tests | repo | `renderToString` workaround called "hacky"; e2e recommended. | https://github.com/vercel/next.js/discussions/46528 |
| H86 | Discussion #69036 — Unit testing server actions | repo | Actions are plain async functions; mock `next/navigation`, `next/cache`, `next/headers`. | https://github.com/vercel/next.js/discussions/69036 |
| H87 | MSW — Node.js integration | tool | `setupServer` lifecycle. | https://mswjs.io/docs/integrations/node |
| H88 | MSW issue #1644 — Next.js App directory support | repo | Maintainer: two Node processes, patches must persist; Next 15 fixed patch timing. | https://github.com/mswjs/msw/issues/1644 |
| H89 | laststance/next-msw-integration | repo | `mocks/{handlers,browser,server}.ts`; server worker started from the root layout under a runtime guard. | https://github.com/laststance/next-msw-integration |
| H90 | Storybook — Build a Next.js app with RSC + MSW | essay | Mock in the browser or at module level instead of the RSC process. | https://storybook.js.org/blog/build-a-nextjs-app-with-rsc-msw-storybook/ |
| H91 | Epic RSC Stack | repo | `vitest-plugin-rsc`: server render + hydrate + action in one Vitest process; not Vercel-endorsed. | https://epic-rsc-stack.dev/ |

(Also relevant and already listed: B1–B3, B5, B7, G18, G42–G47, C1, C7, D22, F12.)

---

## Counts

| Section | Entries | Unverified / thin |
|---|---|---|
| A React docs | 18 | 0 |
| B Next.js / Vercel | 12 | 0 |
| C Architectures | 24 | 1 (C22) |
| D Essays | 47 | 4 (D44, D46 unverified; D47 thin; D27 original unverified) |
| E Style guides | 8 | 0 |
| F Libraries & tooling | 26 | 1 (F8 paywalled) |
| G Logic & state | 49 | 2 (G40, G41 site) |
| H Next.js architecture | 91 | 1 (H81 docs page) |
| **Total** | **275** | **9** |
