import type { AgentVersionSkill } from '@devdigest/shared';

/**
 * What the agents module needs from skills (L02, D16): the effective skill
 * count behind `Agent.skill_count` and the links a version snapshot stores.
 * Satisfied by `container.skillsRepo` (the skills module's port), wired in the
 * composition root — this module never imports `modules/skills`.
 */
export interface AgentSkillLinks {
  /** Links with `agent_skills.enabled AND skills.enabled` per agent; absent = 0. */
  effectiveSkillCounts(agentIds: string[]): Promise<Map<string, number>>;
  /** Every link of the agent as `{skill_id, order, enabled}`, ordered. */
  snapshotLinks(agentId: string): Promise<AgentVersionSkill[]>;
}
