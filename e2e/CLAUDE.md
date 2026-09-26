# e2e/ — browser end-to-end suite (@devdigest/e2e)

## Commands

- `npm install` (yes, npm — this package has package-lock.json, not pnpm)
- `npm run e2e:hermetic` ← recommended: isolated stack on alt ports
  (Postgres :5433, API :3101, web :3100), auto-teardown
- **Windows** (also when `pr-self-review` lists `[run] e2e: npm run e2e:hermetic`):
  `npm run` goes through `cmd.exe` and cannot start the bash script, and the
  runner cannot spawn the npm `.cmd` shim of agent-browser. Run the same
  script from the repo root in Git Bash with the native binary, and record
  the result under the command string `npm run e2e:hermetic`:
  `AGENT_BROWSER_BIN="$APPDATA/npm/node_modules/agent-browser/bin/agent-browser-win32-x64.exe" bash scripts/e2e.sh`
  (`npm ci` first if `node_modules/` is empty). See `INSIGHTS.md`.

## Before answering

Always search this package's `docs/`, `specs/*.md`, `INSIGHTS.md` and the root `/specs` for
what the user asks about first — these are curated and may already answer it —
then read code. (`specs/*.flow.json` are tests; `specs/*.md` are curated.)

## Do not touch

- `package-lock.json` — never edit by hand or regenerate unprompted; it
  changes only with an intentional `package.json` change, committed together.

## Non-default conventions

- Flows are deterministic and LLM-free — they drive the studio over CDP
  (Vercel agent-browser). Never add a real LLM call to a flow.
- `specs/*.flow.json` = browser test flows; `specs/*.md` = e2e contracts
  (seed data and preconditions the flows rely on). Course feature specs live
  in `/specs` at the repo root.
- Hermetic mode never touches the dev DB or the `devdigest_pgdata` volume —
  keep it that way when adding flows.

## Read when

- Runner, agent-browser, hermetic stack and ports → read `docs/architecture.md`
- Seed data and preconditions the flows rely on → read `specs/flows-contract.md`
- Flow anatomy, run modes, coverage → read `README.md`
- CI gating for this suite → read `../TESTING.md`
- Past lessons here → read `INSIGHTS.md`
