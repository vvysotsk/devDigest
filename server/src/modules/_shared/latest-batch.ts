/**
 * "Latest batch" grouping for the PR list, shared by the pulls module (and
 * anything else that needs the same rule) — pulls may not import from
 * modules/reviews, so this lives in _shared.
 *
 * A batch = the runs created by ONE "Run review" action (shared `batch_id`).
 * Legacy rows persisted before `batch_id` existed degrade to "the latest run
 * alone is the batch". Both the COST column and the FINDINGS column of the PR
 * list derive from this same grouping so they never disagree.
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
  /** Sum of the batch's resolvable run costs; null when no run had usage data. */
  costUsd: number | null;
}

export type EstimateFn = (model: string, tokensIn: number, tokensOut: number) => number | null;

/**
 * Group runs into the latest batch per PR. `runRows` MUST be newest-first: the
 * first row seen per PR fixes that PR's batch.
 */
export function groupLatestBatches(
  runRows: readonly BatchRunRow[],
  estimate: EstimateFn,
): Map<string, LatestBatch> {
  const heads = new Map<string, { batchId: string | null; consumedLegacy: boolean }>();
  const out = new Map<string, LatestBatch>();
  for (const run of runRows) {
    if (!run.prId) continue;
    let head = heads.get(run.prId);
    if (!head) {
      head = { batchId: run.batchId, consumedLegacy: false };
      heads.set(run.prId, head);
      out.set(run.prId, { runIds: [], costUsd: null });
    }
    let inBatch: boolean;
    if (head.batchId != null) {
      inBatch = run.batchId === head.batchId;
    } else {
      inBatch = !head.consumedLegacy;
      head.consumedLegacy = true;
    }
    if (!inBatch) continue;
    const batch = out.get(run.prId)!;
    batch.runIds.push(run.id);
    const cost = resolveRunCost(run, estimate);
    if (cost != null) batch.costUsd = (batch.costUsd ?? 0) + cost;
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
