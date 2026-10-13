import { describe, it, expect } from 'vitest';
import { AgentSkill, Skill, type SkillPatch } from '@devdigest/shared';
import {
  bumpsVersion,
  isUniqueViolation,
  linksChanged,
  missingIds,
  needsAck,
  toAgentSkillDto,
  toLinks,
  toSkillDto,
} from '../src/modules/skills/helpers.js';
import type { SkillEditState, StoredSkill } from '../src/modules/skills/types.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';

const state = (over: Partial<SkillEditState> = {}): SkillEditState => ({
  name: 'no-then-chains',
  description: 'Use when reviewing async code',
  type: 'convention',
  body: 'Prefer async/await.',
  enabled: true,
  source: 'manual',
  version: 3,
  acknowledgedAt: null,
  ...over,
});

const patch = (p: Record<string, unknown>) => p as SkillPatch;

describe('skills helpers — version bump rule (D5)', () => {
  it('bumps on a changed name, description, type or body', () => {
    expect(bumpsVersion(state(), patch({ name: 'other-name' }))).toBe(true);
    expect(bumpsVersion(state(), patch({ description: 'Use when X' }))).toBe(true);
    expect(bumpsVersion(state(), patch({ type: 'rubric' }))).toBe(true);
    expect(bumpsVersion(state(), patch({ body: 'New body' }))).toBe(true);
  });

  it('does not bump on enabled only, or on fields sent unchanged', () => {
    expect(bumpsVersion(state(), patch({ enabled: false }))).toBe(false);
    expect(
      bumpsVersion(state(), patch({ name: 'no-then-chains', body: 'Prefer async/await.', enabled: false })),
    ).toBe(false);
  });
});

describe('skills helpers — ack rule (D4)', () => {
  it('requires the ack only when enabling an unacknowledged imported skill', () => {
    const imported = state({ source: 'imported_file', enabled: false });
    expect(needsAck(imported, patch({ enabled: true }))).toBe(true);
    expect(needsAck(imported, patch({ enabled: false }))).toBe(false);
    expect(needsAck(imported, patch({ body: 'x' }))).toBe(false);
    expect(needsAck(state({ source: 'imported_file', acknowledgedAt: new Date() }), patch({ enabled: true }))).toBe(
      false,
    );
    expect(needsAck(state({ source: 'manual', enabled: false }), patch({ enabled: true }))).toBe(false);
    // HW02 D21: a URL import is just as untrusted as a file import.
    const fromUrl = state({ source: 'imported_url', enabled: false });
    expect(needsAck(fromUrl, patch({ enabled: true }))).toBe(true);
    expect(needsAck(state({ source: 'imported_url', acknowledgedAt: new Date() }), patch({ enabled: true }))).toBe(false);
    expect(needsAck(state({ source: 'extracted', enabled: false }), patch({ enabled: true }))).toBe(false);
  });
});

describe('skills helpers — agent link lists (D17)', () => {
  const a = '11111111-1111-4111-8111-111111111111';
  const b = '22222222-2222-4222-8222-222222222222';

  it('toLinks assigns order = index and keeps enabled', () => {
    expect(
      toLinks({ skills: [{ skill_id: b, enabled: false }, { skill_id: a, enabled: true }] }),
    ).toEqual([
      { skill_id: b, order: 0, enabled: false },
      { skill_id: a, order: 1, enabled: true },
    ]);
  });

  it('linksChanged compares ids, order and enabled position by position', () => {
    const base = [
      { skill_id: a, order: 0, enabled: true },
      { skill_id: b, order: 1, enabled: true },
    ];
    expect(linksChanged(base, base.map((l) => ({ ...l })))).toBe(false);
    expect(linksChanged(base, [base[1]!, base[0]!].map((l, i) => ({ ...l, order: i })))).toBe(true);
    expect(linksChanged(base, [base[0]!, { ...base[1]!, enabled: false }])).toBe(true);
    expect(linksChanged(base, [base[0]!])).toBe(true);
    expect(linksChanged(base, [base[0]!, { ...base[1]!, order: 2 }])).toBe(true);
    expect(linksChanged([], [])).toBe(false);
  });

  it('missingIds lists requested ids that were not found, in request order', () => {
    expect(missingIds([a, b], [b])).toEqual([a]);
    expect(missingIds([a, b], [a, b])).toEqual([]);
  });
});

describe('skills helpers — DTOs', () => {
  const stored: StoredSkill = {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'pr-quality-rubric',
    description: 'Use when grading a PR',
    type: 'rubric',
    source: 'manual',
    body: 'twelve chars',
    enabled: true,
    version: 1,
    evidence_files: null,
    agent_count: 2,
    acknowledged_at: null,
    created_at: '2026-09-27T10:00:00.000Z',
    updated_at: '2026-09-27T10:00:00.000Z',
  };

  it('toSkillDto adds body_tokens from the counter and satisfies Skill strictly', () => {
    const dto = toSkillDto(stored, (text) => text.length);
    expect(dto.body_tokens).toBe(12);
    expect(() => Skill.strict().parse(dto)).not.toThrow();
  });

  it('toAgentSkillDto nests the skill and satisfies AgentSkill strictly', () => {
    const dto = toAgentSkillDto(
      { skill_id: stored.id, order: 0, enabled: false, skill: stored },
      () => 3,
    );
    expect(dto).toMatchObject({ skill_id: stored.id, order: 0, enabled: false });
    expect(() => AgentSkill.strict().parse(dto)).not.toThrow();
  });
});

describe('skills helpers — isUniqueViolation', () => {
  it('matches 23505 on the named constraint, also through a cause chain', () => {
    const pg = { code: '23505', constraint_name: 'skills_ws_name_uq' };
    expect(isUniqueViolation(pg, 'skills_ws_name_uq')).toBe(true);
    expect(isUniqueViolation({ message: 'wrapped', cause: pg }, 'skills_ws_name_uq')).toBe(true);
    expect(isUniqueViolation({ ...pg, constraint_name: 'other' }, 'skills_ws_name_uq')).toBe(false);
    expect(isUniqueViolation(new Error('x'), 'skills_ws_name_uq')).toBe(false);
    expect(isUniqueViolation(undefined, 'skills_ws_name_uq')).toBe(false);
  });
});

describe('skills routes — request validation (no DB)', () => {
  const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

  it('POST /skills rejects a non-kebab-case name and a non-manual source with 422', async () => {
    const app = await buildApp({ config });
    const base = { description: 'Use when X', type: 'custom', body: 'b' };
    const badName = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: { ...base, name: 'Not Kebab' },
    });
    expect(badName.statusCode).toBe(422);
    expect(badName.json().error.code).toBe('validation_error');
    const imported = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: { ...base, name: 'ok-name', source: 'imported_file' },
    });
    expect(imported.statusCode).toBe(422);
    await app.close();
  });

  it('PUT /skills/:id rejects an empty patch; PUT /agents/:id/skills rejects duplicate ids', async () => {
    const app = await buildApp({ config });
    const id = '44444444-4444-4444-8444-444444444444';
    const empty = await app.inject({ method: 'PUT', url: `/skills/${id}`, payload: {} });
    expect(empty.statusCode).toBe(422);
    const dup = await app.inject({
      method: 'PUT',
      url: `/agents/${id}/skills`,
      payload: {
        skills: [
          { skill_id: id, enabled: true },
          { skill_id: id, enabled: false },
        ],
      },
    });
    expect(dup.statusCode).toBe(422);
    await app.close();
  });
});
