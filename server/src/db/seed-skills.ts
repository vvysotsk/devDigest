/**
 * Seed skills for L02 (specs/L02-skills.md, "Seed", D1, D6) and the plan that
 * links them to the built-in agents in prompt order.
 *
 * Plain data only — `seed.ts` owns the DB writes (idempotent by name). Every
 * skill is `source: 'manual'`. Bodies are generic review rules usable on any
 * PR; the `description` is the skill's interface, written as a directive
 * ("Use when …"), and stays within `SKILL_DESCRIPTION_MAX` (500 chars).
 */
import type { SkillSource, SkillType } from '@devdigest/shared';

export const SEED_SKILL_NAMES = [
  // design skills (2.png)
  'pr-quality-rubric',
  'no-then-chains',
  'secret-leakage-gate',
  'lethal-trifecta',
  'phantom-api-gate',
  'test-coverage-nudge',
  // Test Quality Reviewer
  'branch-coverage-check',
  'edge-case-hunter',
  'over-mocking-smell',
  'flaky-test-patterns',
  // API Contract Reviewer
  'route-signature-diff',
  'breaking-change-rubric',
] as const;

export type SeedSkillName = (typeof SEED_SKILL_NAMES)[number];

export interface SeedSkill {
  name: SeedSkillName;
  type: SkillType;
  source: Extract<SkillSource, 'manual'>;
  description: string;
  body: string;
}

export const SEED_SKILLS: readonly SeedSkill[] = [
  {
    name: 'pr-quality-rubric',
    type: 'rubric',
    source: 'manual',
    description:
      'Use when judging any pull request: grade each finding against a shared rubric (correctness, failure handling, scope, readability) so severities stay calibrated and nits never block a merge.',
    body: `# PR quality rubric

Grade what the diff changes, not the code around it.

## Flag
- **Correctness** — the change does something other than its own code and
  names say: an inverted condition, a wrong operator, a value computed but
  never used, a branch that can never run.
- **Failure handling** — an error swallowed in an empty \`catch\`, a failure
  logged but reported as success, a path that fails open where it should fail
  closed.
- **Scope creep** — unrelated refactors or behaviour changes mixed into the
  PR so that a reviewer cannot see what actually changed.
- **Misleading code** — a name, comment or type that contradicts what the
  code does and will cause the next change to be wrong.

## Do not flag
- Formatting, import order, quote style or naming taste.
- Pre-existing issues in untouched lines, unless the diff makes them worse.
- "Could be cleaner" rewrites with no behavioural consequence.

## Severity
- CRITICAL only for a defect with a concrete trigger and a harmful outcome
  (wrong result, data loss, crash, security impact).
- WARNING for a real problem that needs specific inputs or scale to bite.
- SUGGESTION for anything else worth saying once.
- If you cannot name the input that triggers the problem, it is not CRITICAL.`,
  },
  {
    name: 'no-then-chains',
    type: 'convention',
    source: 'manual',
    description:
      'Use when a diff adds or edits asynchronous TypeScript: flag new `.then()` / `.catch()` chains that should be `async` / `await`, and promise chains that lose errors or ordering.',
    body: `# No .then() chains in new code

The codebase uses \`async\` / \`await\`. New promise chains hide control flow
and make error handling easy to get wrong.

## Flag
- A new \`.then(...)\` chain inside a function that could be \`async\`.
- A \`.then()\` without a \`.catch()\` (or an enclosing \`try\`) whose promise is
  not returned or awaited — the rejection is unhandled.
- A \`.then()\` callback that starts another promise without returning it, so
  the outer chain does not wait for it.
- Mixing \`await\` and \`.then()\` on the same value in one function.
- \`.catch(() => {})\` or \`.catch(console.log)\` that turns a failure into
  a silent success.

## Do not flag
- \`Promise.all\` / \`Promise.allSettled\` / \`Promise.race\` — they are not chains.
- A single \`.catch()\` on a fire-and-forget call that logs and is documented
  as intentional.
- Code at module top level or in a non-async callback API where \`await\` is
  not available.
- Existing chains the diff does not touch.

## Severity
- WARNING when the chain drops a rejection or breaks ordering.
- SUGGESTION when it is only a style mismatch with the rest of the file.`,
  },
  {
    name: 'secret-leakage-gate',
    type: 'security',
    source: 'manual',
    description:
      'Use when a diff touches config, env handling, logging, fixtures or HTTP clients: block credentials committed to source and secrets that leak through logs, errors or responses.',
    body: `# Secret leakage gate

## Flag
- A literal credential in source, config or fixtures: API keys (\`sk_live_\`,
  \`AKIA\`, \`ghp_\`, \`xoxb-\`), private keys (\`-----BEGIN ... PRIVATE KEY-----\`),
  passwords, bearer tokens, connection strings with an embedded password.
- A secret written to a log, an error message, an exception payload, a trace
  or an HTTP response (including the whole config or env object).
- A secret sent to a third party it is not meant for (analytics, error
  tracker, an LLM prompt).
- Secrets placed in URLs or query strings, where proxies and access logs keep
  them.
- A \`.env\` file, key file or credentials JSON added to the repository.

## Do not flag
- Obvious placeholders (\`changeme\`, \`xxx\`, \`<your-key>\`, \`sk_test_\` values
  in docs) and public keys or publishable client IDs.
- Values read from an env var or a secrets provider and never printed.
- Redacted logging (\`***\`, last four characters).

## Severity
- CRITICAL for a live-looking credential in the diff or a secret reaching a
  log, response or third party. Recommend rotation, not only removal — git
  history keeps the value.
- WARNING for a pattern that leaks only under an error path you can name.
- Never repeat the secret value in your finding.`,
  },
  {
    name: 'lethal-trifecta',
    type: 'security',
    source: 'manual',
    description:
      'Use when a diff wires an LLM or agent to tools, data or outbound calls: report a lethal trifecta only when untrusted input, private data and an exfiltration path meet in one flow, each with a file:line.',
    body: `# Lethal trifecta

A lethal trifecta is one flow where an LLM or agent:
1. ingests **untrusted content** (a PR body, a web page, an uploaded file, a
   tool result an outsider controls), and
2. has access to **private data** (secrets, user records, internal files), and
3. has a way to **exfiltrate** (an outbound HTTP call, a tool that writes
   somewhere an attacker can read, a rendered link or image URL).

## Flag
- A new flow where all three meet. Name each component with its file:line
  and describe how injected text could make the model move private data out.
- A change that adds the missing third component to a flow that already had
  two (for example, giving an agent that reads untrusted text a new HTTP tool).

## Do not flag
- A normal authenticated endpoint that returns data to its caller — that is
  access control, not a trifecta.
- Flows with no LLM or agent in the path.
- Flows where one component is provably absent (no outbound tool, no private
  data in context, content fully trusted).

## Severity
- CRITICAL only with all three components cited.
- If one component is uncertain, report a WARNING as an ordinary finding and
  say which component you could not confirm. A false trifecta is worse than
  none.`,
  },
  {
    name: 'phantom-api-gate',
    type: 'security',
    source: 'manual',
    description:
      'Use when a diff adds imports, dependencies or calls to library or SDK methods: flag packages, functions and options that do not exist or are not declared, which break at run time or invite typosquatting.',
    body: `# Phantom API gate

Generated or copy-pasted code often calls APIs that look right but do not
exist. Some of them fail at run time; a misspelled package name can install
an attacker's package.

## Flag
- An import of a package that the diff does not add to the manifest and that
  the rest of the code never imports.
- A package name one character away from a well-known one, or an unscoped
  copy of a scoped package.
- A method, option or config key that the imported library does not have in
  the version the project uses, when the diff itself shows the evidence (for
  example, an unknown option passed through an untyped \`as any\`).
- A new dependency added to the manifest with a version range that allows
  any version (\`*\`, \`latest\`), or installed from a URL or git reference.

## Do not flag
- Imports that resolve to files in the repository.
- APIs you simply do not recognise — without evidence in the diff, stay
  silent or ask in a SUGGESTION.
- Type-only imports from the project's own contracts.

## Severity
- CRITICAL for a likely typosquatted or non-existent package that will be
  installed or executed.
- WARNING for a call that will fail at run time on a path you can name.
- SUGGESTION when you can only say "please verify this API exists".`,
  },
  {
    name: 'test-coverage-nudge',
    type: 'custom',
    source: 'manual',
    description:
      'Use when a diff adds or changes behaviour in source files: nudge for tests when new logic ships with no test changes, without demanding coverage for trivial code.',
    body: `# Test coverage nudge

## Flag
- New or changed logic (a condition, a calculation, a parser, an error path)
  in a source file with no matching test change in the diff.
- A bug fix with no regression test that would fail without the fix.
- A test file in the diff that does not exercise the function the PR changes.

## Do not flag
- Pure wiring, re-exports, type declarations, constants, logging or
  configuration.
- Generated code, migrations and fixtures.
- Code already covered by tests you can see in the diff.

## How to report
- Point at the untested function or branch, not at the file as a whole.
- Say which one test case would give the most confidence.

## Severity
- SUGGESTION by default.
- WARNING when the untested logic guards data integrity, authorization or
  persisted state and is non-trivial.`,
  },
  {
    name: 'branch-coverage-check',
    type: 'rubric',
    source: 'manual',
    description:
      'Use when a diff adds or changes a function together with its tests: enumerate every branch of the changed code and flag the branches that no test in the diff exercises.',
    body: `# Branch coverage check

## Method
1. For each function the diff adds or changes, list its branches: each
   \`if\` / \`else\`, \`switch\` case, ternary, early \`return\`, \`throw\`,
   \`catch\`, loop that may run zero times, and defaulting operator
   (\`??\`, \`||\`, default parameters) that changes the result.
2. For each branch, find a test in the diff whose input makes that branch
   run and whose assertion would fail if the branch were wrong.
3. Report the branches with no such test.

## Flag
- A guard or early return (invalid input, rejected state, limit reached)
  that no test reaches.
- A clamp, cap or fallback value that no test drives to its boundary.
- One arm of a union or \`kind\` switch tested while the others are not.
- A \`throw\` / error result with no test asserting it.
- Tests that reach a branch but assert nothing about its outcome.

## Do not flag
- Branches in code the diff does not touch.
- Exhaustiveness guards (\`never\` checks) and unreachable defensive code.
- Logging-only branches.

## How to report
- One finding per function, listing its uncovered branches with line
  numbers, anchored on the first uncovered branch.
- Name the concrete input that would exercise each branch.

## Severity
- WARNING when an uncovered branch changes the returned value, rejects
  input or protects an invariant.
- SUGGESTION for branches that only change messages or logging.`,
  },
  {
    name: 'edge-case-hunter',
    type: 'custom',
    source: 'manual',
    description:
      'Use when a diff adds logic that takes numbers, strings, collections, dates or optional values: list the boundary and corner inputs the code must handle and flag those neither handled nor tested.',
    body: `# Edge case hunter

For each changed function, walk this list and ask two questions: does the
code handle this input, and does a test prove it?

## Inputs to try
- **Numbers**: 0, negative, 1, the exact threshold, one above and one below
  it, very large values, non-integers where integers are expected, rounding
  at .5.
- **Strings**: empty, whitespace only, very long, non-ASCII, different case.
- **Collections**: empty, one element, duplicates, unsorted input.
- **Optional values**: \`undefined\`, \`null\`, a field present but empty.
- **Time**: a timestamp exactly at a deadline, just before and just after
  it; time zones; a clock injected vs \`new Date()\` inside the function.
- **Combinations**: two limits hit at once (a cap and a floor, a maximum
  and a minimum).

## Flag
- A corner case the code does not handle (wrong result, crash, silent
  acceptance of invalid input).
- A corner case the code handles but no test exercises — especially exact
  boundaries, where \`<\` vs \`<=\` mistakes live.

## Do not flag
- Inputs the type system or a validated schema already rules out.
- Hypothetical inputs no caller can produce — say why you believe a caller can.

## Severity
- WARNING for an unhandled corner case with a concrete wrong outcome, or a
  handled boundary with no test.
- CRITICAL only when the unhandled case corrupts stored data or bypasses a
  check.
- SUGGESTION for low-impact gaps.`,
  },
  {
    name: 'over-mocking-smell',
    type: 'convention',
    source: 'manual',
    description:
      'Use when a diff adds or changes tests that use mocks, stubs or spies: flag tests that mock the unit under test or only assert on mocks, so they would still pass if the real code were broken.',
    body: `# Over-mocking smell

A test is worth something only if it fails when the code is wrong.

## Flag
- The unit under test (or a function in the same module that holds the
  logic) is mocked, so the test exercises the mock.
- Assertions only check that a mock was called (\`toHaveBeenCalledWith\`),
  never the returned value or the resulting state.
- A mock returns exactly the value the assertion then checks — the test is a
  tautology.
- Pure functions, value objects or in-memory helpers are mocked instead of
  used.
- Mock setup longer than the behaviour under test, or mocks that re-implement
  the dependency's logic.
- Partial mocks of a module that silently replace more than the test needs.

## Do not flag
- Mocks at real I/O boundaries: network, database, file system, clock,
  randomness, third-party SDKs.
- Fakes or in-memory implementations of a port.
- Spies used in addition to assertions on real output.

## Severity
- WARNING when the over-mocked test is the only test for the changed logic.
- SUGGESTION otherwise.`,
  },
  {
    name: 'flaky-test-patterns',
    type: 'convention',
    source: 'manual',
    description:
      'Use when a diff adds or changes tests: flag patterns that make tests pass or fail by timing, order, clock, randomness or environment instead of by the code under test.',
    body: `# Flaky test patterns

## Flag
- Real waiting: \`setTimeout\` / \`sleep\` / fixed delays to "let things
  settle" instead of awaiting the promise or using fake timers.
- Wall-clock dependence: \`Date.now()\` / \`new Date()\` in the code under
  test or the assertion with no injected or frozen clock.
- Unseeded randomness in inputs or expectations.
- Order dependence: shared mutable state, module-level singletons or
  database rows that one test leaves for the next.
- Unawaited async work: a promise not awaited or returned, so the test ends
  before the assertion runs.
- Real network, real ports or real external services in a unit test.
- Environment dependence: time zone, locale, file system paths, env vars
  read without being set by the test.
- Exact equality on floating-point results, or on ordering the code does not
  guarantee.

## Do not flag
- Integration tests that intentionally use a real dependency and isolate
  their data.
- Timers under a fake clock (\`vi.useFakeTimers\`) that the test controls.

## Severity
- WARNING for a pattern that can fail on a clean CI run.
- SUGGESTION for a pattern that only fails under unusual environments.`,
  },
  {
    name: 'route-signature-diff',
    type: 'custom',
    source: 'manual',
    description:
      'Use when a diff changes an HTTP route, its handler or its request / response schema: write down the old and new signature of each route (method, path, params, query, body, status codes, response shape) and report every difference.',
    body: `# Route signature diff

## Method
For every route whose handler or schema the diff touches, reconstruct the
signature before and after the change from the removed and added lines:

- method and path, including path parameters;
- query parameters: name, type, required or optional, default, bounds;
- request body fields: name, type, required or optional;
- status codes returned, including error codes;
- response body: top-level type (array, object, scalar), field names, field
  types, nullability;
- headers the client must send or can read.

Remember that a shared schema changes every route that uses it.

## Flag
- Every difference between the two signatures, stated as
  \`old → new\` in the rationale (for example \`query id: string → number\`).
- Handler behaviour that no longer matches the declared schema.

## Do not flag
- Internal refactors that leave the signature identical.
- Changes to routes the diff does not reach.

## How to report
- One finding per changed route; anchor it on the changed schema or handler
  line.
- Classify each difference with \`breaking-change-rubric\` when that skill is
  present; otherwise say whether an existing client would break.`,
  },
  {
    name: 'breaking-change-rubric',
    type: 'rubric',
    source: 'manual',
    description:
      'Use when a diff changes a public API (route, response or request schema, status code, exported type): classify each change as breaking or compatible and block breaking changes that ship without versioning, deprecation or a consumer update.',
    body: `# Breaking change rubric

A change is **breaking** when a client written against the old contract can
fail, misread data or be rejected after the deploy.

## Breaking
- Removing or renaming a response field, or changing its type or
  nullability.
- Changing the top-level type of a response (array, object, scalar) or
  moving fields to a different nesting level.
- Removing or renaming a query, path or body parameter; the old name is
  then ignored or rejected.
- Making an optional input required, narrowing accepted values or bounds.
- Changing a status code, an error envelope or the meaning of a default.
- Changing the method or path of a route.

## Compatible
- Adding an optional input or a new response field.
- Adding a new route or a new status code for a new situation.
- Widening accepted values.

## Mitigations that make a breaking change acceptable
- A new version (\`/v2\`, version header) while the old one keeps working.
- The old name or shape kept as an alias during a deprecation window.
- Every consumer updated in the same diff (and no external consumers).

## Severity
- CRITICAL for a breaking change to a public route with none of the
  mitigations above.
- WARNING when a mitigation exists but is incomplete, or the route is
  documented as internal.
- Do not flag compatible changes.`,
  },
];

export type SeedAgentName =
  | 'Security Reviewer'
  | 'Performance Reviewer'
  | 'Test Quality Reviewer'
  | 'API Contract Reviewer';

export interface SeedAgentSkillLink {
  skill: SeedSkillName;
  enabled: boolean;
}

/**
 * Links per agent, in prompt order (`agent_skills.order` = array index).
 * Security matches 2.png: 6 linked, 3 enabled. API Contract gets its third
 * skill (`api-deprecation-policy`) through the user's manual import.
 */
export const SEED_AGENT_SKILL_LINKS: Readonly<Record<SeedAgentName, readonly SeedAgentSkillLink[]>> = {
  'Security Reviewer': [
    { skill: 'pr-quality-rubric', enabled: true },
    { skill: 'no-then-chains', enabled: false },
    { skill: 'secret-leakage-gate', enabled: true },
    { skill: 'lethal-trifecta', enabled: true },
    { skill: 'phantom-api-gate', enabled: false },
    { skill: 'test-coverage-nudge', enabled: false },
  ],
  'Performance Reviewer': [
    { skill: 'pr-quality-rubric', enabled: true },
    { skill: 'no-then-chains', enabled: true },
  ],
  'Test Quality Reviewer': [
    { skill: 'branch-coverage-check', enabled: true },
    { skill: 'edge-case-hunter', enabled: true },
    { skill: 'over-mocking-smell', enabled: true },
    { skill: 'flaky-test-patterns', enabled: true },
  ],
  'API Contract Reviewer': [
    { skill: 'route-signature-diff', enabled: true },
    { skill: 'breaking-change-rubric', enabled: true },
  ],
};
