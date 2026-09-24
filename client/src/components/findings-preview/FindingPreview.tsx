/* FindingPreview — one READ-ONLY finding: severity icon, title, category,
   file:line, confidence and the rationale. No actions — accept/dismiss live
   on the FindingCard in the PR page's Review runs section. Compact (default)
   clamps the rationale to two lines for hover popovers; `full` shows the whole
   rationale plus the suggestion (trace drawer). */
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

export function FindingPreview({
  f,
  full = false,
  suggestionLabel,
}: {
  f: FindingRecord;
  /** Whole rationale (no line clamp) + suggestion. */
  full?: boolean;
  /** Label above the suggestion in `full` mode (i18n'd by the caller). */
  suggestionLabel?: string;
}) {
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
      {f.rationale && <div style={full ? s.itemBodyFull : s.itemBody}>{f.rationale}</div>}
      {full && f.suggestion && (
        <div style={s.itemSuggestion}>
          {suggestionLabel && <span style={s.itemSuggestionLabel}>{suggestionLabel} </span>}
          {f.suggestion}
        </div>
      )}
    </div>
  );
}
