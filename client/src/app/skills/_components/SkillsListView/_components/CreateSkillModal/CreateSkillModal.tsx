"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, FormField, Modal, Textarea } from "@devdigest/ui";
import { useCreateSkill } from "@/lib/hooks/skills";
import { SkillMetaFields, type SkillMeta } from "../../../SkillMetaFields";
import { isSkillMetaValid, skillErrorMessage } from "../../../../helpers";
import { EMPTY_META, MODAL_WIDTH } from "./constants";
import { s } from "./styles";

/** Create a manual skill, then open it in the editor (D11). */
export function CreateSkillModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const create = useCreateSkill();
  const [meta, setMeta] = React.useState<SkillMeta>(EMPTY_META);
  const [body, setBody] = React.useState(() => t("create.defaultBody"));

  const valid = isSkillMetaValid(meta) && body.trim() !== "";

  const submit = () =>
    create.mutate(
      { ...meta, description: meta.description.trim(), body, source: "manual", enabled: true },
      {
        onSuccess: (skill) => {
          onClose();
          router.push(`/skills/${skill.id}?tab=config`);
        },
      },
    );

  return (
    <Modal
      width={MODAL_WIDTH}
      title={t("create.title")}
      subtitle={t("create.subtitle")}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          {create.isError && (
            <span role="alert" style={s.error}>
              {skillErrorMessage(t, create.error)}
            </span>
          )}
          <Button kind="ghost" onClick={onClose}>
            {t("create.cancel")}
          </Button>
          <Button kind="primary" icon="Plus" onClick={submit} disabled={!valid || create.isPending}>
            {create.isPending ? t("create.creating") : t("create.create")}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        <SkillMetaFields value={meta} onChange={setMeta} />
        <FormField label={t("fields.body")} required>
          <Textarea aria-label={t("fields.body")} value={body} onChange={setBody} rows={8} mono />
        </FormField>
      </div>
    </Modal>
  );
}
