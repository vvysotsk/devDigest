"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { FormField, SelectInput, TextInput } from "@devdigest/ui";
import { SkillType, type SkillDraft } from "@devdigest/shared";
import { isValidSkillName } from "../../helpers";
import { s } from "./styles";

/** A skill's metadata as edited in a form (create modal, import draft, Config tab). */
export type SkillMeta = Pick<SkillDraft, "name" | "description" | "type">;

/**
 * Name* / Description* / Type — shared by CreateSkillModal, ImportSkillModal
 * (the editable draft) and the Config tab. The description caption tells the
 * author to write it as a directive (D15).
 */
export function SkillMetaFields({ value, onChange }: { value: SkillMeta; onChange: (next: SkillMeta) => void }) {
  const t = useTranslations("skills");
  const nameInvalid = value.name !== "" && !isValidSkillName(value.name);
  const typeOptions = SkillType.options.map((v) => ({ value: v, label: t(`listItem.type.${v}`) }));
  return (
    <>
      <FormField label={t("fields.name")} required hint={nameInvalid ? <span style={s.error}>{t("fields.nameInvalid")}</span> : undefined}>
        <TextInput
          aria-label={t("fields.name")}
          value={value.name}
          onChange={(name) => onChange({ ...value, name })}
          placeholder={t("fields.namePlaceholder")}
          mono
        />
      </FormField>
      <FormField label={t("fields.description")} required hint={t("fields.descriptionCaption")}>
        <TextInput
          aria-label={t("fields.description")}
          value={value.description}
          onChange={(description) => onChange({ ...value, description })}
        />
      </FormField>
      <FormField label={t("fields.type")}>
        <SelectInput value={value.type} onChange={(v) => onChange({ ...value, type: v as SkillType })} options={typeOptions} />
      </FormField>
    </>
  );
}
