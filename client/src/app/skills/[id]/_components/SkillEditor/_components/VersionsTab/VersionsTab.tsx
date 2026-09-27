"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, ErrorState, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useSkillVersions } from "@/lib/hooks/skills";
import { versionRows } from "./helpers";
import { s } from "./styles";

/** Versions tab: read-only `skill_versions` list, newest first; a click shows that version's raw body. */
export function VersionsTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const { data, isLoading, isError, refetch } = useSkillVersions(skill.id);
  const [selected, setSelected] = React.useState<number | null>(null);

  if (isLoading) return <Skeleton height={120} />;
  if (isError) return <ErrorState body={t("versions.loadError")} onRetry={() => refetch()} />;

  const rows = versionRows(data ?? []);
  const shown = rows.find((r) => r.version.version === selected)?.version;
  return (
    <div style={s.wrap}>
      <p style={s.hint}>{t("versions.hint")}</p>
      <ul style={s.list} aria-label={t("versions.title")}>
        {rows.map(({ version: v, metadataOnly }) => (
          <li key={v.version}>
            <button
              type="button"
              aria-pressed={selected === v.version}
              onClick={() => setSelected(v.version)}
              style={s.row(selected === v.version)}
            >
              <span className="mono" style={s.version}>
                {t("editor.version", { version: v.version })}
              </span>
              <span style={s.date}>{v.created_at.slice(0, 16).replace("T", " ")}</span>
              {v.version === skill.version && <Badge color="var(--accent-text)">{t("versions.current")}</Badge>}
              {metadataOnly && <Badge color="var(--text-muted)">{t("versions.metadataChange")}</Badge>}
            </button>
          </li>
        ))}
      </ul>
      {rows.length <= 1 && <p style={s.hint}>{t("versions.onlyCurrent")}</p>}
      {shown ? (
        <pre className="mono" aria-label={t("editor.version", { version: shown.version })} style={s.body}>
          {shown.body}
        </pre>
      ) : (
        rows.length > 0 && <p style={s.hint}>{t("versions.select")}</p>
      )}
    </div>
  );
}
