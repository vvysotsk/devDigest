/**
 * "Create skill from conventions" (#41, #51, D18): the server draft fills the
 * form, every field is editable, the agent is required, the save payload, the
 * success toast + navigation, the "already exists — saved as vN+1" note, the
 * 409 message and Cancel.
 */
import React from "react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ConventionSkillDraft } from "@devdigest/shared";
import conventions from "../../../../../../../messages/en/conventions.json";
import skills from "../../../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";
import { ApiError } from "@/lib/api";
import { agent, skill } from "@/test/fixtures";

const h = vi.hoisted(() => ({
  push: vi.fn(),
  draft: null as unknown,
  draftLoading: false,
  save: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, replace: vi.fn() }) }));
vi.mock("@/lib/hooks/agents", () => ({
  useAgents: () => ({
    data: [
      { id: "ag1", name: "Security Reviewer" },
      { id: "ag2", name: "API Contract Reviewer" },
    ],
    isLoading: false,
  }),
}));
vi.mock("@/lib/hooks/conventions", async () => {
  const { fakeMutation } = await import("@/test/mutation-mock");
  return {
    useConventionSkillDraft: () => ({ data: h.draft, isLoading: h.draftLoading, isError: false, refetch: vi.fn() }),
    useCreateConventionSkill: fakeMutation((v: unknown) => h.save(v)),
  };
});

import { CreateConventionSkillModal } from "./CreateConventionSkillModal";

const DRAFT: ConventionSkillDraft = {
  name: "repo-conventions",
  description: "Use when writing or reviewing code in acme/payments-api.",
  type: "convention",
  body: "Coding conventions extracted from acme/payments-api.\n\n## Hooks are named useXxx",
  existing: null,
};

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  h.draft = DRAFT;
  h.draftLoading = false;
});

function renderModal() {
  const onClose = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={{ conventions, skills }}>
      <ToastProvider>
        <CreateConventionSkillModal repoId="r1" repoFullName="acme/payments-api" acceptedIds={["c1", "c2"]} onClose={onClose} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
  return onClose;
}

const dialog = () => screen.getByRole("dialog");

async function pickAgent(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(within(dialog()).getByText("Choose an agent…"));
  await user.click(within(dialog()).getByText(name));
}

describe("CreateConventionSkillModal", () => {
  it("fills the form from the draft; Create waits for an agent", async () => {
    const user = userEvent.setup();
    renderModal();
    const d = dialog();
    expect(within(d).getByText("Create skill from conventions")).toBeInTheDocument();
    expect(within(d).getByText(/Merged from 2 accepted conventions in acme\/payments-api/)).toBeInTheDocument();
    expect(within(d).getByRole("textbox", { name: "Name" })).toHaveValue("repo-conventions");
    expect(within(d).getByRole("textbox", { name: "Description" })).toHaveValue(DRAFT.description);
    expect(within(d).getByRole("combobox")).toHaveValue("convention");
    expect(within(d).getByRole("textbox", { name: "Skill body" })).toHaveValue(DRAFT.body);
    expect(within(d).getByRole("switch", { name: "Enabled" })).toHaveAttribute("aria-checked", "true");
    expect(within(d).getByText("Saved as v1 · added to Skills Lab")).toBeInTheDocument();

    const create = within(d).getByRole("button", { name: "Create skill" });
    expect(create).toBeDisabled();
    await pickAgent(user, "Security Reviewer");
    expect(create).toBeEnabled();
    expect(agent().id).toBe("ag1"); // fixture sanity: the picker lists agents by id/name only
  });

  it("edits name, body and Enabled, picks an agent, saves the payload, toasts and opens the skill", async () => {
    const user = userEvent.setup();
    h.save.mockResolvedValue(skill({ id: "sk-9", name: "payments-conventions", source: "extracted" }));
    const onClose = renderModal();
    const d = dialog();

    const name = within(d).getByRole("textbox", { name: "Name" });
    await user.clear(name);
    await user.type(name, "payments-conventions");
    expect(within(d).getByText("payments-conventions.md")).toBeInTheDocument();
    const body = within(d).getByRole("textbox", { name: "Skill body" });
    await user.clear(body);
    await user.type(body, "# House rules");
    expect(within(d).getByText("unsaved")).toBeInTheDocument();
    await user.click(within(d).getByRole("switch", { name: "Enabled" }));
    await pickAgent(user, "API Contract Reviewer");
    await user.click(within(d).getByRole("button", { name: "Create skill" }));

    expect(h.save).toHaveBeenCalledWith({
      repoId: "r1",
      body: {
        name: "payments-conventions",
        description: DRAFT.description,
        type: "convention",
        enabled: false,
        body: "# House rules",
        agent_id: "ag2",
        candidate_ids: ["c1", "c2"],
      },
    });
    await vi.waitFor(() => expect(h.push).toHaveBeenCalledWith("/skills/sk-9?tab=preview"));
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByText("Skill payments-conventions saved and linked to API Contract Reviewer")).toBeInTheDocument();
  });

  it("an existing repo-conventions announces the next version; a 409 shows the mapped message; Cancel saves nothing", async () => {
    const user = userEvent.setup();
    h.draft = { ...DRAFT, existing: { id: "sk-1", version: 2 } };
    h.save.mockRejectedValue(new ApiError("taken", 409, "skill_name_taken", { name: "repo-conventions" }));
    const onClose = renderModal();
    const d = dialog();
    expect(within(d).getByText("repo-conventions already exists — saved as v3")).toBeInTheDocument();

    await pickAgent(user, "Security Reviewer");
    await user.click(within(d).getByRole("button", { name: "Create skill" }));
    expect(await within(d).findByRole("alert")).toHaveTextContent(
      "A skill with this name already exists and was not extracted — choose another name.",
    );
    expect(h.push).not.toHaveBeenCalled();

    await user.click(within(d).getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(h.save).toHaveBeenCalledTimes(1);
  });

  it("shows a skeleton while the draft loads", () => {
    h.draft = undefined;
    h.draftLoading = true;
    renderModal();
    expect(within(dialog()).queryByRole("textbox", { name: "Name" })).not.toBeInTheDocument();
    expect(within(dialog()).getByRole("button", { name: "Create skill" })).toBeDisabled();
  });
});
