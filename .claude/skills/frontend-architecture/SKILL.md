---
name: frontend-architecture
description: "Where frontend code lives in client/ and how it is split. Use when creating, moving or splitting a component, hook, helper or constant in client/, adding a route, or deciding where code should live. Covers folder placement, the index.ts component boundary, helpers vs lib, hooks by domain, Next.js route boundaries, API contract types, review signals with thresholds, and the triggers that would change this architecture."
metadata:
  version: 1.0.1
  applies_to: "client/src/**, client/messages/**, !client/src/vendor/**"
  blocking: "true"
---

# Frontend architecture (client/)

Rules for WHERE code lives and HOW it is split in `client/` (Next.js App
Router, React, TanStack Query, next-intl; versions: root `CLAUDE.md` →
Stack). Decisions below are settled; change them only through the triggers
in "Architecture-change triggers".

Related skills, do not duplicate:
- `react-best-practices` — how a component/hook is written (purity, state,
  effects, memoization). This skill says where it goes and when it splits.
- `next-best-practices` — Next.js file conventions, RSC validity rules,
  data-fetching decision tree, error/not-found APIs.
- `package-docs` — after any change here, update `client/docs/ui-architecture.md`.

Evidence: `references/research.md` (findings, consensus vs contested, fit
with this client) and `references/sources.md` (275 cited sources). Read them
on demand; section pointers below are to `research.md`.

## Map — where things live

| Code | Location | Notes |
|---|---|---|
| Route entry | `src/app/<route>/page.tsx` | Thin: mounts one view from `_components/` or composes a few. No data logic beyond reading params/search params. |
| Route-private view or component | `src/app/<route>/_components/<Name>/` | PascalCase folder = component name. Used by this route only. |
| Shared component | `src/components/<kebab-case>/<Name>.tsx` | Used by ≥2 routes. Domain-specific is fine (`severity-summary`), see triggers for `features/`. |
| UI primitive | `src/vendor/ui` (`@devdigest/ui`) | Extend the kit; never add a component library. |
| Data hooks | `src/lib/hooks/<domain>.ts` | One file per API domain (`core`, `agents`, `reviews`, `trace`, `repo-intel`). Import from the domain file; there is no `lib/hooks/index.ts`. |
| App infrastructure | `src/lib/<topic>.ts(x)` | `api.ts`, `providers.tsx`, `theme.tsx`, `toast.tsx`, `repo-context.tsx`, `types.ts`. |
| Shared pure functions | `src/lib/<topic>.ts` | kebab-case, named by topic (`github-urls.ts`, `model-label.ts`). |
| Component-local pure functions | `helpers.ts` beside the component (or beside the route for route-wide ones) | With `helpers.test.ts` when non-trivial. |
| Constants | `constants.ts` beside the component/route; module scope in the file when only that file uses them | Never inline static objects/arrays in the render body. |
| Styles | `styles.ts` beside the component (`s.<name>` inline objects) | Media queries and keyframes only in `src/app/globals.css`. |
| Types | Contract types via `src/lib/types.ts` → `@devdigest/shared`; local UI-only types in the file that uses them | No local API response shapes (R7). |
| Strings | `messages/en/<namespace>.json` | Never hard-coded user-facing text. |
| Tests | `<Name>.test.tsx` / `helpers.test.ts` beside the source | Fixtures in a non-test file. |

Component folder anatomy (`_components/<Name>/` and `components/<kebab>/`):
`<Name>.tsx` + optional `constants.ts`, `helpers.ts`, `styles.ts`,
`<Name>.test.tsx`, nested `_components/` for sub-views, and `index.ts` (R1).

## Rules

### R1 — `index.ts` is a component's public boundary, never a layer barrel
- One `index.ts` per component folder. It contains only named re-exports of
  the component and its public types:
  `export { FindingsPanel } from "./FindingsPanel"; export type { FindingsPanelProps } from "./FindingsPanel";`
- No `export *`. No `export { X as default }` unless a default import of it
  exists somewhere (Next.js route files are the only place that needs
  defaults).
- Applies to new and changed `index.ts` files only. Existing `index.ts` files
  that still carry `as default` are not rewritten in passing; today the only
  real default import of a component folder is `RunTraceDrawer` in
  `src/app/repos/[repoId]/pulls/[number]/page.tsx`.
- Barrel files over a whole layer are forbidden: no `components/index.ts`,
  no `lib/hooks/index.ts`, no `lib/index.ts`. Import the concrete file
  (`@/lib/hooks/reviews`, `@/components/severity-summary`).
- Why: a per-component index is a one-level redirect; layer barrels pull the
  whole layer into every importer and break tree-shaking and test start-up
  (research §1 contested, §6).

### R2 — Placement ladder: colocate first, promote on the second consumer
1. Used by one file → stays in that file (module scope for constants and
   pure functions, above the component).
2. Used by the component and its siblings → `helpers.ts` / `constants.ts`
   beside it.
3. Used by ≥2 routes → `src/components/<kebab>/` for UI, `src/lib/<topic>.ts`
   for pure functions, `src/lib/hooks/<domain>.ts` for data hooks.
- Do not promote on the first duplicate; two copies are cheaper than a wrong
  abstraction. Promote at the second unrelated consumer (research §1, §4).
- Dependency direction: `vendor/ui` and `vendor/shared` → `lib/` →
  `components/` → `app/`. Nothing in `lib/` or `components/` imports from
  `app/`. Route folders never import from another route folder; shared code
  goes through `components/` or `lib/`.

### R3 — Naming pure functions: `helpers.ts` local, `lib/<topic>.ts` shared
- A pure function used by one component (or one route) lives in `helpers.ts`
  beside it.
- A pure function used by ≥2 routes lives in `src/lib/<topic>.ts`,
  kebab-case, named by what it is about (`github-urls.ts`, `date-format.ts`),
  never by what it is (`utils.ts`, `helpers.ts`, `misc.ts`).
- `src/lib/utils.ts` and `src/lib/helpers.ts` are forbidden: a junk drawer
  grows unrelated functions and hides them from every caller (research §4).
- A function that calls a hook is a hook (`useX`) and lives in
  `lib/hooks/<domain>.ts` if it talks to the API, otherwise beside its
  component. A function that calls no hook has no `use` prefix.

### R4 — Structure is fixed: `_components/` per route, `components/` shared, hooks by domain
- Route views: `app/<route>/_components/`. Sub-views of a view nest as
  `_components/<View>/_components/<Sub>/`.
- Shared UI: `components/<kebab>/`. A route-private component moves here the
  moment a second route needs it; it must then import nothing from `app/`.
- Hooks: `lib/hooks/<domain>.ts`, one file per API domain, query keys start
  with the entity name and the id. A new API domain = a new file, not a
  section in an existing one.
- No `features/` layer now. See "Architecture-change triggers" for when
  that changes.

### R5 — Next.js boundaries: root `error.tsx` and `not-found.tsx` only
- Target state: `src/app/error.tsx` (client component) and
  `src/app/not-found.tsx`. Nothing else at root is required.
- Both are ABSENT today. They are added only as a dedicated task, never as a
  side effect of another change; do not create them "while you are there".
- A segment-level `error.tsx` is added only when that segment gets its own
  `layout.tsx` (a shell worth keeping alive). No `loading.tsx` files: every
  page fetches client-side through TanStack Query and renders its own
  pending state.
- `page.tsx` stays thin; `layout.tsx` never reads search params
  (research §7.1, §7.3).

### R6 — No Next.js server layer here
This client is deliberately all-client with a separate Fastify API: every
page is a Client Component, every read and write goes through `lib/api.ts`
and a `lib/hooks/<domain>.ts` hook. Do NOT add Server Actions, a Data Access
Layer, `use cache`, `proxy.ts`/middleware, or server-side data fetching,
even when `next-best-practices` describes them as the default. Those rules
apply once the "Next.js server layer" trigger fires; until then see
`next-best-practices` for the API surface and research §7.5, §7.8–7.9 for
the architecture they imply.

### R7 — API types come only from the contract
- Response and request shapes are imported through `src/lib/types.ts` from
  `@devdigest/shared` (`src/vendor/shared`, a copy of the server master).
  Never declare a local interface for an API payload; never `as` a fetch
  result into a hand-written type.
- `vendor/shared` is edited only by mirroring the server master
  (`server/CLAUDE.md`). Strategy today: keep the copy and check it against
  the master; OpenAPI codegen replaces the copy only via the trigger below
  (research §7.12).

## Review signals (not rules)

A signal means "look and justify", not "split". Existing violations are not
refactored unless the task asks for it.

| Signal | Threshold |
|---|---|
| Long component file | > 200 lines |
| Wide props surface | > 7 props |
| Deep nesting | `_components` deeper than 3 levels (`route/_components/A/_components/B/_components/C` is the limit) |
| Effect-heavy component | > 1 `useEffect` in one component |
| Server data copied into state | any `useState` initialised or synced from a `useQuery` result |
| Fat route entry | a `page.tsx` with data logic beyond reading params/search params and mounting a view (query invalidation, derived state, drawer/tab wiring) |

When a file you changed trips a signal, the task report carries one line per
file:

```
Signals: <file> <signal> — kept: <reason> | split into <A>, <B>
```

Examples: `Signals: RunHistory.tsx >200 lines — kept: single timeline, no
second consumer` · `Signals: page.tsx >1 useEffect — split into
useReviewRefresh (lib/hooks/reviews.ts)`.

Why signals, not caps: the React team expects function components to get
longer with hooks, and every credible source splits on responsibility, not
line count (research §2 contested). `react-best-practices` defers to this
table for thresholds.

## Architecture-change triggers

A trigger firing means: do not restructure silently. Propose the change to
the user, and when accepted record the decision in
`client/docs/ui-architecture.md` (and update this skill).

Before proposing, read the "Architecture decisions" section of
`client/docs/ui-architecture.md`. If the trigger was already deferred there,
do not propose it again until the new condition named in that entry has
appeared; mention the deferred entry in the report instead.

| Trigger | Fires when | Change |
|---|---|---|
| Introduce `features/<domain>/` | Code of one domain sits in ≥2 of `components/`, `lib/hooks/`, `lib/` AND its UI is used by ≥2 routes; OR `components/` holds ≥3 domain widgets (not primitives) of the same domain; OR the domain must be extracted or shared with another project. First candidate: `reviews` (`severity-summary`, `findings-preview`, `run-cost-badge`, `lib/hooks/reviews.ts`). | Move the domain's components, hooks and helpers under `src/features/<domain>/`; features never import each other; `app/` composes them. |
| Next.js server layer | SSR is needed, or an auth cookie / secret must live in the browser-facing app and cannot stay in the Fastify API. | Add a `server-only` DAL and thin Server Actions per research §7.8–7.9; `next-best-practices` for APIs; proxy only for optimistic redirects (§7.5). |
| OpenAPI instead of the contract copy | A first API consumer that is not this client appears (CI, another project's integration). | Generate the spec from Fastify's zod schemas; `openapi-typescript` + `openapi-fetch` in `lib/api.ts`; delete `client/src/vendor/shared`. |
| Segment `error.tsx` | A nested `layout.tsx` appears under `src/app/`. | Add `error.tsx` next to that layout (R5). |

## Checklist — before reporting a change in `client/`

- [ ] New file is in the row of the Map that matches its role; the name
      follows R3/R4 (PascalCase component folder, kebab-case shared folder
      and `lib/<topic>.ts`).
- [ ] `index.ts` (if any) has only named re-exports; no layer barrel was
      created or imported (R1).
- [ ] Nothing in `lib/` or `components/` imports from `app/`; no route
      imports another route (R2).
- [ ] No `utils.ts`/`helpers.ts` at `lib/` root; no `use`-prefixed non-hook (R3).
- [ ] No Server Action, DAL, `use cache`, proxy or server fetch added (R6).
- [ ] No local API type; contract types only (R7).
- [ ] Every signal tripped by a changed file has a `Signals:` line in the
      report.
- [ ] A trigger that fired was proposed, not applied.
- [ ] `client/docs/ui-architecture.md` updated if a location, layer or
      boundary changed (`package-docs`).
- [ ] `pnpm typecheck` and `pnpm test` pass.

## References

- `references/research.md` — §1 placement, §2 splitting, §3 constants,
  §4 helpers/lib, §5 state and logic, §6 naming/tests/tooling, §7 Next.js
  App Router architecture, §8 fit with this client and open decisions.
- `references/sources.md` — every cited source with URL and why it matters.
