/**
 * PR-list aggregations over agent_runs, shared by the pulls module (and
 * anything else that needs the same rules) — pulls may not import from
 * modules/reviews, so this lives in _shared.
 *
 * Two DIFFERENT rules feed the PR list:
 *  - FINDINGS column → the LATEST BATCH: the runs created by ONE "Run review"
 *    action (shared `batch_id`; legacy rows persisted before `batch_id`
 *    existed degrade to "the latest run alone is the batch").
 *  - COST column → the sum of EVERY settled (`status = 'done'`) run of the PR,
 *    regardless of batch (criterion 12).
 */
import type { FindingsBySeverity } from '@devdigest/shared';
import { resolveRunCost, type CostableRun } from './run-cost.js';

export type BatchRunRow = CostableRun & {
  id: string;
  /** Null on set-null rows from a deleted PR — such runs are skipped. */
  prId: string | null;
  batchId: string | null;
};

export interface LatestBatch {
  /** Run ids of the batch, newest-first. */
  runIds: string[];
}

export type EstimateFn = (model: string, tokensIn: number, tokensOut: number) => number | null;

/**
 * Group runs into the latest batch per PR. `runRows` MUST be newest-first: the
 * first row seen per PR fixes that PR's batch.
 */
export function groupLatestBatches(runRows: readonly BatchRunRow[]): Map<string, LatestBatch> {
  const heads = new Map<string, { batchId: string | null; consumedLegacy: boolean }>();
  const out = new Map<string, LatestBatch>();
  for (const run of runRows) {
    if (!run.prId) continue;
    let head = heads.get(run.prId);
    if (!head) {
      head = { batchId: run.batchId, consumedLegacy: false };
      heads.set(run.prId, head);
      out.set(run.prId, { runIds: [] });
    }
    let inBatch: boolean;
    if (head.batchId != null) {
      inBatch = run.batchId === head.batchId;
    } else {
      inBatch = !head.consumedLegacy;
      head.consumedLegacy = true;
    }
    if (inBatch) out.get(run.prId)!.runIds.push(run.id);
  }
  return out;
}

/**
 * Sum of the resolvable cost of ALL settled (`status = 'done'`) runs per PR.
 * The status check is explicit: `resolveRunCost` lets a STORED cost win even
 * on a failed run (correct for the run history, where a failed call may still
 * have been billed), but the PR-list total only counts successful runs. A PR
 * is absent from the result when none of its settled runs resolved to a cost —
 * the list shows "—".
 */
export function sumSettledRunCost(
  runRows: readonly BatchRunRow[],
  estimate: EstimateFn,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const run of runRows) {
    if (!run.prId || run.status !== 'done') continue;
    const cost = resolveRunCost(run, estimate);
    if (cost == null) continue;
    out.set(run.prId, (out.get(run.prId) ?? 0) + cost);
  }
  return out;
}

export function emptyFindingsBySeverity(): FindingsBySeverity {
  return { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
}

/**
 * COUNT findings by severity per PR. `rows` are the findings of the latest
 * batches' reviews, already joined to their PR; severities outside the contract
 * enum are ignored. PRs absent from `rows` are simply absent from the result —
 * callers fall back to `emptyFindingsBySeverity()` for a batch without findings.
 */
export function countFindingsBySeverity(
  rows: readonly { prId: string; severity: string }[],
): Map<string, FindingsBySeverity> {
  const out = new Map<string, FindingsBySeverity>();
  for (const row of rows) {
    let counts = out.get(row.prId);
    if (!counts) {
      counts = emptyFindingsBySeverity();
      out.set(row.prId, counts);
    }
    if (row.severity in counts) counts[row.severity as keyof FindingsBySeverity] += 1;
  }
  return out;
}
