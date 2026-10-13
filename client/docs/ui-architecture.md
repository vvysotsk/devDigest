# client — ui-architecture

Last verified: 2026-10-01 (HW02 Stage 2c: /conventions, features/skills form pieces)

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
| `src/app/**/page.tsx` | Routes (`/`, `/onboarding`, `/repos/[repoId]/pulls`, `/repos/[repoId]/pulls/[number]`, `/agents`, `/agents/[id]`, `/skills`, `/skills/[id]`, `/conventions`, `/settings/[section]`). Thin: a page mounts one view or composes `_components/`. |
| `src/app/**/_components/<Name>/` | Route-private components: `<Name>.tsx` + `constants.ts`, `helpers.ts`, `styles.ts`, `index.ts`, tests beside the source. |
| `src/components/<kebab>/` | Shared components that belong to no domain feature (`app-shell`, `diff-viewer`, `page-shell`, `repo-not-found`, `mermaid-diagram`, `showcase`). They never import `features/`. |
| `src/features/<domain>/` | Domain features (frontend-architecture R4, 2.0.0): a grown domain's shared UI (`components/<kebab>/`), data hooks (`hooks.ts`) and pure functions (`lib/<topic>.ts`), no barrel at the root. `features/reviews/`: `components/{severity-summary,findings-preview,run-cost-badge}`, `hooks.ts`, `lib/{severity,finding-format,cost-format}.ts`; `features/skills/`: `components/{skill-type-badge,skill-source-chip,skill-meta-fields,skill-body-editor}`, `hooks.ts`, `lib/{skill-form,skill-errors,token-estimate}.ts` (the skill form pieces shared by `/skills`, `/skills/:id` and `/conventions`). Features import no other feature and no `app/`; `app/` composes them. |
| `src/lib/api.ts` | `apiFetch` + `api.get/post/put/patch/del`; base URL from `NEXT_PUBLIC_API_BASE`; every failure becomes `ApiError { status, code, details }`. |
| `src/lib/hooks/<domain>.ts` | TanStack Query hooks of domains that are not features (`core`, `agents`, `trace`, `repo-intel`, `conventions`); a feature keeps its hooks in `src/features/<domain>/hooks.ts` (`reviews`, `skills`). Imported from the domain file (`@/lib/hooks/core`); there is no `hooks/index.ts` barrel (see `.claude/skills/frontend-architecture`, R1). |
| `src/lib/providers.tsx` | `QueryClient` (retry 1, staleTime 30 s, no refetch on focus, global error toasts) → `ThemeProvider` → `ToastProvider` → `RepoProvider`. |
| `src/lib/repo-context.tsx` | Active repo: URL `:repoId` > `localStorage("dd-repo")` > first repo; `useRepoNotFound`. |
| `src/lib/theme.tsx`, `src/lib/toast.tsx` | `data-theme` on `<html>` + `localStorage("dd-theme")`; toast context plus the module-level `notify` bridge used outside React. |
| `src/lib/types.ts` | Re-exports contract types from `@devdigest/shared`; no local API shapes. |
| `src/lib/github-urls.ts`, `src/lib/model-label.ts`, `src/lib/feature-models.ts` | Shared pure functions that belong to no feature (the `reviews` ones moved to `src/features/reviews/lib/`). |
| `src/i18n/request.ts` | Single locale; merges every `messages/en/<ns>.json` into `{ [ns]: … }`. |
| `messages/en/*.json` | One namespace per file (`prReview`, `runs`, `agents`, `settings`, `shell`, …). |
| `src/vendor/ui/` | `@devdigest/ui` — the in-house design system (tokens, primitives, kit, shell, charts); see its `README.md`. |
| `src/vendor/shared/` | COPY of `../server/src/vendor/shared` (zod contracts); edited only by mirroring the server master. |
| `src/test/setup.ts`, `vitest.config.ts` | jsdom + Testing Library; aliases `@`, `@devdigest/shared`, `@devdigest/ui`; tests match `src/**/*.test.{ts,tsx}`. |
| `src/test/fixtures.ts`, `src/test/mutation-mock.ts` | Shared contract factories (`finding`, `pr`, `review`, `skill`, `agent`) and `fakeMutation` — a stand-in for a mocked mutation hook that keeps `isPending` / `isSuccess` / `data` state, so "Saved (vN)" UI can be tested with mocked hooks. |

Path aliases (`tsconfig.json:22-28`): `@/*` → `src/*`, `@devdigest/shared` →
`src/vendor/shared/index.ts`, `@devdigest/ui` → `src/vendor/ui/index.ts`.
`vitest.config.ts` repeats the same three aliases. `next.config.mjs` maps `.js`
import specifiers to `.ts` / `.tsx` (webpack `resolve.extensionAlias`) because
`src/vendor/shared` re-exports with `.js` specifiers; without it any RUNTIME
import from `@devdigest/shared` (a zod schema, an enum, a constant) fails the
Next build, while type-only imports and vitest are unaffected.

## Data flow — rendering the PR list

1. `src/app/repos/[repoId]/pulls/page.tsx` reads `:repoId` from `useParams`
   and the `?status` filter from `useSearchParams` (`page.tsx:29-39`).
2. `usePulls(repoId)` (`src/lib/hooks/core.ts:102-110`) runs
   `api.get("/repos/:id/pulls")` with a 60 s `refetchInterval`; the response is
   `PrMeta[]` straight from the contract.
3. The page filters by status (default `needs_review`), text and sort in
   memory (`page.tsx:49-58`) and renders one `PRRow` per PR
   (`src/app/repos/[repoId]/pulls/_components/PRRow/PRRow.tsx`).
4. `PRRow` derives display-only fields (the S/M/L bucket with
   `pulls/helpers.ts`, the relative time with `src/lib/date-format.ts`) and
   delegates the FINDINGS column to `FindingsCell`,
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
   `src/features/reviews/hooks.ts:127-139`).
2. The page switches to the findings tab and invalidates
   `["pr-active-runs", prId]` (`[number]/page.tsx:132-133`); `usePrActiveRuns`
   polls `GET /pulls/:id/runs/active` every 4 s while anything is running
   (`src/features/reviews/hooks.ts:28-35`).
3. `FindingsTab` mounts `RunStatus` for the live run ids; `useRunEvents` opens
   one `EventSource` per run on `GET /runs/:id/events`, appends every
   `info | tool | result | error` frame to state, toasts `error` frames and
   flips `running` to false when the last stream closes
   (`src/features/reviews/hooks.ts:171-219`).
4. When `running` drops, `RunStatus` fires `onDone` and the page invalidates
   active runs and run history and refetches reviews
   (`RunStatus/RunStatus.tsx:23-26`, `[number]/page.tsx:156-160`).
5. The refetched `ReviewRecord[]` renders one `ReviewRunAccordion` per review
   (newest first) with a `VerdictBanner` and a `FindingsPanel`; the run
   timeline (`RunHistory`) reads `usePrRuns` and matches findings to runs by
   `run_id`; `?trace=<runId>` mounts `RunTraceDrawer`, which loads
   `GET /runs/:id/trace` through `useRunTrace`.

## Data flow — an agent's skill list (Agents › Skills tab)

1. `useAgentSkills(id)` → `GET /agents/:id/skills` (links in order) and
   `useSkills()` → `GET /skills`; the tab lists linked skills first, then the
   unlinked ones (`src/app/agents/[id]/_components/AgentEditor/_components/SkillsTab/`).
2. Ticks, ↑/↓, drag and Detach edit a local draft that lives in
   `AgentEditor` (tagged with the agent id, `AgentEditor.tsx:17-19`), so it
   survives a tab switch, marks the tab label, and is dropped on agent switch.
3. "Save skills" → `useSetAgentSkills` → ONE `PUT /agents/:id/skills` with the
   ordered `[{skill_id, enabled}]`; the server bumps the agent version at most
   once and the toast shows it; the hook writes `["agent-skills", id]` and
   invalidates `["agents"]`, `["agent", id]`, `["skills"]` ("N skills" chips,
   `agent_count`). "Discard" drops the draft.

## Data flow — a conventions scan (Conventions page)

1. `/conventions` reads the active repo from `useActiveRepo()` and
   `useConventions(repoId)` → `GET /repos/:id/conventions`
   (`src/lib/hooks/conventions.ts`); `refetchInterval` is
   `conventionsPollInterval(data)`: 4 s while the latest scan is `running`,
   off otherwise.
2. Run Scan / ReScan → `useExtractConventions` → `POST …/extract`; the 202
   `running` scan is written into `["conventions", repoId]` so polling starts
   before the next fetch. A 409 `scan_running` invalidates the same key (the
   page follows a scan started in another tab or before a reload).
3. Each card's Accept / Reject / Edit → `usePatchConvention` →
   `PATCH /conventions/:id`; the hook writes the result through
   `applyCandidate` (replace by id; a rejected candidate is dropped), so no
   refetch is needed for the list to change.
4. Create skill → `CreateConventionSkillModal` loads
   `useConventionSkillDraft` (`staleTime: 0`, `gcTime: 0`) and
   `useAgents`; the form reuses `features/skills` (`SkillMetaFields`,
   `SkillBodyEditor`, `isSkillMetaValid`, `estimateTokens`); save →
   `useCreateConventionSkill` → `POST …/skill`, which invalidates
   `["skills"]`, `["agents"]`, `["agent"]`, `["agent-skills"]`, then the
   modal navigates to `/skills/:id?tab=preview`.
The pure cache rules (`applyCandidate`, `conventionsPollInterval`) are
exported from the hooks file and unit-tested there, because the view tests
mock the hooks module.

## Boundaries & dependencies

- **Layer direction** (frontend-architecture R2): `vendor/` → `lib/` →
  `components/` → `features/` → `app/`. `lib/` and `components/` import no
  feature, a feature imports no other feature and no `app/`, and only `app/`
  composes several features (the trace drawer uses `reviews` and `skills`).
  Enforced by `src/test/import-boundaries.test.ts`.
- **No raw `fetch` in components.** Everything goes through `src/lib/api.ts`
  and a hook in `src/lib/hooks/` or a feature's `hooks.ts`; `useRunEvents` is the one direct browser
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
  keyframes, and `color-scheme` per `data-theme` so browser-drawn controls —
  scrollbars, date pickers — follow the theme). `color-scheme` cannot
  override author colours, so the native `<select>` popup is themed by
  `SelectInput` itself: every `<option>` carries `var(--bg-elevated)` /
  `var(--text-primary)` (`src/vendor/ui/kit/SelectInput.tsx`). It is the
  only native `<select>` in the app. No CSS modules, no Tailwind utility
  classes in components.
- **i18n.** User-facing strings go through `useTranslations("<ns>")`; tests
  wrap components in `NextIntlClientProvider` with the namespace JSON.
- **Errors.** `ApiError` is thrown by `apiFetch`; the `QueryCache` toasts only
  network (`status 0`) and 5xx errors, the `MutationCache` toasts every
  mutation error (`src/lib/providers.tsx:35-43`); pages render `ErrorState`
  for query failures and `RepoNotFound` for a stale `:repoId`.
- **Tests never hit the API.** Hooks are mocked with `vi.mock` per test file
  (see `PRRow/PRRow.test.tsx`); `src/test/smoke.test.tsx` renders the kit
  gallery in both themes. A page test that needs the active repo mocks
  `@/lib/repo-context` (`useActiveRepo`) the way it mocks the shell
  (`src/app/conventions/_components/ConventionsView/ConventionsView.test.tsx`).

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
  `agent`, `conventionScan`, `conventionCandidate`) and pass
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
- 2026-09-27 — Trigger `features/<domain>/` fired for **skills**: its UI sits
  in `components/` (`skill-type-badge`, `skill-source-chip`) and
  `lib/hooks/skills.ts`, and is used by three routes (`/skills`,
  `/agents/:id`, the PR page's trace drawer). This also meets the revisit
  condition of the deferred `features/reviews/` entry above ("…or the trigger
  fires for a second domain"). Decision (user): introduce `features/reviews/`
  and `features/skills/` as L02 **Stage 9**, in `lesson-2` right after Wave 3
  and Stage 7a, before the user's final `/pr-self-review` — a separate
  behaviour-preserving refactor with its own commits; Stage 9 details go to
  the user for approval before it starts. Until then new skills UI keeps the
  current layout.
- 2026-09-27 — Shared test factories live in `src/test/fixtures.ts`, one per
  contract type (`finding` → `FindingRecord`, `pr` → `PrMeta`, `review` →
  `ReviewRecord`), beside `src/test/setup.ts`. Tests only: vitest collects
  `src/**/*.test.{ts,tsx}` (`vitest.config.ts`), so the file is never run as a
  test and no app code imports it. Replaces the per-test copies in `PRRow`,
  `FindingsPanel`, `RunHistory` and `findings-preview/test-fixtures.ts`.
  Rejected: keeping it in a component folder (route tests would import a
  component's internals) and `src/lib/` (app code). Recorded as a Map row in
  the `frontend-architecture` skill (1.1.0).
- 2026-09-28 — `features/reviews/` introduced (L02 Stage 9, per the
  2026-09-27 decision above): `severity-summary`, `findings-preview`,
  `run-cost-badge` → `src/features/reviews/components/`; `lib/hooks/reviews.ts`
  → `src/features/reviews/hooks.ts`; `lib/{severity,finding-format,cost-format}.ts`
  → `src/features/reviews/lib/`. `lib/hooks/trace.ts` stays: the trigger
  fired for `reviews` and `skills`, not `trace`, and its one consumer (the
  trace drawer) is in `app/`, which may compose features. Behaviour
  unchanged. frontend-architecture 2.0.0 records the layer.
- 2026-09-28 — `features/skills/` introduced (L02 Stage 9):
  `skill-type-badge`, `skill-source-chip` → `src/features/skills/components/`,
  `lib/hooks/skills.ts` → `src/features/skills/hooks.ts` (including
  `useAgentSkills` / `useSetAgentSkills`, used from `app/agents`, which may
  compose features). Route-private skills UI stays in `app/skills/` and
  `app/agents/…/SkillsTab/`. Behaviour unchanged.

- 2026-10-01 — HW02 Stage 2c: `/conventions` is a second consumer of the
  skill form pieces, and route folders may not import each other (R2), so
  they were promoted to `features/skills/` as pure moves (`git mv`,
  behaviour and markup unchanged, consumers updated imports only — D19 of
  `../../specs/HW02-conventions-and-api-contract.md` names the
  `SkillBodyEditor` move): `app/skills/[id]/…/ConfigTab/_components/SkillBodyEditor/`
  → `features/skills/components/skill-body-editor/`;
  `app/skills/_components/SkillMetaFields/` →
  `features/skills/components/skill-meta-fields/`; from
  `app/skills/helpers.ts`: `isValidSkillName` / `isSkillMetaValid` →
  `features/skills/lib/skill-form.ts`, `skillErrorKey` /
  `skillErrorMessage` → `features/skills/lib/skill-errors.ts` (its test
  `app/skills/helpers.test.ts` → `features/skills/lib/skill-errors.test.ts`),
  `estimateTokens` → `features/skills/lib/token-estimate.ts`;
  `needsInjectionAck` and `filterSkills` stay route-private. The same rule
  moved `relativeTime` from `app/repos/[repoId]/pulls/helpers.ts` to
  `src/lib/date-format.ts` (second consumer: the conventions "last scan").
  The conventions page itself stays route-private (`app/conventions/`) with
  its hooks in `src/lib/hooks/conventions.ts`: one route, so the
  `features/<domain>/` trigger does not fire.

## Open questions

- `src/lib/types.ts:37-48` declares `PrRowView`, and
  `src/app/repos/[repoId]/pulls/constants.ts:34` refers to `.pr-table` rules
  in `globals.css` while the class is `.pr-list` (`globals.css:31`); both look
  like leftovers. Unverified whether anything reads `PrRowView`.
- `src/app/agents/[id]/page.tsx:15` allows `config` and `skills`; Evals,
  Stats and CI tabs of the design are out of scope (L02 D14).
