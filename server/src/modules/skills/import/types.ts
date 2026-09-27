import type { SkillErrorCode } from '@devdigest/shared';

/** A pipeline failure; the import routes map `code` to the error envelope. */
export type ImportFailure = {
  ok: false;
  code: SkillErrorCode;
  message: string;
  details?: unknown;
};

export type ImportResult<T> = ({ ok: true } & T) | ImportFailure;

export const fail = (code: SkillErrorCode, message: string, details?: unknown): ImportFailure =>
  details === undefined ? { ok: false, code, message } : { ok: false, code, message, details };

/** D3 archive limits (the upload itself is capped by SKILL_IMPORT_MAX_BYTES). */
export const ZIP_MAX_ENTRIES = 200;
export const ZIP_MAX_UNCOMPRESSED_BYTES = 1024 * 1024;
/** D4: lines longer than this get a `long_line` warning. */
export const LONG_LINE_CHARS = 500;
