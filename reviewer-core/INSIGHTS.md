# Insights — reviewer-core

Append-only lessons about `reviewer-core/` that the code cannot tell you.
A lesson that spans packages gets an entry here AND in each other package
it touches; the root `INSIGHTS.md` is for repo tooling only.

Entry format, quality gate, and capture rules live in the
`engineering-insights` skill (`.claude/skills/engineering-insights/SKILL.md`).
Entries: `- YYYY-MM-DD: <actionable statement> (evidence: path:line[, command/error])` — date and path:line are required.
Never rewrite existing entries — correct with a dated note.

## What Works

## What Doesn't Work

## Codebase Patterns

- 2026-09-24: `sliceDiff()` selects a file's chunk by
  `line.includes(\` ${path}\`)` on the `diff --git` header, so a path that is a
  suffix of another (`config.ts` vs `src/config.ts`) can pull the wrong file
  into a map-reduce chunk. Only reachable when `strategy` is `map-reduce` /
  `auto` — the studio pins `single-pass` — so match on `b/${path}` exactly
  before enabling map-reduce (evidence: `src/review/reduce.ts:63-64`;
  `../server/src/modules/reviews/constants.ts:12`).

## Tool & Library Notes

## Recurring Errors & Fixes

## Session Notes

- 2026-09-24: Seeded `docs/pipeline.md` + `specs/grounding-gate.md` from
  `src/review/run.ts`, `src/grounding.ts`, `src/prompt.ts`,
  `src/output/to-review.ts` and the tests; every `path:line` verified by a
  line-check script.

## Open Questions
