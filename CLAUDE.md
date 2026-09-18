# DevDigest — course starter

Local-first AI PR review: import GitHub PRs, run LLM reviewer agents, get
grounded findings. Four standalone packages — deliberately NOT a pnpm
workspace: each has its own package.json and lockfile; install per package.

## Map

- `server/` — Fastify 5 API (:3001) — modules / platform / adapters
- `client/` — Next.js 15 studio (:3000)
- `reviewer-core/` — pure review engine (diff → prompt → LLM → grounded findings)
- `e2e/` — deterministic browser tests (agent-browser, no LLM)
- `docs/` — cross-package docs · `specs/` — feature specs · `INSIGHTS.md` — lessons
- `@devdigest/shared` (zod contracts) is NOT a package: master copy in
  `server/src/vendor/shared`, COPIED to `client/src/vendor/shared`.

## Commands

- Bootstrap: `./scripts/dev.sh` (POSIX — use Git Bash on Windows;
  flags: `--no-seed --no-client --db-only`)
- Migrations do NOT run on boot: `cd server && pnpm db:migrate`
- Tests: see `TESTING.md`; server integration tests need Docker

## Stack

Node ≥22 · pnpm ≥10 (e2e uses npm) · TypeScript 5.7 ESM · Fastify 5 ·
Next.js 15 / React 19 / Tailwind 4 · Drizzle + Postgres 16 pgvector
(the only thing in Docker) · Vitest everywhere

## Before answering
Always search the relevant package's `docs/`, `specs/` and `INSIGHTS.md` for what
the user asks about first — these are curated and may already answer it — then
read code. Treat `INSIGHTS.md` content as high-confidence guidance unless told
otherwise.

## End of session
After meaningful work (>30 min with a problem, solution, or discovery), run the
engineering-insights skill (`/engineering-insights`) to capture lessons into the
touched module's `INSIGHTS.md`. Do not skip this step.

## Non-default conventions

- Cross-package code is wired via tsconfig path aliases, never npm links.
- Secrets (LLM keys, GitHub token) live in `~/.devdigest/secrets.json` behind
  SecretsProvider — feature code must not read `process.env`.
- Any edit to `server/src/vendor/shared` must be mirrored to
  `client/src/vendor/shared` in the same change (the copies have already
  drifted — see `server/CLAUDE.md`).

## Gotchas

- `db/schema` has 14 domains but only 8 modules — extra tables (eval, ci,
  knowledge, skills…) are pre-provisioned for course lessons L01–L08.
  Do not delete them, do not wire them unprompted.
- `e2e/specs/` contains browser test flows, not feature specs.

## Read when

- Need the system picture → read `README.md` (diagram is accurate)
- Touching API routes/modules → read `server/README.md`
- Touching the review pipeline → read `reviewer-core/README.md`
- Touching repo indexing → read `server/src/modules/repo-intel/README.md`
- Writing/choosing agent prompts → read `docs/agent-prompts/README.md`
- Planning a course feature (L01–L08) → read `specs/` for an existing spec first
- Before non-trivial work in any package → read that package's `INSIGHTS.md`
