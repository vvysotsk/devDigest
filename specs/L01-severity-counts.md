Status: in-progress

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
| PR list — FINDINGS column | icon+count per severity of the **latest batch**; hover/focus → read-only popover "N FINDINGS IN THIS RUN" | `—` | B |
| PR detail — Timeline tile | icon+count per severity (+ "· N blockers"); hover → the same popover | legacy text "N findings" when no review matches the run | C |
| Run trace drawer — Findings section | pills row + read-only previews | "No findings for this run." | C |

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
- **PR list scope** = the latest batch (same `batch_id` rule as the COST column;
  legacy rows without `batch_id` degrade to "the latest run alone").

## Contracts

- Stage A: none (pure client).
- Stage B: `PrMeta.latest_batch` (nullish) — `{ run_ids, findings_by_severity }`,
  list endpoint only.

## Client

- `client/src/components/severity-summary/` — `SeveritySummary` (variants
  `icons`, `pills`) + `countBySeverity` / `presentSeverities` / `totalFindings`.
  Severity is typed from `@devdigest/shared` (three values), not from the UI
  kit's `Severity` (which also has INFO).
- `FindingsPanel` (`[number]/_components/FindingsPanel`) — pills + chips +
  `visibleFindings(findings, hideLow, severity)`.
- UI kit `Chip` gained optional `pressed` (renders `aria-pressed`) and `title`.

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
