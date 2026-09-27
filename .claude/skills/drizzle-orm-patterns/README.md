# drizzle-orm-patterns — README

The agent loads `SKILL.md` only; this file is for people maintaining the skill.

## What it does

A general Drizzle ORM guide: schema definition, CRUD, relations, joins and
aggregations, transactions and Drizzle Kit migrations. The agent uses it when
it writes or changes database code in `server/`.

## How it works

1. **When it loads.** The agent picks the skill by its `description` when a
   task touches Drizzle: a schema, a query, a relation, a transaction or a
   migration.
2. **What it reads.** `SKILL.md` is a short guide with three examples. The
   details are in `references/`, one file per topic. The agent opens a
   reference file only when it needs it.
3. **In self-review.** `pr-self-review` sends a changed file to this
   skill when the file matches `metadata.applies_to`: everything under `server/src/db/`
   (except `migrations/meta/`), module repositories and `drizzle.config.*`. The
   skill is not blocking, so its findings are WARNING or SUGGESTION.
   Only a concrete runtime defect is CRITICAL.
4. **Project rules win.** The skill covers five SQL dialects. This repo uses
   PostgreSQL only, with pgvector. Where queries live and when a use case
   needs a transaction is decided by `onion-architecture` (R1: rows stay in
   the repository; R4: transactions at the use case with a `Db | Tx`
   executor). Applied migrations and `migrations/meta/_journal.json` are in
   "Do not touch" (root `CLAUDE.md`): add a new migration, never edit an
   old one.

## Files

- `SKILL.md` — quick reference, instructions, three examples, constraints.
- `references/` — schema definition, queries and joins, relations,
  transactions, migrations, patterns, best practices, examples.

## Changes in this repo

The skill came with the course starter repo.

- 2026-09-26 — `metadata.applies_to` added for `pr-self-review` routing. No
  rule changes.

## Maintaining

The skill has no `metadata.version`, so `pr-self-review` keys its checks by
a hash of `SKILL.md`: any edit to `SKILL.md` re-checks every file the skill
covers. Edits to this README or to the reference files do not. When you edit
`SKILL.md`, add a line to "Changes in this repo".
