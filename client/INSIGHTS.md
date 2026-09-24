# Insights — client

Append-only lessons about `client/` that the code cannot tell you.
Cross-package insights go to the root `INSIGHTS.md` instead.

Entry format, quality gate, and capture rules live in the
`engineering-insights` skill (`.claude/skills/engineering-insights/SKILL.md`).
Entries: `- YYYY-MM-DD: <actionable statement> (evidence: file:line or command)`.
Never rewrite existing entries — correct with a dated note.

## What Works

## What Doesn't Work

- 2026-09-24: A CSS custom property referenced through `var()` must be defined on (or above) the element that COMPUTES the referencing property, not on a descendant — `.pr-list { --pr-grid: var(--pr-grid-wide) }` with `--pr-grid-wide` set inline on the inner table card made `--pr-grid` invalid, and every row collapsed into one column (`grid-template-columns: none`). Put the source variables on the same element (`s.listRoot` on the `.pr-list` div) and give each `var()` in inline styles a fallback (evidence: `src/app/repos/[repoId]/pulls/styles.ts` listRoot/row).

## Codebase Patterns

- 2026-09-24: The client uses inline styles, which cannot express media queries — the pattern for responsive layout is a class wrapper (`.pr-list`) whose CSS variables are switched in `app/globals.css` under `@media`, while inline styles read `var(--pr-gap, 14px)` etc. Keep the grid templates themselves in `pulls/constants.ts` (`GRID`, `GRID_NARROW`, `NARROW_MAX_WIDTH`) and only the switching in CSS (evidence: `src/app/globals.css` `.pr-list`, `pulls/styles.ts`).
- 2026-09-24: In `FindingsTab` the prop named `runs` is `ReviewRecord[]` (persisted reviews) and `prRuns` is `RunSummary[]` (agent_runs rows); `RunHistory` needs BOTH (`runs={prRuns}` for the tiles, `reviews={runs}` to match findings by `run_id`) — do not "fix" the names, the accordion list depends on them (evidence: `FindingsTab.tsx` RunHistory props).

## Tool & Library Notes

- 2026-09-24: Importing a fixture from another `*.test.tsx` makes vitest execute that file's `describe` blocks inside the importer too (duplicated/failing tests); keep shared fixtures in a non-test file such as `test-fixtures.ts` (evidence: `src/components/findings-preview/test-fixtures.ts`).
- 2026-09-24: `pnpm exec vitest run <path>` silently matches nothing when the path contains `[repoId]`/`[number]` brackets (glob chars); filter by file name instead, e.g. `vitest run FindingsPanel` (evidence: FindingsPanel run showed only 2 unrelated files until the filter was changed).

## Recurring Errors & Fixes

## Session Notes

- 2026-09-24: L01 severity counters end-to-end (`severity-summary`, `findings-preview`, FindingsPanel pills+filter, PR-list FINDINGS column + popover with 1024-1185px narrow layout, timeline icons, trace-drawer previews); spec `specs/L01-severity-counts.md`.

## Open Questions
