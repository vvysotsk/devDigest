# Insights — e2e

Append-only lessons about `e2e/` that the code cannot tell you.
A lesson that spans packages gets an entry here AND in each other package
it touches; the root `INSIGHTS.md` is for repo tooling only.

Entry format, quality gate, and capture rules live in the
`engineering-insights` skill (`.claude/skills/engineering-insights/SKILL.md`).
Entries: `- YYYY-MM-DD: <actionable statement> (evidence: path:line[, command/error])` — date and path:line are required.
Never rewrite existing entries — correct with a dated note.

## What Works

## What Doesn't Work

## Codebase Patterns

## Tool & Library Notes

- 2026-09-24: `npm run e2e:hermetic` only WARNS when `agent-browser` is not
  installed, then boots Postgres, the API and the web app anyway; every flow
  step then fails with a spawn error from `execFile`. Run
  `npm i -g agent-browser && agent-browser install` first (evidence:
  `../scripts/e2e.sh:51-52`, `run.ts:44-51`).

## Recurring Errors & Fixes

## Session Notes

- 2026-09-24: Seeded `docs/architecture.md` + `specs/flows-contract.md` from
  `run.ts`, `lib/assert.ts`, the seven flow files, `../scripts/e2e.sh` and
  `../.github/workflows/e2e-web.yml`; every `path:line` verified by a
  line-check script.

## Open Questions
