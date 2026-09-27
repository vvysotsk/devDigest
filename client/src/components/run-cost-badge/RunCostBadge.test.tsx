/**
 * RunCostBadge — no-data runs must read "—", never a fabricated "$0.00";
 * a genuine stored 0 (free model) IS "$0.00". Decimal places scale with
 * magnitude so sub-cent runs stay readable ($0.06 / $0.014 / $0.0013).
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { RunCostBadge } from "./RunCostBadge";
import { formatTokensCompact } from "./helpers";

afterEach(cleanup);

describe("formatTokensCompact", () => {
  it("1dp under 10k, 0dp above", () => {
    expect(formatTokensCompact(8200, 1300)).toBe("8.2k→1.3k");
    expect(formatTokensCompact(12000, 1500)).toBe("12k→1.5k");
  });
});

describe("RunCostBadge", () => {
  it("cost variant renders cost only", () => {
    render(<RunCostBadge costUsd={0.014} tokensIn={8200} tokensOut={1300} />);
    expect(screen.getByText("$0.014")).toBeInTheDocument();
  });

  it("costTokens variant renders cost · tokens", () => {
    render(
      <RunCostBadge variant="costTokens" costUsd={0.0014} tokensIn={8200} tokensOut={1300} />,
    );
    expect(screen.getByText("$0.0014 · 8.2k→1.3k")).toBeInTheDocument();
  });

  it("costTokens without token data renders cost only", () => {
    render(<RunCostBadge variant="costTokens" costUsd={0.02} />);
    expect(screen.getByText("$0.02")).toBeInTheDocument();
  });

  it("no data renders a dash", () => {
    render(<RunCostBadge costUsd={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
