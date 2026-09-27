# client — ui-architecture

Last verified: 2026-09-27 (L02 Stage 5: skills page)

## Purpose

`@devdigest/web` is the Next.js 15 studio: it lists repos and pull requests,
starts review runs, streams their live log, and shows persisted reviews,
findings and run traces. It owns no review logic and no persistence — every
byte of data comes from the Fastify API through one typed fetch client and
TanStack Query hooks. There is no login, one locale (`en`), and no server-side
data fetching: every page is a Client Component that reads the API from the
browser.

## Layout

| Path | Role |
|---|---|
| `src/app/layout.tsx` | Root layout: `next-intl` provider with all namespaces, theme no-flash script, `Providers`. |
| `src/app/**/page.tsx` | Routes (`/`, `/onboarding`, `/repos/[repoId]/pulls`, `/repos/[repoId]/pulls/[number]`, `/agents`, `/agents/[id]`, `/skills`, `/skills/[id]`, `/settings/[section]`). Thin: a page mounts one view or composes `_components/`. |
| `src/app/**/_components/<Name>/` | Route-private components: `<Name>.tsx` + `constants.ts`, `helpers.ts`, `styles.ts`, `index.ts`, tests beside the source. |
| `src/components/<kebab>/` | Shared components (`app-shell`, `diff-viewer`, `findings-preview`, `severity-summary`, `run-cost-badge`, `page-shell`, `repo-not-found`, `mermaid-diagram`, `showcase`, `skill-type-badge`, `skill-source-chip`). |
| `src/lib/api.ts` | `apiFetch` + `api.get/post/put/patch/del`; base URL from `NEXT_PUBLIC_API_BASE`; every failure becomes `ApiError { status, code, details }`. |
| `src/lib/hooks/<domain>.ts` | All TanStack Query hooks (`core`, `agents`, `reviews`, `trace`, `repo-intel`, `skills`). Imported from the domain file (`@/lib/hooks/core`); there is no `hooks/index.ts` barrel (see `.claude/skills/frontend-architecture`, R1). |
| `src/lib/providers.tsx` | `QueryClient` (retry 1, staleTime 30 s, no refetch on focus, global error toasts) → `ThemeProvider` → `ToastProvider` → `RepoProvider`. |
| `src/lib/repo-context.tsx` | Active repo: URL `:repoId` > `localStorage("dd-repo")` > first repo; `useRepoNotFound`. |
| `src/lib/theme.tsx`, `src/lib/toast.tsx` | `data-theme` on `<html>` + `localStorage("dd-theme")`; toast context plus the module-level `notify` bridge used outside React. |
| `src/lib/types.ts` | Re-exports contract types from `@devdigest/shared`; no local API shapes. |
| `src/lib/severity.ts`, `src/lib/finding-format.ts`, `src/lib/cost-format.ts` | Pure helpers shared by ≥2 routes: severity order / counts / sort (counts typed with the contract `FindingsBySeverity`), a finding's line label, run-cost formatting; each with its `*.test.ts`. |
| `src/i18n/request.ts` | Single locale; merges every `messages/en/<ns>.json` into `{ [ns]: … }`. |
| `messages/en/*.json` | One namespace per file (`prReview`, `runs`, `agents`, `settings`, `shell`, …). |
| `src/vendor/ui/` | `@devdigest/ui` — the in-house design system (tokens, primitives, kit, shell, charts); see its `README.md`. |
| `src/vendor/shared/` | COPY of `../server/src/vendor/shared` (zod contracts); edited only by mirroring the server master. |
| `src/test/setup.ts`, `vitest.config.ts` | jsdom + Testing Library; aliases `@`, `@devdigest/shared`, `@devdigest/ui`; tests match `src/**/*.test.{ts,tsx}`. |
| `src/test/fixtures.ts`, `src/test/mutation-mock.ts` | Shared contract factories (`finding`, `pr`, `review`, `skill`, `agent`) and `fakeMutation` — a stand-in for a mocked mutation hook that keeps `isPending` / `isSuccess` / `data` state, so "Saved (vN)" UI can be tested with mocked hooks. |

Path aliases (`tsconfig.json:22-28`): `@/*` → `src/*`, `@devdigest/shared` →
`src/vendor/shared/index.ts`, `@devdigest/ui` → `src/vendor/ui/index.ts`.
`vitest.config.ts` repeats the same three aliases.

## Data flow — rendering the PR list

1. `src/app/repos/[repoId]/pulls/page.tsx` reads `:repoId` from `useParams`
   and the `?status` filter from `useSearchParams` (`page.tsx:29-39`).
2. `usePulls(repoId)` (`src/lib/hooks/core.ts:102-110`) runs
   `api.get("/repos/:id/pulls")` with a 60 s `refetchInterval`; the response is
   `PrMeta[]` straight from the contract.
3. The page filters by status (default `needs_review`), text and sort in
   memory (`page.tsx:49-58`) and renders one `PRRow` per PR
   (`src/app/repos/[repoId]/pulls/_components/PRRow/PRRow.tsx`).
4. `PRRow` derives display-only fields (S/M/L bucket, relative time) with
   `pulls/helpers.ts` and delegates the FINDINGS column to `FindingsCell`,
   which reads `pr.latest_batch` and fetches the batch's findings lazily
   through `usePrReviews(pr.id, { enabled: wanted })` only after hover intent
   (`PRRow/FindingsCell.tsx:24-32`, `:51-52`).
5. Responsive layout is done with CSS variables: the `.pr-list` class in
   `src/app/globals.css:31-51` switches `--pr-grid` and spacing under 1185 px,
   while the inline styles in `pulls/styles.ts` read those variables with
   fallbacks; the two grid templates `GRID` / `GRID_NARROW` and
   `NARROW_MAX_WIDTH` live in `pulls/constants.ts:27-37`.

## Data flow — one review run from the PR page

1. `RunReviewDropdown` calls `useRunReview().mutateAsync({ prId, all | agentId })`
   → `POST /pulls/:id/review`; the response carries `runs[].run_id` and an empty
   `reviews` array (`RunReviewDropdown/RunReviewDropdown.tsx:41-49`,
   `src/lib/hooks/reviews.ts:127-139`).
2. The page switches to the findings tab and invalidates
   `["pr-active-runs", prId]` (`[number]/page.tsx:132-133`); `usePrActiveRuns`
   polls `GET /pulls/:id/runs/active` every 4 s while anything is running
   (`src/lib/hooks/reviews.ts:28-35`).
3. `FindingsTab` mounts `RunStatus` for the live run ids; `useRunEvents` opens
   one `EventSource` per run on `GET /runs/:id/events`, appends every
   `info | tool | result | error` frame to state, toasts `error` frames and
   flips `running` to false when the last stream closes
   (`src/lib/hooks/reviews.ts:171-219`).
4. When `running` drops, `RunStatus` fires `onDone` and the page invalidates
   active runs and run history and refetches reviews
   (`RunStatus/RunStatus.tsx:23-26`, `[number]/page.tsx:156-160`).
5. The refetched `ReviewRecord[]` renders one `ReviewRunAccordion` per review
   (newest first) with a `VerdictBanner` and a `FindingsPanel`; the run
   timeline (`RunHistory`) reads `usePrRuns` and matches findings to runs by
   `run_id`; `?trace=<runId>` mounts `RunTraceDrawer`, which loads
   `GET /runs/:id/trace` through `useRunTrace`.

## Boundaries & dependencies

- **No raw `fetch` in components.** Everything goes through `src/lib/api.ts`
  and a hook in `src/lib/hooks/`; `useRunEvents` is the one direct browser
  API use (`EventSource`) and still builds its URL from `API_BASE`.
- **Contracts are read-only here.** `src/vendor/shared` is a copy of the
  server master; `src/lib/types.ts` only re-exports. Response shapes are
  documented in `../server/specs/review-flow.md` and `../server/README.md`.
- **UI kit only.** Components import primitives from `@devdigest/ui`
  (`src/vendor/ui`), never from a third-party component library; new visual
  atoms are added to the kit (`src/vendor/ui/README.md`).
- **Styling.** Inline `style` objects collected in a colocated `styles.ts`
  (`s.<name>`), CSS variables from the kit's `src/vendor/ui/styles.css`, and a small
  `src/app/globals.css` for what inline styles cannot express (media queries,
  keyframes). No CSS modules, no Tailwind utility classes in components.
- **i18n.** User-facing strings go through `useTranslations("<ns>")`; tests
  wrap components in `NextIntlClientProvider` with the namespace JSON.
- **Errors.** `ApiError` is thrown by `apiFetch`; the `QueryCache` toasts only
  network (`status 0`) and 5xx errors, the `MutationCache` toasts every
  mutation error (`src/lib/providers.tsx:35-43`); pages render `ErrorState`
  for query failures and `RepoNotFound` for a stale `:repoId`.
- **Tests never hit the API.** Hooks are mocked with `vi.mock` per test file
  (see `PRRow/PRRow.test.tsx`); `src/test/smoke.test.tsx` renders the kit
  gallery in both themes.

## Extension points

- **New page:** `src/app/<route>/page.tsx` that mounts `AppShell` (crumbs) and
  a view under `_components/<View>/`; add nav entries in
  `src/vendor/ui/nav.ts` (`NAV`, `SETTINGS_SECTIONS`) so `g`-then-key and the
  sidebar know it.
- **New API call:** a hook in the matching `src/lib/hooks/<domain>.ts` with a
  `queryKey` that starts with the entity name and the id; invalidate that key
  from mutations that change it.
- **New shared component:** `src/components/<kebab-case>/<Name>.tsx` +
  `index.ts`, tests beside it; build contract objects with the shared
  factories in `src/test/fixtures.ts` (`finding`, `pr`, `review`, `skill`,
  `agent`) and pass
  overrides; component-specific fixtures go in a non-test file beside the
  test.
- **New strings:** add to the namespace JSON under `messages/en/`; camelCase
  nested keys.

## Architecture decisions

Dated log of the `frontend-architecture` skill's triggers that fired and what
was decided. A deferred trigger is not proposed again until its "revisit
when" condition appears.

- 2026-09-26 — Trigger `features/reviews/` fired: `components/` holds three
  domain widgets of the `reviews` domain (`severity-summary`,
  `findings-preview`, `run-cost-badge`) plus `lib/hooks/reviews.ts`.
  Decision: deferred by the user; the layout stays `_components/` +
  `components/` + `lib/hooks/<domain>.ts`. Revisit when a fourth `reviews`
  widget lands in `components/` or the trigger fires for a second domain.
- 2026-09-27 — The severity helpers of the `reviews` domain moved from
  `components/severity-summary/helpers.ts` (re-exported by its `index.ts`) to
  `src/lib/severity.ts`, with `lineLabel` → `src/lib/finding-format.ts` and
  `formatCost` → `src/lib/cost-format.ts`, so component `index.ts` files export
  only components (R1). When `features/reviews/` is introduced, these files
  move there. This does not change the deferred trigger's revisit condition
  above.
- 2026-09-27 — Shared test factories live in `src/test/fixtures.ts`, one per
  contract type (`finding` → `FindingRecord`, `pr` → `PrMeta`, `review` →
  `ReviewRecord`), beside `src/test/setup.ts`. Tests only: vitest collects
  `src/**/*.test.{ts,tsx}` (`vitest.config.ts`), so the file is never run as a
  test and no app code imports it. Replaces the per-test copies in `PRRow`,
  `FindingsPanel`, `RunHistory` and `findings-preview/test-fixtures.ts`.
  Rejected: keeping it in a component folder (route tests would import a
  component's internals) and `src/lib/` (app code). Recorded as a Map row in
  the `frontend-architecture` skill (1.1.0).

## Open questions

- `src/lib/types.ts:37-48` declares `PrRowView`, and
  `src/app/repos/[repoId]/pulls/constants.ts:34` refers to `.pr-table` rules
  in `globals.css` while the class is `.pr-list` (`globals.css:31`); both look
  like leftovers. Unverified whether anything reads `PrRowView`.
- `src/app/agents/[id]/page.tsx:15` allows only the `config` tab; the editor
  keeps `?tab=` for later lessons.
