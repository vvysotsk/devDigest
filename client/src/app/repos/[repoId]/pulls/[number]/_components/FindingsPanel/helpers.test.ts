/**
 * visibleFindings — the severity filter is applied AFTER the confidence toggle,
 * so counters computed with `severity = null` match the cards shown per severity.
 */
import { describe, it, expect } from "vitest";
import type { FindingRecord } from "@devdigest/shared";
import { visibleFindings } from "./helpers";

function f(id: string, severity: FindingRecord["severity"], confidence: number): FindingRecord {
  return {
    id,
    severity,
    category: "bug",
    title: id,
    file: "a.ts",
    start_line: 1,
    end_line: 1,
    rationale: "",
    suggestion: null,
    confidence,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r",
    accepted_at: null,
    dismissed_at: null,
  };
}

const ALL = [f("s1", "SUGGESTION", 0.9), f("w-low", "WARNING", 0.4), f("c1", "CRITICAL", 0.8), f("w1", "WARNING", 0.7)];

describe("visibleFindings", () => {
  it("no filters → everything, sorted CRITICAL → WARNING → SUGGESTION", () => {
    expect(visibleFindings(ALL, false).map((x) => x.id)).toEqual(["c1", "w-low", "w1", "s1"]);
  });

  it("severity filter keeps only that severity", () => {
    expect(visibleFindings(ALL, false, "WARNING").map((x) => x.id)).toEqual(["w-low", "w1"]);
  });

  it("hideLow applies before the severity filter", () => {
    expect(visibleFindings(ALL, true, "WARNING").map((x) => x.id)).toEqual(["w1"]);
    expect(visibleFindings(ALL, true, "CRITICAL").map((x) => x.id)).toEqual(["c1"]);
  });

  it("does not mutate the input order", () => {
    const copy = [...ALL];
    visibleFindings(ALL, false, null);
    expect(ALL).toEqual(copy);
  });
});
