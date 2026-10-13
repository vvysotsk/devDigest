import type {
  AgentSkill,
  AgentSkillsPut,
  AgentVersionSkill,
  Skill,
  SkillPatch,
} from '@devdigest/shared';
import type { SkillEditState, StoredAgentSkill, StoredSkill } from './types.js';

/**
 * Pure rules of the skills module (no I/O): version bump, the D4 ack rule,
 * link-list comparison and DTO completion.
 */

/** Version of a newly created skill (and of its first `skill_versions` row). */
export const INITIAL_SKILL_VERSION = 1;

/** The unique index behind 409 `skill_name_taken`. */
export const SKILL_NAME_UNIQUE = 'skills_ws_name_uq';

/**
 * D5: a change of name / description / type / body bumps the version; `enabled`
 * alone does not. A field sent with its current value is not a change.
 */
export function bumpsVersion(current: SkillEditState, patch: SkillPatch): boolean {
  return (
    (patch.name !== undefined && patch.name !== current.name) ||
    (patch.description !== undefined && patch.description !== current.description) ||
    (patch.type !== undefined && patch.type !== current.type) ||
    (patch.body !== undefined && patch.body !== current.body)
  );
}

/**
 * D4: enabling an imported skill that was never acknowledged needs the
 * acknowledgement. True = this patch enables such a skill (the caller then
 * requires `acknowledge_injection` and stores `acknowledged_at`).
 */
export function needsAck(current: SkillEditState, patch: SkillPatch): boolean {
  return patch.enabled === true && IMPORTED_SOURCES.has(current.source) && current.acknowledgedAt === null;
}

/** Sources whose text came from outside the workspace: the D4 ack rule applies to them. */
export const IMPORTED_SOURCES: ReadonlySet<SkillEditState['source']> = new Set(['imported_file', 'imported_url']);

/** The ordered links a `PUT /agents/:id/skills` body describes (`order = index`). */
export function toLinks(body: AgentSkillsPut): AgentVersionSkill[] {
  return body.skills.map((s, i) => ({ skill_id: s.skill_id, order: i, enabled: s.enabled }));
}

/** True when two ordered link lists differ in ids, order or enabled flags. */
export function linksChanged(before: AgentVersionSkill[], after: AgentVersionSkill[]): boolean {
  if (before.length !== after.length) return true;
  return before.some((b, i) => {
    const a = after[i]!;
    return b.skill_id !== a.skill_id || b.order !== a.order || b.enabled !== a.enabled;
  });
}

/** Ids of `wanted` missing from `found` (order of `wanted`). */
export function missingIds(wanted: string[], found: string[]): string[] {
  const have = new Set(found);
  return wanted.filter((id) => !have.has(id));
}

/** Complete a stored skill into the `Skill` contract with its body token count. */
export function toSkillDto(stored: StoredSkill, countTokens: (text: string) => number): Skill {
  return { ...stored, body_tokens: countTokens(stored.body) };
}

/** Complete a stored link into the `AgentSkill` contract. */
export function toAgentSkillDto(
  link: StoredAgentSkill,
  countTokens: (text: string) => number,
): AgentSkill {
  return {
    skill_id: link.skill_id,
    order: link.order,
    enabled: link.enabled,
    skill: toSkillDto(link.skill, countTokens),
  };
}

/**
 * True when `err` (or its `cause` chain) is Postgres' unique violation on
 * `constraint` — postgres-js errors carry `code` and `constraint_name`.
 */
export function isUniqueViolation(err: unknown, constraint: string): boolean {
  let e: unknown = err;
  for (let depth = 0; e && typeof e === 'object' && depth < 5; depth++) {
    const x = e as { code?: unknown; constraint_name?: unknown; cause?: unknown };
    if (x.code === '23505' && x.constraint_name === constraint) return true;
    e = x.cause;
  }
  return false;
}
