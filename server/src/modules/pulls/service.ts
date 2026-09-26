import type {
  GitHubClient,
  PrCommentInput,
  PrDetail,
  PrMeta,
  PrReviewComment,
} from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { AppError, NotFoundError } from '../../platform/errors.js';
import {
  countFindingsBySeverity,
  emptyFindingsBySeverity,
  groupLatestBatches,
  sumSettledRunCost,
} from '../_shared/latest-batch.js';
import type { PullRecord, PullsRepository } from './repository.js';
import { deriveReviewStatus } from './status.js';

/** Only `warn` is used (pino-compatible). */
export type WarnLogger = { warn: (obj: unknown, msg?: string) => void };

export type PullsServiceDeps = Pick<Container, 'db' | 'github' | 'priceBook'>;

export interface PullsServiceRepos {
  pulls: PullsRepository;
  /** Owner of `repos` (repos module), reached through the container. */
  repos: Container['reposRepo'];
  /** Owner of `reviews` / `agent_runs` / `findings` (reviews module). */
  reviews: Container['reviewRepo'];
}

/** Diff-stat backfill cap per list request (each backfill is a detail fetch). */
const BACKFILL_LIMIT = 10;

/**
 * pulls use cases — PR import from GitHub (list + detail) and the inline
 * review comments proxy. Local-first: GitHub failures never fail a read;
 * persisted (seeded or previously imported) data is served instead.
 */
export class PullsService {
  constructor(
    private deps: PullsServiceDeps,
    private repos: PullsServiceRepos,
    private log: WarnLogger,
  ) {}

  /** GET /repos/:id/pulls — sync the list from GitHub, backfill stats, return PrMeta[]. */
  async listForRepo(workspaceId: string, repoId: string): Promise<PrMeta[]> {
    const repo = await this.repos.repos.getRef(repoId, workspaceId);
    if (!repo) throw new NotFoundError('Repo not found');

    let gh: GitHubClient | null = null;
    try {
      gh = await this.deps.github();
    } catch (err) {
      this.log.warn({ err }, 'GitHub client unavailable (no token / offline); serving persisted PRs');
    }

    if (gh) {
      try {
        const pulls = await gh.listPullRequests({ owner: repo.owner, name: repo.name });
        for (const pr of pulls) {
          await this.repos.pulls.upsertFromGitHub(this.deps.db, workspaceId, repo.id, pr);
        }
      } catch (err) {
        this.log.warn({ err }, 'GitHub PR sync skipped (no token / offline); serving persisted PRs');
      }
    }

    const rows = await this.repos.pulls.listByRepo(repo.id);

    // Diff stats aren't on GitHub's PR-list payload, so freshly-imported PRs
    // land with zeroed size/diff. Backfill them once from the detail endpoint,
    // capped per request — the periodic refetch chips away at any remainder.
    if (gh) {
      const needStats = rows
        .filter((r) => r.additions === 0 && r.deletions === 0 && r.filesCount === 0)
        .slice(0, BACKFILL_LIMIT);
      for (const r of needStats) {
        try {
          const detail = await gh.getPullRequest({ owner: repo.owner, name: repo.name }, r.number);
          const stats = { additions: detail.additions, deletions: detail.deletions, filesCount: detail.files_count };
          await this.repos.pulls.setStats(r.id, stats);
          Object.assign(r, stats);
        } catch (err) {
          this.log.warn({ err, number: r.number }, 'PR diff-stat backfill skipped');
        }
      }
    }

    return this.withAggregates(rows);
  }

  /**
   * Score (latest review), COST (every settled run, any batch) and FINDINGS
   * (latest batch) per PR. The rules live in `modules/_shared/latest-batch.ts`;
   * the reviews module's repository supplies the rows.
   */
  private async withAggregates(rows: PullRecord[]): Promise<PrMeta[]> {
    const prIds = rows.map((r) => r.id);

    const latestScoreByPr = new Map<string, number | null>();
    for (const rv of await this.repos.reviews.reviewScoresNewestFirst(prIds)) {
      if (!latestScoreByPr.has(rv.prId)) latestScoreByPr.set(rv.prId, rv.score);
    }

    const runRows = await this.repos.reviews.batchRunsForPulls(prIds);
    const costByPr = sumSettledRunCost(runRows, (model, tokensIn, tokensOut) =>
      this.deps.priceBook.estimate(model, tokensIn, tokensOut),
    );
    const latestBatchByPr = groupLatestBatches(runRows);
    const batchRunIds = [...latestBatchByPr.values()].flatMap((b) => b.runIds);
    const findingsByPr = countFindingsBySeverity(await this.repos.reviews.findingSeveritiesForRuns(batchRunIds));

    const now = Date.now();
    return rows.map((r) => {
      const batch = latestBatchByPr.get(r.id);
      return {
        id: r.id,
        number: r.number,
        title: r.title,
        author: r.author,
        branch: r.branch,
        base: r.base,
        head_sha: r.headSha,
        additions: r.additions,
        deletions: r.deletions,
        files_count: r.filesCount,
        status: deriveReviewStatus({
          ghStatus: r.status,
          lastReviewedSha: r.lastReviewedSha,
          headSha: r.headSha,
          updatedAt: r.updatedAt,
          now,
        }),
        opened_at: r.openedAt?.toISOString() ?? null,
        updated_at: r.updatedAt?.toISOString() ?? null,
        score: latestScoreByPr.has(r.id) ? latestScoreByPr.get(r.id)! : null,
        cost_usd: costByPr.get(r.id) ?? null,
        latest_batch: batch
          ? {
              run_ids: batch.runIds,
              findings_by_severity: findingsByPr.get(r.id) ?? emptyFindingsBySeverity(),
            }
          : null,
      };
    });
  }

  /**
   * GET /pulls/:id — refresh files, commits, body and stats from GitHub in ONE
   * transaction (all or nothing), else serve the persisted detail. A failed
   * write rolls back, so the fallback never sees half-replaced rows.
   */
  async getDetail(workspaceId: string, id: string): Promise<PrDetail> {
    const { pr, repo } = await this.resolvePrAndRepo(id, workspaceId);
    try {
      const gh = await this.deps.github();
      const detail = await gh.getPullRequest({ owner: repo.owner, name: repo.name }, pr.number);
      await this.deps.db.transaction(async (tx) => {
        await this.repos.pulls.replaceFiles(tx, pr.id, detail.files);
        await this.repos.pulls.replaceCommits(tx, pr.id, detail.commits);
        await this.repos.pulls.updateDetail(tx, pr.id, {
          body: detail.body ?? null,
          // Diff stats aren't on GitHub's PR-list payload — backfill them from
          // the detail fetch so the Pull Requests list shows real size/files.
          additions: detail.additions,
          deletions: detail.deletions,
          filesCount: detail.files_count,
        });
      });
      return { ...detail, id: pr.id };
    } catch (err) {
      this.log.warn({ err }, 'GitHub PR detail refresh skipped (no token / offline); serving persisted detail');
      const [files, commits] = await Promise.all([
        this.repos.pulls.listFiles(pr.id),
        this.repos.pulls.listCommits(pr.id),
      ]);
      return {
        id: pr.id,
        number: pr.number,
        title: pr.title,
        author: pr.author,
        branch: pr.branch,
        base: pr.base,
        head_sha: pr.headSha,
        additions: pr.additions,
        deletions: pr.deletions,
        files_count: pr.filesCount,
        status: pr.status as PrDetail['status'],
        opened_at: pr.openedAt?.toISOString() ?? null,
        updated_at: pr.updatedAt?.toISOString() ?? null,
        body: pr.body ?? null,
        files,
        commits,
      };
    }
  }

  /** GET /pulls/:id/comments — proxied live to GitHub; [] when unavailable. */
  async listComments(workspaceId: string, id: string): Promise<PrReviewComment[]> {
    const { pr, repo } = await this.resolvePrAndRepo(id, workspaceId);
    let gh: GitHubClient;
    try {
      gh = await this.deps.github();
    } catch (err) {
      this.log.warn({ err }, 'GitHub client unavailable; serving no PR comments');
      return [];
    }
    try {
      return await gh.listReviewComments({ owner: repo.owner, name: repo.name }, pr.number);
    } catch (err) {
      this.log.warn({ err }, 'GitHub review-comments fetch skipped (offline / error)');
      return [];
    }
  }

  /** POST /pulls/:id/comments — create one inline comment pinned to the PR head sha. */
  async createComment(workspaceId: string, id: string, input: PrCommentInput): Promise<PrReviewComment> {
    const { pr, repo } = await this.resolvePrAndRepo(id, workspaceId);
    let gh: GitHubClient;
    try {
      gh = await this.deps.github();
    } catch {
      throw new AppError('github_unavailable', 'Connect a GitHub token to post comments.', 400);
    }
    try {
      return await gh.createReviewComment({ owner: repo.owner, name: repo.name }, pr.number, {
        commitId: pr.headSha,
        path: input.path,
        line: input.line,
        ...(input.side ? { side: input.side } : {}),
        body: input.body,
        ...(input.in_reply_to != null ? { inReplyTo: input.in_reply_to } : {}),
      });
    } catch (err) {
      // GitHub rejects comments on lines outside the diff / on closed PRs (422).
      const msg = err instanceof Error ? err.message : 'Failed to post the comment to GitHub.';
      throw new AppError('github_comment_failed', msg, 400, { cause: String(err) });
    }
  }

  private async resolvePrAndRepo(id: string, workspaceId: string) {
    const pr = await this.repos.pulls.getInWorkspace(workspaceId, id);
    if (!pr) throw new NotFoundError('Pull request not found');
    const repo = await this.repos.repos.getRef(pr.repoId);
    if (!repo) throw new NotFoundError('Repo not found');
    return { pr, repo };
  }
}
