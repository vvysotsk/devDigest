# Demo devdigest-l01 — shooting script

~4.5 min. Filmed by `demo-film` from `cues.json`; this file is the human view.
Narration is Ukrainian; everything else here stays English.

## Assumptions

- Browser-only video (Windows): files are shown rendered on GitHub, branch `lesson-1`,
  which must be pushed before filming.
- The data PR is `burnjohn/quick-blog` #12 (stale; three settled runs, 22 findings).
- Voice: `edge` provider, `uk-UA-PolinaNeural` or `uk-UA-OstapNeural` — chosen by ear
  during `demo-film`.

## Preconditions

- app up: studio :3000, API :3001 (`./scripts/dev.sh`), Postgres in Docker
- data on screen: repo `burnjohn/quick-blog`, PR #12 with runs Performance / Security /
  General Reviewer, nothing running
- `git push origin lesson-1` done; https://github.com/vvysotsk/devDigest is public
- staged Chrome: Do Not Disturb on, pointer parked bottom-right

## 1. PR list — COST and FINDINGS columns — 35 s
**Show:** `/repos/8dad2132-…/pulls?status=stale` — one row, PR #12.
**Do:** glide across the row to FINDINGS (3 / 17 / 2) and COST ($0.021).
**Say (s1-01):** "Це DevDigest, локальна студія AI-ревʼю pull request-ів. У першому уроці ми додали вартість прогонів і лічильники знахідок за severity. Починаємо зі списку Pull Requests."
**Say (s1-02):** "Колонка COST показує нуль крапка нуль два один долара. Це сума вартості всіх успішних прогонів цього PR, а не останнього. Якщо прогонів немає, клітинка порожня."
**Say (s1-03):** "Колонка FINDINGS показує три critical, сімнадцять warning і дві suggestion. Це знахідки останнього запуску ревʼю, згруповані за severity."

## 2. PR list — the popover — 30 s
**Show:** the same row.
**Do:** hover the severity icons, hold, move straight down into the popover, scroll it slowly.
**Say (s2-01):** "Наводимо курсор на іконки в колонці FINDINGS. Зʼявляється попап із заголовком «двадцять два findings in this run»."
**Say (s2-02):** "Кожне превʼю тут лише для читання: іконка severity, заголовок, категорія, файл і рядок, відсоток confidence і короткий опис. Жодних кнопок."

## 3. PR page — Timeline with cost per run — 35 s
**Show:** `/repos/…/pulls/12?tab=findings` — the "Agent runs" tab, Timeline section on top.
**Do:** glide over the three run tiles, pausing on each cost.
**Say (s3-01):** "Відкриваємо PR і вкладку Agent runs. Зверху Timeline: прогони й коміти в хронології, найновіші згори."
**Say (s3-02):** "Кожна плитка прогону показує свою вартість і токени: Performance Reviewer нуль крапка нуль нуль три чотири долара, Security Reviewer нуль крапка нуль один три, General Reviewer нуль крапка нуль нуль пʼять. Разом це і є ті нуль крапка нуль два один зі списку."
**Say (s3-03):** "На плитках теж є іконки severity, але без кліку. Лічильники, які рахує критерій, живуть нижче, у секції Review runs."

## 4. Review runs — pills, filter, Accept and Reject — 75 s
**Show:** the expanded Performance Reviewer card: VerdictBanner, PR SCORE, pills row, toggle, three chips, finding cards.
**Do:** glide to the pills; toggle "Hide low confidence" on and off; click Critical, then click it again; hover Accept / Reject on the first card (never click).
**Say (s4-01):** "Секція Review runs: по картці на прогін, перша розгорнута. Під вердиктом і PR SCORE рядок пілюль: одна critical, чотирнадцять warning. Пілюля suggestion не показана, бо таких знахідок у цьому прогоні немає."
**Say (s4-02):** "Числа рахуються простим групуванням уже збережених findings за полем severity. Жодного звернення до LLM ні при відкритті сторінки, ні при перемиканні фільтра."
**Say (s4-03):** "Число на пілюлі дорівнює кількості карток нижче. Вмикаємо Hide low confidence: чотирнадцять warning мають confidence нижче шістдесяти пʼяти відсотків і ховаються, лишається одна картка, і пілюля показує одну critical."
**Say (s4-04):** "Вимикаємо тумблер. Під пілюлями три кнопки-фільтри: Critical, Warning, Suggestion. Suggestion неактивна, бо їй нема що показати. Клік по Critical лишає лише картки цього рівня, повторний клік знімає фільтр."
**Say (s4-05):** "У кожної картки знахідки тут є кнопки Accept і Reject. Це інше місце, ніж попап у списку PR: там лише читання, тут рішення."

## 5. Trace drawer — Stats and Findings — 35 s
**Show:** `…/pulls/12?tab=findings&trace=632a135c-…` — the drawer for the Security Reviewer run.
**Do:** glide over the Stats tiles to COST, then down to the Findings section.
**Say (s5-01):** "Кнопка «Open run trace and logs» на плитці відкриває сайдбар трасування. У блоці Stats окрема плитка COST: нуль крапка нуль один три долара, поруч тривалість, токени і кількість знахідок."
**Say (s5-02):** "Нижче секція Findings: пілюлі одна warning і одна suggestion, і самі знахідки з повним описом і suggested fix. Тобто в сайдбарі видно не лише статистику, а й знахідки."

## 6. GitHub — CLAUDE.md — 50 s
**Show:** `https://github.com/vvysotsk/devDigest/blob/lesson-1/CLAUDE.md`.
**Do:** scroll section by section: Map, Commands, Stack, Verification, Naming conventions, Do not touch.
**Say (s6-01):** "Тепер файли проєкту. Кореневий CLAUDE.md: розділ Map описує структуру монорепо, чотири пакети і роль кожного. Commands дає команди запуску та міграцій."
**Say (s6-02):** "Таблиця Stack перелічує мову, фреймворк і ключові бібліотеки кожного пакета, а Verification команди typecheck і тестів по пакетах. Лінтер не налаштований, і це сказано явно."
**Say (s6-03):** "Naming conventions окремим розділом: компоненти, хуки, модулі сервера, тести, i18n, коміти. Do not touch явно закриває міграції разом із journal і snapshot, і всі чотири lock-файли."

## 7. GitHub — engineering-insights skill and INSIGHTS.md — 45 s
**Show:** `…/blob/lesson-1/.claude/skills/engineering-insights/SKILL.md`, then `…/blob/lesson-1/client/INSIGHTS.md`.
**Do:** show the skill frontmatter, then scroll INSIGHTS.md to the dated entries.
**Say (s7-01):** "Скіл engineering-insights лежить у .claude/skills. Його description каже, коли він спрацьовує сам: невдалий тест, виправлення від користувача, друга спроба, несподівана поведінка інструмента, і обовʼязково перед кожним комітом."
**Say (s7-02):** "Записи йдуть в INSIGHTS.md того модуля, де була робота. Ось client/INSIGHTS.md: кожен запис має дату і доказ у вигляді path і рядка, наприклад styles.ts, рядки девʼяносто сім по сто пʼять."

## 8. GitHub — docs/specs per package and the workflow — 45 s
**Show:** `…/tree/lesson-1/server/docs` and `…/blob/lesson-1/server/CLAUDE.md` (Read when), then `…/pull/1`.
**Do:** show the docs and specs folders, the Read when section, then the PR description with the five phases.
**Say (s8-01):** "У кожного пакета свої docs і specs: docs пояснює архітектуру і потік даних, наприклад server/docs/architecture.md, specs фіксує контракт, який має лишатись правдивим, наприклад server/specs/review-flow.md. CLAUDE.md пакета посилається на них у розділі Read when."
**Say (s8-02):** "І сам pull request уроку. В описі пʼять фаз: Initiation, Planning, Implementation, Validation, Completion, з комітами кожної фази. На цьому все, дякую за увагу."

## Coverage

| Criterion | Scene | Cue |
|---|---|---|
| 1 stack | 6 | s6-02 |
| 2 monorepo structure | 6 | s6-01 |
| 3 run commands | 6 | s6-01 |
| 4 verification commands | 6 | s6-02 |
| 5 naming conventions | 6 | s6-03 |
| 6 do not touch: migrations | 6 | s6-03 |
| 7 do not touch: lock files | 6 | s6-03 |
| 8 engineering-insights skill exists | 7 | s7-01 |
| 9 skill fires on its own | 7 | s7-01 (description only — see Unverified) |
| 10 entries in the module's INSIGHTS.md | 7 | s7-02 |
| 11 date + file:line per entry | 7 | s7-02 |
| 12 cost in PR list | 1 | s1-02 |
| 13 cost per run in Timeline | 3 | s3-02 |
| 14 COST tile in trace drawer | 5 | s5-01 |
| 15 five-phase cycle | 8 | s8-02 |
| 16 severity pills in Review runs | 4 | s4-01 |
| 17 pills equal cards | 4 | s4-03 |
| 18 severity filter chips | 4 | s4-04 |
| 19 no LLM call for the counts | 4 | s4-02 (claim — see Unverified) |
| 20 popover "N findings in this run" | 2 | s2-01 |
| 21 read-only previews in the popover | 2 | s2-02 |
| 22 Accept / Reject on the PR page | 4 | s4-05 |
| 23 findings in the trace drawer | 5 | s5-02 |
| 24 docs/ and specs/ per package | 8 | s8-01 |

## Unverified claims

- s4-02 "no LLM call": true by construction (`countBySeverity` over persisted findings), but
  no frame proves the absence of a request. Could be shown with the Network tab; not planned.
- s7-01 "fires on its own": the frame shows the skill's description, not a session where it
  fired. The INSIGHTS entries in s7-02 are the indirect evidence.
- s3-02 "together this is the 0.021": the sum of the *stored* values (0.00336 + 0.01273 +
  0.00501 = 0.02110) rounds to $0.021; the *printed* per-run values sum to 0.0214. The
  narration says "разом", not an exact addition.
- s8-01 names only the server package; client, reviewer-core and e2e have the same layout
  (`client/docs/ui-architecture.md`, `client/specs/pages.md`, …) but are not shown.

## Product notes found during the reality check

- The VerdictBanner inside the expanded card reads "15 findings · 1 blockers" while the
  accordion header reads "1 blocker" — a plural string outside the ICU-plural path. The
  narration does not quote the blocker count.
