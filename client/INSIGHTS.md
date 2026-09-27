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

## Tool & Library Notes

- 2026-09-27: To read the latest callback prop without re-running an effect,
  use `React.useEffectEvent` (React 19.2, `@types/react` has it) instead of
  writing `ref.current = prop` during render (a render-time side effect). An
  effect event may be called only from inside effects, never from event
  handlers or render — so `FindingsHoverCard` fires `onOpen` from an effect
  on `open` becoming true, not from the mouse/focus handlers
  (`src/components/findings-preview/FindingsHoverCard.tsx:61`, `:140`).
- 2026-09-24: Importing a fixture from another `*.test.tsx` makes vitest execute that file's `describe` blocks inside the importer too (duplicated/failing tests); keep shared fixtures in a non-test file such as `test-fixtures.ts` (evidence: `src/components/findings-preview/test-fixtures.ts`).
- 2026-09-24: UPDATE to the test-fixtures entry — evidence lines:
  `src/components/findings-preview/FindingsHoverCard.test.tsx:9` and
  `src/components/findings-preview/FindingsPopover.test.tsx:7` import `finding`
  from `./test-fixtures`.
- 2026-09-24: `pnpm exec vitest run <path>` silently matches nothing when the path contains `[repoId]`/`[number]` brackets (glob chars); filter by file name instead, e.g. `vitest run FindingsPanel` (evidence: FindingsPanel run showed only 2 unrelated files until the filter was changed).
- 2026-09-24: UPDATE to the vitest bracket-path entry — evidence:
  `package.json:10` (`"test": "vitest run"`) with the bracketed path
  `src/app/repos/[repoId]/pulls/[number]/_components/FindingsPanel/FindingsPanel.test.tsx`.

## Recurring Errors & Fixes

- 2026-09-26: When deleting a barrel, grep for its RELATIVE spellings too —
  the alias grep (`lib/hooks"`) found 7 importers of `src/lib/hooks/index.ts`
  but missed `import { useRepos } from "./hooks"` inside `lib/` itself; only
  `pnpm typecheck` caught it (`TS2307: Cannot find module './hooks'`), while
  `pnpm test` stayed green because no test loads `repo-context.tsx`. Run
  typecheck before tests after any module move (evidence:
  `src/lib/repo-context.tsx:7`).

## Session Notes

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
