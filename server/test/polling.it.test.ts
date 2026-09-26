/**
 * Characterization tests for POST /repos/:id/poll (onion refactor, stage T —
 * `specs/refactor-onion.md`). Pins the CURRENT behaviour: upsert of the PR
 * list, `synced` count, `last_polled_at` bump, no review triggered, and the
 * error paths (no token / GitHub failure are NOT swallowed here, unlike the
 * PR-list route). The response is parsed with the strict `PollResult`
 * contract (added in stage b) — the R3 response-shape test.
 *
 * NOTE (pinned on purpose): a PR first seen by poll is stored with
 * `opened_at = null` even when GitHub sends it. Stage b′ changes this in its
 * own commit and updates the assertion explicitly.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { PollResult, type RepoRef } from '@devdigest/shared';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import { MockGitHubClient, MockSecretsProvider } from '../src/adapters/mocks.js';
import * as t from '../src/db/schema.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
const PollResponse = PollResult.strict();

type Db = PgFixture['handle']['db'];

let repoSeq = 0;
async function makeRepo(db: Db, workspaceId: string) {
  const name = `poll-${repoSeq++}`;
  const [repo] = await db
    .insert(t.repos)
    .values({ workspaceId, owner: 'acme', name, fullName: `acme/${name}` })
    .returning();
  return repo!;
}

class FailingGitHub extends MockGitHubClient {
  override async listPullRequests(_repo: RepoRef): Promise<never> {
    throw new Error('GitHub down');
  }
}

d('POST /repos/:id/poll — characterization (Testcontainers pg)', () => {
  let pg: PgFixture;
  let db: Db;
  let workspaceId: string;

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

  const appWith = (github?: MockGitHubClient) =>
    buildApp({
      config: config(),
      db,
      overrides: github ? { github } : { secrets: new MockSecretsProvider({}) },
    });

  it('upserts the GitHub PR list, counts it, bumps last_polled_at and triggers no review', async () => {
    const repo = await makeRepo(db, workspaceId);
    await db.insert(t.pullRequests).values({
      workspaceId,
      repoId: repo.id,
      number: 1,
      title: 'Old',
      author: 'old.author',
      branch: 'old/branch',
      base: 'main',
      headSha: 'old1',
      additions: 5,
      deletions: 6,
      filesCount: 7,
      status: 'open',
      openedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const gh = new MockGitHubClient({
      pulls: [
        {
          number: 1,
          title: 'Renamed',
          author: 'new.author',
          branch: 'new/branch',
          base: 'release',
          head_sha: 'new1',
          additions: 1,
          deletions: 1,
          files_count: 1,
          status: 'merged',
          opened_at: '2026-05-01T00:00:00.000Z',
          updated_at: '2026-05-02T00:00:00.000Z',
        },
        {
          number: 2,
          title: 'Brand new',
          author: 'b.author',
          branch: 'feat/b',
          base: 'main',
          head_sha: 'new2',
          additions: 10,
          deletions: 2,
          files_count: 3,
          status: 'open',
          opened_at: '2026-05-03T00:00:00.000Z',
          updated_at: '2026-05-04T00:00:00.000Z',
        },
      ],
    });
    const before = Date.now();
    const app = await appWith(gh);
    const res = await app.inject({ method: 'POST', url: `/repos/${repo.id}/poll` });
    expect(res.statusCode).toBe(200);
    expect(PollResponse.parse(res.json())).toEqual({ synced: 2, reviewTriggered: false });

    const rows = await db.select().from(t.pullRequests).where(eq(t.pullRequests.repoId, repo.id));
    const existing = rows.find((r) => r.number === 1)!;
    expect(existing).toMatchObject({
      title: 'Renamed',
      headSha: 'new1',
      status: 'merged',
      author: 'old.author', // kept
      branch: 'old/branch', // kept
      base: 'main', // kept
      additions: 5, // kept
    });
    expect(existing.updatedAt?.toISOString()).toBe('2026-05-02T00:00:00.000Z');
    expect(existing.openedAt?.toISOString()).toBe('2026-01-01T00:00:00.000Z');

    const created = rows.find((r) => r.number === 2)!;
    expect(created).toMatchObject({
      workspaceId,
      title: 'Brand new',
      author: 'b.author',
      branch: 'feat/b',
      base: 'main',
      headSha: 'new2',
      additions: 10,
      deletions: 2,
      filesCount: 3,
      status: 'open',
    });
    expect(created.updatedAt?.toISOString()).toBe('2026-05-04T00:00:00.000Z');
    // Pinned current behaviour (changed deliberately in stage b′):
    expect(created.openedAt).toBeNull();

    const [repoRow] = await db.select().from(t.repos).where(eq(t.repos.id, repo.id));
    expect(repoRow!.lastPolledAt).not.toBeNull();
    expect(repoRow!.lastPolledAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);

    const runs = await db.select().from(t.agentRuns);
    expect(runs.filter((r) => rows.some((p) => p.id === r.prId))).toHaveLength(0);
    await app.close();
  });

  it('with an empty GitHub list returns synced 0 and still bumps last_polled_at', async () => {
    const repo = await makeRepo(db, workspaceId);
    const app = await appWith(new MockGitHubClient({ pulls: [] }));
    const res = await app.inject({ method: 'POST', url: `/repos/${repo.id}/poll` });
    expect(PollResponse.parse(res.json())).toEqual({ synced: 0, reviewTriggered: false });
    const [repoRow] = await db.select().from(t.repos).where(eq(t.repos.id, repo.id));
    expect(repoRow!.lastPolledAt).not.toBeNull();
    await app.close();
  });

  it('fails with 500 config_error when no GitHub token is configured, writing nothing', async () => {
    const repo = await makeRepo(db, workspaceId);
    const app = await appWith();
    const res = await app.inject({ method: 'POST', url: `/repos/${repo.id}/poll` });
    expect(res.statusCode).toBe(500);
    expect(res.json().error.code).toBe('config_error');
    const [repoRow] = await db.select().from(t.repos).where(eq(t.repos.id, repo.id));
    expect(repoRow!.lastPolledAt).toBeNull();
    await app.close();
  });

  it('fails with 500 when the GitHub list call fails, writing nothing', async () => {
    const repo = await makeRepo(db, workspaceId);
    const app = await appWith(new FailingGitHub());
    const res = await app.inject({ method: 'POST', url: `/repos/${repo.id}/poll` });
    expect(res.statusCode).toBe(500);
    expect(res.json().error.code).toBe('internal_error');
    const [repoRow] = await db.select().from(t.repos).where(eq(t.repos.id, repo.id));
    expect(repoRow!.lastPolledAt).toBeNull();
    expect(await db.select().from(t.pullRequests).where(eq(t.pullRequests.repoId, repo.id))).toHaveLength(0);
    await app.close();
  });

  // Added in stage b (not a characterization): all upserts + last_polled_at
  // run in ONE transaction. Before stage b the first PR stayed inserted when a
  // later insert failed.
  it('rolls every write back when one upsert fails', async () => {
    const repo = await makeRepo(db, workspaceId);
    const ok = {
      number: 1,
      title: 'Fine',
      author: 'a',
      branch: 'b',
      base: 'main',
      head_sha: 's1',
      additions: 1,
      deletions: 1,
      files_count: 1,
      status: 'open' as const,
      opened_at: null,
      updated_at: null,
    };
    // pull_requests.title is NOT NULL → the second upsert fails.
    const bad = { ...ok, number: 2, head_sha: 's2', title: null as unknown as string };
    const app = await appWith(new MockGitHubClient({ pulls: [ok, bad] }));
    const res = await app.inject({ method: 'POST', url: `/repos/${repo.id}/poll` });
    expect(res.statusCode).toBe(500);
    expect(await db.select().from(t.pullRequests).where(eq(t.pullRequests.repoId, repo.id))).toHaveLength(0);
    const [repoRow] = await db.select().from(t.repos).where(eq(t.repos.id, repo.id));
    expect(repoRow!.lastPolledAt).toBeNull();
    await app.close();
  });

  it('returns 404 for an unknown repo and for a repo in another workspace', async () => {
    const [other] = await db.insert(t.workspaces).values({ name: 'other-ws-poll' }).returning();
    const foreign = await makeRepo(db, other!.id);
    const app = await appWith(new MockGitHubClient());
    const unknown = await app.inject({ method: 'POST', url: `/repos/${crypto.randomUUID()}/poll` });
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json().error.code).toBe('not_found');
    const cross = await app.inject({ method: 'POST', url: `/repos/${foreign.id}/poll` });
    expect(cross.statusCode).toBe(404);
    const [foreignRow] = await db.select().from(t.repos).where(eq(t.repos.id, foreign.id));
    expect(foreignRow!.lastPolledAt).toBeNull();
    await app.close();
  });
});
