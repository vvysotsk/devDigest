/**
 * Compact USD formatting for run cost. null/undefined means "no data" and
 * renders as "—" — a genuine stored 0 (free model) renders "$0.00" instead.
 */
export function formatCost(usd: number | null | undefined): string {
  if (usd == null) return "—";
  if (usd === 0) return "$0.00";
  const dp = usd >= 0.1 ? 2 : usd >= 0.01 ? 3 : 4;
  let out = usd.toFixed(dp);
  // Trim trailing zeros down to cents ($0.060 → $0.06, $1.50 stays).
  while (out.endsWith("0") && out.split(".")[1]!.length > 2) out = out.slice(0, -1);
  return `$${out}`;
}
