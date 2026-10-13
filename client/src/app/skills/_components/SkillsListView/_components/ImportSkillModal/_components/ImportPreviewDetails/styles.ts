import type { CSSProperties } from "react";
import type { SkillImportFileStatus } from "@devdigest/shared";

const STATUS_COLOR: Record<SkillImportFileStatus, string> = {
  imported: "var(--ok)",
  reference: "var(--text-secondary)",
  skipped: "var(--warn)",
};

/** Co-located styles for ImportPreviewDetails. */
export const s = {
  section: { marginBottom: 18 } satisfies CSSProperties,
  raw: {
    fontSize: 12.5,
    lineHeight: 1.5,
    padding: 12,
    borderRadius: 7,
    border: "1px solid var(--border)",
    background: "var(--bg-surface)",
    maxHeight: 260,
    overflow: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    marginTop: 8,
  } satisfies CSSProperties,
  muted: { fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
  list: { listStyle: "none", padding: 0, margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 6 } satisfies CSSProperties,
  warning: { display: "flex", alignItems: "baseline", gap: 8, fontSize: 13 } satisfies CSSProperties,
  warnIcon: { color: "var(--warn)", flexShrink: 0, alignSelf: "center" } satisfies CSSProperties,
  table: { width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 13 } satisfies CSSProperties,
  cell: { padding: "6px 8px", borderBottom: "1px solid var(--border)" } satisfies CSSProperties,
  cellMuted: { padding: "6px 8px", borderBottom: "1px solid var(--border)", color: "var(--text-muted)" } satisfies CSSProperties,
  cellSize: {
    padding: "6px 8px",
    borderBottom: "1px solid var(--border)",
    color: "var(--text-muted)",
    textAlign: "right",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  status: (status: SkillImportFileStatus): CSSProperties => ({ color: STATUS_COLOR[status], fontWeight: 600 }),
  trust: {
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
    fontSize: 13,
    lineHeight: 1.5,
    padding: 12,
    borderRadius: 7,
    border: "1px solid var(--warn)",
    background: "var(--warn-bg)",
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  trustIcon: { color: "var(--warn)", flexShrink: 0, marginTop: 2 } satisfies CSSProperties,
} as const;
