# next-best-practices — README

The agent loads `SKILL.md` only; this file is for people maintaining the skill.

## What it does

A general Next.js App Router guide: file conventions, RSC boundaries, async
APIs, directives, error handling, data patterns, route handlers, metadata,
images, fonts, bundling, hydration errors, Suspense and self-hosting.

## How it works

1. **When it loads.** The agent loads it by itself when it works on Next.js
   code. It has `user-invocable: false`, so there is no slash command for
   it.
2. **What it reads.** `SKILL.md` is a short index, one section per topic.
   Each section points to a topic file next to it (`rsc-boundaries.md`,
   `error-handling.md` and others). The agent opens only what the task
   needs.
3. **In self-review.** `pr-self-review` sends a changed file to this
   skill when the file matches `metadata.applies_to`: `client/src/app/**`, `next.config.*`,
   `client/src/middleware.ts` and `client/src/i18n/**`. The
   skill is not blocking, so its findings are WARNING or SUGGESTION.
   Only a concrete runtime defect is CRITICAL.
4. **Project rules win.** The client is an all-client App Router app with
   no Next.js server layer (`frontend-architecture` R6): no Server Actions,
   no DAL, no route handlers, no server fetch. The parts about server data
   fetching, route handlers and self-hosting apply only after the
   "Next.js server layer" trigger in `frontend-architecture` fires and is
   accepted. Route error boundaries follow `frontend-architecture` R5.

## Files

- `SKILL.md` — index of topics.
- `*.md` next to it — one file per topic.

## Changes in this repo

The skill came with the course starter repo.

- 2026-09-26 — `metadata.applies_to` added for `pr-self-review` routing. No
  rule changes.

## Maintaining

The skill has no `metadata.version`, so `pr-self-review` keys its checks by
a hash of `SKILL.md`: any edit to `SKILL.md` re-checks every file the skill
covers. Edits to this README or to the reference files do not. When you edit
`SKILL.md`, add a line to "Changes in this repo".
