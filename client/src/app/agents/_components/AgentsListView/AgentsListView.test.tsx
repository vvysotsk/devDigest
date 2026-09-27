/** /agents list — each card's "N skills" chip comes from Agent.skill_count and is hidden at 0. */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../messages/en/agents.json";
import { agent } from "@/test/fixtures";

const AGENTS = vi.hoisted(() => [] as import("@devdigest/shared").Agent[]);

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../../../../lib/hooks/agents", () => ({
  useAgents: () => ({ data: AGENTS, isLoading: false, isError: false, refetch: vi.fn() }),
  useUpdateAgent: () => ({ mutate: vi.fn() }),
  useDeleteAgent: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { AgentsListView } from "./AgentsListView";

afterEach(cleanup);

describe("AgentsListView", () => {
  it("shows the effective skill count per agent and no chip at 0", () => {
    AGENTS.splice(
      0,
      AGENTS.length,
      agent({ id: "a1", name: "Security Reviewer", skill_count: 3 }),
      agent({ id: "a2", name: "Test Quality Reviewer", skill_count: 0 }),
      agent({ id: "a3", name: "API Contract Reviewer", skill_count: 1 }),
    );
    render(
      <NextIntlClientProvider locale="en" messages={{ agents: messages }}>
        <AgentsListView />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Test Quality Reviewer")).toBeInTheDocument();
    // one chip per agent with skills, in list order; none for the agent at 0
    expect(screen.getAllByText(/^\d+ skills?$/).map((el) => el.textContent)).toEqual(["3 skills", "1 skill"]);
  });
});
