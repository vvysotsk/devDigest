import { describe, it, expect, vi, afterEach } from "vitest";
import { relativeTime } from "./date-format";

afterEach(() => vi.useRealTimers());

describe("relativeTime", () => {
  it("buckets into now / minutes / hours / days and dashes the unknown", () => {
    vi.useFakeTimers({ now: new Date("2026-10-01T12:00:00.000Z") });
    expect(relativeTime("2026-10-01T11:59:40.000Z")).toBe("now");
    expect(relativeTime("2026-10-01T11:15:00.000Z")).toBe("45m");
    expect(relativeTime("2026-10-01T09:00:00.000Z")).toBe("3h");
    expect(relativeTime("2026-09-29T12:00:00.000Z")).toBe("2d");
    expect(relativeTime(null)).toBe("—");
    expect(relativeTime("not a date")).toBe("—");
  });
});
