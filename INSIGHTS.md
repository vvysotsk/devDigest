# Insights — repo root

Append-only lessons about REPO TOOLING only: `scripts/`, `.gitattributes`,
`docker-compose.yml`, git, `.claude/`, Claude Code. Anything about package code
goes to that package's `INSIGHTS.md` (one entry per package it touches).

Entry format, quality gate, and capture rules live in the
`engineering-insights` skill (`.claude/skills/engineering-insights/SKILL.md`).
Entries: `- YYYY-MM-DD: <actionable statement> (evidence: path:line[, command/error])` — date and path:line are required.
Never rewrite existing entries — correct with a dated note.

## What Works

- 2026-09-18: To recover an artifact from a past session, grep the session
  transcripts for its URL and WebFetch it — curl gets the SPA shell/403
  (evidence: `grep -o 'https://claude\.ai/code/artifact[^"]*' ~/.claude/projects/C--OSPanel-home-devDigest/*.jsonl`).

## What Doesn't Work

## Codebase Patterns

## Tool & Library Notes

- 2026-09-22: pnpm v12 auto-recreates untracked `client/pnpm-workspace.yaml` /
  `server/pnpm-workspace.yaml` (the repo is deliberately NOT a workspace) —
  harmless to the build, but it breaks `git stash pop` of a stash made with
  `--include-untracked` ("already exists, no checkout"); recover with
  `git ls-tree stash@{0}^3` to verify contents, then `git stash drop`
  (evidence: pop failed after a vitest run recreated server/pnpm-workspace.yaml).

- 2026-09-18: A new skill added under `.claude/skills/<name>/SKILL.md` is
  discovered live in the same Claude Code session — no restart needed; the
  frontmatter `description` alone drives when it triggers (evidence:
  engineering-insights appeared in the available-skills list right after Write).

- 2026-09-24: Line numbers read off a multi-file dump (`cat -n a b c`, or
  several files in one tool result) are CUMULATIVE — 52 of 237 `path:line`
  refs in the first seed of `server/specs/review-flow.md` pointed past EOF
  (e.g. `sse.ts:458` in a 103-line file). When citing lines, read ONE file per
  command, and verify with a script that checks line ≤ file length AND that
  the cited symbol appears near the line; a "path exists" check catches none
  of these (evidence: `.claude/skills/package-docs/SKILL.md:61`, `:88`).

## Recurring Errors & Fixes

- 2026-09-18: Python on this Windows box crashes with UnicodeEncodeError
  (cp1251) when printing non-ASCII from scripts run via Git Bash — prefix with
  `PYTHONIOENCODING=utf-8` (evidence: heredoc script printing "→" failed until
  prefixed).
- 2026-09-24: `env: $'bash\r': No such file or directory` on `./scripts/dev.sh`
  means the script was checked out with CRLF. `.gitattributes` forces
  `eol=lf` for `*.sh`; after changing it run `git add --renormalize .` so
  already-tracked files are rewritten, then re-run (evidence:
  `.gitattributes:2-4`, commit `b11fd0c`).
- 2026-09-24: After a reinstall pnpm 10+ skips dependency build scripts and
  warns `Ignored build scripts: ssh2… help: Run "pnpm approve-builds"`
  (surfaces as `ERR_PNPM_IGNORED_BUILDS` when the build is required) — run
  `pnpm approve-builds` once in `server/`; `scripts/dev.sh` only runs
  `pnpm install` and does not do it for you (evidence: `scripts/dev.sh:73`,
  pnpm output on 2026-09-22).

## Session Notes

- 2026-09-26: Added `.claude/skills/pr-self-review` (SKILL.md v1.0.0, `scripts/self-review.mjs`, `checker.md`, `.claude/agents/skill-checker.md`); checker skills now declare `metadata.applies_to` as a comma-separated string (frontend-/onion-architecture bumped to 1.0.1). First dry-run on `lesson-1` was BLOCKED by the `test/indexer-pipeline.test.ts` ENOENT failure (failed tests are a non-dismissable CRITICAL); its cause turned out to be a test bug, fixed the same day (`server/INSIGHTS.md`). The first `security` checkers answered a bare `[]` in ~10 s, so a checker reply is now `{checked_files, rules_applied, findings}` and only listed files are journaled as checked (`.claude/skills/pr-self-review/scripts/self-review.mjs`, `cmdGround`).

- 2026-09-26: Added `.claude/skills/onion-architecture` (SKILL.md v1.0.0, README with sources per rule, `references/` with the 104-source research, inventory and plan); root `CLAUDE.md` Verification now names the advisory `pnpm deps:check`.

- 2026-09-26: Added `.claude/skills/frontend-architecture` (SKILL.md with the
  settled placement rules R1–R7, review signals and architecture-change
  triggers; `references/research.md` + `references/sources.md` hold the
  275-source research it was distilled from). `react-best-practices` now
  defers its size thresholds to it; `.claude/skills/README.md` catalog updated.
- 2026-09-24: Rewrote the `engineering-insights` skill (path:line + date
  mandatory, routing by evidence file), added the `package-docs` skill, and
  seeded real docs/specs for server, client, reviewer-core and e2e; the
  evidence line-check (step 6 of the package-docs workflow) came out of the
  cumulative-line-number miss recorded above.

- 2026-09-24: L01 severity counts shipped in three reviewed stages; `server/src/modules/_shared/latest-batch.ts` now owns the "latest batch" rule for BOTH the PR-list cost and the findings counts — change it there, not in `pulls/routes.ts`.
  - 2026-09-24 correction (criterion 12): the PR-list COST no longer uses the latest batch — it is `sumSettledRunCost` over every `done` run; only the FINDINGS column is batch-scoped. Both rules still live in `latest-batch.ts`.
- 2026-09-18: Scaffolded CLAUDE.md maps, per-module INSIGHTS/docs/specs, and
  the engineering-insights skill; confirmed shared-contracts drift (5 files)
  and promoted it straight to server/CLAUDE.md.
- 2026-09-22: Implemented L01 run-cost badge end-to-end (re-added
  `agent_runs.cost_usd` + new `batch_id`, read-time `resolveRunCost` fallback,
  `RunCostBadge` on PR list / timeline / trace drawer; spec in
  `specs/L01-run-cost.md`); hit the Windows db:migrate no-op and the stale
  stash/pnpm-workspace quirks recorded above.

## Open Questions
