import type { ConventionErrorCode } from '@devdigest/shared';
import { AppError } from '../../platform/errors.js';

/**
 * Conventions errors — `AppError`s whose `code` is a `ConventionErrorCode`,
 * so the envelope `{ error: { code, message, details } }` carries the
 * contract codes (HW02 D14, D15, D18).
 */
export class ConventionError extends AppError {
  constructor(code: ConventionErrorCode, message: string, statusCode: number, details?: unknown) {
    super(code, message, statusCode, details);
    this.name = 'ConventionError';
  }
}

/** 409 — a scan is already running for this repo (D14). */
export class ScanRunningError extends ConventionError {
  constructor(scanId: string) {
    super('scan_running', 'A conventions scan is already running for this repo', 409, { scan_id: scanId });
  }
}

/** 409 — the repo has no clone yet; nothing to sample (D15). */
export class RepoNotClonedError extends ConventionError {
  constructor() {
    super('repo_not_cloned', 'The repo has no clone yet; clone it before extracting conventions', 409);
  }
}

/** 409 — the repo was never indexed by repo-intel, so there are no ranked samples (D15). */
export class RepoNotIndexedError extends ConventionError {
  constructor() {
    super('repo_not_indexed', 'The repo is not indexed yet; index it before extracting conventions', 409);
  }
}

/** 400 — a `candidate_ids` entry is unknown for this repo or not accepted (D18). */
export class CandidateNotAcceptedError extends ConventionError {
  constructor(candidateIds: string[]) {
    super('candidate_not_accepted', 'Only accepted candidates can go into the skill', 400, {
      candidate_ids: candidateIds,
    });
  }
}

/** 409 — the skill name belongs to another, non-extracted skill (D18). */
export class SkillNameTakenError extends ConventionError {
  constructor(name: string) {
    super('skill_name_taken', 'A skill with this name already exists and was not extracted', 409, { name });
  }
}
