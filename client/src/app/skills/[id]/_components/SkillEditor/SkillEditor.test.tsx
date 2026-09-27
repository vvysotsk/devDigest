/**
 * /skills/:id editor — Config saves only the changed fields (one PUT → v2),
 * the body editor's unsaved chip + token estimate, the delete confirm with
 * "Used by N agents", and the Versions tab's "metadata change" rows.
 */
import React from "react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { Skill, SkillPatch, SkillVersion } from "@devdigest/shared";
import messages from "../../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";
import { skill } from "@/test/fixtures";

// `store` plays the query cache: the update mutation writes it, useSkill reads it.
const h = vi.hoisted(() => ({
  push: vi.fn(),
  update: vi.fn(),
  del: vi.fn(),
  versions: [] as SkillVersion[],
  store: { current: null as Skill | null, listeners: new Set<() => void>() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, replace: vi.fn() }) }));
vi.mock("@/features/skills/hooks", async () => {
  const { fakeMutation } = await import("@/test/mutation-mock");
  const subscribe = (l: () => void) => {
    h.store.listeners.add(l);
    return () => h.store.listeners.delete(l);
  };
  return {
    useSkill: () => ({
      data: React.useSyncExternalStore(subscribe, () => h.store.current),
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    }),
    useSkillVersions: () => ({ data: h.versions, isLoading: false, isError: false, refetch: vi.fn() }),
    useUpdateSkill: fakeMutation((v: { id: string; patch: SkillPatch }) => h.update(v)),
    useDeleteSkill: fakeMutation((id: string) => h.del(id)),
  };
});

import { SkillEditor } from "./SkillEditor";

function setSkill(next: Skill) {
  h.store.current = next;
  h.store.listeners.forEach((l) => l());
}

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  h.update.mockImplementation(({ patch }: { patch: SkillPatch }) => {
    const { acknowledge_injection: _ack, ...fields } = patch;
    const saved = { ...h.store.current!, ...fields, version: h.store.current!.version + 1, body_tokens: 20 };
    setSkill(saved);
    return saved;
  });
});

function renderEditor(tab: string, sk: Skill) {
  h.store.current = sk;
  render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <ToastProvider>
        <SkillEditor skillId={sk.id} tab={tab} onTab={() => {}} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

describe("SkillEditor — Config tab", () => {
  it("edits a local draft and saves only the changed fields in one PUT (Saved v2)", async () => {
    const user = userEvent.setup();
    renderEditor("config", skill({ id: "s1", name: "pr-quality-rubric", body: "# Rubric", body_tokens: 12 }));

    expect(screen.getByText("pr-quality-rubric.md")).toBeInTheDocument();
    expect(screen.getByText("≈ 12 tok (cl100k)")).toBeInTheDocument();
    expect(screen.getByText("The skill's interface — write it as a directive: 'Use when…'")).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Save skill" });
    expect(save).toBeDisabled(); // nothing changed yet

    const description = screen.getByRole("textbox", { name: "Description" });
    await user.clear(description);
    await user.type(description, "Use when grading a PR");
    const body = screen.getByRole("textbox", { name: "Skill body" });
    await user.type(body, "\n- tests");
    expect(screen.getByText("unsaved")).toBeInTheDocument();
    expect(screen.getByText("≈ 4 tok (chars/4)")).toBeInTheDocument(); // 16 chars / 4

    await user.click(save);
    expect(h.update).toHaveBeenCalledTimes(1);
    expect(h.update).toHaveBeenCalledWith({
      id: "s1",
      patch: { description: "Use when grading a PR", body: "# Rubric\n- tests" },
    });
    expect(await screen.findByText("Saved (v2)")).toBeInTheDocument();
    expect(screen.getByText("Skill saved (v2)")).toBeInTheDocument(); // toast
    expect(screen.queryByText("unsaved")).not.toBeInTheDocument();
    expect(screen.getByText("≈ 20 tok (cl100k)")).toBeInTheDocument();
  });

  it("delete asks for confirmation with the agent count, then deletes and leaves the page", async () => {
    const user = userEvent.setup();
    h.del.mockResolvedValue(undefined);
    renderEditor("config", skill({ id: "s1", name: "no-then-chains", agent_count: 2 }));

    await user.click(screen.getByRole("button", { name: "Delete skill" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Delete skill no-then-chains?")).toBeInTheDocument();
    expect(within(dialog).getByText("Used by 2 agents — their links will be removed.")).toBeInTheDocument();
    expect(h.del).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(h.del).toHaveBeenCalledWith("s1");
    await vi.waitFor(() => expect(h.push).toHaveBeenCalledWith("/skills"));
  });

  it("the Config Enabled switch of an unacknowledged imported skill goes through the confirm", async () => {
    const user = userEvent.setup();
    renderEditor("config", skill({ id: "s9", source: "imported_file", enabled: false, acknowledged_at: null }));

    await user.click(screen.getByRole("switch"));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(within(dialog).getByRole("button", { name: "Enable skill" }));
    expect(h.update).toHaveBeenCalledWith({ id: "s9", patch: { enabled: true, acknowledge_injection: true } });
  });
});

describe("SkillEditor — Enabled switch vs. the unsaved draft", () => {
  it("toggling Enabled writes {enabled} at once and the refetch keeps the unsaved body draft", async () => {
    const user = userEvent.setup();
    renderEditor("config", skill({ id: "s3", source: "manual", enabled: false, body: "# Rules" }));

    const body = screen.getByRole("textbox", { name: "Skill body" });
    await user.type(body, "\n- draft line");
    expect(screen.getByText("unsaved")).toBeInTheDocument();

    await user.click(screen.getByRole("switch"));
    // Immediate write of the flag only — the draft body is NOT sent.
    expect(h.update).toHaveBeenCalledTimes(1);
    expect(h.update).toHaveBeenCalledWith({ id: "s3", patch: { enabled: true } });
    // The mutation wrote the new skill into the "cache" (refetch): the switch
    // follows the server, the local draft survives.
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("textbox", { name: "Skill body" })).toHaveValue("# Rules\n- draft line");
    expect(screen.getByText("unsaved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save skill" })).toBeEnabled();
  });
});

describe("SkillEditor — Preview and Versions tabs", () => {
  it("Preview renders the Markdown and toggles to the raw text", async () => {
    const user = userEvent.setup();
    renderEditor("preview", skill({ body: "# Heading\n\n**bold** rule" }));
    expect(screen.getByRole("heading", { name: "Heading" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Raw" }));
    expect(screen.getByText(/\*\*bold\*\* rule/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Heading" })).not.toBeInTheDocument();
  });

  it("lists versions newest first, labels body-less changes and shows a version's raw body", async () => {
    const user = userEvent.setup();
    h.versions = [
      { skill_id: "s1", version: 1, body: "first body", created_at: "2026-09-20T10:00:00.000Z" },
      { skill_id: "s1", version: 2, body: "second body", created_at: "2026-09-21T10:00:00.000Z" },
      { skill_id: "s1", version: 3, body: "second body", created_at: "2026-09-22T10:00:00.000Z" },
    ];
    renderEditor("versions", skill({ id: "s1", version: 3 }));

    const rows = within(screen.getByRole("list", { name: "Versions" })).getAllByRole("button");
    expect(rows.map((r) => r.textContent)).toEqual([
      "v32026-09-22 10:00currentmetadata change",
      "v22026-09-21 10:00",
      "v12026-09-20 10:00",
    ]);

    await user.click(rows[2]!);
    expect(screen.getByText("first body")).toBeInTheDocument();
  });
});
