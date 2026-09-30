import { describe, it, expect } from 'vitest';
import {
  Review,
  Finding,
  Intent,
  BlastRadius,
  Risks,
  PrHistory,
  SmartDiff,
  Conformance,
  Onboarding,
  EvalRun,
  MemoryItem,
  RunTrace,
  Settings,
  Repo,
  PrDetail,
  AgentVersionConfig,
  PromptAssembly,
  Skill,
  SkillInput,
  SkillPatch,
  AgentSkillsPut,
  SkillImportPreview,
  SkillImportSave,
  SkillErrorCode,
  ConventionScan,
  ConventionCandidate,
  ConventionsState,
  ConventionPatch,
  ConventionSkillSave,
  ConventionSkillDraft,
  ConventionErrorCode,
} from '@devdigest/shared';

/**
 * Contract tests — parse/round-trip the fixtures from data.jsx/data2.jsx
 * so feature agents can rely on the schemas matching the prototype data.
 */
describe('AI contracts parse fixtures', () => {
  it('Review + Finding (data.jsx VERDICT/FINDINGS)', () => {
    const review = Review.parse({
      verdict: 'request_changes',
      summary: 'Two blockers before merge.',
      score: 61,
      findings: [
        {
          id: 'f1',
          severity: 'CRITICAL',
          category: 'security',
          title: 'Hardcoded Stripe secret key in commit',
          file: 'src/config.ts',
          start_line: 12,
          end_line: 12,
          rationale: 'Line 12 contains a literal `sk_live_` Stripe key.',
          suggestion: 'Move to env and rotate.',
          confidence: 0.98,
          kind: 'secret_leak',
        },
      ],
    });
    expect(review.findings).toHaveLength(1);
    expect(review.score).toBe(61);
  });

  it('lethal-trifecta Finding variant', () => {
    const f = Finding.parse({
      id: 'f2',
      severity: 'CRITICAL',
      category: 'security',
      title: 'Lethal trifecta',
      file: 'src/api/public/webhooks.ts',
      start_line: 61,
      end_line: 74,
      rationale: 'all three legs present',
      confidence: 0.79,
      kind: 'lethal_trifecta',
      trifecta_components: ['private_data_access', 'untrusted_input', 'exfil_path'],
      evidence: [{ component: 'untrusted_input', file: 'src/api/public/webhooks.ts', line: 61 }],
    });
    expect(f.trifecta_components).toContain('exfil_path');
  });

  it('Intent / BlastRadius / Risks / PrHistory', () => {
    expect(() =>
      Intent.parse({ intent: 'x', in_scope: ['a'], out_of_scope: ['b'] }),
    ).not.toThrow();
    expect(() =>
      BlastRadius.parse({
        changed_symbols: [{ name: 'rateLimit', file: 'a.ts', kind: 'function' }],
        downstream: [
          {
            symbol: 'rateLimit',
            callers: [{ name: 'publicRouter', file: 'b.ts', line: 23 }],
            endpoints_affected: ['GET /x'],
            crons_affected: ['c'],
          },
        ],
        summary: 's',
      }),
    ).not.toThrow();
    expect(() =>
      Risks.parse({
        risks: [{ kind: 'security', title: 't', explanation: 'e', severity: 'high', file_refs: [] }],
      }),
    ).not.toThrow();
    expect(() =>
      PrHistory.parse({
        history: [
          {
            pr_number: 401,
            title: 't',
            merged_at: '2026-03-18',
            author: 'a',
            files_overlap: [],
            notes: 'n',
          },
        ],
      }),
    ).not.toThrow();
  });

  it('SmartDiff (data.jsx DIFF)', () => {
    const d = SmartDiff.parse({
      groups: [
        {
          role: 'core',
          files: [{ path: 'a.ts', additions: 84, deletions: 0, finding_lines: [28, 52] }],
        },
      ],
      split_suggestion: { too_big: false, total_lines: 285, proposed_splits: [] },
    });
    expect(d.groups[0]!.role).toBe('core');
  });

  it('Conformance / Onboarding / EvalRun / MemoryItem', () => {
    expect(() =>
      Conformance.parse({
        spec_id: 's1',
        spec_title: 'Spec',
        items: [{ requirement: 'r', status: 'implemented' }],
        completeness_pct: 80,
      }),
    ).not.toThrow();
    expect(() =>
      Onboarding.parse({
        sections: [{ kind: 'architecture', title: 'T', body: 'b', links: [] }],
      }),
    ).not.toThrow();
    expect(() =>
      EvalRun.parse({
        recall: 0.82,
        precision: 0.91,
        citation_accuracy: 0.95,
        traces_passed: 17,
        traces_total: 20,
        duration_ms: 12000,
        cost_usd: 0.23,
        per_trace: [{ name: 't01', pass: true, expected: 'x', actual: 'x' }],
      }),
    ).not.toThrow();
    expect(() =>
      MemoryItem.parse({
        content: 'c',
        scope: 'team',
        kind: 'decision',
        confidence: 0.92,
        sources: [{ pr: 401, context: 'ctx' }],
      }),
    ).not.toThrow();
  });

  it('RunTrace (data2.jsx TRACE single-document)', () => {
    const trace = RunTrace.parse({
      config: { agent: 'Security Reviewer', version: 'v7', model: 'gpt-4.1', pr: 482, source: 'local' },
      stats: { duration_ms: 8200, tokens_in: 14820, tokens_out: 1240, findings: 3, grounding: '3/3 passed' },
      prompt_assembly: { system: 's', user: 'u' },
      tool_calls: [{ tool: 'read_file', args: "'src/config.ts'", meta: '1,240 bytes', ms: 120 }],
      raw_output: '{}',
      memory_pulled: [{ pr: 288, text: 'verified via stripe-signature' }],
      specs_read: ['specs/security-baseline.md'],
      log: [{ t: '00.00', kind: 'info', msg: 'started' }],
    });
    expect(trace.tool_calls).toHaveLength(1);
  });
});

describe('platform DTOs', () => {
  it('Settings defaults + passthrough', () => {
    const s = Settings.parse({ extra_key: 'x' });
    expect(s.theme).toBe('dark');
    expect((s as Record<string, unknown>).extra_key).toBe('x');
  });

  it('Repo + PrDetail', () => {
    expect(() =>
      Repo.parse({
        id: 'r1',
        workspace_id: 'w1',
        owner: 'acme',
        name: 'payments-api',
        full_name: 'acme/payments-api',
        default_branch: 'main',
        clone_path: null,
        last_polled_at: null,
        created_by: null,
      }),
    ).not.toThrow();
    expect(() =>
      PrDetail.parse({
        number: 482,
        title: 't',
        author: 'a',
        branch: 'b',
        base: 'main',
        head_sha: 'sha',
        additions: 1,
        deletions: 0,
        files_count: 1,
        status: 'open',
        files: [],
        commits: [],
      }),
    ).not.toThrow();
  });
});

describe('L02 skills contracts', () => {
  const baseConfig = {
    provider: 'openrouter',
    model: 'm',
    system_prompt: 's',
    output_schema: null,
    strategy: 'single-pass',
    ci_fail_on: 'critical',
    repo_intel: true,
  };

  it('AgentVersionConfig reads a pre-L02 string[] snapshot as ordered enabled links', () => {
    const cfg = AgentVersionConfig.parse({ ...baseConfig, skills: ['s-a', 's-b'] });
    expect(cfg.skills).toEqual([
      { skill_id: 's-a', order: 0, enabled: true },
      { skill_id: 's-b', order: 1, enabled: true },
    ]);
  });

  it('AgentVersionConfig keeps object links as stored (enabled=false survives)', () => {
    const skills = [{ skill_id: 's-a', order: 0, enabled: false }];
    expect(AgentVersionConfig.parse({ ...baseConfig, skills }).skills).toEqual(skills);
  });

  it('PromptAssembly without skill_blocks (pre-L02 trace) still parses', () => {
    const pa = PromptAssembly.parse({ system: 's', skills: null, user: 'u' });
    expect(pa.skill_blocks).toBeUndefined();
  });

  it('PromptAssembly with skill_blocks parses', () => {
    const pa = PromptAssembly.parse({
      system: 's',
      skills: '### Skill: a (manual, v1)\n…',
      skill_blocks: [{ skill_id: 'id', name: 'a', version: 1, source: 'manual', tokens: 12 }],
      user: 'u',
    });
    expect(pa.skill_blocks).toHaveLength(1);
  });

  it('Skill requires the L02 fields', () => {
    const skill = {
      id: 'id',
      name: 'edge-case-hunter',
      description: 'Use when…',
      type: 'rubric',
      source: 'imported_file',
      body: 'b',
      enabled: false,
      version: 1,
      agent_count: 0,
      body_tokens: 1,
      acknowledged_at: null,
      created_at: '2026-09-27T00:00:00.000Z',
      updated_at: '2026-09-27T00:00:00.000Z',
    };
    expect(() => Skill.strict().parse(skill)).not.toThrow();
    const { agent_count: _omit, ...withoutCount } = skill;
    expect(() => Skill.parse(withoutCount)).toThrow();
  });

  it('SkillInput enforces kebab-case names and defaults source/enabled', () => {
    const ok = SkillInput.parse({ name: 'no-then-chains', description: 'd', type: 'convention', body: 'b' });
    expect(ok).toMatchObject({ source: 'manual', enabled: true });
    expect(() => SkillInput.parse({ ...ok, name: 'No Then' })).toThrow();
    expect(() => SkillInput.parse({ ...ok, source: 'community' })).toThrow();
  });

  it('SkillInput is manual-only: source imported_file is rejected', () => {
    const base = { name: 'x', description: 'd', type: 'custom', body: 'b' };
    expect(() => SkillInput.parse({ ...base, source: 'imported_file' })).toThrow();
    expect(SkillInput.parse({ ...base, source: 'manual' }).source).toBe('manual');
  });

  it('SkillImportSave parses with and without overrides and rejects a bad name', () => {
    const file = { filename: 'api-deprecation-policy.zip', content_base64: 'UEsDBA==' };
    expect(SkillImportSave.parse(file)).toEqual(file);
    expect(
      SkillImportSave.parse({ ...file, name: 'api-deprecation-policy', description: 'Use when…', type: 'rubric' }),
    ).toMatchObject({ name: 'api-deprecation-policy', type: 'rubric' });
    expect(() => SkillImportSave.parse({ ...file, name: 'Bad Name' })).toThrow();
    expect(() => SkillImportSave.parse({ ...file, description: '   ' })).toThrow();
    // body / source / enabled are never accepted from the client
    expect(SkillImportSave.parse({ ...file, body: 'x', source: 'manual', enabled: true })).toEqual(file);
  });

  it('SkillPatch rejects an empty patch and accepts only acknowledge_injection: true', () => {
    expect(() => SkillPatch.parse({})).toThrow();
    expect(() => SkillPatch.parse({ acknowledge_injection: true })).toThrow();
    expect(() => SkillPatch.parse({ enabled: true, acknowledge_injection: false })).toThrow();
    expect(SkillPatch.parse({ enabled: true, acknowledge_injection: true }).enabled).toBe(true);
  });

  it('SkillErrorCode has import_invalid_field for SkillInput limits on import save', () => {
    expect(SkillErrorCode.parse('import_invalid_field')).toBe('import_invalid_field');
    expect(SkillErrorCode.options).toContain('import_description_missing');
    expect(SkillErrorCode.options).toContain('import_invalid_name');
  });

  it('AgentSkillsPut rejects duplicate skill ids', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect(() => AgentSkillsPut.parse({ skills: [{ skill_id: id, enabled: true }] })).not.toThrow();
    expect(() =>
      AgentSkillsPut.parse({
        skills: [
          { skill_id: id, enabled: true },
          { skill_id: id, enabled: false },
        ],
      }),
    ).toThrow();
  });

  it('SkillImportPreview parses a draft with warnings', () => {
    expect(() =>
      SkillImportPreview.strict().parse({
        filename: 'api-deprecation-policy.zip',
        draft: { name: 'api-deprecation-policy', description: '', type: 'custom', body: 'b' },
        raw_source: '---\nname: x\n---\nb',
        frontmatter: { name: 'x', metadata: { version: '1.0' } },
        files: [{ path: 'scripts/install.sh', status: 'skipped', reason: 'skipped — never executed or stored', size: 10 }],
        warnings: [
          { kind: 'description_missing', line: null, detail: 'no description' },
          { kind: 'name_exists', line: null, detail: 'exists' },
        ],
      }),
    ).not.toThrow();
  });

  it('Convention contracts (HW02 2a) parse a scan, a candidate, the state, a patch and a skill save', () => {
    const scanId = '00000000-0000-4000-8000-00000000000a';
    const scan = ConventionScan.strict().parse({
      id: scanId,
      repo_id: '00000000-0000-4000-8000-00000000000b',
      status: 'done',
      head_sha: 'abc123',
      sample_count: 12,
      candidates_dropped: 1,
      provider: 'openrouter',
      model: 'deepseek/deepseek-v4-flash',
      error: null,
      started_at: '2026-09-30T10:00:00.000Z',
      finished_at: '2026-09-30T10:01:00.000Z',
    });
    const candidateId = '00000000-0000-4000-8000-00000000000c';
    const candidate = ConventionCandidate.strict().parse({
      id: candidateId,
      scan_id: scanId,
      category: 'naming',
      rule: 'Hooks are named useXxx',
      evidence_path: 'src/lib/hooks/agents.ts',
      evidence_line: 12,
      evidence_snippet: 'export function useAgents() {',
      confidence: 0.9,
      status: 'pending',
      created_at: '2026-09-30T10:01:00.000Z',
      updated_at: '2026-09-30T10:01:00.000Z',
    });
    expect(() => ConventionsState.strict().parse({ scan, candidates: [candidate] })).not.toThrow();
    expect(() => ConventionsState.strict().parse({ scan: null, candidates: [] })).not.toThrow();

    expect(() => ConventionPatch.parse({ status: 'accepted' })).not.toThrow();
    expect(() => ConventionPatch.parse({ rule: 'edited', category: 'structure' })).not.toThrow();
    expect(() =>
      ConventionSkillSave.strict().parse({
        name: 'repo-conventions',
        description: 'Conventions of acme/payments-api',
        type: 'convention',
        enabled: true,
        body: '# repo-conventions\n\n## Hooks are named useXxx',
        agent_id: '00000000-0000-4000-8000-00000000000d',
        candidate_ids: [candidateId],
      }),
    ).not.toThrow();
    expect(() =>
      ConventionSkillDraft.strict().parse({
        name: 'repo-conventions',
        description: '',
        type: 'convention',
        body: '',
        existing: { id: '00000000-0000-4000-8000-00000000000e', version: 2 },
      }),
    ).not.toThrow();
    expect(ConventionErrorCode.options).toContain('scan_running');

    // Rejections the routes rely on.
    expect(() => ConventionCandidate.parse({ ...candidate, confidence: 1.5 })).toThrow();
    expect(() => ConventionCandidate.parse({ ...candidate, category: 'style' })).toThrow();
    expect(() => ConventionCandidate.parse({ ...candidate, evidence_line: 0 })).toThrow();
    expect(() => ConventionPatch.parse({})).toThrow();
    expect(() => ConventionSkillSave.parse({ name: 'Repo Conventions', description: '', type: 'convention', enabled: true, body: 'b', agent_id: '00000000-0000-4000-8000-00000000000d', candidate_ids: [candidateId] })).toThrow();
    expect(() => ConventionSkillSave.parse({ name: 'repo-conventions', description: '', type: 'convention', enabled: true, body: 'b', agent_id: '00000000-0000-4000-8000-00000000000d', candidate_ids: [] })).toThrow();
  });
});
