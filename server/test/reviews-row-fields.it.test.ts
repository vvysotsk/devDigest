/**
 * Field-level coverage for the reviews row refactor (onion refactor, stage c —
 * `specs/refactor-onion.md`). Stage c stopped passing Drizzle rows through the
 * reviews service/executor: agents now arrive as the snake_case `Agent`
 * contract (via `toAgentDto`), PRs/repos as narrow types, findings as DTOs.
 * `reviews-golden.it.test.ts` pins the default path; this file covers the
 * fields and branches the golden run cannot see:
 *   - non-default agent fields: strategy (map-reduce), ci_fail_on (never),
 *     repo_intel (false), version, system_prompt — inserted as a raw row so the
 *     row → Agent mapping itself is under test;
 *   - repo owner/name + PR number + agent name in the LLM sessionId;
 *   - last_reviewed_sha written from the PR head;
 *   - the pr_files fallback of the diff loader (git returns no diff);
 *   - finding actions: dismiss shape, and 404 for another workspace's finding.
 * These pass on the pre-stage-c code too (characterization).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Review, StructuredRequest } from '@devdigest/shared';
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

const CONFIG_PATCH = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -10,3 +10,4 @@
   port: 3000,
+  stripeKey: "sk_live_xxx",
   redisUrl: x,`;
const OTHER_PATCH = `diff --git a/src/other.ts b/src/other.ts
--- a/src/other.ts
+++ b/src/other.ts
@@ -1,2 +1,3 @@
 export const a = 1;
+export const b = 2;
 export const c = 3;`;

const REVIEW: Review = {
  verdict: 'request_changes',
  summary: 'Hardcoded Stripe secret introduced.',
  score: 42,
  findings: [
    {
      id: 'f-valid',
      severity: 'CRITICAL',
      category: 'security',
      title: 'Hardcoded Stripe secret key',
      file: 'src/config.ts',
      start_line: 11,
      end_line: 11,
      rationale: 'A live Stripe key is committed in source.',
      suggestion: 'Move the key to an environment variable.',
      confidence: 0.95,
      kind: 'finding',
    },
  ],
};

d('reviews row → contract fields (Testcontainers pg)', () => {
  let pg: PgFixture;
  let db: PgFixture['handle']['db'];
  let workspaceId: string;
  let seq = 0;

  beforeAll(async () => {
    pg = await startPg();
    db = pg.handle.db;
    await seed(db);
    const [ws] = await db.select().from(t.workspaces);
    workspaceId = ws!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  async function repoAndPr(ws = workspaceId) {
    const name = `fields-${seq++}`;
    const [repo] = await db
      .insert(t.repos)
      .values({ workspaceId: ws, owner: 'acme-org', name, fullName: `acme-org/${name}` })
      .returning();
    const [pr] = await db
      .insert(t.pullRequests)
      .values({
        workspaceId: ws,
        repoId: repo!.id,
        number: 77,
        title: 'Field test',
        author: 'field.author',
        branch: 'feat/fields',
        base: 'main',
        headSha: 'head-sha-77',
        status: 'open',
      })
      .returning();
    return { repo: repo!, pr: pr! };
  }

  function appWith(llm: MockLLMProvider, git: MockGitClient) {
    return buildApp({
      config: config(),
      db,
      overrides: { secrets: new MockSecretsProvider({}), embedder: new MockEmbedder(), git, llm: { openai: llm } },
    });
  }

  it('maps a non-default agent row into the run: strategy, ci_fail_on, repo_intel, version, system_prompt, sessionId, last_reviewed_sha', async () => {
    const { repo, pr } = await repoAndPr();
    const [agent] = await db
      .insert(t.agents)
      .values({
        workspaceId,
        name: 'Field Agent',
        provider: 'openai',
        model: 'gpt-4.1',
        systemPrompt: 'SP-FIELDS',
        strategy: 'map-reduce',
        ciFailOn: 'never',
        repoIntel: false,
        version: 3,
      })
      .returning();
    const llm = new MockLLMProvider('openai', { structured: REVIEW });
    const app = await appWith(llm, new MockGitClient({ diff: `${CONFIG_PATCH}\n${OTHER_PATCH}` }));

    const started = await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent!.id } });
    expect(started.statusCode).toBe(200);
    const runId: string = started.json().runs[0].run_id;
    await waitForPrRuns(db, pr.id, { expected: 1 });
    expect(await waitForRunTrace(db, runId)).toBe(true);

    const trace = (await app.inject({ method: 'GET', url: `/runs/${runId}/trace` })).json();
    // strategy: map-reduce → one review_file call per changed file
    expect(trace.tool_calls.map((c: { meta: string }) => c.meta)).toEqual(['map-reduce', 'map-reduce']);
    // repo_intel: false → enrichment skipped
    expect(trace.log.map((l: { msg: string }) => l.msg)).toContain(
      'Repo intel disabled for this agent — skipping context enrichment',
    );
    // version + system_prompt
    expect(trace.config.version).toBe('3');
    expect(trace.prompt_assembly.system.startsWith('SP-FIELDS')).toBe(true);

    // ci_fail_on: never → no blockers even with a CRITICAL finding kept
    const [run] = (await app.inject({ method: 'GET', url: `/pulls/${pr.id}/runs` })).json();
    expect(run.status).toBe('done');
    expect(run.findings_count).toBeGreaterThan(0);
    expect(run.blockers).toBe(0);

    // sessionId = owner/name#number:agent name (repo ref + PR + agent contract)
    const sessionIds = llm.calls
      .filter((c) => c.method === 'completeStructured')
      .map((c) => (c.req as StructuredRequest<unknown>).sessionId);
    expect(new Set(sessionIds)).toEqual(new Set([`acme-org/${repo.name}#77:Field Agent`]));

    // last_reviewed_sha = the PR head the review ran against
    const [row] = await db.select().from(t.pullRequests).where(eq(t.pullRequests.id, pr.id));
    expect(row!.lastReviewedSha).toBe('head-sha-77');
    await app.close();
  });

  it('falls back to the persisted pr_files patches when git returns no diff', async () => {
    const { pr } = await repoAndPr();
    await db.insert(t.prFiles).values([
      { prId: pr.id, path: 'src/config.ts', additions: 1, deletions: 0, patch: CONFIG_PATCH.split('\n').slice(3).join('\n') },
      { prId: pr.id, path: 'src/no-patch.ts', additions: 0, deletions: 0, patch: null },
    ]);
    const [agent] = await db
      .insert(t.agents)
      .values({ workspaceId, name: 'Fallback Agent', provider: 'openai', model: 'gpt-4.1', systemPrompt: 's' })
      .returning();
    const app = await appWith(new MockLLMProvider('openai', { structured: REVIEW }), new MockGitClient({ diff: '' }));
    const started = await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent!.id } });
    const runId: string = started.json().runs[0].run_id;
    await waitForPrRuns(db, pr.id, { expected: 1 });
    expect(await waitForRunTrace(db, runId)).toBe(true);

    const trace = (await app.inject({ method: 'GET', url: `/runs/${runId}/trace` })).json();
    expect(trace.log.map((l: { msg: string }) => l.msg)).toContain(
      'Diff ready — 1 changed file(s); starting 1 agent run(s)',
    );
    expect(trace.prompt_assembly.user).toContain('diff --git a/src/config.ts b/src/config.ts');
    expect(trace.prompt_assembly.user).not.toContain('src/no-patch.ts');
    expect(trace.stats.findings).toBe(1);
    await app.close();
  });

  it('finding actions: dismiss clears accepted_at; a finding of another workspace is 404', async () => {
    const { pr } = await repoAndPr();
    const [agent] = await db
      .insert(t.agents)
      .values({ workspaceId, name: 'Action Agent', provider: 'openai', model: 'gpt-4.1', systemPrompt: 's' })
      .returning();
    const app = await appWith(new MockLLMProvider('openai', { structured: REVIEW }), new MockGitClient({ diff: CONFIG_PATCH }));
    await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent!.id } });
    await waitForPrRuns(db, pr.id, { expected: 1 });
    const [review] = (await app.inject({ method: 'GET', url: `/pulls/${pr.id}/reviews` })).json();
    const findingId: string = review.findings[0].id;

    await app.inject({ method: 'POST', url: `/findings/${findingId}/accept` });
    const dismissed = await app.inject({ method: 'POST', url: `/findings/${findingId}/dismiss` });
    expect(dismissed.statusCode).toBe(200);
    const f = dismissed.json().finding;
    expect(f).toMatchObject({ id: findingId, review_id: review.id, accepted_at: null, severity: 'CRITICAL', start_line: 11 });
    expect(typeof f.dismissed_at).toBe('string');

    // A finding under another workspace's PR is invisible to the default workspace.
    const [other] = await db.insert(t.workspaces).values({ name: 'fields-other' }).returning();
    const foreign = await repoAndPr(other!.id);
    const [foreignReview] = await db
      .insert(t.reviews)
      .values({ workspaceId: other!.id, prId: foreign.pr.id, kind: 'review', score: 1 })
      .returning();
    const [foreignFinding] = await db
      .insert(t.findings)
      .values({
        reviewId: foreignReview!.id,
        file: 'a.ts',
        startLine: 1,
        endLine: 1,
        severity: 'WARNING',
        category: 'bug',
        title: 't',
        rationale: 'r',
        confidence: 0.5,
      })
      .returning();
    const cross = await app.inject({ method: 'POST', url: `/findings/${foreignFinding!.id}/accept` });
    expect(cross.statusCode).toBe(404);
    expect(cross.json().error.code).toBe('not_found');
    const unknown = await app.inject({ method: 'POST', url: `/findings/${crypto.randomUUID()}/dismiss` });
    expect(unknown.statusCode).toBe(404);
    await app.close();
  });
});
