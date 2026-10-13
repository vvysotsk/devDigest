/**
 * formatCost — no-data runs must read "—", never a fabricated "$0.00";
 * a genuine stored 0 (free model) IS "$0.00". Decimal places scale with
 * magnitude so sub-cent runs stay readable ($0.06 / $0.014 / $0.0013).
 */
import { describe, it, expect } from "vitest";
import { formatCost } from "./cost-format";

describe("formatCost", () => {
  it("scales decimal places with magnitude", () => {
    expect(formatCost(0.06)).toBe("$0.06");
    expect(formatCost(0.1)).toBe("$0.10");
    expect(formatCost(0.014)).toBe("$0.014");
    expect(formatCost(0.0013)).toBe("$0.0013");
    expect(formatCost(1.5)).toBe("$1.50");
  });

  it("null/undefined → dash; genuine 0 → $0.00", () => {
    expect(formatCost(null)).toBe("—");
    expect(formatCost(undefined)).toBe("—");
    expect(formatCost(0)).toBe("$0.00");
  });
});

