/** Every SkillErrorCode the server can return has a translated message. */
import { describe, it, expect } from "vitest";
import { SkillErrorCode } from "@devdigest/shared";
import messages from "../../../../messages/en/skills.json";
import { ApiError } from "@/lib/api";
import { skillErrorKey } from "./skill-errors";

describe("skillErrorKey", () => {
  it.each(SkillErrorCode.options)("maps %s to an existing skills.errors message", (code) => {
    const key = skillErrorKey(new ApiError("server text", 422, code));
    expect(key).toBe(`errors.${code}`);
    expect((messages.errors as Record<string, string>)[code]).toBeTruthy();
  });

  it("returns null for codes outside SkillErrorCode and for non-API errors", () => {
    expect(skillErrorKey(new ApiError("boom", 500, "internal"))).toBeNull();
    expect(skillErrorKey(new Error("network"))).toBeNull();
  });
});
