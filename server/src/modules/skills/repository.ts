import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import type { AgentVersionSkill, SkillVersion } from '@devdigest/shared';
import type { Db, DbOrTx } from '../../db/client.js';
import * as t from '../../db/schema.js';
import { SkillNameTakenError } from './errors.js';
import { SKILL_NAME_UNIQUE, isUniqueViolation } from './helpers.js';
import type {
  EffectiveSkill,
  NewSkillValues,
  SkillEditState,
  SkillUpdateValues,
  SkillsPort,
  StoredAgentSkill,
  StoredSkill,
} from './types.js';

type SkillRow = typeof t.skills.$inferSelect;

/** Links of any agent to the skill, enabled or not (`Skill.agent_count`). */
const agentCount = sql<number>`(select count(*)::int from ${t.agentSkills} where ${t.agentSkills.skillId} = ${t.skills.id})`;

function toStoredSkill(row: SkillRow, agents: number): StoredSkill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    source: row.source,
    body: row.body,
    enabled: row.enabled,
    version: row.version,
    evidence_files: row.evidenceFiles ?? null,
    agent_count: Number(agents),
    acknowledged_at: row.acknowledgedAt ? row.acknowledgedAt.toISOString() : null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

/** Rethrow a `skills_ws_name_uq` violation as 409 `skill_name_taken`. */
function mapNameTaken(err: unknown, name?: string): never {
  if (isUniqueViolation(err, SKILL_NAME_UNIQUE)) throw new SkillNameTakenError(name);
  throw err;
}

/**
 * L02 — skills data access. Owns `skills`, `skill_versions` and `agent_skills`
 * (D16). Returns contract-shaped values (`StoredSkill`, `AgentVersionSkill`, …),
 * never Drizzle rows. Writes take a `DbOrTx` so the service owns the
 * transaction (onion R4). Implements `SkillsPort` for other modules.
 */
export class SkillsRepository implements SkillsPort {
  constructor(private db: Db) {}

  // ---- skills ------------------------------------------------------------

  async list(workspaceId: string): Promise<StoredSkill[]> {
    const rows = await this.db
      .select({ skill: t.skills, agents: agentCount })
      .from(t.skills)
      .where(eq(t.skills.workspaceId, workspaceId))
      .orderBy(asc(t.skills.name));
    return rows.map((r) => toStoredSkill(r.skill, r.agents));
  }

  async get(workspaceId: string, id: string, exec: DbOrTx = this.db): Promise<StoredSkill | undefined> {
    const [row] = await exec
      .select({ skill: t.skills, agents: agentCount })
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)));
    return row ? toStoredSkill(row.skill, row.agents) : undefined;
  }

  /** The editable state of a skill, row-locked until the transaction ends. */
  async lockForEdit(exec: DbOrTx, workspaceId: string, id: string): Promise<SkillEditState | undefined> {
    const [row] = await exec
      .select({
        name: t.skills.name,
        description: t.skills.description,
        type: t.skills.type,
        body: t.skills.body,
        enabled: t.skills.enabled,
        source: t.skills.source,
        version: t.skills.version,
        acknowledgedAt: t.skills.acknowledgedAt,
      })
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
      .for('update');
    return row;
  }

  /** Insert a skill at `version`; returns its id. 409 on a duplicate name. */
  async insert(
    exec: DbOrTx,
    workspaceId: string,
    values: NewSkillValues,
    version: number,
  ): Promise<string> {
    try {
      const [row] = await exec
        .insert(t.skills)
        .values({ workspaceId, ...values, version })
        .returning({ id: t.skills.id });
      return row!.id;
    } catch (err) {
      mapNameTaken(err, values.name);
    }
  }

  /** Update a skill (`updated_at` comes from the schema's `$onUpdate`). 409 on a duplicate name. */
  async update(exec: DbOrTx, id: string, values: SkillUpdateValues): Promise<void> {
    try {
      await exec.update(t.skills).set(values).where(eq(t.skills.id, id));
    } catch (err) {
      mapNameTaken(err, values.name);
    }
  }

  /** Delete a skill; its versions and agent links cascade. False when absent. */
  async delete(workspaceId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
      .returning({ id: t.skills.id });
    return rows.length > 0;
  }

  /** Ids among `ids` that belong to the workspace. */
  async idsInWorkspace(exec: DbOrTx, workspaceId: string, ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await exec
      .select({ id: t.skills.id })
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), inArray(t.skills.id, ids)));
    return rows.map((r) => r.id);
  }

  /** The workspace's skill with this name (`skills_ws_name_uq`), if any. */
  async findByName(workspaceId: string, name: string): Promise<StoredSkill | undefined> {
    const [row] = await this.db
      .select({ skill: t.skills, agents: agentCount })
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.name, name)));
    return row ? toStoredSkill(row.skill, row.agents) : undefined;
  }

  async namesInWorkspace(workspaceId: string): Promise<string[]> {
    const rows = await this.db
      .select({ name: t.skills.name })
      .from(t.skills)
      .where(eq(t.skills.workspaceId, workspaceId))
      .orderBy(asc(t.skills.name));
    return rows.map((r) => r.name);
  }

  // ---- skill_versions ----------------------------------------------------

  async insertVersion(exec: DbOrTx, skillId: string, version: number, body: string): Promise<void> {
    await exec.insert(t.skillVersions).values({ skillId, version, body });
  }

  /** Body snapshots of a skill, newest version first. */
  async listVersions(skillId: string): Promise<SkillVersion[]> {
    const rows = await this.db
      .select()
      .from(t.skillVersions)
      .where(eq(t.skillVersions.skillId, skillId))
      .orderBy(desc(t.skillVersions.version));
    return rows.map((r) => ({
      skill_id: r.skillId,
      version: r.version,
      body: r.body,
      created_at: r.createdAt.toISOString(),
    }));
  }

  // ---- agent_skills ------------------------------------------------------

  /** Every link of the agent, ordered (`order`, then skill id for ties). */
  async links(exec: DbOrTx, agentId: string): Promise<AgentVersionSkill[]> {
    return exec
      .select({
        skill_id: t.agentSkills.skillId,
        order: t.agentSkills.order,
        enabled: t.agentSkills.enabled,
      })
      .from(t.agentSkills)
      .where(eq(t.agentSkills.agentId, agentId))
      .orderBy(asc(t.agentSkills.order), asc(t.agentSkills.skillId));
  }

  snapshotLinks(agentId: string): Promise<AgentVersionSkill[]> {
    return this.links(this.db, agentId);
  }

  /** Replace the agent's links with `links` (as given: order and enabled). */
  async replaceLinks(exec: DbOrTx, agentId: string, links: AgentVersionSkill[]): Promise<void> {
    await exec.delete(t.agentSkills).where(eq(t.agentSkills.agentId, agentId));
    if (links.length === 0) return;
    await exec.insert(t.agentSkills).values(
      links.map((l) => ({ agentId, skillId: l.skill_id, order: l.order, enabled: l.enabled })),
    );
  }

  /** The agent's links with their skills, ordered. */
  async agentSkills(agentId: string): Promise<StoredAgentSkill[]> {
    const rows = await this.db
      .select({
        order: t.agentSkills.order,
        enabled: t.agentSkills.enabled,
        skill: t.skills,
        agents: agentCount,
      })
      .from(t.agentSkills)
      .innerJoin(t.skills, eq(t.agentSkills.skillId, t.skills.id))
      .where(eq(t.agentSkills.agentId, agentId))
      .orderBy(asc(t.agentSkills.order), asc(t.agentSkills.skillId));
    return rows.map((r) => ({
      skill_id: r.skill.id,
      order: r.order,
      enabled: r.enabled,
      skill: toStoredSkill(r.skill, r.agents),
    }));
  }

  async effectiveSkillCounts(agentIds: string[]): Promise<Map<string, number>> {
    if (agentIds.length === 0) return new Map();
    const rows = await this.db
      .select({ agentId: t.agentSkills.agentId, n: count() })
      .from(t.agentSkills)
      .innerJoin(t.skills, eq(t.agentSkills.skillId, t.skills.id))
      .where(
        and(
          inArray(t.agentSkills.agentId, agentIds),
          eq(t.agentSkills.enabled, true),
          eq(t.skills.enabled, true),
        ),
      )
      .groupBy(t.agentSkills.agentId);
    return new Map(rows.map((r) => [r.agentId, r.n]));
  }

  async enabledForAgent(agentId: string): Promise<EffectiveSkill[]> {
    return this.db
      .select({
        id: t.skills.id,
        name: t.skills.name,
        body: t.skills.body,
        source: t.skills.source,
        version: t.skills.version,
      })
      .from(t.agentSkills)
      .innerJoin(t.skills, eq(t.agentSkills.skillId, t.skills.id))
      .where(
        and(
          eq(t.agentSkills.agentId, agentId),
          eq(t.agentSkills.enabled, true),
          eq(t.skills.enabled, true),
        ),
      )
      .orderBy(asc(t.agentSkills.order), asc(t.agentSkills.skillId));
  }
}
