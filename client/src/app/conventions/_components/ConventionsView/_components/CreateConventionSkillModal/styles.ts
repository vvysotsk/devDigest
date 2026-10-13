import type { CSSProperties } from "react";

/** Co-located styles for CreateConventionSkillModal (DZ 2.png). */
export const s = {
  body: { padding: 24 } satisfies CSSProperties,
  info: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    marginBottom: 20,
    borderRadius: 8,
    border: "1px solid var(--accent)",
    background: "var(--accent-bg, rgba(59,130,246,0.12))",
    fontSize: 13,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  infoIcon: { color: "var(--accent-text)", flexShrink: 0 } satisfies CSSProperties,
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 } satisfies CSSProperties,
  toggleRow: { display: "flex", alignItems: "center", height: 42 } satisfies CSSProperties,
  footer: { display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center" } satisfies CSSProperties,
  note: { fontSize: 12.5, color: "var(--text-muted)", marginRight: "auto" } satisfies CSSProperties,
  error: { fontSize: 13, color: "var(--crit)", marginRight: "auto" } satisfies CSSProperties,
} as const;
