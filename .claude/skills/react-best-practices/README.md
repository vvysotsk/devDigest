# react-best-practices — README

The agent loads `SKILL.md` only; this file is for people maintaining the skill.

## What it does

A catalog of React practices and anti-patterns: component design, derived
state, state location, hooks and effects, memoization, keys, conditional
rendering, accessibility, data fetching, error boundaries and React 19
patterns. Each section has a severity (CRITICAL, HIGH, MEDIUM).

## How it works

1. **When it loads.** The agent picks the skill by its `description` when it
   writes, reviews or refactors a component, a hook or state.
2. **What it reads.** `SKILL.md` has the rules. `examples.md` has code
   pairs; the agent opens it when it needs an example.
3. **In self-review.** `pr-self-review` sends a changed file to this
   skill when the file matches `metadata.applies_to`: every `.tsx` file in `client/src/`
   and the hooks in `client/src/lib/hooks/`, but not tests. The
   skill is not blocking, so its findings are WARNING or SUGGESTION.
   Only a concrete runtime defect is CRITICAL.
4. **Project rules win.** Where a component or hook lives, and when a file is
   too big, is decided by `frontend-architecture`. Size is a review signal
   there, not a cap. The "Code Organization" section of this skill suggests
   a feature-based structure; this repo does not have `features/` yet
   (`frontend-architecture` R4 and its trigger). The client fetches data
   with TanStack Query and does not use Axios, so the Axios section does not
   apply.

## Files

- `SKILL.md` — the rules by severity.
- `examples.md` — code examples.

## Changes in this repo

The skill came with the course starter repo.

- 2026-09-26 — the "max 200 lines per component" and "max 5–7 props" caps
  became a review signal that points to the thresholds in
  `frontend-architecture` ("Review signals").
- 2026-09-26 — `metadata.applies_to` added for `pr-self-review` routing.

## Maintaining

The skill has no `metadata.version`, so `pr-self-review` keys its checks by
a hash of `SKILL.md`: any edit to `SKILL.md` re-checks every file the skill
covers. Edits to this README or to the reference files do not. When you edit
`SKILL.md`, add a line to "Changes in this repo".
