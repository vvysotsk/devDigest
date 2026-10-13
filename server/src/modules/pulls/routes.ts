import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { PrCommentInput, PrDetail, PrMeta, PrReviewComment } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { PullsService } from './service.js';

/**
 * F1 — pulls module. PR import via Octokit (list + per-PR detail) and the
 * inline review comments proxy. Routes are thin (onion skill R2): parse,
 * resolve the workspace, call one PullsService method, let the zod response
 * schema serialize the contract (R3).
 *   GET  /repos/:id/pulls    → PR list (synced from GitHub, persisted), PrMeta[]
 *   GET  /pulls/:id          → full PR detail (files, commits, body), PrDetail
 *   GET  /pulls/:id/comments → inline review comments (live GitHub proxy)
 *   POST /pulls/:id/comments → create one inline comment
 *
 * Import is idempotent (unique repo_id+number). Review trigger is MANUAL
 * and owned by the reviews module — this module only imports/reads.
 */
export default async function pullsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;
  const service = new PullsService(
    container,
    { pulls: container.pullsRepo, repos: container.reposRepo, reviews: container.reviewRepo },
    app.log,
  );

  app.get(
    '/repos/:id/pulls',
    { schema: { params: IdParams, response: { 200: PrMeta.array() } } },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      return service.listForRepo(workspaceId, req.params.id);
    },
  );

  app.get('/pulls/:id', { schema: { params: IdParams, response: { 200: PrDetail } } }, async (req) => {
    const { workspaceId } = await getContext(container, req);
    return service.getDetail(workspaceId, req.params.id);
  });

  app.get(
    '/pulls/:id/comments',
    { schema: { params: IdParams, response: { 200: PrReviewComment.array() } } },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      return service.listComments(workspaceId, req.params.id);
    },
  );

  app.post(
    '/pulls/:id/comments',
    { schema: { params: IdParams, body: PrCommentInput, response: { 200: PrReviewComment } } },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      return service.createComment(workspaceId, req.params.id, req.body);
    },
  );
}
