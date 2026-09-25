/**
 * Read-time cost resolution for agent runs, shared by the reviews module
 * (run history, trace) and the pulls module (PR-list batch sum) — pulls may
 * not import from modules/reviews, so this lives in _shared.
 */

export type CostableRun = {
  costUsd: number | null;
  status: string | null;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
};

/**
 * The stored cost wins — including a genuine 0 from a free model. The
 * fallback estimate (tokens × PriceBook) applies only to SETTLED runs with
 * real usage, so a run without data resolves to null (the UI's "—"), never
 * to a fabricated $0.00.
 */
export function resolveRunCost(
  run: CostableRun,
  estimate: (model: string, tokensIn: number, tokensOut: number) => number | null,
): number | null {
  if (run.costUsd != null) return run.costUsd;
  const tokensIn = run.tokensIn ?? 0;
  const tokensOut = run.tokensOut ?? 0;
  if (run.status !== 'done' || !run.model || tokensIn + tokensOut === 0) return null;
  return estimate(run.model, tokensIn, tokensOut);
}
