/**
 * Agents › Skills tab (D2, D12, D17) — rendered through AgentEditor, which owns
 * the draft: ticks, ↑/↓ and Detach change only the draft (and mark the tab);
 * "Save skills" sends exactly one PUT with the ordered list; Discard and an
 * agent switch drop the draft.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { AgentSkill, AgentSkillsPut, Skill } from "@devdigest/shared";
import agentsMessages from "../../../../../../../../messages/en/agents.json";
import skillsMessages from "../../../../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";
import { agent, skill } from "@/test/fixtures";

const h = vi.hoisted(() => ({
  skills: [] as Skill[],
  links: [] as AgentSkill[],
  put: vi.fn(),
}));

vi.mock("@/features/skills/hooks", async () => {
  const { fakeMutation } = await import("@/test/mutation-mock");
  return {
    useSkills: () => ({ data: h.skills, isLoading: false, isError: false, refetch: vi.fn() }),
    useAgentSkills: () => ({ data: h.links, isLoading: false, isError: false, refetch: vi.fn() }),
    useSetAgentSkills: fakeMutation((v: { agentId: string; body: AgentSkillsPut }) => h.put(v)),
  };
});
vi.mock("@/lib/hooks/agents", () => ({
  useUpdateAgent: () => ({ mutate: vi.fn(), isPending: false, isSuccess: false, data: undefined }),
  useProviderModels: () => ({ data: [] }),
}));

import { AgentEditor } from "../../AgentEditor";

const ALPHA = skill({ id: "a", name: "alpha-rule" });
const BETA = skill({ id: "b", name: "beta-rule", type: "security" });
const GAMMA = skill({ id: "c", name: "gamma-rule", enabled: false });
const DELTA = skill({ id: "d", name: "delta-rule", type: "convention" });
const EPS = skill({ id: "e", name: "eps-rule" });

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  h.skills = [EPS, DELTA, GAMMA, BETA, ALPHA];
  h.links = [
    { skill_id: "b", order: 1, enabled: false, skill: BETA },
    { skill_id: "a", order: 0, enabled: true, skill: ALPHA },
    { skill_id: "c", order: 2, enabled: true, skill: GAMMA },
  ];
  h.put.mockResolvedValue({ version: 4, skills: [] });
});

function ui(id = "ag1") {
  return (
    <NextIntlClientProvider locale="en" messages={{ agents: agentsMessages, skills: skillsMessages }}>
      <ToastProvider>
        <AgentEditor agent={agent({ id })} tab="skills" onTab={() => {}} />
      </ToastProvider>
    </NextIntlClientProvider>
  );
}

const order = () =>
  within(screen.getByRole("list", { name: "Skills" }))
    .getAllByRole("listitem")
    .map((li) => li.getAttribute("aria-label"));
const box = (name: string) => screen.getByRole("switch", { name: `Enable ${name} for this agent` });
const item = (name: string) => screen.getByRole("listitem", { name });
const dataTransfer = () => ({ setData: vi.fn(), effectAllowed: "" });
const saveBtn = () => screen.getByRole("button", { name: "Save skills" });

describe("Agent SkillsTab", () => {
  it("edits only the draft, then saves the ordered list in exactly one PUT", async () => {
    const user = userEvent.setup();
    render(ui());

    // linked first in saved order, then unlinked by name
    expect(order()).toEqual(["alpha-rule", "beta-rule", "gamma-rule", "delta-rule", "eps-rule"]);
    expect(screen.getByText("1 of 3 enabled")).toBeInTheDocument(); // gamma is disabled globally
    expect(within(screen.getByRole("listitem", { name: "gamma-rule" })).getByText(/disabled on the Skills page/)).toBeInTheDocument();
    expect(screen.getByText(/Drag enabled skills to reorder\./)).toBeInTheDocument();
    expect(saveBtn()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Skills" })).toBeInTheDocument();

    await user.click(box("delta-rule")); // tick unlinked → linked at the end, enabled
    expect(order()).toEqual(["alpha-rule", "beta-rule", "gamma-rule", "delta-rule", "eps-rule"]);
    expect(screen.getByText("2 of 4 enabled")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skills •" })).toBeInTheDocument();

    await user.click(box("alpha-rule")); // untick → keeps link and position
    expect(box("alpha-rule")).toHaveAttribute("aria-checked", "false");
    expect(order()[0]).toBe("alpha-rule");
    expect(screen.getByText("1 of 4 enabled")).toBeInTheDocument();

    // ↑/↓ follow the drag rule (#31): only enabled rows get arrows.
    expect(screen.queryByRole("button", { name: "Move alpha-rule down" })).not.toBeInTheDocument(); // just disabled
    expect(screen.queryByRole("button", { name: "Move beta-rule up" })).not.toBeInTheDocument(); // link disabled
    expect(screen.queryByRole("button", { name: "Move gamma-rule up" })).not.toBeInTheDocument(); // disabled globally
    await user.click(screen.getByRole("button", { name: "Move delta-rule up" }));
    await user.click(screen.getByRole("button", { name: "Move delta-rule up" }));
    expect(order()).toEqual(["alpha-rule", "delta-rule", "beta-rule", "gamma-rule", "eps-rule"]);

    await user.click(screen.getByRole("button", { name: "Detach gamma-rule" }));
    expect(order()).toEqual(["alpha-rule", "delta-rule", "beta-rule", "eps-rule", "gamma-rule"]);
    expect(screen.queryByRole("button", { name: "Detach gamma-rule" })).not.toBeInTheDocument();
    expect(screen.getByText("1 of 3 enabled")).toBeInTheDocument();
    expect(h.put).not.toHaveBeenCalled();

    await user.click(saveBtn());
    expect(h.put).toHaveBeenCalledTimes(1);
    expect(h.put).toHaveBeenCalledWith({
      agentId: "ag1",
      body: {
        skills: [
          { skill_id: "a", enabled: false },
          { skill_id: "d", enabled: true },
          { skill_id: "b", enabled: false },
        ],
      },
    });
    expect(await screen.findByText("Skills saved (v4)")).toBeInTheDocument();
  });

  it("Discard restores the saved list; an edit back to the saved list is not dirty", async () => {
    const user = userEvent.setup();
    render(ui());

    await user.click(box("eps-rule"));
    await user.click(screen.getByRole("button", { name: "Move eps-rule up" }));
    expect(order()).toEqual(["alpha-rule", "beta-rule", "eps-rule", "gamma-rule", "delta-rule"]);
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(order()).toEqual(["alpha-rule", "beta-rule", "gamma-rule", "delta-rule", "eps-rule"]);
    expect(screen.getByText("1 of 3 enabled")).toBeInTheDocument();
    expect(saveBtn()).toBeDisabled();

    await user.click(box("alpha-rule"));
    await user.click(box("alpha-rule"));
    expect(saveBtn()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Skills" })).toBeInTheDocument();
    expect(h.put).not.toHaveBeenCalled();
  });

  it("only enabled skills can be dragged or dropped on (#31)", async () => {
    const user = userEvent.setup();
    render(ui());

    // alpha: linked + enabled; beta: link disabled; gamma: disabled globally; delta / eps: unlinked.
    expect(item("alpha-rule")).toHaveAttribute("draggable", "true");
    expect(item("beta-rule")).toHaveAttribute("draggable", "false");
    expect(item("gamma-rule")).toHaveAttribute("draggable", "false");
    expect(item("delta-rule")).toHaveAttribute("draggable", "false");

    await user.click(box("eps-rule")); // linked at the end, enabled → draggable
    expect(item("eps-rule")).toHaveAttribute("draggable", "true");
    fireEvent.dragStart(item("eps-rule"), { dataTransfer: dataTransfer() });
    fireEvent.dragOver(item("alpha-rule"));
    fireEvent.drop(item("alpha-rule"));
    expect(order()).toEqual(["eps-rule", "alpha-rule", "beta-rule", "gamma-rule", "delta-rule"]);

    // Dropping on a disabled row, or dragging one, changes nothing.
    fireEvent.dragStart(item("alpha-rule"), { dataTransfer: dataTransfer() });
    fireEvent.drop(item("beta-rule"));
    fireEvent.dragEnd(item("alpha-rule")); // the browser ends every drag on its source
    fireEvent.dragStart(item("beta-rule"), { dataTransfer: dataTransfer() });
    fireEvent.drop(item("eps-rule"));
    expect(order()).toEqual(["eps-rule", "alpha-rule", "beta-rule", "gamma-rule", "delta-rule"]);

    await user.click(box("alpha-rule")); // disabled on this agent → no longer draggable
    expect(item("alpha-rule")).toHaveAttribute("draggable", "false");
  });

  it("drops the draft when another agent is opened", async () => {
    const user = userEvent.setup();
    const { rerender } = render(ui("ag1"));
    await user.click(box("delta-rule"));
    expect(saveBtn()).toBeEnabled();

    rerender(ui("ag2"));
    expect(saveBtn()).toBeDisabled();
    expect(screen.getByText("1 of 3 enabled")).toBeInTheDocument();
  });

  it("with no skills in the workspace, points to the Skills page", () => {
    h.skills = [];
    h.links = [];
    render(ui());
    expect(screen.getByText("No skills yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Skills page/ })).toHaveAttribute("href", "/skills");
  });
});
