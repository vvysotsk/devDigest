// Run: node --test .claude/skills/pr-self-review/scripts/journal-keys.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  skillRev,
  normRev,
  pairsFromJournal,
  ruleKey,
  contentKey,
  stableFindingId,
  dismissalKeyOf,
  lineHash,
  placementHash,
  addedInfo,
  filterInfo,
  stillAdded,
} from './journal-keys.mjs';

const PAIRS = [
  { skill: 'onion-architecture', path: 'server/src/a.ts' },
  { skill: 'onion-architecture', path: 'server/src/b.ts' },
];
const BLOBS = { 'server/src/a.ts': 'blob-a', 'server/src/b.ts': 'blob-b' };
const blobOf = (p) => BLOBS[p];
const check = (rev, path, blob = BLOBS[path]) => ({
  kind: 'check',
  skill: 'onion-architecture',
  skill_rev: rev,
  path,
  blob,
});

/** Pairs still to run when the skill is now at `version`, given the journal. */
function toRun(version, journal) {
  const rev = { 'onion-architecture': skillRev(version, 'irrelevant for versioned skills') };
  const served = new Set(pairsFromJournal(PAIRS, journal, rev, blobOf).map((p) => p.path));
  return PAIRS.filter((p) => !served.has(p.path)).map((p) => p.path);
}

test('skill revision is major.minor for a versioned skill', () => {
  assert.equal(skillRev('1.1.1', ''), 'v1.1');
  assert.equal(skillRev('2.0.0', ''), 'v2.0');
  assert.equal(skillRev('1.2', ''), 'v1.2');
});

test('a journal written before 2.0.0 (full version) reads as major.minor', () => {
  assert.equal(normRev('v1.1.0'), 'v1.1');
  assert.equal(normRev('v1.1'), 'v1.1');
  assert.equal(normRev('h0123456789ab'), 'h0123456789ab');
});

test('a patch bump keeps the pairs checked at the same major.minor', () => {
  const journal = [check('v1.1', 'server/src/a.ts'), check('v1.1.0', 'server/src/b.ts')];
  assert.deepEqual(toRun('1.1.1', journal), []);
});

test('a minor bump invalidates the pairs', () => {
  const journal = [check('v1.1', 'server/src/a.ts'), check('v1.1.0', 'server/src/b.ts')];
  assert.deepEqual(toRun('1.2.0', journal), ['server/src/a.ts', 'server/src/b.ts']);
});

test('a major bump invalidates the pairs', () => {
  const journal = [check('v1.1', 'server/src/a.ts'), check('v1.1', 'server/src/b.ts')];
  assert.deepEqual(toRun('2.0.0', journal), ['server/src/a.ts', 'server/src/b.ts']);
});

test('a changed file is re-checked even at the same revision', () => {
  const journal = [check('v1.1', 'server/src/a.ts', 'old-blob'), check('v1.1', 'server/src/b.ts')];
  assert.deepEqual(toRun('1.1.1', journal), ['server/src/a.ts']);
});

test('an unversioned skill uses the SKILL.md hash: any edit invalidates', () => {
  const before = skillRev(null, '# skill\nrule one\n');
  const after = skillRev(null, '# skill\nrule one, reworded\n');
  assert.match(before, /^h[0-9a-f]{12}$/);
  assert.notEqual(before, after);
  const journal = [check(before, 'server/src/a.ts'), check(before, 'server/src/b.ts')];
  const served = pairsFromJournal(PAIRS, journal, { 'onion-architecture': after }, blobOf);
  assert.deepEqual(served, []);
});

// ---------- finding identity (D13) ----------

const sha = (s) => crypto.createHash('sha1').update(s).digest('hex');

test('ruleKey reduces every rule wording found in the journal to its id or heading', () => {
  const cases = {
    // frontend-architecture
    'Map — Constants: constants.ts beside the component; module scope only when only that file uses them': 'map',
    'Map — Styles (styles.ts beside the component) / Constants (never inline static objects in the render body)': 'map',
    'Map — Styles (styles.ts beside the component, s.<name> inline objects)': 'map',
    'Map — Styles / Constants (styles.ts beside the component; never inline static objects in the render body)': 'map',
    'Map — Tests: fixtures in a non-test file': 'map',
    "R1 — index.ts is a component's public boundary": 'r1',
    "R1 — index.ts is a component's public boundary (only the component and its public types)": 'r1',
    'Review signals — Effect-heavy component (> 1 useEffect)': 'review signals',
    'Review signals — Long component file (> 200 lines)': 'review signals',
    'Review signals — Wide props surface (> 7 props)': 'review signals',
    // onion-architecture
    'R1 — rows stay in the repository (check 3)': 'r1',
    'R2 — routes are thin; Drizzle in routes only for the thin-module exception (check 1)': 'r2',
    'R3 — response schema + shape test (check 2)': 'r3',
    'R3 — response schema + shape test for every new or changed route (check 2)': 'r3',
    'R5 — composition root and dependencies (existing services keep their constructor until touched)': 'r5',
    'R6 — pure helpers do not belong in adapters/': 'r6',
    'R7 — Errors': 'r7',
    'check 5 / R5 — no `new <Repository>(` outside platform/container.ts in new code': 'r5',
    // postgresql-table-design, react-best-practices, react-testing-library
    'Data Types — Money: NUMERIC(p,s) (never float)': 'data types',
    'Component Design — components must be pure, no side effects during render': 'component design',
    'Component Design — size is a review signal (>7 props)': 'component design',
    'Conditional Rendering — replace nested ternaries / early returns for loading-error-empty-success': 'conditional rendering',
    'Conditional Rendering — replace nested ternaries with early returns or extracted components': 'conditional rendering',
    'React 19 Patterns — accept ref as a regular prop instead of forwardRef': 'react 19 patterns',
    'Tailwind CSS — no inline style={} objects': 'tailwind css',
    'Anti-Patterns — container.querySelector() / Query Priority': 'anti-patterns',
    'Anti-Patterns — container.querySelector() / destructuring from render()': 'anti-patterns',
    'Import Rules — ALWAYS userEvent, NEVER fireEvent': 'import rules',
    'Philosophy #3 — Test behavior, not implementation (never assert on hook calls)': 'philosophy #3',
    'What to Test / What to Skip — CSS classes or inline styles': 'what to test / what to skip',
    // extra forms
    R3: 'r3',
    'r3 — whatever': 'r3',
    'check 7: foo bar': 'check 7',
    'Component Design (CRITICAL)': 'component design',
    'Component Design (see R5) — an id inside (…) is ignored': 'component design',
    'Accessibility (a11y)': 'accessibility',
    'React 19 Patterns': 'react 19 patterns',
    'A05 — Injection': 'a05',
    'A05 Injection': 'a05',
    '§12.3 open questions': '§12.3',
    '§ 4 - spaced hyphen and spaced section sign': '§4',
    'R10 — two digits': 'r10',
    'Ranking — not an id': 'ranking',
    'a11y — not an OWASP id': 'a11y',
    'schema-use-enums': 'schema-use-enums',
    'routes.md — route organization': 'routes.md',
    'Best Practices 3 — Transactions': 'best practices 3',
    'Agentic AI Security (ASI09 — unclosed group': 'agentic ai security',
  };
  for (const [raw, key] of Object.entries(cases)) assert.equal(ruleKey(raw), key, raw);
});

const FINDING = {
  skill: 'onion-architecture',
  path: 'server/src/modules/pulls/routes.ts',
  line_hash: 'd18be2e4352f',
};

test('the same finding worded two ways gets the same stable id', () => {
  const a = stableFindingId({ ...FINDING, rule: 'R3 — response schema + shape test' });
  const b = stableFindingId({ ...FINDING, rule: 'R3 — response schema + shape test for every new or changed route (check 2)' });
  const c = stableFindingId({ ...FINDING, rule_key: 'r3' });
  assert.match(a, /^[0-9a-f]{8}$/);
  assert.equal(a, b);
  assert.equal(a, c);
  assert.notEqual(a, stableFindingId({ ...FINDING, rule: 'R2 — routes are thin' }));
});

test('an old-format dismissal still matches after the id change', () => {
  const lineText = 'schema: { params: IdParams, response: { 200: PrReviewComment.array() } },';
  const oldRule = 'R3 — response schema + shape test (check 2)';
  const oldId = sha(`${FINDING.skill}|${oldRule}|${FINDING.path}|${lineText}`).slice(0, 8);
  const lineHash = sha(lineText).slice(0, 12);
  // Journal as written by 2.0.x: the finding record and a dismissal with only finding_id.
  const oldFinding = { kind: 'finding', id: oldId, skill: FINDING.skill, rule: oldRule, path: FINDING.path, line_hash: lineHash, blob: 'b1' };
  const oldDismissal = { kind: 'dismissal', finding_id: oldId, blob: 'b1', line_hash: lineHash };
  const byId = new Map([[oldId, oldFinding]]);
  const d = dismissalKeyOf(oldDismissal, byId);

  // Re-checked with another wording at the same blob → same content key, same blob → dismissed.
  const recheck = { skill: FINDING.skill, rule: 'R3', path: FINDING.path, line_hash: lineHash };
  const key = contentKey(recheck.skill, ruleKey(recheck.rule), recheck.path, recheck.line_hash);
  assert.deepEqual(d, { key, blob: 'b1' });
  // At another blob the key still matches → shown as "previously dismissed".
  assert.notEqual(d.blob, 'b2');
  assert.equal(d.key, key);
});

test('a new-format dismissal carries its own key', () => {
  const d = { kind: 'dismissal', finding_id: 'x', skill: FINDING.skill, rule_key: 'r3', path: FINDING.path, line_hash: FINDING.line_hash, blob: 'b9' };
  assert.deepEqual(dismissalKeyOf(d, new Map()), {
    key: contentKey(FINDING.skill, 'r3', FINDING.path, FINDING.line_hash),
    blob: 'b9',
  });
});

test('an old-format dismissal without its finding record resolves to null', () => {
  assert.equal(dismissalKeyOf({ kind: 'dismissal', finding_id: 'deadbeef', blob: 'b1', line_hash: 'x' }, new Map()), null);
});

// ---------- stale findings after a base change ----------

const PAGE = 'client/src/app/repos/[repoId]/pulls/page.tsx';
const onLine = (text) => ({ skill: 'react-best-practices', path: PAGE, line_hash: lineHash(text) });

test('lineHash equals the grounding formula (sha1 of the whitespace-normalized line, 12 hex)', () => {
  const raw = '          {isLoading ? (   ';
  assert.equal(lineHash(raw), sha('{isLoading ? (').slice(0, 12));
  assert.equal(placementHash(PAGE), sha(`placement:${PAGE}`).slice(0, 12));
});

test('a journal finding on a line that is still added is kept', () => {
  const info = addedInfo({ status: 'M', added: { 107: '  {isLoading ? (', 108: '  <Row />' } });
  assert.equal(stillAdded(onLine('{isLoading ? ('), info), true);
});

test('a journal finding on a line that is no longer added is dropped', () => {
  const info = addedInfo({ status: 'M', added: { 12: 'import x from "y";' } });
  assert.equal(stillAdded(onLine('{isLoading ? ('), info), false);
});

test('a placement finding follows the file status', () => {
  const f = { skill: 'frontend-architecture', path: PAGE, line_hash: placementHash(PAGE) };
  assert.equal(stillAdded(f, addedInfo({ status: 'A', added: {} })), true);
  assert.equal(stillAdded(f, addedInfo({ status: 'R', added: {} })), true);
  assert.equal(stillAdded(f, addedInfo({ status: 'M', added: {}, untracked: true })), true);
  assert.equal(stillAdded(f, addedInfo({ status: 'M', added: { 1: 'x' } })), false);
});

test('a plan with added_hashes is used as is', () => {
  const planFile = { path: PAGE, status: 'M', blob: 'b1', untracked: false, added_hashes: [lineHash('x')] };
  assert.equal(filterInfo(planFile, undefined), planFile);
});

test('legacy run dir, blob mismatch: findings of a file whose current blob differs from the plan stay unfiltered', () => {
  const planFile = { path: PAGE, status: 'M', blob: 'planned-blob' }; // no added_hashes: legacy plan
  const live = { path: PAGE, status: 'M', blob: 'edited-since', added: { 1: 'unrelated' } };
  const info = filterInfo(planFile, live);
  assert.equal(info, null);
  assert.equal(stillAdded(onLine('{isLoading ? ('), info), true);
});

test('legacy run dir, same blob: the live added lines are used', () => {
  const planFile = { path: PAGE, status: 'M', blob: 'same' };
  const live = { path: PAGE, status: 'M', blob: 'same', added: { 1: 'unrelated' } };
  assert.equal(stillAdded(onLine('{isLoading ? ('), filterInfo(planFile, live)), false);
});
