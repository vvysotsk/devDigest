import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../../db/client.js';
import * as t from '../../../db/schema.js';
import type { Finding } from '@devdigest/shared';
import type { ReviewDto, ReviewDtoFinding } from '../helpers.js';

// Rows stay in this file (onion skill R1): reads return the review DTOs.
type ReviewRow = typeof t.reviews.$inferSelect;
type FindingRow = typeof t.findings.$inferSelect;

/** Row → finding DTO (snake_case wire names; timestamps as ISO strings). */
function toFindingDto(row: FindingRow): ReviewDtoFinding {
  return {
    id: row.id,
    severity: row.severity as Finding['severity'],
    category: row.category as Finding['category'],
    title: row.title,
    file: row.file,
    start_line: row.startLine,
    end_line: row.endLine,
    rationale: row.rationale,
    suggestion: row.suggestion ?? null,
    confidence: row.confidence,
    kind: (row.kind as Finding['kind']) ?? 'finding',
    trifecta_components: (row.trifectaComponents as Finding['trifecta_components']) ?? null,
    evidence: null,
    review_id: row.reviewId,
    accepted_at: row.acceptedAt?.toISOString() ?? null,
    dismissed_at: row.dismissedAt?.toISOString() ?? null,
  };
}

/** Row → review DTO. `agent_name` is filled by the service (agents module). */
function toReviewDto(review: ReviewRow, findings: FindingRow[]): ReviewDto {
  return {
    id: review.id,
    pr_id: review.prId,
    agent_id: review.agentId,
    run_id: review.runId,
    agent_name: null,
    kind: review.kind as 'summary' | 'review',
    verdict: review.verdict,
    summary: review.summary,
    score: review.score,
    model: review.model,
    created_at: review.createdAt.toISOString(),
    findings: findings.map(toFindingDto),
  };
}

// ---- reviews + findings ---------------------------------------------------

export async function insertReview(
  db: Db,
  values: {
    workspaceId: string;
    prId: string;
    agentId: string | null;
    runId: string | null;
    kind: 'summary' | 'review';
    verdict: string | null;
    summary: string | null;
    score: number | null;
    model: string | null;
  },
): Promise<{ id: string }> {
  const [row] = await db.insert(t.reviews).values(values).returning({ id: t.reviews.id });
  return row!;
}

/** Insert the kept findings of a review; returns how many were stored. */
export async function insertFindings(db: Db, reviewId: string, findings: Finding[]): Promise<number> {
  if (findings.length === 0) return 0;
  const rows = await db
    .insert(t.findings)
    .values(
      findings.map((f) => ({
        reviewId,
        file: f.file,
        startLine: f.start_line,
        endLine: f.end_line,
        severity: f.severity,
        category: f.category,
        title: f.title,
        rationale: f.rationale,
        suggestion: f.suggestion ?? null,
        confidence: f.confidence,
        kind: f.kind ?? 'finding',
        trifectaComponents: f.trifecta_components ?? null,
      })),
    )
    .returning({ id: t.findings.id });
  return rows.length;
}

/** Reviews for a PR (newest first), each with its findings, as DTOs. */
export async function reviewsForPull(db: Db, prId: string): Promise<ReviewDto[]> {
  const reviews = await db
    .select()
    .from(t.reviews)
    .where(eq(t.reviews.prId, prId))
    .orderBy(desc(t.reviews.createdAt));
  if (reviews.length === 0) return [];
  const ids = reviews.map((r) => r.id);
  const findings = await db.select().from(t.findings).where(inArray(t.findings.reviewId, ids));
  return reviews.map((review) =>
    toReviewDto(
      review,
      findings.filter((f) => f.reviewId === review.id),
    ),
  );
}

/** Delete a whole review (one agent's run) + its findings (cascade), scoped
 *  to the workspace. Returns false if not found in the workspace. */
export async function deleteReview(
  db: Db,
  workspaceId: string,
  reviewId: string,
): Promise<boolean> {
  const rows = await db
    .delete(t.reviews)
    .where(and(eq(t.reviews.workspaceId, workspaceId), eq(t.reviews.id, reviewId)))
    .returning({ id: t.reviews.id });
  return rows.length > 0;
}

// ---- finding actions ------------------------------------------------------

/**
 * The workspace a finding belongs to (via review → pr), for the tenancy check
 * of the finding actions. Undefined when the finding, its review or its PR is
 * gone.
 */
export async function findingWorkspace(db: Db, findingId: string): Promise<{ workspaceId: string } | undefined> {
  const [finding] = await db
    .select({ reviewId: t.findings.reviewId })
    .from(t.findings)
    .where(eq(t.findings.id, findingId));
  if (!finding) return undefined;
  const [review] = await db
    .select({ prId: t.reviews.prId })
    .from(t.reviews)
    .where(eq(t.reviews.id, finding.reviewId));
  if (!review) return undefined;
  const [pull] = await db
    .select({ workspaceId: t.pullRequests.workspaceId })
    .from(t.pullRequests)
    .where(eq(t.pullRequests.id, review.prId));
  return pull;
}

export async function setFindingAccepted(
  db: Db,
  findingId: string,
  at: Date | null,
): Promise<ReviewDtoFinding | undefined> {
  const [row] = await db
    .update(t.findings)
    .set({ acceptedAt: at, dismissedAt: null })
    .where(eq(t.findings.id, findingId))
    .returning();
  return row ? toFindingDto(row) : undefined;
}

export async function setFindingDismissed(
  db: Db,
  findingId: string,
  at: Date | null,
): Promise<ReviewDtoFinding | undefined> {
  const [row] = await db
    .update(t.findings)
    .set({ dismissedAt: at, acceptedAt: null })
    .where(eq(t.findings.id, findingId))
    .returning();
  return row ? toFindingDto(row) : undefined;
}

// ---- PR-list aggregates (read by the pulls module via container.reviewRepo) --

/**
 * Score of every `review`-kind review of the given PRs, NEWEST FIRST — the
 * first entry seen per PR is its latest review score. Summaries are excluded.
 */
export async function reviewScoresNewestFirst(
  db: Db,
  prIds: readonly string[],
): Promise<{ prId: string; score: number | null }[]> {
  if (prIds.length === 0) return [];
  return db
    .select({ prId: t.reviews.prId, score: t.reviews.score })
    .from(t.reviews)
    .where(and(inArray(t.reviews.prId, [...prIds]), eq(t.reviews.kind, 'review')))
    .orderBy(desc(t.reviews.createdAt));
}

/**
 * One `{ prId, severity }` per finding of the `review`-kind reviews produced
 * by the given runs (the PR list's latest-batch findings). The counting rule
 * itself lives in `modules/_shared/latest-batch.ts` (`countFindingsBySeverity`).
 */
export async function findingSeveritiesForRuns(
  db: Db,
  runIds: readonly string[],
): Promise<{ prId: string; severity: string }[]> {
  if (runIds.length === 0) return [];
  const batchReviews = await db
    .select({ id: t.reviews.id, prId: t.reviews.prId })
    .from(t.reviews)
    .where(and(inArray(t.reviews.runId, [...runIds]), eq(t.reviews.kind, 'review')));
  if (batchReviews.length === 0) return [];
  const prByReview = new Map(batchReviews.map((rv) => [rv.id, rv.prId]));
  const rows = await db
    .select({ reviewId: t.findings.reviewId, severity: t.findings.severity })
    .from(t.findings)
    .where(inArray(t.findings.reviewId, [...prByReview.keys()]));
  return rows.map((f) => ({ prId: prByReview.get(f.reviewId)!, severity: f.severity }));
}
