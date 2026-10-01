/** Pure helpers shared by /skills and /skills/:id. */
import type { Skill } from "@devdigest/shared";

/** An imported skill that was never enabled needs the injection acknowledgement (D4). */
export function needsInjectionAck(skill: Pick<Skill, "source" | "acknowledged_at">): boolean {
  return skill.source === "imported_file" && skill.acknowledged_at === null;
}

/** Case-insensitive filter over a skill's name + description. */
export function filterSkills(skills: Skill[], search: string): Skill[] {
  const q = search.trim().toLowerCase();
  if (!q) return skills;
  return skills.filter((s) => `${s.name} ${s.description}`.toLowerCase().includes(q));
}
