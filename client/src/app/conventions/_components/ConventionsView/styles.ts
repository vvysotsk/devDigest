import type { CSSProperties } from "react";

/** Co-located styles for ConventionsView (DZ 1.png: header, toolbar, card list). */
export const s = {
  page: { maxWidth: 880, margin: "0 auto", padding: "28px 28px 48px" } satisfies CSSProperties,
  header: { display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 } satisfies CSSProperties,
  headerText: { flex: 1, minWidth: 0 } satisfies CSSProperties,
  h1: { fontSize: 22, fontWeight: 700, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" } satisfies CSSProperties,
  repoName: { color: "var(--accent-text)", fontSize: 20, fontWeight: 600 } satisfies CSSProperties,
  subtitle: { marginTop: 6, fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
  alert: {
    marginBottom: 16,
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid var(--crit)",
    background: "var(--crit-bg, #2e0a0a)",
    color: "var(--text-primary)",
    fontSize: 13,
  } satisfies CSSProperties,
  toolbar: { display: "flex", alignItems: "center", gap: 12, marginBottom: 14 } satisfies CSSProperties,
  counter: { fontSize: 13, color: "var(--text-muted)", flex: 1 } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 14 } satisfies CSSProperties,
} as const;
