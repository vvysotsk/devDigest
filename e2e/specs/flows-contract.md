# e2e — flows-contract

Last verified: 2026-09-29 (flow 08 body-editor `eval` steps; every `path:line` re-checked)

## Scope

What every browser flow may assume (seed data, routes, ports, run modes) and
what each of the eight flows asserts. The flows themselves are the
`specs/*.flow.json` files; the client surfaces they touch are specified in
`../client/specs/pages.md`, the seed in `../server/src/db/seed.ts`.

Paths are relative to `e2e/`.

## Contract

### Flow file shape

- A flow is `{ name, description?, steps[] }`; a step is `{ cmd: string[],
  label?, assert?: { stdoutIncludes? } }`; `cmd` is passed verbatim to
  `agent-browser` after `{BASE}` substitution (`lib/assert.ts:8-22`, `:36-40`).
- `loadFlows` sorts the flow files, so flows run in lexical filename order,
  each stopping at its first failed step; a failed step writes
  `test-results/<flow-id>-fail.png` plus `<flow-id>-fail.snapshot.txt`, and
  prints the URL and page errors after the failure (`run.ts:75-83`,
  `:90-114`, `:59-73`).
- `process.exit` code is 0 only when every flow passed (`run.ts:138-139`).

### Environment

- `E2E_BASE_URL` (default `http://localhost:3000`), `AGENT_BROWSER_BIN`
  (default `agent-browser`), `E2E_STEP_TIMEOUT` ms (default 60 000)
  (`run.ts:39-41`).
- Hermetic mode (`npm run e2e:hermetic` → `../scripts/e2e.sh`) uses
  Postgres :5433, API :3101, web :3100 and exports `E2E_BASE_URL` itself
  (`../scripts/e2e.sh:26-33`, `:43`); CI uses :5432 / :3001 / :3000
  (`../.github/workflows/e2e-web.yml:33-36`).
- `agent-browser` runs headless and does not ignore HTTPS errors
  (`agent-browser.json:3-4`).

### Seed preconditions (every flow)

- Exactly one repo, `acme/payments-api`, so `/` redirects to its PR list
  (`../server/src/db/seed.ts:82-100`; client redirect
  `../client/src/app/page.tsx:15-19`).
- PR #482 "Add rate limiting to public API endpoints" with four `pr_files`
  including *src/config.ts*, one commit, and one sample review (`kind =
  'review'`, verdict `request_changes`, score 61, two findings — the first
  titled "Hardcoded Stripe secret key in commit") that has no `agent_runs`
  row (`../server/src/db/seed.ts:103-185`).
- L02 experiment PRs #483 and #484 with patched `pr_files`, no review
  (`../server/src/db/seed.ts:187-214`); the PR list therefore has three PRs.
- Five enabled agents: General, Security, Performance, Test Quality and API
  Contract Reviewer (`../server/src/db/seed.ts:216-281`).
- Twelve enabled skills (`../server/src/db/seed-skills.ts`, written by
  `../server/src/db/seed.ts:283-298`) and their links
  (`../server/src/db/seed.ts:300-316`): Security Reviewer 6 linked / 3
  enabled, Test Quality Reviewer 4 / 4, Performance 2 / 2, API Contract 2 / 2.
- No LLM or GitHub key is required: the API boots with every secret optional
  and serves persisted data when GitHub is unreachable
  (`../server/src/modules/pulls/service.ts:59-67`).

### Per-flow assertions

| Flow | Route(s) | Asserts | Depends on |
|---|---|---|---|
| `01-app-boot` | `/` → `/repos/:id/pulls` | URL contains `/pulls`; text `Pull Requests` | ≥ 1 repo; heading `list.title` (`../client/messages/en/prReview.json:71`) |
| `02-repo-pulls-detail` | `/` → click PR row → `/pulls/482` | PR title visible in the list and on the detail page | seeded repo is first; `PRRow` click navigates (`../client/src/app/repos/[repoId]/pulls/_components/PRRow/PRRow.tsx:26`) |
| `03-agents` | `/agents` | text `Security Reviewer` | seeded agents (`../server/src/db/seed.ts:232`) |
| `04-pr-findings` | `/pulls/482?tab=findings` via the "Agent runs" tab button | texts `request changes`, `2 findings`, `Hardcoded Stripe secret key in commit` | first accordion gets `defaultOpen` (`../client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsTab/FindingsTab.tsx:163`); header text built from `findings.length` (`../client/src/app/repos/[repoId]/pulls/[number]/_components/ReviewRunAccordion/ReviewRunAccordion.tsx:96-99`) |
| `05-pr-diff` | `/pulls/482?tab=diff` via the "Files changed" tab button | text *src/config.ts* | seeded `pr_files` (`../server/src/db/seed.ts:129-134`) |
| `06-onboarding` | `/onboarding` | texts `Add a repository`, `Repository URL` | `AddRepoView` copy (`../client/src/app/onboarding/_components/AddRepoView/AddRepoView.tsx:77`, `:94`) |
| `07-settings` | `/settings/api-keys`, `/settings/models` | texts `API Keys`, `Feature Models` | `SETTINGS_SECTIONS` labels (`../client/src/vendor/ui/nav.ts:39-41`) |
| `08-skills` | `/skills` → click `secret-leakage-gate` → `?tab=config`; `/agents` → click `Security Reviewer` → Skills tab | skill cards `branch-coverage-check` / `secret-leakage-gate`, body header `secret-leakage-gate.md`; a 40-line body draft (one 300-char line, caret at the end, never saved) → `BODY_EDITOR_OK`: textarea not scrolled, `scrollHeight ≤ clientHeight`, `scrollWidth ≤ clientWidth`, the frame scrolls on x; agent cards `Test Quality Reviewer`, `API Contract Reviewer`, chip `4 skills`; `3 of 6 enabled`, `lethal-trifecta` | L02 seed skills + links; body textarea `aria-label` "Skill body" (`../client/messages/en/skills.json:139`); Skills tab button "Skills" (`../client/messages/en/agents.json:48`), pill `skills.enabledCount` (`:93`) |

The `steps` arrays: `specs/01-app-boot.flow.json:5-8`,
`specs/02-repo-pulls-detail.flow.json:5-11`, `specs/03-agents.flow.json:5-8`,
`specs/04-pr-findings.flow.json:5-16`, `specs/05-pr-diff.flow.json:5-14`,
`specs/06-onboarding.flow.json:5-8`, `specs/07-settings.flow.json:5-11`,
`specs/08-skills.flow.json:5-27`.

### Flow authoring rules

Evidence: the flow-05 flake of 2026-09-27 (`INSIGHTS.md`), reproduced with
agent-browser 0.38.1 against a fake SPA whose PR list arrives after a delay.

- **`find` does not auto-wait.** `find text|role … click` fails in ~0.1 s
  ("No element found by text …") when its target is not in the DOM yet; only
  `wait --text` / `wait --url` wait. Every `find` step is therefore preceded
  by a `wait --text` for the target's own text or label, e.g.
  `specs/02-repo-pulls-detail.flow.json:7-8`,
  `specs/04-pr-findings.flow.json:7-8`, `:11-12`,
  `specs/05-pr-diff.flow.json:7-8`, `:11-12`.
- **`wait --url` is not a data-loaded signal.** `/` redirects on the client
  as soon as `/repos` answers (`../client/src/app/page.tsx:15-19`), so
  `wait --url /pulls` passes while the PR list is still loading; `GET
  /repos/:id/pulls` syncs from GitHub on every call and its latency varies
  (`../server/src/modules/pulls/service.ts:59-67`).
- **Nor is `wait --load networkidle`.** It waits for a quiet network (on this
  suite ~0.9–1.0 s after the PR-row click), not for a component: the PR detail
  page renders only a `Skeleton` until the list and detail queries resolve,
  and the tab buttons do not exist before that
  (`../client/src/app/repos/[repoId]/pulls/[number]/page.tsx:98-106`, `:125`).
  In the 2026-09-27 runs the tab was already there when networkidle returned
  (the extra `wait --text` took 20–33 ms), so that wait is a cheap guard for a
  slower render, not the fix for an observed failure.
- **`find text` can match text that is not visible** (e.g. a string inside a
  `<script>` tag) and report success without clicking the real element.
  Wait for, and click, text that only the intended element renders.
- **Set a React input with the native setter.** `eval` that assigns
  `el.value = …` changes the DOM but not React state; call
  `Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set`
  on the element, then dispatch a bubbling `input` event. Keep the script on
  one line with single quotes, and write a newline as
  `String.fromCharCode(10)`: a `
` escape in the flow JSON becomes a raw
  line break inside a JS string literal (SyntaxError)
  (`specs/08-skills.flow.json:12`).
- **An `assert.stdoutIncludes` miss prints no stdout.** The runner reports
  only `stdout missing "…"` (`run.ts:99-100`), so an `eval` diagnostic string
  is visible only when the script is re-run by hand.
- **A failure shows the page after the fact.** The screenshot, snapshot and
  URL are captured after the failing step, so a list that loaded a moment
  later is already visible there; compare with the step's elapsed time
  (`run.ts:59-73`).

## States & edge cases

- **Dev DB with extra repos** → flows 02/04/05 land on the wrong repo and
  fail; use the hermetic runner (`README.md`).
- **agent-browser missing** → the hermetic script only warns before starting
  the stack; the runner then fails every step with a spawn error
  (`../scripts/e2e.sh:51-52`, `run.ts:44-51`).
- **API or web not healthy within 60 s** → the hermetic script exits 1 before
  running any flow (`../scripts/e2e.sh:136-158`).
- **A failing step** leaves the browser open until the runner's `finally`
  closes it, so a later flow never inherits a half-navigated page
  (`run.ts:129-136`).

## Enforced by

| Rule | Test |
|---|---|
| Whole stack boots and `/` redirects to a PR list | `specs/01-app-boot.flow.json` |
| PR row → detail route with the PR title | `specs/02-repo-pulls-detail.flow.json` |
| Seeded agent card renders | `specs/03-agents.flow.json` |
| Seeded review accordion: verdict, count, first finding card | `specs/04-pr-findings.flow.json` |
| Diff viewer renders a seeded file | `specs/05-pr-diff.flow.json` |
| Onboarding form renders without submitting | `specs/06-onboarding.flow.json` |
| Settings sections render | `specs/07-settings.flow.json` |
| Runner and helper types compile | `npm run typecheck` (`tsconfig.json`) |
