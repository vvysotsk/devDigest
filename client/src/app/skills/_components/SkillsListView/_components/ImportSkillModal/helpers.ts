import { SKILL_IMPORT_MAX_BYTES, type SkillDraft, type SkillErrorCode, type SkillImportSave } from "@devdigest/shared";
import { ACCEPTED_EXTENSIONS } from "./constants";

/** Client-side pre-check mirroring the server's first two import errors; null = send it. */
export function checkUpload(file: { name: string; size: number }): SkillErrorCode | null {
  const lower = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) return "import_unsupported_file";
  if (file.size > SKILL_IMPORT_MAX_BYTES) return "import_too_large";
  return null;
}

/** Client-side pre-check of a URL import (D21): only "looks like https://"; every other rule is the server's. */
export function isHttpsUrl(url: string): boolean {
  return /^https:\/\/\S+$/i.test(url);
}

/** Read a File as base64 (the data-URL payload without its `data:…;base64,` prefix). */
export function readFileAsBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? "");
      resolve(url.slice(url.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

/**
 * The overrides of a save (D3): only the fields the user changed from the
 * parsed draft, trimmed, never empty. The body is never sent — the server
 * always stores the body it parses from the file itself.
 */
export function importOverrides(
  draft: Pick<SkillDraft, "name" | "description" | "type">,
  edited: Pick<SkillDraft, "name" | "description" | "type">,
): Pick<SkillImportSave, "name" | "description" | "type"> {
  const out: Pick<SkillImportSave, "name" | "description" | "type"> = {};
  const name = edited.name.trim();
  const description = edited.description.trim();
  if (name !== "" && name !== draft.name) out.name = name;
  if (description !== "" && description !== draft.description.trim()) out.description = description;
  if (edited.type !== draft.type) out.type = edited.type;
  return out;
}
