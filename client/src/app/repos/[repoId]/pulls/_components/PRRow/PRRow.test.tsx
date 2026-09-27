/**
 * PRRow — FINDINGS column: server-computed latest-batch counts as icon+count,
 * a dash for never-reviewed PRs, and a lazily-fetched read-only popover that
 * only opens (and only fetches) once the pointer has settled on the cell.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord, PrMeta } from "@devdigest/shared";
import { finding, pr, review } from "@/test/fixtures";
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
  usePrReviews.mockReturnValue({ data: undefined, isError: false });
});
afterEach(() => vi.useRealTimers());

/** PRRow's findings: security, src/config.ts:12, confidence 0.98. */
const f = (id: string, review_id: string, severity: FindingRecord["severity"], title: string) =>
  finding({
    id,
    review_id,
    severity,
    title,
    category: "security",
    file: "src/config.ts",
    start_line: 12,
    end_line: 12,
    rationale: "Because.",
    confidence: 0.98,
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
    expect(screen.queryByRole("button", { name: /findings? in this run/ })).not.toBeInTheDocument();
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
    const trigger = screen.getByRole("button", { name: "6 findings in this run" });
    fireEvent.mouseEnter(trigger.parentElement!);
    act(() => vi.advanceTimersByTime(HOVER_INTENT_MS - 50));
    fireEvent.mouseLeave(trigger.parentElement!);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(enabledArg().enabled).toBe(false);
  });

  it("settling on the cell opens the popover, enables the fetch and lists only the latest batch's findings", () => {
    usePrReviews.mockImplementation((_id: string, opts: { enabled: boolean }) => ({
      isError: false,
      data: opts.enabled
        ? [
            review({ id: "rv-new", run_id: "run-new", findings: [f("f1", "rv-new", "CRITICAL", "Hardcoded Stripe secret key in commit")] }),
            review({ id: "rv-old", run_id: "run-old", findings: [f("f9", "rv-old", "WARNING", "Old finding from a previous batch")] }),
          ]
        : undefined,
    }));
    renderRow(pr());
    const trigger = screen.getByRole("button", { name: "6 findings in this run" });
    fireEvent.mouseEnter(trigger.parentElement!);
    act(() => vi.advanceTimersByTime(HOVER_INTENT_MS));

    expect(screen.getByRole("dialog", { name: "6 findings in this run" })).toBeInTheDocument();
    expect(enabledArg().enabled).toBe(true);
    expect(screen.getByText("Hardcoded Stripe secret key in commit")).toBeInTheDocument();
    expect(screen.queryByText("Old finding from a previous batch")).not.toBeInTheDocument();
    // read-only: no actions in the popover
    expect(screen.queryByRole("button", { name: /accept|dismiss/i })).not.toBeInTheDocument();
  });

  it("keyboard focus opens immediately (no hover delay) and shows the loading note", () => {
    renderRow(pr());
    fireEvent.focus(screen.getByRole("button", { name: "6 findings in this run" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Loading findings…")).toBeInTheDocument();
    expect(enabledArg().enabled).toBe(true);
  });

  it("a failed reviews fetch shows the error text instead of a perpetual loading note", () => {
    usePrReviews.mockImplementation((_id: string, opts: { enabled: boolean }) => ({
      data: undefined,
      isError: opts.enabled,
    }));
    renderRow(pr());
    fireEvent.focus(screen.getByRole("button", { name: "6 findings in this run" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn’t load the findings for this PR.");
    expect(screen.queryByText("Loading findings…")).not.toBeInTheDocument();
  });

  it("clicking the row still navigates to the PR", () => {
    renderRow(pr());
    fireEvent.click(screen.getByText("Add rate limiting to public API endpoints"));
    expect(push).toHaveBeenCalledWith("/repos/repo-1/pulls/482");
  });
});
