import type { CSSProperties } from "react";

/** Co-located styles for the skill ConfigTab. */
export const s = {
  wrap: { maxWidth: 820 } satisfies CSSProperties,
  header: { display: "flex", alignItems: "center", gap: 10, marginBottom: 20 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  enabledLabel: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  actions: { display: "flex", gap: 10, alignItems: "center", marginTop: 10 } satisfies CSSProperties,
  savedNote: { fontSize: 13, color: "var(--ok)" } satisfies CSSProperties,
  error: { fontSize: 13, color: "var(--crit)" } satisfies CSSProperties,
  delete: { marginLeft: "auto", color: "var(--crit)" } satisfies CSSProperties,
} as const;
