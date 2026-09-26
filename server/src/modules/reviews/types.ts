/**
 * Narrow types the reviews module works with instead of Drizzle rows (onion
 * skill R1). The repository maps rows into these; the service, the executor
 * and the diff loader never see `$inferSelect` shapes. Agents come in as the
 * `Agent` contract (`@devdigest/shared`), reviews and findings as the DTOs in
 * `./helpers.ts`.
 */

/** The PR fields a review run needs. */
export interface PullForReview {
  id: string;
  workspaceId: string;
  repoId: string;
  number: number;
  title: string;
  author: string;
  body: string | null;
  base: string;
  headSha: string;
}

/** A repo's id and GitHub coordinates (diff loading, session id). */
export interface ReviewRepoRef {
  id: string;
  owner: string;
  name: string;
}

/** One persisted `pr_files` patch — the diff loader's fallback source. */
export interface PrFilePatch {
  path: string;
  patch: string | null;
}
