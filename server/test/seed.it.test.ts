/**
 * `seed()` is idempotent: a second run adds nothing (L02 Stage 7). Also pins
 * what the L02 seed provides — 5 agents, 12 skills (each with its v1 body
 * snapshot), the link plan (Security 6 linked / 3 enabled) and PRs #482–#484
 * with patches for the experiment PRs — and that a re-seed keeps a user's
 * edited link list.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import type { PgTable } from 'drizzle-orm/pg-core';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

d('seed (Testcontainers pg)', () => {
  let pg: PgFixture;
  let db: PgFixture['handle']['db'];

  beforeAll(async () => {
    pg = await startPg();
    db = pg.handle.db;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  async function counts() {
    const n = async (table: PgTable) => (await db.select().from(table)).length;
    return {
      agents: await n(t.agents),
      skills: await n(t.skills),
      skillVersions: await n(t.skillVersions),
      agentSkills: await n(t.agentSkills),
      pulls: await n(t.pullRequests),
      prFiles: await n(t.prFiles),
      prCommits: await n(t.prCommits),
      reviews: await n(t.reviews),
      findings: await n(t.findings),
    };
  }

  it('seeds the L02 data once and a second run changes nothing', async () => {
    await seed(db);
    const first = await counts();
    expect(first).toMatchObject({ agents: 5, skills: 12, skillVersions: 12, agentSkills: 14, pulls: 3 });

    await seed(db);
    expect(await counts()).toEqual(first);

    const agents = await db.select({ name: t.agents.name }).from(t.agents);
    expect(agents.map((a) => a.name).sort()).toEqual(
      ['API Contract Reviewer', 'General Reviewer', 'Performance Reviewer', 'Security Reviewer', 'Test Quality Reviewer'],
    );
    const prs = await db.select({ number: t.pullRequests.number, id: t.pullRequests.id }).from(t.pullRequests);
    expect(prs.map((p) => p.number).sort()).toEqual([482, 483, 484]);
    const experiment = prs.filter((p) => p.number !== 482).map((p) => p.id);
    const files = await db.select().from(t.prFiles).where(inArray(t.prFiles.prId, experiment));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(f.patch).toMatch(/^@@ /);
  });

  it('Security has 6 links, 3 enabled, in the design order; a re-seed keeps a user edit', async () => {
    const [security] = await db.select().from(t.agents).where(eq(t.agents.name, 'Security Reviewer'));
    const links = await db
      .select({ name: t.skills.name, order: t.agentSkills.order, enabled: t.agentSkills.enabled })
      .from(t.agentSkills)
      .innerJoin(t.skills, eq(t.agentSkills.skillId, t.skills.id))
      .where(eq(t.agentSkills.agentId, security!.id))
      .orderBy(t.agentSkills.order);
    expect(links.map((l) => l.name)).toEqual([
      'pr-quality-rubric',
      'no-then-chains',
      'secret-leakage-gate',
      'lethal-trifecta',
      'phantom-api-gate',
      'test-coverage-nudge',
    ]);
    expect(links.filter((l) => l.enabled).map((l) => l.name)).toEqual([
      'pr-quality-rubric',
      'secret-leakage-gate',
      'lethal-trifecta',
    ]);

    // The user unticks one link; a re-seed must not restore it.
    const [rubric] = await db.select().from(t.skills).where(eq(t.skills.name, 'pr-quality-rubric'));
    await db
      .update(t.agentSkills)
      .set({ enabled: false })
      .where(and(eq(t.agentSkills.agentId, security!.id), eq(t.agentSkills.skillId, rubric!.id)));
    await seed(db);
    const [after] = await db
      .select({ enabled: t.agentSkills.enabled })
      .from(t.agentSkills)
      .where(and(eq(t.agentSkills.agentId, security!.id), eq(t.agentSkills.skillId, rubric!.id)));
    expect(after!.enabled).toBe(false);
  });
});
