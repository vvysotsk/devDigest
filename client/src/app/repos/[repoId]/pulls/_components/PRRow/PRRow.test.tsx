/**
 * PRRow — FINDINGS column: server-computed latest-batch counts as icon+count,
 * a dash for never-reviewed PRs, and a lazily-fetched read-only popover that
 * only opens (and only fetches) once the pointer has settled on the cell.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrMeta, ReviewRecord } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/prReview.json";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const usePrReviews = vi.fn();
vi.mock("@/lib/hooks/reviews", () => ({ usePrReviews: (...a: unknown[]) => usePrReviews(...a) }));

import { PRRow } from "./PRRow";
import { HOVER_INTENT_MS } from "./FindingsCell";

afterEach(cleanup);
beforeEach(() => {
  vi.useFakeTimers();
  push.mockReset();
  usePrReviews.mockReset();
  usePrReviews.mockReturnValue({ data: undefined });
});
afterEach(() => vi.useRealTimers());

function pr(o: Partial<PrMeta> = {}): PrMeta {
  return {
    id: "pr-1",
    number: 482,
    title: "Add rate limiting to public API endpoints",
    author: "marisa.koch",
    branch: "feat/rate-limit",
    base: "main",
    head_sha: "abc",
    additions: 247,
    deletions: 38,
    files_count: 4,
    status: "needs_review",
    opened_at: null,
    updated_at: null,
    score: 61,
    cost_usd: 0.014,
    latest_batch: {
      run_ids: ["run-new"],
      findings_by_severity: { CRITICAL: 2, WARNING: 2, SUGGESTION: 2 },
    },
    ...o,
  };
}

function review(o: Partial<ReviewRecord> & { id: string; run_id: string | null }): ReviewRecord {
  return {
    pr_id: "pr-1",
    agent_id: "a1",
    agent_name: "Security Reviewer",
    kind: "review",
    verdict: "request_changes",
    summary: null,
    score: 61,
    model: "m",
    grounding: null,
    created_at: "2026-06-13T08:52:51.000Z",
    findings: [],
    ...o,
  };
}

const f = (id: string, review_id: string, severity: "CRITICAL" | "WARNING" | "SUGGESTION", title: string) => ({
  id,
  review_id,
  severity,
  category: "security" as const,
  title,
  file: "src/config.ts",
  start_line: 12,
  end_line: 12,
  rationale: "Because.",
  suggestion: null,
  confidence: 0.98,
  kind: "finding" as const,
  trifecta_components: null,
  evidence: null,
  accepted_at: null,
  dismissed_at: null,
});

function renderRow(p: PrMeta) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <PRRow pr={p} repoId="repo-1" />
    </NextIntlClientProvider>,
  );
}

const enabledArg = () => usePrReviews.mock.calls.at(-1)?.[1] as { enabled: boolean };

describe("PRRow — FINDINGS column", () => {
  it("a never-reviewed PR shows a dash and never asks for reviews", () => {
    renderRow(pr({ latest_batch: null, score: null }));
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /^\d+ findings?$/ })).not.toBeInTheDocument();
    expect(enabledArg().enabled).toBe(false);
  });

  it("shows icon+count per severity of the latest batch", () => {
    renderRow(pr());
    expect(screen.getByLabelText("2 Critical")).toBeInTheDocument();
    expect(screen.getByLabelText("2 Warning")).toBeInTheDocument();
    expect(screen.getByLabelText("2 Suggestion")).toBeInTheDocument();
  });

  it("a quick sweep over the cell opens nothing and fetches nothing", () => {
    renderRow(pr());
    const trigger = screen.getByRole("button", { name: "6 findings" });
    fireEvent.mouseEnter(trigger.parentElement!);
    act(() => vi.advanceTimersByTime(HOVER_INTENT_MS - 50));
    fireEvent.mouseLeave(trigger.parentElement!);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(enabledArg().enabled).toBe(false);
  });

  it("settling on the cell opens the popover, enables the fetch and lists only the latest batch's findings", () => {
    usePrReviews.mockImplementation((_id: string, opts: { enabled: boolean }) => ({
      data: opts.enabled
        ? [
            review({ id: "rv-new", run_id: "run-new", findings: [f("f1", "rv-new", "CRITICAL", "Hardcoded Stripe secret key in commit")] }),
            review({ id: "rv-old", run_id: "run-old", findings: [f("f9", "rv-old", "WARNING", "Old finding from a previous batch")] }),
          ]
        : undefined,
    }));
    renderRow(pr());
    const trigger = screen.getByRole("button", { name: "6 findings" });
    fireEvent.mouseEnter(trigger.parentElement!);
    act(() => vi.advanceTimersByTime(HOVER_INTENT_MS));

    expect(screen.getByRole("dialog", { name: "6 findings" })).toBeInTheDocument();
    expect(enabledArg().enabled).toBe(true);
    expect(screen.getByText("Hardcoded Stripe secret key in commit")).toBeInTheDocument();
    expect(screen.queryByText("Old finding from a previous batch")).not.toBeInTheDocument();
    // read-only: no actions in the popover
    expect(screen.queryByRole("button", { name: /accept|dismiss/i })).not.toBeInTheDocument();
  });

  it("keyboard focus opens immediately (no hover delay) and shows the loading note", () => {
    renderRow(pr());
    fireEvent.focus(screen.getByRole("button", { name: "6 findings" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Loading findings…")).toBeInTheDocument();
    expect(enabledArg().enabled).toBe(true);
  });

  it("clicking the row still navigates to the PR", () => {
    renderRow(pr());
    fireEvent.click(screen.getByText("Add rate limiting to public API endpoints"));
    expect(push).toHaveBeenCalledWith("/repos/repo-1/pulls/482");
  });
});
