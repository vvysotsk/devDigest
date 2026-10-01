import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  Agent,
  AgentSkill,
  ConventionCandidate,
  ConventionScan,
  ConventionSkillDraft,
  ConventionsState,
  Skill,
} from '@devdigest/shared';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import {
  MockGitClient,
  MockGitHubClient,
  MockLLMProvider,
  MockSecretsProvider,
} from '../src/adapters/mocks.js';
import type { RepoIntel } from '../src/modules/repo-intel/types.js';
import type { ConventionExtraction } from '../src/modules/conventions/types.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[conventions] Docker not available — skipping integration tests.');
}

type Db = PgFixture['handle']['db'];

/** The mock clone. Root config + two ranked samples + a real file that is NOT sampled. */
const AGENTS_TS = [
  "import { useQuery } from '@tanstack/react-query';",
  '',
  'export function useAgents() {',
  "  return useQuery({ queryKey: ['agents'] });",
  '}',
  '',
  'export function useAgent(id: string) {',
  "  return useQuery({ queryKey: ['agents', id] });",
  '}',
].join('\n');
const SERVICE_TS = [
  "import { NotFoundError } from '../../platform/errors.js';",
  'export class RepoService {',
  '  async get(id: string) {',
  "    if (!id) throw new NotFoundError('Repo not found');",
  '  }',
  '}',
].join('\n');
const FILES: Record<string, string> = {
  'tsconfig.json': '{\n  "compilerOptions": {\n    "strict": true\n  }\n}\n',
  'package.json': '{ "name": "payments-api" }\n',
  'src/lib/hooks/agents.ts': AGENTS_TS + '\n',
  'src/modules/repos/service.ts': SERVICE_TS + '\n',
  'src/unsampled.ts': 'export const secret = 1;\n',
};
const SAMPLE_PATHS = ['src/lib/hooks/agents.ts', 'src/modules/repos/service.ts'];
const HEAD = 'f00dcafe1234';
const MODEL = 'mock-conventions-model';

const RULE_A = 'Hooks are named useXxx';
const RULE_B = 'Services throw NotFoundError for a missing row';

/** Five candidates: two verifiable, three that the D16 check must drop. */
const FIXTURE: ConventionExtraction = {
  candidates: [
    // kept — the quote is 2 lines below the claim (line 1 → found on 3)
    { category: 'naming', rule: RULE_A, evidence: { file: 'src/lib/hooks/agents.ts', line: 1, quote: 'export function useAgents()' }, confidence: 0.9 },
    // kept — `./` prefix is normalised away
    { category: 'error-handling', rule: RULE_B, evidence: { file: './src/modules/repos/service.ts', line: 4, quote: "throw new NotFoundError('Repo not found')" }, confidence: 0.8 },
    // dropped — the quote is not in the file
    { category: 'types', rule: 'Strict mode is on', evidence: { file: 'tsconfig.json', line: 3, quote: '"strict": false' }, confidence: 0.7 },
    // dropped — traversal outside the clone (never read)
    { category: 'other', rule: 'Secrets live in a json file', evidence: { file: '../outside.txt', line: 1, quote: 'x' }, confidence: 0.5 },
    // dropped — a real repo file that was not sampled (never read)
    { category: 'other', rule: 'Secrets are constants', evidence: { file: 'src/unsampled.ts', line: 1, quote: 'export const secret = 1;' }, confidence: 0.5 },
  ],
};

/**
 * The same conventions as FIXTURE, reworded the way the live model does on a
 * re-scan, at the same evidence (A claims line 5 → found at 3 by the ±2 search;
 * stored line 3 → distance 0; B at the same line 4). The dropped three stay.
 */
const RULE_A2 = 'Custom hooks start with the use prefix';
const RULE_B2 = 'Repositories throw NotFoundError when a row is missing';
const FIXTURE_REPHRASED: ConventionExtraction = {
  candidates: [
    { category: 'naming', rule: RULE_A2, evidence: { file: 'src/lib/hooks/agents.ts', line: 5, quote: 'export function useAgents()' }, confidence: 0.85 },
    { category: 'error-handling', rule: RULE_B2, evidence: { file: 'src/modules/repos/service.ts', line: 4, quote: "throw new NotFoundError('Repo not found')" }, confidence: 0.8 },
    ...FIXTURE.candidates.slice(2),
  ],
};

async function waitForScan(db: Db, scanId: string, timeoutMs = 10_000) {
  const start = Date.now();
  for (;;) {
    const [row] = await db.select().from(t.conventionScans).where(eq(t.conventionScans.id, scanId));
    if (row && row.status !== 'running') return row;
    if (Date.now() - start > timeoutMs) return row;
    await new Promise((r) => setTimeout(r, 25));
  }
}

/**
 * HW02 2b — the conventions extractor end to end (D14–D18, #38–40, #42, #48,
 * #53) with the fake git clone, a fake repo-intel facade and the fake LLM
 * injected through `ContainerOverrides` (never through server config).
 * R3 shape tests on every response.
 */
d('conventions extractor (Testcontainers pg)', () => {
  let pg: PgFixture;
  let db: Db;
  let ws: string;
  let notIndexedRepo = '';
  let seq = 0;

  beforeAll(async () => {
    pg = await startPg();
    db = pg.handle.db;
    await seed(db);
    const [row] = await db.select({ id: t.workspaces.id }).from(t.workspaces).where(eq(t.workspaces.name, 'default'));
    ws = row!.id;
    // #53: the extractor runs on the workspace's chosen model, not a constant.
    const app = await makeAppWithMocks();
    const res = await app.inject({
      method: 'PUT',
      url: '/settings',
      payload: { feature_models: { conventions: { provider: 'openai', model: MODEL } } },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
  afterAll(async () => {
    await pg?.stop();
  });

  type App = Awaited<ReturnType<typeof buildApp>> & { git: MockGitClient; llm: MockLLMProvider };

  async function makeAppWithMocks(fixture?: unknown): Promise<App> {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const git = new MockGitClient({ files: FILES, head: HEAD });
    const llm = new MockLLMProvider('openai', { structuredBySchema: { ConventionExtraction: fixture ?? FIXTURE } });
    const repoIntel = {
      getConventionSamples: async (repoId: string) => (repoId === notIndexedRepo ? [] : SAMPLE_PATHS),
    } as unknown as RepoIntel;
    const app = await buildApp({
      config,
      db,
      overrides: { git, github: new MockGitHubClient(), secrets: new MockSecretsProvider({}), llm: { openai: llm }, repoIntel },
    });
    return Object.assign(app, { git, llm });
  }

  async function createRepo(opts: { cloned?: boolean } = {}): Promise<string> {
    const name = `conventions-${++seq}`;
    const [row] = await db
      .insert(t.repos)
      .values({
        workspaceId: ws,
        owner: 'acme',
        name,
        fullName: `acme/${name}`,
        clonePath: opts.cloned === false ? null : `/mock/clones/acme/${name}`,
      })
      .returning({ id: t.repos.id });
    return row!.id;
  }

  async function createAgent(app: App): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/agents',
      payload: { name: `Conventions agent ${++seq}`, provider: 'openai', model: 'gpt-4o-mini', system_prompt: 'Review.' },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  async function extract(app: App, repoId: string) {
    const res = await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract` });
    return res;
  }

  async function extractAndWait(app: App, repoId: string): Promise<ConventionScan> {
    const res = await extract(app, repoId);
    expect(res.statusCode).toBe(202);
    const scan = ConventionScan.strict().parse(res.json());
    expect(scan.status).toBe('running');
    await waitForScan(db, scan.id);
    return scan;
  }

  async function state(app: App, repoId: string): Promise<ConventionsState> {
    const res = await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` });
    expect(res.statusCode).toBe(200);
    return ConventionsState.strict().parse(res.json());
  }

  async function patch(app: App, id: string, body: unknown) {
    return app.inject({ method: 'PATCH', url: `/conventions/${id}`, payload: body });
  }

  it('#39/D15: no clone → 409 repo_not_cloned; never indexed → 409 repo_not_indexed; the LLM is never called', async () => {
    const app = await makeAppWithMocks();
    const noClone = await createRepo({ cloned: false });
    const res1 = await extract(app, noClone);
    expect(res1.statusCode).toBe(409);
    expect(res1.json().error.code).toBe('repo_not_cloned');

    notIndexedRepo = await createRepo();
    const res2 = await extract(app, notIndexedRepo);
    expect(res2.statusCode).toBe(409);
    expect(res2.json().error.code).toBe('repo_not_indexed');

    expect(app.llm.calls).toHaveLength(0);
    expect(await db.select().from(t.conventionScans).where(eq(t.conventionScans.repoId, noClone))).toHaveLength(0);
    const unknown = await app.inject({ method: 'POST', url: `/repos/${crypto.randomUUID()}/conventions/extract` });
    expect(unknown.statusCode).toBe(404);
    await app.close();
  });

  it('#38/#40/#53: extract → 202 running; the scan finishes with the head sha, the sample count, the chosen model and verified candidates', async () => {
    const app = await makeAppWithMocks();
    const repoId = await createRepo();

    const before = await state(app, repoId);
    expect(before).toEqual({ scan: null, candidates: [] });

    const running = await extractAndWait(app, repoId);
    expect(running).toMatchObject({ repo_id: repoId, head_sha: HEAD, sample_count: 0, provider: null, model: null, finished_at: null });

    const after = await state(app, repoId);
    const scan = after.scan!;
    expect(scan).toMatchObject({
      id: running.id,
      status: 'done',
      head_sha: HEAD,
      sample_count: 3, // tsconfig.json + the two ranked samples; package.json is not a config file
      candidates_dropped: 3,
      provider: 'openai',
      model: MODEL,
      error: null,
    });
    expect(scan.finished_at).not.toBeNull();

    // The sampling happened before the one LLM call, and the model saw numbered, untrusted-wrapped files.
    expect(app.llm.calls).toHaveLength(1);
    const req = app.llm.calls[0]!.req as { schemaName: string; model: string; messages: { role: string; content: string }[] };
    expect(req.schemaName).toBe('ConventionExtraction');
    expect(req.model).toBe(MODEL);
    const user = req.messages.find((m) => m.role === 'user')!.content;
    expect(user).toContain('<untrusted source="file:src/lib/hooks/agents.ts">\n1 | import { useQuery }');
    expect(user).toContain('<untrusted source="file:tsconfig.json">');
    expect(user).not.toContain('package.json');
    expect(user).not.toContain('export const secret');

    // D16: verified evidence only, with the found line and a code-read snippet.
    expect(after.candidates).toHaveLength(2);
    for (const c of after.candidates) ConventionCandidate.strict().parse(c);
    const a = after.candidates.find((c) => c.rule === RULE_A)!;
    expect(a).toMatchObject({
      scan_id: scan.id,
      category: 'naming',
      evidence_path: 'src/lib/hooks/agents.ts',
      evidence_line: 3,
      evidence_snippet: AGENTS_TS.split('\n').slice(0, 5).join('\n'),
      confidence: 0.9,
      status: 'pending',
    });
    const b = after.candidates.find((c) => c.rule === RULE_B)!;
    expect(b).toMatchObject({ evidence_path: 'src/modules/repos/service.ts', evidence_line: 4, status: 'pending' });
    expect(b.evidence_snippet).toBe(SERVICE_TS.split('\n').slice(1, 6).join('\n'));

    // Security: the refused paths were never read from the clone.
    expect(app.git.reads).not.toContain('../outside.txt');
    expect(app.git.reads).not.toContain('src/unsampled.ts');
    expect(app.git.reads.sort()).toEqual(['src/lib/hooks/agents.ts', 'src/modules/repos/service.ts', 'tsconfig.json']);
    await app.close();
  });

  it('D14: 409 scan_running while a scan runs; the scan survives a restart; a stale running scan is reaped on boot', async () => {
    const app = await makeAppWithMocks();
    const repoId = await createRepo();
    const [running] = await db.insert(t.conventionScans).values({ workspaceId: ws, repoId, headSha: HEAD }).returning();

    const res = await extract(app, repoId);
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatchObject({ code: 'scan_running', details: { scan_id: running!.id } });
    expect(app.llm.calls).toHaveLength(0);
    await app.close();

    // #38 persistence + the boot reaper: a new process sees the row and closes it as failed.
    const app2 = await makeAppWithMocks();
    const after = await state(app2, repoId);
    expect(after.scan).toMatchObject({
      id: running!.id,
      status: 'failed',
      error: 'server restarted while the scan was running',
    });
    expect(after.scan!.finished_at).not.toBeNull();

    // And a fresh extract now goes through.
    const scan = await extractAndWait(app2, repoId);
    const done = await state(app2, repoId);
    expect(done.scan!.id).toBe(scan.id);
    expect(done.scan!.status).toBe('done');
    await app2.close();
  });

  it('#48/D17: PATCH reject hides a candidate and the decision survives a re-scan; edit changes rule and category in place', async () => {
    const app = await makeAppWithMocks();
    const repoId = await createRepo();
    await extractAndWait(app, repoId);
    const first = await state(app, repoId);
    const a = first.candidates.find((c) => c.rule === RULE_A)!;
    const b = first.candidates.find((c) => c.rule === RULE_B)!;

    const rejected = await patch(app, a.id, { status: 'rejected' });
    expect(rejected.statusCode).toBe(200);
    expect(ConventionCandidate.strict().parse(rejected.json()).status).toBe('rejected');
    const accepted = await patch(app, b.id, { status: 'accepted' });
    expect(accepted.statusCode).toBe(200);

    const edited = await patch(app, b.id, { rule: 'Services throw NotFoundError for a missing row.', category: 'structure' });
    expect(edited.statusCode).toBe(200);
    expect(ConventionCandidate.strict().parse(edited.json())).toMatchObject({
      id: b.id,
      rule: 'Services throw NotFoundError for a missing row.',
      category: 'structure',
      status: 'accepted',
    });

    const afterPatch = await state(app, repoId);
    expect(afterPatch.candidates.map((c) => c.id)).toEqual([b.id]);

    expect((await patch(app, crypto.randomUUID(), { status: 'accepted' })).statusCode).toBe(404);
    expect((await patch(app, b.id, {})).statusCode).toBe(422);

    // Re-scan with the same model answer: the rejection comes back as rejected
    // (absent from GET), the accepted rule (edited only by a trailing period) stays accepted.
    const second = await extractAndWait(app, repoId);
    const rescanned = await state(app, repoId);
    expect(rescanned.scan!.id).toBe(second.id);
    expect(rescanned.candidates.map((c) => [c.rule, c.status])).toEqual([[RULE_B, 'accepted']]);
    const stored = await db
      .select({ rule: t.conventions.rule, status: t.conventions.status })
      .from(t.conventions)
      .where(and(eq(t.conventions.scanId, second.id), eq(t.conventions.status, 'rejected')));
    expect(stored).toEqual([{ rule: RULE_A, status: 'rejected' }]);
    await app.close();
  });

  it('#48/D17 live-model shape: a re-scan with rephrased rules keeps the decisions by evidence location and lists them to the model', async () => {
    const app = await makeAppWithMocks();
    const repoId = await createRepo();
    await extractAndWait(app, repoId);
    const first = await state(app, repoId);
    const a = first.candidates.find((c) => c.rule === RULE_A)!;
    const b = first.candidates.find((c) => c.rule === RULE_B)!;
    expect((await patch(app, a.id, { status: 'accepted' })).statusCode).toBe(200);
    expect((await patch(app, b.id, { status: 'rejected' })).statusCode).toBe(200);
    await app.close();

    // Scan 2 answers with different wording at the same evidence.
    const app2 = await makeAppWithMocks(FIXTURE_REPHRASED);
    const second = await extractAndWait(app2, repoId);
    const rescanned = await state(app2, repoId);
    expect(rescanned.scan).toMatchObject({ id: second.id, status: 'done', candidates_dropped: 3 });
    expect(rescanned.candidates.map((c) => [c.rule, c.status, c.evidence_line])).toEqual([[RULE_A2, 'accepted', 3]]);
    const storedB = await db
      .select({ rule: t.conventions.rule, status: t.conventions.status })
      .from(t.conventions)
      .where(and(eq(t.conventions.scanId, second.id), eq(t.conventions.status, 'rejected')));
    expect(storedB).toEqual([{ rule: RULE_B2, status: 'rejected' }]);

    // The model was told about both decisions, as data, before the first file block.
    expect(app2.llm.calls).toHaveLength(1);
    const req = app2.llm.calls[0]!.req as { messages: { role: string; content: string }[] };
    const user = req.messages.find((m) => m.role === 'user')!.content;
    const block = user.indexOf('<prior-decisions>');
    expect(block).toBeGreaterThan(-1);
    expect(block).toBeLessThan(user.indexOf('<untrusted source='));
    expect(user).toContain(`accepted (reuse this exact wording if the convention still holds):
- ${RULE_A}`);
    expect(user).toContain(`rejected (never propose again, in any wording):
- ${RULE_B}`);
    expect(req.messages.find((m) => m.role === 'system')!.content).toContain('The <prior-decisions> block lists');
    await app2.close();
  });

  it('#42/D18: skill-draft from the accepted candidates; save creates repo-conventions (201), versions it (200) and links it once', async () => {
    const app = await makeAppWithMocks();
    const repoId = await createRepo();
    const agentId = await createAgent(app);
    await extractAndWait(app, repoId);
    const { candidates } = await state(app, repoId);
    const a = candidates.find((c) => c.rule === RULE_A)!;
    const b = candidates.find((c) => c.rule === RULE_B)!;
    await patch(app, a.id, { status: 'accepted' });

    // Draft: accepted only (A), `existing: null` before the first save.
    const draftRes = await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions/skill-draft` });
    expect(draftRes.statusCode).toBe(200);
    const draft = ConventionSkillDraft.strict().parse(draftRes.json());
    expect(draft).toMatchObject({ name: 'repo-conventions', type: 'convention', existing: null });
    expect(draft.description).toContain(`acme/conventions-`);
    expect(draft.body).toContain(`## ${RULE_A}`);
    expect(draft.body).toContain('`src/lib/hooks/agents.ts:3`');
    expect(draft.body).not.toContain(RULE_B);

    // 400: a pending candidate cannot go into the skill.
    const save = (body: Record<string, unknown>) =>
      app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/skill`, payload: body });
    const base = { name: draft.name, description: draft.description, type: draft.type, enabled: false, body: draft.body, agent_id: agentId };
    const refused = await save({ ...base, candidate_ids: [a.id, b.id] });
    expect(refused.statusCode).toBe(400);
    expect(refused.json().error).toMatchObject({ code: 'candidate_not_accepted', details: { candidate_ids: [b.id] } });
    expect((await save({ ...base, candidate_ids: [a.id], agent_id: crypto.randomUUID() })).statusCode).toBe(404);

    // 201: created as `extracted`, with evidence_files, linked to the agent with the body's `enabled`.
    const agentBefore = Agent.strict().parse((await app.inject({ method: 'GET', url: `/agents/${agentId}` })).json());
    const created = await save({ ...base, candidate_ids: [a.id] });
    expect(created.statusCode).toBe(201);
    const skill = Skill.strict().parse(created.json());
    expect(skill).toMatchObject({
      name: 'repo-conventions',
      source: 'extracted',
      type: 'convention',
      enabled: false,
      version: 1,
      evidence_files: ['src/lib/hooks/agents.ts'],
      agent_count: 1,
    });
    const links = AgentSkill.strict().array().parse((await app.inject({ method: 'GET', url: `/agents/${agentId}/skills` })).json());
    expect(links.map((l) => [l.skill_id, l.enabled])).toEqual([[skill.id, false]]);
    const agentLinked = Agent.strict().parse((await app.inject({ method: 'GET', url: `/agents/${agentId}` })).json());
    expect(agentLinked.version).toBe(agentBefore.version + 1);

    // The draft now points at the existing extracted skill.
    const draft2 = ConventionSkillDraft.strict().parse(
      (await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions/skill-draft` })).json(),
    );
    expect(draft2.existing).toEqual({ id: skill.id, version: 1 });

    // 200: an identical re-save keeps version 1 and does not touch the links or the agent version.
    const same = await save({ ...base, candidate_ids: [a.id] });
    expect(same.statusCode).toBe(200);
    expect(Skill.strict().parse(same.json())).toMatchObject({ id: skill.id, version: 1, agent_count: 1 });

    // 200: accept B too and save the changed body → version 2, still one link, agent version unchanged.
    await patch(app, b.id, { status: 'accepted' });
    const draft3 = ConventionSkillDraft.strict().parse(
      (await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions/skill-draft` })).json(),
    );
    expect(draft3.body).toContain(`## ${RULE_B}`);
    const next = await save({ ...base, body: draft3.body, enabled: true, candidate_ids: [a.id, b.id] });
    expect(next.statusCode).toBe(200);
    const v2 = Skill.strict().parse(next.json());
    expect(v2).toMatchObject({
      id: skill.id,
      version: 2,
      enabled: true,
      evidence_files: ['src/lib/hooks/agents.ts', 'src/modules/repos/service.ts'],
      agent_count: 1,
    });
    const versions = await db.select().from(t.skillVersions).where(eq(t.skillVersions.skillId, skill.id));
    expect(versions.map((v) => v.version).sort()).toEqual([1, 2]);
    const links2 = AgentSkill.strict().array().parse((await app.inject({ method: 'GET', url: `/agents/${agentId}/skills` })).json());
    expect(links2.map((l) => l.skill_id)).toEqual([skill.id]);
    const agentAfter = Agent.strict().parse((await app.inject({ method: 'GET', url: `/agents/${agentId}` })).json());
    expect(agentAfter.version).toBe(agentLinked.version);
    expect(await db.select().from(t.skills).where(and(eq(t.skills.workspaceId, ws), eq(t.skills.name, 'repo-conventions')))).toHaveLength(1);

    // 409: a name that belongs to a manual skill.
    const manual = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: { name: 'house-style', description: 'Use when formatting', type: 'custom', body: 'Body.' },
    });
    expect(manual.statusCode).toBe(201);
    const taken = await save({ ...base, name: 'house-style', candidate_ids: [a.id] });
    expect(taken.statusCode).toBe(409);
    expect(taken.json().error).toMatchObject({ code: 'skill_name_taken', details: { name: 'house-style' } });
    await app.close();
  });

  it('D14: a failing model call marks the scan failed with its error', async () => {
    const bad = { candidates: [{ category: 'naming', rule: 'x', evidence: { file: 'tsconfig.json', line: 1, quote: '{' }, confidence: 2 }] };
    const app = await makeAppWithMocks(bad);
    const repoId = await createRepo();
    const scan = await extractAndWait(app, repoId);
    const after = await state(app, repoId);
    expect(after.scan).toMatchObject({ id: scan.id, status: 'failed', sample_count: 3, provider: 'openai', model: MODEL });
    expect(after.scan!.error).toContain('MockLLMProvider fixture failed schema');
    expect(after.candidates).toEqual([]);
    await app.close();
  });
});
