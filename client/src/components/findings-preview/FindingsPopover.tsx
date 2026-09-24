/* FindingsPopover — the fixed-position card listing read-only FindingPreviews
   under a "N FINDINGS IN THIS RUN" title. Placement is computed from the
   trigger's DOMRect and clamped to the viewport. */
import React from "react";
import type { FindingRecord } from "@devdigest/shared";
import { FindingPreview } from "./FindingPreview";
import { sortBySeverity } from "./helpers";
import { s, POPOVER_WIDTH, POPOVER_GAP } from "./styles";

export const FindingsPopover = React.forwardRef<
  HTMLDivElement,
  {
    findings: readonly FindingRecord[];
    title: string;
    loading?: boolean;
    loadingText?: string;
    emptyText?: string;
    anchor: DOMRect | null;
    onClick?: (e: React.MouseEvent) => void;
  }
>(function FindingsPopover({ findings, title, loading, loadingText, emptyText, anchor, onClick }, ref) {
  const { top, left } = placement(anchor);
  const sorted = React.useMemo(() => sortBySeverity(findings), [findings]);
  return (
    <div ref={ref} role="dialog" aria-label={title} style={s.popover(top, left)} onClick={onClick}>
      <div style={s.title}>{title}</div>
      {loading ? (
        <div style={s.note}>{loadingText ?? "…"}</div>
      ) : sorted.length === 0 ? (
        <div style={s.note}>{emptyText ?? "—"}</div>
      ) : (
        <div style={s.list}>
          {sorted.map((f) => (
            <FindingPreview key={f.id} f={f} />
          ))}
        </div>
      )}
    </div>
  );
});

/** Below the trigger, left-aligned, kept inside the viewport horizontally. */
function placement(anchor: DOMRect | null): { top: number; left: number } {
  if (!anchor) return { top: 0, left: 0 };
  const vw = typeof window !== "undefined" ? window.innerWidth : Number.POSITIVE_INFINITY;
  const left = Math.max(8, Math.min(anchor.left, vw - POPOVER_WIDTH - 8));
  return { top: anchor.bottom + POPOVER_GAP, left };
}
