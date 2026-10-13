import type { SkillErrorCode } from '@devdigest/shared';
import { AppError } from '../../platform/errors.js';

/**
 * Skills errors — `AppError`s whose `code` is a `SkillErrorCode`, so the
 * envelope `{ error: { code, message, details } }` carries the contract codes.
 */
export class SkillError extends AppError {
  constructor(code: SkillErrorCode, message: string, statusCode: number, details?: unknown) {
    super(code, message, statusCode, details);
    this.name = 'SkillError';
  }
}

/** 409 — the workspace already has a skill with this name (`skills_ws_name_uq`). */
export class SkillNameTakenError extends SkillError {
  constructor(name?: string) {
    super(
      'skill_name_taken',
      'A skill with this name already exists',
      409,
      name !== undefined ? { name } : undefined,
    );
  }
}

/** 409 — first enable of an imported skill without `acknowledge_injection: true` (D4). */
export class SkillAckRequiredError extends SkillError {
  constructor() {
    super(
      'skill_ack_required',
      'Enabling an imported skill for the first time requires acknowledge_injection: true',
      409,
    );
  }
}

/** 400 — `PUT /agents/:id/skills` references a skill that is unknown or in another workspace. */
export class SkillNotInWorkspaceError extends SkillError {
  constructor(skillIds: string[]) {
    super('skill_not_in_workspace', 'Some skills are not in this workspace', 400, {
      skill_ids: skillIds,
    });
  }
}

/** HTTP status of each import failure code (L02 D3). */
const IMPORT_STATUS: Partial<Record<SkillErrorCode, number>> = {
  import_unsupported_file: 415,
  import_too_large: 413,
  // URL import (HW02 D21)
  import_url_bad_status: 502,
  import_url_network: 502,
  import_url_timeout: 504,
  import_url_changed: 409,
  import_url_html: 415,
};

/** A failure of the import pipeline or the URL fetch as a `SkillError` (413 / 415 / 409 / 502 / 504, else 422). */
export class SkillImportError extends SkillError {
  constructor(failure: { code: SkillErrorCode; message: string; details?: unknown }) {
    super(failure.code, failure.message, IMPORT_STATUS[failure.code] ?? 422, failure.details);
  }
}
