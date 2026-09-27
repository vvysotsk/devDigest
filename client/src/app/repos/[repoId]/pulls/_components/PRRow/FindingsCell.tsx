/* FindingsCell — the PR list's FINDINGS column: per-severity icon+count of the
   latest review batch (server-computed), plus a read-only hover popover with
   the batch's findings. The findings themselves are fetched lazily: only once
   the pointer has settled on the cell for HOVER_INTENT_MS (or on keyboard
   focus) — a quick sweep down the list opens nothing and requests nothing. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { PrMeta } from "@/lib/types";
import { usePrReviews } from "@/features/reviews/hooks";
import { SeveritySummary } from "@/features/reviews/components/severity-summary";
import { totalFindings } from "@/features/reviews/lib/severity";
import { FindingsHoverCard } from "@/features/reviews/components/findings-preview";
import { s } from "../../styles";

export const HOVER_INTENT_MS = 180;

export function FindingsCell({ pr }: { pr: PrMeta }) {
  const t = useTranslations("prReview");
  const batch = pr.latest_batch ?? null;
  const counts = batch?.findings_by_severity ?? null;
  const total = counts ? totalFindings(counts) : 0;

  // Flips to true the first time the popover actually opens; never back.
  const [wanted, setWanted] = React.useState(false);
  const reviews = usePrReviews(pr.id ?? null, { enabled: wanted });

  const findings = React.useMemo(() => {
    if (!batch || !reviews.data) return [];
    const ids = new Set(batch.run_ids);
    return reviews.data.filter((r) => r.run_id && ids.has(r.run_id)).flatMap((r) => r.findings);
  }, [batch, reviews.data]);

  if (!counts || total === 0) {
    return (
      <div style={s.findingsCell}>
        <span style={s.muted}>—</span>
      </div>
    );
  }

  return (
    <div style={s.findingsCell}>
      <FindingsHoverCard
        title={t("findingsPopover.titleInRun", { count: total })}
        findings={findings}
        loading={wanted && !reviews.data && !reviews.isError}
        loadingText={t("findingsPopover.loading")}
        emptyText={t("findingsPopover.empty")}
        errorText={reviews.isError ? t("findingsPopover.error") : undefined}
        openDelayMs={HOVER_INTENT_MS}
        onOpen={() => setWanted(true)}
      >
        <SeveritySummary variant="icons" counts={counts} />
      </FindingsHoverCard>
    </div>
  );
}
