import type { CSSProperties } from "react";

/** Co-located styles for DeleteSkillConfirm. */
export const s = {
  footer: { display: "flex", gap: 10, justifyContent: "flex-end" } satisfies CSSProperties,
  body: { padding: 24, display: "flex", flexDirection: "column", gap: 10 } satisfies CSSProperties,
  usedBy: { fontSize: 14, fontWeight: 600 } satisfies CSSProperties,
  muted: { fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
  error: { fontSize: 13, color: "var(--crit)" } satisfies CSSProperties,
} as const;
