# Insights — server

Append-only lessons about `server/` that the code cannot tell you.
Cross-package insights go to the root `INSIGHTS.md` instead.

Entry format, quality gate, and capture rules live in the
`engineering-insights` skill (`.claude/skills/engineering-insights/SKILL.md`).
Entries: `- YYYY-MM-DD: <actionable statement> (evidence: file:line or command)`.
Never rewrite existing entries — correct with a dated note.

## What Works

## What Doesn't Work

- 2026-09-22: `test/indexer-pipeline.test.ts` (6 tests) fails on this Windows
  box with ENOENT on temp-dir files — pre-existing environment issue, not
  caused by unrelated diffs; don't chase it unless working on repo-intel
  (evidence: `ENOENT: open 'C:\Users\...\Temp\repo-intel-full-*\src\util.ts'`
  on a clean tree).

## Codebase Patterns

## Tool & Library Notes

## Recurring Errors & Fixes

- 2026-09-22: `pnpm db:migrate` exits 0 WITHOUT applying migrations on
  Windows — the CLI guard `import.meta.url === \`file://${process.argv[1]}\``
  in `src/db/migrate.ts:37` never matches (`file:///C:/...` vs `C:\...`).
  Fix: call the export directly:
  `pnpm exec tsx -e "import('./src/db/migrate.ts').then(m => m.runMigrations(process.env.DATABASE_URL))"`,
  then verify the columns actually exist (evidence: 0010 columns absent from
  information_schema after a "successful" `pnpm db:migrate`).

## Session Notes

## Open Questions
