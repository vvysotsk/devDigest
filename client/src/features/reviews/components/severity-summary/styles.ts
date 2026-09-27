import type { CSSProperties } from "react";

/* Co-located styles for SeveritySummary. Named `st` because the component
   already uses `s` for the SEV token of a severity. The chip and pill take
   their colours from SEV at the call site: `{ ...st.chip, color, background,
   whiteSpace }` keeps the property order the component always rendered. */
export const st = {
  iconsGroup: { display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" } satisfies CSSProperties,
  pillsGroup: { display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" } satisfies CSSProperties,
  separator: { color: "var(--text-muted)", fontSize: 12 } satisfies CSSProperties,
  chip: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 6px",
    borderRadius: 5,
    fontSize: 12,
    fontWeight: 600,
  } satisfies CSSProperties,
  chipCount: { opacity: 0.85, marginLeft: 6 } satisfies CSSProperties,
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  } satisfies CSSProperties,
} as const;
