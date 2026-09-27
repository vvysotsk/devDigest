"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, SectionLabel } from "@devdigest/ui";
import type { SkillImportPreview } from "@devdigest/shared";
import { s } from "./styles";

/**
 * Read-only part of the import preview: the RAW SKILL.md (never rendered —
 * HTML comments would vanish yet still reach the prompt, D4), every warning,
 * the file table and the trust notice.
 */
export function ImportPreviewDetails({ preview }: { preview: SkillImportPreview }) {
  const t = useTranslations("skills");
  return (
    <>
      <section style={s.section} aria-label={t("import.rawSource")}>
        <SectionLabel>{t("import.rawSource")}</SectionLabel>
        <pre className="mono" style={s.raw}>
          {preview.raw_source}
        </pre>
      </section>

      <section style={s.section} aria-label={t("import.warnings")}>
        <SectionLabel>{t("import.warnings")}</SectionLabel>
        {preview.warnings.length === 0 ? (
          <p style={s.muted}>{t("import.noWarnings")}</p>
        ) : (
          <ul style={s.list}>
            {preview.warnings.map((w, i) => (
              <li key={`${w.kind}-${w.line ?? "x"}-${i}`} style={s.warning}>
                <Icon.AlertTriangle size={13} style={s.warnIcon} />
                <strong>{t(`import.warningKind.${w.kind}`)}</strong>
                {w.line != null && <span style={s.muted}>{t("import.warningLine", { line: w.line })}</span>}
                <span>{w.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={s.section} aria-label={t("import.files")}>
        <SectionLabel>{t("import.files")}</SectionLabel>
        <table style={s.table}>
          <tbody>
            {preview.files.map((f) => (
              <tr key={f.path}>
                <td className="mono" style={s.cell}>
                  {f.path}
                </td>
                <td style={s.cell}>
                  <span style={s.status(f.status)}>{t(`import.fileStatus.${f.status}`)}</span>
                </td>
                <td style={s.cellMuted}>{f.reason}</td>
                <td style={s.cellSize}>{t("import.size", { size: f.size })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p role="note" style={s.trust}>
        <Icon.Shield size={14} style={s.trustIcon} />
        {t("import.trust")}
      </p>
    </>
  );
}
