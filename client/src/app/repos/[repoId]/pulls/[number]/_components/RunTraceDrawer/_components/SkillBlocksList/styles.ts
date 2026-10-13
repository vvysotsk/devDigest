import type { CSSProperties } from "react";

/** Co-located styles for SkillBlocksList. */
export const s = {
  list: { listStyle: "none", padding: "0 0 0 16px", margin: "0 0 10px", display: "flex", flexDirection: "column", gap: 4 } satisfies CSSProperties,
  row: { display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 } satisfies CSSProperties,
  name: { fontWeight: 600 } satisfies CSSProperties,
  muted: { color: "var(--text-muted)" } satisfies CSSProperties,
  tokens: { marginLeft: "auto", color: "var(--text-secondary)" } satisfies CSSProperties,
} as const;
