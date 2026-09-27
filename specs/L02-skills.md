Status: draft

# L02 — Skills in the product

A **skill** is a reusable, text-only configuration (a markdown body plus a
name, a type and a one-line description) that any number of agents can use.
The user creates, edits and imports skills in the UI, attaches them to an
agent in a chosen order, and the review engine injects every enabled skill
into the agent's prompt as its own block. A skill never carries tools and
never executes code — it is text that becomes instructions.

The ground is pre-provisioned but not connected: the tables `skills`,
`skill_versions`, `agent_skills(order)` (`server/src/db/schema/skills.ts:5-34`,
`server/src/db/schema/agents.ts:51-63`), the contracts `Skill`, `SkillType`,
`SkillSource`, `AgentSkillLink` (`server/src/vendor/shared/contracts/knowledge.ts:115-131,194-215`),
the engine slot `## Skills / rules` (`reviewer-core/src/prompt.ts:88-89,109`),
the trace slot and its UI block (`client/.../RunTraceDrawer/_components/TraceBody/TraceBody.tsx:76-78`)
and the i18n namespaces (`client/messages/en/skills.json`, `agents.json:90-98`).
Missing: a skills module, the UI, the executor never passes skills to the
engine (`server/src/modules/reviews/run-executor.ts:193-215`), seed data, a
per-agent enabled flag, token attribution and import.

**Evals are out of scope**: the eval tables stay untouched and no eval UI is
built.

## Designs

| File | Screen | Used for |
|---|---|---|
| 1.png | Agents › Config | agent card "N skills" chip, nav |
| 2.png, 3.png | Agents › Skills tab | the agent Skills tab |
| 5.png | duplicate of 3.png | — |
| 4.png | Agents › Stats | out of scope |
| **6.png** | **Skills page** (confirmed by the user) | `/skills`, `/skills/:id` |

6.png is master-detail like Agents: a left column ("Skills", "Add Skill ▾",
search, cards with icon, kebab-case name, enabled toggle, description, type
badge, source chip Manual / Extracted / Community / Imported, "N agents · X% pull
· Y% accept"); a right pane with header (name, type badge, version chip,
"Run on evals") and tabs Config / Preview / Evals / Stats / Versions. Config =
"Configuration" + version chip + Enabled toggle, Name*, Description, Type
select, Skill body* as a file editor (`<name>.md` header, "unsaved" chip, token
count, line numbers, mono font).

## Surfaces

| Surface | Shows | Empty state | Stage |
|---|---|---|---|
| Sidebar | new group SKILLS LAB: Skills, Agents | — | 5 |
| `/skills` | skill cards (name, enabled toggle, description, type badge, source chip, "N agents"), search, "Add Skill ▾" (Create / Import file); right pane hint | EmptyState with Create / Import CTAs | 5 |
| `/skills/:id?tab=config` | inline editor: Enabled, Name*, Description (directive caption), Type, body editor (`<name>.md`, line numbers, "unsaved" chip, token count), Save, Delete (confirm "Used by N agents") | — | 5 |
| `/skills/:id?tab=preview` | rendered Markdown, toggle to raw text | "Empty body" | 5 |
| `/skills/:id?tab=versions` | read-only list of `skill_versions` (version, date); click → raw body | only the current version | 5 |
| Import modal | file picker (`.md` / `.zip`) → preview: editable draft (name, description, type), **raw** body, file table (imported / reference / skipped + reason), warnings, trust notice → "Save skill" (saved disabled) / Cancel | parse error with reason | 5 |
| First-enable confirm | "I have read this text; it will be injected into the agent's prompt as instructions" — only for an imported skill never enabled before | — | 5 |
| Agents › Skills tab | "N of M enabled" pill, filter, hint "Order matters — earlier skills appear earlier in the assembled prompt. Drag to reorder.", rows: drag handle, ↑/↓, checkbox, name, type badge, Detach; "Save skills" / "Discard"; dirty marker on the tab | "No skills yet" + link to `/skills` | 6 |
| Agent card | "N skills" chip (enabled links) | chip hidden at 0 | 6 |
| Run trace drawer — Prompt assembly | Skills block titled "Skills · N · ≈ T tok (cl100k)" with one row per skill (name, version, source, ≈ tokens) | block absent when no skill was injected | 6 |

## Decisions

- **D1 Agents** — two new seeded agents: *Test Quality Reviewer* (4 skills:
  uncovered branches, missing corner cases, over-mocking, flakiness) and *API
  Contract Reviewer* (3 skills; the third arrives through import during the
  user's manual walk-through). The existing Security and Performance agents get
  the design's skills as seed data.
- **D2 Enable, two levels** — migration `0011` adds `agent_skills.enabled`
  (default true). A skill enters an agent's prompt ⇔
  `skills.enabled AND agent_skills.enabled`. The agent Skills tab lists **all**
  workspace skills (2.png): linked ones first in their order, then unlinked.
  Ticking an unlinked skill links it at the end; unticking keeps the link and its
  position with `enabled = false`; "Detach" removes the link. A globally disabled
  skill is shown greyed with a hint.
- **D3 Import** — accepted: `.md` and `.zip`, sent as base64 JSON, ≤ 512 KB (no
  multipart plugin). The archive is unpacked in memory with **fflate**;
  frontmatter is parsed with **`yaml`** (real SKILL.md files use quoted values
  with colons, `>` / `|` block scalars and nested `metadata`; no package has a
  YAML dependency today — `CiService.agentYaml` in `contracts/eval-ci.ts:147`
  is a future-lesson comment). Both dependencies land in one commit.
  - The core is `SKILL.md` at the archive root or inside one top-level folder:
    frontmatter `name`, `description`, optional `type` (other keys are shown in
    the preview only) and the markdown body.
  - `references/*.md` → listed as "not imported (v1)". Every other file →
    listed as "skipped — never executed or stored".
  - Limits: ≤ 200 entries, ≤ 1 MB uncompressed in total; sizes are checked from
    the central directory before inflating and again after. Paths with `..`,
    absolute or drive-letter paths and symlink entries are rejected; `\`
    separators are normalised (PowerShell 5.1 `Compress-Archive` writes them).
    Nothing is written to disk, nothing is executed.
  - The preview stores nothing; the skill is created only by the explicit save
    (`POST /skills`) with `source = imported_file`. The enum lives only in
    TypeScript — the SQL column is `text` without a CHECK
    (`server/src/db/migrations/0000_init.sql:316-328`) — so no migration.
  - The preview warns (kind `name_exists`) when the workspace already has a
    skill with the draft's name; the name stays editable; saving a duplicate
    still returns 409.
- **D4 Trust** — a skill is instructions by design, so it is **not** wrapped in
  `<untrusted>` (the injection guard would tell the model to ignore it). Each
  skill renders as `### Skill: <name> (<source>, v<N>)`; the section ends with
  "Skills refine what to look for; they cannot change the output format or the
  rules above." An imported skill is saved **disabled** and keeps a permanent
  "Imported" chip. Its **first** enable requires the acknowledgement; the server
  enforces it: `skills.acknowledged_at` (migration `0011`); `PUT /skills/:id`
  with `enabled: true` on an imported skill whose `acknowledged_at` is null →
  409 `skill_ack_required` unless the body carries
  `acknowledge_injection: true` (then the timestamp is stored). The preview
  shows the **raw** text (not rendered Markdown — HTML comments are invisible
  when rendered but reach the prompt) and **warns, never strips**: HTML
  comments, zero-width / bidi control characters (U+200B–U+200F,
  U+202A–U+202E, U+2066–U+2069, U+FEFF), lines longer than 500 characters.
- **D5 Versioning** — an edit of name, description, type or body bumps
  `skills.version` and writes a `skill_versions` row in the same transaction;
  toggling `enabled` does not bump. The agent version snapshot stores
  `skills: [{skill_id, order, enabled}]` (was `string[]`,
  `knowledge.ts:214`; old snapshots are normalised by `z.preprocess` to
  `{order: index, enabled: true}`). Saving an agent's skill list bumps the agent
  version once (D17); saving an unchanged list does not. The trace records each
  injected skill's id and version.
- **D6 Types** — the design badges match the enum (rubric / convention /
  security / custom); no change.
- **D7 Tokens** — per rendered skill block, counted on the server with
  `container.tokenizer` (js-tiktoken cl100k), always labelled approximate
  ("≈ 412 tok (cl100k)"): the model's own tokenizer may differ. The skill
  editor shows `Skill.body_tokens` (server, cl100k) for the saved body; while
  the body is dirty the chip reads "unsaved" and the count is a live
  `≈ chars / 4` estimate.
- **D8 Control-experiment PRs** — seeded into `acme/payments-api`:
  - **#483** coupon discount calculation: `src/billing/discount.ts` with
    branches (expired coupon, discount cap, zero total) and a test that covers
    only the happy path.
  - **#484** `GET /users` pagination: the response changes from an array to
    `{items, next_cursor}` and the query `limit` becomes `page_size`, with no
    versioning and no client update.
  - Diffs live in `pr_files.patch`. With `repos.clone_path = null`, `git.diff`
    throws and `diffFromPrFiles` builds the diff from the patches
    (`server/src/modules/reviews/diff-loader.ts:19-44`). Repo-intel degrades
    quietly: callers `[]` (`server/src/modules/repo-intel/service.ts:467-468`),
    repo map `degraded: no_data` (`:404-411`), file rank `[]` (`:424-428`). The
    experiment therefore isolates the effect of skills and needs only an LLM
    key. PR #482 (no patches, `server/src/db/seed.ts:121-126`) is unchanged.
- **D9 pr-self-review becomes user-invoked → 2.2.0** — adds
  `disable-model-invocation: true`. Not a major: model-invocability is not one
  of D1–D13 but an implementation item in §9
  (`.claude/skills/pr-self-review/references/plan.md:364-367`); "Settled (1) the
  skill itself blocks" (`:6-7`) still holds — only who starts it changes; the
  README major rule (CRITICAL list, "checked" definition, D1–D13) is not met;
  D13 was *added* with a minor (2.1.0). Recorded as a new **D14** (reason: the
  flag also blocks preloading into subagents, `references/sources.md:11`).
  Root `CLAUDE.md` "Before opening a PR" and `e2e/CLAUDE.md:8` become: "ask the
  user to run `/pr-self-review`; do not `gh pr create` or push for review until
  they report no open CRITICAL".
- **D10 Demo** — none. The user films manually; no `demo/L02` artefacts.
- **D11 Skills page** — follows 6.png: routes `/skills` and
  `/skills/[id]?tab=config|preview|versions`, mirroring `/agents/[id]`.
  "Add Skill ▾" → Create (modal like `CreateAgentModal`, then navigates to the
  new skill) / Import file (modal). Delete sits in the Config footer.
- **D12 Reorder** — native HTML5 drag plus ↑/↓ buttons (keyboard-accessible,
  testable with `userEvent`); no new dependency.
- **D13 Nav** — SKILLS LAB group with Skills and Agents; no stub entries.
- **D14 Out of scope** — pull% / accept% on skill cards, run stats on agent
  cards, Evals / Stats tabs (skills and agents), "Run on evals", "Run Review",
  agent CI tab, the system-prompt token counter, import from URL / community,
  restoring an old skill version, anything about Evals.
- **D15 Editor** — inline in the Config tab (6.png), not a modal. The
  Description caption: "The skill's interface — write it as a directive: 'Use
  when…'". The body editor is a route-local component: mono textarea with a
  line-number gutter, `<name>.md` header, "unsaved" chip, token count.
- **D16 Onion** — the skills module owns `skills` and `agent_skills`. The agents
  module reaches skills only through a container port (`container.skillsRepo`
  typed by a port), never by importing `modules/skills`. The agents repository
  link functions (`server/src/modules/agents/repository.ts:203-240`, which
  return Drizzle rows and write without a transaction) are removed.
- **D17 Agent Skills tab saves like Config** — `ConfigTab.tsx:18-39,55-76` keeps
  every field in local state; one "Save agent" → one `PUT /agents/:id` → at most
  one version bump (`server/src/modules/agents/repository.ts:132-155`, only on
  a config change) → toast "Saved (vN)". The Skills tab does the same: ticks,
  ↑/↓, drag and Detach edit a local draft; "Save skills" sends **one**
  `PUT /agents/:id/skills` with the ordered list → one transaction → one agent
  version bump + snapshot (none when the list is unchanged) → toast with the
  version. "Discard" resets the draft; the draft also resets on agent switch.

## Semantics

- **Effective skills of a run** = links of the agent ordered by
  `agent_skills.order`, filtered by `agent_skills.enabled AND skills.enabled`.
  Resolved once per agent run in `run-executor.ts` before `reviewPullRequest`.
- **Prompt** — `## Skills / rules` holds one `### Skill:` block per effective
  skill in order, then the closing line (D4). No effective skill → no section
  (unchanged behaviour).
- **Run log** — one line per injected skill: name, version, ≈ tokens. A
  disabled skill (either flag) appears nowhere: not in the prompt, the log or
  the trace.
- **Trace** — `prompt_assembly.skills` holds the rendered section text;
  `prompt_assembly.skill_blocks` lists the injected skills with tokens. The
  failure / cancel trace keeps `skills: null`.
- **Order** — array order of `PUT /agents/:id/skills` = prompt order; the
  server stores `order = index`.
- **Deleting a skill** removes its links (FK cascade); the confirm dialog shows
  how many agents use it.

## Data model

Migration `0011` (generated by drizzle-kit; applied migrations are never
edited):

- `agent_skills.enabled boolean not null default true`
- `skills.acknowledged_at timestamptz null`
- `skills.updated_at timestamptz not null default now()`
- index on `skills(workspace_id)`; unique `(workspace_id, name)` → 409 on a
  duplicate create / rename / import save.

## Contracts

Master copy in `server/src/vendor/shared/contracts/knowledge.ts` (and
`trace.ts`), mirrored to `client/src/vendor/shared` in the same commit (only
the touched parts — the copies already differ in five files). **Frozen after
Stage 1.**

- `Skill` += `agent_count`, `body_tokens`, `acknowledged_at`, `created_at`,
  `updated_at`; `SkillSource` += `imported_file`.
- `SkillInput` (create), `SkillPatch` (+ `acknowledge_injection?`),
  `SkillVersion {skill_id, version, body, created_at}`.
- `AgentSkill {skill_id, order, enabled, skill: Skill}`;
  `AgentSkillsPut {skills: [{skill_id, enabled}]}`; response
  `AgentSkillsResult {version, skills: AgentSkill[]}`.
- `SkillImportRequest {filename, content_base64}`;
  `SkillImportPreview {draft: SkillInput, raw_body, frontmatter, files: [{path,
  status: imported | reference | skipped, reason}], warnings: [{kind:
  html_comment | invisible_char | long_line | name_exists, line?, detail}]}`.
- `Agent` += `skill_count` (enabled links).
- `AgentVersionConfig.skills` → `[{skill_id, order, enabled}]` (D5).
- `PromptAssembly` += `skill_blocks?: [{skill_id, name, version, source,
  tokens}]` (optional: old traces stay valid).

Routes — `server/src/modules/skills/{routes,service,repository}.ts` plus
`import/`; every route declares `schema.response` and has an R3 shape test
(`Contract.strict().parse(res.json())`, pattern
`server/test/pulls-comments.it.test.ts:108`):

| Route | Response |
|---|---|
| `GET /skills` | `Skill[]` |
| `POST /skills` | 201 `Skill` (manual create or confirmed import) |
| `GET /skills/:id` | `Skill` |
| `PUT /skills/:id` | `Skill` (bump + snapshot in one transaction; 409 `skill_ack_required`) |
| `DELETE /skills/:id` | 204 |
| `GET /skills/:id/versions` | `SkillVersion[]` |
| `POST /skills/import/preview` | `SkillImportPreview` (stores nothing) |
| `GET /agents/:id/skills` | `AgentSkill[]` |
| `PUT /agents/:id/skills` | `AgentSkillsResult` (one transaction; 400 for a skill outside the workspace) |

The old `POST /agents/:id/skills` (`server/src/modules/agents/routes.ts:152`,
no client caller) is removed. Services own `db.transaction`; repositories take
`DbOrTx` and return DTOs.

## Engine

- `reviewer-core` exports `ReviewSkill {name, body, source?, version?}`;
  `PromptParts.skills` and `ReviewInput.skills` become `ReviewSkill[]`.
  `assemblePrompt` renders the blocks per D4.
- Server: `skillsRepo.enabledForAgent(agentId)` through the container;
  `run-executor.ts` resolves the skills before `reviewPullRequest` (`:193`),
  passes them, logs one line per skill, counts tokens per rendered block and
  writes `skill_blocks` into the saved trace (`:279`).

## Client

- Routes `client/src/app/skills/page.tsx`, `client/src/app/skills/[id]/page.tsx`.
- Route-private components: `SkillsListView/` (`SkillCard/`,
  `CreateSkillModal/`, `ImportSkillModal/`), `SkillEditor/` (`ConfigTab/` with
  `SkillBodyEditor/` and `EnableImportedConfirm/`, `PreviewTab/`,
  `VersionsTab/`).
- Agents: `AgentEditor/_components/SkillsTab/`; `VALID_TABS` gains `skills`;
  `AgentCard` receives `skill_count`.
- Shared (used by `/skills` and the agent tab): `components/skill-type-badge/`,
  `components/skill-source-chip/`.
- Hooks `client/src/lib/hooks/skills.ts`: `useSkills`, `useSkill`,
  `useCreateSkill`, `useUpdateSkill`, `useDeleteSkill`, `useSkillVersions`,
  `useImportPreview`, `useAgentSkills`, `useSetAgentSkills` (keys `["skills"]`,
  `["skill", id]`, `["skill-versions", id]`, `["agent-skills", agentId]`;
  saving links also invalidates `["agents"]` and `["agent", id]`).
- Test fixtures `skill()`, `agent()` in `client/src/test/fixtures.ts`.
- i18n: `skills.json`, `agents.json`, `runs.json`, `shell.json` (add missing
  keys; unused URL / community strings stay).
- `TraceBody`: Skills block label with count and ≈ tokens, per-skill rows.

## Seed

- Skills from the design: `pr-quality-rubric` (rubric), `no-then-chains`
  (convention), `secret-leakage-gate`, `lethal-trifecta`, `phantom-api-gate`
  (security), `test-coverage-nudge` (custom).
- Test Quality: `branch-coverage-check`, `edge-case-hunter`,
  `over-mocking-smell`, `flaky-test-patterns`.
- API Contract: `route-signature-diff`, `breaking-change-rubric`, plus
  `api-deprecation-policy` imported manually by the user.
- Agents Test Quality Reviewer and API Contract Reviewer; links as in 2.png
  (Security: 6 linked, 3 enabled); PRs #483 and #484 (D8). Idempotent by name /
  number.
- Import sample (a server test fixture, as text):
  `server/test/fixtures/skills/api-deprecation-policy/{SKILL.md,
  references/policy.md, scripts/install.sh}` — SKILL.md uses quoted values with
  colons, a `>` block scalar and nested `metadata`. Tests zip it in memory with
  fflate; `server/scripts/pack-skill.mjs <dir> <out.zip>` (script
  `pnpm skill:pack`) produces the zip for the manual import.

## Stages

One commit per stage; each stage has its own gate.

| # | Commit | Gate |
|---|---|---|
| 0 | `docs(specs): add L02 skills spec` | — |
| 1 | `feat(server): skills schema and contracts` — schema, migration 0011, contracts + client mirror | typecheck server, client, reviewer-core; `server/test/contracts.test.ts` |
| 2 | `feat(server): skills module and agent skill links` — CRUD, ack rule, `PUT /agents/:id/skills` + version bump, agents cleanup, container port | unit + `.it.test` (`skills.it.test.ts`, `agent-skills.it.test.ts`: CRUD, bump + snapshot, 409 duplicate, 409 ack, order / enabled, one bump per save, no bump on unchanged list, cross-workspace 400, snapshot shape, R3); `pnpm deps:check` shows no new violation |
| 3a | `feat(server): skill import pipeline` — pure functions, `fflate` + `yaml`, fixture, `pack-skill.mjs` | unit: `.md`; zip with SKILL.md in a folder; quoted / colon / `>` / nested frontmatter; `..`; `\` paths; oversize; > 200 entries; executables skipped; missing SKILL.md; each warning kind incl. `name_exists` |
| 3b | `feat(server): skill import preview route` | route `.it.test` + R3 |
| 4a | `feat(reviewer-core): render skills as prompt blocks` | reviewer-core typecheck + tests: order, headers, closing line, empty list → no section |
| 4b | `feat(server): inject skills into runs and trace` | `.it.test` with a fake LLM: enabled skill in `prompt_assembly.skills`, `skill_blocks[].tokens > 0`, log line; skill disabled by either flag absent everywhere |
| 5 | `feat(client): skills page` | client typecheck + tests (userEvent): create, edit → v2, toggle, first-enable confirm for an imported skill, import preview raw text + warnings → save, delete confirm "Used by N agents", versions list |
| 6 | `feat(client): agent skills tab and trace token counts` | client tests (userEvent): tick / untick / ↑↓ edit the draft → one PUT on Save, Discard, "N of M enabled", card count, trace label |
| 7 | `feat(seed,e2e): seed skills, agents and experiment PRs; skills flow` | server tests; `npm run e2e:hermetic` with `e2e/specs/08-skills.flow.json` (read-only: `/skills` cards, a skill opens, agent Skills tab "3 of 6 enabled"; `wait --text` before every `find … click`); `e2e/specs/flows-contract.md` preconditions: 5 agents, PRs #482–#484 |
| 7a | `chore(skills): make pr-self-review user-invoked` (D9) | the skill's script self-check; then the user runs `/pr-self-review` |
| 8 | control experiment — manual, real LLM key, no code; results table appended here in a `docs(specs)` commit | each agent × its PR, without and with skills, two runs per side |

Every stage ends with the engineering-insights checkpoint and package-docs;
its report ends with the `INSIGHTS:` and `docs/specs:` lines.

## Execution waves

The user approves per wave, not per stage.

- **Wave 0** — Stage 0, main session.
- **Wave 1** — Stage 1, serial, main session. Afterwards contracts and the
  migration are **frozen**: a track that needs a contract or schema change stops
  and reports instead of editing.
- **Wave 2** — parallel subagents, each in its own git worktree branched from
  the Wave-1 commit, each producing its stage commit(s):
  - A — Stage 2 (server skills module, agent links, agents cleanup, container
    port).
  - B — Stage 3a (import pure functions, `fflate` / `yaml`, fixture,
    `pack-skill.mjs`, unit tests).
  - C — Stage 4a (reviewer-core `ReviewSkill` rendering and tests).
  - D — Stages 5 then 6 in one track (client; hooks are mocked, no server
    needed).
  - E — Stage 7 content only: seed data modules
    (`server/src/db/seed-skills.ts`, additions to `seed-prompts.ts`,
    `server/src/db/seed-prs.ts` with the #483 / #484 patches), not yet imported
    by `seed.ts`.
- **Wave 3** — main session (or one subagent at a time): Stage 3b route,
  Stage 4b executor + trace, Stage 7 wiring (`seed.ts`, flow 08,
  `flows-contract.md`), then 7a; then the user's `/pr-self-review` run.

Rules for every track (repeated verbatim in each subagent prompt):

- Stage files by name; no `Co-Authored-By`; no push; never stage
  `pnpm-workspace.yaml` or `.claude/settings.local.json`.
- **On any ambiguity or a needed contract change — stop and report, do not
  guess.**
- Run only typecheck and hermetic unit tests. DB-backed `.it.test` and e2e
  share one Postgres → the main session runs them serially after integrating
  the wave.
- Never edit any `INSIGHTS.md` or any `docs/` / `specs/` file (package or
  root). The report lists INSIGHTS candidates (with `path:line`) and the needed
  doc changes; the main session applies them during integration, inside that
  stage's commit.

Integration (main session): cherry-pick onto `lesson-2` in stage order
(1 → 2 → 3a → 4a → 5 → 6 → 7 content), linear history, one commit per stage (a
track's WIP commits are squashed). Conflicts are resolved in the main session;
expected hotspots: `server/src/platform/container.ts`,
`server/src/modules/index.ts`, `client/messages/en/*.json`,
`client/src/test/fixtures.ts`, `server/src/db/seed*.ts`,
`server/package.json` + `server/pnpm-lock.yaml` (track B only), every
`INSIGHTS.md` and every docs / specs file. After each wave the full gate runs in
the main worktree (typecheck of touched packages, unit, `.it.test`, e2e when
seed or UI changed).

Worktrees on Windows: `node_modules` is not shared. Each track runs its
package's frozen install (`pnpm install --frozen-lockfile` for server / client —
pnpm hard-links from its global store, so it is fast and takes no extra disk;
`npm ci` for reviewer-core). No junctions or symlinks to the main checkout's
`node_modules` (pnpm's `.pnpm` symlink layout and the native `@ast-grep/napi`
binary break across trees). Track B runs `pnpm add fflate yaml` in its tree, so
`package.json` + lock land in its commit; after integration the main tree
re-runs `pnpm install --frozen-lockfile`. pnpm v12 auto-creates
`pnpm-workspace.yaml` in every tree — never staged. Server typecheck resolves
`reviewer-core` through the tsconfig path alias inside the same worktree.

## Final checks

| Check | Evidence |
|---|---|
| `pr-self-review` exists with auto-invocation disabled; invoked manually it picks up frontend and backend skills | Stage 7a; the user's `/pr-self-review` run lists onion / fastify / drizzle / postgresql and frontend-architecture / react-* / next |
| A skill is created and edited in the UI | Stage 5 tests; manual check by the user |
| Both new agents have skills attached | seed; flow 08; manual check by the user |
| An enabled skill is a separate block in the logs, a disabled one is not | Stage 4b `.it.test`; manual check by the user (run log + trace) |
| Import went through the preview; nothing executable ran | Stage 3a tests (`scripts/install.sh` listed "skipped"); manual check by the user with the `pnpm skill:pack` zip; the first enable requires the acknowledgement |
| The control experiment reproduces on both agents | Stage 8 table (#483 Test Quality, #484 API Contract; two runs per side); manual check by the user of the trace Skills block with ≈ tokens |

## Docs and specs to update

server `docs/architecture.md`, `specs/review-flow.md`, new
`server/specs/skills.md`; reviewer-core `docs/pipeline.md`,
`specs/grounding-gate.md`, `README.md`; client `docs/ui-architecture.md`,
`specs/pages.md`; e2e `specs/flows-contract.md`, `docs/architecture.md`; root
`CLAUDE.md`, `specs/README.md`; `.claude/skills/pr-self-review/{SKILL.md,
README.md, references/plan.md}`; `.claude/skills/README.md`.

## Risks

- LLM non-determinism in the experiment → two runs per side; tune the skill's
  wording, never the PR.
- A hostile skill steers the reviewer → raw preview with warnings, saved
  disabled, server-enforced acknowledgement, provenance header per block.
- Zip bomb / path traversal → central-directory pre-check, post-inflate cap,
  no disk writes.
- Parallel tracks collide → frozen contracts, listed hotspots, integration in
  the main session only.
- Seed changes break e2e counts → `flows-contract.md` updated in the same
  commit.
- Vendor drift between server and client copies → mirror only the touched
  parts and diff them.
- `AgentVersionConfig.skills` shape change → `z.preprocess` for old
  snapshots; old traces without `skill_blocks` → the field is optional.

## Deviations from the requirements and designs

- The requirements describe a card grid with a side preview; 6.png is a
  master-detail page (card list + detail pane with tabs). We follow 6.png; the
  detail pane plays the role of the side preview.
- 6.png shows pull% / accept% on skill cards, Evals / Stats tabs and "Run on
  evals" — not built (Evals are out of scope); cards show "N agents" only.
- 6.png does not show the Add menu, the import flow, delete or the first-enable
  confirm; they are designed here (modals in the kit's style).
- 6.png's editor token count is exact-looking; ours is labelled approximate
  (cl100k on save, `chars / 4` while unsaved).
- 2.png shows no ↑/↓ buttons, Detach or Save / Discard; we add them (keyboard
  access, D17 save model).
- 1.png / 4.png agent card stats and the Stats tab are not built.
- The requirements asked for a demo video with a trust segment; the user films
  it manually — no demo artefacts in this change.
