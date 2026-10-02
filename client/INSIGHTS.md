# Insights — client

Append-only lessons about `client/` that the code cannot tell you.
A lesson that spans packages gets an entry here AND in each other package
it touches; the root `INSIGHTS.md` is for repo tooling only.

Entry format, quality gate, and capture rules live in the
`engineering-insights` skill (`.claude/skills/engineering-insights/SKILL.md`).
Entries: `- YYYY-MM-DD: <actionable statement> (evidence: path:line[, command/error])` — date and path:line are required.
Never rewrite existing entries — correct with a dated note.

## What Works

## What Doesn't Work

- 2026-09-29: A drag-and-drop list that remembers the dragged row in a ref
  and resets it only in `onDrop` leaks that row once drops are restricted.
  A drop on a row that refuses it (the agent Skills tab accepts drops only on
  enabled skills) never runs the reset, so the next accepted drop moves the
  stale row. Clear the ref in `onDragEnd`, which the browser fires on the
  source after every drag, dropped or not (evidence:
  `src/app/agents/[id]/_components/AgentEditor/_components/SkillsTab/SkillsTab.tsx:128-131`,
  `…/SkillsTab/_components/SkillRow/SkillRow.tsx:61`,
  `…/SkillsTab/SkillsTab.test.tsx:162`).

- 2026-09-24: A CSS custom property referenced through `var()` must be defined on (or above) the element that COMPUTES the referencing property, not on a descendant — `.pr-list { --pr-grid: var(--pr-grid-wide) }` with `--pr-grid-wide` set inline on the inner table card made `--pr-grid` invalid, and every row collapsed into one column (`grid-template-columns: none`). Put the source variables on the same element (`s.listRoot` on the `.pr-list` div) and give each `var()` in inline styles a fallback (evidence: `src/app/repos/[repoId]/pulls/styles.ts` listRoot/row).
- 2026-09-24: UPDATE to the entry above — evidence lines:
  `src/app/repos/[repoId]/pulls/styles.ts:97-105` (`listRoot`) and
  `src/app/globals.css:31-32` (`.pr-list { --pr-grid: var(--pr-grid-wide) }`).
- 2026-09-24: The PR-list popover title must stay "N findings in this run"
  (`findingsPopover.titleInRun`) — the L01 criterion requires that exact
  wording; it was removed once on a mistaken request and had to be restored.
  Check `../specs/L01-severity-counts.md` before changing popover copy
  (evidence: `src/app/repos/[repoId]/pulls/_components/PRRow/FindingsCell.tsx:45`,
  `messages/en/prReview.json:113`).

## Codebase Patterns

- 2026-09-28: Opacity (and transform / filter / overflow) on an element that
  CONTAINS an overlay is inherited by the overlay: the "enable an imported
  skill" confirm opened from a disabled `SkillCard` (`opacity: 0.7` on the
  card) was nearly transparent and the page showed through. The kit `Modal`
  now renders through `createPortal(…, document.body)` after mount, and a
  disabled card dims its content, not itself. Tests assert the dialog is not
  a descendant of its opener (evidence: `src/vendor/ui/kit/Modal.tsx:26-30`,
  `src/app/skills/_components/SkillsListView/_components/SkillCard/styles.ts:15`,
  `src/app/skills/_components/SkillsListView/SkillsListView.test.tsx:93`).

- 2026-09-27: Do not put a toggle that can open a dialog inside a `<label>`:
  the kit `Modal` renders inside it and the label forwards every click in the
  dialog back to the switch. Use a `div` for the caption (evidence:
  `src/app/skills/[id]/_components/SkillEditor/_components/ConfigTab/ConfigTab.tsx:52-53`).
  - 2026-09-28 note: root cause was that the kit `Modal` rendered in place;
    it now portals to `document.body` (`src/vendor/ui/kit/Modal.tsx:26-30`), so a
    dialog is never inside a label or card any more. Keep the `div` anyway.
  - 2026-09-29 note: the portal moves the dialog out of the card in the DOM
    only. React synthetic events still bubble along the React tree, so a
    click in a portalled `Modal` rendered inside a clickable card's JSX still
    reaches the card's `onClick`. Render such a modal as a sibling of the card
    (a fragment), or stop propagation in a wrapper (evidence:
    `src/app/skills/_components/SkillsListView/_components/SkillCard/SkillCard.tsx:33`, `:53`, `:73`;
    `src/app/skills/_components/SkillEnabledToggle/SkillEnabledToggle.tsx:37`).
- 2026-09-27: A clickable card (`role="button"`) that contains a switch must
  ignore bubbled keys — `if (e.key === "Enter" && e.target === e.currentTarget)`
  — and the switch's wrapper stops clicks (the switch's and its dialog's) from
  reaching the card (evidence:
  `src/app/skills/_components/SkillsListView/_components/SkillCard/SkillCard.tsx:22-23`,
  `src/app/skills/_components/SkillEnabledToggle/SkillEnabledToggle.tsx:35-37`).
- 2026-09-27: With mocked hooks, a mutation needs real state for
  `isSuccess` / `data` ("Saved (vN)"): use `fakeMutation` from
  `src/test/mutation-mock.ts:16`. To test a cache write-through (the saved
  entity flowing back as a prop), back the mocked query hook with
  `React.useSyncExternalStore` over a hoisted store the mutation writes
  (evidence: `src/app/skills/[id]/_components/SkillEditor/SkillEditor.test.tsx:34`).

- 2026-09-24: A popover inside the PR list must be `position: fixed` —
  `s.tableCard` has `overflow: hidden` and clips an absolute child. Being
  fixed, it closes on any outer scroll, but scroll events whose target is
  inside the popover are ignored, otherwise scrolling a long findings list
  closes it (evidence: `src/app/repos/[repoId]/pulls/styles.ts:110`,
  `src/components/findings-preview/styles.ts:10`,
  `src/components/findings-preview/FindingsHoverCard.tsx:122-126`).
- 2026-09-24: A hover popover that fetches needs hover intent:
  `FindingsHoverCard` opens (and calls `onOpen`) only after `openDelayMs`, and
  `FindingsCell` enables `usePrReviews` only inside `onOpen` — otherwise a
  sweep down the list sends one `GET /pulls/:id/reviews` per row (evidence:
  `src/app/repos/[repoId]/pulls/_components/PRRow/FindingsCell.tsx:16`, `:26`,
  `:51-52`; `src/components/findings-preview/FindingsHoverCard.tsx:85-92`).
- 2026-09-24: In `FindingsPanel` the severity pills are counted AFTER the
  "Hide low confidence" toggle and BEFORE the severity filter — counting the
  raw `findings` makes a pill's number differ from the cards below it
  (evidence:
  `src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/FindingsPanel.tsx:51-52`).
- 2026-09-24: The comment in `pulls/constants.ts` points at `.pr-table` rules
  in `globals.css`; the class that actually switches the grid is `.pr-list`
  — grep for `.pr-list`, not `.pr-table` (evidence:
  `src/app/repos/[repoId]/pulls/constants.ts:34`, `src/app/globals.css:31`).
- 2026-09-24: The client uses inline styles, which cannot express media queries — the pattern for responsive layout is a class wrapper (`.pr-list`) whose CSS variables are switched in `app/globals.css` under `@media`, while inline styles read `var(--pr-gap, 14px)` etc. Keep the grid templates themselves in `pulls/constants.ts` (`GRID`, `GRID_NARROW`, `NARROW_MAX_WIDTH`) and only the switching in CSS (evidence: `src/app/globals.css` `.pr-list`, `pulls/styles.ts`).
- 2026-09-24: In `FindingsTab` the prop named `runs` is `ReviewRecord[]` (persisted reviews) and `prRuns` is `RunSummary[]` (agent_runs rows); `RunHistory` needs BOTH (`runs={prRuns}` for the tiles, `reviews={runs}` to match findings by `run_id`) — do not "fix" the names, the accordion list depends on them (evidence: `FindingsTab.tsx` RunHistory props).
- 2026-09-24: UPDATE to the inline-styles entry — evidence lines:
  `src/app/globals.css:31-41` (the `@media` switch) and
  `src/app/repos/[repoId]/pulls/constants.ts:27-37` (`GRID`, `GRID_NARROW`,
  `NARROW_MAX_WIDTH`).
- 2026-09-24: UPDATE to the FindingsTab entry — evidence lines:
  `src/app/repos/[repoId]/pulls/[number]/_components/FindingsTab/FindingsTab.tsx:131-134`
  (`runs={prRuns ?? []}`, `reviews={runs}`).

- 2026-10-01: Logic inside a hook's `onSuccess` / `refetchInterval` is
  invisible to the view tests, which `vi.mock` the whole hooks module. Export
  the rule as a pure function from the hooks file (`applyCandidate`,
  `conventionsPollInterval`) and test it there, plus a `renderHook` +
  `QueryClientProvider` case for the branch that touches the cache on an
  error (the 409 `scan_running` re-fetch) — otherwise "a rejected card
  disappears" is only ever proven against the test's own fake (plan
  correction by the user) (evidence: `src/lib/hooks/conventions.ts:23-44`,
  `src/lib/hooks/conventions.test.tsx:57-74`).
- 2026-10-01: A page that reads the active repo is tested like the shell:
  `vi.mock("@/lib/repo-context", () => ({ useActiveRepo: () => h.repo }))`
  with a hoisted `h.repo` the test reassigns per case (`repoId: null` for
  the no-repo state); `RepoProvider` needs `usePathname` and `useRepos`, so
  rendering the real provider would drag in `next/navigation` and the API
  (evidence: `src/app/conventions/_components/ConventionsView/ConventionsView.test.tsx:41`,
  `:80`, `:244`; `src/lib/repo-context.tsx:25-26`).

## Tool & Library Notes

- 2026-09-27: To read the latest callback prop without re-running an effect,
  use `React.useEffectEvent` (React 19.2, `@types/react` has it) instead of
  writing `ref.current = prop` during render (a render-time side effect). An
  effect event may be called only from inside effects, never from event
  handlers or render — so `FindingsHoverCard` fires `onOpen` from an effect
  on `open` becoming true, not from the mouse/focus handlers
  (`src/components/findings-preview/FindingsHoverCard.tsx:61`, `:140`).
  - 2026-09-27 correction: wrong tool for this case. `onOpen` reacts to an
    event (hover timer / focus), so it belongs in the open handler, not in an
    effect (react-best-practices "Hooks"; self-review finding 0d9256a7). It is
    now called in `doOpen`, and "once per opening" is kept by an `isOpenRef`
    written only in handlers plus cancelling the pending hover timer — the
    effect had deduplicated a second `setOpen(true)` silently (evidence:
    `src/components/findings-preview/FindingsHoverCard.tsx:69-80`, test
    `FindingsHoverCard.test.tsx:62`).
- 2026-09-24: Importing a fixture from another `*.test.tsx` makes vitest execute that file's `describe` blocks inside the importer too (duplicated/failing tests); keep shared fixtures in a non-test file such as `test-fixtures.ts` (evidence: `src/components/findings-preview/test-fixtures.ts`).
- 2026-09-24: UPDATE to the test-fixtures entry — evidence lines:
  `src/components/findings-preview/FindingsHoverCard.test.tsx:9` and
  `src/components/findings-preview/FindingsPopover.test.tsx:7` import `finding`
  from `./test-fixtures`.
  - 2026-09-27 correction: `findings-preview/test-fixtures.ts` was replaced by
    the shared `src/test/fixtures.ts` (`finding`, `pr`, `review`); the rule
    (fixtures in a non-test file) stands (evidence: `src/test/fixtures.ts:9`,
    `.claude/skills/frontend-architecture/SKILL.md` Map "Shared test factories").
- 2026-09-24: `pnpm exec vitest run <path>` silently matches nothing when the path contains `[repoId]`/`[number]` brackets (glob chars); filter by file name instead, e.g. `vitest run FindingsPanel` (evidence: FindingsPanel run showed only 2 unrelated files until the filter was changed).
- 2026-09-24: UPDATE to the vitest bracket-path entry — evidence:
  `package.json:10` (`"test": "vitest run"`) with the bracketed path
  `src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/FindingsPanel.test.tsx`.

## Recurring Errors & Fixes

- 2026-09-27: Next.js (webpack) failed with `Module not found: Can't resolve
  './contracts/findings.js'` in `src/vendor/shared/index.ts` as soon as a page
  imported a runtime VALUE from `@devdigest/shared` (L02 skills:
  `SkillErrorCode`, `SkillName`, `SkillType`, `SKILL_IMPORT_MAX_BYTES`). Every
  earlier import was type-only (erased), and vitest resolves `.js` → `.ts` by
  itself, so typecheck + all unit tests stayed green; only the e2e run (Next
  dev) caught it — `next build` was broken from `a71befb` (Stage 5) until
  the fix in `cea9dd2`. Fix: `resolve.extensionAlias` in `next.config.mjs`. After
  adding a runtime import from the shared contracts, run `pnpm build` or the
  e2e suite (evidence: `next.config.mjs:11-21`,
  `src/app/skills/helpers.ts:2`; `../e2e/test-results/08-skills-fail.snapshot.txt`).

- 2026-09-27: `findByRole("status")` fails with "multiple elements" once a
  success toast is on screen — `ToastProvider` renders `role="status"` too.
  Query an inline status note by its text (evidence: `src/lib/toast.tsx:90`;
  `src/app/skills/[id]/_components/SkillEditor/SkillEditor.test.tsx:100`).

- 2026-09-27: `userEvent` actions hang (test timeout, not an assertion) under
  vitest fake timers even with `advanceTimers` or `delay: null`: RTL's
  `asyncWrapper` drains every action with `setTimeout(0)` and advances fake
  timers only when a global `jest` exists
  (`node_modules/@testing-library/react/dist/pure.js:91-97`). In a test that
  uses `userEvent` with fake timers, reinstall them with
  `vi.useRealTimers(); vi.useFakeTimers({ shouldAdvanceTime: true })` and
  `userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) })`;
  a second `vi.useFakeTimers()` on top of the `beforeEach` one does not
  change the options (evidence:
  `src/components/findings-preview/FindingsHoverCard.test.tsx:62-80`).
  - 2026-09-27 note: `shouldAdvanceTime` lets real time move the fake clock, so
    keep delays in such tests far above the test's own duration (10 s, and
    assert the timer has not fired yet) — otherwise a slow run lets the timer
    fire first and the test passes without its scenario
    (`FindingsHoverCard.test.tsx:68-72`).
- 2026-09-26: When deleting a barrel, grep for its RELATIVE spellings too —
  the alias grep (`lib/hooks"`) found 7 importers of `src/lib/hooks/index.ts`
  but missed `import { useRepos } from "./hooks"` inside `lib/` itself; only
  `pnpm typecheck` caught it (`TS2307: Cannot find module './hooks'`), while
  `pnpm test` stayed green because no test loads `repo-context.tsx`. Run
  typecheck before tests after any module move (evidence:
  `src/lib/repo-context.tsx:7`).
- 2026-09-28: Kit tokens (`var(--text-primary)` etc.) do not reach controls the
  browser draws itself: the native `<select>` popup of `SelectInput` rendered
  white with the light dark-theme text, because the page declared no
  `color-scheme`. Every theme switch on `[data-theme]` must also set
  `color-scheme` (select popups, scrollbars, date pickers); a new theme needs
  its own rule there (evidence: `src/app/globals.css:53-61`,
  `src/vendor/ui/kit/SelectInput.tsx:29`).
  - 2026-09-29 correction: `color-scheme` alone did NOT fix the select popup,
    and the fix was never checked in the browser. With `color-scheme: dark`
    applied, the select and its options still computed to a
    `rgba(0, 0, 0, 0)` background and an `rgb(237, 237, 237)` text colour.
    Chrome on Windows paints the popup from those author colours, so the
    list was white with light text, and `color-scheme` cannot override
    author colours. Give each `<option>` explicit `var(--bg-elevated)` /
    `var(--text-primary)`. Keep `color-scheme` for scrollbars and date
    pickers. Verify native popups by hand: agent-browser screenshots do not
    show them (evidence: `src/vendor/ui/kit/SelectInput.tsx:9-12`, `:58`;
    `src/vendor/ui/kit/SelectInput.test.tsx`; the `color-scheme` rules are
    now at `src/app/globals.css:57-62`).

- 2026-09-29: In a single-line flex container with a `max-height`, the
  default `align-items: stretch` gives every item the container's clamped
  line height (Flexbox §9.4), not its own size. The skill body textarea
  (`rows` = 40) was drawn 520 px tall with `scrollHeight` 820. Because
  `overflow: hidden` still allows programmatic scroll, it scrolled internally
  to the caret (`scrollTop` 300) and drifted from the gutter. Give such an
  item an explicit height and `align-items: flex-start`, and let only the
  container scroll (evidence: `src/app/skills/[id]/_components/SkillEditor/_components/ConfigTab/_components/SkillBodyEditor/styles.ts:25`,
  `SkillBodyEditor.tsx:44-47`, `:84`; before the fix, e2e flow `08-skills`
  failed on `BODY_EDITOR_OK`).

- 2026-10-01: Running `pnpm test` here while the server's Docker `.it` suite
  runs on the same machine makes the slowest jsdom test miss vitest's 5 s
  default timeout (`SkillsListView.test.tsx` "creates a manual skill …":
  5246 ms under load, 2055 ms alone; two full-suite failures, green alone and
  green in a third full run without the concurrent suite). Run the client
  tests and the server integration suite one after the other, not in
  parallel, before reading a failure as a regression (evidence:
  `src/app/skills/_components/SkillsListView/SkillsListView.test.tsx`;
  `vitest.config.ts` sets no `testTimeout`).

- 2026-10-01: A state that renders the same action twice (a header button
  and an `EmptyState` CTA with one label, e.g. "ReScan" after a failed or
  empty scan) makes `getByRole("button", { name })` throw "Found multiple
  elements". Query with `getAllByRole` and pick, or scope with `within`,
  before reading the failure as a duplicate-render bug (evidence:
  `src/app/conventions/_components/ConventionsView/ConventionsView.test.tsx:216-220`).

## Session Notes

- 2026-09-28: L02 Stage 9 moved the `reviews` domain — entries above that
  cite `src/components/{severity-summary,findings-preview,run-cost-badge}/`,
  `src/lib/{severity,finding-format,cost-format}.ts` or
  `src/lib/hooks/reviews.ts` now mean `src/features/reviews/components/…`,
  `src/features/reviews/lib/…` and `src/features/reviews/hooks.ts` (same
  file contents; line numbers unchanged). Boundaries are enforced by
  `src/test/import-boundaries.test.ts`.
  The `skills` domain followed: `src/components/skill-{type-badge,source-chip}/`
  → `src/features/skills/components/…`, `src/lib/hooks/skills.ts` →
  `src/features/skills/hooks.ts`.

- 2026-09-26: Added the `frontend-architecture` skill (placement map, R1–R7,
  review signals, architecture-change triggers; research in
  `.claude/skills/frontend-architecture/references/`), removed the
  `src/lib/hooks/index.ts` barrel (8 importers → `@/lib/hooks/core`),
  turned the 200-lines/5–7-props caps in `react-best-practices` into review
  signals; `pnpm typecheck` + 76 tests green.

- 2026-09-24: Seeded `docs/ui-architecture.md` + `specs/pages.md` (line refs
  verified by script); mirrored the `review-api.ts` response-comment fix from
  the server master copy (`src/vendor/shared/contracts/review-api.ts:40-44`).
- 2026-09-24: L01 severity counters end-to-end (`severity-summary`, `findings-preview`, FindingsPanel pills+filter, PR-list FINDINGS column + popover with 1024-1185px narrow layout, timeline icons, trace-drawer previews); spec `specs/L01-severity-counts.md`.

- 2026-10-01: HW02 Stage 2c — `/conventions` (route-private view, cards,
  create-skill modal), `lib/hooks/conventions.ts` with exported cache rules,
  the skill form pieces promoted to `features/skills/` as pure moves and
  `relativeTime` to `lib/date-format.ts`; `messages/en/conventions.json`
  rewritten around the real keys.

- 2026-10-01 (3a): `ImportSkillModal` gained a `source: "file" | "url"`
  prop (both hook pairs called unconditionally, one view over the active
  pair), the Add Skill menu's "Import from URL", `needsInjectionAck` for
  `imported_url`, `errors.import_url_*` messages.

- 2026-10-02 (3a fix): `ImportSkillModal` shows "Fetched from <fetched_url>"
  under the URL field only when the server fetched a different URL than
  typed (GitHub blob → raw); `errors.import_url_html`; the mirrored
  `knowledge.ts` gained the code and `fetched_url`. The first full
  `pnpm test` after the change timed out 3 tests at the 5 s default under
  load and passed on re-run (38 files / 178 tests).

- 2026-10-02 (import warning): `import.warningKind.no_frontmatter` title only
  — the message is the server `detail`, `ImportPreviewDetails` unchanged;
  mirrored `knowledge.ts` enum value.

## Open Questions

- 2026-09-26: Files already past the `frontend-architecture` review signals,
  kept as refactor candidates — do NOT split them unless a task asks:
  `RunHistory.tsx` at 263 lines (evidence:
  `src/app/repos/[repoId]/pulls/[number]/_components/RunHistory/RunHistory.tsx:94`),
  `Showcase.tsx` at 262 lines (evidence: `src/components/showcase/Showcase.tsx:1`),
  and `pulls/[number]/page.tsx` at 185 lines, which is not a thin route entry:
  it owns tab state from search params, query invalidation after runs and the
  trace-drawer wiring (evidence:
  `src/app/repos/[repoId]/pulls/[number]/page.tsx:26`, `:52-57`, `:175`).
- 2026-09-26: The `reviews` domain is the first candidate for a
  `features/reviews/` layer: its UI already spans three domain widgets in
  `components/` (`severity-summary`, `findings-preview`, `run-cost-badge`) and
  its hooks live in `lib/hooks/reviews.ts`, which on paper meets the skill's
  "≥3 domain widgets of one domain in `components/`" trigger. The move is a
  user decision recorded in `docs/ui-architecture.md`, never done unprompted
  (evidence: `src/components/severity-summary/SeveritySummary.tsx:1`,
  `src/components/findings-preview/FindingsHoverCard.tsx:1`,
  `src/components/run-cost-badge/RunCostBadge.tsx:1`,
  `src/lib/hooks/reviews.ts:28`).
- 2026-09-27: UPDATE to 2026-09-26 `features/reviews/` entry — the user
  deferred the move (evidence: `docs/ui-architecture.md:130-135`). Revisit
  trigger: a FOURTH `reviews` widget lands in `src/components/` (today three:
  `severity-summary`, `findings-preview`, `run-cost-badge`), or the
  `features/<domain>/` trigger fires for a second domain. When either
  happens, propose the move to the user again; until then add new `reviews`
  UI to the existing layout (`_components/`, `components/`,
  `lib/hooks/reviews.ts`).
- 2026-09-27: UPDATE — the revisit condition is met: the `features/<domain>/`
  trigger fired for `skills` (L02). Decision recorded in
  `docs/ui-architecture.md` ("Architecture decisions"): `features/reviews/`
  and `features/skills/` are introduced as L02 Stage 9, after Wave 3 and 7a.
  Until Stage 9 lands, keep the current layout.
