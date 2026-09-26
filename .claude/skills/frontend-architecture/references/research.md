# frontend-architecture — research notes

Research date: 2026-09-26. Scope: React 18/19 + TypeScript, Next.js App
Router, Vite SPAs; TanStack Query, Tailwind 4, Vitest, next-intl.
Method: five parallel research streams (structure · decomposition ·
constants/utils · business logic/state · naming/tooling) plus a second pass
of two streams on Next.js App Router architecture (routing/composition ·
data layer/mutations/config), each source fetched and read; 275 sources
after de-duplication. Source ids (`A1`, `D18`…)
refer to `sources.md`. This file is the input for the future skill's
`SKILL.md`; it records what the sources say, where they agree, and where they
disagree — not yet our decisions.

Existing skill `react-best-practices` already covers anti-patterns, hooks
misuse and state hygiene; its "Code Organization" section is ten lines. The
new skill should own everything below and cross-link to it rather than repeat
it.

---

## 0. Short answers to the five questions

1. **Where components live.** Domain-free primitives in one shared place
   (`components/ui` or an in-house kit); everything else next to its only
   consumer (route-private `_components/` or `features/<x>/components`);
   promote to shared only when a second unrelated consumer appears.
   Dependencies flow one way: shared → features → pages/app; features never
   import each other. No framework prescribes this; the reference
   architectures and educators converge on it.
2. **How they are split.** By responsibility, not by line count. Split when a
   concrete pain shows up: mixed responsibilities, a state slice used by only
   part of the tree, tangled conditionals, reuse actually needed, logic that
   is hard to test. Compose with `children`/slots; move state down, lift
   content up; early returns per state. Never define a component inside
   another. Container/presentational is retired; hooks + headless/compound
   components replaced it.
3. **Where constants live.** Ladder: module scope in the component file →
   sibling `constants.ts` when shared by a component folder → app-wide
   `config/` (env-derived, read once through a typed module) or a grouped
   constants module. Static objects/arrays never inside the render body.
   `as const` objects over `enum`. User-facing text is not a constant; it
   lives in i18n messages.
4. **What goes to utils/helpers.** Only pure, hook-free functions that take
   their inputs as arguments. `helpers` = domain-specific, colocated with the
   feature/component; `utils` = generic, project-agnostic; `lib` = wrappers
   around third-party libs and app infrastructure (api client, query client,
   `cn`); `services`/`api` = I/O. Extract on the third use, not the first
   duplicate. No junk-drawer `utils.ts`: group by concern.
5. **Where business logic lives.** Classify the state first: server cache
   stays in the query cache (or Server Components), never copied into local
   state; UI state stays in the component that uses it; app-wide client state
   is small and lives in a provider/store module; URL and form state have
   their own owners. Logic goes in the layer that matches its trigger: pure
   domain rules and reducers are plain functions (testable without React);
   stateful/effectful glue is a custom hook named for a use case; a query is
   defined once per feature as a hook or `queryOptions` with its schema and
   fetcher; interaction-caused logic lives in event handlers, not effects.
   Parse at every boundary (API, URL, form, action) and trust the types after
   that. Domain never imports UI.
6. **Next.js App Router architecture (added on request).** Layouts are the
   persistent shell and never rerender, so they host long-lived providers and
   never read search params; route groups partition shells without touching
   URLs; boundaries (`loading`/`error`/`not-found`) sit at the segment whose
   shell must survive; proxy handles headers, rewrites and optimistic
   redirects only, while authorization lives in a `server-only` Data Access
   Layer; Server Actions are thin (validate → DAL → revalidate → redirect)
   and return expected errors as values; `use cache`/tags are declared at
   the data function; env is read through one validated module. An
   all-client app on Next.js still keeps the Server Component layer as the
   shell and does its data through TanStack Query with a provider at the
   nearest shared layout. See §7.

---

## 1. Where components live

### Consensus

- Neither React nor Next.js prescribes a folder structure (A14, B1, A18).
  Pick one strategy, apply it consistently, refactor as you learn which files
  change together.
- Colocate. Components, hooks, tests, styles, state and helpers sit as close
  as possible to their single consumer; lift only when a second unrelated
  consumer appears (D1, C2, D22, D20, B1).
- Start type-based, go feature-based when the flat `components/` stops
  scaling. Soft thresholds: >10–15 components (D28), "components folder gets
  too big" (D22), max 3–4 nesting levels (A14, D24).
- Two tiers of components everywhere: domain-free primitives
  (`components/ui`, `shared/ui`, `modules/common`, an in-house kit) vs
  domain-specific components (`features/<x>/components` or route-private
  `_components/`) (C1, C13, D23, D22, C4, B1).
- Dependencies flow one way: shared → features → pages/app. Features never
  import each other; pages/app compose them (C1, D22, D27, C4, D24).
- Enforce boundaries mechanically, not by convention: `import/no-restricted-
  paths`, `no-restricted-imports` patterns, `eslint-plugin-boundaries`,
  `dependency-cruiser`, Steiger for FSD (C1, C9, F17, F20, F21, C10).
- Next.js App Router: colocating inside `app/` is safe because only
  `page`/`route` files are routable; `_components/`, `_lib/` private folders
  for route-local code; `(group)` folders to organize without changing URLs
  (B1).
- Absolute aliases (`@/…`) over deep relative paths (D23, D27, C3, C13).
- Atomic Design is a design-system vocabulary, not a folder taxonomy; even
  Frost calls it "not rigid dogma", and no mainstream React reference uses
  atoms/molecules as directories (C18–C21).

### Contested

- **Feature vs function folders.** Comeau (D20) argues feature folders drift
  from product reality and organizes by function permanently; bulletproof-
  react, Wieruch, Kondov, Kettmann, FSD, Makarevich argue only feature grouping
  scales. Roth (D29) notes bulletproof's per-feature type folders split
  coupled hook+component pairs and prefers FSD segments.
- **Barrel files.** Against in application code: TkDodo (D18), Hagemeister
  (D35), Atlassian (D36), Vite (F15), Vercel (B10), current bulletproof-react
  (C1, which flipped from recommending feature `index.ts`). For, as a public
  API per component/feature/slice: Basarat (E4), Wieruch (D22), Comeau (D20),
  Cook (D28), Kettmann (D27), FSD (C6, which nevertheless lists the costs).
  Middle ground (D37): barrels only at a deliberate boundary, named
  re-exports only, no `export *`, no side effects, never layer-wide.
- **Folder-per-component + `index` redirect vs flat kebab-case files.**
  Airbnb/Comeau/Wieruch/Kondov vs shadcn/Vercel repos/Kettmann/Bressain. The
  index-redirect pattern usually relies on default exports, which Google (E3)
  bans.
- **Cross-feature strictness.** bulletproof/Wieruch/Makarevich forbid; FSD
  offers an explicit `@x` escape hatch for Entities; Cook allows importing a
  sibling feature's public index but not its internals.
- **How much structure up front.** Kondov "group by module from the start"
  vs React FAQ/Abramov "move files until it feels right" vs Wieruch/Cook
  staged evolution.

### Evidence worth quoting in the skill

- Next.js: "unopinionated about how you organize and colocate your project
  files"; private folders help "Separating UI logic from routing logic" and
  "Avoiding potential naming conflicts with future Next.js file conventions"
  (B1).
- Kent C. Dodds: functions pulled into a shared `utils/` become "out of sight,
  out of mind" (D1).
- Wieruch: "components/ folder only for reusable components (e.g. UI
  components). Every other component should move to a respective feature
  folder" (D22).
- Barrel cost numbers: 2,225 modules for one `@mui/material` import (B10);
  11k → 3.5k modules per page after removing internal barrels (D18); build
  time −75 %, affected tests per change 1,600 → 200 (D36).

---

## 2. How components are split

### Consensus

- Split by responsibility. A component should be describable in one sentence
  as either "implements X" or "composes A, B, C", never both (A1, D25, D23,
  D43).
- Split when you feel a concrete pain, not preemptively: reuse, a state slice
  only part of the tree uses, hard-to-test logic, tangled conditionals,
  re-render cost, merge conflicts (A15, D2, D3, D43). The React team expects
  the average function component to be longer after hooks (A15).
- Prefer duplication to a hasty abstraction; abstract at the third real use
  case (D30, D2, D45).
- Never define a component inside another component (A2, D26). The only
  universal "never".
- `children` and element props are the slots. When intermediate components
  only forward props, extract a layout component and pass JSX instead of
  reaching for context (A4, A9, A17, D10, D4).
- Push state down to the lowest common owner; lift static content up as
  `children` of the stateful component. Do this before any memoization (A10,
  D16, D5, D26, D7).
- Mutually exclusive states → early returns plus a shared layout wrapper, not
  nested ternaries (D19).
- Extract logic into a custom hook only if it calls hooks; otherwise a plain
  function. Name hooks for a concrete use case, never for lifecycle
  (`useMount`) (A8, A15). Use a reducer when update logic needs isolation and
  unit tests (A6); a provider file (reducer + context + `useX()` hooks) when
  many components share it (A7).
- Extracted pieces stay colocated with their only consumer (D1, D20).
- React Server Components: put `'use client'` at the smallest interactive
  leaf; compose server content into client shells through `children`; props
  crossing the boundary must be serializable; compound-component static
  members break at the boundary → named exports (B2, B3, D21, D17).

### Contested

- **Numeric thresholds.** Kondov: reconsider above 5 props (D23); Makarevich:
  fits one laptop screen (D25); folklore: ~200–250 lines (D44, unverified).
  Against: Kondov himself ("Lines of code are not an objective measure"),
  Dodds ("NOT BEFORE" you feel pain, D3), React team (A15). Net: numbers are
  review prompts, not rules. The existing `react-best-practices` skill states
  "max 200 lines" and "max 5–7 props" as hard rules — the new skill should
  soften these to signals.
- **Container/presentational.** Abramov retracted the prescription in 2019
  (D15); patterns.dev agrees (C23). A softer two-kind split survives: Dodds'
  structural vs stateful (D10), Makarevich's composes vs implements (D25),
  Qiu's headless hook + UI (C24).
- **Prop drilling.** React docs and Dodds say a dozen props through a dozen
  layers can be fine and explicit (A9, D4); most tutorials treat it as a bug.
  All agree composition beats context as the first fix.
- **Eagerness.** Comeau extracts non-trivial components once working (D20);
  Dodds lets JSX get "really long" (D3); TkDodo extracts per state early
  (D19).
- **Render props.** React team and Dodds: hooks replace them for logic
  sharing (A16, D9); Radix/Qiu keep `asChild`/render props when the consumer
  must control the element (C17, C24).
- **Headless/compound indirection.** Cure for prop explosion (D6, D8, C17,
  C12) vs readability cost of extra indirection (C24) and server/client
  boundary breakage (B3).

---

## 3. Where constants live

### Consensus

- Three-tier ladder: (a) module scope in the component file when one
  component uses it (A11, D23, D1); (b) sibling `constants.ts` when a
  component folder shares data between its files (D20's folder trigger);
  (c) app-wide `config/` (C1, C5) or a grouped constants module (D20) for
  env-derived config, breakpoints, public keys, feature flags.
- Static objects, arrays and functions that do not depend on props/state go
  to module scope, never the render body: new identity every render breaks
  effect dependencies and memo (A11). The React Compiler memoizes derived
  values inside components but does not change this (A12).
- Config is read once through a typed module (`config/`, `env.ts`); never
  `process.env` at call sites (C1, F12, C5). Matches this repo's
  SecretsProvider rule.
- Name magic values; `UPPER_CASE` only for exported, module-level, truly
  immutable values (D41, E2 §23.10, E3).
- `as const` object + derived union over `enum`; never `const enum` (E7,
  D31; Google E3 bans only `const enum`).
- User-facing text is not a constant. It lives in i18n message files with
  semantic keys; constants may map values to message keys (F10, F6).

### Contested

- **Folder vocabulary.** FSD/Steiger forbid `constants/` as a folder name and
  route constants to `shared/config` grouped by function (C8, C11); Comeau
  keeps one `src/constants.ts` (D20); bulletproof splits `config/` (env) from
  everything else (C1).
- **`enum`.** Handbook + Pocock prefer `as const`; Google keeps plain `enum`.

---

## 4. What goes to utils / helpers / lib / services

### Definitions the sources converge on

| Folder | Meaning | Sources |
|---|---|---|
| `helpers` | Pure, project/domain-specific; colocated with the feature or component (`X.helpers.ts`, `helpers.ts`). | D20, D46 |
| `utils` | Pure, generic, project-agnostic ("every function in lodash is a utility"). | D20, D40, C1 |
| `lib` | Preconfigured wrappers around third-party libraries and app infrastructure: api client, query client, `cn()`. | C1, C14, C5, D40 |
| `services` / `api` | I/O and external integrations. | D40, C5, C1 |

FSD/Steiger reject `utils`, `helpers`, `services`, `constants`, `types`,
`hooks` as folder names outright ("group by purpose, not essence", C11) and
allow only `ui/model/api/lib/config`. Next.js says folder names carry no
meaning (B1). Comeau/Wieruch/bulletproof/shadcn all use `utils`.

### Extraction criteria (when a function leaves the component)

1. It is pure and hook-free: takes inputs as arguments, reads no state or
   closure, has no side effects (D23, A13, A5). First move: module scope above
   the component in the same file (D23).
2. It is shared by the component's sibling files → `helpers.ts` next to the
   component (D20).
3. It is used by two or more features → promote to `src/helpers` / `src/utils`
   / `shared/lib` (D20, D22 "used by two features", D45 and D2 "three").
4. It deserves isolated tests (many edge cases, zero collaborators) → a named
   exported helper with `helpers.test.ts` beside it (D11, D12, D1).
5. Counter-criteria: don't extract on the first duplicate; inline an
   abstraction that grows parameters and conditionals (D30, D2). Never a
   flat junk-drawer `utils.ts`; split by concern (`date-utils.ts`) or by
   feature (D42, D41, C11).

### Types and schemas

- Types follow the same ladder: one use → same file; several → `*.types.ts`
  at the narrowest shared scope; several packages → shared package (D32).
  bulletproof: feature-local `types/` + global `src/types/` (C1). FSD: no
  `types` segment; types live in the `model`/`api` segment that owns them.
- Zod schema is the single source of truth; derive with `z.infer`
  (`z.input`/`z.output` when transforms differ); parse once at the boundary,
  never "shotgun parsing" (F11, D33). Contract schemas belong in a shared
  contract module (this repo: `vendor/shared`).

### Exports and file naming for helpers

- Named exports everywhere except framework-mandated files: Google (E3),
  Zakas (D34), Basarat (E6), Codemzy (D39), Kondov (D23). Airbnb 10.6 (E2)
  prefers default for single-export modules. Next.js route files and
  `React.lazy` force defaults (B5).
- One function per file vs grouped modules: no primary source mandates
  either; junk-drawer critiques favour small cohesive modules by concern.

---

## 5. Where business logic and state live

### Consensus

- Classify state before placing it. Five kinds, each with its own owner and
  tool: component/UI state (`useState`/`useReducer`), app-wide client state
  (context + hooks, Zustand, Jotai), server cache (TanStack Query, SWR, or
  Server Components/loaders), form state (React Hook Form + schema), URL
  state (search params) (G6, G28, G29, G25).
- Server data is a cache the frontend does not own. Keep it in the query
  cache or in Server Components; never copy it into `useState`, Redux or
  Zustand. The one sanctioned copy is form initial values, done deliberately
  (G15, G16, G19, G20, G25, G28, G29).
- Keep state minimal; derive the rest during render. Anything computable
  from props, state or other atoms is not state; a setter used only inside an
  effect means the state should go (A1, G1, G2, G26, G27, G14, G35).
- Colocate state with its user; lift only to the closest common parent;
  context only for tree-wide data (theme, user, router, a reducer + context
  module); providers rendered as deep as possible (A10, A9, A7, D5, G6, B2).
- Feature organization with one-way dependencies: shared → entities/features
  → pages/app; no sibling-feature imports; compose at the app level. Domain
  rules must not import UI (C1, C4, C5, G14, D22, G9, G8, G12).
- Queries are defined once, next to their feature. Wrap `useQuery` in a
  custom hook or a `queryOptions` object; everything the `queryFn` uses goes
  into the key; the fetcher, its schema and its hook live together (G20, G21,
  G22, G23, G17, G7).
- Event handler vs Effect is decided by "why does this run": caused by an
  interaction → handler; caused by being on screen → Effect; one Effect per
  synchronization process (G2, G3, G4).
- Custom hooks hold stateful/effectful logic; pure logic is a plain function.
  No `use` prefix when no hooks are called; reducers and domain transforms are
  pure, exportable and testable without React (A8, A6, G14, G12, G13).
- Parse once at every boundary, then trust the types: API responses (zod in
  the fetcher), search params (parsers / `validateSearch`), form input
  (resolver), Server Action arguments and Route Handler bodies (schema plus
  auth inside the action). DTO ↔ domain mapping lives in that boundary layer
  (D33, G48, G49, G39, G43–G46, G41, C4's `api` segment).
- Next.js App Router placement: reads in Server Components through a
  `server-only` Data Access Layer that authorizes and returns minimal DTOs;
  mutations through thin Server Actions that validate, re-authorize and
  delegate to the DAL; Route Handlers for public or non-UI endpoints and
  webhooks; `'use client'` only at interactive leaves; client fetching
  libraries only for client-only APIs, polling, infinite lists or optimistic
  UI (G42–G47, G18, G24).

### Contested

- **"Dumb" components plus a separate application/domain layer** (Stemmler
  G10–G11, Bespoyasov G12, FSD blog G8) vs **hooks + React Query as a
  sufficient logic container** (Abramov's 2019 retraction D15, Kondov D23,
  TkDodo G19, G34 "only export custom hooks"). react.dev splits the
  difference: no hooks called → plain function (A8). Dave Martin (G13) is the
  contrarian: hooks push toward a half-baked OO architecture.
- **Dedicated API/service layer** (bulletproof G7: schema + fetcher + hook per
  request; FSD `api` segment; Next.js DAL G43) vs **fetch in the component
  that displays it** (Kondov D23: don't hand-roll a service of async
  functions, use React Query where the data is shown).
- **Query key factories** (TkDodo 2021, G22) vs **`queryOptions`
  colocation** (TkDodo 2024, G23: "separating QueryKey from QueryFunction was
  a mistake").
- **Is React Query needed in an RSC app?** TkDodo (G24) and TanStack (G18):
  usually not for server-fetched reads; Next.js BFF guide (G47): yes for
  polling and client-only APIs; Remix (G29): most apps forgo client state
  libraries.
- **One global store with slices** (Zustand docs G30, G32) vs **many small
  stores** (TkDodo G34) vs **atoms** (Jotai G35).
- **Actions in the store vs module-level** (Zustand G31: either) and whether
  actions are events carrying business logic (TkDodo G34, Redux G14) or plain
  setters.
- **Layer direction for data access.** Fowler (G9): presentation → domain →
  data; Clean Architecture (G8, G12): domain innermost, adapters depend on it
  through ports. Both agree UI depends on domain and domain never imports UI.
- **Copying server state into form state.** Forbidden in general (G20),
  allowed as initial values for forms (G25); RHF keeps form state uncontrolled
  anyway (G41).
- **Context.** react.dev (A9) and Dodds (G28): props and composition first,
  lifting state is the answer; Zustand (G33) sells "no providers" as a
  feature; Next.js (B2) says providers must be client components rendered as
  deep as possible.

### Evidence worth quoting in the skill

- TanStack: server state "Implies shared ownership and can be changed by
  other people without your knowledge" (G15); after moving async state out,
  the leftover global client state "is usually very tiny" (G16).
- TkDodo: "Even if it's only for wrapping one useQuery call, creating a custom
  hook usually pays off"; "If you get data from useQuery, try not to put that
  data into local state" (G20).
- react.dev: "Use Effects only for code that should run because the component
  was displayed to the user" (G2); "If your function doesn't call any Hooks,
  avoid the use prefix" (A8).
- Redux style guide: "treat actions more as 'describing events that
  occurred', rather than 'setters'" (G14).
- Next.js: "A Data Access Layer should: Only run on the server. Perform
  authorization checks. Return safe, minimal Data Transfer Objects"; "only the
  Data Access Layer should access process.env" (G43).
- Bespoyasov: "If the project is small, a full implementation will be an
  overkill" — keep the domain pure and the dependency direction (G12).

---

## 6. Naming, exports, styling, i18n, tests, tooling

### Consensus

- Component identifiers are PascalCase and the file name matches the exported
  component; hooks are `useXxx` (A2, E1, D23, D20, E3).
- Pick one filename casing and enforce it with `eslint-plugin-check-file`
  (F25); Fast Refresh warns that `./header` vs `./Header` breaks on
  case-insensitive filesystems (B4). PascalCase (Airbnb, Comeau) and
  kebab-case (shadcn, Vercel, bulletproof) are both acceptable; mixing is not.
- Never `export default () => …`: anonymous components lose DevTools names
  and Fast Refresh state (A3, B4, D23).
- A component file exports only components plus framework-sanctioned
  constants; shared constants/helpers go to sibling files (B4, F26).
- Default exports only where the framework demands (`page/layout/loading/
  error.tsx`); otherwise consistent, with a modern lean to named (E3, C15,
  B11).
- Tests sit beside the source as `*.test.tsx` or in an adjacent `__tests__/`
  (D1, D14, B7, F13). Nobody credible defends a mirrored top-level `test/`
  tree.
- Next.js route folders stay thin: `page.tsx`/`layout.tsx` only, UI in
  `_components/` or `src/components/` (B1).
- Tailwind: utilities inline; reuse by extracting a React component (with
  `cva` variants + `cn`), not `@apply`; v4 tokens live in `@theme` in CSS
  (F1, F2, F3, F5). CSS modules + `@apply` got more awkward in v4 (F4).
- `@/*` path alias; `paths` is type-only, so Vitest needs
  `vite-tsconfig-paths` and libraries must not ship aliases (E8, B6, C3).
- Layering enforced by tooling: `import/no-restricted-paths` + `no-cycle`,
  `eslint-plugin-boundaries`, `dependency-cruiser`, Sheriff or Steiger; dead
  exports pruned with Knip (F17–F24).
- Import order: builtin → external → internal alias → parent → sibling →
  index, type imports separated (F16). Inside the file: imports → types/
  constants → helpers → component → exports. Only Kondov ("helpers before the
  component so the file reads top-down", D23) and Google (imports then
  implementation, E3) state an explicit in-file order; Comeau moves helpers
  and types into sibling files instead (D20).
- i18n: one JSON per locale, nested keys namespaced by component/page,
  camelCase leaves, no `.` in keys; a component asks for the lowest common
  namespace (F6).

### Contested

- **Default vs named exports.** Airbnb 10.6 and Comeau → default; Google,
  shadcn, Vercel OSS, Kondov, Zakas, Basarat → named; React docs neutral.
  `eslint-plugin-import` ships both `prefer-default-export` and
  `no-default-export` (F19).
- **File casing.** `Button.tsx` (Airbnb, Comeau, Kondov, Basarat for
  components) vs `button.tsx` (shadcn, bulletproof, Vercel repos, Bressain,
  Codemzy) vs `snake_case` (Google).
- **Tests folder.** `__tests__/` adjacent (Dodds, Next.js example) vs sibling
  `X.test.tsx` (Kondov, Vitest default).
- **i18n keys.** Hand-written namespaced keys (next-intl classic, i18next) vs
  extracted content-hash IDs (FormatJS F9, next-intl `useExtracted` F7).
- **`styles.ts` class-constant files.** No primary source endorses them;
  Tailwind's own advice is "a component, not a CSS abstraction"; `cva` is the
  endorsed way to name variant strings outside JSX.
- **Sheriff vs bulletproof.** Sheriff relies on `index.ts` barrels as module
  boundaries (F22); bulletproof says import files directly (C1).

---

## 7. Next.js App Router — architecture (second pass)

Scope: architecture and code organization only. Performance and plain API
reference are excluded; the `next-best-practices` skill already owns file
conventions, RSC validity rules and the data-fetching decision tree. Source
ids `H1`…`H91` are in `sources.md` §H.

### 7.1 Layouts, templates, route groups

Consensus:
- One root layout owns `<html>/<body>` and only globally shared UI; nested
  layouts per shell (marketing, app, auth, docs), usually inside route groups
  (H1, H2, H8, H35).
- Layouts persist and never rerender on navigation → they host the
  persistent shell and long-lived providers. By design they cannot read
  `searchParams`, pathname or the request; read those in the page prop or in
  a small Client Component the layout renders (`useSearchParams`,
  `usePathname`, `useSelectedLayoutSegment`) (H1, H2).
- Layouts cannot pass data to children and are not covered by their own
  segment's `loading.tsx` → uncached, request-time fetches move to
  `page.tsx` or into their own `<Suspense>` inside the layout (H2, H14).
- `template.tsx` only when state or effects must reset per navigation;
  default to layouts (H3, H11).
- Route groups partition by section, team or shell without touching URLs.
  Multiple root layouts are a listed use case but cost a full page reload
  across groups and break the single root `not-found` (H5, H6, H13).
- Real trees: taxonomy uses five groups under one root layout (H35);
  ai-chatbot puts request-dependent providers in `(chat)/layout.tsx` and
  keeps theme/session at root (H36); Cal.com uses groups as wrapper shells
  and keeps features in `modules/` (H40); Dub groups per product surface
  (H39); small Vercel apps use no groups at all (B11, H38).

### 7.2 Providers

- One or more `'use client'` provider components that take `children`,
  rendered from a Server Component layout, placed as deep as the consumers
  require: theme/session/query client at root, feature providers in the
  route group that needs them (B2, H9, H10, H36).
- TanStack: `getQueryClient()` returns a new client per server render and a
  browser singleton; avoid `useState` for the client above a suspending tree
  (G18, H72). Next.js's own guide renders the provider "from the nearest
  shared layout", not necessarily root, and keeps `queryOptions` in a
  shared "cache contract" module with no server-only or client-only imports
  (H33, H34).

Contested: root vs subtree providers. TanStack docs and Lee Robinson default
to root (G18, H9); the newer Next.js TanStack guide and the Server/Client
page say nearest shared layout, "as deep as possible" (H33, B2). Not a
contradiction in principle; the default shifted toward the subtree.

### 7.3 Boundaries: loading, error, not-found

- Per-segment hierarchy: `layout` → `template` → `error` → `loading` →
  `not-found` → `page`; each file wraps only what is below it in the same
  segment; `global-error.tsx` for root-layout failures (H14–H16).
- `loading.tsx` at the segment where instant navigation feedback should
  appear (recommended on dynamic routes); manual `<Suspense>` inside pages
  for independent slow parts; both coexist (H4, H14).
- `error.tsx` at the level whose shell must survive; errors bubble to the
  nearest boundary; event-handler errors are not caught by boundaries
  (H15, H16).
- `not-found.tsx` at root (also catches unmatched URLs) and nested where
  `notFound()` is thrown; call `notFound()` before any suspending `await`
  so the 404 status can still be sent (H6).

### 7.4 Parallel and intercepting routes

- Slots are layout props, not segments; every named slot needs
  `default.tsx`; all slots render on the server regardless of which the
  layout returns → authorize inside each slot or in the DAL (H17, H19).
- Intercepting routes are relative to route segments, not the file system;
  the modal pattern needs the real page, the intercepted page, a
  `@modal/default.tsx` returning null and a close path (H18, H20).
- Use only when the panel or modal deserves its own URL; disposable dialogs
  stay component state (H21, H22). Contested only in degree: docs and
  nextgram present them as the modal solution, practitioners list the
  `default.tsx`, `router.back()` and multi-slot stacking traps.

### 7.5 Proxy (middleware), auth placement

- Next 16 renamed `middleware.ts` to `proxy.ts` to "clarify network
  boundary"; the docs call it "recommended to be used as a last resort"
  (H23, H24, H66).
- What belongs there: headers, rewrites, A/B, locale detection, optimistic
  cookie-only redirects; always with a `matcher`. What does not: slow data
  fetching, session management, authorization (H23, H24).
- Authorization lives in a `server-only` Data Access Layer called from
  pages, Server Actions and Route Handlers; the matcher also skips Server
  Function POSTs on excluded paths (H24, G43, G46).
- Never gate access by returning `null` in a layout: layouts don't rerender
  on navigation and child segments, slots and actions still execute (G46,
  H2, H17). Taxonomy (2023) still gates in the dashboard layout; the current
  guide discourages it as the sole check (H35).
- CVE-2025-29927: a spoofable internal header skipped middleware entirely;
  Vercel: "We do not recommend Middleware to be the sole method of
  protecting routes" (H25).

### 7.6 i18n routing

- URL locales: `app/[locale]/…`, `i18n/{routing,request,navigation}.ts`,
  `proxy.ts`, `Link` imported from `i18n/navigation` (H26–H28, H30).
- Single or cookie locale (our mode): `i18n/request.ts` +
  `NextIntlClientProvider` in the root layout, plain `next/link`, no proxy,
  no `[locale]` segment (H29). Cal.com runs the same layout with an
  i18n provider at the app root (H40).

### 7.7 `src/`, monorepo, colocation vs `features/`

- `src/` is optional; if used, `app`, `components`, `lib` and `proxy.ts`
  move under it together; `.env` and config stay at root (H7, H68).
- Two schools, no official ruling (B1): "app is routing only" with
  `server/`, `features/` or `modules/` outside (create-t3-app H41,
  bulletproof C1, Cal.com H40, pipipi-dev H42) vs "colocate route-local code
  in the segment" (ai-chatbot H36, platforms H38, next-spa-patterns H34,
  Next.js TanStack guide H33, playground `_hooks`/`_patterns` H37).
- Observable hybrid in every repo checked: route-private files (actions,
  route handlers, page-only components, providers) live in the segment or
  route group; reusable domain and UI code lives outside `app/` in `lib/`,
  `components/`, `ui/`, `modules/` or `features/`.
- `src/` is used by create-t3-app, bulletproof-react and the next-intl docs,
  and absent from every Vercel-authored repo checked and from Dub/Cal.com.

### 7.8 Server Actions and forms

Consensus:
- Actions imported by Client Components come from a file-level
  `'use server'` module; inline `'use server'` functions only for
  Server-Component-only forms (H43, H44).
- Actions are thin: validate input with a schema → call a DAL function that
  does auth and authz → `updateTag`/`revalidateTag`/`revalidatePath` →
  `redirect`. Re-check authentication and ownership inside every action;
  page-level checks do not cover actions (H43, G43, H53, H54).
- Expected failures are returned as typed values and consumed via
  `useActionState`; unexpected failures throw to `error.tsx`; production
  masks thrown messages, which is why the return-value rule exists (H45,
  H15, H58). Never wrap `redirect()`/`notFound()` in try/catch (H43, H49).
- Return DTOs, not rows, from actions as well as from the DAL (G43).
- Typed wrappers come in three flavours: next-safe-action (result union +
  middleware-chained clients, H46–H50), zsa (tuple, H51), or a hand-rolled
  `validatedAction(schema, action)` of about thirty lines (H52).
  next-safe-action's `useStateAction` loses no-JS progressive enhancement;
  plain `useActionState` keeps it (H50).
- Schema placement: colocated in the actions file (H44, H53) or in a feature
  contract module importable by both the client form resolver and the
  action (H82).

Contested:
- Where actions live: route-scoped `app/(group)/actions.ts` (Next.js docs,
  leerob starter H53, ai-chatbot H54) vs feature-scoped
  `features/<x>/actions/` (Wieruch H57). Next.js refuses to arbitrate (B1).
- Throw vs return: docs say return (H15, H45); ai-chatbot's actions throw
  `Error('Unauthorized')` (H54); next-safe-action reconciles by catching
  throws into `serverError` (H49).

### 7.9 Data Access Layer, cache, revalidation

- Folder name varies: `data/` (Next docs G43), `lib/db/` + `queries.ts`
  (Vercel apps H55), `server/` (create-t3-app H41), `features/<x>/queries/`
  (Wieruch D22). Invariants: `import 'server-only'` at the top of every DAL
  module; the DB client instantiated once there; one exported function per
  query; `React.cache` for per-request dedup of non-fetch reads with an
  optional `preload()`; DTOs cross the RSC boundary; `process.env` only in
  the DAL or a validated env module (G43, H55, H63).
- The 2023 Vercel stance "fetch in the component that displays it" (H67) was
  demoted by the 2025 Data Security guide to "prototypes"; new projects get
  a DAL and "choose one approach and avoid mixing them" (G43).
- Caching moved from implicit route-level (14) → dynamic by default, opt-in
  per fetch (15, H65, H63) → explicit `use cache` on DAL functions or
  components with `cacheLife` and `cacheTag` declared at the data function
  and invalidation at the action (16, H59–H62, H66).
- Structural consequences: cached functions cannot read `cookies()`,
  `headers()` or `searchParams`; runtime values are read outside and passed
  as arguments; inputs and outputs must be serializable; "the deeper your
  async work sits in the tree, the more of the page can be prerendered"
  (H59, H60).
- Prefer tag-based invalidation over paths; `updateTag` in actions for
  read-your-own-writes; `revalidateTag(tag, profile)` elsewhere (H61).
  There is no tag registry in the docs; tags are strings coupled by
  convention, and a shared `cache-tags.ts` module is a community pattern,
  not a documented one.
- `unstable_cache` is "replaced by `use cache`" yet still named for
  cross-deploy persistence (H64, H60): deprecated in spirit, not removed.

### 7.10 Config and environment

- `NEXT_PUBLIC_*` values are inlined at build time; dynamic lookups are not
  inlined; after build the app no longer responds to env changes, so
  runtime-varying values are read on the server at request time or served
  through an endpoint (H68).
- Validate with a schema in `src/env.ts`, split into `env/server.ts` and
  `env/client.ts` when server variable names are sensitive; import it from
  `next.config.ts` to fail the build early; feature code imports `env`,
  never `process.env` (H69–H71, F12, G43).
- `next.config.ts` holds build and bundler concerns only; Next 16 removed
  `publicRuntimeConfig`/`serverRuntimeConfig` in favour of env (H66).

### 7.11 TanStack Query in App Router

- Layout: `lib/get-query-client.ts` (server: new client per request via
  `cache()`; browser: module singleton), `app/providers.tsx` client boundary,
  per-feature `queries.ts` exporting `queryOptions` factories consumed by
  both the RSC prefetch and the client `useSuspenseQuery`,
  `HydrationBoundary` per page (H72, H73, H75, G18).
- Never a module-level `QueryClient` on the server (shared cache across
  users); set `staleTime > 0` with SSR; prefer prefetch/hydration over
  `initialData` (H72, H74).
- The pure client-side variant is the same provider with no server
  prefetch, which is the sanctioned shape for SPA-style dashboards talking
  to an external API (H31–H33).

### 7.12 Contracts with a separate backend

- Three viable strategies for Next + Fastify: a shared zod contracts package
  (Turborepo just-in-time internal package, H78; Pocock's "narrowest
  boundary", H82); OpenAPI generated from Fastify schemas →
  `openapi-typescript` types + `openapi-fetch` client, or `orval` for React
  Query hooks plus MSW mocks (H79–H81); tRPC only when the backend is TS and
  the router type is importable (H76, H77).
- `lib/api.ts` stays the single typed fetch entry; a `{ data, error }`
  result shape mirrors the action-result union (H80, H49).

### 7.13 Error handling

- Expected (validation, auth-denied, not-found) → return values,
  `notFound()`, `redirect()`; unexpected → throw → `error.tsx`; never catch
  `redirect` (H15, H43).
- A central error class with codes and per-surface visibility lets the DAL
  throw rich errors while actions and route handlers decide what the client
  sees; ai-chatbot's `type:surface` taxonomy with `toResponse()` is the
  clearest real example (H56).

### 7.14 Testing App Router

- Layering: DAL queries, schemas, action wrappers and query factories are
  plain functions → Vitest node env with `next/cache`, `next/headers`,
  `next/navigation` mocked (H86); client components → Vitest + jsdom + RTL
  (B7); async Server Components and full flows → Playwright or equivalent
  against a production build (H83–H85).
- MSW is safe in the browser, jsdom and pure-node unit tests; for
  server-side RSC fetches the maintainer called it blocked (H88), Next 15
  fixed patch timing (H65), community repos boot the server worker from the
  root layout under a runtime guard (H89), Storybook mocks at module level
  instead (H90). `vitest-plugin-rsc` (H91) is an emerging alternative to
  "e2e only", not Vercel-endorsed.

### Next.js consensus, condensed for the skill

1. Root layout = `<html>/<body>` + globally shared UI; nested layouts per
   shell in route groups; avoid multiple root layouts unless sections share
   nothing.
2. Layouts persist and never rerender: providers and shell there; search
   params and pathname read in pages or small client components; uncached
   fetches out of layouts or behind their own `<Suspense>`.
3. Providers are client components taking `children`, rendered from server
   layouts, as deep as consumers require; `QueryClient` per request on the
   server and a singleton in the browser.
4. `loading.tsx` where navigation feedback belongs, `<Suspense>` inside pages
   for slow parts, `error.tsx` where the shell must survive,
   `not-found.tsx` at root; `notFound()` before suspending awaits.
5. Parallel/intercepting routes only for URL-addressable panels or modals;
   every slot has `default.tsx`; authorize inside slots.
6. Proxy = headers, rewrites, locale, optimistic redirects with a matcher;
   authorization = `server-only` DAL called from pages, actions and route
   handlers; never gate in a layout; never middleware alone.
7. Route-private code (actions, route handlers, page-only components,
   providers) colocated in the segment; reusable domain/UI code outside
   `app/`.
8. Actions: file-level `'use server'`, thin, schema-validated, re-authorize,
   DAL call, tag revalidation, redirect; expected errors returned as typed
   values for `useActionState`; DTOs out.
9. DAL: `server-only`, one function per query, `React.cache` + `preload`,
   runtime values as arguments, `use cache` + `cacheLife` + `cacheTag`
   declared at the data function, tag invalidation at the action.
10. Env through one validated module imported by `next.config.ts`;
    `NEXT_PUBLIC_*` are build-time constants.
11. Contracts with a separate backend: one source of truth (shared zod
    package or OpenAPI codegen); a single typed fetch entry.
12. Tests: plain-function unit tests for DAL/actions/queries, jsdom for
    client components, e2e for async RSC.

---

## 8. Fit with the DevDigest client (what the skill must reconcile)

Current conventions (root `CLAUDE.md`, `client/CLAUDE.md`,
`client/docs/ui-architecture.md`):

| Convention here | Research verdict |
|---|---|
| Folder = component in PascalCase (`FindingsPanel/FindingsPanel.tsx`) with `helpers.ts`, `constants.ts`, `styles.ts`, `index.ts`, tests beside | Matches Comeau/Kondov/Wieruch (D20, D23, D22). The `index.ts` per component is the contested part: keep it as a one-level, named-only redirect, never layer-wide barrels (D37); or drop it as bulletproof/shadcn do. |
| Route-private components in `app/**/_components/`, shared in `src/components/<kebab-case>/` | Exactly Next.js strategy (c) "split by feature or route" (B1) and the two-tier rule (§1). Hybrid casing (PascalCase component folders inside kebab-case shared folders) is the one thing to make explicit and lint (F25). |
| Hooks grouped by domain in `src/lib/hooks/<domain>.ts`, re-exported by `hooks/index.ts` | Domain grouping matches "queries colocated per feature, keys from entity to id" (G20, G22, G23); the re-exporting `index.ts` is a barrel over every hook file — the anti-barrel sources (D18, D36) would import per domain file. Decide in the skill. Query definitions are `useQuery` wrappers, not `queryOptions` objects; TkDodo's 2024 advice (G23) would move to `queryOptions` only if the same query is needed imperatively (prefetch, `ensureQueryData`). |
| All server calls through `lib/api.ts` + TanStack Query hooks; no raw fetch | Matches `lib` = preconfigured infrastructure (C1, C14), services-as-I/O (§4), and bulletproof's single preconfigured client (G7). |
| Every page is a Client Component; no Server Components, no Server Actions, no DAL | Deliberate (local-first studio, one Fastify API). The Next.js DAL/Server Action guidance in §5 does not apply today; TkDodo's "you might not need React Query" (G24) does not apply either, since all reads are client-side and polled. The skill should say this explicitly so the RSC rules are not applied by reflex. |
| Server data never copied to `useState`; filters/sort computed in memory from the query result; `?status` and `?trace` in the URL | Matches "derive, don't store" (G1, G26) and URL-as-state (G36–G39). |
| Root `layout.tsx` is an async Server Component (`getLocale`, `getMessages`) that renders `NextIntlClientProvider` → `<Suspense>` → client `Providers` (QueryClient, Theme, Toast, Repo) around `children` | Textbook shape of §7.2 and the SPA guide (H31): server shell, one client provider stack taking `children`, rendered as deep as it can go given that every page is client-side. The `QueryClient` is created with `useState`; H72/G18 warn about that only above a suspending server tree, which does not apply here. |
| Most `page.tsx` files are thin route entries that mount a view from `_components/<View>/`; the exception is `repos/[repoId]/pulls/[number]/page.tsx` (185 lines: tabs, run invalidation, trace drawer wiring) and, to a lesser degree, `pulls/page.tsx` (in-memory filter/sort); `_components` nest up to three levels (`AgentEditor/_components/ConfigTab`) | Colocation school (H33, H34, H36, H37) and Next.js strategy (c) (B1). The PR detail page is a known deviation from "thin entry" and is listed as a refactor candidate in `client/INSIGHTS.md`, not refactored unprompted. Depth: three nested `_components` levels reach the "3–4 nesting levels" ceiling (A14, D24); the skill treats deeper nesting as a review signal. |
| No route groups, no nested layouts, no `loading.tsx`/`error.tsx`/`not-found.tsx` anywhere | Route groups are unnecessary at this size (B11, H38). Missing boundaries are the one clear gap: §7.3 recommends `error.tsx` where the shell must survive and root `not-found.tsx`; today a thrown render error unmounts the whole app. Query errors are handled inline (`ErrorState`), so the gap is only for non-query render errors. |
| No `proxy.ts`/`middleware.ts`; no auth; single locale without i18n routing | Correct for the no-routing next-intl mode (H29) and for a local-first tool; the proxy/DAL/auth rules in §7.5 are not applicable and the skill should say so. |
| Single env var `NEXT_PUBLIC_API_BASE`, read in `lib/api.ts` and defaulted again in `next.config.mjs` `env` | Read in exactly one module, as §7.10 asks. The duplicate default in `next.config` is the kind of build-time inlining H68 describes; a validated `env.ts` (H69) would replace both, but is overkill for one variable. |
| Contract: zod schemas copied from `server/src/vendor/shared` into `client/src/vendor/shared` | The copy is the weak point §7.12 names: every source treats one source of truth as the goal (H78, H82). Options ranked by effort: keep the copy with a mirror check, generate OpenAPI from Fastify's zod schemas and use `openapi-fetch` (H79, H80), or a real shared package (would require a workspace, which the repo deliberately is not). |
| Tests: Vitest + jsdom for client components with hooks mocked per file; e2e via agent-browser flows | Matches §7.14 for an all-client app; no async Server Components exist, so the e2e-only rule for RSC does not bite. |
| Contract types re-exported from `vendor/shared`; no local API shapes | Matches "zod schema as source of truth, parse at the boundary" (F11, D33) and Pocock's shared-package tier (D32). |
| Inline `style` objects in `styles.ts`; no Tailwind classes in components | Outside the Tailwind consensus (F1); but the project has no Tailwind in components by decision, so the skill should describe `styles.ts` as the project's variant-naming layer (the role `cva` plays elsewhere). |
| Strings through next-intl, one namespace per file, camelCase nested keys | Matches F6 and the i18n-vs-constants rule (§3). |
| Secrets behind SecretsProvider, no `process.env` in feature code | Matches C1, F12, C5. |
| No linter configured (typecheck + tests are the gate) | Every boundary rule in §1 is enforced by ESLint elsewhere. The skill must state the rules as review checks, since there is no `eslint-plugin-boundaries` here and the root `CLAUDE.md` says not to add a linter unprompted. |

Open decisions for the skill author (not settled by the research):

1. Keep or drop per-component `index.ts` (and `lib/hooks/index.ts`).
2. Numeric thresholds: keep `react-best-practices`' "200 lines / 5–7 props" as
   hard rules or downgrade to review signals (§2 contested).
3. Whether `helpers.ts` vs `utils` naming is fixed per folder or free.
4. Whether to adopt a `features/` layer or stay with route-private
   `_components/` + shared `components/` (current size is well under the
   thresholds in §1).
5. Whether the skill should add `error.tsx` and `not-found.tsx` boundaries as
   a required part of every Next.js route tree, or only recommend them
   (§7.3, §8).
6. How far the Next.js server-side rules (DAL, Server Actions, `use cache`,
   proxy) should be stated in a skill for a project that is deliberately
   all-client with a separate API: as a separate "when you have a server
   layer" section, or omitted with a pointer to `next-best-practices`.
7. Which contract strategy to recommend for the vendored zod copy (§7.12).
