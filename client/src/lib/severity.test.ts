/**
 * Severity helpers — counts are a plain COUNT over the findings' severity field;
 * display order is always CRITICAL → WARNING → SUGGESTION.
 */
import { describe, it, expect } from "vitest";
import { countBySeverity, presentSeverities, totalFindings, emptyCounts, sortBySeverity } from "./severity";
import { finding } from "@/components/findings-preview/test-fixtures";

const sev = (s: string) => ({ severity: s as "CRITICAL" | "WARNING" | "SUGGESTION" });

describe("countBySeverity", () => {
  it("counts each contract severity and ignores unknown values", () => {
    const counts = countBySeverity([
      sev("WARNING"),
      sev("CRITICAL"),
      sev("SUGGESTION"),
      sev("WARNING"),
      sev("INFO"),
    ]);
    expect(counts).toEqual({ CRITICAL: 1, WARNING: 2, SUGGESTION: 1 });
    expect(totalFindings(counts)).toBe(4);
  });

  it("empty input → all zeros, nothing present", () => {
    const counts = countBySeverity([]);
    expect(counts).toEqual(emptyCounts());
    expect(presentSeverities(counts)).toEqual([]);
    expect(totalFindings(counts)).toBe(0);
  });

  it("presentSeverities keeps display order regardless of input order", () => {
    const counts = countBySeverity([sev("SUGGESTION"), sev("CRITICAL")]);
    expect(presentSeverities(counts)).toEqual(["CRITICAL", "SUGGESTION"]);
  });
});

describe("sortBySeverity", () => {
  it("sortBySeverity orders CRITICAL → WARNING → SUGGESTION without mutating", () => {
    const input = [finding({ id: "s", severity: "SUGGESTION" }), finding({ id: "c", severity: "CRITICAL" }), finding({ id: "w" })];
    expect(sortBySeverity(input).map((f) => f.id)).toEqual(["c", "w", "s"]);
    expect(input.map((f) => f.id)).toEqual(["s", "c", "w"]);
  });
});
