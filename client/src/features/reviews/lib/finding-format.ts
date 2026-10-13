import type { FindingRecord } from "@devdigest/shared";

/** "12" or "45-52" — the line span shown next to a finding's file path. */
export function lineLabel(f: Pick<FindingRecord, "start_line" | "end_line">): string {
  return f.end_line !== f.start_line ? `${f.start_line}-${f.end_line}` : `${f.start_line}`;
}
