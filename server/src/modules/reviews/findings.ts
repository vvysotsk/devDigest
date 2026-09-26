import type { FindingActionKind } from '@devdigest/shared';
import { AppError, NotFoundError } from '../../platform/errors.js';
import type { ReviewRepository } from './repository.js';
import type { ReviewDtoFinding } from './helpers.js';

/**
 * The update returned no row: the finding vanished after the tenancy check.
 * Kept as a 500 (internal_error), as before the stage-c refactor.
 */
function present(finding: ReviewDtoFinding | undefined): ReviewDtoFinding {
  if (!finding) throw new Error('Finding disappeared during the update');
  return finding;
}

/**
 * Finding actions available in the starter: accept / dismiss. These decisions
 * are the dataset later lessons build on (eval cases from accept/dismiss, the
 * `learn → memory` action, etc.).
 */
export async function actOnFinding(
  repo: ReviewRepository,
  workspaceId: string,
  findingId: string,
  action: FindingActionKind,
): Promise<{ finding: ReviewDtoFinding }> {
  const ctx = await repo.findingWorkspace(findingId);
  if (!ctx || ctx.workspaceId !== workspaceId) {
    throw new NotFoundError('Finding not found');
  }

  switch (action) {
    case 'accept': {
      return { finding: present(await repo.setFindingAccepted(findingId, new Date())) };
    }
    case 'dismiss': {
      return { finding: present(await repo.setFindingDismissed(findingId, new Date())) };
    }
    default:
      throw new AppError('invalid_action', `Action '${action}' is not available in the starter`, 400);
  }
}
