import type { CSSProperties } from "react";

/** Co-located styles for CandidateCard (DZ 1.png: rule, evidence, snippet, confidence, actions). */
export const s = {
  card: {
    display: "flex",
    gap: 16,
    padding: 16,
    borderRadius: 8,
    border: "1px solid var(--border)",
    borderLeftWidth: 3,
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
  main: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 } satisfies CSSProperties,
  titleRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } satisfies CSSProperties,
  rule: { fontSize: 14, fontWeight: 600, fontStyle: "italic" } satisfies CSSProperties,
  evidence: { fontSize: 12.5 } satisfies CSSProperties,
  snippet: {
    margin: 0,
    padding: "10px 12px",
    borderRadius: 6,
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    fontSize: 12,
    lineHeight: 1.5,
    overflowX: "auto",
    whiteSpace: "pre",
  } satisfies CSSProperties,
  confidenceRow: { display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  bar: { width: 120 } satisfies CSSProperties,
  pct: { color: "var(--text-secondary)" } satisfies CSSProperties,
  actions: { display: "flex", flexDirection: "column", gap: 6, flexShrink: 0, alignItems: "stretch" } satisfies CSSProperties,
  editForm: { display: "flex", flexDirection: "column" } satisfies CSSProperties,
  editActions: { display: "flex", gap: 8 } satisfies CSSProperties,
} as const;
