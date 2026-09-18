# Entry examples — vague vs useful

The quality gate in practice. Every "bad" entry fails the test *"if this would
be obvious to anyone reading the code — don't write it"* or is not actionable
cold; every "good" entry names the concrete place and the alternative.

## Vague → useful

**Bad:** `- 2026-09-18: Promises can be tricky.`
**Good:** `- 2026-09-18: Promise.all() on the ingestion pipeline times out past ~30 items — use Promise.allSettled() with batches of 10 (evidence: server/src/modules/polling/service.ts)`

**Bad:** `- 2026-09-18: Be careful with async state.`
**Good:** `- 2026-09-18: Checkout-flow state must go through the shared store (cartStore.ts) — the cart is shared by 3 components, local state desyncs them.`

**Bad:** `- 2026-09-18: The shared contracts can drift.`
**Good:** `- 2026-09-18: Before touching @devdigest/shared, diff the two copies — they already differ in 5 files (adapters.ts, contracts/eval-ci.ts, knowledge.ts, productionize.ts, trace.ts); mirror only what your change touches (evidence: diff -rq server/src/vendor/shared client/src/vendor/shared).`

**Bad:** `- 2026-09-18: Watch out for the DB on first run.`
**Good:** `- 2026-09-18: "relation ... does not exist" on a fresh clone means migrations didn't run — the server never migrates on boot; run cd server && pnpm db:migrate.`

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
