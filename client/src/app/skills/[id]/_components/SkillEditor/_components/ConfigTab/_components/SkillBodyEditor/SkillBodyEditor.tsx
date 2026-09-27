"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon } from "@devdigest/ui";
import { estimateTokens } from "@/app/skills/helpers";
import { MIN_ROWS } from "./constants";
import { s } from "./styles";

/**
 * The skill body as a file editor (D15): `<name>.md` header, "unsaved" chip,
 * token count, line-number gutter, mono textarea. The count is the server's
 * cl100k `body_tokens` while the body is saved, and a live ≈ chars/4 estimate
 * while it is dirty (D7). Lines never wrap, so the gutter stays aligned; the
 * frame scrolls, the textarea grows with its content.
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
  const lineCount = value.split("\n").length;
  const gutter = Array.from({ length: Math.max(lineCount, MIN_ROWS) }, (_, i) => i + 1);
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
          rows={Math.max(lineCount, MIN_ROWS)}
          wrap="off"
          spellCheck={false}
          style={s.textarea}
        />
      </div>
    </div>
  );
}
