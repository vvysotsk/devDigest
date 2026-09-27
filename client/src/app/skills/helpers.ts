/** Pure helpers shared by /skills and /skills/:id. */
import { SkillErrorCode, SkillName, type Skill } from "@devdigest/shared";
import { ApiError } from "@/lib/api";

/** i18n key (`skills` namespace) for a skills-route error code; null for any other error. */
export function skillErrorKey(err: unknown): string | null {
  if (!(err instanceof ApiError) || !err.code) return null;
  const code = SkillErrorCode.safeParse(err.code);
  return code.success ? `errors.${code.data}` : null;
}

/** Translated message for a mutation error: the SkillErrorCode text, else the API message. */
export function skillErrorMessage(t: (key: string) => string, err: unknown): string {
  const key = skillErrorKey(err);
  if (key) return t(key);
  return err instanceof Error ? err.message : String(err);
}

/** An imported skill that was never enabled needs the injection acknowledgement (D4). */
export function needsInjectionAck(skill: Pick<Skill, "source" | "acknowledged_at">): boolean {
  return skill.source === "imported_file" && skill.acknowledged_at === null;
}

export function isValidSkillName(name: string): boolean {
  return SkillName.safeParse(name).success;
}

/** True when name + description pass the contract's rules (SkillName, non-empty description). */
export function isSkillMetaValid(meta: { name: string; description: string }): boolean {
  return isValidSkillName(meta.name) && meta.description.trim() !== "";
}

/** Live token estimate for an unsaved body (D7): ≈ chars / 4. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Case-insensitive filter over a skill's name + description. */
export function filterSkills(skills: Skill[], search: string): Skill[] {
  const q = search.trim().toLowerCase();
  if (!q) return skills;
  return skills.filter((s) => `${s.name} ${s.description}`.toLowerCase().includes(q));
}
