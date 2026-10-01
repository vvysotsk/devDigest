# e2e — flows-contract

Last verified: 2026-10-01 (HW02 2d: flow 09 + the seeded conventions scan)

## Scope

What every browser flow may assume (seed data, routes, ports, run modes) and
what each of the nine flows asserts. The flows themselves are the
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
- Experiment PRs #483 / #484 (L02) and #485 / #486 (HW02) with patched
  `pr_files`, no review (`../server/src/db/seed.ts:188-189`, written by
  `upsertExperimentPr` `:295-338`); the PR list therefore has five PRs.
- Four enabled agents: General, Security, Performance and Test Quality
  Reviewer (`../server/src/db/seed.ts:191-245`). The API Contract Reviewer is
  not seeded; the user creates it in the UI (`../specs/HW02-conventions-and-api-contract.md` D9).
- Ten enabled skills (`../server/src/db/seed-skills.ts`, written by
  `../server/src/db/seed.ts:247-262`) and their links
  (`../server/src/db/seed.ts:264-280`): Security Reviewer 6 linked / 3
  enabled, Test Quality Reviewer 4 / 4, Performance 2 / 2.
- One finished conventions scan on the repo with four **pending** candidates
  (`../server/src/db/seed-conventions.ts:32-41` written by
  `../server/src/db/seed.ts:287-313`, only while the repo has no scan — so a
  user's accept / reject / edit survives a re-seed): rules "Always use
  async/await instead of .then() chains" (`src/api/users.ts:23`, 91 %), "All
  public route handlers return typed Result<T, ApiError>", "Redis access goes
  through the src/lib/redis.ts singleton", "Tests use fake timers for date
  logic"; `sample_count` 14, `head_sha` = PR #482's. The repo has no clone, so
  the GitHub evidence link built from that sha is a dead URL by design.
- No LLM or GitHub key is required: the API boots with every secret optional
  and serves persisted data when GitHub is unreachable
  (`../server/src/modules/pulls/service.ts:59-67`).

### Per-flow assertions

| Flow | Route(s) | Asserts | Depends on |
|---|---|---|---|
| `01-app-boot` | `/` → `/repos/:id/pulls` | URL contains `/pulls`; text `Pull Requests` | ≥ 1 repo; heading `list.title` (`../client/messages/en/prReview.json:71`) |
| `02-repo-pulls-detail` | `/` → click PR row → `/pulls/482` | PR title visible in the list and on the detail page | seeded repo is first; `PRRow` click navigates (`../client/src/app/repos/[repoId]/pulls/_components/PRRow/PRRow.tsx:26`) |
| `03-agents` | `/agents` | text `Security Reviewer` | seeded agents (`../server/src/db/seed.ts:207`) |
| `04-pr-findings` | `/pulls/482?tab=findings` via the "Agent runs" tab button | texts `request changes`, `2 findings`, `Hardcoded Stripe secret key in commit` | first accordion gets `defaultOpen` (`../client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsTab/FindingsTab.tsx:163`); header text built from `findings.length` (`../client/src/app/repos/[repoId]/pulls/[number]/_components/ReviewRunAccordion/ReviewRunAccordion.tsx:96-99`) |
| `05-pr-diff` | `/pulls/482?tab=diff` via the "Files changed" tab button | text *src/config.ts* | seeded `pr_files` (`../server/src/db/seed.ts:129-134`) |
| `06-onboarding` | `/onboarding` | texts `Add a repository`, `Repository URL` | `AddRepoView` copy (`../client/src/app/onboarding/_components/AddRepoView/AddRepoView.tsx:77`, `:94`) |
| `07-settings` | `/settings/api-keys`, `/settings/models` | texts `API Keys`, `Feature Models` | `SETTINGS_SECTIONS` labels (`../client/src/vendor/ui/nav.ts:39-41`) |
| `09-conventions` | `/skills` → sidebar `Conventions` → `/conventions`; Accept / Reject / Edit on cards; `reload`; Create skill → `/skills/:id?tab=preview`; `/agents` | heading `Conventions in` + `payments-api`, `Detected from 14 sample files`, `0 of 4 accepted`, the three seeded rules, `src/api/users.ts:23`, `91%`, `ReScan`; after Accept `1 of 4 accepted` + `Create skill`; after Reject `1 of 3 accepted` and the rejected rule absent (`R2_ABSENT`); Edit → `Category` field, the rule set to "… (edited)" → `(edited)`; after `reload` the same three facts hold; modal `Create skill from conventions`, `Merged from 1 accepted convention in acme/payments-api`, `repo-conventions.md`, agent picker → `General Reviewer`; then URL `/skills/` + `tab=preview`, texts `repo-conventions`, `Extracted`; `/agents` → `General Reviewer`, `1 skill` | the seeded scan (above); `conventions.json` keys `page.detected`, `toolbar.accepted`, `toolbar.createSkill`, `card.*`, `modal.title`, `modal.mergedFrom`, `modal.agentPlaceholder` (`../client/messages/en/conventions.json`); `skills.json` `listItem.source.extracted` (`:85`); `agents.json` `card.skillCount` (`:4`); the card's `role="listitem"` + `aria-label` = rule and the kit `Modal`'s `role="dialog"` (the scoped `eval` clicks) |
| `08-skills` | `/skills` → click `secret-leakage-gate` → `?tab=preview` → Config tab button → `?tab=config`; `/agents` → click `Security Reviewer` → Skills tab | skill cards `branch-coverage-check` / `secret-leakage-gate`, body header `secret-leakage-gate.md`; a 40-line body draft (one 300-char line, caret at the end, never saved) → `BODY_EDITOR_OK`: textarea not scrolled, `scrollHeight ≤ clientHeight`, `scrollWidth ≤ clientWidth`, the frame scrolls on x; agent card `Test Quality Reviewer`, chip `4 skills`; `3 of 6 enabled`, `lethal-trifecta` | L02 seed skills + links; body textarea `aria-label` "Skill body" (`../client/messages/en/skills.json:140`); skill tab button "Config" (`skills.json:120`); Skills tab button "Skills" (`../client/messages/en/agents.json:48`), pill `skills.enabledCount` (`:93`) |

The `steps` arrays: `specs/01-app-boot.flow.json:5-8`,
`specs/02-repo-pulls-detail.flow.json:5-11`, `specs/03-agents.flow.json:5-8`,
`specs/04-pr-findings.flow.json:5-16`, `specs/05-pr-diff.flow.json:5-14`,
`specs/06-onboarding.flow.json:5-8`, `specs/07-settings.flow.json:5-11`,
`specs/08-skills.flow.json:5-29`, `specs/09-conventions.flow.json:5-57`.

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
  (`specs/08-skills.flow.json:15`).
- **An `assert.stdoutIncludes` miss prints no stdout.** The runner reports
  only `stdout missing "…"` (`run.ts:99-100`), so an `eval` diagnostic string
  is visible only when the script is re-run by hand.
- **A failure shows the page after the fact.** The screenshot, snapshot and
  URL are captured after the failing step, so a list that loaded a moment
  later is already visible there; compare with the step's elapsed time
  (`run.ts:59-73`).
- **A writing flow needs a fresh seed and says so.** Flows 01–08 are
  read-only; `09-conventions` accepts, rejects and edits seeded candidates and
  creates a skill. Its `description` states that, and it passes only on a
  fresh seed — the hermetic stack and CI; against a used dev DB a second run
  fails at the Reject step by design (`specs/09-conventions.flow.json:3`).
- **Writing flows run last.** Flows run in lexical filename order
  (`run.ts:75-83`), so a writing flow takes a number after every read-only
  flow, and never precedes a flow that counts skills or agent links: 08
  asserts `4 skills` and `3 of 6 enabled`, while 09 links `repo-conventions`
  to General Reviewer and changes skill counts.
- **A flow asserts only on data it created itself or that the seed
  guarantees** — never on another flow's side effects. 09 asserts
  `General Reviewer` → `1 skill` because 09 itself created that link.
- **Buttons that share a name are clicked by a scoped `eval`.** Every card
  has Accept / Reject / Edit and the page has two "Create skill" buttons once
  the modal is open, so `find role button --name` is ambiguous there; the
  flow clicks through `document.querySelector('[role=listitem][aria-label="<rule>"]')`
  or `[role=dialog]` and returns a marker checked with `stdoutIncludes`
  (`specs/09-conventions.flow.json:20`, `:48`). The same goes for the kit
  `SearchableSelect` trigger: a plain `div` with an `onClick` and no role,
  which `find text … click` does not click even though `wait --text` sees its
  text (`:45`); its option rows are `<button>`s, so they take the normal
  `find role button click --name <label>` (`:47`).

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
| Skills page cards, side-pane preview, Config tab body header, unsaved 40-line draft sizing; agents list chips; Security's Skills tab `3 of 6 enabled` | `specs/08-skills.flow.json` |
| Conventions page from the sidebar; seeded cards (rule, path:line, confidence); Accept / Reject / Edit persist across a `reload`, the rejected rule never returns; Create skill → `/skills` lists `repo-conventions` (Extracted) linked to General Reviewer | `specs/09-conventions.flow.json` |
| Runner and helper types compile | `npm run typecheck` (`tsconfig.json`) |
