# Insights — e2e

Append-only lessons about `e2e/` that the code cannot tell you.
A lesson that spans packages gets an entry here AND in each other package
it touches; the root `INSIGHTS.md` is for repo tooling only.

Entry format, quality gate, and capture rules live in the
`engineering-insights` skill (`.claude/skills/engineering-insights/SKILL.md`).
Entries: `- YYYY-MM-DD: <actionable statement> (evidence: path:line[, command/error])` — date and path:line are required.
Never rewrite existing entries — correct with a dated note.

## What Works

## What Doesn't Work

## Codebase Patterns

## Tool & Library Notes

- 2026-09-24: `npm run e2e:hermetic` only WARNS when `agent-browser` is not
  installed, then boots Postgres, the API and the web app anyway; every flow
  step then fails with a spawn error from `execFile`. Run
  `npm i -g agent-browser && agent-browser install` first (evidence:
  `../scripts/e2e.sh:51-52`, `run.ts:44-51`).

## Recurring Errors & Fixes

- 2026-09-27: On Windows the hermetic suite fails in three stacked ways,
  none caused by app code: (1) `npm run e2e:hermetic` runs `../scripts/e2e.sh`
  through `cmd.exe` ("'..' is not recognized") — run `bash scripts/e2e.sh`
  from the repo root in Git Bash; (2) every flow fails with
  `spawn agent-browser ENOENT` because `execFile` cannot start the npm `.cmd`
  shim — set `AGENT_BROWSER_BIN` to the native
  `%APPDATA%\npm\node_modules\agent-browser\bin\agent-browser-win32-x64.exe`;
  (3) data flows still fail (2/7 pass) because the isolated DB is never
  migrated or seeded: the `pnpm db:migrate` / `pnpm db:seed` CLI guards
  (`import.meta.url === \`file://${process.argv[1]}\``) never match on Windows,
  so the API answers 500 `relation "users" does not exist`. Also `npm ci`
  first if `e2e/node_modules` is empty (`tsx` not found) (evidence:
  `package.json:9`, `run.ts:40`, `../scripts/e2e.sh:126-128`,
  `../server/src/db/migrate.ts:37`, `../server/src/db/seed.ts:227`).
  - 2026-09-27 correction: (3) fixed in 653defa (server CLI guard); with (1)
    and (2) applied, `bash scripts/e2e.sh` passes 7/7 flows. (1) and (2)
    remain — the runner's Windows compatibility is an open question in
    `../specs/refactor-onion.md`; the run recipe is in `CLAUDE.md` → Commands.

## Session Notes

- 2026-09-24: Seeded `docs/architecture.md` + `specs/flows-contract.md` from
  `run.ts`, `lib/assert.ts`, the seven flow files, `../scripts/e2e.sh` and
  `../.github/workflows/e2e-web.yml`; every `path:line` verified by a
  line-check script.

## Open Questions
