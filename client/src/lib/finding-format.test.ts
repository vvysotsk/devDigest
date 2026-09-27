import { describe, it, expect } from "vitest";
import { lineLabel } from "./finding-format";

describe("lineLabel", () => {
  it("lineLabel renders a single line or a span", () => {
    expect(lineLabel({ start_line: 12, end_line: 12 })).toBe("12");
    expect(lineLabel({ start_line: 45, end_line: 52 })).toBe("45-52");
  });
});
