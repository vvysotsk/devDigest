import type { FindingRecord } from "@devdigest/shared";
import { SEVERITIES } from "@/components/severity-summary";

/** "12" or "45-52" — the line span shown next to the file path. */
export function lineLabel(f: Pick<FindingRecord, "start_line" | "end_line">): string {
  return f.end_line !== f.start_line ? `${f.start_line}-${f.end_line}` : `${f.start_line}`;
}

/** Stable sort CRITICAL → WARNING → SUGGESTION; unknown severities last. */
export function sortBySeverity<T extends Pick<FindingRecord, "severity">>(findings: readonly T[]): T[] {
  const rank = (s: string) => {
    const i = (SEVERITIES as readonly string[]).indexOf(s);
    return i === -1 ? SEVERITIES.length : i;
  };
  return [...findings].sort((a, b) => rank(a.severity) - rank(b.severity));
}
