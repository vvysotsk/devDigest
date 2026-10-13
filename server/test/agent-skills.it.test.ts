import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { Agent, AgentSkill, AgentSkillsResult, AgentVersion } from '@devdigest/shared';
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
  console.warn('[agent-skills] Docker not available — skipping integration tests.');
}

/**
 * L02 Stage 2 — an agent's ordered skill list (`GET/PUT /agents/:id/skills`,
 * D2 / D17): order = array index, per-link enabled, one agent version bump +
 * snapshot per changed save, none for an unchanged list, 400 for a skill
 * outside the workspace, `Agent.skill_count` = effective skills only, and the
 * container port (`container.skillsRepo`). R3 shape tests on every response.
 */
d('/agents/:id/skills', () => {
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
  type App = Awaited<ReturnType<typeof makeApp>>;

  async function createAgent(app: App): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/agents',
      payload: { name: `Agent ${++seq}`, provider: 'openai', model: 'gpt-4o-mini', system_prompt: 'Review.' },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function createSkill(app: App, enabled = true): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: {
        name: `link-skill-${++seq}`,
        description: 'Use when testing links',
        type: 'custom',
        body: `Body ${seq}.`,
        enabled,
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  function put(app: App, agentId: string, skills: { skill_id: string; enabled: boolean }[]) {
    return app.inject({ method: 'PUT', url: `/agents/${agentId}/skills`, payload: { skills } });
  }

  async function versions(app: App, agentId: string): Promise<AgentVersion[]> {
    const res = await app.inject({ method: 'GET', url: `/agents/${agentId}/versions` });
    return AgentVersion.array().parse(res.json());
  }

  it('PUT stores order = index and enabled as given; GET returns the same list', async () => {
    const app = await makeApp();
    const agentId = await createAgent(app);
    const [s1, s2, s3] = [await createSkill(app), await createSkill(app), await createSkill(app)];

    const res = await put(app, agentId, [
      { skill_id: s3, enabled: true },
      { skill_id: s1, enabled: false },
      { skill_id: s2, enabled: true },
    ]);
    expect(res.statusCode).toBe(200);
    const result = AgentSkillsResult.strict().parse(res.json());
    expect(result.skills.map((l) => [l.skill_id, l.order, l.enabled])).toEqual([
      [s3, 0, true],
      [s1, 1, false],
      [s2, 2, true],
    ]);
    expect(result.skills.every((l) => l.skill.id === l.skill_id)).toBe(true);
    for (const l of result.skills) AgentSkill.strict().parse(l);

    const got = await app.inject({ method: 'GET', url: `/agents/${agentId}/skills` });
    expect(got.statusCode).toBe(200);
    const list = AgentSkill.strict().array().parse(got.json());
    expect(list.map((l) => l.skill_id)).toEqual([s3, s1, s2]);
    expect(list[0]!.skill.body_tokens).toBeGreaterThan(0);
    await app.close();
  });

  it('a changed save bumps the agent version exactly once and snapshots the links', async () => {
    const app = await makeApp();
    const agentId = await createAgent(app);
    const [s1, s2] = [await createSkill(app), await createSkill(app)];

    const first = AgentSkillsResult.strict().parse(
      (
        await put(app, agentId, [
          { skill_id: s1, enabled: true },
          { skill_id: s2, enabled: false },
        ])
      ).json(),
    );
    expect(first.version).toBe(2);

    const agent = Agent.strict().parse((await app.inject({ method: 'GET', url: `/agents/${agentId}` })).json());
    expect(agent.version).toBe(2);

    const history = await versions(app, agentId);
    expect(history.map((v) => v.version)).toEqual([2, 1]);
    expect(history[0]!.config.skills).toEqual([
      { skill_id: s1, order: 0, enabled: true },
      { skill_id: s2, order: 1, enabled: false },
    ]);
    expect(history[1]!.config.skills).toEqual([]);
    // The snapshot keeps the agent's config next to the links.
    expect(history[0]!.config).toMatchObject({ provider: 'openai', model: 'gpt-4o-mini', system_prompt: 'Review.' });

    // Reorder → another single bump.
    const reordered = AgentSkillsResult.strict().parse(
      (
        await put(app, agentId, [
          { skill_id: s2, enabled: false },
          { skill_id: s1, enabled: true },
        ])
      ).json(),
    );
    expect(reordered.version).toBe(3);
    // Toggle one link → another single bump.
    const toggled = AgentSkillsResult.strict().parse(
      (
        await put(app, agentId, [
          { skill_id: s2, enabled: true },
          { skill_id: s1, enabled: true },
        ])
      ).json(),
    );
    expect(toggled.version).toBe(4);
    expect((await versions(app, agentId)).map((v) => v.version)).toEqual([4, 3, 2, 1]);
    await app.close();
  });

  it('an unchanged list does not bump the version or add a snapshot', async () => {
    const app = await makeApp();
    const agentId = await createAgent(app);
    const s1 = await createSkill(app);
    const list = [{ skill_id: s1, enabled: true }];

    expect(AgentSkillsResult.strict().parse((await put(app, agentId, list)).json()).version).toBe(2);
    const again = AgentSkillsResult.strict().parse((await put(app, agentId, list)).json());
    expect(again.version).toBe(2);
    expect(again.skills.map((l) => l.skill_id)).toEqual([s1]);
    expect((await versions(app, agentId)).map((v) => v.version)).toEqual([2, 1]);

    // An empty list on an agent without links is unchanged too.
    const bare = await createAgent(app);
    const empty = AgentSkillsResult.strict().parse((await put(app, bare, [])).json());
    expect(empty).toEqual({ version: 1, skills: [] });
    await app.close();
  });

  it('detaching every skill is a change: bump + empty snapshot', async () => {
    const app = await makeApp();
    const agentId = await createAgent(app);
    const s1 = await createSkill(app);
    await put(app, agentId, [{ skill_id: s1, enabled: true }]);

    const cleared = AgentSkillsResult.strict().parse((await put(app, agentId, [])).json());
    expect(cleared).toEqual({ version: 3, skills: [] });
    const history = await versions(app, agentId);
    expect(history[0]!.config.skills).toEqual([]);
    await app.close();
  });

  it('400 skill_not_in_workspace for a foreign or unknown skill; nothing is written', async () => {
    const app = await makeApp();
    const db = pg.handle.db;
    const agentId = await createAgent(app);
    const own = await createSkill(app);
    await put(app, agentId, [{ skill_id: own, enabled: true }]);

    const [otherWs] = await db.insert(t.workspaces).values({ name: `other-${++seq}` }).returning();
    const [foreign] = await db
      .insert(t.skills)
      .values({
        workspaceId: otherWs!.id,
        name: 'foreign-link',
        description: 'd',
        type: 'custom',
        source: 'manual',
        body: 'b',
      })
      .returning();
    const unknown = '00000000-0000-4000-8000-000000000000';

    const res = await put(app, agentId, [
      { skill_id: foreign!.id, enabled: true },
      { skill_id: own, enabled: true },
      { skill_id: unknown, enabled: true },
    ]);
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('skill_not_in_workspace');
    expect(body.error.details).toEqual({ skill_ids: [foreign!.id, unknown] });

    // Rolled back: links and version unchanged.
    const links = AgentSkill.strict()
      .array()
      .parse((await app.inject({ method: 'GET', url: `/agents/${agentId}/skills` })).json());
    expect(links.map((l) => l.skill_id)).toEqual([own]);
    expect((await versions(app, agentId)).map((v) => v.version)).toEqual([2, 1]);
    await app.close();
  });

  it('404 for an unknown or foreign agent on GET and PUT', async () => {
    const app = await makeApp();
    const db = pg.handle.db;
    const ghost = '00000000-0000-0000-0000-000000000000';
    expect((await app.inject({ method: 'GET', url: `/agents/${ghost}/skills` })).statusCode).toBe(404);
    expect((await put(app, ghost, [])).statusCode).toBe(404);

    const [otherWs] = await db.insert(t.workspaces).values({ name: `other-${++seq}` }).returning();
    const [foreignAgent] = await db
      .insert(t.agents)
      .values({
        workspaceId: otherWs!.id,
        name: 'Foreign agent',
        provider: 'openai',
        model: 'gpt-4o-mini',
        systemPrompt: 'x',
      })
      .returning();
    expect(
      (await app.inject({ method: 'GET', url: `/agents/${foreignAgent!.id}/skills` })).statusCode,
    ).toBe(404);
    const res = await put(app, foreignAgent!.id, []);
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('not_found');
    await app.close();
  });

  it('Agent.skill_count counts effective skills only (link AND skill enabled)', async () => {
    const app = await makeApp();
    const agentId = await createAgent(app);
    const on = await createSkill(app, true);
    const globallyOff = await createSkill(app, false);
    const linkOff = await createSkill(app, true);
    await put(app, agentId, [
      { skill_id: on, enabled: true },
      { skill_id: globallyOff, enabled: true },
      { skill_id: linkOff, enabled: false },
    ]);

    const agent = Agent.strict().parse((await app.inject({ method: 'GET', url: `/agents/${agentId}` })).json());
    expect(agent.skill_count).toBe(1);
    const listed = (await app.inject({ method: 'GET', url: '/agents' })).json() as Agent[];
    expect(listed.find((a) => a.id === agentId)?.skill_count).toBe(1);

    // Disabling the skill globally drops it from the count; the link stays.
    await app.inject({ method: 'PUT', url: `/skills/${on}`, payload: { enabled: false } });
    const after = Agent.strict().parse((await app.inject({ method: 'GET', url: `/agents/${agentId}` })).json());
    expect(after.skill_count).toBe(0);
    await app.close();
  });

  it('an agent config edit snapshots the current links through the port', async () => {
    const app = await makeApp();
    const agentId = await createAgent(app);
    const [s1, s2] = [await createSkill(app), await createSkill(app)];
    await put(app, agentId, [
      { skill_id: s2, enabled: false },
      { skill_id: s1, enabled: true },
    ]);

    await app.inject({ method: 'PUT', url: `/agents/${agentId}`, payload: { model: 'gpt-4.1' } });
    const history = await versions(app, agentId);
    expect(history[0]!.version).toBe(3);
    expect(history[0]!.config.model).toBe('gpt-4.1');
    expect(history[0]!.config.skills).toEqual([
      { skill_id: s2, order: 0, enabled: false },
      { skill_id: s1, order: 1, enabled: true },
    ]);
    await app.close();
  });

  it('container.skillsRepo port: enabledForAgent (effective, in order) and namesInWorkspace', async () => {
    const app = await makeApp();
    const agentId = await createAgent(app);
    const a = await createSkill(app, true);
    const off = await createSkill(app, false);
    const b = await createSkill(app, true);
    const linkOff = await createSkill(app, true);
    await put(app, agentId, [
      { skill_id: b, enabled: true },
      { skill_id: off, enabled: true },
      { skill_id: linkOff, enabled: false },
      { skill_id: a, enabled: true },
    ]);

    const port = app.container.skillsRepo;
    const effective = await port.enabledForAgent(agentId);
    expect(effective.map((s) => s.id)).toEqual([b, a]);
    expect(effective[0]).toMatchObject({ source: 'manual', version: 1 });
    expect(typeof effective[0]!.body).toBe('string');
    expect(typeof effective[0]!.name).toBe('string');

    expect((await port.effectiveSkillCounts([agentId])).get(agentId)).toBe(2);
    expect(await port.snapshotLinks(agentId)).toEqual([
      { skill_id: b, order: 0, enabled: true },
      { skill_id: off, order: 1, enabled: true },
      { skill_id: linkOff, order: 2, enabled: false },
      { skill_id: a, order: 3, enabled: true },
    ]);

    const names = await port.namesInWorkspace(ws);
    const skills = (await app.inject({ method: 'GET', url: '/skills' })).json() as { name: string }[];
    expect([...names].sort()).toEqual(skills.map((s) => s.name).sort());
    await app.close();
  });
});
