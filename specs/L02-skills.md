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
| Import modal | file picker (`.md` / `.zip`) → preview: editable draft (name, description, type), **raw** body, file table (imported / reference / skipped + reason), warnings, trust notice → "Save skill" (`POST /skills/import` with the file + overrides; saved disabled) / Cancel | parse error with reason | 5 |
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
    After inflating, each entry's size and CRC-32 must match the central
    directory (fflate truncates silently otherwise); ZIP64, encrypted entries
    and duplicate paths are rejected. Exactly one `SKILL.md` candidate (root or
    one top-level folder) is required — several are rejected, never picked.
    Nothing is written to disk, nothing is executed.
  - The preview stores nothing. The skill is created only by the explicit save
    `POST /skills/import` (`SkillImportSave`): the client re-sends the **file**
    plus optional `name` / `description` / `type` overrides; the server re-runs
    the pipeline, applies only those overrides and itself sets
    `source = imported_file`, `enabled = false`, `acknowledged_at = null`. The
    body is always the parsed body — never client-supplied — so the D4
    acknowledgement cannot be skipped by posting imported text as a manual
    skill (`POST /skills` accepts `source: 'manual'` only). Pipeline errors use
    the same `SkillErrorCode`s; a duplicate name → 409 `skill_name_taken`; no
    description in the file and no override → 422
    `import_description_missing`; a final name that is not a `SkillName` → 422
    `import_invalid_name`; a description over 500 chars, a body over 50,000
    chars or an empty body → 422 `import_invalid_field` with
    `details: {field, limit}` (empty body: `field: body, limit: 1`). The
    `source` enum lives only in TypeScript — the SQL
    column is `text` without a CHECK
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
  - Fixture files: #483 `src/billing/discount.ts` + `test/billing/discount.test.ts`
    (2 files, +81/−0); #484 `src/api/users.ts` + `src/schemas/users.ts`
    (2 files, +31/−8); data in `server/src/db/seed-prs.ts`. Neither the PRs
    nor any seed skill or prompt names the defect (checked by grep).
  - Run the experiment **only on Test Quality Reviewer (#483) and API
    Contract Reviewer (#484)**. General Reviewer on #484 is not meaningful:
    its prompt already mentions pagination (`server/src/db/seed-prompts.ts:36`).
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
- **D16 Onion** — the skills module owns `skills`, `skill_versions` and
  `agent_skills`. The agents module reaches skills only through a container
  port (`container.skillsRepo`, typed as `SkillsPort`; the skills routes use
  the full repository via `container.skillsModuleRepo`), never by importing
  `modules/skills`; the link save bumps the agent version through the agents
  repository inside the skills service's transaction. The old agents
  repository link functions (they returned Drizzle rows and wrote without a
  transaction) and the old `GET/POST /agents/:id/skills` routes of the agents
  module are removed.
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
  "Used by N agents" from `Skill.agent_count`.
- **Counts** — `Skill.agent_count` = agents with a link to the skill, enabled
  or not. `Agent.skill_count` = the agent's **effective** skills
  (`skills.enabled AND agent_skills.enabled`), so the agent card never counts a
  skill that is absent from the prompt.

## Known limitations

- `skill_versions` holds only the body (no migration planned): a metadata-only
  edit (name / description / type) bumps `skills.version` with an unchanged
  body; the Versions tab labels such a row "metadata change".
- `SkillImportWarning.line` is a 1-based line of `raw_source` (SKILL.md with
  its frontmatter), not of the parsed body.

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
`trace.ts`), mirrored to `client/src/vendor/shared`; since Stage 1 both files
are byte-identical in the two copies. **Frozen after Stage 1b** — the field
list is in `server/specs/skills.md` and the schemas themselves.

- `Skill` += `agent_count`, `body_tokens`, `acknowledged_at`, `created_at`,
  `updated_at`; `SkillSource` += `imported_file`; `SkillName` (kebab-case,
  ≤ 64).
- `SkillInput` (manual create only; `source` is the literal `manual`),
  `SkillPatch` (+ `acknowledge_injection: true`), `SkillVersion`.
- `AgentSkill {skill_id, order, enabled, skill: Skill}`;
  `AgentSkillsPut {skills: [{skill_id, enabled}]}`; response
  `AgentSkillsResult {version, skills: AgentSkill[]}`.
- `SkillImportRequest {filename, content_base64}` (preview);
  `SkillImportSave {filename, content_base64, name?, description?, type?}`
  (save — overrides only, no body / source / enabled);
  `SkillImportPreview {filename, draft: SkillDraft, raw_source, frontmatter,
  files: [{path, status: imported | reference | skipped, reason, size}],
  warnings: [{kind, line | null, detail}]}`; warning kinds: `html_comment`,
  `invisible_char`, `long_line`, `name_exists`, `name_normalized`,
  `type_defaulted`, `description_missing`. `SkillDraft` is unvalidated (the
  user fixes name / description / type, sent back as `SkillImportSave`
  overrides); `raw_source` = SKILL.md exactly as found, frontmatter included;
  `warnings[].line` counts `raw_source` lines.
- `SkillErrorCode`: `skill_name_taken`, `skill_ack_required`,
  `skill_not_in_workspace`, `import_unsupported_file`, `import_too_large`,
  `import_bad_archive`, `import_unsafe_path`, `import_no_skill_md`,
  `import_bad_frontmatter`, `import_description_missing`,
  `import_invalid_name`, `import_invalid_field` (details `{field, limit}`).
- `Agent` += `skill_count` (effective skills, see Semantics).
- `AgentVersionConfig.skills` → `AgentVersionSkill[]` `{skill_id, order,
  enabled}` (D5).
- `PromptAssembly` += `skill_blocks?: SkillBlock[]` `{skill_id, name, version,
  source, tokens}` (optional: old traces stay valid).

Routes — `server/src/modules/skills/{routes,service,repository}.ts` plus
`import/`; every route declares `schema.response` and has an R3 shape test
(`Contract.strict().parse(res.json())`, pattern
`server/test/pulls-comments.it.test.ts:108`):

| Route | Response |
|---|---|
| `GET /skills` | `Skill[]` |
| `POST /skills` | 201 `Skill` (manual create only) |
| `GET /skills/:id` | `Skill` |
| `PUT /skills/:id` | `Skill` (bump + snapshot in one transaction; 409 `skill_ack_required`) |
| `DELETE /skills/:id` | 204 |
| `GET /skills/:id/versions` | `SkillVersion[]` |
| `POST /skills/import/preview` | `SkillImportPreview` (stores nothing) |
| `POST /skills/import` | 201 `Skill` (server re-parses the file; saved disabled) |
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
- Route-private components: under `app/skills/_components/`:
  `SkillsListView/` (`SkillCard/`, `CreateSkillModal/`, `ImportSkillModal/`
  with `ImportPreviewDetails/`), `SkillEnabledToggle/` (with
  `EnableImportedConfirm/`; shared by the card and the Config tab),
  `SkillMetaFields/` (name / description / type, used by create, import and
  Config); under `app/skills/[id]/_components/`: `SkillEditor/` (`ConfigTab/`
  with `SkillBodyEditor/` and `DeleteSkillConfirm/`, `PreviewTab/`,
  `VersionsTab/`).
- The skill's Enabled switch (card and Config tab) writes at once
  (`PUT {enabled}`, no version bump) and is not part of the Config draft; an
  unsaved draft survives the toggle and its refetch.
- Agents: `AgentEditor/_components/SkillsTab/` (with `SkillRow/`); the draft
  lives in `AgentEditor` so it survives a tab switch; `VALID_TABS` gains
  `skills`; `AgentCard` receives `skill_count`. "N of M enabled": N = linked
  AND globally enabled (the `skill_count` rule), M = linked.
- Trace: `RunTraceDrawer/_components/SkillBlocksList/` renders the per-skill
  rows; `skillsSummary` (`RunTraceDrawer/helpers.ts`) the label.
- Shared (used by `/skills` and the agent tab): `components/skill-type-badge/`,
  `components/skill-source-chip/`.
- Hooks `client/src/lib/hooks/skills.ts`: `useSkills`, `useSkill`,
  `useCreateSkill`, `useUpdateSkill`, `useDeleteSkill`, `useSkillVersions`,
  `useImportPreview`, `useImportSkill`, `useAgentSkills`, `useSetAgentSkills` (keys `["skills"]`,
  `["skill", id]`, `["skill-versions", id]`, `["agent-skills", agentId]`;
  saving links also invalidates `["agents"]` and `["agent", id]`).
- Test fixtures `skill()`, `agent()` in `client/src/test/fixtures.ts`.
- i18n: `skills.json`, `agents.json`, `runs.json`, `shell.json` (add missing
  keys; unused URL / community strings stay).
- `TraceBody`: Skills block label with count and ≈ tokens, per-skill rows.

## Seed

**12 seed skills**, all `source: manual`, bodies generic (no experiment
words), descriptions as "Use when …" directives
(`server/src/db/seed-skills.ts`, `SEED_SKILLS`):

- Design skills: `pr-quality-rubric` (rubric), `no-then-chains`
  (convention), `secret-leakage-gate`, `lethal-trifecta`, `phantom-api-gate`
  (security), `test-coverage-nudge` (custom).
- Test Quality: `branch-coverage-check` (rubric), `edge-case-hunter`
  (custom), `over-mocking-smell` (convention), `flaky-test-patterns`
  (convention).
- API Contract: `route-signature-diff` (custom), `breaking-change-rubric`
  (rubric), plus `api-deprecation-policy` imported manually by the user.
- Links (`SEED_AGENT_SKILL_LINKS`, array order = `agent_skills.order`):
  Security — all 6 design skills, enabled `pr-quality-rubric`,
  `secret-leakage-gate`, `lethal-trifecta` (6 linked / 3 enabled, 2.png);
  Performance — `pr-quality-rubric`, `no-then-chains` (both enabled); Test
  Quality — its 4 skills; API Contract — its 2 skills.
- New agents (prompts `TEST_QUALITY_REVIEWER_PROMPT`,
  `API_CONTRACT_REVIEWER_PROMPT` in `server/src/db/seed-prompts.ts`, mirrored
  in `docs/agent-prompts/`), descriptions:
  - Test Quality Reviewer: "Finds untested branches, missing corner cases,
    over-mocked and flaky tests."
  - API Contract Reviewer: "Flags breaking changes to routes, response shapes
    and request parameters."
- PRs #483 and #484 (D8), status `needs_review`, PR totals summed from their
  files. Idempotent by name / number; an agent's links are seeded only while
  it has none (user edits survive a re-seed). Wired in `server/src/db/seed.ts`
  (Stage 7), checked by `server/test/seed.it.test.ts` and e2e flow
  `e2e/specs/08-skills.flow.json`.
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
| 3b | `feat(server): skill import routes` — preview + save | route `.it.test` + R3: preview stores nothing; save re-parses the file, ignores any client body, applies overrides, saves `imported_file` + disabled + `acknowledged_at` null; 409 duplicate; 422 codes |
| 4a | `feat(reviewer-core): render skills as prompt blocks` | reviewer-core typecheck + tests: order, headers, closing line, empty list → no section |
| 4b | `feat(server): inject skills into runs and trace` | `.it.test` with a fake LLM: enabled skill in `prompt_assembly.skills`, `skill_blocks[].tokens > 0`, log line; skill disabled by either flag absent everywhere |
| 5 | `feat(client): skills page` | client typecheck + tests (userEvent): create, edit → v2, toggle, first-enable confirm for an imported skill, import preview raw text + warnings → save, delete confirm "Used by N agents", versions list |
| 6 | `feat(client): agent skills tab and trace token counts` | client tests (userEvent): tick / untick / ↑↓ edit the draft → one PUT on Save, Discard, "N of M enabled", card count, trace label |
| 7 | `feat(seed,e2e): seed skills, agents and experiment PRs; skills flow` | server tests; `npm run e2e:hermetic` with `e2e/specs/08-skills.flow.json` (read-only: `/skills` cards, a skill opens, agent Skills tab "3 of 6 enabled"; `wait --text` before every `find … click`); `e2e/specs/flows-contract.md` preconditions: 5 agents, PRs #482–#484 |
| 7a | `chore(skills): make pr-self-review user-invoked` (D9) | the skill's script self-check; then the user runs `/pr-self-review` |
| 8 | control experiment — manual, real LLM key, no code; results table appended here in a `docs(specs)` commit | each agent × its PR, without and with skills, two runs per side |
| 9 | `refactor(client): move reviews and skills into features/` — in `lesson-2` right after Wave 3 and 7a (independent of Stage 8), separate commits, behaviour unchanged; includes the `frontend-architecture` skill change (R4 and the Map gain the `features/` layer → MAJOR 2.0.0 per its README, Changelog, catalog row); details go to the user for approval first. The user's final `/pr-self-review` runs after Stage 9, so it covers the refactor | client typecheck + all client tests + `npm run e2e:hermetic` |

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
  `flows-contract.md`), then 7a.
- **Stage 9** — `features/` refactor (client), main session, after Wave 3 and
  7a, once the user approves its details; then the user's final
  `/pr-self-review` run (it covers the refactor too). The PR comes later,
  after the lesson homework.

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

- A skill body is inserted verbatim, so its own `##` / `### Skill:` headings
  can imitate prompt sections (e.g. an imported "## Output format") —
  mitigated by the raw preview and the first-enable acknowledgement, not by
  code (reviewer-core deliberately does not escape skill bodies).

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
