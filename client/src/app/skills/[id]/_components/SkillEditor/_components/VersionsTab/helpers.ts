import type { SkillVersion } from "@devdigest/shared";

export interface VersionRow {
  version: SkillVersion;
  /** Body equals the previous version's body: only name / description / type changed. */
  metadataOnly: boolean;
}

/** Newest first; a version whose body equals the one before it is a metadata change. */
export function versionRows(versions: SkillVersion[]): VersionRow[] {
  const asc = [...versions].sort((a, b) => a.version - b.version);
  return asc
    .map((v, i) => ({ version: v, metadataOnly: i > 0 && asc[i - 1]!.body === v.body }))
    .reverse();
}
