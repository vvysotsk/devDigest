"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon } from "@devdigest/ui";
import { estimateTokens } from "../../lib/token-estimate";
import { LINE_HEIGHT, MIN_ROWS, PAD_Y } from "./constants";
import { s } from "./styles";

/**
 * The skill body as a file editor (D15): `<name>.md` header, "unsaved" chip,
 * token count, line-number gutter, mono textarea. The count is the server's
 * cl100k `body_tokens` while the body is saved, and a live ≈ chars/4 estimate
 * while it is dirty (D7).
 *
 * Only the frame scrolls. The textarea gets an explicit height (`rows` lines
 * + padding) and a min-width of its longest line, so it never scrolls
 * internally and its lines stay level with the gutter. `rows` alone is not
 * enough: the frame is a one-line flex row capped by max-height, and a
 * stretched item takes the capped line height (Flexbox §9.4), so the frame
 * aligns items to flex-start. The gutter is sticky on the x axis, and
 * `onScroll` resets any internal scroll a browser still attempts.
 */
export function SkillBodyEditor({
  fileName,
  value,
  onChange,
  dirty,
  savedTokens,
}: {
  fileName: string;
  value: string;
  onChange: (v: string) => void;
  dirty: boolean;
  savedTokens: number;
}) {
  const t = useTranslations("skills");
  const lines = value.split("\n");
  const rows = Math.max(lines.length, MIN_ROWS);
  const gutter = Array.from({ length: rows }, (_, i) => i + 1);
  // Longest line in character cells (a tab counts as 8, the default tab-size),
  // +2 cells for the caret; 24px = the textarea's horizontal padding.
  const longest = lines.reduce((max, l) => Math.max(max, l.length + 7 * (l.split("\t").length - 1)), 0);
  const size = {
    height: rows * LINE_HEIGHT + 2 * PAD_Y,
    minWidth: `calc(${longest + 2}ch + 24px)`,
  };
  return (
    <div style={s.frame}>
      <div style={s.header}>
        <Icon.FileText size={13} style={s.fileIcon} />
        <span className="mono" style={s.fileName}>
          {fileName}
        </span>
        {dirty && (
          <Badge color="var(--warn)" bg="var(--warn-bg)">
            {t("body.unsaved")}
          </Badge>
        )}
        <span className="mono tnum" style={s.tokens}>
          {dirty
            ? t("body.tokensEstimate", { count: estimateTokens(value) })
            : t("body.tokens", { count: savedTokens })}
        </span>
      </div>
      <div style={s.scroll}>
        <div aria-hidden className="mono" style={s.gutter}>
          {gutter.map((n) => (
            <div key={n}>{n}</div>
          ))}
        </div>
        <textarea
          aria-label={t("body.ariaLabel")}
          className="mono"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={(e) => {
            e.currentTarget.scrollTop = 0;
            e.currentTarget.scrollLeft = 0;
          }}
          rows={rows}
          wrap="off"
          spellCheck={false}
          style={{ ...s.textarea, ...size }}
        />
      </div>
    </div>
  );
}
