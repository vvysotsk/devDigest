# L01 — Run cost badge

Show what each agent run costs. Usage (`prompt_tokens` / `completion_tokens`)
is already returned by the providers and summed by `reviewer-core`
(`ReviewOutcome.tokensIn/tokensOut/costUsd`); this feature persists it and
surfaces it. **Zero additional LLM calls.**

## Surfaces

| Surface | Shows | Empty state |
|---|---|---|
| PR list — COST column | latest review batch sum, compact `$0.012` | `—` |
| PR detail — Agent runs timeline | per settled run `$0.0014 · 8.2k→1.3k` | nothing on running/failed rows |
| Run trace drawer — Stats | 4th tile COST (`$0.06`) | `—` |

## Semantics

- **Batch** = the runs created by one "Run review" action; they share
  `agent_runs.batch_id` (one uuid per `ReviewService.runReview`). The PR-list
  cost sums the **latest** batch only. Legacy rows without `batch_id` degrade
  to "the latest run alone is the batch".
- **Persisted cost**: `agent_runs.cost_usd` is written at run completion with
  the engine's value — OpenRouter's real `usage.cost` when present, else the
  injected PriceBook estimate; `null` when unknown.
- **Read-time fallback** (`modules/_shared/run-cost.ts` → `resolveRunCost`):
  rows without stored cost get `tokens × PriceBook` — but only settled
  (`done`) runs with real token usage. Everything else resolves to `null`.
- A run without usage data shows **`—`, never `$0.00`**. A genuine stored `0`
  (free model) shows `$0.00`.
- Old `run_traces` docs lack `stats.cost_usd` (nullish in the contract); the
  trace route backfills it on read from the `agent_runs` row without
  re-persisting.

## Contracts

- `PrMeta.cost_usd` (nullish) — list endpoint only, latest-batch sum.
- `RunSummary.cost_usd` (nullable) — stored or estimated per run.
- `RunStats.cost_usd` (nullish) — trace stats.

## Client

`client/src/components/run-cost-badge/` — `RunCostBadge` (variants `cost`,
`costTokens`) + `formatCost` / `formatTokensCompact`, reused by the PR list
(`PRRow`), the timeline (`RunHistory`), and the trace drawer (`TraceBody`).
