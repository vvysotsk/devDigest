/* SeveritySummary — per-severity finding counts of one run (or a batch).
   variant "icons" → compact icon+count badges (PR list, timeline tiles);
   variant "pills" → "3 CRITICAL · 5 WARNING · 2 SUGGESTION" (run card, trace).
   Only severities that actually occur render; zero findings render nothing —
   callers decide whether to show a dash. */
import React from "react";
import { Icon, SEV } from "@devdigest/ui";
import type { Severity } from "@devdigest/shared";
import { presentSeverities, type FindingsBySeverity } from "./helpers";

export function SeveritySummary({
  counts,
  variant = "icons",
  ariaLabel,
}: {
  counts: FindingsBySeverity;
  variant?: "icons" | "pills";
  ariaLabel?: string;
}) {
  const present = presentSeverities(counts);
  if (present.length === 0) return null;

  if (variant === "icons") {
    return (
      <span
        role="group"
        aria-label={ariaLabel}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}
      >
        {present.map((sev) => (
          <SeverityChip key={sev} severity={sev} count={counts[sev]} />
        ))}
      </span>
    );
  }

  return (
    <span
      role="group"
      aria-label={ariaLabel}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
    >
      {present.map((sev, i) => (
        <React.Fragment key={sev}>
          {i > 0 && (
            <span aria-hidden style={{ color: "var(--text-muted)", fontSize: 12 }}>
              ·
            </span>
          )}
          <SeverityPill severity={sev} count={counts[sev]} />
        </React.Fragment>
      ))}
    </span>
  );
}

/** Icon + count in the severity colours (same box as the kit's compact
    SeverityBadge). The count carries `severity-summary-count` so a container
    can hide it via CSS on narrow layouts — the label/tooltip keeps the number. */
function SeverityChip({ severity, count }: { severity: Severity; count: number }) {
  const s = SEV[severity];
  const I = Icon[s.icon];
  const label = `${count} ${s.label}`;
  return (
    <span
      data-severity={severity}
      title={label}
      aria-label={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 6px",
        borderRadius: 5,
        fontSize: 12,
        fontWeight: 600,
        color: s.c,
        background: s.bg,
        whiteSpace: "nowrap",
      }}
    >
      <I size={12.5} />
      <span className="tnum severity-summary-count" style={{ opacity: 0.85, marginLeft: 6 }}>
        {count}
      </span>
    </span>
  );
}

/** "3 CRITICAL" — count first, label uppercased by CSS, colours from the SEV tokens. */
function SeverityPill({ severity, count }: { severity: Severity; count: number }) {
  const s = SEV[severity];
  const I = Icon[s.icon];
  return (
    <span
      data-severity={severity}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: s.c,
        background: s.bg,
        whiteSpace: "nowrap",
      }}
    >
      <I size={12.5} />
      <span className="tnum">
        {count} {s.label}
      </span>
    </span>
  );
}
