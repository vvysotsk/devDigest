/**
 * Characterization tests for the pulls module (onion refactor, stage T —
 * `specs/refactor-onion.md`). They pin the CURRENT behaviour of
 *   GET /repos/:id/pulls  — PR-list sync from GitHub, stat backfill, aggregates
 *   GET /pulls/:id        — PR-detail sync (pr_files / pr_commits / body / stats)
 * so the refactor to route → service → repository must keep them green
 * unchanged. Every response is also parsed with the STRICT contract schema:
 * that is the response-shape test the onion skill (R3) requires once the
 * routes declare `schema.response`.
 *
 * GitHub is ALWAYS injected (MockGitHubClient or a subclass) or explicitly
 * absent (empty MockSecretsProvider) — never the machine's real token.
 * Gated on Docker (testcontainers Postgres), like the other *.it tests.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { PrMeta, PrDetail, type RepoRef } from '@devdigest/shared';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import { MockGitHubClient, MockSecretsProvider } from '../src/adapters/mocks.js';
import * as t from '../src/db/schema.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
const PrList = z.array(PrMeta.strict());
const PrDetailStrict = PrDetail.strict();

type Db = PgFixture['handle']['db'];

let repoSeq = 0;
async function makeRepo(db: Db, workspaceId: string) {
  const name = `sync-${repoSeq++}`;
  const [repo] = await db
    .insert(t.repos)
    .values({ workspaceId, owner: 'acme', name, fullName: `acme/${name}` })
    .returning();
  return repo!;
}

async function makePr(
  db: Db,
  workspaceId: string,
  repoId: string,
  over: Partial<typeof t.pullRequests.$inferInsert> = {},
) {
  const [pr] = await db
    .insert(t.pullRequests)
    .values({
      workspaceId,
      repoId,
      number: 7,
      title: 'Old title',
      author: 'old.author',
      branch: 'old/branch',
      base: 'main',
      headSha: 'oldsha',
      additions: 5,
      deletions: 6,
      filesCount: 7,
      status: 'open',
      ...over,
    })
    .returning();
  return pr!;
}

/** A mock whose GitHub calls fail — the "offline / API error" path. */
class FailingGitHub extends MockGitHubClient {
  override async listPullRequests(_repo: RepoRef): Promise<never> {
    throw new Error('GitHub down');
  }
  override async getPullRequest(_repo: RepoRef, _n: number): Promise<never> {
    throw new Error('GitHub down');
  }
}

d('pulls sync — characterization (Testcontainers pg)', () => {
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

  // ---------------------------------------------------------------- list ---

  describe('GET /repos/:id/pulls', () => {
    it('imports GitHub PRs with every list field and returns contract-shaped rows', async () => {
      const repo = await makeRepo(db, workspaceId);
      const gh = new MockGitHubClient({
        pulls: [
          {
            number: 11,
            title: 'First',
            author: 'a.one',
            branch: 'feat/one',
            base: 'main',
            head_sha: 'sha11',
            additions: 3,
            deletions: 1,
            files_count: 2,
            status: 'open',
            opened_at: '2026-06-01T00:00:00.000Z',
            updated_at: '2026-06-02T00:00:00.000Z',
          },
          {
            number: 12,
            title: 'Second',
            author: 'a.two',
            branch: 'feat/two',
            base: 'develop',
            head_sha: 'sha12',
            additions: 9,
            deletions: 8,
            files_count: 7,
            status: 'merged',
            opened_at: null,
            updated_at: null,
          },
        ],
      });
      const app = await appWith(gh);
      const res = await app.inject({ method: 'GET', url: `/repos/${repo.id}/pulls` });
      expect(res.statusCode).toBe(200);
      const list = PrList.parse(res.json());
      expect(list.map((p) => p.number).sort()).toEqual([11, 12]);

      const first = list.find((p) => p.number === 11)!;
      expect(first).toMatchObject({
        title: 'First',
        author: 'a.one',
        branch: 'feat/one',
        base: 'main',
        head_sha: 'sha11',
        additions: 3,
        deletions: 1,
        files_count: 2,
        status: 'needs_review', // derived: open + never reviewed
        opened_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-02T00:00:00.000Z',
        score: null,
        cost_usd: null,
        latest_batch: null,
      });
      expect(first.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(list.find((p) => p.number === 12)!.status).toBe('merged');

      const rows = await db.select().from(t.pullRequests).where(eq(t.pullRequests.repoId, repo.id));
      const row11 = rows.find((r) => r.number === 11)!;
      expect(row11.openedAt?.toISOString()).toBe('2026-06-01T00:00:00.000Z');
      expect(row11.workspaceId).toBe(workspaceId);
      expect(rows.find((r) => r.number === 12)!.base).toBe('develop');
      await app.close();
    });

    it('on conflict updates only title, head_sha, status and updated_at', async () => {
      const repo = await makeRepo(db, workspaceId);
      await makePr(db, workspaceId, repo.id, {
        openedAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      });
      const gh = new MockGitHubClient({
        pulls: [
          {
            number: 7,
            title: 'New title',
            author: 'new.author',
            branch: 'new/branch',
            base: 'release',
            head_sha: 'newsha',
            additions: 1,
            deletions: 2,
            files_count: 3,
            status: 'closed',
            opened_at: '2026-05-05T00:00:00.000Z',
            updated_at: '2026-05-06T00:00:00.000Z',
          },
        ],
      });
      const app = await appWith(gh);
      const res = await app.inject({ method: 'GET', url: `/repos/${repo.id}/pulls` });
      expect(res.statusCode).toBe(200);
      const [pr] = PrList.parse(res.json());
      expect(pr!.status).toBe('closed');

      const [row] = await db.select().from(t.pullRequests).where(eq(t.pullRequests.repoId, repo.id));
      expect(row).toMatchObject({
        title: 'New title',
        headSha: 'newsha',
        status: 'closed',
        // kept from the existing row:
        author: 'old.author',
        branch: 'old/branch',
        base: 'main',
        additions: 5,
        deletions: 6,
        filesCount: 7,
      });
      expect(row!.updatedAt?.toISOString()).toBe('2026-05-06T00:00:00.000Z');
      expect(row!.openedAt?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      await app.close();
    });

    it('backfills zero diff stats from the detail endpoint, at most 10 PRs per request', async () => {
      const repo = await makeRepo(db, workspaceId);
      for (let n = 1; n <= 12; n++) {
        await makePr(db, workspaceId, repo.id, { number: n, additions: 0, deletions: 0, filesCount: 0 });
      }
      const gh = new MockGitHubClient({
        pulls: [], // nothing to import — only the backfill runs
        detail: { additions: 11, deletions: 12, files_count: 13 },
      });
      const app = await appWith(gh);
      const res = await app.inject({ method: 'GET', url: `/repos/${repo.id}/pulls` });
      expect(res.statusCode).toBe(200);
      const list = PrList.parse(res.json());
      expect(list.filter((p) => p.additions === 11 && p.deletions === 12 && p.files_count === 13)).toHaveLength(10);
      expect(list.filter((p) => p.additions === 0 && p.deletions === 0 && p.files_count === 0)).toHaveLength(2);

      const rows = await db.select().from(t.pullRequests).where(eq(t.pullRequests.repoId, repo.id));
      expect(rows.filter((r) => r.additions === 11 && r.filesCount === 13)).toHaveLength(10);
      // The backfill writes stats only — no body, no files.
      expect(rows.every((r) => r.body === null)).toBe(true);
      const files = await db.select().from(t.prFiles);
      expect(files.filter((f) => rows.some((r) => r.id === f.prId))).toHaveLength(0);
      await app.close();
    });

    it('serves persisted rows when the GitHub list call fails', async () => {
      const repo = await makeRepo(db, workspaceId);
      await makePr(db, workspaceId, repo.id);
      const app = await appWith(new FailingGitHub());
      const res = await app.inject({ method: 'GET', url: `/repos/${repo.id}/pulls` });
      expect(res.statusCode).toBe(200);
      const list = PrList.parse(res.json());
      expect(list.map((p) => [p.number, p.title])).toEqual([[7, 'Old title']]);
      await app.close();
    });

    it('serves persisted rows without syncing when no GitHub token is configured', async () => {
      const repo = await makeRepo(db, workspaceId);
      await makePr(db, workspaceId, repo.id, { additions: 0, deletions: 0, filesCount: 0 });
      const app = await appWith(); // empty secrets → container.github() throws ConfigError
      const res = await app.inject({ method: 'GET', url: `/repos/${repo.id}/pulls` });
      expect(res.statusCode).toBe(200);
      const [pr] = PrList.parse(res.json());
      expect(pr).toMatchObject({ number: 7, additions: 0, files_count: 0 }); // no backfill offline
      await app.close();
    });

    it('derives needs_review / reviewed / stale from last_reviewed_sha and age; keeps merged', async () => {
      const repo = await makeRepo(db, workspaceId);
      const recent = new Date(Date.now() - 60_000);
      const old = new Date(Date.now() - 30 * 86_400_000);
      await makePr(db, workspaceId, repo.id, { number: 1, headSha: 'h1', lastReviewedSha: null, updatedAt: recent });
      await makePr(db, workspaceId, repo.id, { number: 2, headSha: 'h2', lastReviewedSha: 'h2', updatedAt: recent });
      await makePr(db, workspaceId, repo.id, { number: 3, headSha: 'h3', lastReviewedSha: 'h3', updatedAt: old });
      await makePr(db, workspaceId, repo.id, { number: 4, headSha: 'h4', lastReviewedSha: 'older', updatedAt: recent });
      await makePr(db, workspaceId, repo.id, { number: 5, headSha: 'h5', lastReviewedSha: 'h5', status: 'merged' });
      const app = await appWith(new MockGitHubClient({ pulls: [] }));
      const res = await app.inject({ method: 'GET', url: `/repos/${repo.id}/pulls` });
      const byNumber = new Map(PrList.parse(res.json()).map((p) => [p.number, p.status]));
      expect(Object.fromEntries(byNumber)).toEqual({
        1: 'needs_review',
        2: 'reviewed',
        3: 'stale',
        4: 'needs_review',
        5: 'merged',
      });
      await app.close();
    });

    it('computes score (latest review), cost_usd (all done runs) and latest_batch (findings of the newest batch)', async () => {
      const repo = await makeRepo(db, workspaceId);
      const pr = await makePr(db, workspaceId, repo.id);
      const batchA = crypto.randomUUID();
      const batchB = crypto.randomUUID();
      const t0 = Date.now() - 3_600_000;
      const run = async (batchId: string, minutes: number, status: string, costUsd: number | null) => {
        const [r] = await db
          .insert(t.agentRuns)
          .values({ workspaceId, prId: pr.id, batchId, status, costUsd, ranAt: new Date(t0 + minutes * 60_000) })
          .returning();
        return r!;
      };
      const a1 = await run(batchA, 0, 'done', 0.01);
      await run(batchA, 1, 'done', 0.02);
      await run(batchA, 2, 'failed', 0.5); // failed: not summed
      const b1 = await run(batchB, 10, 'done', 0.005);

      const review = async (runId: string, minutes: number, score: number, kind: 'review' | 'summary' = 'review') => {
        const [rv] = await db
          .insert(t.reviews)
          .values({ workspaceId, prId: pr.id, runId, kind, score, createdAt: new Date(t0 + minutes * 60_000) })
          .returning();
        return rv!;
      };
      await review(a1.id, 0, 40);
      const newest = await review(b1.id, 10, 77);
      await review(b1.id, 11, 5, 'summary'); // summaries never count as the score
      const finding = (severity: string) => ({
        reviewId: newest.id,
        file: 'a.ts',
        startLine: 1,
        endLine: 1,
        severity,
        category: 'bug',
        title: 't',
        rationale: 'r',
        confidence: 0.9,
      });
      await db.insert(t.findings).values([finding('CRITICAL'), finding('CRITICAL'), finding('WARNING')]);

      const app = await appWith(new MockGitHubClient({ pulls: [] }));
      const res = await app.inject({ method: 'GET', url: `/repos/${repo.id}/pulls` });
      const [item] = PrList.parse(res.json());
      expect(item!.score).toBe(77);
      expect(item!.cost_usd).toBeCloseTo(0.035, 10);
      expect(item!.latest_batch).toEqual({
        run_ids: [b1.id],
        findings_by_severity: { CRITICAL: 2, WARNING: 1, SUGGESTION: 0 },
      });
      await app.close();
    });

    it('returns 404 for an unknown repo and for a repo in another workspace', async () => {
      const [other] = await db.insert(t.workspaces).values({ name: 'other-ws' }).returning();
      const foreign = await makeRepo(db, other!.id);
      const app = await appWith(new MockGitHubClient());
      const unknown = await app.inject({ method: 'GET', url: `/repos/${crypto.randomUUID()}/pulls` });
      expect(unknown.statusCode).toBe(404);
      expect(unknown.json().error.code).toBe('not_found');
      const cross = await app.inject({ method: 'GET', url: `/repos/${foreign.id}/pulls` });
      expect(cross.statusCode).toBe(404);
      await app.close();
    });
  });

  // -------------------------------------------------------------- detail ---

  describe('GET /pulls/:id', () => {
    async function prWithOldDetail() {
      const repo = await makeRepo(db, workspaceId);
      const pr = await makePr(db, workspaceId, repo.id, { body: 'old body', status: 'needs_review' });
      await db.insert(t.prFiles).values([
        { prId: pr.id, path: 'old/a.ts', additions: 1, deletions: 1, patch: 'old-a' },
        { prId: pr.id, path: 'old/b.ts', additions: 2, deletions: 2, patch: null },
      ]);
      await db.insert(t.prCommits).values([
        { prId: pr.id, sha: 'c-old-1', message: 'old one', author: 'x', committedAt: new Date('2026-01-01T00:00:00.000Z') },
        { prId: pr.id, sha: 'c-old-2', message: 'old two', author: 'y', committedAt: null },
      ]);
      return { repo, pr };
    }

    it('replaces files and commits, updates body and stats, and returns the GitHub detail plus id', async () => {
      const { pr } = await prWithOldDetail();
      const gh = new MockGitHubClient({
        detail: {
          body: 'new body',
          additions: 50,
          deletions: 60,
          files_count: 70,
          files: [
            { path: 'new/x.ts', additions: 3, deletions: 0, patch: '@@ x' },
            { path: 'new/y.ts', additions: 0, deletions: 4, patch: null },
          ],
          commits: [{ sha: 'c-new', message: 'new', author: 'z', committed_at: '2026-06-01T00:00:00Z' }],
        },
      });
      const expected = { ...(await gh.getPullRequest({ owner: 'acme', name: 'x' }, pr.number)), id: pr.id };
      const app = await appWith(gh);
      const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}` });
      expect(res.statusCode).toBe(200);
      const body = PrDetailStrict.parse(res.json());
      expect(body).toEqual(expected);
      expect(body.status).toBe('open'); // GitHub's merge state, not the DB column

      const files = await db.select().from(t.prFiles).where(eq(t.prFiles.prId, pr.id));
      expect(files.map((f) => [f.path, f.additions, f.deletions, f.patch]).sort()).toEqual([
        ['new/x.ts', 3, 0, '@@ x'],
        ['new/y.ts', 0, 4, null],
      ]);
      const commits = await db.select().from(t.prCommits).where(eq(t.prCommits.prId, pr.id));
      expect(commits.map((c) => [c.sha, c.message, c.author, c.committedAt?.toISOString() ?? null])).toEqual([
        ['c-new', 'new', 'z', '2026-06-01T00:00:00.000Z'],
      ]);
      const [row] = await db.select().from(t.pullRequests).where(eq(t.pullRequests.id, pr.id));
      expect(row).toMatchObject({ body: 'new body', additions: 50, deletions: 60, filesCount: 70 });
      // The detail sync does not touch the list columns:
      expect(row).toMatchObject({ title: 'Old title', headSha: 'oldsha', status: 'needs_review' });
      await app.close();
    });

    it('empty files and commits from GitHub delete every persisted row', async () => {
      const { pr } = await prWithOldDetail();
      const app = await appWith(new MockGitHubClient({ detail: { files: [], commits: [] } }));
      const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}` });
      expect(res.statusCode).toBe(200);
      const body = PrDetailStrict.parse(res.json());
      expect(body.files).toEqual([]);
      expect(body.commits).toEqual([]);
      expect(await db.select().from(t.prFiles).where(eq(t.prFiles.prId, pr.id))).toHaveLength(0);
      expect(await db.select().from(t.prCommits).where(eq(t.prCommits.prId, pr.id))).toHaveLength(0);
      await app.close();
    });

    it('serves the persisted detail (DB status column) when no GitHub token is configured', async () => {
      const { pr } = await prWithOldDetail();
      const app = await appWith();
      const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}` });
      expect(res.statusCode).toBe(200);
      const body = PrDetailStrict.parse(res.json());
      expect(body).toMatchObject({
        id: pr.id,
        number: 7,
        title: 'Old title',
        author: 'old.author',
        branch: 'old/branch',
        base: 'main',
        head_sha: 'oldsha',
        additions: 5,
        deletions: 6,
        files_count: 7,
        status: 'needs_review',
        body: 'old body',
      });
      expect(body.files.map((f) => f.path).sort()).toEqual(['old/a.ts', 'old/b.ts']);
      expect(body.files.find((f) => f.path === 'old/b.ts')!.patch).toBeNull();
      const byShaCommit = new Map(body.commits.map((c) => [c.sha, c.committed_at]));
      expect(byShaCommit.get('c-old-1')).toBe('2026-01-01T00:00:00.000Z');
      expect(byShaCommit.get('c-old-2')).toBeNull();
      expect(body).not.toHaveProperty('linked_issue');
      await app.close();
    });

    it('serves the persisted detail and leaves rows untouched when the GitHub detail call fails', async () => {
      const { pr } = await prWithOldDetail();
      const app = await appWith(new FailingGitHub());
      const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}` });
      expect(res.statusCode).toBe(200);
      const body = PrDetailStrict.parse(res.json());
      expect(body.body).toBe('old body');
      expect(await db.select().from(t.prFiles).where(eq(t.prFiles.prId, pr.id))).toHaveLength(2);
      expect(await db.select().from(t.prCommits).where(eq(t.prCommits.prId, pr.id))).toHaveLength(2);
      await app.close();
    });

    it('returns 404 for an unknown PR and for a PR in another workspace', async () => {
      const [other] = await db.insert(t.workspaces).values({ name: 'other-ws-detail' }).returning();
      const foreignRepo = await makeRepo(db, other!.id);
      const foreignPr = await makePr(db, other!.id, foreignRepo.id);
      const app = await appWith(new MockGitHubClient());
      const unknown = await app.inject({ method: 'GET', url: `/pulls/${crypto.randomUUID()}` });
      expect(unknown.statusCode).toBe(404);
      const cross = await app.inject({ method: 'GET', url: `/pulls/${foreignPr.id}` });
      expect(cross.statusCode).toBe(404);
      await app.close();
    });
  });
});
