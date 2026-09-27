import type { Skill, SkillPatch } from "@devdigest/shared";

/** Only the fields the draft changed — a save sends nothing else (one version bump, D5). */
export function skillPatch(
  skill: Pick<Skill, "name" | "description" | "type" | "body">,
  draft: Pick<Skill, "name" | "description" | "type" | "body">,
): SkillPatch {
  const patch: SkillPatch = {};
  if (draft.name !== skill.name) patch.name = draft.name;
  if (draft.description.trim() !== skill.description) patch.description = draft.description.trim();
  if (draft.type !== skill.type) patch.type = draft.type;
  if (draft.body !== skill.body) patch.body = draft.body;
  return patch;
}
