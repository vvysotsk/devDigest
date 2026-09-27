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
