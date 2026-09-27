/* SeveritySummary — per-severity finding counts of one run (or a batch).
   variant "icons" → compact icon+count badges (PR list, timeline tiles);
   variant "pills" → "3 CRITICAL · 5 WARNING · 2 SUGGESTION" (run card, trace).
   Only severities that actually occur render; zero findings render nothing —
   callers decide whether to show a dash. */
import React from "react";
import { Icon, SEV } from "@devdigest/ui";
import type { FindingsBySeverity, Severity } from "@devdigest/shared";
import { presentSeverities } from "@/lib/severity";
import { st } from "./styles";

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
        style={st.iconsGroup}
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
      style={st.pillsGroup}
    >
      {present.map((sev, i) => (
        <React.Fragment key={sev}>
          {i > 0 && (
            <span aria-hidden style={st.separator}>
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
      style={{ ...st.chip, color: s.c, background: s.bg, whiteSpace: "nowrap" }}
    >
      <I size={12.5} />
      <span className="tnum severity-summary-count" style={st.chipCount}>
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
      style={{ ...st.pill, color: s.c, background: s.bg, whiteSpace: "nowrap" }}
    >
      <I size={12.5} />
      <span className="tnum">
        {count} {s.label}
      </span>
    </span>
  );
}
