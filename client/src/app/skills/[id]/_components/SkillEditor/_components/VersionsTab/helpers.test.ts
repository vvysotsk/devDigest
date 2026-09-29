import { describe, it, expect } from "vitest";
import type { SkillVersion } from "@devdigest/shared";
import { lineDiff, versionRows, MAX_DIFF_CELLS } from "./helpers";

const kinds = (before: string, after: string) => lineDiff(before, after).map((l) => `${l.kind[0]}:${l.text}`);

describe("lineDiff", () => {
  it("identical bodies are all `same`", () => {
    expect(kinds("a\nb", "a\nb")).toEqual(["s:a", "s:b"]);
  });

  it("an added line is `add`, a removed line is `del`", () => {
    expect(kinds("a\nc", "a\nb\nc")).toEqual(["s:a", "a:b", "s:c"]);
    expect(kinds("a\nb\nc", "a\nc")).toEqual(["s:a", "d:b", "s:c"]);
  });

  it("a changed line is a deletion followed by an addition", () => {
    expect(kinds("a\nold\nz", "a\nnew\nz")).toEqual(["s:a", "d:old", "a:new", "s:z"]);
  });

  it("keeps the longest common subsequence when lines move", () => {
    expect(kinds("x\na\nb\nc", "a\nb\nc\nx")).toEqual(["d:x", "s:a", "s:b", "s:c", "a:x"]);
  });

  it("an empty body diffs as one empty line", () => {
    expect(kinds("", "a")).toEqual(["d:", "a:a"]);
  });

  it("falls back to all-out / all-in above the cell limit", () => {
    const n = Math.ceil(Math.sqrt(MAX_DIFF_CELLS)) + 1;
    const before = Array.from({ length: n }, (_, i) => `b${i}`).join("\n");
    const after = Array.from({ length: n }, (_, i) => (i === 0 ? "b0" : `a${i}`)).join("\n");
    const out = lineDiff(before, after);
    expect(out).toHaveLength(2 * n);
    expect(out.slice(0, n).every((l) => l.kind === "del")).toBe(true);
    expect(out.slice(n).every((l) => l.kind === "add")).toBe(true);
  });
});

describe("versionRows", () => {
  it("orders newest first and flags a body-less change", () => {
    const v = (version: number, body: string): SkillVersion => ({
      skill_id: "s",
      version,
      body,
      created_at: "2026-09-20T10:00:00.000Z",
    });
    const rows = versionRows([v(2, "b"), v(1, "a"), v(3, "b")]);
    expect(rows.map((r) => [r.version.version, r.metadataOnly])).toEqual([
      [3, true],
      [2, false],
      [1, false],
    ]);
  });
});
