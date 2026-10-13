import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  ConventionCandidate,
  ConventionPatch,
  ConventionScan,
  ConventionSkillDraft,
  ConventionSkillSave,
  ConventionsState,
  Skill,
} from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { ConventionsService } from './service.js';

/**
 * HW02 — conventions module. Routes are thin (onion R2); every one declares
 * `schema.response` (R3). Errors use the envelope with `ConventionErrorCode`s.
 *   POST  /repos/:id/conventions/extract     → 202 ConventionScan (running); 409 scan_running / repo_not_cloned / repo_not_indexed
 *   GET   /repos/:id/conventions             → ConventionsState (latest scan + non-rejected candidates)
 *   PATCH /conventions/:id                   → ConventionCandidate (accept / reject / edit)
 *   GET   /repos/:id/conventions/skill-draft → ConventionSkillDraft (from the accepted candidates)
 *   POST  /repos/:id/conventions/skill       → 201 Skill (created) | 200 Skill (next version); 400 candidate_not_accepted; 409 skill_name_taken
 */
export default async function conventionsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;
  const service = new ConventionsService(
    container,
    { conventions: container.conventionsRepo, skills: container.skillsService },
    app.log,
  );

  app.post(
    '/repos/:id/conventions/extract',
    { schema: { params: IdParams, response: { 202: ConventionScan } } },
    async (req, reply) => {
      const { workspaceId } = await getContext(container, req);
      const scan = await service.startScan(workspaceId, req.params.id);
      return reply.status(202).send(scan);
    },
  );

  app.get(
    '/repos/:id/conventions',
    { schema: { params: IdParams, response: { 200: ConventionsState } } },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      return service.state(workspaceId, req.params.id);
    },
  );

  app.patch(
    '/conventions/:id',
    { schema: { params: IdParams, body: ConventionPatch, response: { 200: ConventionCandidate } } },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      return service.patchCandidate(workspaceId, req.params.id, req.body);
    },
  );

  app.get(
    '/repos/:id/conventions/skill-draft',
    { schema: { params: IdParams, response: { 200: ConventionSkillDraft } } },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      return service.skillDraft(workspaceId, req.params.id);
    },
  );

  app.post(
    '/repos/:id/conventions/skill',
    { schema: { params: IdParams, body: ConventionSkillSave, response: { 200: Skill, 201: Skill } } },
    async (req, reply) => {
      const { workspaceId } = await getContext(container, req);
      const { skill, created } = await service.saveSkill(workspaceId, req.params.id, req.body);
      return reply.status(created ? 201 : 200).send(skill);
    },
  );
}
