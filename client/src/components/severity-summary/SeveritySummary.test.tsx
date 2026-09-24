/**
 * SeveritySummary — counts are a plain COUNT over the findings' severity field;
 * only severities that occur render, always in CRITICAL → WARNING → SUGGESTION order.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SeveritySummary } from "./SeveritySummary";
import { countBySeverity, presentSeverities, totalFindings, emptyCounts } from "./helpers";

afterEach(cleanup);

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

describe("SeveritySummary", () => {
  it("pills variant renders 'N Label' only for present severities, in order", () => {
    const { container } = render(
      <SeveritySummary variant="pills" counts={{ CRITICAL: 3, WARNING: 0, SUGGESTION: 2 }} />,
    );
    expect(screen.getByText("3 Critical")).toBeInTheDocument();
    expect(screen.getByText("2 Suggestion")).toBeInTheDocument();
    expect(screen.queryByText(/Warning/)).not.toBeInTheDocument();
    const order = Array.from(container.querySelectorAll("[data-severity]")).map((el) =>
      el.getAttribute("data-severity"),
    );
    expect(order).toEqual(["CRITICAL", "SUGGESTION"]);
  });

  it("icons variant renders one labelled badge per present severity", () => {
    render(<SeveritySummary variant="icons" counts={{ CRITICAL: 0, WARNING: 1, SUGGESTION: 4 }} />);
    expect(screen.getByLabelText("1 Warning")).toBeInTheDocument();
    expect(screen.getByLabelText("4 Suggestion")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Critical/)).not.toBeInTheDocument();
  });

  it("zero findings renders nothing", () => {
    const { container } = render(<SeveritySummary variant="pills" counts={emptyCounts()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
