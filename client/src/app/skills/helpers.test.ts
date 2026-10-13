/** The client's first-enable rule mirrors the server's: both imported sources need the acknowledgement once. */
import { describe, it, expect } from "vitest";
import { needsInjectionAck } from "./helpers";

describe("needsInjectionAck", () => {
  it("is true for an unacknowledged file or URL import, false otherwise", () => {
    expect(needsInjectionAck({ source: "imported_file", acknowledged_at: null })).toBe(true);
    expect(needsInjectionAck({ source: "imported_url", acknowledged_at: null })).toBe(true);
    expect(needsInjectionAck({ source: "imported_url", acknowledged_at: "2026-10-01T10:00:00.000Z" })).toBe(false);
    expect(needsInjectionAck({ source: "manual", acknowledged_at: null })).toBe(false);
    expect(needsInjectionAck({ source: "extracted", acknowledged_at: null })).toBe(false);
  });
});
