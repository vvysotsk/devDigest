"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, FormField } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useUpdateSkill } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { isSkillMetaValid, skillErrorMessage } from "@/app/skills/helpers";
import { SkillMetaFields, type SkillMeta } from "@/app/skills/_components/SkillMetaFields";
import { SkillEnabledToggle } from "@/app/skills/_components/SkillEnabledToggle";
import { SkillBodyEditor } from "./_components/SkillBodyEditor";
import { DeleteSkillConfirm } from "./_components/DeleteSkillConfirm";
import { skillPatch } from "./helpers";
import { s } from "./styles";

/**
 * Config tab (D15): name / description / type / body edit a LOCAL draft; one
 * "Save skill" sends only the changed fields (one version bump). The Enabled
 * switch writes immediately (no bump, D5). Mounted with `key={skill.id}`, so
 * switching skills resets the draft.
 */
export function ConfigTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const toast = useToast();
  const update = useUpdateSkill();
  const [meta, setMeta] = React.useState<SkillMeta>({
    name: skill.name,
    description: skill.description,
    type: skill.type,
  });
  const [body, setBody] = React.useState(skill.body);
  const [deleting, setDeleting] = React.useState(false);

  const patch = skillPatch(skill, { ...meta, body });
  const dirty = Object.keys(patch).length > 0;
  const bodyDirty = body !== skill.body;
  const valid = isSkillMetaValid(meta) && body.trim() !== "";

  const save = () =>
    update.mutate(
      { id: skill.id, patch },
      { onSuccess: (data) => toast.success(t("config.savedToast", { version: data.version })) },
    );

  return (
    <div style={s.wrap}>
      {deleting && <DeleteSkillConfirm skill={skill} onClose={() => setDeleting(false)} />}
      <div style={s.header}>
        <h2 style={s.h2}>{t("config.title")}</h2>
        <Badge mono>{t("editor.version", { version: skill.version })}</Badge>
        {/* Not a <label>: the toggle may open a dialog, whose clicks a label would forward to the switch. */}
        <div style={s.enabledLabel}>
          {t("config.enabled")}
          <SkillEnabledToggle skill={skill} size={16} />
        </div>
      </div>
      <SkillMetaFields value={meta} onChange={setMeta} />
      <FormField label={t("fields.body")} required>
        <SkillBodyEditor
          fileName={`${meta.name || skill.name}.md`}
          value={body}
          onChange={setBody}
          dirty={bodyDirty}
          savedTokens={skill.body_tokens}
        />
      </FormField>
      <div style={s.actions}>
        <Button kind="primary" icon="Check" onClick={save} disabled={!dirty || !valid || update.isPending}>
          {update.isPending ? t("config.saving") : t("config.save")}
        </Button>
        {update.isSuccess && !dirty && (
          <span role="status" style={s.savedNote}>
            {t("config.saved", { version: update.data.version })}
          </span>
        )}
        {update.isError && (
          <span role="alert" style={s.error}>
            {skillErrorMessage(t, update.error)}
          </span>
        )}
        <Button kind="ghost" icon="Trash" onClick={() => setDeleting(true)} style={s.delete}>
          {t("config.delete")}
        </Button>
      </div>
    </div>
  );
}
