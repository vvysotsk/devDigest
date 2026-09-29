import type { CSSProperties } from "react";

/** Co-located styles for SkillRow. */
export const s = {
  row: (globallyEnabled: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    borderRadius: 7,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    opacity: globallyEnabled ? 1 : 0.55,
  }),
  // Hidden for unlinked rows; shown but inert (dimmed) for a linked row that
  // is not enabled, since only enabled skills can be dragged.
  handle: (linked: boolean, movable: boolean): CSSProperties => ({
    display: "inline-flex",
    color: "var(--text-muted)",
    cursor: movable ? "grab" : "not-allowed",
    opacity: movable ? 1 : 0.35,
    visibility: linked ? "visible" : "hidden",
  }),
  toggle: { display: "inline-flex", alignItems: "center", gap: 8 } satisfies CSSProperties,
  arrows: { display: "inline-flex", width: 52, gap: 2 } satisfies CSSProperties,
  name: { fontSize: 13, fontWeight: 600, color: "var(--text-primary)" } satisfies CSSProperties,
  disabledHint: { fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" } satisfies CSSProperties,
  detach: {
    marginLeft: "auto",
    fontSize: 12.5,
    background: "none",
    border: "none",
    color: "var(--text-secondary)",
    cursor: "pointer",
    padding: "4px 6px",
  } satisfies CSSProperties,
} as const;
