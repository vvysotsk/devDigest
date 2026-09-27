---
name: pr-self-review
description: "Self-review gate before a pull request, started by the user with /pr-self-review (the model never invokes it on its own). Run it before gh pr create or pushing a branch for review. Routes every changed file to the skills whose metadata.applies_to matches it, re-checks only what the journal has not seen at the current content, runs typecheck/tests of touched packages and the Do-not-touch guards, and refuses to create the PR while any CRITICAL finding is open."
argument-hint: "[--mode full|blocking] [--skills a,b] [--full] [--base <ref>]"
disable-model-invocation: true
metadata:
  version: 2.2.0
---

# PR self-review

Before a PR exists, every changed file must have been checked by every skill
whose `metadata.applies_to` matches it, at its current content, and the
touched packages must typecheck and pass tests. **Any open CRITICAL → no PR.**
This skill is the only gate (no hook): while it reports BLOCKED you do not
run `gh pr create`, and you do not `git push` a branch in order to open or
update a PR; you tell the user why. Other pushes (a backup of work in
progress, a branch nobody reviews yet) are not gated.

The deterministic half is `scripts/self-review.mjs` (Node, no deps): scope,
guards, routing, journal, grounding, report. You orchestrate: run the
commands, spawn checkers, save their JSON, relay the report. Reasoning and
options behind every rule: `references/plan.md`; sources:
`references/sources.md`.

`S=.claude/skills/pr-self-review/scripts/self-review.mjs` below; run it with
`node $S …` from the repo root.

## Steps

### 1. Plan

```
node $S plan [--mode full|blocking] [--skills a,b] [--full] [--base <ref>]
```

It prints the plan and writes `<run>/plan.json` + one `batch-NN.json` per
checker batch. The run dir is printed on the last line; pass it as `--run`.

- Base = `merge-base HEAD origin/main` (falls back to `main`), never
  fetched; the report states the ref and the age of the last fetch.
- Scope = committed + staged + unstaged changes since the base + untracked
  files. Excluded from skill runs (still guarded): lock files,
  `pnpm-workspace.yaml`, drizzle `migrations/meta/`, `client/src/vendor/shared`
  (a mirror), build output, binaries, deletions.
- A (skill, file) pair counts as checked only when the journal has a check
  for the same skill revision and the same `git hash-object` of the file.
  Skill revision = `major.minor` of `metadata.version` (a patch bump —
  wording, per the skill's README — keeps its checks; a minor or major bump
  re-checks), or the `SKILL.md` hash when a skill has no version (any edit
  re-checks). `--full` ignores the journal; `--skills a,b` limits the
  run to those skills (e.g. `--full --skills security` re-audits one skill).
- Session transcripts only label pairs "likely checked"; those pairs still
  run. Missing or unreadable transcripts change nothing but that label.
- Skills without `applies_to` are listed as "not routed" and never run
  (typescript-expert, mermaid-diagram, engineering-insights, package-docs,
  devdigest-demo).

**Large diff** — the plan prints `⚠ LARGE` when there are more than 12
batches or more than ~600k estimated tokens. Then STOP before spawning
anything and ask the user: (a) run everything, (b) `--mode blocking`
(mechanical checks + skills with `metadata.blocking: "true"`; the rest is
reported as "not checked in this mode"), (c) split the PR. If the user
already chose a mode in the request, use it.

### 2. Mechanical checks (no LLM)

The guards already ran inside `plan` (listed under "Guards"). Now run every
command the plan lists as `[run]` (skip `[cached pass]`), in the package
directory, in the background while the checkers work, and record each:

```
node $S record-mech --run <run> --package server --command "pnpm typecheck" --result pass|fail --summary "<first error lines>"
```

`--command` must be the exact string from the plan. Run the commands in Git
Bash (the integration command carries a `DEVDIGEST_REQUIRE_DOCKER=1` prefix,
so a missing Docker fails it instead of skipping its files) and put the
skipped count of every test run into `--summary`; a non-zero skipped count on
the integration run is a `fail`. Touched packages =
packages with changed code, plus `server` when `reviewer-core` changed, plus
`client` and `reviewer-core` when `server/src/vendor/shared` changed. Docker
suites (server integration, e2e hermetic) run only when DB code changed and
Docker is up; otherwise the report carries WARNING "integration not run".
e2e hermetic also needs the global `agent-browser` CLI; without it: WARNING
"e2e not run".

When the plan shows both `server/src/vendor/shared/<f>` and its client copy
changed, compare only the touched hunks yourself (the copies already drift
in 3 files — `server/CLAUDE.md`); a hunk missing from the copy is CRITICAL.

### 3. Checkers (subagents, parallel, max 6 at a time)

One subagent per batch, `subagent_type: "skill-checker"` (fallback
`general-purpose` with the same prompt when that type is not available).
Prompt:

> Follow `.claude/skills/pr-self-review/checker.md`. Batch file: `<path of batch-NN.json>`.

Each checker replies with one JSON object
`{checked_files, rules_applied, findings}`. Save it unchanged to the batch's
`findings_file` (`<run>/batch-NN.findings.json`). If a reply is not valid
JSON, ask that subagent once to resend only the object. Never write a reply
on its behalf: leave the file missing, and the report marks the batch
incomplete (CRITICAL "self-review incomplete").

### 4. Ground

```
node $S ground --run <run>
```

Drops every finding whose path is outside the batch, whose lines miss the
added lines, whose `evidence` is not on a cited added line, that names no
rule, or has low confidence (same idea as `reviewer-core/src/grounding.ts`).
Drops are printed with the reason — never silent. It writes the journal
`check` records ONLY for files listed in `checked_files` (with the
`rules_applied`), plus `finding` records. A batch whose reply is not that
object, whose `rules_applied` is empty, or whose `checked_files` misses a
batch file is incomplete → CRITICAL "self-review incomplete"; the missing
files have no journal check, so the next `plan` schedules them again.

### 5. Verify CRITICAL skill findings

If `ground` kept any CRITICAL from a skill, spawn ONE `general-purpose`
subagent with all of them (`<run>/ground.json`, entries with
`"severity": "CRITICAL"`): "For each finding, read the cited lines, the
rule in the skill and the surrounding code, and try to disprove it. Return
`[{id, verdict: "confirmed"|"disproved", reason}]`." Save the array to
`<run>/verify.json`. Disproved → downgraded to WARNING with the reason.

### 6. Report

```
node $S report --run <run> [--pr-body]
```

Relay the terminal report to the user (in their language; paths, ids and
rule names verbatim). It has: base ref and fetch age, scope, pairs (from
journal / run now / likely checked / not checked in this mode), mechanical
results, findings by severity with `path:line`, skill, rule, why, fix,
dismissed and dropped findings, "not routed" skills, files no skill covers
and the e2e gap.

### 7. Verdict

- **BLOCKED** (any CRITICAL): do not run `gh pr create` and do not push the
  branch for review (to open or update a PR). Say
  which findings block and what the user can do.
- **PASS**: a PR may be created only from the reviewed state. Re-run
  `node $S plan` first if anything changed since; then use `--pr-body`
  output (`<run>/pr-body.md`) as the "Self-review" section of the PR body.

## CRITICAL — the whole list

1. Do-not-touch: an applied migration (present at the base) edited, renamed
   or deleted; `migrations/meta/_journal.json` not append-only; a lock file
   changed without its `package.json`; a committed `pnpm-workspace.yaml`.
2. `server/src/vendor/shared` changed without the client mirror (or the
   client copy edited without the master).
3. `process.env` read on an added line of feature code
   (`server/src/modules/`, `reviewer-core/src/`, `client/src/`, not tests).
4. A secret-shaped string on an added line (WARNING in test files).
5. `server/.dependency-cruiser-known-violations.json` gained an entry
   (onion-architecture check 12). A newly introduced baseline file is a
   WARNING: reviewers accept the initial list explicitly.
6. A typecheck or test of a touched package failed, or was not run.
7. Changed files not committed (D9): the PR must equal the reviewed state.
8. A checker batch without a reply, or with a reply that does not cover
   every batch file (`checked_files`) with at least one rule (`rules_applied`).
9. Skill findings that survived grounding and verification: `security` at
   HIGH confidence; a must/never rule of a skill with `blocking: "true"`;
   from any skill, a concrete runtime defect.

Never CRITICAL: review signals and thresholds, style, findings on unchanged
lines, medium confidence. WARNING-level mechanical checks: package code
changed without its `docs/`/`specs/` (package-docs rule); a versioned skill
whose `SKILL.md` changed without a `metadata.version` bump.

## A fix that lands in another file

A skill finding stays open while ITS file keeps the same content, even when
the fix went into another file (e.g. a route's "no shape test" finding fixed
by adding the test). Do not dismiss it: re-run that skill in full,

```
node $S plan --full --skills <skill>
```

then spawn its checkers, `ground` and `report` as usual. The fresh check of
the unchanged file replaces the old one in the journal; if the finding no
longer holds, it is gone. Dismiss only a finding that is wrong.

## Dismissing a false alarm

Only skill findings can be dismissed (ids without the `m-` prefix);
mechanical ones (1–8 above) are fixed, not dismissed. The user decides —
never dismiss on your own.

```
node $S dismiss <id> --reason "<why this is not a problem here>"
```

A finding's id is stable across re-checks: it is built from the skill, the
rule's id or heading (not the checker's wording of it), the path and the
cited line's text. A dismissal matches the finding by that content, so a
`--full` re-check or a skill bump that words the rule differently does not
bring it back. `dismiss` also accepts an id printed by an older version.

The dismissal holds while the file content (blob) is unchanged. After the
file changes, a finding with the same id comes back as "previously
dismissed": a CRITICAL blocks again, a WARNING/SUGGESTION does not.

## Journal

`$(git rev-parse --git-common-dir)/devdigest/pr-self-review/journal.jsonl`
— outside the working tree, never committed, shared by worktrees. Records:
`check`, `mech`, `finding`, `dismissal`, `run`. Run dirs sit next to it
under `runs/`. Do not edit it by hand; delete it to start from scratch.

## Budget

Typical diff (≈10 files, one package): 4–6 checker subagents, 150–350k
tokens, 2–4 min. Measured on `lesson-1` (blocking mode, 9 batches):
54–80k tokens per checker, ~603k total, ~1 min wall time at 6 parallel.
A re-run after a fix re-checks only the changed files.
Report the plan's estimate before spawning, and the actual subagent tokens
after the run.

## Adding a skill to self-review

Give it `metadata.applies_to` — a comma-separated glob string, `!` to
exclude, no braces, quoted in YAML (values starting with `*` are YAML
aliases otherwise). Add `blocking: "true"` only if the skill has must/never
rules that should stop a PR. A versioned skill's checks are invalidated by
a minor or major version bump, so bump minor (or major) whenever its rules
change; a patch bump (wording only) keeps them.
