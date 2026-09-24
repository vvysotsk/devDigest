import type { CSSProperties } from "react";
import { GRID, GRID_NARROW } from "./constants";

/** Co-located styles for the PR list page (extracted from inline styles). */
export const s = {
  row: (hover: boolean): CSSProperties => ({
    display: "grid",
    gridTemplateColumns: `var(--pr-grid, ${GRID})`,
    alignItems: "center",
    gap: "var(--pr-gap, 14px)",
    padding: "12px var(--pr-pad-x, 20px)",
    borderBottom: "1px solid var(--border)",
    cursor: "pointer",
    background: hover ? "var(--bg-surface)" : "transparent",
    transition: "background .1s",
  }),
  rowTitleCell: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: 12,
  } satisfies CSSProperties,
  rowIcon: (color: string): CSSProperties => ({ color, flexShrink: 0 }),
  rowTitleWrap: { minWidth: 0 } satisfies CSSProperties,
  rowTitle: (hover: boolean): CSSProperties => ({
    fontSize: 14,
    fontWeight: 550,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    color: hover ? "var(--accent-text)" : "var(--text-primary)",
  }),
  rowNumber: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  authorCell: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "var(--text-secondary)",
    minWidth: 0,
  } satisfies CSSProperties,
  authorName: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  sizeBadgeBorder: (color: string): CSSProperties => ({ border: `1px solid ${color}` }),
  scoreCell: { display: "flex", alignItems: "center" } satisfies CSSProperties,
  findingsCell: { display: "flex", alignItems: "center", minWidth: 0 } satisfies CSSProperties,
  /** Narrow layout lets "Needs review" wrap onto two lines instead of overflowing. */
  statusBadge: { whiteSpace: "var(--pr-status-wrap, nowrap)" as CSSProperties["whiteSpace"], textAlign: "left" } satisfies CSSProperties,
  costCell: { textAlign: "right" } satisfies CSSProperties,
  updatedCell: {
    fontSize: 12,
    color: "var(--text-muted)",
    textAlign: "right",
  } satisfies CSSProperties,
  muted: { color: "var(--text-muted)" } satisfies CSSProperties,
  filterBar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 20px",
    borderBottom: "1px solid var(--border)",
    flexWrap: "wrap",
  } satisfies CSSProperties,
  filterChips: { display: "flex", gap: 8 } satisfies CSSProperties,
  filterActions: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 12,
  } satisfies CSSProperties,
  pageHeader: {
    padding: "24px var(--pr-margin-x, 32px) 10px",
    display: "flex",
    alignItems: "flex-end",
    gap: 16,
  } satisfies CSSProperties,
  pageTitle: {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: "-0.02em",
  } satisfies CSSProperties,
  pageSubtitle: {
    fontSize: 14,
    color: "var(--text-secondary)",
    marginTop: 4,
  } satisfies CSSProperties,
  headerActions: {
    marginLeft: "auto",
    display: "flex",
    gap: 10,
    alignItems: "center",
  } satisfies CSSProperties,
  /** Root of the list page (`.pr-list`). The two grid templates live HERE, on
      the same element where globals.css resolves `--pr-grid` from them — a
      custom property referenced by `var()` must be defined on (or above) the
      element that computes it, otherwise `--pr-grid` becomes invalid and the
      rows collapse into a single column. */
  listRoot: {
    "--pr-grid-wide": GRID,
    "--pr-grid-narrow": GRID_NARROW,
  } as CSSProperties,
  tableCard: {
    margin: "14px var(--pr-margin-x, 32px) 44px",
    border: "1px solid var(--border)",
    borderRadius: 10,
    overflow: "hidden",
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
  headRow: {
    display: "grid",
    gridTemplateColumns: `var(--pr-grid, ${GRID})`,
    gap: "var(--pr-gap, 14px)",
    padding: "10px var(--pr-pad-x, 20px)",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-surface)",
    fontSize: "var(--pr-head-font, 12px)",
    fontWeight: 700,
    letterSpacing: "0.06em",
    color: "var(--text-muted)",
    textTransform: "uppercase",
  } satisfies CSSProperties,
  headCell: (alignRight: boolean): CSSProperties => ({
    textAlign: alignRight ? "right" : "left",
  }),
  loadingStack: {
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  } satisfies CSSProperties,
} as const;
