import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { PollResult } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { PollingService } from './service.js';

/**
 * F1 — polling module. MANUAL refresh that ONLY syncs the PR list
 * (new/updated PRs appear, head_sha updates). It does NOT trigger any review —
 * review is manual (user presses Run Review, owned by the reviews module).
 * Thin route (onion skill R2): the use case is `PollingService.poll`.
 *
 *   POST /repos/:id/poll  → sync PR list from GitHub, bump last_polled_at
 */
export default async function pollingRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;
  const service = new PollingService(container, { pulls: container.pullsRepo, repos: container.reposRepo });

  app.post('/repos/:id/poll', { schema: { params: IdParams, response: { 200: PollResult } } }, async (req) => {
    const { workspaceId } = await getContext(container, req);
    return service.poll(workspaceId, req.params.id);
  });
}
