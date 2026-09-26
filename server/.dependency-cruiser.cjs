/**
 * Advisory layer check for server/ and reviewer-core/ (onion architecture).
 *
 * Run on demand:  pnpm deps:check   (from server/)
 * Every rule is severity "warn": the run reports, it never fails. Rules map
 * to the review checks in .claude/skills/onion-architecture/SKILL.md; known
 * existing violations are listed there and in docs/architecture.md
 * ("Architecture decisions"). Not a linter and not wired into CI.
 *
 * Paths are relative to server/; reviewer-core is cruised as ../reviewer-core/src.
 */

// Files allowed to import drizzle-orm or src/db/{schema,rows,client}.
const PERSISTENCE = [
  '/repository(\\.ts$|/)', // modules/<m>/repository.ts and repository/*.repo.ts
  '^src/db/',
  '^src/adapters/auth/local\\.ts$', // AuthProvider reads the seeded workspace
  '^src/platform/jobs\\.ts$', // JobRunner mirrors jobs into the jobs table
  '^src/platform/container\\.ts$', // composition root (Db type)
  '^src/app\\.ts$', // composition root + /health/ready
  '^src/modules/(settings|workspace)/', // thin-module exception (own tables + read-only)
];

// Vendor SDKs that only adapters may import.
const SDK = 'node_modules/(openai|@anthropic-ai/sdk|octokit|@octokit|simple-git)/';

module.exports = {
  forbidden: [
    {
      name: 'no-cross-module',
      comment: 'A module never imports another module folder; use modules/_shared or the container.',
      severity: 'warn',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/', pathNot: ['^src/modules/$1/', '^src/modules/_shared/'] },
    },
    {
      name: 'no-drizzle-outside-persistence',
      comment: 'drizzle-orm and db/schema|rows|client stay in repositories (plus listed exceptions).',
      severity: 'warn',
      from: { path: '^src/', pathNot: PERSISTENCE },
      to: { path: ['node_modules/drizzle-orm/', '^src/db/(schema|rows|client)'] },
    },
    {
      name: 'no-route-to-repository',
      comment: 'Routes call a service; they never import a repository.',
      severity: 'warn',
      from: { path: '^src/modules/[^/]+/routes\\.ts$' },
      to: { path: '/repository(\\.ts$|/)' },
    },
    {
      name: 'no-sdk-outside-adapters',
      comment: 'Vendor SDKs are adapter-only (composition root may build providers).',
      severity: 'warn',
      from: {
        pathNot: [
          '^src/adapters/',
          '^src/platform/container\\.ts$',
          // Documented core exception: the OpenRouter adapter lives in reviewer-core.
          'reviewer-core/src/llm/openrouter\\.ts$',
          // Pure helper (zod -> JSON schema), no I/O.
          'reviewer-core/src/llm/structured\\.ts$',
        ],
      },
      to: { path: SDK },
    },
    {
      name: 'no-module-to-adapter',
      comment: 'Application code depends on ports (vendor/shared), not on adapter modules.',
      severity: 'warn',
      from: { path: '^src/modules/' },
      to: { path: '^src/adapters/' },
    },
    {
      name: 'reviewer-core-pure',
      comment: 'reviewer-core imports nothing from server/ except the shared kernel, and no DB/fs/process I/O.',
      severity: 'warn',
      from: { path: 'reviewer-core/src/' },
      to: {
        path: ['^src/', 'node_modules/(drizzle-orm|postgres|fastify|octokit|simple-git)/', '^(node:)?(fs|fs/promises|child_process|net|http|https)$'],
        pathNot: ['^src/vendor/shared/'],
      },
    },
    {
      name: 'no-circular',
      comment:
        'Runtime cycles only. A cycle that contains any `import type` edge is erased by the ' +
        'compiler and cannot cause load-order bugs (e.g. services type-importing Container while ' +
        'the container constructs them). viaOnly checks EVERY edge of the cycle; a top-level ' +
        'to.dependencyTypesNot would only check the one edge the cycle is reported from.',
      severity: 'warn',
      from: {},
      to: { circular: true, viaOnly: { dependencyTypesNot: ['type-only'] } },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // See `import type` edges too: row-type leaks are type-only imports.
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.js', '.json'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
