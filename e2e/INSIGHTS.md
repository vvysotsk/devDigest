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

- 2026-09-29: `scripts/e2e.sh` does NOT leave a running dev client intact,
  despite its header. Its `next dev -p 3100` writes the same `client/.next`
  as the dev `next dev` on :3000 and inlines `NEXT_PUBLIC_API_BASE=:3101`.
  After the hermetic run, the dev page at :3000 requested
  `http://localhost:3101/skills` (the stack that was torn down) and showed
  "Could not load skills". Restart the dev client after a hermetic run, or
  stop it before one (evidence: `../scripts/e2e.sh:5`, `:42`, `:148`;
  `performance.getEntriesByType('resource')` on :3000 listed only :3101 URLs).

## Codebase Patterns

## Tool & Library Notes

- 2026-09-24: `npm run e2e:hermetic` only WARNS when `agent-browser` is not
  installed, then boots Postgres, the API and the web app anyway; every flow
  step then fails with a spawn error from `execFile`. Run
  `npm i -g agent-browser && agent-browser install` first (evidence:
  `../scripts/e2e.sh:51-52`, `run.ts:44-51`).

- 2026-09-27: agent-browser 0.38.1 `find <locator> <value> click` does not
  wait for its target — it fails at once when the element is not in the DOM
  yet; only `wait --text` / `wait --url` wait. `find text` can also match
  text that is not visible (a string inside a `<script>`) and print "✓ Done"
  without clicking the real element. Put a `wait --text` for the target's own
  visible text right before every `find` (evidence:
  `specs/05-pr-diff.flow.json:7-8`, `specs/flows-contract.md` "Flow authoring
  rules"). `wait --load networkidle` after an in-app (push) navigation DOES
  wait for a quiet network — ~0.9–1.0 s in flows 04/05 — contrary to the
  assumption that the already-reached load state makes it return at once; it
  still proves nothing about what rendered (run logs of 2026-09-27: the tab
  `wait --text` after it took 20–33 ms).

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

- 2026-09-29: An `eval` step whose JS contains `'\n'` written as a JSON
  escape fails with `Evaluation error: SyntaxError: Invalid or unexpected
  token`. JSON turns `\n` into a real line break inside the JS string
  literal. The runner shows only the command line, and a missed
  `assert.stdoutIncludes` shows no stdout at all. Write the newline as
  `String.fromCharCode(10)`. To debug a failing `eval`, re-run its exact argv
  by hand (evidence: `specs/08-skills.flow.json:12`, `run.ts:99-100`,
  `run.ts:108`).

## Session Notes

- 2026-09-24: Seeded `docs/architecture.md` + `specs/flows-contract.md` from
  `run.ts`, `lib/assert.ts`, the seven flow files, `../scripts/e2e.sh` and
  `../.github/workflows/e2e-web.yml`; every `path:line` verified by a
  line-check script.

## Open Questions

- 2026-09-27: Flow `specs/05-pr-diff.flow.json:7` ("open the PR row",
  `find text … click`) failed once in two hermetic runs (Windows, Git Bash
  recipe from `CLAUDE.md`); the same click in flow 02 passed in that run.
  Cause not established. Unverified hypothesis: flow 05 clicks right after
  `wait --url /pulls`, with no `wait --text` for the row as flow 02 has
  (`specs/02-repo-pulls-detail.flow.json:7`), and the API log shows the PR
  list re-syncing (GitHub 404 → persisted PRs) at that moment. If it fails
  again, investigate before adding a retry.
  - 2026-09-27 RESOLUTION: the hypothesis holds. `agent-browser find text …
    click` does not auto-wait (fails in ~0.1 s, "No element found by text"),
    and `wait --url /pulls` passes right after the client redirect
    (`../client/src/app/page.tsx:15-19`) while `GET /repos/:id/pulls` is still
    syncing from GitHub (`../server/src/modules/pulls/service.ts:59-67`).
    Reproduced outside the repo with agent-browser 0.38.1, the real `run.ts`
    and flows 02/05 against a fake SPA: list delay 0 ms → 3/3 pass; 300 and
    1500 ms → flow 05 fails 3/3 at "open the PR row" while 02 passes; with
    `wait --text` added to 05 → 3/3 pass at 300/1500/5000 ms. The saved
    `test-results/05-pr-diff-fail.png` showed the row because it is taken
    after the failure. Fixed by waiting for the row in 04 and 05
    (`specs/04-pr-findings.flow.json:7`, `specs/05-pr-diff.flow.json:7`) and
    for the tab button before each tab click (`:11`); rule in
    `specs/flows-contract.md` "Flow authoring rules".
