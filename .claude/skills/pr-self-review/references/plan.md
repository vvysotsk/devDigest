# pr-self-review — skill plan

Status: implemented as `SKILL.md` v1.0.0 on 2026-09-26; decisions D1–D12 are in §11 ("Decided" column); D13 (finding identity) was added on 2026-09-27 with 2.1.0; D14 (user-invoked only) on 2026-09-28 with 2.2.0. This file keeps the reasoning. Sources: `sources.md`
(ids C = Claude Code docs, R = review practice, L = local evidence).

Settled (not revisited here): (1) the skill itself blocks — on an open
CRITICAL it does not run `gh pr create` / `git push` and says why; no hook.
(2) "Checked" comes from the pr-self-review journal only; session transcripts
add a "likely checked" label and never unblock. (3) Routing by
`metadata.applies_to` in each skill's frontmatter; no central table.

## 0. Goal and non-goals

- **Goal.** Before a PR is opened, every changed file has been checked by
  every skill whose `applies_to` matches it, against its current content; the
  touched packages typecheck and pass tests; nothing in "Do not touch" was
  touched. Any open (not dismissed) CRITICAL → no PR.
- **Non-goals.** Not a replacement for the DevDigest reviewer agents (they
  review the PR after it exists) nor for CI. Does not fix code: it reports;
  fixing is a normal follow-up turn. Does not review files outside the diff.

## 1. Inventory

### 1.1 Skills and proposed `applies_to`

`applies_to` is a comma-separated glob string (C3: metadata values are
strings; C1: do not reuse the name `paths`). Globs are repo-relative, `!`
excludes. Top-level `paths` is NOT used: it would narrow auto-activation of
the skill in normal work (C1), which is a different concern.

| Skill | Purpose | Role | Proposed `metadata.applies_to` | Why |
|---|---|---|---|---|
| frontend-architecture | Where code lives in `client/`, `index.ts` boundary, signals | checker, owned, **can block** (R1–R7 are "never/must") | `client/src/**, client/messages/**, !client/src/vendor/**` | Placement rules cover every file under `src/`; strings rule covers `messages/`. `vendor/ui` / `vendor/shared` have their own rules (kit / mirror). |
| react-best-practices | How components/hooks are written | checker | `client/src/**/*.tsx, client/src/lib/hooks/**/*.ts, !client/**/*.test.tsx` | Only JSX and hooks; tests belong to RTL. |
| next-best-practices | App Router conventions, RSC boundaries | checker (`user-invocable: false` does not stop the Skill tool, C1) | `client/src/app/**, client/next.config.*, client/src/middleware.ts, client/src/i18n/**` | Route files and Next config only (`middleware.ts` is absent today; the glob catches it if added). |
| react-testing-library | RTL + Vitest test style | checker | `client/**/*.test.ts, client/**/*.test.tsx, client/src/test/**, client/vitest.config.*` | Test files only. |
| fastify-best-practices | Routes, plugins, hooks, errors | checker | `server/src/modules/**/routes.ts, server/src/app.ts, server/src/server.ts, server/src/platform/**, server/src/modules/_shared/context.ts, server/src/modules/_shared/schemas.ts` | Where Fastify APIs are actually used; services/repositories do not import Fastify. |
| drizzle-orm-patterns | Schema, queries, transactions, migrations | checker | `server/src/db/**, server/src/modules/**/repository.ts, server/src/modules/**/repository/**, server/drizzle.config.*, !server/src/db/migrations/meta/**` | Only code that imports `drizzle-orm`/`db/schema`. New `.sql` files are included; applied ones are guarded mechanically (§4). |
| postgresql-table-design | Postgres schema design | checker | `server/src/db/schema/**, server/src/db/migrations/*.sql` | Schema + the SQL drizzle-kit generated from it. |
| zod | Schema validation practice | checker, cross-cutting | `server/src/vendor/shared/**, server/src/modules/**/routes.ts, server/src/modules/_shared/schemas.ts, server/src/platform/config*.ts, reviewer-core/src/**/*.ts, client/src/lib/**/*.ts` | Globs cannot match "imports zod"; these are the places that define or parse schemas. `client/src/vendor/shared` excluded — it is a mirror. |
| security | OWASP review, confidence-based | checker, cross-cutting, **can block** (HIGH confidence only) | `server/src/**, client/src/**, reviewer-core/src/**, e2e/**/*.ts, **/package.json, .github/**, !**/*.test.ts, !**/*.test.tsx, !**/*.it.test.ts` | Its own rule: do not flag tests (L7). `package.json` for dependency changes, `.github` for CI secrets. |
| typescript-expert | General TS expertise | **excluded (D6 c)** | — | A persona, not a rule set; only its "Code Review Checklist" (`SKILL.md:339`) is checkable. Listed as "not routed" in every report. |
| onion-architecture | Server/core layering, import matrix, 12 review checks, advisory `pnpm deps:check` | checker, owned, **can block** (import-matrix "✗", check 12 is CRITICAL) | `server/src/**, reviewer-core/src/**, server/.dependency-cruiser.cjs, !**/*.test.ts, !**/*.it.test.ts` | Shipped v1.0.0 (cc1c0e2) with `applies_to: [server/**, reviewer-core/**]` — a YAML list, outside the Agent Skills spec; narrowed to source + the cruiser config and fixed to a string in v1.0.1. Check 12 (baseline may only lose entries) is mechanical in pr-self-review. |
| mermaid-diagram | Writes diagrams | **not a checker** | — | Generator. A syntax check of changed ` ```mermaid ` blocks could be a mechanical check later, not a skill run. |
| engineering-insights | Captures lessons | **not a checker** | — | Process. pr-self-review only reminds (non-blocking) to run its checkpoint. |
| package-docs | Keeps docs/specs in sync | **not a checker** as a skill; its rule is a mechanical WARNING (§4) | — | "A task is not done until docs/specs updated" is checked by diff shape, not by re-running the skill. |
| devdigest-demo | Demo video conventions | **not a checker** | — | Filming workflow, not code rules. |
| pr-self-review | this skill | — | — | Never routes to itself. |

Skills that can raise a skill-level CRITICAL declare `metadata.blocking: "true"`
(frontend-architecture, onion-architecture, security); the blocking-only mode
(§10 b) runs exactly those, so routing stays in the skills, not in a table.

Coverage gaps the report must show, not hide: `e2e/**` (no skill except
security — typecheck + flow contract only), `scripts/**`, root docs,
`demo/**`. Files with no matching checker are listed as "no skill covers".

### 1.2 Verification commands (root `CLAUDE.md`, L6)

| Package | Typecheck | Tests (hermetic) | Heavy (needs Docker) |
|---|---|---|---|
| server | `pnpm typecheck` | `pnpm exec vitest run --exclude '**/*.it.test.ts'` | `DEVDIGEST_REQUIRE_DOCKER=1 pnpm exec vitest run .it.test` (since 2.2.0: fails instead of skipping without Docker) |
| client | `pnpm typecheck` | `pnpm test` | — |
| reviewer-core | `npm run typecheck` | `npm test` | — |
| e2e | `npm run typecheck` | — | `npm run e2e:hermetic` (full stack) |

Package dependencies for "touched": a change in `reviewer-core/src/**` also
touches `server` (imported through a tsconfig path alias); a change in
`server/src/vendor/shared/**` also touches `client` (mirror) and
`reviewer-core` (consumes `LLMProvider`/contracts).

### 1.3 Severity and grounding model (L2, L3)

DevDigest already has the vocabulary: `CRITICAL / WARNING / SUGGESTION`
(`reviewer-core/src/output/to-review.ts:17-23`) and a CI gate that blocks on
`critical` by default (`:151`). The grounding gate drops any finding whose
file is not in the diff or whose lines miss every new-side hunk, logging the
reason (`reviewer-core/src/grounding.ts:41-80`), with a short list of
full-file kinds (`:16`). pr-self-review copies both: same three severities,
same gate, same "never silent" drop log.

## 2. Change scope

1. `base = git merge-base HEAD main` (see D7 for `origin/main`).
2. Tracked changes: `git diff --name-status -M base` (no `..HEAD`: compares
   the base to the working tree, so it covers commits, staged and unstaged in
   one call). Line ranges: `git diff -U0 -M base -- <path>`.
3. Untracked: `git ls-files --others --exclude-standard`. Reviewed like added
   files, but the report lists them separately with "not in the PR until
   committed".
4. Content hash per file: `git hash-object <path>` (works for untracked,
   applies `.gitattributes` clean filters, so CRLF/LF does not change it).
5. **Excluded from skill runs** (still seen by mechanical checks):
   lock files (`server/pnpm-lock.yaml`, `client/pnpm-lock.yaml`,
   `reviewer-core/package-lock.json`, `e2e/package-lock.json`);
   `server/src/db/migrations/meta/**`; `client/src/vendor/shared/**` (reviewed
   through the server master + mirror check); build output (`dist/`,
   `agent-runner/dist/**`, `.next/`); binaries and media (`*.mp4`, `*.png`,
   `*.wav`…); deleted files.
6. **Mechanical guards on the same list** (§4): an existing migration (present
   at `base`) with status M, D or R = CRITICAL; `meta/_journal.json` must be
   append-only; a lock file changed without its `package.json` = CRITICAL;
   `*/pnpm-workspace.yaml` in the diff (tracked) = CRITICAL, untracked = note
   ("do not `git add -A`").

## 3. Journal

**Where.** `$(git rev-parse --git-common-dir)/devdigest/pr-self-review/journal.jsonl`
(i.e. `.git/devdigest/…`). Never committed, no `.gitignore` change, shared by
all worktrees of the clone, survives branch switches, disappears with the
clone. (Alternative in D4.)

**Format.** Append-only JSON Lines, one record per event, `v: 1`:

| kind | Fields | Written when |
|---|---|---|
| `check` | `skill`, `skill_rev` (hash of the skill's `SKILL.md`), `path`, `blob`, `base`, `head`, `at`, `result: clean \| findings`, `finding_ids[]` | a checker subagent returned for this pair |
| `mech` | `package`, `command`, `fingerprint` (sha1 of sorted `path:blob` of every changed file in the package and its dependents), `result: pass \| fail`, `summary`, `at` | a typecheck/test command ran |
| `finding` | `id`, `severity`, `skill`, `rule` (raw, for display), `rule_key` (since 2.1.0), `path`, `start_line`, `end_line`, `line_hash`, `blob`, `title`, `at` | a grounded finding was kept |
| `dismissal` | `finding_id`, `skill`, `rule_key`, `path` (the last three since 2.1.0), `blob`, `line_hash`, `reason`, `by` (git `user.name`), `at` | the user dismissed a finding |
| `run` | `base`, `head`, `tree` (`git write-tree` of index or hash of all blobs), `verdict: pass \| blocked`, `counts`, `at` | end of every run |

`finding.id = sha1(skill | ruleKey(rule) | path | line_hash)` (since 2.1.0,
D13; before: the raw `rule` and the line text) — stable when the line moves
or the checker words the rule differently, changes when the line text
changes. `ruleKey` and the id are computed from any `finding` record, so
records written before 2.1.0 get the same stable id in the report; `check`
records keep referencing the id stored at the time.

**A pair is checked** iff a `check` record exists with the same `skill`,
`skill_rev`, `path` and `blob`. Consequences:
- File edited → new `blob` → re-check only that file.
- Skill edited → its pairs re-check only when `skill_rev` changes: for a
  versioned skill `skill_rev` = `v<major>.<minor>` (a patch bump keeps the
  pairs), otherwise the `SKILL.md` hash (D8).
- **Rename** (`R` status): new `path` → re-check. Placement skills depend on
  the path, so reuse across paths is unsafe; renames are cheap. Possible
  optimisation later: reuse `R100` pairs for skills marked
  `metadata.path_sensitive: "false"`.
- **Delete**: no skill pairs; only mechanical guards (§2.6). Old records for
  the path are ignored.
- **Mech** is re-run when its `fingerprint` changes.

**Hygiene.** Tolerant reader (skip bad lines). Compaction on start when the
file exceeds ~5 MB: keep the newest record per key and every `dismissal`
younger than 90 days. Records never hold code or transcript text beyond
`title`.

## 4. Mechanical checks (run first, no LLM)

Order: cheapest and most decisive first; a CRITICAL here still lets the
skill pass run (the user gets one full report), but the verdict is fixed.

1. **Do-not-touch guards** from §2.6 → CRITICAL.
2. **Shared mirror**: a changed `server/src/vendor/shared/<f>` whose
   `client/src/vendor/shared/<f>` is not in the diff → CRITICAL (root
   `CLAUDE.md` "must be mirrored in the same change"). If both changed, a
   checker compares only the touched hunks (the copies already drift in 5
   files — `server/CLAUDE.md`), so no blind diff.
3. **`process.env` in feature code**: added lines matching `process\.env` in
   `server/src/modules/**`, `reviewer-core/src/**`, `client/src/**` (outside
   `platform/config*` / secrets adapters) → CRITICAL (root `CLAUDE.md`
   non-default convention).
4. **Secrets in added lines** (key-shaped strings, `-----BEGIN`, `ghp_`,
   `sk-…`) → CRITICAL.
5. **Typecheck + hermetic tests** of touched packages (§1.2) → fail =
   CRITICAL with the first error lines as evidence. Skipped when the
   package's `fingerprint` already has a `pass`.
6. **Docs/specs rule** (package-docs): a package has code changes but none in
   its `docs/` or `specs/` → WARNING ("or state 'no change needed' in the PR
   body"). **INSIGHTS** checkpoint → reminder, no severity.
7. Heavy suites (integration, e2e) → D1.

## 5. Algorithm

```
1  scope      = changed files (§2) with status, blob, hunks
2  mech       = run §4 guards; queue typecheck/tests per touched package
3  skills     = parse frontmatter of .claude/skills/*/SKILL.md
                → {name, applies_to, skill_rev}; skip skills without applies_to (D3)
4  pairs      = { (s, f) | f ∈ scope, f not excluded, f matches s.applies_to }
5  todo       = pairs − { pairs with a journal `check` on (skill_rev, path, blob) }
6  hints      = transcripts (§5.1) → label todo pairs "likely checked"; never remove them
7  plan       = group todo by skill, split into batches (≤ 15 files or ≤ 800 changed lines)
               if batches > 12 or estimate > 600k tokens → show plan, ask (§10)
8  run        = checker subagents in parallel (cap 6) ‖ typecheck/tests in background
9  ground     = drop findings not on a new-side line of a file in scope (§6), log drops
10 verify     = one verifier pass over CRITICAL skill findings (§7)
11 dismissals = suppress findings with a matching dismissal (§7)
12 journal    = append check / mech / finding / run records
13 verdict    = blocked if any open CRITICAL; else pass
14 report     = §8; if pass and the user asked for a PR → re-check that tree
               still equals the reviewed `run.tree`, then gh pr create
```

**Checker subagent.** A project agent `.claude/agents/skill-checker.md`
with read-only tools (`Read, Grep, Glob, Skill` — no shell: the batch file
carries each diff), no Edit/Write. Prompt per batch: "Invoke the `<skill>`
skill with the Skill tool (C2: subagents can), review ONLY these files and
these line ranges, report only violations of rules the skill states, return
`{checked_files, rules_applied, findings}` (findings per §6)". Only files in
`checked_files` get a journal `check`; a reply that is not that object, has
no `rules_applied`, or misses a batch file makes the run incomplete
(CRITICAL). Added after the first dry-run, where four checkers answered a
bare `[]` in ~10 s and would otherwise have counted as full coverage. One subagent per (skill, batch), so each skill body is
loaded once per batch; the diff hunks are pasted in, the full file is read
on demand. Findings on unchanged lines are asked for explicitly NOT to be
returned (existing violations are not this PR's problem, as
`frontend-architecture` already says).

### 5.1 Reading transcripts (hint source only)

- **Where.** `~/.claude/projects/<encoded>/` where `<encoded>` is the
  session cwd with every non-alphanumeric char replaced by `-`
  (`C:\OSPanel\home\devDigest` → `C--OSPanel-home-devDigest`). Scan the dirs
  for the repo root and for every path in `git worktree list`. Honour
  `CLAUDE_CONFIG_DIR` if set (C5).
- **Files.** `<session>.jsonl` and `<session>/subagents/agent-*.jsonl`
  (+ `.meta.json` with `agentType`) (L4). Pre-filter by file mtime ≥ the
  committer date of `base`.
- **Skill calls.** Lines with `type == "assistant"` whose
  `message.content[]` has `{type:"tool_use", name:"Skill", input:{skill}}`;
  plus user lines containing `<command-name>/<skill></command-name>` (slash
  invocations). Take `timestamp`, `sessionId`, `cwd`, `gitBranch`. Strip a
  plugin prefix (`plugin:skill`) and ignore non-project skills.
- **Files the session worked with.** `tool_use` blocks named `Read`, `Edit`,
  `Write`, `MultiEdit`, `NotebookEdit` → `input.file_path` (absolute,
  normalise slashes and case on Windows, make repo-relative). Entries with
  `attributionSkill == <skill>` are tool calls made while that skill was
  active — the strongest link between a skill and a file.
- **Rule.** Pair (s, f) is "likely checked" when some session in this repo
  called `s` at time `t`, `t > last_change(f)` where
  `last_change = max(file mtime, committer date of the last commit touching f)`,
  and that session touched `f` at or after `t` (or with `attributionSkill = s`).
  mtime can only move forward on checkout, so the error is towards "not
  likely checked" — the safe side.
- **Missing or foreign.** No dir, no files in range, cleaned by
  `cleanupPeriodDays` (default 30, C5), another machine, or a parse error →
  report "transcripts: none usable" and continue; the result is identical
  apart from labels. The format is internal and may change (C6): the reader
  is defensive (unknown lines skipped, any exception → no hints) and lives in
  one small script so a format change is a one-file fix.
- **Privacy.** Only the fields above are read; nothing from transcripts is
  written to the journal or the PR.

## 6. Finding format and grounding

Mirrors `Finding` (`server/src/vendor/shared/contracts/findings.ts:44`) so
the vocabulary is the one the product uses:

```json
{
  "severity": "CRITICAL | WARNING | SUGGESTION",
  "skill": "frontend-architecture",
  "rule": "R1 — index.ts is a component's public boundary",
  "path": "client/src/components/severity-summary/index.ts",
  "start_line": 3, "end_line": 3,
  "evidence": "export * from '../findings-preview';",
  "title": "Barrel re-exports another component",
  "explanation": "…why this breaks the rule…",
  "fix": "Import findings-preview from its own index.ts at the call site.",
  "confidence": "high | medium"
}
```

Gate (a script, not the model; same rules as `reviewer-core/src/grounding.ts`):
- `path` must be in scope; `start_line..end_line` must intersect an added or
  modified new-side line; `evidence` must occur on one of those lines.
  Otherwise drop, and log `dropped "<title>": <reason>` in the report's
  collapsed "dropped" section — never silently.
- Full-file kinds (anchor on line 1 allowed): `placement` (file is in the
  wrong folder — only for added/renamed files) and `mirror` / `do-not-touch`
  (mechanical).
- `rule` must name a rule that exists in the skill (heading or rule id);
  "best practice in general" without a rule → drop.
- `confidence: low` is never returned (security skill's own rule, L7).

## 7. Severity, CRITICAL list, false positives

**CRITICAL — exhaustive list (anything else is at most WARNING):**
1. Do-not-touch violations (§2.6, §4.1).
2. Missing shared mirror, `process.env` in feature code, secret in an
   added line (§4.2–4.4).
3. Typecheck or hermetic test failure in a touched package (§4.5).
4. `security` finding at **HIGH** confidence (vulnerable pattern +
   attacker-controlled input confirmed); MEDIUM → WARNING.
5. Violation of a **mandatory** rule of a DevDigest-owned skill — the rule
   is written as never/must (frontend-architecture R1–R7, onion-architecture
   "✗" cells when it ships) — on an added line.
6. Third-party skills (react, next, fastify, drizzle, zod, postgres, RTL,
   typescript-expert): CRITICAL only for a concrete runtime defect with
   evidence (hook called conditionally, unawaited reply in Fastify, data loss
   in a migration); style/best practice → WARNING/SUGGESTION.

**Never CRITICAL:** review signals (`frontend-architecture` thresholds,
anything a skill calls a "signal" or "consider") → at most SUGGESTION, and
reported as the skill's `Signals:` line; findings on unchanged lines (not
returned at all); `confidence: medium` from any source other than §4.

**Reducing false alarms** (R1, R3, R6):
- Deterministic first: everything in §4 is a script, not an opinion.
- Narrow `applies_to` so skills see only code they have rules for.
- Grounding gate + rule-must-exist (§6).
- **Verify pass**: every skill CRITICAL goes to one extra subagent told to
  disprove it (read the line, the rule, the surrounding code). Not disproved
  → stays CRITICAL; disproved → downgraded to WARNING with the reason shown.
- **Dismissal**: the user says `dismiss <id>: <reason>`. Recorded as a
  `dismissal` with `skill`, `rule_key`, `path`, `line_hash` and `blob`. It
  suppresses the finding while its content key (skill | rule key | path |
  line hash) and `blob` both match (same rule, same line, same file content)
  — D13. An old record with only `finding_id` resolves through the finding
  record with that id.
  If the file changed but the same line text still exists, the finding
  returns marked "previously dismissed: <reason>" (D12 decides whether it
  blocks). Dismissals are allowed for skill findings only; §4 failures are
  fixed, not dismissed (D2).
- Precision loop: the report counts dismissals per skill/rule; a rule with
  repeated dismissals is a candidate to demote or reword in its skill (R3).

## 8. Report

Terminal report (in the user's language), then — only when verdict is pass
and a PR is being created — the PR-body section in English:

```
pr-self-review — lesson-1 vs main (c6af1e4) · BLOCKED
Scope: 71 files (3 untracked, not in PR until committed) · excluded 9 (lock, meta, vendor copy)
Checks: 7 skills × 58 files = 142 pairs · 118 from journal · 24 run now (6 "likely checked" in transcripts)
Mechanical: server typecheck ✓ tests ✓ · client typecheck ✗ (CRITICAL) · guards ✓
Findings: 2 CRITICAL · 5 WARNING · 3 SUGGESTION · 1 dismissed · 4 dropped by grounding
Not covered by any skill: e2e/run.ts, scripts/dev.sh
CRITICAL
  1. [a3f9c1] client/src/app/pulls/page.tsx:42 — frontend-architecture R4 …  fix: …
  …
Next: fix, or `dismiss <id>: <reason>` (skill findings only), then re-run.
```

PR body section:

```
### Self-review (pr-self-review)
- Skills: frontend-architecture, react-best-practices, security, … (7) over 58 files; typecheck/tests: server ✓ client ✓
- Findings: 0 critical · 3 warning · 2 suggestion (listed below, not blocking)
- Dismissed: [a3f9c1] frontend-architecture R4 at client/…/page.tsx:42 — "<reason>" (by vvysotsk)
- Not covered by a skill: e2e/run.ts
```

## 9. Changes to other files (when the skill is built)

- Add `metadata.applies_to` (and keep existing metadata keys) to:
  `frontend-architecture`, `react-best-practices`, `next-best-practices`,
  `react-testing-library`, `fastify-best-practices`, `drizzle-orm-patterns`,
  `postgresql-table-design`, `zod`, `security`, `typescript-expert`; and to
  `onion-architecture` in the change that creates its `SKILL.md`.
  `frontend-architecture` is versioned — bump its `metadata.version` per its
  `README.md` rules. Do not add `applies_to` to engineering-insights,
  package-docs, mermaid-diagram, devdigest-demo.
- New `.claude/agents/skill-checker.md` (read-only checker, §5).
- `.claude/skills/README.md` catalog: add pr-self-review and an
  "applies_to" column.
- Root `CLAUDE.md`, section "Before every commit" → add "Before
  `gh pr create` / pushing a branch for a PR: run `pr-self-review`; do not
  open the PR while it reports an open CRITICAL."
- pr-self-review's own frontmatter: model-invocable (the description names
  "before opening a PR, gh pr create, push for review") — **superseded by D14
  (2.2.0): user-invoked only, `disable-model-invocation: true`**; `argument-hint:
  [--base <ref>] [--full]`, `allowed-tools` limited to git read commands and
  the §1.2 commands.
- Root `INSIGHTS.md`: one entry when the skill ships (tooling decision).
- **Possible extension (not now):** a `PreToolUse` hook on `Bash` that parses
  `tool_input.command` for `gh pr create` / `git push` and exits 2 unless the
  newest journal `run` for the current tree is `pass` (C4).

## 10. Budget

Rough per-subagent cost: skill body 2–12k tokens (75–603-line SKILL.md,
plus references read on demand) + batch hunks + files it opens + JSON out ≈
25–60k tokens, 1–3 min.

| Diff | Pairs → batches | Subagents | Tokens | Wall time |
|---|---|---|---|---|
| Typical: 10 files / 500 lines, one package | 4–6 skills × 1 batch | 4–6 + ≤2 verify | 150–350k | 2–4 min (cap 6 parallel), tests in parallel |
| Re-run after fixing 2 files | only changed pairs | 1–3 | 30–120k | ~1 min |
| This branch (L5): 71 code files, ~6.2k lines | ~40 batches | ~40 | ~1.5–2M | too big |

Large diff policy: when batches > 12 or the estimate > 600k tokens, stop
before spawning and show the plan with the estimate and three choices:
(a) run everything, (b) blocking-only pass — mechanical checks + skills that
can raise CRITICAL (security, frontend-architecture, onion-architecture),
the rest reported as "not checked", (c) split the PR. Concurrency cap 6
(the platform allows 20, C2; 6 keeps rate limits and the report readable).
`--full` ignores the journal (fresh audit).

## 11. Decisions

| # | Question | Options | Recommendation → **Decided** |
|---|---|---|---|
| D1 | Which tests run | (a) typecheck + hermetic tests of touched packages and their dependents; (b) always all four packages; (c) also Docker suites (server integration, e2e hermetic) | (a); Docker suites only when `server/src/db/**` or `server/src/modules/**/repository*` changed AND Docker is up, else a WARNING "integration not run" → **(a)**, plus `client` and `reviewer-core` as dependents of `server/src/vendor/shared`; Docker suites only for DB code with Docker up, else WARNING "integration not run" |
| D2 | Who may dismiss a CRITICAL | (a) the author, with a reason; (b) nobody — fix only; (c) author for skill findings, nobody for mechanical | (c) → **(c)** |
| D3 | Skills without `applies_to` | (a) ignored silently; (b) ignored and listed in the report as "not routed"; (c) run on every file | (b) — explicit, no cost → **(b)** |
| D4 | Journal location | (a) `.git/devdigest/…` (per clone, never committed); (b) `~/.devdigest/…` (per machine, like secrets); (c) committed file (shared with team, merge conflicts, dismissals become reviewable) | (a); revisit (c) only if dismissals need team review → **(a)**, located via `git rev-parse --git-common-dir` |
| D5 | Can third-party skills raise CRITICAL at all | (a) only for a concrete runtime defect (§7.6); (b) never; (c) same as owned skills | (a) → **(a)** |
| D6 | typescript-expert | (a) narrow `applies_to` (§1.1); (b) every `*.ts`; (c) exclude from self-review | (a) or (c) — it is a persona with one checklist → **(c)** excluded |
| D7 | Base ref | `main` (local) vs `origin/main` (needs a fetch) | `origin/main` when it exists, no automatic fetch; report which one → **origin/main, no fetch**; the report names the ref and the age of the last fetch (`FETCH_HEAD` mtime) |
| D8 | Skill edit invalidates its checks | (a) yes, whole `SKILL.md` hash; (b) only when `metadata.version` changes; (c) only when `major.minor` changes | (b) for versioned skills, (a) otherwise → **(b)** + WARNING "skill edited without version bump" when `SKILL.md` changed but `metadata.version` did not; unversioned skills use the content hash. **Revised 2026-09-27 (2.0.0) → (c):** a patch bump is wording by every skill's versioning rule, and under (b) it re-ran every pair of that skill (onion 1.1.0 → 1.1.1 re-queued 4 batches, ~266k tokens, for no rule change). Journal records with a full version read as `major.minor`. The "without version bump" WARNING stays |
| D9 | Uncommitted/untracked at PR time | (a) review and block PR creation until committed; (b) review, warn, create PR from commits only | (a) — otherwise the reviewed state ≠ the PR → **(a)** |
| D10 | Large-diff threshold | batches > 12 / > 600k tokens | as proposed; tune after first real runs → **as proposed** |
| D11 | e2e has no checker skill | (a) accept (typecheck + flow contract); (b) write an e2e-flows skill later | (a) now, listed as a gap → **(a)**, the e2e gap is shown in every report |
| D12 | Dismissal after the file changed but the line is the same | (a) re-blocks (strict, as specified); (b) shown as "previously dismissed", non-blocking | (a) strict for CRITICAL, (b) for WARNING → **as proposed** |
| D13 | Finding identity (added 2026-09-27, 2.1.0) | (a) hash the raw `rule` from the checker (as before); (b) hash a normalized rule key; (c) keep (a) and fuzzy-match dismissals | (b) → **(b)**: `ruleKey` = the rule id when the head (text before " — ", `(…)` removed) starts with one or is only ids (priority R > A > check > §), else the head up to ":"; id = sha1(skill \| rule key \| path \| line hash); dismissals match by that content per blob; old records resolve through their finding record. Why: re-checks are routine (`--full --skills`, minor bumps) and a checker words the same rule differently per run, which gave new ids — dismissed findings came back and one issue showed twice (journal: `b4faee06` / `1a435fbc`, same line of `FindingsHoverCard.tsx`). Residual risks: onion `check N` vs `R<n>` wording still gives two keys (only `checker.md`, "prefer `R<n>`", mitigates it); a head-level key merges two rules under one heading on the same line, so dismissing one hides the other; citing another line of a range still changes `line_hash` (unchanged) |
| D14 | Who starts the gate (added 2026-09-28, 2.2.0) | (a) model-invocable — the agent runs it before `gh pr create` (as built in §9); (b) user-invoked only (`disable-model-invocation: true`), the agent asks the user to run `/pr-self-review` | (b) → **(b)**. Why: the L02 final check needs the gate run manually; the flag also blocks preloading the skill into subagents (`sources.md:11`, C-docs). Unchanged: "Settled (1)" — the skill itself still refuses `gh pr create` / a push for review while a CRITICAL is open; only who starts it changes. Risk: an agent that forgets to ask opens a PR ungated — mitigated by the root `CLAUDE.md` rule "Before opening a PR" |

## 12. Open questions

- 2026-09-27 — **A finding is not invalidated when a related file changes.**
  A skill finding stays open as long as its own file keeps the same blob:
  the report rebuilds open findings from the latest journal `check` of every
  current (skill, rev, path, blob) pair and its `finding_ids`
  (`scripts/self-review.mjs:787-805`), and `plan` serves that pair from the
  journal without re-running it (`scripts/self-review.mjs:530-533`). When the
  fix lives in ANOTHER file — e.g. an onion R3 finding on
  `server/src/modules/pulls/routes.ts:46` / `:55` ("route has a response
  schema but no shape test"), fixed by adding the shape test in
  `server/test/pulls-comments.it.test.ts:85`, `:108` (ed642df) — nothing
  re-checks the route and the finding keeps showing until the user dismisses
  it. Options to decide later: (a) let a checker declare "related paths" per
  finding and invalidate on their blob change; (b) re-run a pair whenever any
  file in the same batch changed; (c) keep manual dismissal (current). Not
  fixed yet.
  - 2026-09-27 RESOLUTION — option **(d)**, chosen by the user: when a
    finding's fix lands in ANOTHER file, re-run that skill in full,
    `plan --full --skills <skill>`, instead of dismissing the finding. (a)
    and (b) are not built: they tie checkers to file relations (imports,
    tests, batches) for a rare case and add coupling for little gain. (d)
    needs no new code: `--full` ignores the journal (`scripts/self-review.mjs:533`),
    `ground` appends a fresh `check` record per checked file — `clean` with
    empty `finding_ids` when the finding no longer holds (`:713`) — and
    `report` keeps the LATEST check record per (skill, rev, path, blob)
    (`:787-803`, `Map.set` in journal order), so the new clean record
    replaces the old one. Journal evidence for this exact case,
    `server/src/modules/pulls/routes.ts` at the unchanged blob `1ba03e79`:
    the onion v1.0.1 check of 2026-09-26T22:47:23Z (head 160b523) raised
    b01dbdca / ef6bc205; the user dismissed both at 23:08:11Z / 23:08:24Z
    ("shape tests added in ed642df"); the onion v1.1.0 check of
    2026-09-27T12:10:12Z (head 3b724d5) of the same blob is `clean` with
    `finding_ids: []` — a fresh re-check alone cleared them.
- 2026-09-27 — **A journal finding outlives a base change** (fixed in 2.1.1).
  The check key (skill, rev, path, blob) has no base, so when the base moved
  from `c6af1e4` to `8ae46a9` a file at the same blob was served from the
  journal and its finding on `client/src/app/repos/[repoId]/pulls/page.tsx:107`
  (27ff45e6) was still reported, although that line had merged into `main`.
  Fix: `report` keeps a journal finding only while its `line_hash` is the hash
  of a current added line (placement findings: while the file is added, moved
  or untracked); `plan` records `added_hashes`; legacy plans use the live scope
  only for files still at the planned blob (`scripts/journal-keys.mjs`
  `filterInfo` / `stillAdded`). **Residual risk, not done:** when the base
  moves BACK, the added set grows and the old check does not cover the new
  lines — they are neither checked nor reported until the file's blob or the
  skill revision changes. Detecting it needs the added set (or the base) in
  the check key, which is a major change to the "checked" definition.
