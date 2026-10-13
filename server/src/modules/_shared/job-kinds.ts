/**
 * JobRunner kinds shared across modules. `repos` enqueues the repo-intel jobs
 * after a clone or a sync, and `repo-intel` registers their handlers, so the
 * kind strings live here instead of in either module. The values are persisted
 * in the `jobs` table: never change them.
 */

/** Asynchronous `git clone` of an imported repo (handled by `repos`). */
export const CLONE_JOB_KIND = 'clone';
/** Full repo-intel index (handled by `repo-intel`). */
export const INDEX_JOB_KIND = 'repo-intel-index';
/** Incremental repo-intel refresh against the last indexed SHA. */
export const REFRESH_JOB_KIND = 'repo-intel-refresh';
/** Manual "re-analyze": fetch latest from origin + incremental reindex. */
export const RESYNC_JOB_KIND = 'repo-intel-resync';
