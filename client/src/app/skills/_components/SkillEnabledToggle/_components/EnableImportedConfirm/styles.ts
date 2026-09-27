import type { CSSProperties } from "react";

/** Co-located styles for EnableImportedConfirm. */
export const s = {
  footer: { display: "flex", gap: 10, justifyContent: "flex-end" } satisfies CSSProperties,
  body: { padding: 24, display: "flex", flexDirection: "column", gap: 16 } satisfies CSSProperties,
  text: { fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 } satisfies CSSProperties,
  error: { fontSize: 13, color: "var(--crit)" } satisfies CSSProperties,
} as const;
