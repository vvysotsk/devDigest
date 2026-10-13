/** CandidateCard — the Accept ↔ Accepted toggle, inline-edit validation, and the evidence without a repo name. */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../messages/en/conventions.json";
import { conventionCandidate } from "@/test/fixtures";
import { CandidateCard, type CandidateCardProps } from "./CandidateCard";

afterEach(cleanup);

function renderCard(over: Partial<CandidateCardProps> = {}) {
  const onPatch = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={{ conventions: messages }}>
      <CandidateCard
        candidate={conventionCandidate()}
        repoFullName="acme/payments-api"
        headSha="abc123"
        pending={false}
        onPatch={onPatch}
        {...over}
      />
    </NextIntlClientProvider>,
  );
  return onPatch;
}

describe("CandidateCard", () => {
  it("an accepted card reads Accepted and a click returns it to pending; a pending one accepts", async () => {
    const user = userEvent.setup();
    const onPatch = renderCard({ candidate: conventionCandidate({ id: "c1", status: "accepted" }) });
    await user.click(screen.getByRole("button", { name: "Accepted" }));
    expect(onPatch).toHaveBeenCalledWith("c1", { status: "pending" });
    cleanup();

    const onPatch2 = renderCard({ candidate: conventionCandidate({ id: "c2", status: "pending" }) });
    await user.click(screen.getByRole("button", { name: "Accept" }));
    expect(onPatch2).toHaveBeenCalledWith("c2", { status: "accepted" });
  });

  it("inline edit: an empty rule disables Save; Save sends the trimmed rule and the category", async () => {
    const user = userEvent.setup();
    const onPatch = renderCard({ candidate: conventionCandidate({ id: "c1", category: "naming" }) });
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const rule = screen.getByRole("textbox", { name: "Rule" });
    expect(rule).toHaveValue("Hooks are named useXxx");
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();

    await user.clear(rule);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await user.type(rule, "  Hooks start with use  ");
    await user.selectOptions(screen.getByRole("combobox"), "types");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onPatch).toHaveBeenCalledWith("c1", { rule: "Hooks start with use", category: "types" });
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
  });

  it("while a patch is pending the buttons wait; without a repo name the evidence is plain text", () => {
    renderCard({ pending: true, repoFullName: null });
    expect(screen.getByRole("button", { name: "Accept" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit" })).toBeDisabled();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("src/lib/hooks/agents.ts:3")).toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();
  });
});
