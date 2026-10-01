import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  AgentSkill,
  AgentSkillsPut,
  AgentSkillsResult,
  Skill,
  SkillImportPreview,
  SkillImportRequest,
  SkillImportSave,
  SkillImportUrlPreview,
  SkillImportUrlRequest,
  SkillImportUrlSave,
  SkillInput,
  SkillPatch,
  SkillVersion,
} from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { SkillsService } from './service.js';

/**
 * L02 — skills module. Routes are thin (onion R2); every one declares
 * `schema.response` (R3). Errors use the envelope with `SkillErrorCode`s.
 *   GET    /skills                → Skill[] (workspace, by name)
 *   POST   /skills                → 201 Skill (manual create only)
 *   POST   /skills/import/preview → SkillImportPreview (parses the upload, stores nothing)
 *   POST   /skills/import         → 201 Skill (re-parses the file; imported_file, disabled)
 *   POST   /skills/import-url/preview → SkillImportUrlPreview (fetches the URL server-side; stores nothing)
 *   POST   /skills/import-url     → 201 Skill (re-fetches; 409 import_url_changed on a sha256 mismatch; imported_url, disabled)
 *   GET    /skills/:id            → Skill
 *   PUT    /skills/:id            → Skill (bump + snapshot; 409 skill_ack_required / skill_name_taken)
 *   DELETE /skills/:id            → 204 (links cascade)
 *   GET    /skills/:id/versions   → SkillVersion[] (newest first)
 *   GET    /agents/:id/skills     → AgentSkill[] (by order)
 *   PUT    /agents/:id/skills     → AgentSkillsResult (one transaction; 400 skill_not_in_workspace)
 */
export default async function skillsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;
  const service = new SkillsService(container, {
    skills: container.skillsModuleRepo,
    agents: container.agentsRepo,
  });

  app.get('/skills', { schema: { response: { 200: Skill.array() } } }, async (req) => {
    const { workspaceId } = await getContext(container, req);
    return service.list(workspaceId);
  });

  app.post(
    '/skills',
    { schema: { body: SkillInput, response: { 201: Skill } } },
    async (req, reply) => {
      const { workspaceId } = await getContext(container, req);
      const skill = await service.create(workspaceId, req.body);
      return reply.status(201).send(skill);
    },
  );

  app.post(
    '/skills/import/preview',
    { schema: { body: SkillImportRequest, response: { 200: SkillImportPreview } } },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      return service.previewImport(workspaceId, req.body);
    },
  );

  app.post(
    '/skills/import',
    { schema: { body: SkillImportSave, response: { 201: Skill } } },
    async (req, reply) => {
      const { workspaceId } = await getContext(container, req);
      const skill = await service.saveImport(workspaceId, req.body);
      return reply.status(201).send(skill);
    },
  );

  app.post(
    '/skills/import-url/preview',
    { schema: { body: SkillImportUrlRequest, response: { 200: SkillImportUrlPreview } } },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      return service.previewImportUrl(workspaceId, req.body);
    },
  );

  app.post(
    '/skills/import-url',
    { schema: { body: SkillImportUrlSave, response: { 201: Skill } } },
    async (req, reply) => {
      const { workspaceId } = await getContext(container, req);
      const skill = await service.saveImportUrl(workspaceId, req.body);
      return reply.status(201).send(skill);
    },
  );

  app.get('/skills/:id', { schema: { params: IdParams, response: { 200: Skill } } }, async (req) => {
    const { workspaceId } = await getContext(container, req);
    return service.get(workspaceId, req.params.id);
  });

  app.put(
    '/skills/:id',
    { schema: { params: IdParams, body: SkillPatch, response: { 200: Skill } } },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      return service.update(workspaceId, req.params.id, req.body);
    },
  );

  app.delete(
    '/skills/:id',
    { schema: { params: IdParams, response: { 204: z.null() } } },
    async (req, reply) => {
      const { workspaceId } = await getContext(container, req);
      await service.delete(workspaceId, req.params.id);
      return reply.status(204).send(null);
    },
  );

  app.get(
    '/skills/:id/versions',
    { schema: { params: IdParams, response: { 200: SkillVersion.array() } } },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      return service.listVersions(workspaceId, req.params.id);
    },
  );

  app.get(
    '/agents/:id/skills',
    { schema: { params: IdParams, response: { 200: AgentSkill.array() } } },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      return service.agentSkills(workspaceId, req.params.id);
    },
  );

  app.put(
    '/agents/:id/skills',
    { schema: { params: IdParams, body: AgentSkillsPut, response: { 200: AgentSkillsResult } } },
    async (req) => {
      const { workspaceId } = await getContext(container, req);
      return service.setAgentSkills(workspaceId, req.params.id, req.body);
    },
  );
}
