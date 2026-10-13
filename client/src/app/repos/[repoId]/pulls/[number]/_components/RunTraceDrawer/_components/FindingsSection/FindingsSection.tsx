/* FindingsSection — the persisted findings of THIS run (same data as the
   "Review runs" list), rendered inside a collapsible TraceSection: a
   per-severity pills row, then one read-only FindingPreview per finding in
   `full` mode — whole rationale + suggestion (accept/dismiss live on the
   Review runs card, not here). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@devdigest/ui";
import type { FindingRecord } from "@devdigest/shared";
import { SeveritySummary } from "@/features/reviews/components/severity-summary";
import { FindingPreview } from "@/features/reviews/components/findings-preview";
import { countBySeverity, sortBySeverity } from "@/features/reviews/lib/severity";
import { s } from "../../styles";
import { TraceSection } from "../TraceSection";

export function FindingsSection({ findings }: { findings: FindingRecord[] }) {
  const t = useTranslations("runs");
  const counts = React.useMemo(() => countBySeverity(findings), [findings]);
  const sorted = React.useMemo(() => sortBySeverity(findings), [findings]);
  return (
    <TraceSection
      icon="AlertOctagon"
      title={t("trace.findings")}
      right={<Badge color="var(--text-muted)">{findings.length}</Badge>}
    >
      {findings.length === 0 ? (
        <span style={s.noToolCalls}>{t("trace.noFindings")}</span>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SeveritySummary variant="pills" counts={counts} ariaLabel={t("trace.findings")} />
          {sorted.map((f) => (
            <FindingPreview key={f.id} f={f} full suggestionLabel={t("trace.suggestedFix")} />
          ))}
        </div>
      )}
    </TraceSection>
  );
}
