import type { Container } from '../../platform/container.js';
import type { Agent, FindingActionKind, RunEventKind, RunTrace } from '@devdigest/shared';
import { AppError, NotFoundError } from '../../platform/errors.js';
import type { ReviewRepository } from './repository.js';
import type { ReviewDto, ReviewDtoFinding } from './helpers.js';
import { ReviewRunExecutor, type Logger, type ReviewRunDeps } from './run-executor.js';
import { actOnFinding as actOnFindingImpl } from './findings.js';
import { resolveRunCost } from '../_shared/run-cost.js';

// Re-export the DTO types for backward-compatible imports from './service.js'.
export type { ReviewDto, ReviewDtoFinding } from './helpers.js';

/**
 * Review service (the core). Orchestrates:
 *   diff → assemblePrompt(system + repo-map + diff)
 *        → llm.completeStructured({ schema: Review }) (single-pass)
 *        → groundFindings(...) (citation gate — drops findings off the diff)
 *        → persist reviews + kept findings (+ grounding summary)
 *   while streaming RunEvents over container.runBus, and on completion writing
 *   the whole log as ONE RunTrace doc + an agent_runs row.
 *
 * Also: the finding accept/dismiss actions. The bulky run execution lives in
 * run-executor; this class keeps the public method surface.
 */
/**
 * What `ReviewService` reads from the container (onion R5): its shared
 * repositories, `runBus` / `priceBook`, and what it hands to the executor.
 */
export type ReviewDeps = Pick<Container, 'reviewRepo' | 'agentsRepo' | 'runBus' | 'priceBook'> &
  ReviewRunDeps;

export class ReviewService {
  private repo: ReviewRepository;
  private agents: Container['agentsRepo'];
  private executor: ReviewRunExecutor;

  constructor(private deps: ReviewDeps) {
    // Shared instances from the composition root (onion skill R5).
    this.repo = deps.reviewRepo;
    this.agents = deps.agentsRepo;
    this.executor = new ReviewRunExecutor(deps, this.repo, this.agents);
  }

  // ===========================================================================
  // Run a review for one or all enabled agents on a PR.
  // ===========================================================================

  /**
   * Resolve which agents to run. `all` → all enabled agents; else a single agent.
   */
  async resolveTargets(
    workspaceId: string,
    opts: { agentId?: string; all?: boolean },
  ): Promise<Agent[]> {
    if (opts.all) return this.agents.listEnabledAgents(workspaceId);
    if (opts.agentId) {
      const agent = await this.agents.getAgent(workspaceId, opts.agentId);
      if (!agent) throw new NotFoundError('Agent not found');
      return [agent];
    }
    throw new AppError('invalid_run_request', 'Provide agentId or all:true', 400);
  }

  /** Delete a whole review run (one agent's pass) + its findings (cascade). */
  async deleteReview(workspaceId: string, reviewId: string): Promise<boolean> {
    return this.repo.deleteReview(workspaceId, reviewId);
  }

  /** In-flight runs for a PR (server-side source of truth, survives reload). */
  async activeRuns(workspaceId: string, prId: string) {
    return this.repo.activeRunsForPull(workspaceId, prId);
  }

  /** All runs for a PR (any status), newest first — the run history (incl. failures). */
  async listRuns(workspaceId: string, prId: string) {
    const runs = await this.repo.listRunsForPull(workspaceId, prId);
    // Legacy rows persisted before cost_usd existed: settled runs with real
    // usage get a tokens × PriceBook estimate; anything else stays null ("—").
    return runs.map((r) => ({
      ...r,
      cost_usd: resolveRunCost(
        {
          costUsd: r.cost_usd,
          status: r.status,
          model: r.model,
          tokensIn: r.tokens_in,
          tokensOut: r.tokens_out,
        },
        (model, tokensIn, tokensOut) => this.deps.priceBook.estimate(model, tokensIn, tokensOut),
      ),
    }));
  }

  /** Delete one run from the history (+ its trace). */
  async deleteRun(workspaceId: string, runId: string): Promise<boolean> {
    return this.repo.deleteAgentRun(workspaceId, runId);
  }

  /**
   * Cancel an in-flight run. Signals a live runner to stop at its next
   * checkpoint AND marks the DB row cancelled + completes the bus immediately —
   * so cancel also works for ORPHANED runs (whose background process died on a
   * server restart) where signalling alone would do nothing.
   */
  async cancelRun(runId: string): Promise<void> {
    this.publish(runId, 'info', 'Cancellation requested — stopping…');
    this.deps.runBus.cancel(runId);
    await this.repo.cancelRunIfRunning(runId);
    this.deps.runBus.complete(runId);
  }

  /** Reap runs left 'running' by a previous (now-dead) process. Called on boot. */
  async reapStaleRuns(): Promise<number> {
    return this.repo.reapStaleRunningRuns();
  }

  /**
   * Run a review for each target agent. Each agent gets its own runId
   * (= agent_runs.id) created up-front so the SSE route can be subscribed
   * before/while the run progresses. A partial failure in one agent does not
   * abort the others.
   */
  async runReview(
    workspaceId: string,
    prId: string,
    targets: Agent[],
    logger?: Logger,
  ): Promise<{ runs: { run_id: string; agent_id: string; agent_name: string }[]; reviews: ReviewDto[] }> {
    const pull = await this.repo.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError('Pull request not found');
    const repo = await this.repo.getRepo(pull.repoId);
    if (!repo) throw new NotFoundError('Repo not found');

    // Create the agent_run rows up front so a runId is available IMMEDIATELY —
    // the client persists these in global state and subscribes to the SSE
    // stream. The actual (slow) review runs in the background below.
    const runs: { run_id: string; agent_id: string; agent_name: string }[] = [];
    const jobs: { agent: Agent; runId: string }[] = [];
    // ONE batch id per "Run review" action — the PR list sums the latest
    // batch's cost, so every run queued here must share it.
    const batchId = crypto.randomUUID();
    for (const agent of targets) {
      const runId = await this.repo.createAgentRun({
        workspaceId,
        agentId: agent.id,
        prId,
        provider: agent.provider,
        model: agent.model,
        batchId,
      });
      runs.push({ run_id: runId, agent_id: agent.id, agent_name: agent.name });
      jobs.push({ agent, runId });
    }

    // Fire-and-forget: the HTTP response returns now with the runIds; reviews
    // are persisted as each agent finishes and the client refetches on SSE done.
    void this.executor.executeRuns(workspaceId, pull, repo, jobs, logger).catch((err) => {
      logger?.error({ prId, err: (err as Error).message }, 'review: background execution crashed');
    });

    return { runs, reviews: [] };
  }

  private publish(runId: string, kind: RunEventKind, msg: string, data?: unknown) {
    return this.deps.runBus.publish(runId, kind, msg, data);
  }

  // ===========================================================================
  // Finding actions
  // ===========================================================================

  async actOnFinding(
    workspaceId: string,
    findingId: string,
    action: FindingActionKind,
  ): Promise<{ finding: ReviewDtoFinding }> {
    return actOnFindingImpl(this.repo, workspaceId, findingId, action);
  }

  // ===========================================================================
  // Reads
  // ===========================================================================

  async reviewsForPull(workspaceId: string, prId: string): Promise<ReviewDto[]> {
    const pull = await this.repo.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError('Pull request not found');
    const reviews = await this.repo.reviewsForPull(prId);
    const names = new Map<string, string>();
    for (const review of reviews) {
      if (review.agent_id && !names.has(review.agent_id)) {
        const a = await this.agents.getAgent(workspaceId, review.agent_id);
        if (a) names.set(review.agent_id, a.name);
      }
    }
    return reviews.map((review) => ({
      ...review,
      agent_name: (review.agent_id ? names.get(review.agent_id) : null) ?? null,
    }));
  }

  async getRunTrace(runId: string): Promise<RunTrace | undefined> {
    const trace = await this.repo.getRunTrace(runId);
    if (!trace) return undefined;
    if (trace.stats.cost_usd != null) return trace;
    // Traces persisted before cost_usd existed: backfill on read from the
    // agent_runs row (stored cost, else tokens × PriceBook). Never re-persisted.
    const run = await this.repo.getCostableRun(runId);
    const cost = run
      ? resolveRunCost(run, (model, tokensIn, tokensOut) =>
          this.deps.priceBook.estimate(model, tokensIn, tokensOut),
        )
      : null;
    return { ...trace, stats: { ...trace.stats, cost_usd: cost } };
  }
}
