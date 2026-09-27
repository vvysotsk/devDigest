import type { CSSProperties } from "react";

/** Co-located styles for the findings preview popover + items. */
export const POPOVER_WIDTH = 340;
export const POPOVER_GAP = 6;

export const s = {
  /** Positioning context for the popover; inline so it sits in a table cell or a text run. */
  wrap: { display: "inline-flex", position: "relative" } satisfies CSSProperties,
  trigger: { display: "inline-flex", alignItems: "center", cursor: "default" } satisfies CSSProperties,
  popover: (top: number, left: number): CSSProperties => ({
    position: "fixed", // list containers clip overflow — absolute would be cut off
    top,
    left,
    width: POPOVER_WIDTH,
    maxHeight: 360,
    overflowY: "auto",
    overflowX: "hidden",
    zIndex: 60,
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    boxShadow: "var(--shadow-modal)",
    padding: "10px 12px",
    textAlign: "left",
    cursor: "default",
  }),
  title: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    marginBottom: 8,
  } satisfies CSSProperties,
  note: { fontSize: 12.5, color: "var(--text-muted)" } satisfies CSSProperties,
  error: { fontSize: 12.5, color: "var(--crit)" } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 10 } satisfies CSSProperties,
  item: {
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "8px 10px",
    background: "var(--bg-surface)",
  } satisfies CSSProperties,
  itemHead: { display: "flex", alignItems: "flex-start", gap: 8, minWidth: 0 } satisfies CSSProperties,
  /** The title wraps onto the next line — the category tag never shrinks it. */
  itemTitle: {
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.35,
    color: "var(--text-primary)",
    flex: 1,
    minWidth: 0,
    overflowWrap: "anywhere",
  } satisfies CSSProperties,
  itemCategory: { flexShrink: 0, paddingTop: 2 } satisfies CSSProperties,
  itemMeta: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 11.5,
    marginTop: 4,
    minWidth: 0,
  } satisfies CSSProperties,
  /** file:line reads like a link (accent), truncated so the confidence stays on the same row. */
  itemPath: {
    color: "var(--accent-text)",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  itemConfidence: { flexShrink: 0 } satisfies CSSProperties,
  itemBody: {
    fontSize: 12.5,
    lineHeight: 1.45,
    color: "var(--text-secondary)",
    marginTop: 6,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  } satisfies CSSProperties,
  itemBodyFull: {
    fontSize: 12.5,
    lineHeight: 1.5,
    color: "var(--text-secondary)",
    marginTop: 6,
    whiteSpace: "pre-wrap",
  } satisfies CSSProperties,
  itemSuggestion: {
    fontSize: 12.5,
    lineHeight: 1.5,
    color: "var(--text-secondary)",
    marginTop: 6,
    whiteSpace: "pre-wrap",
  } satisfies CSSProperties,
  itemSuggestionLabel: { fontWeight: 600, color: "var(--text-primary)" } satisfies CSSProperties,
} as const;
