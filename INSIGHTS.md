# Insights — repo root

Append-only lessons that the code cannot tell you. Cross-package insights live
here; package-specific ones go to that package's own `INSIGHTS.md`.

Entry format, quality gate, and capture rules live in the
`engineering-insights` skill (`.claude/skills/engineering-insights/SKILL.md`).
Entries: `- YYYY-MM-DD: <actionable statement> (evidence: file:line or command)`.
Never rewrite existing entries — correct with a dated note.

## What Works

- 2026-09-18: To recover an artifact from a past session, grep the session
  transcripts for its URL and WebFetch it — curl gets the SPA shell/403
  (evidence: `grep -o 'https://claude\.ai/code/artifact[^"]*' ~/.claude/projects/C--OSPanel-home-devDigest/*.jsonl`).

## What Doesn't Work

## Codebase Patterns

## Tool & Library Notes

- 2026-09-18: A new skill added under `.claude/skills/<name>/SKILL.md` is
  discovered live in the same Claude Code session — no restart needed; the
  frontmatter `description` alone drives when it triggers (evidence:
  engineering-insights appeared in the available-skills list right after Write).

## Recurring Errors & Fixes

- 2026-09-18: Python on this Windows box crashes with UnicodeEncodeError
  (cp1251) when printing non-ASCII from scripts run via Git Bash — prefix with
  `PYTHONIOENCODING=utf-8` (evidence: heredoc script printing "→" failed until
  prefixed).

## Session Notes

- 2026-09-18: Scaffolded CLAUDE.md maps, per-module INSIGHTS/docs/specs, and
  the engineering-insights skill; confirmed shared-contracts drift (5 files)
  and promoted it straight to server/CLAUDE.md.

## Open Questions
