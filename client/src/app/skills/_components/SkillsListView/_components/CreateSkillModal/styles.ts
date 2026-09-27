import type { CSSProperties } from "react";

/** Co-located styles for CreateSkillModal. */
export const s = {
  footer: { display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center" } satisfies CSSProperties,
  error: { fontSize: 13, color: "var(--crit)", marginRight: "auto" } satisfies CSSProperties,
  body: { padding: 24 } satisfies CSSProperties,
} as const;
