import type { CSSProperties } from "react";

/** Co-located styles for FindingsPanel (extracted from inline styles). */
export const s = {
  toolbar: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 16,
  } satisfies CSSProperties,
  /** Row 1: severity counter pills (left) + hide-low-confidence toggle (right). */
  pillsRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  /** Row 2: one filter chip per severity that actually occurs. */
  filterRow: { display: "flex", gap: 8, flexWrap: "wrap" } satisfies CSSProperties,
  toggleGroup: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 12 } satisfies CSSProperties,
} as const;
