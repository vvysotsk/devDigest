"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, FormField, MonoLink, ProgressBar, SelectInput, TextInput } from "@devdigest/ui";
import { ConventionCategory, type ConventionCandidate, type ConventionPatch } from "@devdigest/shared";
import { githubBlobUrl } from "@/lib/github-urls";
import { evidenceLabel, formatConfidence } from "../../../../helpers";
import { s } from "./styles";

export interface CandidateCardProps {
  candidate: ConventionCandidate;
  /** `owner/name` of the repo; null before the repos list has loaded (then the evidence is plain text). */
  repoFullName: string | null;
  /** The scan's head sha: the evidence link opens the file at exactly that commit (K5). */
  headSha: string;
  /** A patch of any card is in flight: the buttons wait for it. */
  pending: boolean;
  onPatch: (id: string, patch: ConventionPatch) => void;
}

/**
 * One convention candidate (#46, #47, #49): the rule, its category, the
 * evidence `path:line` linking to GitHub at the scan's sha, the snippet read
 * from the clone, the confidence, and Accept (toggles back to pending) /
 * Reject / Edit (rule + category in place).
 */
export function CandidateCard({ candidate, repoFullName, headSha, pending, onPatch }: CandidateCardProps) {
  const t = useTranslations("conventions");
  const [editing, setEditing] = React.useState(false);
  const [rule, setRule] = React.useState(candidate.rule);
  const [category, setCategory] = React.useState(candidate.category);
  const accepted = candidate.status === "accepted";
  const label = evidenceLabel(candidate);
  const href = repoFullName
    ? githubBlobUrl(repoFullName, headSha, candidate.evidence_path, candidate.evidence_line)
    : undefined;
  const categoryOptions = ConventionCategory.options.map((v) => ({ value: v, label: t(`category.${v}`) }));

  const startEdit = () => {
    setRule(candidate.rule);
    setCategory(candidate.category);
    setEditing(true);
  };
  const save = () => {
    onPatch(candidate.id, { rule: rule.trim(), category });
    setEditing(false);
  };

  return (
    <div
      role="listitem"
      aria-label={candidate.rule}
      style={{ ...s.card, borderLeftColor: accepted ? "var(--ok)" : "var(--border-strong)" }}
    >
      <div style={s.main}>
        {editing ? (
          <div style={s.editForm}>
            <FormField label={t("card.ruleLabel")} required>
              <TextInput aria-label={t("card.ruleLabel")} value={rule} onChange={setRule} />
            </FormField>
            <FormField label={t("card.categoryLabel")}>
              <SelectInput
                value={category}
                onChange={(v) => setCategory(v as ConventionCategory)}
                options={categoryOptions}
              />
            </FormField>
            <div style={s.editActions}>
              <Button kind="primary" size="sm" icon="Check" onClick={save} disabled={rule.trim() === "" || pending}>
                {t("card.save")}
              </Button>
              <Button kind="ghost" size="sm" onClick={() => setEditing(false)}>
                {t("card.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div style={s.titleRow}>
              <span style={s.rule}>{candidate.rule}</span>
              <Badge>{t(`category.${candidate.category}`)}</Badge>
            </div>
            <div style={s.evidence}>
              {href ? (
                <MonoLink href={href}>{label}</MonoLink>
              ) : (
                <span className="mono">{label}</span>
              )}
            </div>
            <pre className="mono" style={s.snippet}>
              {candidate.evidence_snippet}
            </pre>
            <div style={s.confidenceRow}>
              <span>{t("card.confidence")}</span>
              <div style={s.bar}>
                <ProgressBar value={candidate.confidence * 100} color="var(--ok)" />
              </div>
              <span className="mono tnum" style={s.pct}>
                {formatConfidence(candidate.confidence)}
              </span>
            </div>
          </>
        )}
      </div>
      {!editing && (
        <div style={s.actions}>
          <Button
            kind={accepted ? "primary" : "secondary"}
            size="sm"
            icon="Check"
            disabled={pending}
            onClick={() => onPatch(candidate.id, { status: accepted ? "pending" : "accepted" })}
          >
            {accepted ? t("card.accepted") : t("card.accept")}
          </Button>
          <Button kind="ghost" size="sm" icon="X" disabled={pending} onClick={() => onPatch(candidate.id, { status: "rejected" })}>
            {t("card.reject")}
          </Button>
          <Button kind="ghost" size="sm" icon="Edit" disabled={pending} onClick={startEdit}>
            {t("card.edit")}
          </Button>
        </div>
      )}
    </div>
  );
}
