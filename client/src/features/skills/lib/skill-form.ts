/** Validation of the skill form fields (create modal, import draft, Config tab, conventions modal). */
import { SkillName } from "@devdigest/shared";

export function isValidSkillName(name: string): boolean {
  return SkillName.safeParse(name).success;
}

/** True when name + description pass the contract's rules (SkillName, non-empty description). */
export function isSkillMetaValid(meta: { name: string; description: string }): boolean {
  return isValidSkillName(meta.name) && meta.description.trim() !== "";
}
