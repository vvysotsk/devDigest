/**
 * The conventions hooks' cache rules — the view tests mock this module, so the
 * pure pieces and the 409 `scan_running` re-fetch are pinned here.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { conventionCandidate, conventionScan } from "@/test/fixtures";

const h = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/api")>();
  return { ...mod, api: { ...mod.api, post: (...args: unknown[]) => h.post(...args) } };
});

import { applyCandidate, conventionsPollInterval, useExtractConventions } from "./conventions";

beforeEach(() => vi.clearAllMocks());

describe("applyCandidate (#48)", () => {
  const a = conventionCandidate({ id: "c1", rule: "A" });
  const b = conventionCandidate({ id: "c2", rule: "B" });
  const state = { scan: conventionScan(), candidates: [a, b] };

  it("replaces the candidate by id", () => {
    const next = applyCandidate(state, { ...b, status: "accepted", rule: "B2" });
    expect(next!.candidates.map((c) => [c.id, c.status, c.rule])).toEqual([
      ["c1", "pending", "A"],
      ["c2", "accepted", "B2"],
    ]);
    expect(next!.scan).toBe(state.scan);
  });

  it("removes a rejected candidate", () => {
    const next = applyCandidate(state, { ...a, status: "rejected" });
    expect(next!.candidates.map((c) => c.id)).toEqual(["c2"]);
  });

  it("leaves the state unchanged for an unknown id, and undefined stays undefined", () => {
    expect(applyCandidate(state, conventionCandidate({ id: "zzz" }))).toBe(state);
    expect(applyCandidate(undefined, a)).toBeUndefined();
  });
});

describe("conventionsPollInterval (D14)", () => {
  it("polls only while the latest scan is running", () => {
    expect(conventionsPollInterval({ scan: conventionScan({ status: "running" }), candidates: [] })).toBe(4000);
    expect(conventionsPollInterval({ scan: conventionScan({ status: "done" }), candidates: [] })).toBe(false);
    expect(conventionsPollInterval({ scan: conventionScan({ status: "failed" }), candidates: [] })).toBe(false);
    expect(conventionsPollInterval({ scan: null, candidates: [] })).toBe(false);
    expect(conventionsPollInterval(undefined)).toBe(false);
  });
});

describe("useExtractConventions", () => {
  function setup() {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useExtractConventions(), { wrapper });
    return { qc, invalidate, result };
  }

  it("a 409 scan_running re-fetches the repo's conventions so the page follows the running scan", async () => {
    h.post.mockRejectedValue(new ApiError("already running", 409, "scan_running", { scan_id: "s9" }));
    const { invalidate, result } = setup();
    result.current.mutate("r1");
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["conventions", "r1"] });
  });

  it("any other error does not touch the cache; a success seeds the running scan", async () => {
    h.post.mockRejectedValue(new ApiError("no clone", 409, "repo_not_cloned"));
    const first = setup();
    first.result.current.mutate("r1");
    await waitFor(() => expect(first.result.current.isError).toBe(true));
    expect(first.invalidate).not.toHaveBeenCalled();

    const scan = conventionScan({ id: "s1", status: "running" });
    h.post.mockResolvedValue(scan);
    const second = setup();
    second.result.current.mutate("r2");
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));
    expect(second.qc.getQueryData(["conventions", "r2"])).toEqual({ scan, candidates: [] });
    expect(h.post).toHaveBeenLastCalledWith("/repos/r2/conventions/extract");
  });
});
