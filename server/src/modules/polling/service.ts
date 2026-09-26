import type { PollResult } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { NotFoundError } from '../../platform/errors.js';

export type PollingServiceDeps = Pick<Container, 'db' | 'github'>;

export interface PollingServiceRepos {
  /** Owner of `pull_requests` (pulls module). */
  pulls: Container['pullsRepo'];
  /** Owner of `repos` (repos module). */
  repos: Container['reposRepo'];
}

/**
 * polling use case — a MANUAL refresh that only syncs the PR list (new or
 * updated PRs appear, head_sha updates) and stamps `last_polled_at`. It never
 * triggers a review. Unlike the PR-list read, GitHub errors are NOT swallowed:
 * no token → ConfigError (500), API failure → 500.
 *
 * The module owns no table: writes go through the owners' repositories, all in
 * ONE transaction after the GitHub fetch, so a failed write leaves nothing
 * half-applied (onion skill R4).
 */
export class PollingService {
  constructor(
    private deps: PollingServiceDeps,
    private repos: PollingServiceRepos,
  ) {}

  async poll(workspaceId: string, repoId: string): Promise<PollResult> {
    const repo = await this.repos.repos.getRef(repoId, workspaceId);
    if (!repo) throw new NotFoundError('Repo not found');

    const gh = await this.deps.github();
    const pulls = await gh.listPullRequests({ owner: repo.owner, name: repo.name });

    await this.deps.db.transaction(async (tx) => {
      for (const pr of pulls) {
        await this.repos.pulls.upsertFromGitHub(tx, workspaceId, repo.id, pr);
      }
      await this.repos.repos.markPolled(tx, repo.id);
    });

    // NOTE: no review is triggered here — manual trigger only.
    return { synced: pulls.length, reviewTriggered: false };
  }
}
