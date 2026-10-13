"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, ErrorState, FormField, Icon, Modal, SearchableSelect, Skeleton, Toggle } from "@devdigest/ui";
import { useAgents } from "@/lib/hooks/agents";
import { useConventionSkillDraft, useCreateConventionSkill } from "@/lib/hooks/conventions";
import { useToast } from "@/lib/toast";
import { SkillBodyEditor } from "@/features/skills/components/skill-body-editor";
import { SkillMetaFields, type SkillMeta } from "@/features/skills/components/skill-meta-fields";
import { isSkillMetaValid } from "@/features/skills/lib/skill-form";
import { estimateTokens } from "@/features/skills/lib/token-estimate";
import { conventionErrorMessage } from "../../../../helpers";
import { DRAFT_SKELETON_ROWS, MODAL_WIDTH } from "./constants";
import { s } from "./styles";

export interface CreateConventionSkillModalProps {
  repoId: string;
  /** `owner/name` for the "Merged from … in <repo>" line. */
  repoFullName: string;
  /** The accepted candidates on the page — what the skill is built from (the server re-checks). */
  acceptedIds: string[];
  onClose: () => void;
}

/**
 * "Create skill from conventions" (#41, #51, D18): the server's default draft
 * (name / description / type / body from the accepted candidates), every field
 * editable, an Enabled toggle, the agent the skill is linked to, and
 * Cancel / Create. An existing `repo-conventions` gets its next version.
 */
export function CreateConventionSkillModal({ repoId, repoFullName, acceptedIds, onClose }: CreateConventionSkillModalProps) {
  const t = useTranslations("conventions");
  const router = useRouter();
  const toast = useToast();
  const draft = useConventionSkillDraft(repoId, true);
  const { data: agents } = useAgents();
  const save = useCreateConventionSkill();
  // Edits sit on top of the draft: the draft is the default until a field is touched.
  const [metaEdit, setMetaEdit] = React.useState<SkillMeta | null>(null);
  const [bodyEdit, setBodyEdit] = React.useState<string | null>(null);
  const [enabled, setEnabled] = React.useState(true);
  const [agentId, setAgentId] = React.useState("");

  const d = draft.data;
  const meta: SkillMeta = metaEdit ?? { name: d?.name ?? "", description: d?.description ?? "", type: d?.type ?? "convention" };
  const body = bodyEdit ?? d?.body ?? "";
  const agentOptions = (agents ?? []).map((a) => ({ value: a.id, label: a.name }));
  const agentName = agents?.find((a) => a.id === agentId)?.name ?? "";
  const valid = !!d && isSkillMetaValid(meta) && body.trim() !== "" && agentId !== "" && acceptedIds.length > 0;

  const submit = () =>
    save.mutate(
      {
        repoId,
        body: {
          name: meta.name,
          description: meta.description.trim(),
          type: meta.type,
          enabled,
          body,
          agent_id: agentId,
          candidate_ids: acceptedIds,
        },
      },
      {
        onSuccess: (skill) => {
          toast.success(t("modal.saved", { name: skill.name, agent: agentName }));
          onClose();
          router.push(`/skills/${skill.id}?tab=preview`);
        },
      },
    );

  return (
    <Modal
      width={MODAL_WIDTH}
      title={t("modal.title")}
      subtitle={<span className="mono">{meta.name || d?.name || ""}</span>}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          {save.isError ? (
            <span role="alert" style={s.error}>
              {conventionErrorMessage(t, save.error)}
            </span>
          ) : (
            d && (
              <span style={s.note}>
                {d.existing
                  ? t("modal.savedAsVersion", { name: d.name, version: d.existing.version + 1 })
                  : t("modal.savedAsNew")}
              </span>
            )
          )}
          <Button kind="ghost" onClick={onClose}>
            {t("modal.cancel")}
          </Button>
          <Button kind="primary" icon="Sparkles" onClick={submit} loading={save.isPending} disabled={!valid}>
            {save.isPending ? t("modal.creating") : t("modal.create")}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        {draft.isLoading && DRAFT_SKELETON_ROWS.map((i) => <Skeleton key={i} height={44} style={{ marginBottom: 12 }} />)}
        {draft.isError && <ErrorState body={t("modal.loadError")} onRetry={() => draft.refetch()} />}
        {d && (
          <>
            <div style={s.info}>
              <Icon.Info size={15} style={s.infoIcon} />
              <span>{t("modal.mergedFrom", { count: acceptedIds.length, repo: repoFullName })}</span>
            </div>
            <SkillMetaFields value={meta} onChange={setMetaEdit} />
            <div style={s.row}>
              <FormField label={t("modal.enabled")} hint={t("modal.enabledHint")}>
                <div style={s.toggleRow}>
                  <Toggle on={enabled} onChange={setEnabled} label={t("modal.enabled")} />
                </div>
              </FormField>
              <FormField
                label={t("modal.agent")}
                required
                hint={agents && agents.length === 0 ? t("modal.noAgents") : t("modal.agentHint")}
              >
                <SearchableSelect
                  value={agentId}
                  onChange={setAgentId}
                  options={agentOptions}
                  placeholder={t("modal.agentPlaceholder")}
                  mono={false}
                />
              </FormField>
            </div>
            <FormField label={t("modal.body")} required>
              <SkillBodyEditor
                fileName={`${meta.name || d.name}.md`}
                value={body}
                onChange={setBodyEdit}
                dirty={body !== d.body}
                savedTokens={estimateTokens(d.body)}
              />
            </FormField>
          </>
        )}
      </div>
    </Modal>
  );
}
