/**
 * /conventions — Run Scan vs ReScan (#45), polling state, cards with rule /
 * category / GitHub evidence link / snippet / confidence (#46), Accept / Reject /
 * Edit in place (#47, #49), a rejected card leaves the list (#48), "Create
 * skill" only after an accept (#50) and it opens the modal (#51), the failed /
 * 409 / load-error states.
 */
import React from "react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ConventionPatch, ConventionsState } from "@devdigest/shared";
import conventions from "../../../../../messages/en/conventions.json";
import skills from "../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";
import { ApiError } from "@/lib/api";
import { conventionCandidate, conventionScan } from "@/test/fixtures";

// `store` plays the query cache: the patch mutation writes it, useConventions reads it.
const h = vi.hoisted(() => ({
  push: vi.fn(),
  repo: {
    repoId: "r1" as string | null,
    activeRepo: { id: "r1", name: "payments-api", full_name: "acme/payments-api" } as unknown,
    reposLoaded: true,
  },
  store: { current: undefined as ConventionsState | undefined, listeners: new Set<() => void>() },
  loading: false,
  error: false,
  refetch: vi.fn(),
  extract: vi.fn(),
  patch: vi.fn(),
  save: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, replace: vi.fn() }) }));
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/repo-context", () => ({ useActiveRepo: () => h.repo }));
vi.mock("@/lib/hooks/agents", () => ({
  useAgents: () => ({ data: [{ id: "ag1", name: "Security Reviewer" }], isLoading: false }),
}));
vi.mock("@/lib/hooks/conventions", async () => {
  const { fakeMutation } = await import("@/test/mutation-mock");
  const subscribe = (l: () => void) => {
    h.store.listeners.add(l);
    return () => h.store.listeners.delete(l);
  };
  return {
    useConventions: () => ({
      data: React.useSyncExternalStore(subscribe, () => h.store.current),
      isLoading: h.loading,
      isError: h.error,
      refetch: h.refetch,
    }),
    useExtractConventions: fakeMutation((repoId: string) => h.extract(repoId)),
    usePatchConvention: fakeMutation((v: { repoId: string; id: string; patch: ConventionPatch }) => h.patch(v)),
    useConventionSkillDraft: () => ({
      data: { name: "repo-conventions", description: "Use when…", type: "convention", body: "# body", existing: null },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
    useCreateConventionSkill: fakeMutation((v: unknown) => h.save(v)),
  };
});

import { ConventionsView } from "./ConventionsView";

function setState(next: ConventionsState | undefined) {
  h.store.current = next;
  h.store.listeners.forEach((l) => l());
}

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  h.repo = { repoId: "r1", activeRepo: { id: "r1", name: "payments-api", full_name: "acme/payments-api" }, reposLoaded: true };
  h.loading = false;
  h.error = false;
  // The fake server applies the patch to the "cache" the way the real hook does (replace; drop when rejected).
  h.patch.mockImplementation(({ id, patch }: { id: string; patch: ConventionPatch }) => {
    const state = h.store.current!;
    const current = state.candidates.find((c) => c.id === id)!;
    const next = { ...current, ...patch };
    setState({
      ...state,
      candidates:
        next.status === "rejected"
          ? state.candidates.filter((c) => c.id !== id)
          : state.candidates.map((c) => (c.id === id ? next : c)),
    });
    return next;
  });
});

function renderView(state: ConventionsState | undefined) {
  h.store.current = state;
  return render(
    <NextIntlClientProvider locale="en" messages={{ conventions, skills }}>
      <ToastProvider>
        <ConventionsView />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

const card = (rule: string) => screen.getByRole("listitem", { name: rule });
const doneState = (): ConventionsState => ({
  scan: conventionScan({ id: "s1", status: "done", sample_count: 14, head_sha: "f00dcafe1234" }),
  candidates: [
    conventionCandidate({ id: "c1", rule: "Hooks are named useXxx", status: "accepted", category: "naming", confidence: 0.9 }),
    conventionCandidate({ id: "c2", rule: "Services throw NotFoundError", status: "accepted", category: "error-handling", evidence_path: "src/modules/repos/service.ts", evidence_line: 4, confidence: 0.8 }),
    conventionCandidate({ id: "c3", rule: "Tests use userEvent", status: "pending", category: "testing", evidence_path: "src/test/setup.ts", evidence_line: 1, confidence: 0.75 }),
  ],
});

describe("ConventionsView", () => {
  it("before any scan: Run Scan (not ReScan), the empty state, no Create skill; Run Scan extracts the active repo (#45, #50)", async () => {
    const user = userEvent.setup();
    renderView({ scan: null, candidates: [] });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Conventions in payments-api");
    const runButtons = screen.getAllByRole("button", { name: "Run Scan" });
    expect(runButtons).toHaveLength(2); // header + empty-state CTA
    expect(screen.queryByRole("button", { name: "ReScan" })).not.toBeInTheDocument();
    expect(screen.getByText("No conventions extracted yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create skill" })).not.toBeInTheDocument();

    await user.click(runButtons[0]!);
    expect(h.extract).toHaveBeenCalledWith("r1");
  });

  it("while a scan runs the page says Scanning… and the scan button waits", () => {
    renderView({ scan: conventionScan({ status: "running", finished_at: null }), candidates: [] });
    expect(screen.getByRole("button", { name: "Scanning…" })).toBeDisabled();
    expect(screen.getAllByText("Scanning…").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("a finished scan lists the cards with rule, category, GitHub evidence at the scan's sha, snippet and confidence; ReScan; N of M accepted; Create skill opens the modal (#46, #50, #51)", async () => {
    const user = userEvent.setup();
    renderView(doneState());

    expect(screen.getByText(/Detected from 14 sample files · last scan/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ReScan" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run Scan" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);

    const c3 = card("Tests use userEvent");
    expect(within(c3).getByText("testing")).toBeInTheDocument();
    const link = within(c3).getByRole("link", { name: "src/test/setup.ts:1" });
    expect(link).toHaveAttribute("href", "https://github.com/acme/payments-api/blob/f00dcafe1234/src/test/setup.ts#L1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(within(c3).getByText("75%")).toBeInTheDocument();
    expect(within(c3).getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(within(card("Hooks are named useXxx")).getByRole("button", { name: "Accepted" })).toBeInTheDocument();
    expect(within(card("Hooks are named useXxx")).getByText(/export function useAgents\(\)/)).toBeInTheDocument();
    expect(within(card("Hooks are named useXxx")).getByText("90%")).toBeInTheDocument();

    expect(screen.getByText("2 of 3 accepted")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create skill" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Create skill from conventions")).toBeInTheDocument();
    expect(within(dialog).getByText(/Merged from 2 accepted conventions in acme\/payments-api/)).toBeInTheDocument();
  });

  it("Accept / Reject / Edit patch the candidate; a rejected card disappears; Edit saves rule + category in place (#47, #48, #49)", async () => {
    const user = userEvent.setup();
    renderView(doneState());

    await user.click(within(card("Tests use userEvent")).getByRole("button", { name: "Accept" }));
    expect(h.patch).toHaveBeenCalledWith({ repoId: "r1", id: "c3", patch: { status: "accepted" } });
    expect(await within(card("Tests use userEvent")).findByRole("button", { name: "Accepted" })).toBeInTheDocument();
    expect(screen.getByText("3 of 3 accepted")).toBeInTheDocument();

    // Accepted again → back to pending (undo).
    await user.click(within(card("Tests use userEvent")).getByRole("button", { name: "Accepted" }));
    expect(h.patch).toHaveBeenLastCalledWith({ repoId: "r1", id: "c3", patch: { status: "pending" } });

    await user.click(within(card("Services throw NotFoundError")).getByRole("button", { name: "Reject" }));
    expect(h.patch).toHaveBeenLastCalledWith({ repoId: "r1", id: "c2", patch: { status: "rejected" } });
    await vi.waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));
    expect(screen.queryByRole("listitem", { name: "Services throw NotFoundError" })).not.toBeInTheDocument();
    expect(screen.getByText("1 of 2 accepted")).toBeInTheDocument();

    // Edit → Cancel leaves everything untouched.
    await user.click(within(card("Hooks are named useXxx")).getByRole("button", { name: "Edit" }));
    const calls = h.patch.mock.calls.length;
    await user.click(within(card("Hooks are named useXxx")).getByRole("button", { name: "Cancel" }));
    expect(h.patch.mock.calls).toHaveLength(calls);
    expect(within(card("Hooks are named useXxx")).getByRole("button", { name: "Edit" })).toBeInTheDocument();

    // Edit → change the rule and category → Save.
    await user.click(within(card("Hooks are named useXxx")).getByRole("button", { name: "Edit" }));
    const editing = card("Hooks are named useXxx");
    const ruleBox = within(editing).getByRole("textbox", { name: "Rule" });
    await user.clear(ruleBox);
    await user.type(ruleBox, "Hooks are named useXxx and live in lib/hooks");
    await user.selectOptions(within(editing).getByRole("combobox"), "structure");
    await user.click(within(editing).getByRole("button", { name: "Save" }));
    expect(h.patch).toHaveBeenLastCalledWith({
      repoId: "r1",
      id: "c1",
      patch: { rule: "Hooks are named useXxx and live in lib/hooks", category: "structure" },
    });
    const edited = await screen.findByRole("listitem", { name: "Hooks are named useXxx and live in lib/hooks" });
    expect(within(edited).getByText("structure")).toBeInTheDocument();
  });

  it("a failed scan shows its error; a 409 scan_running from extract shows the mapped message inline; a load error shows ErrorState", async () => {
    const user = userEvent.setup();
    const { unmount } = renderView({ scan: conventionScan({ status: "failed", error: "model timeout" }), candidates: [] });
    expect(screen.getByRole("alert")).toHaveTextContent("Extraction failed: model timeout");
    // Header button + the empty-state CTA (a failed scan has no candidates): both offer ReScan.
    const rescans = screen.getAllByRole("button", { name: "ReScan" });
    expect(rescans).toHaveLength(2);
    expect(rescans[0]).toBeEnabled();
    unmount();

    h.extract.mockRejectedValue(new ApiError("already running", 409, "scan_running"));
    renderView(doneState());
    await user.click(screen.getByRole("button", { name: "ReScan" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A scan is already running for this repo — the page follows it.");
    cleanup();

    h.error = true;
    renderView(undefined);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load conventions.");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(h.refetch).toHaveBeenCalled();
  });

  it("without an accepted candidate there is no Create skill; without a repo the page explains it", () => {
    const state = doneState();
    state.candidates = state.candidates.map((c) => ({ ...c, status: "pending" as const }));
    renderView(state);
    expect(screen.getByText("0 of 3 accepted")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create skill" })).not.toBeInTheDocument();
    cleanup();

    h.repo = { repoId: null, activeRepo: null, reposLoaded: true };
    renderView(undefined);
    expect(screen.getByText("No repository yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run Scan" })).not.toBeInTheDocument();
  });
});
