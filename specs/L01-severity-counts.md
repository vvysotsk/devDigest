Status: done

# L01 — Findings by severity: counters, filter, previews

Every surface that today says "15 finding(s) · 1 blockers" gets the breakdown
"3 CRITICAL · 5 WARNING · 2 SUGGESTION". The numbers are a plain COUNT over the
already-persisted `findings.severity` column (`CRITICAL | WARNING | SUGGESTION`,
see `contracts/findings.ts`). **Zero additional LLM calls** — opening a page or
toggling a filter never hits `/review`.

## Surfaces

| Surface | Shows | Empty state | Stage |
|---|---|---|---|
| PR detail — Review runs card (expanded) | pills row under the VerdictBanner + one filter chip per present severity | no pills, no chips, only the "Hide low confidence" toggle | A |
| PR list — FINDINGS column | icon+count per severity of the **latest batch**; hover/focus → read-only popover titled "N findings in this run" (fetch error → inline error text) | `—` | B |
| PR detail — Timeline tile | icon+count per severity (+ "· N blockers"); hover → the same popover ("N findings in this run"), wrapping only the icons so the agent-name click still jumps to the review card | plain "N findings" when no review matches the run (legacy / deleted review) | C |
| Run trace drawer — Findings section | pills row + read-only previews in `full` mode (whole rationale + "Suggested fix:") | "No findings for this run." | C |

## Semantics

- **Counting** is `countBySeverity(findings)` from
  `client/src/components/severity-summary` — one function for every surface.
- **Review runs card**: pills count the findings visible **after** the
  "Hide low confidence" toggle and **before** the severity filter, so the number
  on a pill always equals the finding cards of that severity rendered below.
  Dismissed/accepted findings are counted (their cards still render).
- **Severity filter** is client-side state only. Chips exist only for
  severities with ≥1 (visible) finding; click = keep only that severity, click
  again = clear. A filter whose severity has no visible findings (e.g. after
  hiding low confidence) is *derived* back to "no filter" — nothing is stored.
- **PR list / Timeline / Trace drawer** count **all** findings of the run(s);
  there is no confidence toggle on those surfaces.
- **PR list scope** = the latest batch (`batch_id` of the most recent "Run
  review"; legacy rows without `batch_id` degrade to "the latest run alone").
  This is a FINDINGS-only rule — the COST column sums every settled run of the
  PR regardless of batch (`specs/L01-run-cost.md`).

## Contracts

- `PrMeta.latest_batch` (nullish, list endpoint only) —
  `{ run_ids: string[], findings_by_severity: { CRITICAL, WARNING, SUGGESTION } }`.
  `null` until the PR has at least one run. `run_ids` lets the client narrow
  `GET /pulls/:id/reviews` to the same batch for the popover.
- Server: `modules/_shared/latest-batch.ts` — `groupLatestBatches` (the
  latest-batch `run_ids`, including the legacy "no batch_id" rule) and
  `countFindingsBySeverity`; `sumSettledRunCost` lives next to them but feeds
  the COST column only. All hermetic-tested in `test/latest-batch.test.ts`,
  end-to-end in `reviews.it.test.ts` ("L01 severity counts").

## Client

- `client/src/components/severity-summary/` — `SeveritySummary` (variants
  `icons`, `pills`) + `countBySeverity` / `presentSeverities` / `totalFindings`.
  Severity is typed from `@devdigest/shared` (three values), not from the UI
  kit's `Severity` (which also has INFO).
- `FindingsPanel` (`[number]/_components/FindingsPanel`) — pills + chips +
  `visibleFindings(findings, hideLow, severity)`.
- UI kit `Chip` gained optional `pressed` (renders `aria-pressed`) and `title`.
- `client/src/components/findings-preview/` — `FindingPreview` (read-only
  row), `FindingsPopover` (`position: fixed`, clamped to the viewport; list
  containers clip overflow so `absolute` would be cut off) and
  `FindingsHoverCard` (trigger: hover after `openDelayMs` or focus; closes on
  leave with a 100 ms grace, blur, Escape, resize and outer scroll — scrolls
  inside the popover are ignored).
- PR list `FindingsCell` — counts from `latest_batch`; the popover opens and
  `usePrReviews(prId, { enabled })` fires only after the pointer has settled
  for `HOVER_INTENT_MS` (180 ms), immediately on keyboard focus.
- Timeline `RunHistory` takes `reviews` (from `FindingsTab`'s `runs` prop —
  note the naming trap: `runs` there is `ReviewRecord[]`, `prRuns` is
  `RunSummary[]`) and matches findings to runs by `run_id`; `runStatus.*`
  strings use ICU plurals ("1 blocker", never "1 blockers").
- Trace drawer `FindingsSection` renders the pills row + `FindingPreview` per
  finding (sorted by severity); its findings come from the reviews list via
  the drawer's `findings` prop, not from the trace document.
- PR list narrow layout (viewport 1024–1185px, `NARROW_MAX_WIDTH`, CSS media
  query on `.pr-list` in `app/globals.css` feeding CSS variables that the
  inline styles consume): every column narrows (`GRID_NARROW`), gaps/paddings
  and the table margin shrink, FINDINGS chips drop their numbers (kept in the
  tooltip / popover title) and wrap inside the column, the author name is
  truncated and the status badge may wrap — rows grow in height instead of
  columns bleeding into each other. Above 1185px the original layout (`GRID`)
  is untouched.

## Deviations from the acceptance criteria

- Pills on the run card respect "Hide low confidence" (so the counter always
  equals the cards below); the criteria did not mention the toggle.
- Filter chips for severities with zero findings are hidden; the criteria say
  "three buttons".
- The finding card's second action is **Dismiss**, not Reject — that is the
  name already used by the API (`/findings/:id/dismiss`) and the DB
  (`dismissed_at`).
- PR-list counters are partial while the latest batch is still running (runs
  in flight have no review yet); they settle on the next list refetch.
