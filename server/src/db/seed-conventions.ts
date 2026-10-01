/**
 * Seed fixture for the Conventions page on the demo repo `acme/payments-api`
 * (specs/HW02-conventions-and-api-contract.md, D20): one finished scan and
 * four pending candidates, so the browser flow `e2e/specs/09-conventions`
 * can accept / reject / edit cards and create the `repo-conventions` skill
 * without a model call. The repo has no clone, so the GitHub evidence links
 * built from `head_sha` are dead URLs by design.
 *
 * Plain data only — `seed.ts` owns the DB writes (inserted once per repo,
 * never rewritten, so user decisions survive a re-seed).
 */
import type { ConventionCategory } from '@devdigest/shared';

export interface SeedConventionScan {
  /** PR #482's head sha — the "clone head" the evidence links point at (K5). */
  headSha: string;
  sampleCount: number;
  candidatesDropped: number;
  provider: string;
  model: string;
}

export interface SeedConvention {
  category: ConventionCategory;
  rule: string;
  evidencePath: string;
  evidenceLine: number;
  evidenceSnippet: string;
  confidence: number;
}

export const SEED_CONVENTION_SCAN: SeedConventionScan = {
  headSha: 'a1b2c3d4e5f6',
  sampleCount: 14,
  candidatesDropped: 1,
  provider: 'openrouter',
  model: 'seed',
};

/** The design's three rules (DZ 1.png) plus one testing rule; paths come from the seeded PR files. */
export const SEED_CONVENTIONS: readonly SeedConvention[] = [
  {
    category: 'async',
    rule: 'Always use async/await instead of .then() chains',
    evidencePath: 'src/api/users.ts',
    evidenceLine: 23,
    evidenceSnippet: 'const user = await db.users.find(id);\nconst posts = await db.posts.findMany({ userId });',
    confidence: 0.91,
  },
  {
    category: 'types',
    rule: 'All public route handlers return typed Result<T, ApiError>',
    evidencePath: 'src/api/public/webhooks.ts',
    evidenceLine: 14,
    evidenceSnippet: 'function handler(): Result<Item[], ApiError> {\n  return ok(items);\n}',
    confidence: 0.78,
  },
  {
    category: 'structure',
    rule: 'Redis access goes through the src/lib/redis.ts singleton',
    evidencePath: 'src/lib/redis.ts',
    evidenceLine: 1,
    evidenceSnippet: 'export const redis = new Redis(config.redisUrl);',
    confidence: 0.85,
  },
  {
    category: 'testing',
    rule: 'Tests use fake timers for date logic',
    evidencePath: 'test/billing/refund.test.ts',
    evidenceLine: 3,
    evidenceSnippet: "vi.useFakeTimers();\nvi.setSystemTime(new Date('2026-01-15'));",
    confidence: 0.66,
  },
];
