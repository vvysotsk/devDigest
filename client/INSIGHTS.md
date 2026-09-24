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

## Session Notes

- 2026-09-24: Seeded `docs/ui-architecture.md` + `specs/pages.md` (line refs
  verified by script); mirrored the `review-api.ts` response-comment fix from
  the server master copy (`src/vendor/shared/contracts/review-api.ts:40-44`).
- 2026-09-24: L01 severity counters end-to-end (`severity-summary`, `findings-preview`, FindingsPanel pills+filter, PR-list FINDINGS column + popover with 1024-1185px narrow layout, timeline icons, trace-drawer previews); spec `specs/L01-severity-counts.md`.

## Open Questions
