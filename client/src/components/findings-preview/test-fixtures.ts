import type { FindingRecord } from "@devdigest/shared";

/** Test-only FindingRecord factory (not a test file — safe to import from tests). */
export function finding(o: Partial<FindingRecord> & { id: string }): FindingRecord {
  return {
    severity: "WARNING",
    category: "perf",
    title: `Finding ${o.id}`,
    file: "src/api/users.ts",
    start_line: 45,
    end_line: 52,
    rationale: "The loop on line 46 calls db.posts.findMany once per user.",
    suggestion: null,
    confidence: 0.86,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
    ...o,
  };
}
