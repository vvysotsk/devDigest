/**
 * Shared test factories — one per contract type, so a new contract field is
 * added in one place. Not a test file (vitest collects only `*.test.ts(x)`),
 * imported by tests only. A test that needs other defaults passes overrides;
 * it never copies the whole shape.
 */
import type {
  Agent,
  ConventionCandidate,
  ConventionScan,
  FindingRecord,
  PrMeta,
  ReviewRecord,
  Skill,
} from "@devdigest/shared";

export function skill(o: Partial<Skill> = {}): Skill {
  return {
    id: "sk-1",
    name: "pr-quality-rubric",
    description: "Use when grading a PR against the quality rubric.",
    type: "rubric",
    source: "manual",
    body: "# PR quality rubric\n\n- Small, focused diff",
    enabled: true,
    version: 1,
    evidence_files: null,
    agent_count: 0,
    body_tokens: 12,
    acknowledged_at: null,
    created_at: "2026-09-20T10:00:00.000Z",
    updated_at: "2026-09-20T10:00:00.000Z",
    ...o,
  };
}

export function agent(o: Partial<Agent> = {}): Agent {
  return {
    id: "ag1",
    name: "Security Reviewer",
    description: "Flags secrets and injection",
    provider: "openai",
    model: "gpt-4.1",
    system_prompt: "You are a security reviewer.",
    output_schema: null,
    strategy: "single-pass",
    ci_fail_on: "critical",
    repo_intel: true,
    enabled: true,
    version: 1,
    skill_count: 0,
    ...o,
  };
}

export function finding(o: Partial<FindingRecord> & { id: string }): FindingRecord {
  return {
    severity: "WARNING",
    category: "perf",
    title: `Finding ${o.id}`,
    file: "src/api/users.ts",
    start_line: 45,
    end_line: 52,
    rationale: "The loop on line 46 calls db.posts.findMany once per user.",
    suggestion: null,
    confidence: 0.86,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
    ...o,
  };
}

export function pr(o: Partial<PrMeta> = {}): PrMeta {
  return {
    id: "pr-1",
    number: 482,
    title: "Add rate limiting to public API endpoints",
    author: "marisa.koch",
    branch: "feat/rate-limit",
    base: "main",
    head_sha: "abc",
    additions: 247,
    deletions: 38,
    files_count: 4,
    status: "needs_review",
    opened_at: null,
    updated_at: null,
    score: 61,
    cost_usd: 0.014,
    latest_batch: {
      run_ids: ["run-new"],
      findings_by_severity: { CRITICAL: 2, WARNING: 2, SUGGESTION: 2 },
    },
    ...o,
  };
}

export function review(o: Partial<ReviewRecord> & { id: string; run_id: string | null }): ReviewRecord {
  return {
    pr_id: "pr-1",
    agent_id: "a1",
    agent_name: "Security Reviewer",
    kind: "review",
    verdict: "request_changes",
    summary: null,
    score: 61,
    model: "m",
    grounding: null,
    created_at: "2026-06-13T08:52:51.000Z",
    findings: [],
    ...o,
  };
}

export function conventionScan(o: Partial<ConventionScan> = {}): ConventionScan {
  return {
    id: "scan-1",
    repo_id: "repo-1",
    status: "done",
    head_sha: "f00dcafe1234",
    sample_count: 14,
    candidates_dropped: 1,
    provider: "openai",
    model: "gpt-5.4",
    error: null,
    started_at: "2026-10-01T09:00:00.000Z",
    finished_at: "2026-10-01T09:01:00.000Z",
    ...o,
  };
}

export function conventionCandidate(o: Partial<ConventionCandidate> = {}): ConventionCandidate {
  return {
    id: "cand-1",
    scan_id: "scan-1",
    category: "naming",
    rule: "Hooks are named useXxx",
    evidence_path: "src/lib/hooks/agents.ts",
    evidence_line: 3,
    evidence_snippet: 'export function useAgents() {\n  return useQuery({ queryKey: ["agents"] });\n}',
    confidence: 0.9,
    status: "pending",
    created_at: "2026-10-01T09:01:00.000Z",
    updated_at: "2026-10-01T09:01:00.000Z",
    ...o,
  };
}
