import type { AgentSkill, AgentSkillsPut, Skill } from "@devdigest/shared";

/** One entry of the ordered list `PUT /agents/:id/skills` sends. */
export type SkillLinkDraft = AgentSkillsPut["skills"][number];

/** The saved links as a draft list, in prompt order. */
export function linksToDraft(links: AgentSkill[]): SkillLinkDraft[] {
  return [...links].sort((a, b) => a.order - b.order).map((l) => ({ skill_id: l.skill_id, enabled: l.enabled }));
}

export function sameDraft(a: SkillLinkDraft[], b: SkillLinkDraft[]): boolean {
  return a.length === b.length && a.every((x, i) => x.skill_id === b[i]!.skill_id && x.enabled === b[i]!.enabled);
}

/**
 * Tick / untick (D2): ticking an unlinked skill links it at the end, enabled;
 * unticking keeps the link and its position with `enabled: false`.
 */
export function setChecked(items: SkillLinkDraft[], skillId: string, checked: boolean): SkillLinkDraft[] {
  if (!items.some((x) => x.skill_id === skillId)) {
    return checked ? [...items, { skill_id: skillId, enabled: true }] : items;
  }
  return items.map((x) => (x.skill_id === skillId ? { ...x, enabled: checked } : x));
}

/** Detach removes the link entirely. */
export function detach(items: SkillLinkDraft[], skillId: string): SkillLinkDraft[] {
  return items.filter((x) => x.skill_id !== skillId);
}

/** Move a linked skill to another linked skill's position (↑ / ↓ and drag-and-drop). */
export function moveTo(items: SkillLinkDraft[], skillId: string, targetId: string): SkillLinkDraft[] {
  const from = items.findIndex((x) => x.skill_id === skillId);
  const to = items.findIndex((x) => x.skill_id === targetId);
  if (from < 0 || to < 0 || from === to) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

/** Neighbour id for ↑ (-1) / ↓ (+1); null at either end. */
export function neighbour(items: SkillLinkDraft[], skillId: string, step: -1 | 1): string | null {
  const i = items.findIndex((x) => x.skill_id === skillId);
  return items[i + step]?.skill_id ?? null;
}

export interface SkillRowModel {
  skill: Skill;
  /** The draft link, or null for an unlinked skill. */
  link: SkillLinkDraft | null;
}

/**
 * Drag & drop reorders only enabled skills (HW02 #31): the row is linked, its
 * link is enabled on this agent, and the skill is enabled globally.
 */
export function isMovable(row: SkillRowModel): boolean {
  return row.link !== null && row.link.enabled && row.skill.enabled;
}

/** Linked skills first in draft order, then the unlinked ones by name; filtered by name. */
export function buildRows(items: SkillLinkDraft[], skills: Skill[], filter: string): SkillRowModel[] {
  const byId = new Map(skills.map((sk) => [sk.id, sk]));
  const linkedIds = new Set(items.map((x) => x.skill_id));
  const linked = items.flatMap((link) => {
    const skill = byId.get(link.skill_id);
    return skill ? [{ skill, link }] : [];
  });
  const unlinked = skills
    .filter((sk) => !linkedIds.has(sk.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((skill) => ({ skill, link: null }));
  const q = filter.trim().toLowerCase();
  const rows = [...linked, ...unlinked];
  return q ? rows.filter((r) => r.skill.name.toLowerCase().includes(q)) : rows;
}

/** Effective links: enabled on the agent AND globally — what reaches the prompt ("N of M enabled"). */
export function countEnabled(items: SkillLinkDraft[], skills: Skill[]): number {
  const enabled = new Set(skills.filter((sk) => sk.enabled).map((sk) => sk.id));
  return items.filter((x) => x.enabled && enabled.has(x.skill_id)).length;
}
