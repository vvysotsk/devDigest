# e2e — architecture

Last verified: 2026-09-24 against c03665a

## Purpose

`@devdigest/e2e` drives the real studio (client + API + seeded Postgres) in a
real Chrome through the Vercel `agent-browser` CLI and checks that the seeded
screens render. It is deterministic and LLM-free: flows only open pages, click
seeded rows and wait for seeded text or URLs. It owns no test framework — a
small runner turns JSON flows into `agent-browser` invocations — and no
fixtures: every expectation comes from the server seed
(`../server/src/db/seed.ts`).

## Layout

| Path | Role |
|---|---|
| `run.ts` | The runner: loads `specs/*.flow.json` in lexical order, executes each step with `execFile(agent-browser, args)` and logs its elapsed time, stops a flow at its first failure, records URL / page errors / accessibility snapshot / screenshot on failure, closes the browser, exits 1 if any flow failed. |
| `lib/assert.ts` | `Flow` / `Step` types, `{BASE}` substitution (`resolveArgs`), the `stdoutIncludes` check, the PASS/FAIL summary. |
| `specs/NN-<slug>.flow.json` | One browser flow each (01–07); `specs/flows-contract.md` is the curated contract for them. |
| `agent-browser.json` | CLI config: headless, HTTPS errors not ignored. |
| `package.json` | `npm test` → `tsx run.ts`; `npm run e2e:hermetic` → `../scripts/e2e.sh`; `npm run typecheck`. npm + `package-lock.json`, not pnpm. |
| `tsconfig.json` | ES2022 / Bundler resolution over `run.ts` and `lib/**`. |
| `test-results/` | Failure artifacts `<flow-id>-fail.png` and `<flow-id>-fail.snapshot.txt` (git-ignored, uploaded by CI). |
| `../scripts/e2e.sh` | Hermetic stack: ephemeral pgvector container on :5433, API on :3101, web on :3100, migrate + seed, run, tear down. |
| `../.github/workflows/e2e-web.yml` | CI: compose Postgres, migrate + seed, API via `tsx`, `next build` + `start`, `agent-browser install --with-deps`, `npm test`. |

## Data flow — one flow

1. `run.ts` reads `E2E_BASE_URL` (default `http://localhost:3000`),
   `AGENT_BROWSER_BIN` (default `agent-browser`) and `E2E_STEP_TIMEOUT`
   (default 60 000 ms) (`run.ts:39-41`).
2. `loadFlows()` lists `specs/*.flow.json`, sorted, and parses each as `Flow`
   (`run.ts:75-83`).
3. For every step, `resolveArgs` replaces `{BASE}` (trailing slash trimmed) in
   the argv and the command runs with `cwd = e2e/`, the step timeout and a
   32 MB stdout buffer (`lib/assert.ts:37-40`, `run.ts:44-51`).
4. Every step line carries its elapsed time (`✓ label (123 ms)`). A non-zero
   exit — including a `wait --text` / `wait --url` whose condition never
   holds — rejects, the step is recorded as failed with the first line of the
   error, and the flow stops; an optional `assert.stdoutIncludes` miss fails
   the same way (`run.ts:90-114`). On a failure `captureFailure` prints the
   current URL and the page errors, saves the accessibility tree to
   `test-results/<id>-fail.snapshot.txt` and a screenshot to
   `test-results/<id>-fail.png`, each best-effort (`run.ts:59-73`). All of
   them show the page AFTER the failure: a list that loaded a moment later is
   already visible there, so read them together with the step's error and
   elapsed time.
5. All flows share one browser session (the agent-browser daemon keeps the
   page between commands); `agent-browser close` runs in `finally`
   (`run.ts:129-136`).
6. `summarize` prints PASS/FAIL per flow with failed step details and
   `n/m flows passed`; the process exits 0 only when every flow passed
   (`lib/assert.ts:46-58`, `run.ts:138-139`).

## Hermetic stack (`../scripts/e2e.sh`)

- Ports and names are env-overridable: `E2E_PG_PORT` 5433, `E2E_API_PORT`
  3101, `E2E_WEB_PORT` 3100, `E2E_PG_CONTAINER` `devdigest-e2e-postgres`,
  `E2E_PG_IMAGE` `pgvector/pgvector:pg16` (`e2e.sh:26-33`).
- `DATABASE_URL`, `API_PORT`, `WEB_PORT`, `NEXT_PUBLIC_API_BASE` and
  `E2E_BASE_URL` are exported before any process starts, so the server's
  dotenv file cannot override them (dotenv does not overwrite set variables); the API's
  CORS origin derives from `WEB_PORT` (`e2e.sh:35-43`).
- The Postgres container is `--rm` with no volume, so the seeded demo repo is
  the only repo every run; a guard refuses to migrate or seed unless
  `DATABASE_URL` is on the isolated port (`e2e.sh:84-94`, `:119-128`).
- API = `pnpm exec tsx src/server.ts` (no build), web = `next dev -p
  $WEB_PORT`; both are health-polled for 60 s; `reviewer-core` deps are
  installed with `npm ci` because the API imports its raw source
  (`e2e.sh:113-117`, `:130-158`).
- The EXIT trap kills the whole process trees, reaps whatever still listens
  on the two alternate ports, and removes the container; the script exits
  with the runner's code (`e2e.sh:54-82`, `:160-166`).

## Boundaries & dependencies

- **Deterministic locators only**: `open`, `wait --url|--text|--load`,
  `find text|role … click`, `screenshot`, `close`. The AI `chat` command is
  never used, so no key is needed (`README.md`).
- **`find` does not wait.** Every `find … click` is preceded by a `wait --text`
  for its own target; `wait --url` and `wait --load networkidle` do not prove
  that the data behind a page has rendered. The rule and its evidence are in
  `specs/flows-contract.md` → "Flow authoring rules".
- **Read-only**: flows never submit forms or start a review; the only
  mutations are the server's own GitHub-less imports, which no-op without a
  token.
- **Seed is the fixture.** Texts asserted by flows (`Pull Requests`,
  `Add rate limiting to public API endpoints`, `Security Reviewer`,
  `request changes`, `2 findings`, `Hardcoded Stripe secret key in commit`,
  the seeded file path *src/config.ts*, `Add a repository`, `Repository URL`, `API Keys`,
  `Feature Models`) come from `../server/src/db/seed.ts` and the client's
  i18n / kit labels; a copy change there breaks a flow here.
- **First-repo assumption.** Flows 02, 04 and 05 follow the home redirect to
  the first repo, so the DB must contain only the seeded repo — true in CI and
  in the hermetic stack, usually false against a dev DB.
- **No package imports.** `run.ts` depends only on Node built-ins and
  `lib/assert.ts`; it never imports server or client code.

## Extension points

- **New flow:** `specs/NN-<slug>.flow.json` with `name`, `description`,
  `steps[]` of `{ cmd, label?, assert? }`; assert with `wait --text` /
  `wait --url` on seeded data, and follow "Flow authoring rules" in
  `specs/flows-contract.md` (wait for a target before every `find`); add the
  row to `README.md` "Coverage" and the preconditions to
  `specs/flows-contract.md`.
- **New seeded expectation:** change `../server/src/db/seed.ts` and update
  the affected flow and the contract in the same commit.
- **New port / env knob:** add it to `../scripts/e2e.sh` config block and to
  `README.md` "Env knobs"; CI keeps the default ports in its `env` block
  (`DATABASE_URL`, `NEXT_PUBLIC_API_BASE`, `E2E_BASE_URL`,
  `../.github/workflows/e2e-web.yml:33-36`).

## Open questions

- Flow 04 waits for `request changes` and `2 findings` — the seeded review is
  a `reviews` row with no `agent_runs` row, so the Timeline section is absent
  and the accordion is the only surface asserted. Unverified whether a future
  seed with a run row changes the `2 findings` text.
- `agent-browser.json` sets `headed: false`; there is no documented way to run
  the suite headed for debugging other than editing that file.
