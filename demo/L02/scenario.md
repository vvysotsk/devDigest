# Demo devdigest-l02 — shooting script

~6.4 min. Filmed by `demo-film` from `cues.json`; this file is the human view.
Narration is Ukrainian; everything else here stays English.

Source of truth: HW02 brief criteria K1–K7 ("Критерії приймання") and the
traceability / Final checks tables in `specs/HW02-conventions-and-api-contract.md`.
K1 is this video; the user's PR (K2) is not open yet, so only the pushed branch
can appear on screen.

## Assumptions

- Browser-only video (Windows): repo files are shown rendered on GitHub, branch
  `lesson-2`, pushed before filming (PREP-5).
- Voice: ElevenLabs `Eric` (`cjVigY5qzO86Huf0OWal`, `eleven_multilingual_v2`), as L01.
  The `devdigest-demo` skill text still says provider `edge`; follow-up, not changed here.
- The conventions data is the stored scan of `supermacro/neverthrow` (scan
  `6e85f7e5…`, 2026-10-01); Run Scan / ReScan are never clicked.
- Option B approved by the user: s3 clicks **Fetch preview** (a preview POST that
  stores nothing) on a public README to show the "No frontmatter" warning. `Fetch
  preview` is allowed in s3 only; `config.neverClick` otherwise applies.

## Preconditions

- app up: studio :3000, API :3001 (`./scripts/dev.sh`), Postgres in Docker.
- **Active repo pre-roll.** Nothing in the UI sets the stored repo, so a fresh
  staged profile would open `/conventions` on the first repo in the list (the seeded
  `acme/payments-api`). Every scene's pre-roll runs
  `localStorage.setItem('dd-repo', '<neverthrow id>')` on the studio origin before
  opening the page (`client/src/lib/repo-context.tsx:1-2`, `:29-33`). Client-side
  profile state, no request.
- **PREP state (done 2026-10-04, user clicks, me reading):**
  - Create skill on the neverthrow scan saved `repo-conventions` **v2** (the 4
    accepted rules), enabled, linked to **General Reviewer**
    (`server/src/modules/conventions/service.ts:207-224`, `:232-281`;
    `server/src/modules/skills/service.ts:220-243`).
  - One review run of General Reviewer on neverthrow PR #633: run
    `8b81f86d-e117-4222-8978-44c1b2ae1336`, approve, 0 findings, trace block
    `repo-conventions · v2 · Extracted · ≈ 313 tok`. Recorded in the spec (commit
    `fb75686`).
- **Scope rule until cleanup:** skill injection is not repo-scoped
  (`server/src/modules/skills/repository.ts:244-263`), so General Reviewer runs on no
  other repository from PREP until the cleanup below.
- `git push origin lesson-2` done after the PREP-5 grep (the diff and the commit
  messages of `8ae46a9..HEAD` grepped for the PREP-5 names and secret patterns —
  nothing); https://github.com/vvysotsk/devDigest is public.
- staged Chrome: Do Not Disturb on, pointer parked bottom-right.
- Never on screen: the devDigest fork's conventions scan, Settings / API keys,
  anything from the user's work repository.
- **Cleanup right after the user accepts the video (user clicks):**
  `/agents/6ca7b5bd…?tab=skills` → `repo-conventions` toggle off → Detach → Save skills;
  `/skills/d9ca9088…?tab=config` → Enabled off → Save skill (an `enabled` change alone
  does not bump the version, `server/src/modules/skills/service.ts:216-217`). The K6
  run stays; the spec cites its id.

## Numbers and labels as rendered (Playwright `ariaSnapshot`, 2026-10-04)

- `/skills`: 16 cards. Chips read `Manual v1 1 agent`, `Imported v1 1 agent`
  (breaking-change, response-schema, semver-discipline, deprecation-policy),
  `Extracted v2 1 agent` (repo-conventions, switch on), `Imported v1 0 agents`
  (frontend-design, switch off). Add Skill menu: `Create skill`, `Import from file`,
  `Import from URL`.
- `/skills/d9ca9088…`: header `repo-conventions · convention · Extracted v2`; tabs
  `Config`, `Preview`, `Versioning`; Preview = intro paragraph + four `##` rules with
  `Evidence: src/result-async.ts:22`, `:52`, `src/result.ts:140`, `:1`. Versioning:
  `v2 2026-10-04 15:56 current`, `v1 2026-10-01 15:23`, buttons `Diff`, `Restore`;
  after Diff: "Changes from v1 to the current v2".
- Import dialog: title `Import from URL`, subtitle "Fetched server-side, stored as
  untrusted, and left disabled until vetted."; field `Skill URL`; button `Fetch
  preview`; after fetch: `Draft` (Name, Description, Type), region `Raw SKILL.md …`,
  region `Warnings` with `No frontmatter` ("This file has no frontmatter — it does
  not look like a SKILL.md (a README or notes?) …"), `Type defaulted`,
  `Description missing`; `Files`: `README.md imported … 50853 B`; `Save skill`
  disabled. The warning appeared 0.4 s after Fetch in the check.
- `/conventions`: `Conventions in neverthrow`; `Detected from 9 sample files · last
  scan 3d ago` (the relative time is not narrated); `ReScan`; `4 of 10 accepted`;
  `Create skill`; 10 cards. Card 1 (pending): "In tee methods, catch and ignore errors
  from the side-effect function." · `error handling` · `src/result-async.ts:125` ·
  `Confidence 85%` · Accept / Reject / Edit. Card 2 (accepted): "Implement PromiseLike
  for async types to allow interoperability with async/await." · `async` ·
  `src/result-async.ts:22` · `95%` · `Accepted` / Reject / Edit. Accepted cards: 2,
  4 (`:52`, 90%), 7 (`src/result.ts:140`, 95%), 8 (`src/result.ts:1`, 95%).
- Evidence link href: `https://github.com/supermacro/neverthrow/blob/5ef3a018bda74fb960e44b68fc3672635ee8037d/src/result-async.ts#L22`.
- PR #486 (`/repos/b5c1cf00…/pulls/486?tab=findings`): heading "#486 Allow guest
  checkout without an email"; tab `Agent runs 6`; Timeline tiles (local time):
  `17:20:02` rejected 65 · 1 finding · 1 blocker · `$0.0005 · 3.6k→2.8k`;
  `17:18:59` rejected 65 · 1 finding · 1 blocker · `$0.0005 · 3.6k→1.4k`;
  `16:38:40` reviewed 88 · 1 finding · `$0.0004 · 3.2k→109k`;
  `16:07:26` approved 100 · `0 findings $0.021 · 3.2k→132k`; four older A' tiles
  (15:59:41, 15:55:19, 20:21:30, 20:20:05) below. Review runs: "request changes
  1 finding · 1 blocker 65 30.09.2026, 17:20:42" expanded; finding "Breaking change:
  Customer.email made optional without mitigation" · security ·
  `src/schemas/customers.ts:6` · `95% conf`.
- Trace `cc249084…` (17:18:59): `DURATION 23.6s TOKENS 4k→1.4k COST $0.0005
  FINDINGS 1`; Prompt assembly (collapsed by default) → `System`, `Skills · 4 · ≈
  1909 tok (cl100k)` with rows `breaking-change v1 Imported ≈ 566 tok`,
  `response-schema v1 … ≈ 470 tok`, `semver-discipline v1 … ≈ 420 tok`,
  `deprecation-policy v1 … ≈ 453 tok`, `User / diff (dynamic)`.
- Trace `066ebca1…` (16:07:26): `DURATION 1582.6s TOKENS 3k→132.0k COST $0.021
  FINDINGS 0`; Prompt assembly → `System`, `User / diff (dynamic)`; no Skills block.
- PR #633 (`/repos/8269d0d3…/pulls/633?tab=findings`): heading "#633 refactor: set
  `isErr()` return directly"; `master +2 −2 open`; tile `approved 100 General
  Reviewer … 0 findings $0.0004 · 3.9k→0.2k 17:58:38`. Trace `8b81f86d…`:
  `DURATION 5.9s TOKENS 4k→0.2k COST $0.0004 FINDINGS 0`; Prompt assembly → `Skills ·
  1 · ≈ 313 tok (cl100k)`, row `repo-conventions v2 Extracted ≈ 313 tok`.
- `/agents`: Security Reviewer `3 skills`, General Reviewer `1 skill`, Performance
  Reviewer `2 skills`, Test Quality Reviewer `4 skills`, API Contract Reviewer
  `4 skills`; model chip `deepseek/deepseek-v4-flash` on every card.
- `/agents/6ca7b5bd…?tab=skills`: `1 of 1 enabled`; row `repo-conventions` (switch on,
  `convention`, `Detach`); `Filter skills…`; "Order matters — earlier skills appear
  earlier in the assembled prompt. Drag enabled skills to reorder."
- `/agents/4d57ed84…?tab=skills`: `4 of 4 enabled`; rows in order breaking-change,
  response-schema, semver-discipline, deprecation-policy (Move up / down, Detach).

## 1. Skills page — cards, sources, the Add menu — 40 s
**Show:** `/skills` (sidebar shows `supermacro/neverthrow`).
**Do:** glide over the SKILLS LAB items; glide the four API skills' `Imported v1 1 agent` chips; click **Add Skill** (kit `Dropdown`, React state, `client/src/vendor/ui/kit/Dropdown.tsx:73`), hover its three items, close it by clicking the page heading.
**Say (s1-01):** "Це DevDigest. У другому уроці ми додали Skills Lab: скіли, агенти й конвенції. У сайдбарі секція SKILLS LAB має три пункти: Skills, Agents і Conventions. Починаємо зі сторінки Skills."
**Say (s1-02):** "Кожна картка: назва, тип, опис, перемикач, джерело, версія і кількість агентів. Чотири скіли API Contract Reviewer — breaking-change, response-schema, semver-discipline і deprecation-policy — мають позначку Imported, версію один і одного агента."
**Say (s1-03):** "Кнопка Add Skill відкриває меню з трьох дій: Create skill, Import from file та Import from URL."

## 2. Skill detail — repo-conventions, Preview and Versioning — 50 s
**Show:** click the `repo-conventions` card → `/skills/d9ca9088…?tab=preview` (list stays left, detail right).
**Do:** glide header chips; scroll the four rule sections; click **Versioning** (`?tab=` via `onTab`, `client/src/app/skills/[id]/page.tsx`; the tab issues a read-only GET of the versions, `useSkillVersions` in `client/src/features/skills/hooks.ts`); click **Diff** on v1 (`setView` state, `VersionsTab.tsx:29` and the Diff button handler; pure `lineDiff`, `VersionsTab/helpers.ts:23-58`); hover **Restore** (never click).
**Say (s2-01):** "Клік по картці repo-conventions відкриває скіл у бічній панелі: тип convention, джерело Extracted, версія два. Вкладка Preview показує відрендерене тіло."
**Say (s2-02):** "Тіло зібране з чотирьох прийнятих конвенцій neverthrow. Кожне правило — розділ з категорією, доказом у форматі файл:рядок та фрагментом коду: result-async.ts рядки двадцять два і пʼятдесят два, result.ts рядки сто сорок і один."
**Say (s2-03):** "Вкладка Versioning: дві версії. Перша, від першого жовтня, мала два правила; друга, поточна, — від четвертого. Diff показує зміни від першої до поточної, а Restore повернув би старе тіло як нову версію."

## 3. Import from URL — the dialog, Fetch preview, the warning, an imported skill — 50 s
**Show:** `/skills` → Add Skill → **Import from URL** (modal; `modal` state `SkillsListView.tsx:33`, URL mode is the `source` prop `ImportSkillModal.tsx:19`, `:34`).
**Do:** type `https://raw.githubusercontent.com/supermacro/neverthrow/master/README.md`; click **Fetch preview** (`previewUrl.mutate`, `ImportSkillModal.tsx:86`: `POST /skills/import-url/preview`, stores nothing); **scenes.mjs waits for the `No frontmatter` warning (15 s timeout) and fails the take if it is absent**; glide the three warnings and the disabled `Save skill`; close with the X. Then scroll to the `frontend-design` card.
**Say (s3-01):** "Імпорт з URL. У діалозі одне поле — адреса файлу. Сервер завантажує його сам, зберігає як недовірений текст і лишає скіл вимкненим, доки його не перевірять."
**Say (s3-02):** "Вставляємо посилання на README репозиторію neverthrow і тиснемо Fetch preview. Це лише превʼю — нічого не зберігається."
**Say (s3-03):** "Превʼю попереджає: No frontmatter — файл не схожий на SKILL.md. Поруч Type defaulted і Description missing, а Save skill неактивна, поки не заповнено опис. Закриваємо діалог."
**Say (s3-04):** "А це скіл, імпортований з URL раніше: frontend-design. Позначка Imported, версія один, нуль агентів, перемикач вимкнено."

## 4. Conventions page — the stored neverthrow scan — 60 s
**Show:** `/conventions` after the `dd-repo` pre-roll: heading, subtitle, ReScan, counter, Create skill, 10 cards.
**Do:** glide heading → subtitle → ReScan (hover) → `4 of 10 accepted` → Create skill (hover); card 1: rule, chip, `src/result-async.ts:125`, `85%`; card 2: `Accepted`; hover Accept / Reject / Edit on card 1. No clicks.
**Say (s4-01):** "Сторінка Conventions для neverthrow. Підзаголовок: знайдено з девʼяти файлів-зразків. Кнопка ReScan запустила б повторний аналіз; ми показуємо збережений результат."
**Say (s4-02):** "Лічильник: чотири з десяти прийнято. Поруч Create skill — кнопка зʼявляється, щойно прийнято хоча б одного кандидата."
**Say (s4-03):** "Кожна картка — правило, категорія, доказ — файл і номер рядка, фрагмент коду і впевненість. Перша: правило про tee-методи, категорія error handling, result-async.ts рядок сто двадцять пʼять, вісімдесят пʼять відсотків."
**Say (s4-04):** "У кожної картки три кнопки: Accept, Reject і Edit. Прийнята картка підсвічена і показує Accepted. За рішенням D17 відхилені картки зникають і не повертаються після повторного сканування — у скіл вони не потрапляють."

## 5. Evidence link → GitHub at the scan's commit — 20 s
**Show:** card 2's link `src/result-async.ts:22` (the kit `MonoLink` is `target=_blank`, so the scene reads its `href` and opens it with `web.open`), then the GitHub blob at `5ef3a018…#L22`.
**Do:** glide to the link, open the href, scroll to line 22 (`implements PromiseLike`).
**Say (s5-01):** "Доказ клікабельний: посилання веде на GitHub, у result-async.ts на коміті сканування, просто на рядок двадцять два, де ResultAsync реалізує PromiseLike."

## 6. API Contract experiment — PR #486 without vs with skills, two traces — 85 s
**Show:** `/repos/b5c1cf00…/pulls/486?tab=findings`: Timeline tiles, the expanded 17:20:42 review card with the CRITICAL finding; then the drawer `&trace=cc249084…`, then `&trace=066ebca1…`.
**Do:** glide the four tiles by time (16:07:26, 16:38:40, 17:18:59, 17:20:02); glide the finding title and `src/schemas/customers.ts:6`; open the with-skills drawer (URL), click **Prompt assembly** (`TraceSection` `useState`, `TraceSection.tsx:21`, `:25`), glide `Skills · 4 · ≈ 1909 tok (cl100k)` and the four rows; open the no-skills drawer (URL), click Prompt assembly, glide `System` and `User / diff (dynamic)`.
**Say (s6-01):** "Експеримент з API Contract Reviewer. PR чотириста вісімдесят шість робить поле Customer.email необовʼязковим і ламає контракт для всіх, хто читає Customer. Вкладка Agent runs: той самий агент, та сама модель."
**Say (s6-02):** "Без скілів, о шістнадцятій нуль сім і шістнадцятій тридцять вісім: один прогін — approve і нуль знахідок, другий — одна знахідка не по суті. Зі скілами, о сімнадцятій вісімнадцять і сімнадцятій двадцять: по одній знахідці, і це блокер."
**Say (s6-03):** "Знахідка: Breaking change — Customer.email made optional without mitigation, customers.ts рядок шість, впевненість девʼяносто пʼять відсотків."
**Say (s6-04):** "Трейс прогону зі скілами: двадцять три і шість десятих секунди, одна знахідка. У Prompt assembly окремий блок Skills: чотири скіли, приблизно тисяча девʼятсот девʼять токенів, по кожному — версія, джерело і токени."
**Say (s6-05):** "Трейс без скілів: тисяча пʼятсот вісімдесят дві секунди, тобто понад двадцять шість хвилин, сто тридцять дві тисячі токенів на виході, нуль знахідок. У Prompt assembly лише System і User — блоку Skills немає."

## 7. K6 — the generated skill in a real review, and the agent's Skills tab — 60 s
**Show:** `/repos/8269d0d3…/pulls/633?tab=findings&trace=8b81f86d…` (General Reviewer's run), then `/agents/6ca7b5bd…?tab=skills` (master-detail: the agents list with its skill counters stays in the left pane).
**Do:** glide the tile `17:58:38`; in the drawer glide `5.9s`, click Prompt assembly, glide `Skills · 1 · ≈ 313 tok (cl100k)` and the `repo-conventions v2` row; close; open the agent's Skills tab (`?tab=`, `client/src/app/agents/[id]/page.tsx:27-30`), glide `1 of 1 enabled`, the `repo-conventions` row (hover the switch, never click), the type label, the filter box, the "Drag enabled skills to reorder." paragraph; then the left-pane counters `1 skill` (General Reviewer) and `4 skills` (API Contract Reviewer).
**Say (s7-01):** "Згенерований скіл у реальному ревʼю. PR шістсот тридцять три в neverthrow: два змінені рядки в result.ts. General Reviewer: пʼять і девʼять десятих секунди, approve, нуль знахідок."
**Say (s7-02):** "У трейсі блок Skills: один скіл, repo-conventions, версія два, Extracted, приблизно триста тринадцять токенів. Саме це тіло з чотирма правилами агент отримав у промпті."
**Say (s7-03):** "Сторінка General Reviewer, вкладка Skills: усі скіли системи, у кожного перемикач і тип. Увімкнено лише один — repo-conventions. Є пошук, а перетягувати можна лише увімкнені."
**Say (s7-04):** "У списку агентів ліворуч: у General Reviewer тепер один скіл, у API Contract Reviewer — чотири."

(Scene 8, the Agents page, was cut for length on the user's review; its one fact —
the agent cards' skill counters — moved into s7-04, where the same counters are on
screen in the left pane. Scene ids stay as they are: s9 follows s7.)

## 9. GitHub — the spec's decisions, the server contract, the e2e flow — 45 s
**Show:** `https://github.com/vvysotsk/devDigest/blob/lesson-2/specs/HW02-conventions-and-api-contract.md#stage-2--conventions-extractor`, then `#stage-3--extras`, then `…/blob/lesson-2/server/specs/conventions.md`, then `…/blob/lesson-2/e2e/specs/09-conventions.flow.json`.
**Do:** scroll D14 → D20; jump to Stage 3 (D21, D22); open the server spec (its tables); open the flow JSON at the `Accept card 1 (#47)` step.
**Say (s9-01):** "Stage 2 специфікації фіксує рішення D14–D20: асинхронний скан, відбір зразків без моделі, перевірка доказів кодом, перенесення рішень між скануваннями. Stage 3 — D21, імпорт з URL, і D22 — план запуску на робочому репозиторії; запуск відклали."
**Say (s9-02):** "server/specs/conventions.md — контракт модуля: роути, гарантії і тести за іменами. e2e/specs/09-conventions.flow.json — браузерний сценарій: картки, Accept, Reject, Edit, перезавантаження і Create skill. На цьому все, дякую за увагу."

## Coverage

| Criterion | Scene | Cue |
|---|---|---|
| K1 demo video | — | this video |
| K2 open PR with a description | 9 (branch only) | s9-01 — the PR is not open yet; add a scene on `…/pull/<n>` once it exists |
| K3 extractor results in the UI | 4 | s4-01 … s4-04 |
| K4 1+ skills from accepted candidates; rejected never included | 2, 4 | s2-02, s4-04 |
| K5 evidence click → file on GitHub | 5 | s5-01 |
| K6 generated skill linked and run in a review | 7 | s7-01, s7-02 |
| K7 API reviewer with skills catches what it missed without | 6 | s6-02 … s6-05 |
| #6, #44 Agents / Conventions in SKILLS LAB | 1 | s1-01 |
| #7, #32 agent cards (skill counters) | 7 | s7-04 |
| #9, #22 skill cards: name, type, description, toggle, version, agent count | 1 | s1-02 |
| #11 Add → create or import | 1 | s1-03 |
| #13, #37 agent Skills tab: all skills, toggle, type label | 7 | s7-03 |
| #14 drag order = prompt order | 6 | s6-04 (the trace's Skills block lists the four skills in their link order; no drag is filmed — the user's live check) |
| #16, #43 four API skills, imported | 1 | s1-02 |
| #19 Skills block + its own tokens in the trace | 6 | s6-04 |
| #20 disabled / absent skill = no block | 6 | s6-05 (a run with no skills linked; the "disabled skill" variant is the recorded run 35178148, not filmed) |
| #25–#29 Preview, Versioning, Diff, Restore | 2 | s2-01 … s2-03 |
| #30 search in the agent Skills tab | 7 | s7-03 |
| #45 Run Scan / ReScan | 4 | s4-01 (ReScan shown; Run Scan exists only before the first scan) |
| #46 cards: rule, file, confidence | 4 | s4-03 |
| #47, #49 Accept / Reject / Edit, inline edit | 4 | s4-04 (buttons shown, not clicked) |
| #48 reject persists | 4 | s4-04 (narrated; see Unverified) |
| #50, #51 Create skill button and modal | 4 | s4-02 (button only; the modal was used in PREP, not filmed) |
| #52 the new skill on /skills | 1, 2 | s1-02 (card `Extracted v2`), s2-01 |
| X1a import from URL | 3 | s3-01 … s3-03 |
| `bc2c41d` no-frontmatter warning | 3 | s3-03 |
| docs: D14–D22, server contract, e2e flow | 9 | s9-01, s9-02 |

Not covered, by design: K2's PR (not open yet), X2 (not run), #8 and #14's live
checks (the user's checklist), #17 / #485 (declined), #53 Settings (never on screen).

## Narrated behaviour that is not an action on screen — proven by code

- s3-01 "лишає скіл вимкненим, доки його не перевірять": the dialog subtitle on screen
  says "left disabled until vetted"; the save is `enabled: false`
  (`server/src/modules/skills/service.ts:160`, URL import; `:116`, file import).
- s4-02 "кнопка зʼявляється, щойно прийнято хоча б одного кандидата":
  `ConventionsView.tsx:141-145` renders Create skill only when `accepted > 0`.
- s2-03 "Restore повернув би старе тіло як нову версію": `VersionsTab.tsx:36-45`
  sends `PUT /skills/:id { body }`; the server bumps and snapshots
  (`server/src/modules/skills/service.ts:130-142`).
- s7-03 "перетягувати можна лише увімкнені": the on-screen paragraph "Drag enabled
  skills to reorder." plus `SkillsTab/helpers.ts:58-60` (`isMovable`) and
  `SkillRow.tsx:43-61` (`draggable={movable}`).
- s4-04 "За рішенням D17 відхилені … не повертаються": carry-over by rule text or
  evidence location, `server/src/modules/conventions/helpers.ts:102-116`;
  `server/test/conventions.it.test.ts:317`, `:360`. No rejected card is on screen.
- s6-05 "тобто понад двадцять шість хвилин": 1582.6 s ÷ 60 = 26.4 min.

## Unverified claims

- s3-04 "імпортований з URL": the card chip reads `Imported` for both file and URL
  imports (`client/messages/en/skills.json:88-89`), and the skill page shows no origin
  URL (no column; `fetched_url` exists only in the preview contract). The claim rests
  on the DB `source: imported_url`.
- s2-02 / s7-02 "чотири правила": proven by the Preview frame (four `##` headings) and
  the PREP-2 API read; the trace frame shows `≈ 313 tok`, not the rule count.
- s6-02 "та одна знахідка не про те": the 16:38 run's finding ("Ambiguous checkout body
  schema …") is visible only if that review card is expanded; the scene glides the tile
  (`1 finding`), not the finding text.
- s9-01 lists what D14–D20 decide; the frame shows the headings, not every sentence.

## Product notes found during the reality check

- `/conventions` has no repo switcher: a fresh profile shows the first repo in the list
  (`repo-context.tsx` priority path > `localStorage` > first). Pre-roll needed.
- Both import sources render the same `Imported` chip; nothing shows the origin URL.
- The expanded review card's banner reads "1 findings · 1 blockers" (plural outside the
  ICU path, known from L01); the narration never quotes the banner.
- The `Agent runs` tab counter on PR #486 reads `6` while the Timeline lists 8 run tiles
  (the two A' runs of 2026-09-29 are counted differently); not narrated.
- Two time columns differ on PR #486: a Timeline tile shows the run's start (`16:07:26`),
  the review card its completion (`16:33:48`). The narration names runs by tile time.
