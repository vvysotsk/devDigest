/**
 * RunHistory — the badge must reflect the review OUTCOME, not the run lifecycle.
 * Regression guard for the "green ✓ done on a run that found 5 blockers" bug:
 * a settled run is colored/labelled by its denormalized blocker/finding counts,
 * and shows the review score ring.
 *
 * With `reviews` passed in, a settled run shows its findings split by severity
 * (icons + counts, hover preview) instead of the plain "N findings" text.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { RunSummary, ReviewRecord, FindingRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";
import { RunHistory } from "./RunHistory";

afterEach(cleanup);

function run(o: Partial<RunSummary>): RunSummary {
  return {
    run_id: "run-1",
    agent_id: "a1",
    agent_name: "Security Reviewer",
    provider: "openrouter",
    model: "deepseek/deepseek-v4-flash",
    status: "done",
    error: null,
    duration_ms: 1000,
    tokens_in: 100,
    tokens_out: 50,
    cost_usd: null,
    findings_count: 0,
    grounding: "0/0 passed",
    ran_at: "2026-06-11T18:44:34.000Z",
    score: null,
    blockers: null,
    ...o,
  };
}

function finding(id: string, severity: FindingRecord["severity"], title: string): FindingRecord {
  return {
    id,
    severity,
    category: "security",
    title,
    file: "src/config.ts",
    start_line: 12,
    end_line: 12,
    rationale: "Because.",
    suggestion: null,
    confidence: 0.9,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "rv-1",
    accepted_at: null,
    dismissed_at: null,
  };
}

function review(run_id: string | null, findings: FindingRecord[]): ReviewRecord {
  return {
    id: `rv-${run_id}`,
    pr_id: "pr-1",
    agent_id: "a1",
    run_id,
    agent_name: "Security Reviewer",
    kind: "review",
    verdict: "request_changes",
    summary: null,
    score: 40,
    model: "m",
    grounding: null,
    created_at: "2026-06-11T18:44:40.000Z",
    findings,
  };
}

function renderRuns(
  runs: RunSummary[],
  opts: { reviews?: ReviewRecord[]; onGoToReview?: (id: string) => void } = {},
) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <RunHistory runs={runs} reviews={opts.reviews} onOpenTrace={() => {}} onGoToReview={opts.onGoToReview} />
    </NextIntlClientProvider>,
  );
}

describe("RunHistory — outcome badge", () => {
  it("a done run WITH blockers reads 'rejected' (never green 'done') + shows the score ring", () => {
    renderRuns([run({ status: "done", findings_count: 5, blockers: 5, score: 0 })]);
    expect(screen.getByText("rejected")).toBeInTheDocument();
    expect(screen.queryByText("done")).not.toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument(); // CircularScore renders the number
    expect(screen.getByText(/5 blockers/)).toBeInTheDocument();
  });

  it("a clean done run reads 'approved'", () => {
    renderRuns([run({ status: "done", findings_count: 0, blockers: 0, score: 95 })]);
    expect(screen.getByText("approved")).toBeInTheDocument();
    expect(screen.getByText("95")).toBeInTheDocument();
  });

  it("a done run with non-blocking findings reads 'reviewed'", () => {
    renderRuns([run({ status: "done", findings_count: 3, blockers: 0, score: 72 })]);
    expect(screen.getByText("reviewed")).toBeInTheDocument();
    expect(screen.queryByText(/blockers/)).not.toBeInTheDocument();
  });

  it("a failed run reads 'error'", () => {
    renderRuns([run({ status: "failed", error: "boom", score: null, blockers: null })]);
    expect(screen.getByText("error")).toBeInTheDocument();
  });

  it("a running run reads 'running'", () => {
    renderRuns([run({ status: "running", score: null, blockers: null })]);
    expect(screen.getByText("running")).toBeInTheDocument();
  });
});

describe("RunHistory — run cost", () => {
  it("a settled run shows cost + tokens", () => {
    renderRuns([run({ cost_usd: 0.0014, tokens_in: 8200, tokens_out: 1300 })]);
    expect(screen.getByText("$0.0014 · 8.2k→1.3k")).toBeInTheDocument();
  });

  it("a settled run without cost shows the dash, never $0.00", () => {
    renderRuns([run({ cost_usd: null })]);
    expect(screen.getByText(/^—/)).toBeInTheDocument();
    expect(screen.queryByText(/\$0\.00/)).not.toBeInTheDocument();
  });

  it("a running run shows no cost line", () => {
    renderRuns([run({ status: "running", cost_usd: null, score: null, blockers: null })]);
    expect(screen.queryByText(/—|\$/)).not.toBeInTheDocument();
  });
});

describe("RunHistory — findings by severity", () => {
  const FINDINGS = [
    finding("f1", "CRITICAL", "Hardcoded Stripe secret key"),
    finding("f2", "WARNING", "Missing rate limit"),
    finding("f3", "WARNING", "N+1 query"),
  ];

  it("without reviews the plain count text stays, with proper plurals", () => {
    renderRuns([run({ findings_count: 3, blockers: 1 })]);
    expect(screen.getByText("3 findings")).toBeInTheDocument();
    expect(screen.getByText("· 1 blocker")).toBeInTheDocument();
    renderRuns([run({ run_id: "run-2", findings_count: 1, blockers: 0 })]);
    expect(screen.getByText("1 finding")).toBeInTheDocument();
  });

  it("with a matching review: icon+count per severity replaces the text, blockers stay", () => {
    renderRuns([run({ findings_count: 3, blockers: 1 })], { reviews: [review("run-1", FINDINGS)] });
    expect(screen.getByLabelText("1 Critical")).toBeInTheDocument();
    expect(screen.getByLabelText("2 Warning")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Suggestion/)).not.toBeInTheDocument();
    expect(screen.queryByText("3 findings")).not.toBeInTheDocument();
    expect(screen.getByText("· 1 blocker")).toBeInTheDocument();
  });

  it("a review for a different run (or with no run_id) does not attach", () => {
    renderRuns([run({ findings_count: 3 })], { reviews: [review("other-run", FINDINGS), review(null, FINDINGS)] });
    expect(screen.getByText("3 findings")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Critical/)).not.toBeInTheDocument();
  });

  it("hovering the icons opens the read-only preview titled 'N findings in this run'", () => {
    renderRuns([run({ findings_count: 3 })], { reviews: [review("run-1", FINDINGS)] });
    const trigger = screen.getByRole("button", { name: "3 findings in this run" });
    fireEvent.mouseEnter(trigger.parentElement!);
    expect(screen.getByRole("dialog", { name: "3 findings in this run" })).toBeInTheDocument();
    expect(screen.getByText("Hardcoded Stripe secret key")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /accept|dismiss/i })).not.toBeInTheDocument();
  });

  it("clicking the agent name still jumps to the review, hover card or not", () => {
    const onGoToReview = vi.fn();
    renderRuns([run({ findings_count: 3 })], { reviews: [review("run-1", FINDINGS)], onGoToReview });
    fireEvent.click(screen.getByRole("button", { name: "Security Reviewer" }));
    expect(onGoToReview).toHaveBeenCalledWith("run-1");
  });
});
