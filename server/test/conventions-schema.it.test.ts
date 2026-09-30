/**
 * HW02 Stage 2a — the conventions data model (specs/HW02-conventions-and-api-contract.md
 * "Data model"): both migrations (0012 drop `accepted`, 0013 `convention_scans` +
 * the new `conventions` columns) apply on a fresh DB, `status` defaults hold,
 * the evidence columns are NOT NULL, and deleting a scan cascades to its
 * candidates. No module yet — this pins the schema the 2b module will build on.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

type Db = PgFixture['handle']['db'];

/** Journal entries after 0013_mute_namorita: 0000–0013. */
const MIGRATION_COUNT = 14;

d('conventions schema (Testcontainers pg)', () => {
  let pg: PgFixture;
  let db: Db;
  let workspaceId: string;
  let repoId: string;

  beforeAll(async () => {
    pg = await startPg();
    db = pg.handle.db;
    await seed(db);
    const [ws] = await db.select().from(t.workspaces);
    workspaceId = ws!.id;
    const [repo] = await db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name: 'conventions-schema', fullName: 'acme/conventions-schema' })
      .returning();
    repoId = repo!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  it('both Stage 2a migrations are applied', async () => {
    const rows = await db.execute<{ n: string }>(sql`select count(*)::text as n from drizzle.__drizzle_migrations`);
    expect(Number(rows[0]!.n)).toBe(MIGRATION_COUNT);
  });

  it('a scan defaults to running with zero counts; a candidate defaults to pending', async () => {
    const [scan] = await db.insert(t.conventionScans).values({ workspaceId, repoId, headSha: 'abc123' }).returning();
    expect(scan).toMatchObject({ status: 'running', sampleCount: 0, candidatesDropped: 0, provider: null, model: null, error: null, finishedAt: null });
    expect(scan!.startedAt).toBeInstanceOf(Date);

    const [candidate] = await db
      .insert(t.conventions)
      .values({
        workspaceId,
        repoId,
        scanId: scan!.id,
        category: 'naming',
        rule: 'Hooks are named useXxx',
        evidencePath: 'src/lib/hooks/agents.ts',
        evidenceLine: 12,
        evidenceSnippet: 'export function useAgents() {',
        confidence: 0.9,
      })
      .returning();
    expect(candidate).toMatchObject({ status: 'pending', scanId: scan!.id, evidenceLine: 12 });
    expect(candidate!.createdAt).toBeInstanceOf(Date);
    expect(candidate!.updatedAt).toBeInstanceOf(Date);
  });

  it('evidence columns are NOT NULL (D16: evidence is always present)', async () => {
    const [scan] = await db.insert(t.conventionScans).values({ workspaceId, repoId, headSha: 'def456' }).returning();
    await expect(
      db.insert(t.conventions).values({
        workspaceId,
        repoId,
        scanId: scan!.id,
        category: 'other',
        rule: 'no evidence',
        // evidence_path omitted on purpose
        evidenceLine: 1,
        evidenceSnippet: 'x',
        confidence: 0.5,
      } as typeof t.conventions.$inferInsert),
    ).rejects.toThrow(/null value in column "evidence_path"/);
  });

  it('deleting a scan cascades to its candidates', async () => {
    const [scan] = await db.insert(t.conventionScans).values({ workspaceId, repoId, headSha: '0123abc' }).returning();
    await db.insert(t.conventions).values({
      workspaceId,
      repoId,
      scanId: scan!.id,
      category: 'testing',
      rule: 'Tests use userEvent',
      evidencePath: 'client/src/test/setup.ts',
      evidenceLine: 3,
      evidenceSnippet: "import userEvent from '@testing-library/user-event';",
      confidence: 0.8,
    });
    expect(await db.select().from(t.conventions).where(eq(t.conventions.scanId, scan!.id))).toHaveLength(1);

    await db.delete(t.conventionScans).where(eq(t.conventionScans.id, scan!.id));
    expect(await db.select().from(t.conventions).where(eq(t.conventions.scanId, scan!.id))).toHaveLength(0);
  });
});
