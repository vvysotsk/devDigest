import type { CSSProperties } from "react";

/** Co-located styles for VersionsTab. */
export const s = {
  wrap: { maxWidth: 820 } satisfies CSSProperties,
  hint: { fontSize: 13, color: "var(--text-muted)", margin: "0 0 12px" } satisfies CSSProperties,
  list: { listStyle: "none", padding: 0, margin: "0 0 16px", display: "flex", flexDirection: "column", gap: 6 } satisfies CSSProperties,
  row: (active: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    padding: "9px 12px",
    borderRadius: 7,
    border: "1px solid " + (active ? "var(--accent)" : "var(--border)"),
    background: active ? "var(--accent-bg)" : "var(--bg-elevated)",
    color: "var(--text-primary)",
    textAlign: "left",
    cursor: "pointer",
  }),
  version: { fontSize: 13, fontWeight: 600, minWidth: 40 } satisfies CSSProperties,
  date: { fontSize: 12.5, color: "var(--text-muted)" } satisfies CSSProperties,
  body: {
    fontSize: 12.5,
    lineHeight: 1.55,
    padding: 16,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-surface)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  } satisfies CSSProperties,
} as const;
