"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, FormField, Modal, SectionLabel, TextInput } from "@devdigest/ui";
import type { Skill, SkillImportPreview, SkillImportRequest, SkillImportUrlRequest } from "@devdigest/shared";
import { useImportPreview, useImportSkill, useImportUrlPreview, useImportUrlSkill } from "@/features/skills/hooks";
import { useToast } from "@/lib/toast";
import { SkillMetaFields, type SkillMeta } from "@/features/skills/components/skill-meta-fields";
import { isSkillMetaValid } from "@/features/skills/lib/skill-form";
import { skillErrorMessage } from "@/features/skills/lib/skill-errors";
import { ImportPreviewDetails } from "./_components/ImportPreviewDetails";
import { ACCEPT_ATTR, MODAL_WIDTH } from "./constants";
import { checkUpload, importOverrides, isHttpsUrl, readFileAsBase64 } from "./helpers";
import { s } from "./styles";

/** Where the skill text comes from: an uploaded file (L02 D3) or a URL the server fetches (HW02 D21). */
export type ImportSource = "file" | "url";

/**
 * Import a skill from a .md / .zip file (D3) or from an https URL (D21): the
 * source goes to the matching preview route (stores nothing); the user reviews
 * the raw text, warnings and file table, edits the draft metadata, and "Save
 * skill" re-sends the SOURCE plus overrides — never a body. A URL save also
 * carries the preview's `sha256`, so a file that changed in between is refused.
 */
export function ImportSkillModal({ source = "file", onClose }: { source?: ImportSource; onClose: () => void }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const toast = useToast();
  const isUrl = source === "url";
  const previewFile = useImportPreview();
  const saveFile = useImportSkill();
  const previewUrl = useImportUrlPreview();
  const saveUrl = useImportUrlSkill();
  const [upload, setUpload] = React.useState<SkillImportRequest | null>(null);
  const [url, setUrl] = React.useState("");
  const [urlReq, setUrlReq] = React.useState<SkillImportUrlRequest | null>(null);
  const [meta, setMeta] = React.useState<SkillMeta | null>(null);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [reading, setReading] = React.useState(false);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);

  const resetAll = () => {
    previewFile.reset();
    previewUrl.reset();
    saveFile.reset();
    saveUrl.reset();
    setUpload(null);
    setUrlReq(null);
    setMeta(null);
    setLocalError(null);
  };
  const metaFrom = ({ draft }: SkillImportPreview) =>
    setMeta({ name: draft.name, description: draft.description, type: draft.type });

  const onFile = async (file: File | undefined) => {
    resetAll();
    setFileName(file?.name ?? null);
    if (!file) return;
    const code = checkUpload(file);
    if (code) return setLocalError(t(`errors.${code}`));
    setReading(true);
    try {
      const req = { filename: file.name, content_base64: await readFileAsBase64(file) };
      setUpload(req);
      previewFile.mutate(req, { onSuccess: metaFrom });
    } catch {
      setLocalError(t("errors.readFailed"));
    } finally {
      setReading(false);
    }
  };

  const onFetchUrl = () => {
    resetAll();
    const trimmed = url.trim();
    // Cheap pre-check only (like checkUpload); every other rule is the server's.
    if (!isHttpsUrl(trimmed)) return setLocalError(t("errors.import_url_not_https"));
    const req = { url: trimmed };
    setUrlReq(req);
    previewUrl.mutate(req, { onSuccess: metaFrom });
  };

  // One view over whichever pair of hooks this modal drives.
  const preview = isUrl
    ? { isPending: previewUrl.isPending, isError: previewUrl.isError, error: previewUrl.error, data: previewUrl.data as SkillImportPreview | undefined }
    : { isPending: previewFile.isPending, isError: previewFile.isError, error: previewFile.error, data: previewFile.data };
  const save = isUrl
    ? { isPending: saveUrl.isPending, isError: saveUrl.isError, error: saveUrl.error }
    : { isPending: saveFile.isPending, isError: saveFile.isError, error: saveFile.error };
  const data = preview.data;
  // Save only after a preview has loaded for the chosen source — the preview is
  // the trust point (raw text + warnings) the user has to see first.
  const hasSource = isUrl ? !!urlReq : !!upload;
  const canSave = hasSource && !!data && !!meta && isSkillMetaValid(meta) && !save.isPending;

  const submit = () => {
    if (!data || !meta) return;
    const onSuccess = (skill: Skill) => {
      toast.success(isUrl ? t("url.success", { name: skill.name }) : t("import.saved", { name: skill.name }));
      onClose();
      router.push(`/skills/${skill.id}?tab=config`);
    };
    const overrides = importOverrides(data.draft, meta);
    if (isUrl) {
      if (!urlReq || !previewUrl.data) return;
      saveUrl.mutate({ ...urlReq, sha256: previewUrl.data.sha256, ...overrides }, { onSuccess });
    } else {
      if (!upload) return;
      saveFile.mutate({ ...upload, ...overrides }, { onSuccess });
    }
  };

  const error = localError ?? (preview.isError ? skillErrorMessage(t, preview.error) : null);

  return (
    <Modal
      width={MODAL_WIDTH}
      title={isUrl ? t("url.import") : t("import.title")}
      subtitle={isUrl ? t("url.hint") : t("import.subtitle")}
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
        {isUrl ? (
          <FormField label={t("url.label")}>
            <div style={s.fileRow}>
              <div style={s.urlInput}>
                <TextInput
                  aria-label={t("url.label")}
                  value={url}
                  onChange={setUrl}
                  placeholder={t("url.placeholder")}
                  mono
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onFetchUrl();
                  }}
                />
              </div>
              <Button icon="Link" onClick={onFetchUrl} loading={previewUrl.isPending} disabled={url.trim() === ""}>
                {t("import.fetchPreview")}
              </Button>
            </div>
          </FormField>
        ) : (
          <FormField label={t("import.fileLabel")}>
            <div style={s.fileRow}>
              {/* Native input kept for a11y and tests, visually replaced by a kit Button. */}
              <input
                ref={fileInput}
                type="file"
                aria-label={t("import.fileLabel")}
                accept={ACCEPT_ATTR}
                onChange={(e) => void onFile(e.target.files?.[0])}
                style={s.hiddenInput}
                tabIndex={-1}
              />
              <Button icon="Upload" onClick={() => fileInput.current?.click()}>
                {t("import.chooseFile")}
              </Button>
              <span className="mono" style={s.fileName}>
                {fileName ?? t("import.noFile")}
              </span>
            </div>
          </FormField>
        )}
        {(reading || preview.isPending) && <p style={s.muted}>{isUrl ? t("url.fetching") : t("import.reading")}</p>}
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
