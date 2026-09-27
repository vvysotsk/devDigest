# pr-self-review — README

The agent loads `SKILL.md` only; this file is for people maintaining the skill.

## What it does

A gate before a pull request. It takes every file changed since the
merge-base with `origin/main` (commits, staged, unstaged, untracked), routes
each file to the skills whose `metadata.applies_to` matches it, and re-checks
only the (skill, file) pairs the journal has not seen at the file's current
content. Checks run as parallel read-only subagents; their findings pass a
grounding gate (the cited line must be an added line of the diff) and, for
CRITICAL, a verify pass. Next to that it runs the Do-not-touch guards, the
shared-contracts mirror check, the onion baseline check and the typecheck/
tests of touched packages. Any open CRITICAL → the agent does not run
`gh pr create` and does not push the branch for a PR (other pushes are not
gated).

## How it works

The work is split in two. A script does everything that must be exact:
it finds what changed, decides what needs checking, runs the guards and
decides the verdict. Subagents do the part that needs judgment: they read
the changed code against a skill's rules. The script never trusts a
subagent's answer as is. It checks it first.

A run goes like this:

1. **Plan.** The script finds the changed files and matches each one to
   the skills that apply to it. It skips any (skill, file) pair that was
   already checked at the same file content and the same skill version. It
   groups the rest into batches and estimates the cost. If the run is
   large, the agent asks before it starts.
2. **Mechanical checks.** The agent runs typecheck and tests for the
   touched packages. The script runs the repo guards (migrations, lock
   files, shared contracts, secrets and others). A command that already
   passed on the same input files is not run again.
3. **Skill checks.** One read-only subagent runs per batch. It applies one
   skill to its files and replies with the files it checked, the rules it
   applied and its findings.
4. **Grounding.** The script drops every finding it cannot tie to the
   diff: the cited line must be a line this branch added, and the quoted
   code must be on that line. A batch with an empty or incomplete reply
   does not count as checked.
5. **Verify.** A second subagent re-checks each CRITICAL finding. A
   finding it disproves drops to WARNING.
6. **Report.** Any open CRITICAL, or a required command that failed or
   was not run, gives BLOCKED, and the agent does not open the PR. Otherwise the
   verdict is PASS.

**Memory between runs.** Results go to a journal inside `.git`, so it is
never committed. A pair counts as checked for one exact file content (git
blob) and one skill `major.minor` version. When you edit the file, or
the skill gets a minor or major bump, the pair is checked again. This is
why a second run after a small fix checks only what changed.

**Accepting a finding.** Only a person can dismiss a skill finding, with
`node .claude/skills/pr-self-review/scripts/self-review.mjs dismiss <id> --reason "<why>"`.
The dismissal holds only while the file content stays the same. It matches
the finding by content (skill, rule id or heading, path, line), so a re-check
that words the rule differently keeps it. After the file changes, a
dismissed CRITICAL blocks again. Mechanical findings cannot
be dismissed. You must fix them.

**Known limit.** A finding on a file is not re-checked when only a
related file changes (its test, or a file it imports). Procedure: re-run
that skill in full, `plan --full --skills <skill>` (SKILL.md "A fix that
lands in another file"); decision in `references/plan.md` §12.

Files:
- `SKILL.md` — the procedure the agent follows.
- `checker.md` — instructions every checker subagent reads.
- `scripts/self-review.mjs` — the deterministic half: `plan`, `record-mech`,
  `ground`, `report`, `dismiss` (Node ≥ 22, no dependencies).
- `scripts/journal-keys.mjs` — pure journal-key helpers (skill revision =
  `major.minor`, pair keys); tests:
  `node --test .claude/skills/pr-self-review/scripts/journal-keys.test.mjs`
  (run it after changing either script).
- `../../agents/skill-checker.md` — read-only checker agent type (loaded at
  session start; the skill falls back to `general-purpose`).
- `references/plan.md` — design, options and decisions D1–D13;
  `references/sources.md` — every source.

## Version

**2.1.0** — see `metadata.version` in `SKILL.md` and the row in
`.claude/skills/README.md`.

When you change `SKILL.md`, `checker.md` or the script, bump the version
and add a Changelog line:
- **patch** — wording, report layout, estimator constants;
- **minor** — a new guard, mechanical check or report section;
- **major** — the CRITICAL list, the "checked" definition (journal key) or a
  decision D1–D13 changes.

## Changelog

- **2.1.0 — 2026-09-27** — stable finding ids (plan.md D13): the id is
  sha1 of skill | `ruleKey(rule)` | path | line hash, where `ruleKey` keeps
  only the rule's id (`R3`, `check 7`, `A05`, `§12`) or its heading, so a
  re-check that words the rule differently keeps the id; findings with the
  same id in one file are merged. Dismissals match by content (skill, rule
  key, path, line hash) per blob; old dismissal records resolve through
  their finding record, and `dismiss` accepts old ids. `checker.md` asks for
  the rule id or heading alone. Helpers and tests in
  `scripts/journal-keys.{mjs,test.mjs}`.
- **2.0.1 — 2026-09-27** — procedure only, no rule or key changes: SKILL.md
  "A fix that lands in another file" — re-run the skill with
  `plan --full --skills <skill>` instead of dismissing; plan.md §12 resolved
  as option (d), with the journal evidence.
- **2.0.0 — 2026-09-27** — the "checked" definition changes (D8): a
  versioned skill's journal revision is `major.minor` of
  `metadata.version`, so a patch bump (wording) keeps its checks and only a
  minor or major bump re-checks; journal records written with the full
  version (`v1.1.0`) read as `v1.1`. Unversioned skills keep the `SKILL.md`
  hash. Key helpers live in `scripts/journal-keys.mjs`, tested by
  `scripts/journal-keys.test.mjs`.
- **1.0.0 — 2026-09-26** — first version: routing by `metadata.applies_to`
  (comma-separated string) and `metadata.blocking`; journal in
  `<git-common-dir>/devdigest/pr-self-review/` keyed by skill revision ×
  path × blob; transcripts as "likely checked" hints only; 10 mechanical
  guards (migrations, `_journal.json` append-only, lock files,
  `pnpm-workspace.yaml`, vendor/shared mirror, `process.env`, secrets,
  onion baseline check 12, docs/specs, skill version bump) plus the D9
  uncommitted-state blocker; typecheck/tests of touched packages (Docker
  suites only for DB code with Docker up; e2e also needs agent-browser);
  checker reply `{checked_files, rules_applied, findings}` — a journal
  check only for listed files, anything less is CRITICAL "self-review
  incomplete"; read-only `skill-checker` agent (Read/Grep/Glob/Skill, no
  shell); `--skills` filter; only pushes for a PR are gated;
  grounding gate; verify pass for CRITICAL; dismissals per blob; full and
  blocking-only modes with the large-diff stop (> 12 batches or > 600k
  tokens). Dry-run on `lesson-1`: 9 batches, estimate 431k, actual ~603k
  checker tokens (the per-batch overhead constant was raised from 12k to
  30k after it); the four `security` batches first answered a bare `[]` in
  ~10 s, which is why a reply must now name what it covered; the
  `--full --skills security` re-audit on `skill-checker` covered 51/51
  files with 8–13 rules each, ~172k tokens, 0 findings.

## Sources used

Only the sources behind a rule. Full list with status: `references/sources.md`.

### Routing and skill metadata
- C1 — Claude Code docs, Skills (frontmatter: `paths`, `metadata`, unknown keys ignored) — https://code.claude.com/docs/en/skills
- C3 — Agent Skills specification (`metadata` is a string → string map) — https://agentskills.io/specification

### Parallel checkers
- C2 — Claude Code docs, Subagents (Skill tool inside subagents, 20 concurrent, nesting) — https://code.claude.com/docs/en/sub-agents

### Transcripts as hints
- C5 — Claude Code docs, Settings (`cleanupPeriodDays`, `CLAUDE_CONFIG_DIR`) — https://code.claude.com/docs/en/settings
- C6 — Claude Code docs, Sessions (transcript location; JSONL is not a stable API) — https://code.claude.com/docs/en/sessions
- L4 — local observation of `~/.claude/projects/*/…jsonl` (see `references/sources.md`)

### Blocking rules and false positives
- R1 — Anthropic, Code Review for Claude Code (verify step before ranking) — https://claude.com/blog/code-review
- R2 — anthropics/claude-code-security-review (false-positive filtering) — https://github.com/anthropics/claude-code-security-review
- R3 — Sadowski et al., Lessons from Building Static Analysis Tools at Google, CACM 2018 — https://cacm.acm.org/research/lessons-from-building-static-analysis-tools-at-google/
- R4 — Google Engineering Practices, How to write code review comments — https://google.github.io/eng-practices/review/reviewer/comments.html
- R5 — Conventional Comments (blocking / non-blocking) — https://conventionalcomments.org/
- R6 — CodeRabbit, accurate AI code reviews (deterministic checks first) — https://www.coderabbit.ai/blog/how-coderabbit-delivers-accurate-ai-code-reviews-on-massive-codebases

### Possible extension (not built)
- C4 — Claude Code docs, Hooks (`PreToolUse` on `Bash`, exit 2 blocks) — https://code.claude.com/docs/en/hooks
