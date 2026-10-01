import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { ConventionCandidate, ConventionPatch, ConventionScan } from '@devdigest/shared';
import type { Db, DbOrTx } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { EarlierDecision, NewCandidateValues, ScanOutcome } from './types.js';

type ScanRow = typeof t.conventionScans.$inferSelect;
type CandidateRow = typeof t.conventions.$inferSelect;

function toScan(row: ScanRow): ConventionScan {
  return {
    id: row.id,
    repo_id: row.repoId,
    status: row.status,
    head_sha: row.headSha,
    sample_count: row.sampleCount,
    candidates_dropped: row.candidatesDropped,
    provider: row.provider,
    model: row.model,
    error: row.error,
    started_at: row.startedAt.toISOString(),
    finished_at: row.finishedAt ? row.finishedAt.toISOString() : null,
  };
}

function toCandidate(row: CandidateRow): ConventionCandidate {
  return {
    id: row.id,
    scan_id: row.scanId,
    category: row.category,
    rule: row.rule,
    evidence_path: row.evidencePath,
    evidence_line: row.evidenceLine,
    evidence_snippet: row.evidenceSnippet,
    confidence: row.confidence,
    status: row.status,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

/**
 * HW02 — conventions data access. Owns `convention_scans` and `conventions`.
 * Returns contract-shaped values, never Drizzle rows (onion R1). Writes that
 * belong to a use-case transaction take a `DbOrTx` (R4).
 */
export class ConventionsRepository {
  constructor(private db: Db) {}

  // ---- scans ---------------------------------------------------------------

  /** The repo's most recent scan (`convention_scans_repo_started_idx`), if any. */
  async latestScan(workspaceId: string, repoId: string): Promise<ConventionScan | undefined> {
    const [row] = await this.db
      .select()
      .from(t.conventionScans)
      .where(and(eq(t.conventionScans.workspaceId, workspaceId), eq(t.conventionScans.repoId, repoId)))
      .orderBy(desc(t.conventionScans.startedAt), desc(t.conventionScans.id))
      .limit(1);
    return row ? toScan(row) : undefined;
  }

  /**
   * D14: create a `running` scan unless one is already running for the repo.
   * The check and the insert run in one transaction under a per-repo advisory
   * lock, so two concurrent extracts cannot both insert. Returns the new scan,
   * or the running one wrapped in `{ running }` so the caller can answer 409.
   */
  async createScanExclusive(
    workspaceId: string,
    repoId: string,
    headSha: string,
  ): Promise<{ created: ConventionScan } | { running: ConventionScan }> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${repoId}))`);
      const [running] = await tx
        .select()
        .from(t.conventionScans)
        .where(and(eq(t.conventionScans.repoId, repoId), eq(t.conventionScans.status, 'running')))
        .limit(1);
      if (running) return { running: toScan(running) };
      const [row] = await tx
        .insert(t.conventionScans)
        .values({ workspaceId, repoId, headSha })
        .returning();
      return { created: toScan(row!) };
    });
  }

  /** Close a scan (`done` / `failed`) with its counts, model and error; sets `finished_at`. */
  async finishScan(exec: DbOrTx, scanId: string, outcome: ScanOutcome): Promise<void> {
    await exec
      .update(t.conventionScans)
      .set({
        status: outcome.status,
        sampleCount: outcome.sampleCount,
        candidatesDropped: outcome.candidatesDropped,
        provider: outcome.provider,
        model: outcome.model,
        error: outcome.error,
        finishedAt: new Date(),
      })
      .where(eq(t.conventionScans.id, scanId));
  }

  /**
   * On boot: a scan still `running` belongs to a process that died, so mark it
   * `failed` (the review-run reaper pattern). Returns how many were reaped.
   */
  async reapStaleRunningScans(): Promise<number> {
    const rows = await this.db
      .update(t.conventionScans)
      .set({
        status: 'failed',
        error: 'server restarted while the scan was running',
        finishedAt: new Date(),
      })
      .where(eq(t.conventionScans.status, 'running'))
      .returning({ id: t.conventionScans.id });
    return rows.length;
  }

  // ---- candidates ----------------------------------------------------------

  async insertCandidates(
    exec: DbOrTx,
    workspaceId: string,
    repoId: string,
    scanId: string,
    rows: NewCandidateValues[],
  ): Promise<void> {
    if (rows.length === 0) return;
    await exec.insert(t.conventions).values(
      rows.map((r) => ({
        workspaceId,
        repoId,
        scanId,
        category: r.category,
        rule: r.rule,
        evidencePath: r.evidencePath,
        evidenceLine: r.evidenceLine,
        evidenceSnippet: r.evidenceSnippet,
        confidence: r.confidence,
        status: r.status,
      })),
    );
  }

  /** A scan's candidates in insertion order, optionally only those with `status`. */
  async listCandidates(
    workspaceId: string,
    scanId: string,
    opts: { status?: ConventionCandidate['status']; excludeRejected?: boolean } = {},
  ): Promise<ConventionCandidate[]> {
    const where = [eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.scanId, scanId)];
    if (opts.status) where.push(eq(t.conventions.status, opts.status));
    if (opts.excludeRejected) where.push(sql`${t.conventions.status} <> 'rejected'`);
    const rows = await this.db
      .select()
      .from(t.conventions)
      .where(and(...where))
      .orderBy(asc(t.conventions.createdAt), asc(t.conventions.id));
    return rows.map(toCandidate);
  }

  /** The candidates among `ids` that belong to the workspace and repo (any status). */
  async candidatesByIds(workspaceId: string, repoId: string, ids: string[]): Promise<ConventionCandidate[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(t.conventions)
      .where(
        and(
          eq(t.conventions.workspaceId, workspaceId),
          eq(t.conventions.repoId, repoId),
          inArray(t.conventions.id, ids),
        ),
      );
    return rows.map(toCandidate);
  }

  /** `PATCH /conventions/:id`: status / rule / category in place; `undefined` when absent. */
  async updateCandidate(
    workspaceId: string,
    id: string,
    patch: ConventionPatch,
  ): Promise<ConventionCandidate | undefined> {
    const [row] = await this.db
      .update(t.conventions)
      .set({
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.rule !== undefined ? { rule: patch.rule } : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
      })
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.id, id)))
      .returning();
    return row ? toCandidate(row) : undefined;
  }

  /**
   * D17: the repo's earlier accepted / rejected candidates with their rule,
   * category and evidence location, oldest decision first — the service lets
   * the latest matching one win (`carryDecision`) and lists them to the model.
   */
  async earlierDecisions(repoId: string): Promise<EarlierDecision[]> {
    const rows = await this.db
      .select({
        rule: t.conventions.rule,
        category: t.conventions.category,
        evidencePath: t.conventions.evidencePath,
        evidenceLine: t.conventions.evidenceLine,
        status: t.conventions.status,
      })
      .from(t.conventions)
      .where(and(eq(t.conventions.repoId, repoId), inArray(t.conventions.status, ['accepted', 'rejected'])))
      .orderBy(asc(t.conventions.updatedAt), asc(t.conventions.id));
    return rows.flatMap((r) =>
      r.status === 'accepted' || r.status === 'rejected'
        ? [{ rule: r.rule, category: r.category, evidencePath: r.evidencePath, evidenceLine: r.evidenceLine, status: r.status }]
        : [],
    );
  }
}
