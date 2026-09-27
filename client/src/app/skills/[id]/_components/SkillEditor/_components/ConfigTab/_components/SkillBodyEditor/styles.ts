import type { CSSProperties } from "react";
import { LINE_HEIGHT } from "./constants";

const PAD_Y = 10;

/** Co-located styles for SkillBodyEditor. */
export const s = {
  frame: {
    border: "1px solid var(--border-strong)",
    borderRadius: 8,
    background: "var(--bg-elevated)",
    overflow: "hidden",
  } satisfies CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-surface)",
  } satisfies CSSProperties,
  fileIcon: { color: "var(--text-muted)" } satisfies CSSProperties,
  fileName: { fontSize: 12.5, fontWeight: 600 } satisfies CSSProperties,
  tokens: { marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  scroll: { display: "flex", maxHeight: 520, overflow: "auto" } satisfies CSSProperties,
  gutter: {
    flexShrink: 0,
    padding: `${PAD_Y}px 10px ${PAD_Y}px 12px`,
    textAlign: "right",
    fontSize: 12.5,
    lineHeight: `${LINE_HEIGHT}px`,
    color: "var(--text-muted)",
    borderRight: "1px solid var(--border)",
    userSelect: "none",
    background: "var(--bg-surface)",
  } satisfies CSSProperties,
  textarea: {
    flex: 1,
    minWidth: 0,
    resize: "none",
    border: "none",
    outline: "none",
    padding: `${PAD_Y}px 12px`,
    fontSize: 12.5,
    lineHeight: `${LINE_HEIGHT}px`,
    background: "transparent",
    color: "var(--text-primary)",
    whiteSpace: "pre",
    overflow: "hidden",
  } satisfies CSSProperties,
} as const;
