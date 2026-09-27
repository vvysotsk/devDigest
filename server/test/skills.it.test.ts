import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { Skill, SkillVersion } from '@devdigest/shared';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient, MockSecretsProvider } from '../src/adapters/mocks.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[skills] Docker not available — skipping integration tests.');
}

/**
 * L02 Stage 2 — `/skills` CRUD, body versioning (D5), the first-enable
 * acknowledgement of imported skills (D4), 409 on a duplicate name, versions
 * list, delete cascading links, `agent_count`. Every route response is checked
 * with `Contract.strict().parse` (onion R3).
 */
d('/skills', () => {
  let pg: PgFixture;
  let ws: string;
  let seq = 0;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [row] = await pg.handle.db
      .select({ id: t.workspaces.id })
      .from(t.workspaces)
      .where(eq(t.workspaces.name, 'default'));
    ws = row!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function makeApp() {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    return buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient(),
        github: new MockGitHubClient(),
        secrets: new MockSecretsProvider({}),
      },
    });
  }

  const uniqueName = (prefix: string) => `${prefix}-${++seq}`;
  const input = (name: string) => ({
    name,
    description: 'Use when reviewing async code',
    type: 'convention' as const,
    body: 'Prefer async/await over .then chains.',
  });

  async function createAgent(app: Awaited<ReturnType<typeof makeApp>>): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/agents',
      payload: { name: uniqueName('Agent'), provider: 'openai', model: 'gpt-4o-mini', system_prompt: 'Review.' },
    });
    return res.json().id as string;
  }

  it('POST creates v1 (manual, enabled by default) with a v1 body snapshot', async () => {
    const app = await makeApp();
    const name = uniqueName('no-then-chains');
    const res = await app.inject({ method: 'POST', url: '/skills', payload: input(name) });
    expect(res.statusCode).toBe(201);
    const skill = Skill.strict().parse(res.json());
    expect(skill).toMatchObject({
      name,
      source: 'manual',
      enabled: true,
      version: 1,
      agent_count: 0,
      acknowledged_at: null,
    });
    expect(skill.body_tokens).toBeGreaterThan(0);

    const versions = await app.inject({ method: 'GET', url: `/skills/${skill.id}/versions` });
    expect(versions.statusCode).toBe(200);
    const list = SkillVersion.strict().array().parse(versions.json());
    expect(list).toEqual([
      expect.objectContaining({ skill_id: skill.id, version: 1, body: input(name).body }),
    ]);
    await app.close();
  });

  it('GET /skills lists the workspace skills; GET /skills/:id returns one; 404 for unknown', async () => {
    const app = await makeApp();
    const created = (
      await app.inject({ method: 'POST', url: '/skills', payload: input(uniqueName('listed')) })
    ).json();

    const list = await app.inject({ method: 'GET', url: '/skills' });
    expect(list.statusCode).toBe(200);
    const skills = Skill.strict().array().parse(list.json());
    expect(skills.map((s) => s.id)).toContain(created.id);

    const one = await app.inject({ method: 'GET', url: `/skills/${created.id}` });
    expect(one.statusCode).toBe(200);
    expect(Skill.strict().parse(one.json()).id).toBe(created.id);

    const ghost = '00000000-0000-0000-0000-000000000000';
    const missing = await app.inject({ method: 'GET', url: `/skills/${ghost}` });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('not_found');
    expect((await app.inject({ method: 'GET', url: `/skills/${ghost}/versions` })).statusCode).toBe(404);
    await app.close();
  });

  it('a body edit bumps the version and snapshots the body; versions are newest first', async () => {
    const app = await makeApp();
    const created = (
      await app.inject({ method: 'POST', url: '/skills', payload: input(uniqueName('bumped')) })
    ).json();

    const res = await app.inject({
      method: 'PUT',
      url: `/skills/${created.id}`,
      payload: { body: 'Second body.' },
    });
    expect(res.statusCode).toBe(200);
    const updated = Skill.strict().parse(res.json());
    expect(updated.version).toBe(2);
    expect(updated.body).toBe('Second body.');

    // A metadata-only edit bumps too, snapshotting the unchanged body.
    const meta = Skill.strict().parse(
      (
        await app.inject({ method: 'PUT', url: `/skills/${created.id}`, payload: { type: 'rubric' } })
      ).json(),
    );
    expect(meta.version).toBe(3);

    const versions = SkillVersion.strict()
      .array()
      .parse((await app.inject({ method: 'GET', url: `/skills/${created.id}/versions` })).json());
    expect(versions.map((v) => [v.version, v.body])).toEqual([
      [3, 'Second body.'],
      [2, 'Second body.'],
      [1, input('x').body],
    ]);
    await app.close();
  });

  it('an enabled-only change does not bump the version or add a snapshot', async () => {
    const app = await makeApp();
    const created = (
      await app.inject({ method: 'POST', url: '/skills', payload: input(uniqueName('toggled')) })
    ).json();

    const res = await app.inject({
      method: 'PUT',
      url: `/skills/${created.id}`,
      payload: { enabled: false },
    });
    expect(res.statusCode).toBe(200);
    const updated = Skill.strict().parse(res.json());
    expect(updated).toMatchObject({ enabled: false, version: 1 });

    // Sending a field with its current value is not a change either.
    const same = Skill.strict().parse(
      (
        await app.inject({
          method: 'PUT',
          url: `/skills/${created.id}`,
          payload: { name: created.name, enabled: true },
        })
      ).json(),
    );
    expect(same).toMatchObject({ enabled: true, version: 1 });

    const versions = (await app.inject({ method: 'GET', url: `/skills/${created.id}/versions` })).json();
    expect(versions).toHaveLength(1);
    await app.close();
  });

  it('409 skill_name_taken on a duplicate create and a rename onto a taken name', async () => {
    const app = await makeApp();
    const name = uniqueName('taken');
    expect((await app.inject({ method: 'POST', url: '/skills', payload: input(name) })).statusCode).toBe(201);

    const dup = await app.inject({ method: 'POST', url: '/skills', payload: input(name) });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.code).toBe('skill_name_taken');

    const other = (
      await app.inject({ method: 'POST', url: '/skills', payload: input(uniqueName('other')) })
    ).json();
    const rename = await app.inject({
      method: 'PUT',
      url: `/skills/${other.id}`,
      payload: { name, body: 'changed' },
    });
    expect(rename.statusCode).toBe(409);
    expect(rename.json().error.code).toBe('skill_name_taken');

    // The failed rename rolled back: no bump, no snapshot, body unchanged.
    const after = Skill.strict().parse((await app.inject({ method: 'GET', url: `/skills/${other.id}` })).json());
    expect(after).toMatchObject({ name: other.name, version: 1, body: input('x').body });
    const versions = (await app.inject({ method: 'GET', url: `/skills/${other.id}/versions` })).json();
    expect(versions).toHaveLength(1);
    await app.close();
  });

  it('first enable of an imported skill: 409 skill_ack_required, then OK with acknowledge_injection', async () => {
    const app = await makeApp();
    const [imported] = await pg.handle.db
      .insert(t.skills)
      .values({
        workspaceId: ws,
        name: uniqueName('imported'),
        description: 'Use when checking API deprecations',
        type: 'custom',
        source: 'imported_file',
        body: 'Imported body.',
        enabled: false,
      })
      .returning();

    const refused = await app.inject({
      method: 'PUT',
      url: `/skills/${imported!.id}`,
      payload: { enabled: true },
    });
    expect(refused.statusCode).toBe(409);
    expect(refused.json().error.code).toBe('skill_ack_required');
    const still = Skill.strict().parse((await app.inject({ method: 'GET', url: `/skills/${imported!.id}` })).json());
    expect(still).toMatchObject({ enabled: false, acknowledged_at: null });

    const ok = await app.inject({
      method: 'PUT',
      url: `/skills/${imported!.id}`,
      payload: { enabled: true, acknowledge_injection: true },
    });
    expect(ok.statusCode).toBe(200);
    const enabled = Skill.strict().parse(ok.json());
    expect(enabled.enabled).toBe(true);
    expect(enabled.acknowledged_at).not.toBeNull();
    expect(enabled.version).toBe(1);

    // Once acknowledged, a later disable → enable needs no acknowledgement.
    await app.inject({ method: 'PUT', url: `/skills/${imported!.id}`, payload: { enabled: false } });
    const again = await app.inject({
      method: 'PUT',
      url: `/skills/${imported!.id}`,
      payload: { enabled: true },
    });
    expect(again.statusCode).toBe(200);
    expect(Skill.strict().parse(again.json()).acknowledged_at).toBe(enabled.acknowledged_at);
    await app.close();
  });

  it('agent_count counts every linked agent, enabled link or not', async () => {
    const app = await makeApp();
    const skill = (
      await app.inject({ method: 'POST', url: '/skills', payload: input(uniqueName('counted')) })
    ).json();
    const a1 = await createAgent(app);
    const a2 = await createAgent(app);
    await app.inject({
      method: 'PUT',
      url: `/agents/${a1}/skills`,
      payload: { skills: [{ skill_id: skill.id, enabled: true }] },
    });
    await app.inject({
      method: 'PUT',
      url: `/agents/${a2}/skills`,
      payload: { skills: [{ skill_id: skill.id, enabled: false }] },
    });

    const got = Skill.strict().parse((await app.inject({ method: 'GET', url: `/skills/${skill.id}` })).json());
    expect(got.agent_count).toBe(2);
    await app.close();
  });

  it('DELETE → 204, removes the skill, its versions and its agent links; 404 afterwards', async () => {
    const app = await makeApp();
    const skill = (
      await app.inject({ method: 'POST', url: '/skills', payload: input(uniqueName('deleted')) })
    ).json();
    const agentId = await createAgent(app);
    await app.inject({
      method: 'PUT',
      url: `/agents/${agentId}/skills`,
      payload: { skills: [{ skill_id: skill.id, enabled: true }] },
    });

    const del = await app.inject({ method: 'DELETE', url: `/skills/${skill.id}` });
    expect(del.statusCode).toBe(204);
    expect(del.body).toBe('');

    expect((await app.inject({ method: 'GET', url: `/skills/${skill.id}` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `/skills/${skill.id}` })).statusCode).toBe(404);
    const links = await pg.handle.db
      .select()
      .from(t.agentSkills)
      .where(eq(t.agentSkills.skillId, skill.id));
    expect(links).toHaveLength(0);
    const versions = await pg.handle.db
      .select()
      .from(t.skillVersions)
      .where(eq(t.skillVersions.skillId, skill.id));
    expect(versions).toHaveLength(0);
    expect((await app.inject({ method: 'GET', url: `/agents/${agentId}/skills` })).json()).toEqual([]);
    await app.close();
  });

  it('skills are workspace-scoped: a foreign skill is 404 for read, edit, delete and versions', async () => {
    const app = await makeApp();
    const db = pg.handle.db;
    const [otherWs] = await db.insert(t.workspaces).values({ name: uniqueName('other-ws') }).returning();
    const [foreign] = await db
      .insert(t.skills)
      .values({
        workspaceId: otherWs!.id,
        name: 'foreign-skill',
        description: 'd',
        type: 'custom',
        source: 'manual',
        body: 'b',
      })
      .returning();

    const url = `/skills/${foreign!.id}`;
    expect((await app.inject({ method: 'GET', url })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PUT', url, payload: { enabled: false } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: `${url}/versions` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url })).statusCode).toBe(404);
    const list = Skill.strict().array().parse((await app.inject({ method: 'GET', url: '/skills' })).json());
    expect(list.map((s) => s.id)).not.toContain(foreign!.id);
    await app.close();
  });
});
