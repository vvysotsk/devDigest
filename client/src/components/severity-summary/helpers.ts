import type { FindingRecord, Severity } from "@devdigest/shared";

/**
 * Display order of the three CONTRACT severities. Typed from `@devdigest/shared`
 * on purpose: the UI kit's `Severity` also has INFO, which is never a finding.
 */
export const SEVERITIES = ["CRITICAL", "WARNING", "SUGGESTION"] as const satisfies readonly Severity[];

export type FindingsBySeverity = Record<Severity, number>;

export function emptyCounts(): FindingsBySeverity {
  return { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
}

/** Plain COUNT by severity — no LLM, no network; unknown values are ignored. */
export function countBySeverity(
  findings: readonly Pick<FindingRecord, "severity">[],
): FindingsBySeverity {
  const counts = emptyCounts();
  for (const f of findings) {
    if (f.severity in counts) counts[f.severity] += 1;
  }
  return counts;
}

/** Severities with at least one finding, in display order. */
export function presentSeverities(counts: FindingsBySeverity): Severity[] {
  return SEVERITIES.filter((sev) => counts[sev] > 0);
}

export function totalFindings(counts: FindingsBySeverity): number {
  return SEVERITIES.reduce((n, sev) => n + counts[sev], 0);
}
