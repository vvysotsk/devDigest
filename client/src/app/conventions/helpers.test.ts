/** Every ConventionErrorCode the server can return has a translated message; the small formatters. */
import { describe, it, expect } from "vitest";
import { ConventionErrorCode } from "@devdigest/shared";
import messages from "../../../messages/en/conventions.json";
import { ApiError } from "@/lib/api";
import { conventionCandidate } from "@/test/fixtures";
import { acceptedCount, conventionErrorKey, conventionErrorMessage, evidenceLabel, formatConfidence } from "./helpers";

describe("conventionErrorKey", () => {
  it.each(ConventionErrorCode.options)("maps %s to an existing conventions.errors message", (code) => {
    const key = conventionErrorKey(new ApiError("server text", 409, code));
    expect(key).toBe(`errors.${code}`);
    expect((messages.errors as Record<string, string>)[code]).toBeTruthy();
  });

  it("maps not_found, and returns null for other codes and non-API errors", () => {
    expect(conventionErrorKey(new ApiError("gone", 404, "not_found"))).toBe("errors.not_found");
    expect(conventionErrorKey(new ApiError("boom", 500, "internal"))).toBeNull();
    expect(conventionErrorKey(new Error("network"))).toBeNull();
  });

  it("conventionErrorMessage falls back to the error's own message", () => {
    const t = (k: string) => `T(${k})`;
    expect(conventionErrorMessage(t, new ApiError("x", 409, "scan_running"))).toBe("T(errors.scan_running)");
    expect(conventionErrorMessage(t, new ApiError("server says no", 500, "internal"))).toBe("server says no");
    expect(conventionErrorMessage(t, "plain")).toBe("plain");
  });
});

describe("formatters", () => {
  it("formatConfidence rounds to a whole percent", () => {
    expect(formatConfidence(0.91)).toBe("91%");
    expect(formatConfidence(0.785)).toBe("79%");
    expect(formatConfidence(1)).toBe("100%");
    expect(formatConfidence(0)).toBe("0%");
  });

  it("acceptedCount counts accepted only; evidenceLabel is path:line", () => {
    const list = [
      conventionCandidate({ id: "a", status: "accepted" }),
      conventionCandidate({ id: "b", status: "pending" }),
      conventionCandidate({ id: "c", status: "accepted" }),
    ];
    expect(acceptedCount(list)).toBe(2);
    expect(acceptedCount([])).toBe(0);
    expect(evidenceLabel({ evidence_path: "src/lib/hooks/agents.ts", evidence_line: 3 })).toBe("src/lib/hooks/agents.ts:3");
  });
});
