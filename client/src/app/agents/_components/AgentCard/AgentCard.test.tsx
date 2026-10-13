import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { agent } from "@/test/fixtures";
import messages from "../../../../../messages/en/agents.json";

const h = vi.hoisted(() => ({ del: vi.fn() }));
vi.mock("@/lib/hooks/agents", async () => {
  const { fakeMutation } = await import("@/test/mutation-mock");
  return { useDeleteAgent: fakeMutation((id: string) => h.del(id)) };
});

import { AgentCard } from "./AgentCard";

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const AGENT = agent();

function renderWithIntl(ui: React.ReactElement) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ agents: messages }}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("AgentCard (smoke)", () => {
  it("renders the agent name, model chip and skill count", () => {
    renderWithIntl(<AgentCard ag={AGENT} skillCount={3} />);
    expect(screen.getByText("Security Reviewer")).toBeInTheDocument();
    expect(screen.getByText("gpt-4.1")).toBeInTheDocument();
    expect(screen.getByText("3 skills")).toBeInTheDocument();
  });

  it("falls back to a translated placeholder when description is empty; no skills chip at 0", () => {
    renderWithIntl(<AgentCard ag={agent({ description: "" })} skillCount={0} />);
    expect(screen.getByText("No description")).toBeInTheDocument();
    expect(screen.queryByText(/skills?$/)).not.toBeInTheDocument();
  });
});

describe("AgentCard — delete (#33, #34)", () => {
  it("Delete opens the kit confirm modal; Cancel and X close it, Delete removes the agent", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    h.del.mockResolvedValue({ ok: true });
    renderWithIntl(<AgentCard ag={AGENT} onClick={onClick} />);
    const openConfirm = () => user.click(screen.getByRole("button", { name: "Delete Security Reviewer" }));

    await openConfirm();
    let dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Delete agent Security Reviewer?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await openConfirm();
    dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(h.del).not.toHaveBeenCalled();

    await openConfirm();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
    expect(h.del).toHaveBeenCalledWith(AGENT.id);
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // Nothing in the button or the (portalled) modal reached the card's own click.
    expect(onClick).not.toHaveBeenCalled();
  });
});
