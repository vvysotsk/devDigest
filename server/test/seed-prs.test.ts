/**
 * Experiment PR fixtures stay internally consistent: per file, `additions` /
 * `deletions` equal the `+` / `-` lines of its patch, and every hunk header's
 * line counts match its body. A calibration edit (HW02 D13) that breaks one of
 * these fails here before it reaches a review.
 */
import { describe, it, expect } from 'vitest';
import { SEED_EXPERIMENT_PRS } from '../src/db/seed-prs.js';

function hunks(patch: string) {
  const out: { oldCount: number; newCount: number; lines: string[] }[] = [];
  for (const line of patch.split('\n')) {
    const h = /^@@ -\d+(?:,(\d+))? \+\d+(?:,(\d+))? @@/.exec(line);
    if (h) out.push({ oldCount: Number(h[1] ?? 1), newCount: Number(h[2] ?? 1), lines: [] });
    else out[out.length - 1]!.lines.push(line);
  }
  return out;
}

describe('SEED_EXPERIMENT_PRS', () => {
  for (const pr of SEED_EXPERIMENT_PRS) {
    for (const f of pr.files) {
      it(`#${pr.number} ${f.path}: additions / deletions and hunk headers match the patch`, () => {
        const hs = hunks(f.patch);
        expect(hs.length).toBeGreaterThan(0);
        const all = hs.flatMap((h) => h.lines);
        expect(all.filter((l) => l.startsWith('+')).length).toBe(f.additions);
        expect(all.filter((l) => l.startsWith('-')).length).toBe(f.deletions);
        for (const h of hs) {
          expect(h.lines.filter((l) => !l.startsWith('+')).length).toBe(h.oldCount);
          expect(h.lines.filter((l) => !l.startsWith('-')).length).toBe(h.newCount);
        }
      });
    }
  }

  it('the HW02 calibration PRs (#485, #486) refresh on a re-seed; the L02 ones do not', () => {
    const refreshed = SEED_EXPERIMENT_PRS.filter((p) => p.refreshOnSeed).map((p) => p.number);
    expect(refreshed).toEqual([485, 486]);
  });
});
