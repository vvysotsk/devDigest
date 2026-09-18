# e2e/ — browser end-to-end suite (@devdigest/e2e)

## Commands

- `npm install` (yes, npm — this package has package-lock.json, not pnpm)
- `npm run e2e:hermetic` ← recommended: isolated stack on alt ports
  (Postgres :5433, API :3101, web :3100), auto-teardown

## Before answering

Always search this package's `docs/`, `INSIGHTS.md` and the root `/specs` for
what the user asks about first — these are curated and may already answer it —
then read code. (`specs/` here is browser test flows, not curated docs.)

## Non-default conventions

- Flows are deterministic and LLM-free — they drive the studio over CDP
  (Vercel agent-browser). Never add a real LLM call to a flow.
- `specs/` here = browser test flows, NOT feature specs (those live in
  `/specs` at the repo root).
- Hermetic mode never touches the dev DB or the `devdigest_pgdata` volume —
  keep it that way when adding flows.

## Read when

- Flow anatomy, run modes, coverage → read `README.md`
- CI gating for this suite → read `../TESTING.md`
- Past lessons here → read `INSIGHTS.md`
