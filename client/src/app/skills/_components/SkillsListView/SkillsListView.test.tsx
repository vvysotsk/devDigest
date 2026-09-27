/**
 * /skills list — cards (type, source, "N agents"), the enabled switch (with the
 * first-enable acknowledgement for an imported skill) and the create flow.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";
import { skill } from "@/test/fixtures";

const h = vi.hoisted(() => ({
  push: vi.fn(),
  skills: [] as Skill[],
  update: vi.fn(),
  create: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, replace: vi.fn() }) }));
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/features/skills/hooks", async () => {
  const { fakeMutation } = await import("@/test/mutation-mock");
  return {
    useSkills: () => ({ data: h.skills, isLoading: false, isError: false, refetch: vi.fn() }),
    useUpdateSkill: fakeMutation((v: unknown) => h.update(v)),
    useCreateSkill: fakeMutation((v: unknown) => h.create(v)),
    useImportPreview: fakeMutation(() => undefined),
    useImportSkill: fakeMutation(() => undefined),
  };
});

import { SkillsListView } from "./SkillsListView";

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  h.update.mockImplementation(({ id, patch }: { id: string; patch: Partial<Skill> }) => skill({ id, ...patch }));
});

function renderList() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <ToastProvider>
        <SkillsListView />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

const card = (name: string) => screen.getByRole("button", { name });

describe("SkillsListView", () => {
  it("lists skill cards with type, source and agent count; the switch and a click act on that skill", async () => {
    const user = userEvent.setup();
    h.skills = [
      skill({ id: "s1", name: "pr-quality-rubric", agent_count: 3 }),
      skill({ id: "s2", name: "no-then-chains", type: "convention", enabled: false, agent_count: 1 }),
    ];
    renderList();

    const first = card("pr-quality-rubric");
    expect(within(first).getByText("3 agents")).toBeInTheDocument();
    expect(within(first).getByText("rubric")).toBeInTheDocument();
    expect(within(first).getByText("Manual")).toBeInTheDocument();
    const second = card("no-then-chains");
    expect(within(second).getByText("1 agent")).toBeInTheDocument();
    expect(within(second).getByText("convention")).toBeInTheDocument();

    await user.click(within(second).getByRole("switch"));
    expect(h.update).toHaveBeenCalledWith({ id: "s2", patch: { enabled: true } });
    expect(h.push).not.toHaveBeenCalled();

    await user.click(first);
    expect(h.push).toHaveBeenCalledWith("/skills/s1?tab=config");
  });

  it("the first enable of an imported skill asks for the acknowledgement and sends acknowledge_injection", async () => {
    const user = userEvent.setup();
    h.skills = [
      skill({ id: "s3", name: "api-deprecation-policy", source: "imported_file", enabled: false, acknowledged_at: null }),
    ];
    renderList();
    const imported = card("api-deprecation-policy");
    expect(within(imported).getByText("Imported")).toBeInTheDocument();

    await user.click(within(imported).getByRole("switch"));
    const dialog = screen.getByRole("dialog");
    expect(h.update).not.toHaveBeenCalled();
    const enable = within(dialog).getByRole("button", { name: "Enable skill" });
    expect(enable).toBeDisabled();

    await user.click(
      within(dialog).getByRole("checkbox", {
        name: "I have read this text; it will be injected into the agent's prompt as instructions",
      }),
    );
    await user.click(enable);
    expect(h.update).toHaveBeenCalledWith({ id: "s3", patch: { enabled: true, acknowledge_injection: true } });
    expect(await screen.findByRole("switch")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(h.push).not.toHaveBeenCalled();
  });

  it("an acknowledged imported skill is enabled without the dialog", async () => {
    const user = userEvent.setup();
    h.skills = [skill({ id: "s4", source: "imported_file", enabled: false, acknowledged_at: "2026-09-20T10:00:00.000Z" })];
    renderList();
    await user.click(screen.getByRole("switch"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(h.update).toHaveBeenCalledWith({ id: "s4", patch: { enabled: true } });
  });

  it("creates a manual skill from the Add Skill menu and opens it", async () => {
    const user = userEvent.setup();
    h.skills = [skill({ id: "s1" })];
    h.create.mockResolvedValue(skill({ id: "new-1", name: "edge-case-hunter" }));
    renderList();

    await user.click(screen.getByRole("button", { name: "Add Skill" }));
    await user.click(screen.getByRole("button", { name: "Create skill" }));
    const dialog = screen.getByRole("dialog");
    const submit = within(dialog).getByRole("button", { name: "Create skill" });

    await user.type(within(dialog).getByRole("textbox", { name: "Name" }), "Edge Case");
    expect(within(dialog).getByText(/Use kebab-case/)).toBeInTheDocument();
    expect(submit).toBeDisabled();

    await user.clear(within(dialog).getByRole("textbox", { name: "Name" }));
    await user.type(within(dialog).getByRole("textbox", { name: "Name" }), "edge-case-hunter");
    await user.type(within(dialog).getByRole("textbox", { name: "Description" }), "Use when a branch lacks a test");
    await user.selectOptions(within(dialog).getByRole("combobox"), "rubric");
    await user.clear(within(dialog).getByRole("textbox", { name: "Skill body" }));
    await user.type(within(dialog).getByRole("textbox", { name: "Skill body" }), "Check every branch.");
    await user.click(submit);

    expect(h.create).toHaveBeenCalledWith({
      name: "edge-case-hunter",
      description: "Use when a branch lacks a test",
      type: "rubric",
      body: "Check every branch.",
      source: "manual",
      enabled: true,
    });
    await vi.waitFor(() => expect(h.push).toHaveBeenCalledWith("/skills/new-1?tab=config"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
