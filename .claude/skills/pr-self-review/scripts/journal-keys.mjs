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

// ---------- finding identity (plan.md D13) ----------
//
// A checker words the same rule differently from run to run ("R3 — response
// schema + shape test" vs "R3"), so the raw `rule` is never hashed. `ruleKey`
// reduces it to the rule's id or its heading; the finding id and the
// dismissal match are built from that key.

const RULE_ID = String.raw`(?:r\d+|a\d\d|check \d+|§ ?\d+(?:\.\d+)*)`;
const RULE_SEP = String.raw`\s*[/,&+]\s*`;
const ONLY_IDS = new RegExp(`^${RULE_ID}(?:${RULE_SEP}${RULE_ID})*$`);
const LEADING_ID = new RegExp(`^${RULE_ID}(?![a-z0-9])`);
const ID_PRIORITY = [/^r\d+$/, /^a\d\d$/, /^check \d+$/, /^§/];

/**
 * Stable key of a rule as a checker named it:
 *   - head = text before the first " — " (" - ", " – ", " -- " count too),
 *     lowercased, `(…)` groups removed;
 *   - head made only of ids ("check 5 / R5") → the id by priority R > A > check > §;
 *   - head starting with an id ("R3", "check 7: …", "A05 Injection") → that id;
 *   - otherwise the head up to the first ":".
 */
export function ruleKey(rule) {
  const s = String(rule ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/ (?:–|-|—|--) /g, ' — ');
  const head = s.split(' — ')[0].replace(/\([^)]*\)?/g, ' ').replace(/\s+/g, ' ').trim();
  const tidy = (id) => id.replace(/^§ /, '§');
  if (ONLY_IDS.test(head)) {
    const ids = head.split(new RegExp(RULE_SEP)).map(tidy);
    for (const re of ID_PRIORITY) {
      const hit = ids.find((id) => re.test(id));
      if (hit) return hit;
    }
  }
  const lead = head.match(LEADING_ID);
  if (lead) return tidy(lead[0]);
  return head.split(':')[0].trim();
}

/** Content key of a finding: the same issue on the same line text, whatever the wording. */
export function contentKey(skill, rule_key, path, line_hash) {
  return `${skill}|${rule_key}|${path}|${line_hash}`;
}

/**
 * Stable id of a finding record (old or new format: both store skill, rule,
 * path and line_hash). The stored `id` of an old record may differ; check
 * records keep referencing that stored id.
 */
export function stableFindingId(f) {
  const key = contentKey(f.skill, f.rule_key ?? ruleKey(f.rule), f.path, f.line_hash);
  return crypto.createHash('sha1').update(key).digest('hex').slice(0, 8);
}

/**
 * What a dismissal record dismisses: `{ key, blob }`.
 *   - new format (skill, rule_key, path, line_hash) → read directly;
 *   - old format (finding_id, blob, line_hash only) → resolved through the
 *     journal finding record with that stored id (`findingById`);
 * `null` when an old dismissal's finding record is missing.
 */
export function dismissalKeyOf(d, findingById) {
  if (d.skill && d.rule_key && d.path) return { key: contentKey(d.skill, d.rule_key, d.path, d.line_hash), blob: d.blob };
  const f = findingById.get(d.finding_id);
  if (!f) return null;
  return { key: contentKey(f.skill, f.rule_key ?? ruleKey(f.rule), f.path, d.line_hash ?? f.line_hash), blob: d.blob };
}
