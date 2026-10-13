import { and, eq, sql } from 'drizzle-orm';
import type { PrCommit, PrFile, PrMeta } from '@devdigest/shared';
import type { Db, DbOrTx } from '../../db/client.js';
import * as t from '../../db/schema.js';

/**
 * pulls data-access layer — the owner of `pull_requests`, `pr_files` and
 * `pr_commits`. Rows never leave this file (onion skill R1): reads return
 * `PullRecord` or contract types, writes take plain values. Functions that a
 * use case runs inside `db.transaction` take a `DbOrTx` executor (R4).
 */

/** A persisted pull request as the pulls module uses it. */
export interface PullRecord {
  id: string;
  repoId: string;
  number: number;
  title: string;
  author: string;
  branch: string;
  base: string;
  headSha: string;
  lastReviewedSha: string | null;
  additions: number;
  deletions: number;
  filesCount: number;
  /** GitHub merge state (open/merged/closed), or the seeded review status. */
  status: string;
  body: string | null;
  openedAt: Date | null;
  updatedAt: Date | null;
}

export interface DiffStats {
  additions: number;
  deletions: number;
  filesCount: number;
}

type PullRow = typeof t.pullRequests.$inferSelect;

function toRecord(r: PullRow): PullRecord {
  return {
    id: r.id,
    repoId: r.repoId,
    number: r.number,
    title: r.title,
    author: r.author,
    branch: r.branch,
    base: r.base,
    headSha: r.headSha,
    lastReviewedSha: r.lastReviewedSha,
    additions: r.additions,
    deletions: r.deletions,
    filesCount: r.filesCount,
    status: r.status,
    body: r.body,
    openedAt: r.openedAt,
    updatedAt: r.updatedAt,
  };
}

export class PullsRepository {
  constructor(private db: Db) {}

  /** A PR by id, scoped to the workspace. */
  async getInWorkspace(workspaceId: string, id: string): Promise<PullRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(t.pullRequests)
      .where(and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.id, id)));
    return row ? toRecord(row) : undefined;
  }

  /** Every persisted PR of a repo (the repo is already workspace-checked by the caller). */
  async listByRepo(repoId: string): Promise<PullRecord[]> {
    const rows = await this.db.select().from(t.pullRequests).where(eq(t.pullRequests.repoId, repoId));
    return rows.map(toRecord);
  }

  /**
   * Insert a PR from the GitHub list payload, or on (repo_id, number) conflict
   * update only title / head_sha / status / updated_at — author, branch and
   * stats of an existing row are kept. `opened_at` is filled only when the
   * stored value is null (coalesce): a known date is never overwritten.
   */
  async upsertFromGitHub(exec: DbOrTx, workspaceId: string, repoId: string, pr: PrMeta): Promise<void> {
    await exec
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId,
        number: pr.number,
        title: pr.title,
        author: pr.author,
        branch: pr.branch,
        base: pr.base,
        headSha: pr.head_sha,
        additions: pr.additions,
        deletions: pr.deletions,
        filesCount: pr.files_count,
        status: pr.status,
        openedAt: pr.opened_at ? new Date(pr.opened_at) : null,
        updatedAt: pr.updated_at ? new Date(pr.updated_at) : null,
      })
      .onConflictDoUpdate({
        target: [t.pullRequests.repoId, t.pullRequests.number],
        set: {
          title: pr.title,
          headSha: pr.head_sha,
          status: pr.status,
          updatedAt: pr.updated_at ? new Date(pr.updated_at) : null,
          openedAt: sql`coalesce(${t.pullRequests.openedAt}, excluded.opened_at)`,
        },
      });
  }

  /** Backfill diff stats (the GitHub list payload has none). */
  async setStats(id: string, stats: DiffStats): Promise<void> {
    await this.db
      .update(t.pullRequests)
      .set({ additions: stats.additions, deletions: stats.deletions, filesCount: stats.filesCount })
      .where(eq(t.pullRequests.id, id));
  }

  /** Replace every `pr_files` row of the PR. */
  async replaceFiles(exec: DbOrTx, prId: string, files: readonly PrFile[]): Promise<void> {
    await exec.delete(t.prFiles).where(eq(t.prFiles.prId, prId));
    if (files.length === 0) return;
    await exec.insert(t.prFiles).values(
      files.map((f) => ({
        prId,
        path: f.path,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch ?? null,
      })),
    );
  }

  /** Replace every `pr_commits` row of the PR. */
  async replaceCommits(exec: DbOrTx, prId: string, commits: readonly PrCommit[]): Promise<void> {
    await exec.delete(t.prCommits).where(eq(t.prCommits.prId, prId));
    if (commits.length === 0) return;
    await exec.insert(t.prCommits).values(
      commits.map((c) => ({
        prId,
        sha: c.sha,
        message: c.message,
        author: c.author,
        committedAt: c.committed_at ? new Date(c.committed_at) : null,
      })),
    );
  }

  /** Store the detail-only fields (body) and the diff stats. */
  async updateDetail(exec: DbOrTx, prId: string, detail: { body: string | null } & DiffStats): Promise<void> {
    await exec
      .update(t.pullRequests)
      .set({
        body: detail.body,
        additions: detail.additions,
        deletions: detail.deletions,
        filesCount: detail.filesCount,
      })
      .where(eq(t.pullRequests.id, prId));
  }

  async listFiles(prId: string): Promise<PrFile[]> {
    const rows = await this.db.select().from(t.prFiles).where(eq(t.prFiles.prId, prId));
    return rows.map((f) => ({ path: f.path, additions: f.additions, deletions: f.deletions, patch: f.patch ?? null }));
  }

  async listCommits(prId: string): Promise<PrCommit[]> {
    const rows = await this.db.select().from(t.prCommits).where(eq(t.prCommits.prId, prId));
    return rows.map((c) => ({
      sha: c.sha,
      message: c.message,
      author: c.author,
      committed_at: c.committedAt?.toISOString() ?? null,
    }));
  }
}
