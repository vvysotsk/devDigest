# Entry examples — weak vs strong

Every "weak" entry fails the gate (*"would an agent new to this area repeat
this mistake?"*) or is not actionable cold / has no `path:line`. Every "strong"
entry names the place, the line and the alternative.

## Real ones from this repo

**Weak:** `- 2026-09-24: Implemented PR-list cost as a sum of settled runs.` (history, not a lesson)
**Strong:** `- 2026-09-24: resolveRunCost() returns the STORED cost for any status, including failed/cancelled runs — its 'done' check only guards the token estimate. Any "successful runs only" sum must filter status === 'done' itself (evidence: src/modules/_shared/run-cost.ts:28, src/modules/_shared/latest-batch.ts:71; first test run counted a failed run's cost).`

**Weak:** `- 2026-09-24: Popovers in the PR list can be clipped.` (no place, no fix)
**Strong:** `- 2026-09-24: A popover inside the PR list must be position: fixed — tableCard has overflow: hidden and clips absolute children; close it on window scroll, but ignore scroll events whose target is inside the popover (evidence: src/app/repos/[repoId]/pulls/styles.ts:91, src/components/findings-preview/FindingsHoverCard.tsx).` → still missing a line in the second file: find it before writing.

## Vague → useful

**Weak:** `- 2026-09-18: Promises can be tricky.`
**Strong:** `- 2026-09-18: Promise.all() on the ingestion pipeline times out past ~30 items — use Promise.allSettled() with batches of 10 (evidence: src/modules/polling/service.ts:<line>).`

**Weak:** `- 2026-09-18: Watch out for the DB on first run.`
**Strong:** `- 2026-09-18: "relation ... does not exist" on a fresh clone means migrations didn't run — the server never migrates on boot; run pnpm db:migrate (evidence: src/server.ts:<line> has no migrate call).`

## Session Notes entry

```
- 2026-09-18: Added CLAUDE.md/INSIGHTS scaffolding across all packages; confirmed shared-contracts drift with a real diff (5 files).
```

## Correcting an earlier entry (append-only)

Never edit the old line — append a dated note that points at it:

```
- 2026-06-02: octokit paginate loses the last page when per_page=100 (evidence: pulls import bug).
- 2026-09-18: UPDATE to 2026-06-02 entry — fixed upstream in octokit 6.1.6; the workaround (per_page=50) is no longer needed.
```

## Resolving a contradiction

```
- 2026-05-11: Always run e2e against the hermetic stack.
- 2026-07-30: Run e2e against the dev stack for faster iteration.
- 2026-09-18: RESOLUTION — hermetic (npm run e2e:hermetic) is the default and the only mode allowed in CI; the dev-stack mode is for local flow-authoring only.
```
