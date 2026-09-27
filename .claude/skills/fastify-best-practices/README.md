# fastify-best-practices — README

The agent loads `SKILL.md` only; this file is for people maintaining the skill.

## What it does

A general Fastify guide: plugins, routes, validation and serialization,
hooks, error handling, logging with Pino, testing with `inject()`, security
headers and deployment. The agent uses it when it writes or changes the
HTTP layer of `server/`.

## How it works

1. **When it loads.** The agent picks the skill by its `description` when a
   task touches a Fastify route, plugin, hook or the app setup.
2. **What it reads.** `SKILL.md` is a short index with a reading order for
   common tasks. Each topic is a file in `rules/`. The agent opens only the
   files the task needs.
3. **In self-review.** `pr-self-review` sends a changed file to this
   skill when the file matches `metadata.applies_to`: module `routes.ts` files, `app.ts`,
   `server.ts`, `platform/**`, and `modules/_shared/context.ts` and
   `schemas.ts`. The
   skill is not blocking, so its findings are WARNING or SUGGESTION.
   Only a concrete runtime defect is CRITICAL.
4. **Project rules win.** This repo validates with zod through
   `fastify-type-provider-zod` (`server/src/app.ts`), not with hand-written
   JSON Schema. How thin a route is, the response schema and its shape test
   are decided by `onion-architecture` (R2, R3). Errors are mapped at the
   edge (`onion-architecture` R7).

## Files

- `SKILL.md` — when to use, quick start, reading order, core principles.
- `rules/` — one file per topic (plugins, routes, schemas, hooks, errors,
  testing, logging, TypeScript and others).
- `tile.json` — package metadata from upstream
  (`mcollina/fastify-best-practices`).

## Changes in this repo

The skill came with the course starter repo.

- 2026-09-26 — `metadata.applies_to` added for `pr-self-review` routing. No
  rule changes.

## Maintaining

The skill has no `metadata.version`, so `pr-self-review` keys its checks by
a hash of `SKILL.md`: any edit to `SKILL.md` re-checks every file the skill
covers. Edits to this README or to the reference files do not. When you edit
`SKILL.md`, add a line to "Changes in this repo".
