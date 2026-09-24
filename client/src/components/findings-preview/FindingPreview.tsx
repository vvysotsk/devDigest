/* FindingPreview — one READ-ONLY finding: severity icon, title, category,
   file:line, confidence and a two-line rationale. No actions — accept/dismiss
   live on the FindingCard in the PR page's Review runs section. Used by the
   hover popover (PR list, timeline) and the trace drawer. */
import React from "react";
import {
  SeverityBadge,
  CategoryTag,
  ConfidenceNum,
  type Severity as UiSeverity,
  type Category,
} from "@devdigest/ui";
import type { FindingRecord } from "@devdigest/shared";
import { lineLabel } from "./helpers";
import { s } from "./styles";

export function FindingPreview({ f }: { f: FindingRecord }) {
  return (
    <div data-finding-preview={f.id} style={s.item}>
      <div style={s.itemHead}>
        <SeverityBadge severity={f.severity as UiSeverity} compact />
        <span style={s.itemTitle}>{f.title}</span>
        <span style={s.itemCategory}>
          <CategoryTag category={f.category as Category} />
        </span>
      </div>
      <div style={s.itemMeta}>
        <span className="mono" style={s.itemPath} title={`${f.file}:${lineLabel(f)}`}>
          {f.file}:{lineLabel(f)}
        </span>
        <span style={s.itemConfidence}>
          <ConfidenceNum value={f.confidence} />
        </span>
      </div>
      {f.rationale && <div style={s.itemBody}>{f.rationale}</div>}
    </div>
  );
}
