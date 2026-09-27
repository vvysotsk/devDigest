# postgresql-table-design — README

The agent loads `SKILL.md` only; this file is for people maintaining the skill.

## What it does

A general PostgreSQL schema design guide: primary keys, data types and the
types to avoid, constraints, indexing, partitioning, JSONB, generated
columns, extensions and safe schema evolution.

## How it works

1. **When it loads.** The agent picks the skill by its `description` when it
   designs or reviews a table, a column type, an index or a constraint.
2. **What it reads.** Everything is in `SKILL.md`. There are no reference
   files.
3. **In self-review.** `pr-self-review` sends a changed file to this
   skill when the file matches `metadata.applies_to`: the Drizzle schema files
   (`server/src/db/schema/**`) and the migration SQL
   (`server/src/db/migrations/*.sql`). The
   skill is not blocking, so its findings are WARNING or SUGGESTION.
   Only a concrete runtime defect is CRITICAL.
4. **Project rules win.** The schema is written in Drizzle
   (`drizzle-orm-patterns`), and SQL migrations are generated from it. An
   applied migration is never edited: a schema change is a new migration
   ("Do not touch", root `CLAUDE.md`). A deliberate exception to the skill
   is recorded in `server/docs/architecture.md` → "Architecture decisions"
   (for example, why `agent_runs.cost_usd` stays double precision).

## Files

- `SKILL.md` — the whole guide.

## Changes in this repo

The skill came with the course starter repo.

- 2026-09-26 — `metadata.applies_to` added for `pr-self-review` routing. No
  rule changes.

## Maintaining

The skill has no `metadata.version`, so `pr-self-review` keys its checks by
a hash of `SKILL.md`: any edit to `SKILL.md` re-checks every file the skill
covers. Edits to this README or to the reference files do not. When you edit
`SKILL.md`, add a line to "Changes in this repo".
