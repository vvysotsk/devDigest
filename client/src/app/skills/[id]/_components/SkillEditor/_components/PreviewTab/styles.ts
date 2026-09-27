import type { CSSProperties } from "react";

/** Co-located styles for PreviewTab. */
export const s = {
  wrap: { maxWidth: 820 } satisfies CSSProperties,
  toggle: { display: "flex", gap: 8, marginBottom: 16 } satisfies CSSProperties,
  raw: {
    fontSize: 12.5,
    lineHeight: 1.55,
    padding: 16,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-surface)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  } satisfies CSSProperties,
  rendered: {
    fontSize: 14,
    padding: 16,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
} as const;
