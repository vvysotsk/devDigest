/* FindingsPanel — severity counters + severity filter + hide-low-confidence +
   j/k navigation + FindingCard list, wiring the accept/dismiss action hook (A2).

   Counters are computed AFTER the confidence toggle and BEFORE the severity
   filter, so a pill's number always equals the cards of that severity below
   (the filter only hides other severities). All three filter chips are always
   rendered; one whose severity has no visible finding is disabled, and an
   active filter whose severity vanished (e.g. after hiding low confidence) is
   derived back to "no filter". */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Toggle, EmptyState, Chip, SEV } from "@devdigest/ui";
import type { FindingRecord, Severity } from "@devdigest/shared";
import {
  SEVERITIES,
  SeveritySummary,
  countBySeverity,
  totalFindings,
} from "@/components/severity-summary";
import { FindingCard } from "../FindingCard";
import { useFindingAction } from "../../../../../../../lib/hooks/reviews";
import { KEY_TO_ACTION } from "./constants";
import { visibleFindings } from "./helpers";
import { s } from "./styles";

const SEVERITY_LABEL_KEY: Record<Severity, string> = {
  CRITICAL: "critical",
  WARNING: "warning",
  SUGGESTION: "suggestion",
};

export function FindingsPanel({
  findings,
  prId,
  repoFullName,
  headSha,
}: {
  findings: FindingRecord[];
  prId: string;
  repoFullName?: string | null;
  headSha?: string | null;
}) {
  const t = useTranslations("prReview");
  const action = useFindingAction();
  const [hideLow, setHideLow] = React.useState(false);
  const [severityFilter, setSeverityFilter] = React.useState<Severity | null>(null);
  const [focusIdx, setFocusIdx] = React.useState(0);

  const afterToggle = React.useMemo(() => visibleFindings(findings, hideLow, null), [findings, hideLow]);
  const counts = React.useMemo(() => countBySeverity(afterToggle), [afterToggle]);
  // Derived, never stored: a filter on a severity with no visible findings is no filter.
  const activeFilter = severityFilter && counts[severityFilter] > 0 ? severityFilter : null;
  const shown = React.useMemo(
    () => visibleFindings(findings, hideLow, activeFilter),
    [findings, hideLow, activeFilter],
  );

  const toggleSeverity = (sev: Severity) => {
    setSeverityFilter((cur) => (cur === sev ? null : sev));
    setFocusIdx(0);
  };
  const onHideLow = (on: boolean) => {
    setHideLow(on);
    setFocusIdx(0);
  };

  // j/k navigation + a/d shortcuts on the focused finding (keyboard).
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "j") setFocusIdx((i) => Math.min(i + 1, shown.length - 1));
      else if (e.key === "k") setFocusIdx((i) => Math.max(i - 1, 0));
      else if (KEY_TO_ACTION[e.key] && shown[focusIdx]) {
        action.mutate({ findingId: shown[focusIdx]!.id, action: KEY_TO_ACTION[e.key]!, prId });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shown, focusIdx, action, prId]);

  const hasFindings = totalFindings(counts) > 0;

  return (
    <div>
      <div style={s.toolbar}>
        <div style={s.pillsRow}>
          {hasFindings && (
            <SeveritySummary variant="pills" counts={counts} ariaLabel={t("panel.severityCounts")} />
          )}
          <div style={s.toggleGroup}>
            {t("panel.hideLowConfidence")}
            <Toggle on={hideLow} onChange={onHideLow} size={16} />
          </div>
        </div>
        <div style={s.filterRow}>
          {SEVERITIES.map((sev) => (
            <Chip
              key={sev}
              icon={SEV[sev].icon}
              color={SEV[sev].c}
              active={activeFilter === sev}
              pressed={activeFilter === sev}
              disabled={counts[sev] === 0}
              onClick={() => toggleSeverity(sev)}
            >
              {t(`panel.severity.${SEVERITY_LABEL_KEY[sev]}`)}
            </Chip>
          ))}
        </div>
      </div>

      <div style={s.list}>
        {shown.length === 0 ? (
          <EmptyState icon="Filter" title={t("panel.noMatchTitle")} body={t("panel.noMatchBody")} />
        ) : (
          shown.map((f, i) => (
            <FindingCard
              key={f.id}
              f={f}
              focused={i === focusIdx}
              defaultExpanded={i === 0}
              pending={action.isPending}
              repoFullName={repoFullName}
              headSha={headSha}
              onAction={(act) => action.mutate({ findingId: f.id, action: act, prId })}
            />
          ))
        )}
      </div>
    </div>
  );
}
