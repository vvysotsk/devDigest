"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, ErrorState, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useSkillVersions, useUpdateSkill } from "@/features/skills/hooks";
import { useToast } from "@/lib/toast";
import { skillErrorMessage } from "@/features/skills/lib/skill-errors";
import { lineDiff, versionRows } from "./helpers";
import { s } from "./styles";

type View = { version: number; mode: "body" | "diff" };

const DIFF_PREFIX = { same: "  ", add: "+ ", del: "- " } as const;

/**
 * Versioning tab: `skill_versions` newest first. A row click shows that
 * version's raw body. Every older version has "Diff" (a line diff against the
 * current body) and "Restore" (`PUT /skills/:id {body}`, which saves the old
 * body as a NEW version — history is never rewritten). Restore is disabled
 * when the old body already equals the current one.
 */
export function VersionsTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const toast = useToast();
  const { data, isLoading, isError, refetch } = useSkillVersions(skill.id);
  const update = useUpdateSkill();
  const [view, setView] = React.useState<View | null>(null);

  if (isLoading) return <Skeleton height={120} />;
  if (isError) return <ErrorState body={t("versions.loadError")} onRetry={() => refetch()} />;

  const rows = versionRows(data ?? []);
  const shown = view ? rows.find((r) => r.version.version === view.version)?.version : undefined;
  const restore = (version: number, body: string) =>
    update.mutate(
      { id: skill.id, patch: { body } },
      {
        onSuccess: (saved) => {
          setView(null);
          toast.success(t("versions.restoredToast", { from: version, version: saved.version }));
        },
      },
    );

  return (
    <div style={s.wrap}>
      <p style={s.hint}>{t("versions.hint")}</p>
      <ul style={s.list} aria-label={t("versions.title")}>
        {rows.map(({ version: v, metadataOnly }) => {
          const current = v.version === skill.version;
          const label = t("editor.version", { version: v.version });
          return (
            <li key={v.version} style={s.item}>
              <button
                type="button"
                aria-pressed={view?.version === v.version && view.mode === "body"}
                onClick={() => setView({ version: v.version, mode: "body" })}
                style={s.row(view?.version === v.version)}
              >
                <span className="mono" style={s.version}>
                  {label}
                </span>
                <span style={s.date}>{v.created_at.slice(0, 16).replace("T", " ")}</span>
                {current && <Badge color="var(--accent-text)">{t("versions.current")}</Badge>}
                {metadataOnly && <Badge color="var(--text-muted)">{t("versions.metadataChange")}</Badge>}
              </button>
              {!current && (
                <>
                  <Button
                    kind="ghost"
                    size="sm"
                    icon="Code"
                    aria-label={t("versions.diffLabel", { version: v.version })}
                    onClick={() => setView({ version: v.version, mode: "diff" })}
                  >
                    {t("versions.diff")}
                  </Button>
                  <Button
                    kind="ghost"
                    size="sm"
                    icon="History"
                    aria-label={t("versions.restoreLabel", { version: v.version })}
                    disabled={update.isPending || v.body === skill.body}
                    onClick={() => restore(v.version, v.body)}
                  >
                    {t("versions.restore")}
                  </Button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {update.isError && (
        <p role="alert" style={s.error}>
          {skillErrorMessage(t, update.error)}
        </p>
      )}
      {rows.length <= 1 && <p style={s.hint}>{t("versions.onlyCurrent")}</p>}
      {shown && view?.mode === "diff" ? (
        <div>
          <p style={s.hint}>{t("versions.diffTitle", { from: shown.version, to: skill.version })}</p>
          {shown.body === skill.body ? (
            <p style={s.hint}>{t("versions.noDiff")}</p>
          ) : (
            <pre
              className="mono"
              aria-label={t("versions.diffLabel", { version: shown.version })}
              style={s.body}
            >
              {lineDiff(shown.body, skill.body).map((line, i) => (
                <div key={i} data-kind={line.kind} style={s.diffLine(line.kind)}>
                  {DIFF_PREFIX[line.kind] + line.text}
                </div>
              ))}
            </pre>
          )}
        </div>
      ) : shown ? (
        <pre className="mono" aria-label={t("editor.version", { version: shown.version })} style={s.body}>
          {shown.body}
        </pre>
      ) : (
        rows.length > 0 && <p style={s.hint}>{t("versions.select")}</p>
      )}
    </div>
  );
}
