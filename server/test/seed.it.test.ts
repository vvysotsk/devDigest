/**
 * `seed()` is idempotent: a second run adds nothing (L02 Stage 7). Also pins
 * what the L02 seed provides — 4 agents, 10 skills (each with its v1 body
 * snapshot), the link plan (Security 6 linked / 3 enabled) and PRs #482–#486
 * with patches for the experiment PRs — that a re-seed keeps a user's edited
 * link list, and that a changed HW02 calibration fixture (#485 / #486) reaches
 * an existing DB on a re-seed while nothing else is touched (HW02 D13).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { seed, upsertExperimentPr } from '../src/db/seed.js';
import { SEED_EXPERIMENT_PRS, type SeedPr } from '../src/db/seed-prs.js';
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
    expect(first).toMatchObject({ agents: 4, skills: 10, skillVersions: 10, agentSkills: 12, pulls: 5 });

    await seed(db);
    expect(await counts()).toEqual(first);

    const agents = await db.select({ name: t.agents.name }).from(t.agents);
    expect(agents.map((a) => a.name).sort()).toEqual(
      ['General Reviewer', 'Performance Reviewer', 'Security Reviewer', 'Test Quality Reviewer'],
    );
    const prs = await db.select({ number: t.pullRequests.number, id: t.pullRequests.id }).from(t.pullRequests);
    expect(prs.map((p) => p.number).sort()).toEqual([482, 483, 484, 485, 486]);
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

  it('a calibration edit (new head sha) of #485/#486 reaches the DB on a re-seed; nothing else changes (D13)', async () => {
    await seed(db);
    const [pr486] = await db.select().from(t.pullRequests).where(eq(t.pullRequests.number, 486));
    const [pr483] = await db.select().from(t.pullRequests).where(eq(t.pullRequests.number, 483));
    const filesOf = (prId: string) => db.select().from(t.prFiles).where(eq(t.prFiles.prId, prId));
    const before483 = await filesOf(pr483!.id);
    const beforeCounts = await counts();
    const fixture = (n: number) => SEED_EXPERIMENT_PRS.find((p) => p.number === n)!;

    // Same head sha → nothing is rewritten.
    expect(await upsertExperimentPr(db, pr486!.workspaceId, pr486!.repoId, fixture(486))).toBe('unchanged');

    // An edited fixture with a new head sha replaces the row, files and commits in place.
    const edited: SeedPr = {
      ...fixture(486),
      headSha: 'aaaaaaaaaaaa',
      title: 'Edited title',
      files: [{ path: 'src/schemas/customers.ts', additions: 1, deletions: 0, patch: '@@ -1,0 +1,1 @@\n+// edited' }],
      commits: [{ sha: 'aaaaaaaaaaaa', message: 'edited', author: 'someone' }],
    };
    expect(await upsertExperimentPr(db, pr486!.workspaceId, pr486!.repoId, edited)).toBe('refreshed');
    const [after486] = await db.select().from(t.pullRequests).where(eq(t.pullRequests.number, 486));
    expect(after486).toMatchObject({ id: pr486!.id, headSha: 'aaaaaaaaaaaa', title: 'Edited title', additions: 1, deletions: 0, filesCount: 1, status: 'needs_review' });
    expect((await filesOf(pr486!.id)).map((f) => f.patch)).toEqual(['@@ -1,0 +1,1 @@\n+// edited']);
    const commits = await db.select().from(t.prCommits).where(eq(t.prCommits.prId, pr486!.id));
    expect(commits.map((c) => c.sha)).toEqual(['aaaaaaaaaaaa']);

    // A PR without refreshOnSeed (#483) is never rewritten, even with a new head sha.
    const edited483: SeedPr = { ...fixture(483), headSha: 'bbbbbbbbbbbb', files: [] };
    expect(await upsertExperimentPr(db, pr483!.workspaceId, pr483!.repoId, edited483)).toBe('unchanged');
    expect(await filesOf(pr483!.id)).toEqual(before483);

    // Back to the real fixture: #486 is restored, the totals match the start.
    expect(await upsertExperimentPr(db, pr486!.workspaceId, pr486!.repoId, fixture(486))).toBe('refreshed');
    const restored = await counts();
    expect(restored).toEqual(beforeCounts);
  });
});
