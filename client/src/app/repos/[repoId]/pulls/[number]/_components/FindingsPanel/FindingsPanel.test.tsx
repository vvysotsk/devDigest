/**
 * FindingsPanel — severity counter pills + severity filter chips.
 * Pills count findings AFTER "Hide low confidence" and BEFORE the severity
 * filter, so a pill's number always equals the cards of that severity below.
 * All three chips always render; a severity with no visible finding is disabled.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord } from "@devdigest/shared";
import { finding as findingRecord } from "@/test/fixtures";
import messages from "../../../../../../../../messages/en/prReview.json";

vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useFindingAction: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { FindingsPanel } from "./FindingsPanel";

afterEach(cleanup);

/** FindingsPanel's findings: bug, src/a.ts:1, confidence 0.9 (above the low-confidence cut). */
const finding = (o: Partial<FindingRecord> & { id: string }) =>
  findingRecord({
    category: "bug",
    file: "src/a.ts",
    start_line: 1,
    end_line: 1,
    rationale: "Because.",
    confidence: 0.9,
    ...o,
  });

const FINDINGS: FindingRecord[] = [
  finding({ id: "c1", severity: "CRITICAL", title: "Hardcoded secret", category: "security" }),
  finding({ id: "c2", severity: "CRITICAL", title: "SSRF forwarder" }),
  finding({ id: "w1", severity: "WARNING", title: "N+1 query" }),
  finding({ id: "w2", severity: "WARNING", title: "Low-confidence warning", confidence: 0.4 }),
  finding({ id: "s1", severity: "SUGGESTION", title: "Extract magic number", category: "style" }),
];

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const renderedIds = () =>
  Array.from(document.querySelectorAll("[data-finding-id]")).map((el) =>
    el.getAttribute("data-finding-id"),
  );

const chip = (name: string) => screen.getByRole("button", { name });

describe("FindingsPanel (smoke)", () => {
  it("renders the toolbar + a finding card", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS.slice(0, 1)} prId="pr1" />);
    expect(screen.getByText("Hide low confidence")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
  });

  it("shows the empty state when nothing matches: no pills, three disabled chips", () => {
    renderWithIntl(<FindingsPanel findings={[]} prId="pr1" />);
    expect(screen.getByText("No findings match")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Findings by severity" })).not.toBeInTheDocument();
    for (const name of ["Critical", "Warning", "Suggestion"]) {
      expect(chip(name)).toBeDisabled();
    }
  });
});

describe("FindingsPanel — severity counters", () => {
  it("pills show one entry per present severity with the card count", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    expect(screen.getByText("2 Critical")).toBeInTheDocument();
    expect(screen.getByText("2 Warning")).toBeInTheDocument();
    expect(screen.getByText("1 Suggestion")).toBeInTheDocument();
    expect(renderedIds()).toHaveLength(5);
  });

  it("always renders three chips; a severity with no finding gets no pill and a disabled chip", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS.filter((f) => f.severity !== "WARNING")} prId="pr1" />);
    expect(screen.queryByText("2 Warning")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^(Critical|Warning|Suggestion)$/ })).toHaveLength(3);
    expect(chip("Warning")).toBeDisabled();
    expect(chip("Warning")).toHaveAttribute("aria-disabled", "true");
    expect(chip("Critical")).toBeEnabled();
    expect(chip("Suggestion")).toBeEnabled();
  });

  it("clicking a disabled chip does nothing", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS.filter((f) => f.severity !== "WARNING")} prId="pr1" />);
    fireEvent.click(chip("Warning"));
    expect(renderedIds()).toHaveLength(3);
    expect(chip("Warning")).toHaveAttribute("aria-pressed", "false");
  });

  it("with hide-low-confidence ON, the pill equals the visible cards of that severity", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    fireEvent.click(screen.getByRole("switch"));
    expect(screen.getByText("1 Warning")).toBeInTheDocument();
    expect(renderedIds()).toEqual(["c1", "c2", "w1", "s1"]);
  });
});

describe("FindingsPanel — severity filter", () => {
  it("clicking a chip keeps only that severity; clicking again restores all", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    fireEvent.click(chip("Warning"));
    expect(renderedIds()).toEqual(["w1", "w2"]);
    expect(chip("Warning")).toHaveAttribute("aria-pressed", "true");
    // Pills are unaffected by the severity filter.
    expect(screen.getByText("2 Critical")).toBeInTheDocument();

    fireEvent.click(chip("Warning"));
    expect(renderedIds()).toHaveLength(5);
    expect(chip("Warning")).toHaveAttribute("aria-pressed", "false");
  });

  it("switching chips replaces the filter", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    fireEvent.click(chip("Critical"));
    fireEvent.click(chip("Suggestion"));
    expect(renderedIds()).toEqual(["s1"]);
    expect(chip("Critical")).toHaveAttribute("aria-pressed", "false");
  });

  it("an active filter is dropped when its severity disappears after hiding low confidence", () => {
    const only = [finding({ id: "w-low", severity: "WARNING", confidence: 0.3 }), FINDINGS[0]!];
    renderWithIntl(<FindingsPanel findings={only} prId="pr1" />);
    fireEvent.click(chip("Warning"));
    expect(renderedIds()).toEqual(["w-low"]);

    fireEvent.click(screen.getByRole("switch"));
    // Warning vanished: its chip is disabled + unpressed and the list falls back to everything visible.
    expect(chip("Warning")).toBeDisabled();
    expect(chip("Warning")).toHaveAttribute("aria-pressed", "false");
    expect(renderedIds()).toEqual(["c1"]);
  });
});
