// Run: node --test .claude/skills/pr-self-review/scripts/journal-keys.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skillRev, normRev, pairsFromJournal } from './journal-keys.mjs';

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
