// Pure journal-key helpers for self-review.mjs (no git, no fs) — unit-tested
// by journal-keys.test.mjs (`node --test .claude/skills/pr-self-review/scripts/journal-keys.test.mjs`).
//
// A (skill, path) pair counts as checked when the journal has a `check` record
// with the same skill, skill revision, path and blob (plan.md §3, D8).
// Skill revision:
//   - versioned skill → `v<major>.<minor>` of metadata.version: a patch bump
//     (wording, per each skill's README) keeps its checks, a minor or major
//     bump invalidates them;
//   - unversioned skill → `h<first 12 hex of sha1(SKILL.md)>`: any edit
//     invalidates.

import crypto from 'node:crypto';

const SEMVER = /^v?(\d+)\.(\d+)(?:\.\d+)?(?:[-+].*)?$/;

/** Revision of a skill: `v1.1` for version 1.1.x, `h<hash>` without a version. */
export function skillRev(version, skillText) {
  if (version) {
    const m = SEMVER.exec(String(version).trim());
    return m ? `v${m[1]}.${m[2]}` : `v${String(version).trim()}`;
  }
  return `h${crypto.createHash('sha1').update(skillText).digest('hex').slice(0, 12)}`;
}

/**
 * Normalise a stored `skill_rev`: journals written before 2.0.0 hold the full
 * version (`v1.1.0`); it reads as `v1.1`. Hash revisions pass through.
 */
export function normRev(rev) {
  if (typeof rev !== 'string' || !rev.startsWith('v')) return rev;
  const m = SEMVER.exec(rev);
  return m ? `v${m[1]}.${m[2]}` : rev;
}

/** Key of one checked pair at one skill revision and file content. */
export function checkKey(skill, rev, path, blob) {
  return `${skill}|${normRev(rev)}|${path}|${blob}`;
}

/** Keys of every `check` record in the journal. */
export function checkedKeys(journal) {
  return new Set(
    journal.filter((r) => r.kind === 'check').map((r) => checkKey(r.skill, r.skill_rev, r.path, r.blob)),
  );
}

/**
 * Pairs served from the journal: those whose (skill, current rev, path,
 * current blob) has a check record. `revBySkill` maps skill → current rev,
 * `blobByPath` maps path → current blob.
 */
export function pairsFromJournal(pairs, journal, revBySkill, blobByPath) {
  const done = checkedKeys(journal);
  return pairs.filter((p) => done.has(checkKey(p.skill, revBySkill[p.skill], p.path, blobByPath(p.path))));
}
