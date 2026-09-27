"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, FormField, Modal, SectionLabel } from "@devdigest/ui";
import type { SkillImportRequest } from "@devdigest/shared";
import { useImportPreview, useImportSkill } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { SkillMetaFields, type SkillMeta } from "../../../SkillMetaFields";
import { isSkillMetaValid, skillErrorMessage } from "../../../../helpers";
import { ImportPreviewDetails } from "./_components/ImportPreviewDetails";
import { ACCEPT_ATTR, MODAL_WIDTH } from "./constants";
import { checkUpload, importOverrides, readFileAsBase64 } from "./helpers";
import { s } from "./styles";

/**
 * Import a skill from a .md / .zip (D3): the file goes to
 * `POST /skills/import/preview` (stores nothing); the user reviews the raw text,
 * warnings and file table, edits the draft metadata, and "Save skill" re-sends
 * the FILE plus overrides to `POST /skills/import` — never a body.
 */
export function ImportSkillModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const toast = useToast();
  const preview = useImportPreview();
  const save = useImportSkill();
  const [upload, setUpload] = React.useState<SkillImportRequest | null>(null);
  const [meta, setMeta] = React.useState<SkillMeta | null>(null);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [reading, setReading] = React.useState(false);

  const onFile = async (file: File | undefined) => {
    preview.reset();
    save.reset();
    setUpload(null);
    setMeta(null);
    setLocalError(null);
    if (!file) return;
    const code = checkUpload(file);
    if (code) return setLocalError(t(`errors.${code}`));
    setReading(true);
    try {
      const req = { filename: file.name, content_base64: await readFileAsBase64(file) };
      setUpload(req);
      preview.mutate(req, {
        onSuccess: ({ draft }) => setMeta({ name: draft.name, description: draft.description, type: draft.type }),
      });
    } catch {
      setLocalError(t("errors.readFailed"));
    } finally {
      setReading(false);
    }
  };

  const data = preview.data;
  const canSave = !!upload && !!data && !!meta && isSkillMetaValid(meta) && !save.isPending;
  const submit = () => {
    if (!upload || !data || !meta) return;
    save.mutate(
      { ...upload, ...importOverrides(data.draft, meta) },
      {
        onSuccess: (skill) => {
          toast.success(t("import.saved", { name: skill.name }));
          onClose();
          router.push(`/skills/${skill.id}?tab=config`);
        },
      },
    );
  };

  const error = localError ?? (preview.isError ? skillErrorMessage(t, preview.error) : null);

  return (
    <Modal
      width={MODAL_WIDTH}
      title={t("import.title")}
      subtitle={t("import.subtitle")}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          {save.isError && (
            <span role="alert" style={s.error}>
              {skillErrorMessage(t, save.error)}
            </span>
          )}
          <Button kind="ghost" onClick={onClose}>
            {t("import.cancel")}
          </Button>
          <Button kind="primary" icon="Upload" onClick={submit} disabled={!canSave}>
            {save.isPending ? t("import.saving") : t("import.save")}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        <FormField label={t("import.fileLabel")}>
          <input
            type="file"
            aria-label={t("import.fileLabel")}
            accept={ACCEPT_ATTR}
            onChange={(e) => void onFile(e.target.files?.[0])}
            style={s.file}
          />
        </FormField>
        {(reading || preview.isPending) && <p style={s.muted}>{t("import.reading")}</p>}
        {error && (
          <p role="alert" style={s.error}>
            {error}
          </p>
        )}
        {data && meta && (
          <>
            <SectionLabel>{t("import.draft")}</SectionLabel>
            <SkillMetaFields value={meta} onChange={setMeta} />
            <ImportPreviewDetails preview={data} />
          </>
        )}
      </div>
    </Modal>
  );
}
