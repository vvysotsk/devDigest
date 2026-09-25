import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { RunTrace, FindingRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/runs.json"; // apps/web/messages/en/runs.json

// Mock the trace hooks so the drawer renders without a query client / SSE.
const TRACE: RunTrace = {
  config: { agent: "Security", version: "1", provider: "openai", model: "gpt-4.1", pr: 482, source: "local" },
  stats: { duration_ms: 8200, tokens_in: 12000, tokens_out: 1500, cost_usd: 0.0014, findings: 2, grounding: "2/2 passed" },
  prompt_assembly: { system: "You are a reviewer.", skills: "### skill", memory: null, specs: null, user: "Review PR #482" },
  tool_calls: [{ tool: "review_file", args: "src/config.ts", meta: "single-pass", ms: 1200 }],
  raw_output: '{"verdict":"request_changes"}',
  memory_pulled: [{ pr: 471, text: "rate-limit public endpoints" }],
  specs_read: [],
  log: [
    { t: "00.10", kind: "info", msg: "Starting review with agent Security" },
    { t: "00.90", kind: "result", msg: "Citation grounding: 2/2 passed" },
  ],
};

vi.mock("../../../../../../../lib/hooks/trace", () => ({
  useRunTrace: () => ({ data: TRACE, isLoading: false }),
}));
vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useRunEvents: () => ({ events: [], running: false }),
}));

import RunTraceDrawer from "./RunTraceDrawer";

afterEach(cleanup);

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ runs: messages }}>
      <div data-theme="dark">{ui}</div>
    </NextIntlClientProvider>,
  );
}

describe("A5 Run Trace drawer (smoke)", () => {
  it("renders the trace tabs and stats", () => {
    renderWithIntl(<RunTraceDrawer runId="r1" agentName="Security" prNumber={482} onClose={() => {}} />);
    expect(screen.getByText("Configuration")).toBeInTheDocument();
    expect(screen.getByText("Stats")).toBeInTheDocument();
    expect(screen.getByText("2/2 passed")).toBeInTheDocument();
    expect(screen.getByText("Tool calls")).toBeInTheDocument();
  });

  it("renders the COST stat from the trace", () => {
    renderWithIntl(<RunTraceDrawer runId="r1" agentName="Security" prNumber={482} onClose={() => {}} />);
    expect(screen.getByText("COST")).toBeInTheDocument();
    expect(screen.getByText("$0.0014")).toBeInTheDocument();
  });

  it("Findings section shows severity pills + read-only previews of the run's findings", () => {
    const f = (id: string, severity: FindingRecord["severity"], title: string): FindingRecord => ({
      id,
      severity,
      category: "security",
      title,
      file: "src/config.ts",
      start_line: 12,
      end_line: 12,
      rationale: "Line 12 contains a literal string starting with sk_live_.",
      suggestion: `Move the key into the secrets provider (${id}).`,
      confidence: 0.98,
      kind: "finding",
      trifecta_components: null,
      evidence: null,
      review_id: "rv1",
      accepted_at: null,
      dismissed_at: null,
    });
    renderWithIntl(
      <RunTraceDrawer
        runId="r1"
        agentName="Security"
        prNumber={482}
        onClose={() => {}}
        findings={[f("f2", "WARNING", "Missing rate limit"), f("f1", "CRITICAL", "Hardcoded Stripe secret key")]}
      />,
    );
    expect(screen.getByText("1 Critical")).toBeInTheDocument();
    expect(screen.getByText("1 Warning")).toBeInTheDocument();
    const titles = screen.getAllByText(/Hardcoded Stripe|Missing rate limit/).map((el) => el.textContent);
    expect(titles).toEqual(["Hardcoded Stripe secret key", "Missing rate limit"]); // sorted by severity
    expect(screen.getAllByText("src/config.ts:12")).toHaveLength(2);
    // full mode: the suggestion is shown under its label
    expect(screen.getByText(/Move the key into the secrets provider \(f1\)\./)).toBeInTheDocument();
    expect(screen.getAllByText("Suggested fix:")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /accept|dismiss/i })).not.toBeInTheDocument();
  });

  it("switches to the live log tab", () => {
    renderWithIntl(<RunTraceDrawer runId="r1" agentName="Security" prNumber={482} onClose={() => {}} />);
    fireEvent.click(screen.getByText("log"));
    // LiveLogStream renders its filter input
    expect(screen.getByPlaceholderText("Filter log…")).toBeInTheDocument();
  });
});
