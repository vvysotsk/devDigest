/**
 * L02 Stage 4b — skills reach the review prompt and the trace (D2, D4, D7):
 *   - an effective skill (link AND skill enabled) is in `prompt_assembly.skills`
 *     as a `### Skill:` block, in `skill_blocks` with tokens > 0, and has exactly
 *     one run-log line;
 *   - a skill disabled by EITHER flag (link off, or skill off globally) is
 *     absent from all three and from the LLM request;
 *   - order follows `agent_skills.order`;
 *   - a trace document without `skill_blocks` (pre-L02) still parses.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { RunTrace, type Review, type StructuredRequest } from '@devdigest/shared';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { waitForPrRuns, waitForRunTrace } from './helpers/runs.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import { MockLLMProvider, MockEmbedder, MockGitClient, MockSecretsProvider } from '../src/adapters/mocks.js';
import * as t from '../src/db/schema.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

const PATCH = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,3 @@
 export const a = 1;
+export const b = 2;
 export const c = 3;`;

const REVIEW: Review = { verdict: 'approve', summary: 'Fine.', score: 90, findings: [] };

d('skills in a review run (Testcontainers pg)', () => {
  let pg: PgFixture;
  let db: PgFixture['handle']['db'];
  let workspaceId: string;

  beforeAll(async () => {
    pg = await startPg();
    db = pg.handle.db;
    await seed(db);
    const [ws] = await db.select().from(t.workspaces).where(eq(t.workspaces.name, 'default'));
    workspaceId = ws!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  async function setup() {
    const [repo] = await db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme-org', name: 'skills-run', fullName: 'acme-org/skills-run' })
      .returning();
    const [pr] = await db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId: repo!.id,
        number: 9,
        title: 'Skills run',
        author: 'a',
        branch: 'b',
        base: 'main',
        headSha: 'sha-9',
        status: 'open',
      })
      .returning();
    const [agent] = await db
      .insert(t.agents)
      .values({ workspaceId, name: 'Skilled Agent', provider: 'openai', model: 'gpt-4.1', systemPrompt: 'SP', repoIntel: false })
      .returning();
    const mk = (name: string, body: string, enabled: boolean) => ({
      workspaceId,
      name,
      description: 'Use when testing',
      type: 'custom' as const,
      source: 'manual' as const,
      body,
      enabled,
      version: 2,
    });
    const [second, first, linkOff, globalOff] = await db
      .insert(t.skills)
      .values([
        mk('run-second', 'BODY-SECOND', true),
        mk('run-first', 'BODY-FIRST', true),
        mk('run-link-off', 'BODY-LINK-OFF', true),
        mk('run-global-off', 'BODY-GLOBAL-OFF', false),
      ])
      .returning();
    await db.insert(t.agentSkills).values([
      { agentId: agent!.id, skillId: first!.id, order: 0, enabled: true },
      { agentId: agent!.id, skillId: linkOff!.id, order: 1, enabled: false },
      { agentId: agent!.id, skillId: second!.id, order: 2, enabled: true },
      { agentId: agent!.id, skillId: globalOff!.id, order: 3, enabled: true },
    ]);
    return { pr: pr!, agent: agent!, first: first!, second: second! };
  }

  it('injects only effective skills, in order, with tokens and one log line each', async () => {
    const { pr, agent, first, second } = await setup();
    const llm = new MockLLMProvider('openai', { structured: REVIEW });
    const app = await buildApp({
      config: config(),
      db,
      overrides: {
        secrets: new MockSecretsProvider({}),
        embedder: new MockEmbedder(),
        git: new MockGitClient({ diff: PATCH }),
        llm: { openai: llm },
      },
    });

    const started = await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent.id } });
    expect(started.statusCode).toBe(200);
    const runId: string = started.json().runs[0].run_id;
    await waitForPrRuns(db, pr.id, { expected: 1 });
    expect(await waitForRunTrace(db, runId)).toBe(true);

    const trace = RunTrace.parse((await app.inject({ method: 'GET', url: `/runs/${runId}/trace` })).json());
    const pa = trace.prompt_assembly;

    // 1) prompt: both effective skills, in agent_skills order, as ### Skill: blocks
    expect(pa.skills).toContain('### Skill: run-first (manual, v2)\n\nBODY-FIRST');
    expect(pa.skills).toContain('### Skill: run-second (manual, v2)\n\nBODY-SECOND');
    expect(pa.skills!.indexOf('run-first')).toBeLessThan(pa.skills!.indexOf('run-second'));
    // 2) skill_blocks with per-skill tokens
    expect(pa.skill_blocks).toEqual([
      expect.objectContaining({ skill_id: first.id, name: 'run-first', version: 2, source: 'manual' }),
      expect.objectContaining({ skill_id: second.id, name: 'run-second', version: 2, source: 'manual' }),
    ]);
    for (const b of pa.skill_blocks!) expect(b.tokens).toBeGreaterThan(0);
    // 3) exactly one log line per injected skill
    const msgs = trace.log.map((l) => l.msg);
    expect(msgs.filter((m) => m.startsWith('Skill "run-first"'))).toHaveLength(1);
    expect(msgs.filter((m) => m.startsWith('Skill "run-second"'))).toHaveLength(1);

    // Disabled by EITHER flag → absent from prompt, skill_blocks, log and the LLM request
    const userMessages = llm.calls
      .filter((c) => c.method === 'completeStructured')
      .map((c) => (c.req as StructuredRequest<unknown>).messages.map((m) => m.content).join('\n'))
      .join('\n');
    expect(userMessages).toContain('BODY-FIRST');
    for (const hidden of ['run-link-off', 'BODY-LINK-OFF', 'run-global-off', 'BODY-GLOBAL-OFF']) {
      expect(pa.skills).not.toContain(hidden);
      expect(pa.skill_blocks!.map((b) => b.name)).not.toContain(hidden);
      expect(msgs.some((m) => m.includes(hidden))).toBe(false);
      expect(userMessages).not.toContain(hidden);
    }
    await app.close();
  });

  it('a trace without skill_blocks (saved before L02) still parses', () => {
    const legacy = RunTrace.parse({
      config: { agent: 'A', model: 'm' },
      stats: { duration_ms: 1, tokens_in: 1, tokens_out: 1, findings: 0, grounding: '0/0' },
      prompt_assembly: { system: 's', skills: null, user: 'u' },
      tool_calls: [],
      raw_output: '{}',
      memory_pulled: [],
      specs_read: [],
      log: [],
    });
    expect(legacy.prompt_assembly.skill_blocks).toBeUndefined();
  });
});
