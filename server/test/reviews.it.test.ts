import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { waitForPrRuns } from './helpers/runs.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import { MockLLMProvider, MockEmbedder, MockGitClient } from '../src/adapters/mocks.js';
import * as t from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import type { Review } from '@devdigest/shared';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

/**
 * A unified diff touching src/config.ts (line 11 added) so grounding can keep a
 * finding on line 11 and drop one on line 999 / a non-existent file.
 */
const DIFF = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -10,3 +10,4 @@
   port: 3000,
+  stripeKey: "sk_live_xxx",
   redisUrl: x,`;

/** A Review fixture: one valid finding (line 11), one hallucinated (line 999). */
const REVIEW_FIXTURE: Review = {
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
    {
      id: 'f-halluc',
      severity: 'WARNING',
      category: 'bug',
      title: 'Phantom finding on a line not in the diff',
      file: 'src/config.ts',
      start_line: 999,
      end_line: 999,
      rationale: 'This line does not exist in the diff.',
      confidence: 0.5,
      kind: 'finding',
    },
  ],
};

let repoSeq = 0;
async function setupRepoAndPr(db: PgFixture['handle']['db'], workspaceId: string) {
  const name = `payments-api-${repoSeq++}`;
  const [repo] = await db
    .insert(t.repos)
    .values({ workspaceId, owner: 'acme', name, fullName: `acme/${name}` })
    .returning();
  const [pr] = await db
    .insert(t.pullRequests)
    .values({
      workspaceId,
      repoId: repo!.id,
      number: 482,
      title: 'Add rate limiting',
      author: 'marisa.koch',
      branch: 'feat/rl',
      base: 'main',
      headSha: 'a1b2c3d4',
      additions: 1,
      deletions: 0,
      filesCount: 1,
      status: 'needs_review',
      body: 'Add rate limiting. Closes #471.',
    })
    .returning();
  // persist the patch so the reviewer can reconstruct a diff (MockGit also returns one)
  await db.insert(t.prFiles).values({
    prId: pr!.id,
    path: 'src/config.ts',
    additions: 1,
    deletions: 0,
    patch: '@@ -10,3 +10,4 @@\n   port: 3000,\n+  stripeKey: "sk_live_xxx",\n   redisUrl: x,',
  });
  return { repo: repo!, pr: pr! };
}

d('A2 reviews + agents (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    workspaceId = ws!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function appWith(structured: unknown, provider: 'openai' | 'anthropic' = 'openai') {
    return buildApp({
      config: config(),
      db: pg.handle.db,
      overrides: {
        embedder: new MockEmbedder(),
        git: new MockGitClient({ diff: DIFF }),
        llm: {
          [provider]: new MockLLMProvider(provider, { structured }),
        },
      },
    });
  }

  it('agents CRUD', async () => {
    const app = await appWith(REVIEW_FIXTURE);

    const created = await app.inject({
      method: 'POST',
      url: '/agents',
      payload: {
        name: 'Test Reviewer',
        provider: 'openai',
        model: 'gpt-4.1',
        system_prompt: 'You are a reviewer.',
      },
    });
    expect(created.statusCode).toBe(201);
    const agent = created.json();
    expect(agent.version).toBe(1);

    const list = (await app.inject({ method: 'GET', url: '/agents' })).json();
    expect(list.some((a: { id: string }) => a.id === agent.id)).toBe(true);

    // a config change bumps version
    const updated = (
      await app.inject({
        method: 'PUT',
        url: `/agents/${agent.id}`,
        payload: { system_prompt: 'Updated prompt.' },
      })
    ).json();
    expect(updated.version).toBe(2);

    await app.close();
  });

  it('runs a review: map-reduce + grounding drops the hallucinated finding, keeps the valid one', async () => {
    const app = await appWith(REVIEW_FIXTURE);
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);

    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'Sec', provider: 'openai', model: 'gpt-4.1', system_prompt: 'sec' },
      })
    ).json();

    const res = await app.inject({
      method: 'POST',
      url: `/pulls/${pr.id}/review`,
      payload: { agentId: agent.id },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.runs).toHaveLength(1);

    // runReview is fire-and-forget: wait for the background run, then read the
    // persisted reviews (the POST returns runIds, not the reviews themselves).
    await waitForPrRuns(pg.handle.db, pr.id, { expected: 1 });
    const reviews = (
      await app.inject({ method: 'GET', url: `/pulls/${pr.id}/reviews` })
    ).json();
    expect(reviews).toHaveLength(1);

    const review = reviews[0];
    expect(review.verdict).toBe('request_changes');
    // Score is derived from the GROUNDED findings, not the model's self-reported
    // 42: grounding keeps one CRITICAL (line 11) ⇒ 100 − 35 = 65.
    expect(review.score).toBe(65);
    // grounding kept only the valid finding (line 11), dropped the line-999 one
    expect(review.findings).toHaveLength(1);
    expect(review.findings[0].file).toBe('src/config.ts');
    expect(review.findings[0].start_line).toBe(11);

    // a run_traces document was written (single doc)
    const runId = body.runs[0].run_id;
    const trace = (await app.inject({ method: 'GET', url: `/runs/${runId}/trace` })).json();
    expect(trace.config.model).toBe('gpt-4.1');
    expect(trace.stats.grounding).toBe('1/2 passed');
    expect(trace.log.length).toBeGreaterThan(0);

    // agent_runs row populated for A5 to aggregate
    const [run] = await pg.handle.db.select().from(t.agentRuns).where(eq(t.agentRuns.id, runId));
    expect(run!.status).toBe('done');
    expect(run!.findingsCount).toBe(1);
    expect(run!.grounding).toBe('1/2 passed');

    await app.close();
  });

  it('dual-provider structured output: anthropic provider returns the same Review shape', async () => {
    const app = await appWith(REVIEW_FIXTURE, 'anthropic');
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);
    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'Claude Rev', provider: 'anthropic', model: 'claude-x', system_prompt: 'rev' },
      })
    ).json();
    await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent.id } });
    await waitForPrRuns(pg.handle.db, pr.id, { expected: 1 });
    const reviews = (
      await app.inject({ method: 'GET', url: `/pulls/${pr.id}/reviews` })
    ).json();
    expect(reviews[0].findings).toHaveLength(1);
    expect(reviews[0].model).toBe('claude-x');
    await app.close();
  });

  it('finding actions: accept, dismiss', async () => {
    const app = await appWith(REVIEW_FIXTURE);
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);
    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'ActAgent', provider: 'openai', model: 'gpt-4.1', system_prompt: 's' },
      })
    ).json();
    await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent.id } });
    await waitForPrRuns(pg.handle.db, pr.id, { expected: 1 });
    const reviews = (
      await app.inject({ method: 'GET', url: `/pulls/${pr.id}/reviews` })
    ).json();
    const findingId = reviews[0].findings[0].id;

    const accepted = (
      await app.inject({ method: 'POST', url: `/findings/${findingId}/accept` })
    ).json();
    expect(accepted.finding.accepted_at).not.toBeNull();

    const dismissed = (
      await app.inject({ method: 'POST', url: `/findings/${findingId}/dismiss` })
    ).json();
    expect(dismissed.finding.dismissed_at).not.toBeNull();
    expect(dismissed.finding.accepted_at).toBeNull();

    await app.close();
  });

  it('SSE: /runs/:id/events streams events and completes', async () => {
    const app = await appWith(REVIEW_FIXTURE);
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);
    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'SseAgent', provider: 'openai', model: 'gpt-4.1', system_prompt: 's' },
      })
    ).json();
    // The run is synchronous; events are buffered on the bus. Subscribing after
    // the run still replays the buffer (replay-first semantics), then completes.
    const body = (
      await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent.id } })
    ).json();
    const runId = body.runs[0].run_id;

    const sse = await app.inject({ method: 'GET', url: `/runs/${runId}/events` });
    expect(sse.statusCode).toBe(200);
    expect(sse.headers['content-type']).toContain('text/event-stream');
    // The replay buffer should contain our log lines as SSE `data:` frames.
    expect(sse.payload).toContain('Starting review');
    expect(sse.payload).toContain('Citation grounding');
    await app.close();
  });

  it('run all enabled agents reviews with each enabled agent', async () => {
    const app = await appWith(REVIEW_FIXTURE);
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);
    const body = (
      await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { all: true } })
    ).json();
    // seed has 3 enabled agents (src/db/seed.ts); we may have created more above in this PR's ws.
    expect(body.runs.length).toBeGreaterThanOrEqual(3);

    // L01 — every run queued by ONE "Run review" action shares one batch_id.
    const ids = body.runs.map((r: { run_id: string }) => r.run_id);
    const rows = await pg.handle.db.select().from(t.agentRuns).where(eq(t.agentRuns.prId, pr.id));
    const batchIds = new Set(rows.filter((r) => ids.includes(r.id)).map((r) => r.batchId));
    expect(batchIds.size).toBe(1);
    expect([...batchIds][0]).not.toBeNull();

    await app.close();
  });

  it('L01 run cost: persisted, surfaced on runs/trace/PR list, summed over every settled run, legacy estimated', async () => {
    const app = await appWith(REVIEW_FIXTURE);
    const { repo, pr } = await setupRepoAndPr(pg.handle.db, workspaceId);
    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'CostAgent', provider: 'openai', model: 'gpt-4.1', system_prompt: 's' },
      })
    ).json();

    // ---- batch 1 ------------------------------------------------------------
    const first = (
      await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent.id } })
    ).json();
    const runId1 = first.runs[0].run_id;
    await waitForPrRuns(pg.handle.db, pr.id, { expected: 1 });

    // cost + batch persisted on the agent_runs row (mock LLM yields costUsd 0.001/call)
    const [row1] = await pg.handle.db.select().from(t.agentRuns).where(eq(t.agentRuns.id, runId1));
    expect(row1!.costUsd).toBeCloseTo(0.001, 6);
    expect(row1!.batchId).not.toBeNull();

    // GET /pulls/:id/runs carries cost_usd
    const runsList = (await app.inject({ method: 'GET', url: `/pulls/${pr.id}/runs` })).json();
    expect(runsList[0].cost_usd).toBeCloseTo(0.001, 6);

    // GET /runs/:id/trace carries stats.cost_usd
    const trace = (await app.inject({ method: 'GET', url: `/runs/${runId1}/trace` })).json();
    expect(trace.stats.cost_usd).toBeCloseTo(0.001, 6);

    // ---- batch 2 (a re-run) — PR list sums BOTH settled runs (criterion 12) --
    const second = (
      await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent.id } })
    ).json();
    const runId2 = second.runs[0].run_id;
    await waitForPrRuns(pg.handle.db, pr.id, { expected: 2 });
    const [row2] = await pg.handle.db.select().from(t.agentRuns).where(eq(t.agentRuns.id, runId2));
    expect(row2!.batchId).not.toBe(row1!.batchId);

    const pulls = (await app.inject({ method: 'GET', url: `/repos/${repo.id}/pulls` })).json();
    const meta = pulls.find((p: { id: string }) => p.id === pr.id);
    // Two settled runs at 0.001 each, in different batches → 0.002.
    expect(meta.cost_usd).toBeCloseTo(0.002, 6);

    // ---- legacy rows (persisted before cost_usd existed) ---------------------
    // Null the stored cost: read paths fall back to tokens × PriceBook.
    // Mock runs are gpt-4.1 with 100 in / 50 out ⇒ (100·2.0 + 50·8.0)/1M = 0.0006.
    await pg.handle.db.update(t.agentRuns).set({ costUsd: null }).where(eq(t.agentRuns.prId, pr.id));
    const legacyRuns = (await app.inject({ method: 'GET', url: `/pulls/${pr.id}/runs` })).json();
    expect(legacyRuns[0].cost_usd).toBeCloseTo(0.0006, 6);
    const legacyPulls = (await app.inject({ method: 'GET', url: `/repos/${repo.id}/pulls` })).json();
    const legacyMeta = legacyPulls.find((p: { id: string }) => p.id === pr.id);
    expect(legacyMeta.cost_usd).toBeCloseTo(0.0012, 6); // both settled runs estimated

    // Old trace docs (persisted without stats.cost_usd) are backfilled on read.
    const [traceRow] = await pg.handle.db
      .select()
      .from(t.runTraces)
      .where(eq(t.runTraces.runId, runId1));
    const doc = traceRow!.trace as { stats: Record<string, unknown> };
    delete doc.stats['cost_usd'];
    await pg.handle.db.update(t.runTraces).set({ trace: doc }).where(eq(t.runTraces.runId, runId1));
    const legacyTrace = (await app.inject({ method: 'GET', url: `/runs/${runId1}/trace` })).json();
    expect(legacyTrace.stats.cost_usd).toBeCloseTo(0.0006, 6);

    await app.close();
  });

  it('L01 severity counts: PR list carries latest-batch run_ids + findings_by_severity', async () => {
    const app = await appWith(REVIEW_FIXTURE);
    const { repo, pr } = await setupRepoAndPr(pg.handle.db, workspaceId);
    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'SevAgent', provider: 'openai', model: 'gpt-4.1', system_prompt: 's' },
      })
    ).json();

    // Never reviewed → no batch at all (the list shows a dash, not zeros).
    const before = (await app.inject({ method: 'GET', url: `/repos/${repo.id}/pulls` })).json();
    expect(before.find((p: { id: string }) => p.id === pr.id).latest_batch).toBeNull();

    // ---- batch 1 ------------------------------------------------------------
    const first = (
      await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent.id } })
    ).json();
    const runId1 = first.runs[0].run_id;
    await waitForPrRuns(pg.handle.db, pr.id, { expected: 1 });

    // Expected counts = a plain COUNT over the persisted findings of that run.
    const reviews = (await app.inject({ method: 'GET', url: `/pulls/${pr.id}/reviews` })).json();
    const persisted = reviews.find((r: { run_id: string }) => r.run_id === runId1).findings;
    const expected = { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 } as Record<string, number>;
    for (const f of persisted) expected[f.severity] += 1;
    expect(persisted.length).toBeGreaterThan(0);

    const pulls1 = (await app.inject({ method: 'GET', url: `/repos/${repo.id}/pulls` })).json();
    const meta1 = pulls1.find((p: { id: string }) => p.id === pr.id);
    expect(meta1.latest_batch).toEqual({ run_ids: [runId1], findings_by_severity: expected });

    // ---- batch 2 (a re-run) — ONLY the new run counts, numbers are not doubled
    const second = (
      await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent.id } })
    ).json();
    const runId2 = second.runs[0].run_id;
    await waitForPrRuns(pg.handle.db, pr.id, { expected: 2 });

    const pulls2 = (await app.inject({ method: 'GET', url: `/repos/${repo.id}/pulls` })).json();
    const meta2 = pulls2.find((p: { id: string }) => p.id === pr.id);
    expect(meta2.latest_batch).toEqual({ run_ids: [runId2], findings_by_severity: expected });

    await app.close();
  });
});
