import type { SkillVersion } from "@devdigest/shared";

export interface VersionRow {
  version: SkillVersion;
  /** Body equals the previous version's body: only name / description / type changed. */
  metadataOnly: boolean;
}

export interface DiffLine {
  kind: "same" | "add" | "del";
  text: string;
}

/** Above this many LCS cells the diff falls back to "all old lines out, all new lines in". */
export const MAX_DIFF_CELLS = 4_000_000;

/**
 * Line diff of `before` → `after` (longest common subsequence), for the
 * Versioning tab's "Diff with current". Unchanged lines are `same`, lines only
 * in `before` are `del`, lines only in `after` are `add`; deletions come
 * before additions at the same point.
 */
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const n = a.length;
  const m = b.length;
  if (n * m > MAX_DIFF_CELLS) {
    return [...a.map((text) => ({ kind: "del" as const, text })), ...b.map((text) => ({ kind: "add" as const, text }))];
  }
  // lcs[i][j] = LCS length of a[i..] and b[j..], stored row-major.
  const w = m + 1;
  const lcs = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * w + j] = a[i] === b[j] ? lcs[(i + 1) * w + j + 1]! + 1 : Math.max(lcs[(i + 1) * w + j]!, lcs[i * w + j + 1]!);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i]! });
      i++;
      j++;
    } else if (lcs[(i + 1) * w + j]! >= lcs[i * w + j + 1]!) {
      out.push({ kind: "del", text: a[i]! });
      i++;
    } else {
      out.push({ kind: "add", text: b[j]! });
      j++;
    }
  }
  for (; i < n; i++) out.push({ kind: "del", text: a[i]! });
  for (; j < m; j++) out.push({ kind: "add", text: b[j]! });
  return out;
}

/** Newest first; a version whose body equals the one before it is a metadata change. */
export function versionRows(versions: SkillVersion[]): VersionRow[] {
  const asc = [...versions].sort((a, b) => a.version - b.version);
  return asc
    .map((v, i) => ({ version: v, metadataOnly: i > 0 && asc[i - 1]!.body === v.body }))
    .reverse();
}
