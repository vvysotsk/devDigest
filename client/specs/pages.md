# client — pages

Last verified: 2026-09-24 against c03665a

## Scope

What must stay true on every route of the studio: the data each page loads
(hook → endpoint), the surfaces it renders, and its loading / empty / error
states. Response shapes are the server's contract
(`../server/specs/review-flow.md`, `../server/README.md`); the pixel design
belongs to `src/vendor/ui/README.md`.

Paths are relative to `client/`. Short names resolve as follows:
`page.tsx`, `constants.ts`, `styles.ts`, `helpers.ts` under
`src/app/repos/[repoId]/pulls/` when the section is the PR list;
`<Name>/<Name>.tsx` under `src/app/repos/[repoId]/pulls/[number]/_components/`
for the PR page (`FindingsPanel/FindingsPanel.tsx`, `RunHistory/RunHistory.tsx`,
…) and under `src/app/repos/[repoId]/pulls/_components/` for the list
(`PRRow/PRRow.tsx`, `PRRow/FindingsCell.tsx`); `reviews.ts`, `core.ts`,
`agents.ts`, `trace.ts` under `src/lib/hooks/`.

## Contract

### `/` — home

- Loads `useRepos` → `GET /repos`; with at least one repo it `router.replace`s
  to `/repos/<first>/pulls`; with none (or an error) it shows the
  "No repositories yet" empty state with a CTA to `/onboarding`
  (`src/app/page.tsx:13-37`).

### `/onboarding` — add repository

- One URL field; Enter or the button calls `useAddRepo` → `POST /repos { url }`
  and navigates to the new repo's PR list; an `ApiError` message is shown
  inline, never as a toast only; Esc or the close button returns to `/`
  (`src/app/onboarding/_components/AddRepoView/AddRepoView.tsx:19-38`,
  `:94-104`).

### `/repos/:repoId/pulls` — PR list

- Data: `usePulls(repoId)` → `GET /repos/:id/pulls` (`PrMeta[]`), refetched
  every 60 s (`core.ts:102-110`). Refresh button → `useRefreshRepo` →
  `POST /repos/:id/refresh`, then `["repos"]` and `["pulls", repoId]` are
  invalidated (`core.ts:82-90`).
- Filter/sort are client-side: `?status` (default `needs_review`; `all`,
  `reviewed`, `stale`), a text filter on title or number, sort newest/oldest
  by `updated_at` (`page.tsx:38-58`, `constants.ts:44-49`).
- Columns, in order: Pull request · Author · Size · Score · Findings · Cost ·
  Status · Updated; Cost and Updated are right-aligned
  (`constants.ts:52-64`, i18n `messages/en/prReview.json:95-104`).
- Size = S/M/L by `additions + deletions` against `SIZE_SMALL_MAX` (100) and
  `SIZE_MEDIUM_MAX` (400) (`helpers.ts:3-8`, `constants.ts:40-41`).
- Score = `CircularScore` when `pr.score != null`, else a dash
  (`PRRow/PRRow.tsx:21`, `:53-59`).
- **FINDINGS** = icon + count per severity of `pr.latest_batch.findings_by_severity`;
  a dash when there is no batch or the total is 0 (`PRRow/FindingsCell.tsx:20-40`).
  Hovering the icons for `HOVER_INTENT_MS` (180 ms) or focusing them opens a
  read-only popover titled "N findings in this run" listing only the findings
  whose review `run_id` is in `latest_batch.run_ids`; the reviews fetch
  (`usePrReviews(pr.id, { enabled })`) is enabled only once the popover
  opened (`PRRow/FindingsCell.tsx:16`, `:24-32`, `:44-53`;
  `messages/en/prReview.json:113`). A quick sweep opens nothing and fetches
  nothing; a fetch failure shows the error text instead of a loading note.
- **COST** = `RunCostBadge` over `pr.cost_usd` (the server's sum of every
  `done` run); null renders a dash, a genuine 0 renders `$0.00`
  (`PRRow/PRRow.tsx:61-63`, `src/lib/cost-format.ts:5-14`).
- Status badge = `STATUS_META[pr.status]` label + colour; unknown statuses fall
  back to `needs_review` (`PRRow/PRRow.tsx:19`, `constants.ts:10-17`).
- Clicking a row navigates to `/repos/:repoId/pulls/<number>`
  (`PRRow/PRRow.tsx:26`).
- Below 1185 px the `.pr-list` variables switch to the narrow grid, spacing
  shrinks and the severity counts are hidden (`src/app/globals.css:39-51`,
  `constants.ts:36-37`).

### `/repos/:repoId/pulls/:number` — PR page

- The route is keyed by PR number; the uuid is resolved from the cached pulls
  list before any PR request (`src/app/repos/[repoId]/pulls/[number]/page.tsx:35-36`).
- Data: `usePullDetail(prId)` → `GET /pulls/:id`; `usePrReviews(prId)` →
  `GET /pulls/:id/reviews`; `usePrActiveRuns` → `GET /pulls/:id/runs/active`
  (polls 4 s while non-empty); `usePrRuns` → `GET /pulls/:id/runs` (polls 4 s
  while a run is `running`) (`[number]/page.tsx:37-46`, `reviews.ts:28-48`).
- Tabs live in `?tab=` (`overview` default, `findings`, `diff`); `?trace=<runId>`
  opens the trace drawer (`[number]/page.tsx:60-68`, `:174-182`).
- Header: number, title, author, `branch → base`, `+adds −dels`, status badge,
  a GitHub link when the repo's `full_name` is known, and `RunReviewDropdown`
  (`PrDetailHeader/PrDetailHeader.tsx:46-80`).
- **Run Review** lists "Run all enabled agents" (muted when none is enabled),
  then every agent — disabled ones too, hinted "· disabled" — then
  "Configure agents…"; each item posts `POST /pulls/:id/review` with `all` or
  `agentId`, switches to the findings tab and invalidates active runs
  (`RunReviewDropdown/RunReviewDropdown.tsx:38-82`, `[number]/page.tsx:132-133`).
- **Live review**: while `liveRunIds` is non-empty the findings tab shows a
  Cancel button (posts `/runs/:id/cancel` for every live run), an "Open run
  trace" button and `RunStatus`, which renders the SSE frames in
  `LiveLogStream` and calls `onDone` once the streams close
  (`FindingsTab/FindingsTab.tsx:76-101`, `RunStatus/RunStatus.tsx:20-26`).
  `onDone` invalidates active runs + run history and refetches reviews
  (`[number]/page.tsx:156-160`).
- **Timeline** (`RunHistory`): every run interleaved with the PR commits,
  newest first. Badge = `running` / `error` / `cancelled` by status, else
  `rejected` when `blockers > 0`, `reviewed` when `findings_count > 0`, else
  `approved`; a failed run shows its `error` inline; a settled run shows the
  score ring, cost · tokens, and — when a review with the same `run_id` is
  passed — icon + count per severity wrapped in the "N findings in this run"
  hover card; otherwise the plain "N findings" text. The agent name jumps to
  that run's accordion; the file icon opens the trace; the trash icon deletes
  the run (`DELETE /runs/:id`) after a `window.confirm`
  (`RunHistory/RunHistory.tsx:29-43`, `:164-257`, `[number]/page.tsx:152-155`).
- **Review runs**: one `ReviewRunAccordion` per `ReviewRecord`, newest first,
  first one open; header = agent, verdict, "N findings · M blockers"
  (blockers = CRITICAL findings not dismissed), score, timestamp, delete
  (`DELETE /reviews/:id` after confirm); body = `VerdictBanner` + `FindingsPanel`
  (`ReviewRunAccordion/ReviewRunAccordion.tsx:54-57`, `:109-129`, `:136-156`).
  The `EmptyState` "No findings yet" appears only when nothing is running
  (`FindingsTab/FindingsTab.tsx:148-155`).
- **FindingsPanel**: pills (`SeveritySummary variant="pills"`) are counted
  AFTER the "Hide low confidence" toggle (threshold 0.65) and BEFORE the
  severity filter, so a pill's number equals the cards of that severity below.
  All three severity chips are always rendered; a chip whose count is 0 is
  `disabled`; an active filter whose severity vanished is derived back to
  "no filter". `j`/`k` move focus, `a`/`d` accept/dismiss the focused card
  (`FindingsPanel/FindingsPanel.tsx:51-58`, `:70-82`, `:98-112`;
  `FindingsPanel/constants.ts:12-18`; `FindingsPanel/helpers.ts:9-20`).
- **FindingCard**: severity badge, title, category, `file:line` link to the
  GitHub blob at `head_sha` when known, confidence, markdown rationale and
  suggestion; two actions labelled "Accept" and "Reject" that post
  `/findings/:id/accept` and `/findings/:id/dismiss`; an accepted or dismissed
  finding is muted with a tag (`FindingCard/FindingCard.tsx:46-52`, `:91-114`;
  `messages/en/prReview.json:6-7`).
- **Diff tab**: `DiffViewer` over `pr.files`; GitHub review comments come from
  `usePrComments` (`GET /pulls/:id/comments`), hidden by default with a
  toggle; inline commenting is offered only when `pr.status === "open"` and
  posts `POST /pulls/:id/comments` (`DiffTab/DiffTab.tsx:18-41`,
  `[number]/page.tsx:164-171`).
- **Trace drawer** (`RunTraceDrawer`, 720 px): tabs Trace / Live log. Trace
  loads `GET /runs/:id/trace` and shows Configuration, Stats (duration,
  tokens, cost, findings, grounding badge), Findings (severity pills + full
  read-only previews with the suggestion), Prompt assembly (system + optional
  skills / memory / repo map / specs / callers + user), Tool calls, Raw output;
  the footer copies the raw output. For a historical run the Live-log tab
  shows the persisted `trace.log` (`RunTraceDrawer/RunTraceDrawer.tsx:44-49`,
  `:61-64`, `:89-104`; `RunTraceDrawer/_components/TraceBody/TraceBody.tsx:24-110`;
  `RunTraceDrawer/_components/FindingsSection/FindingsSection.tsx:17-38`).

### `/agents` and `/agents/:id`

- `/agents`: `useAgents` → `GET /agents`; search filters client-side; the
  "Add agent" dropdown opens `CreateAgentModal`; the card toggle calls
  `useUpdateAgent` → `PUT /agents/:id { enabled }`; clicking a card opens
  `/agents/:id?tab=config` (`src/app/agents/_components/AgentsListView/AgentsListView.tsx:20-25`,
  `:83-93`; `agents.ts:8-12`, `:61-69`).
- `/agents/:id`: left list of all agents, right `AgentEditor` with the single
  `config` tab (model + system prompt); the header shows `provider/model` and a
  "disabled" badge; load failure → full-screen `ErrorState`
  (`src/app/agents/[id]/page.tsx:15`, `:40-51`, `:96-118`).

### `/settings/:section`

- Sections come from `SETTINGS_SECTIONS` (`api-keys`, `models`); any other
  key renders a placeholder empty state (`src/app/settings/[section]/_components/SettingsView/SettingsView.tsx:20-48`,
  `src/vendor/ui/nav.ts:39-41`).
- API Keys: one row per provider (openai, anthropic, openrouter, github) with a
  masked input and "Test connection" → `POST /settings/test-connection
  { provider, key? }`; the Configured / Not set pill reads
  `GET /settings/secrets-status`; a successful test invalidates provider
  models and secrets status (`SettingsApiKeys/constants.ts:11-16`,
  `SettingsApiKeys/SettingsApiKeys.tsx:13-23`, `:42-50`; `core.ts:38-56`).
- Feature Models: one `SearchableSelect` per `FEATURE_MODELS` entry, options
  from `GET /providers/openrouter/models`, choice persisted with
  `PUT /settings { feature_models }` (`SettingsModels/SettingsModels.tsx:20-46`).

### Shell (every page)

- `AppShell` wraps the kit's `AppFrame` with breadcrumbs, the command palette
  (Cmd/Ctrl+K), shortcuts help (`?`) and `g`-then-key navigation from `NAV`
  (1.2 s window); keys are ignored inside text inputs
  (`src/components/app-shell/AppShell.tsx:18-29`,
  `src/components/app-shell/hooks/useGlobalShortcuts.ts:26-48`,
  `src/components/app-shell/constants.ts:4`).
- Active repo = URL `:repoId` > `localStorage("dd-repo")` > first repo; a
  `:repoId` that matches no loaded repo renders `RepoNotFound` instead of an
  error (`src/lib/repo-context.tsx:46-49`, `:69-72`).

## States & edge cases

- **Loading**: skeleton rows (PR list: 4), skeleton blocks (PR page, agents),
  "Loading findings…" in the popover (`page.tsx:108-113`, `constants.ts:67`).
- **Empty**: PR list renders an `EmptyState` "No pull requests" with
  `emptyAllBody` or `emptyStatusBody`; PR page shows "No findings yet" unless
  a run is live; agents list shows a create CTA (`page.tsx:120-129`,
  `FindingsTab/FindingsTab.tsx:148-155`).
- **Error**: query failures render `ErrorState` with the `ApiError` message
  and a retry; network / 5xx errors also toast; 4xx stay inline; SSE `error`
  frames toast (`src/lib/providers.tsx:35-43`, `reviews.ts:189-192`).
- **Never reviewed PR**: score dash, findings dash, cost dash; with no
  `counts` or `total === 0` the cell renders the dash and no popover, so no
  reviews fetch (`PRRow/FindingsCell.tsx:34-40`).
- **Reload mid-run**: live runs come from the server (`/runs/active`), so the
  live log and Cancel reappear after a reload (`[number]/page.tsx:42-49`).
- **Delete a run**: removes the timeline row and, server-side, its review, so
  both `["pr-runs"]` and `["reviews"]` are invalidated (`reviews.ts:63-74`).

## Enforced by

| Rule | Test |
|---|---|
| Never-reviewed PR shows a dash and never fetches reviews | `src/app/repos/[repoId]/pulls/_components/PRRow/PRRow.test.tsx:57` |
| Icon + count per severity of the latest batch | `PRRow/PRRow.test.tsx:64` |
| Quick sweep opens nothing and fetches nothing; settling opens + fetches + filters by `run_ids` | `PRRow/PRRow.test.tsx:71`, `:82` |
| Keyboard focus opens immediately; fetch error replaces the loading note | `PRRow/PRRow.test.tsx:105`, `:113` |
| Hover card: delay, grace, Escape, blur, outer scroll closes / inner scroll does not; `onOpen` once per opening (hover timer + focus) | `src/components/findings-preview/FindingsHoverCard.test.tsx:39-143` |
| Popover: sorted previews, loading / empty / error precedence, `position: fixed` | `src/components/findings-preview/FindingsPopover.test.tsx:14-55` |
| Pills count after hide-low-confidence; three chips always, zero-count chip disabled; vanished filter dropped | `src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/FindingsPanel.test.tsx:74-141` |
| `visibleFindings` applies hideLow before the severity filter and sorts by severity | `FindingsPanel/helpers.test.ts:33-46` |
| Second finding action reads "Reject" and dispatches `dismiss` | `FindingCard/FindingCard.test.tsx:52` |
| Timeline badge outcome (rejected / approved / reviewed / error / running), cost line, severity icons + "N findings in this run" hover | `RunHistory/RunHistory.test.tsx:71-165` |
| Trace drawer stats, COST stat, Findings section, live-log tab | `RunTraceDrawer/RunTraceDrawer.test.tsx:42-95` |
| Verdict banner label + score + counts | `VerdictBanner/VerdictBanner.test.tsx:18` |
| `formatCost` dash vs `$0.00` vs scaled decimals; token compaction | `src/lib/cost-format.test.ts:9-24`, `src/components/run-cost-badge/RunCostBadge.test.tsx:13-42` |
| `countBySeverity` ignores unknown values; pills / icons render only present severities | `src/lib/severity.test.ts:11-43`, `src/components/severity-summary/SeveritySummary.test.tsx:12-37` |
| Agent card and editor render | `src/app/agents/_components/AgentCard/AgentCard.test.tsx:38`, `src/app/agents/[id]/_components/AgentEditor/AgentEditor.test.tsx:42` |
| Kit gallery renders in both themes; diff viewer parses a unified patch | `src/test/smoke.test.tsx:15`, `:27` |
