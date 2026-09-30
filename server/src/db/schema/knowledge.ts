import { pgTable, uuid, text, jsonb, timestamp, doublePrecision, integer, vector, index } from 'drizzle-orm/pg-core';
import { now } from './_shared';
import { workspaces } from './core';
import { repos } from './repos';

// ============================================================ Knowledge / RAG

export const memory = pgTable(
  'memory',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    repoId: uuid('repo_id').references(() => repos.id, { onDelete: 'cascade' }),
    scope: text('scope', { enum: ['repo', 'global', 'team'] }).notNull(),
    kind: text('kind', {
      enum: ['decision', 'convention', 'preference', 'fact', 'learning'],
    }).notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }),
    confidence: doublePrecision('confidence'),
    sources: jsonb('sources'),
    createdAt: now(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => ({ wsIdx: index('memory_ws_idx').on(t.workspaceId) }),
);

/**
 * One Conventions Extractor run on a repo (HW02 D14/D17). Created `running`
 * and returned with 202; the work finishes in the background and sets `done`
 * or `failed` (+ `error`). Every extraction is a new row; the latest per repo
 * is what the UI shows.
 */
export const conventionScans = pgTable(
  'convention_scans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    repoId: uuid('repo_id')
      .notNull()
      .references(() => repos.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['running', 'done', 'failed'] })
      .notNull()
      .default('running'),
    /** Clone head at the start of the scan — evidence links point at it (K5). */
    headSha: text('head_sha').notNull(),
    sampleCount: integer('sample_count').notNull().default(0),
    /** Model candidates dropped by the evidence check (D16). */
    candidatesDropped: integer('candidates_dropped').notNull().default(0),
    provider: text('provider'),
    model: text('model'),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => ({
    wsIdx: index('convention_scans_ws_idx').on(t.workspaceId),
    repoStartedIdx: index('convention_scans_repo_started_idx').on(t.repoId, t.startedAt.desc()),
  }),
);

/**
 * A convention candidate found by a scan (HW02 D16). Evidence fields are
 * always present: a candidate whose quote was not found in the clone is
 * dropped before it is stored. `status` carries the user's decision (D17).
 */
export const conventions = pgTable(
  'conventions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    repoId: uuid('repo_id')
      .notNull()
      .references(() => repos.id, { onDelete: 'cascade' }),
    scanId: uuid('scan_id')
      .notNull()
      .references(() => conventionScans.id, { onDelete: 'cascade' }),
    category: text('category', {
      enum: ['naming', 'structure', 'async', 'error-handling', 'types', 'imports', 'testing', 'other'],
    }).notNull(),
    rule: text('rule').notNull(),
    evidencePath: text('evidence_path').notNull(),
    /** The line where the quote was found (±2 lines of the model's claim). */
    evidenceLine: integer('evidence_line').notNull(),
    /** Read from the file by code (±2 lines), never taken from the model. */
    evidenceSnippet: text('evidence_snippet').notNull(),
    confidence: doublePrecision('confidence').notNull(),
    status: text('status', { enum: ['pending', 'accepted', 'rejected'] })
      .notNull()
      .default('pending'),
    createdAt: now(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({ scanIdx: index('conventions_scan_idx').on(t.scanId) }),
);
