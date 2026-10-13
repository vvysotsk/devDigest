# pr-self-review — sources

Ids are cited in `plan.md` as `[C1]`, `[R2]`, `[L3]`. Checked 2026-09-26.
"Verified" = the page was fetched and the quoted fact read directly;
"agent" = reported by a research subagent and not re-fetched.

## C — Claude Code / Agent Skills documentation

| Id | Source | What it establishes | Status |
|---|---|---|---|
| C1 | https://code.claude.com/docs/en/skills | Frontmatter table: `paths` = globs that limit auto-activation ("loads the skill automatically only when working with files matching the patterns"); `metadata` = "free-form YAML map … read by your own tooling … Claude Code doesn't act on its contents … Don't reuse frontmatter field names such as `paths` as keys"; `context: fork` + `agent`; `disable-model-invocation` also blocks preloading into subagents; `user-invocable: false` only hides from `/`; unknown fields are ignored silently. Nothing documented about one skill invoking another. | verified |
| C2 | https://code.claude.com/docs/en/sub-agents | `skills:` preloads full skill content; without it a subagent "can still discover and invoke project, user, and plugin skills through the Skill tool"; block with `disallowedTools`. Default 20 concurrent subagents (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`); nesting up to 3 layers (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`); own context window. | verified |
| C3 | https://agentskills.io/specification | `metadata`: "a map from string keys to string values … make your key names reasonably unique". Lists are outside the open spec → `applies_to` is a comma-separated string. | verified |
| C4 | https://code.claude.com/docs/en/hooks and https://code.claude.com/docs/en/hooks-guide | `PreToolUse` with matcher `Bash`; the hook gets `tool_input.command` and `transcript_path`; exit code 2 blocks. Basis for the deferred hook extension. | agent |
| C5 | https://code.claude.com/docs/en/settings | `cleanupPeriodDays` (default 30) deletes old transcripts; `CLAUDE_CONFIG_DIR` moves `~/.claude`. | agent |
| C6 | https://code.claude.com/docs/en/sessions (as reported) | Transcripts at `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`; the JSONL format is internal and not a stable API. | agent — format itself verified locally, see L4 |

## R — Review practice (false positives, blocking rules)

| Id | Source | Used for |
|---|---|---|
| R1 | https://claude.com/blog/code-review | Parallel reviewers, then a verification step that tries to disprove each finding before ranking by severity; low rejection rate is what keeps developers reading the bot. → verify pass for CRITICAL (plan §7). |
| R2 | https://github.com/anthropics/claude-code-security-review | Security review action with a dedicated false-positive filtering stage and exclusion of low-impact categories. → security findings below HIGH confidence never block. |
| R3 | https://cacm.acm.org/research/lessons-from-building-static-analysis-tools-at-google/ (Sadowski et al., CACM 2018) | Tricorder: checks with a high "effective false positive" rate get disabled; developers must be able to mark "not useful"; only checks that are almost never wrong may break the build. → blocking list is short and mechanical first (plan §6), dismissals are first-class (plan §7). |
| R4 | https://google.github.io/eng-practices/review/reviewer/comments.html | Label severity of comments ("Nit:", "Optional", "FYI") so the author knows what is mandatory. → every finding carries severity; signals are never blocking. |
| R5 | https://conventionalcomments.org/ | `(blocking)` / `(non-blocking)` decorations as an explicit contract. → report groups by blocking vs non-blocking. |
| R6 | https://www.coderabbit.ai/blog/how-coderabbit-delivers-accurate-ai-code-reviews-on-massive-codebases | Combine deterministic tools (linters, scripts) with the LLM and verify assumptions with executed checks before posting. → mechanical checks first, LLM only on top. (agent) |

## L — Local evidence (this repo / this machine)

| Id | Evidence |
|---|---|
| L1 | Skill inventory: `.claude/skills/*/SKILL.md` frontmatter (only `fastify-best-practices` and `frontend-architecture` have `metadata`; `next-best-practices` has `user-invocable: false`; `typescript-expert` carries non-standard keys `category/risk/source/date_added`). `onion-architecture/` holds only `plan.md` (another task, untracked). |
| L2 | Severity model: `reviewer-core/src/output/to-review.ts:17-23` (`CRITICAL/WARNING/SUGGESTION`, `SEV_RANK`), `:151` (`failOn` default `critical`); score weights `reviewer-core/src/review/reduce.ts:13-17`; `Finding` contract `server/src/vendor/shared/contracts/findings.ts:44-58`. |
| L3 | Grounding gate: `reviewer-core/specs/grounding-gate.md` — findings outside the diff file set or outside new-side hunk lines are dropped with a logged reason (`reviewer-core/src/grounding.ts:41-80`); full-file kinds exempt (`:16`). |
| L4 | Transcript format observed on this machine, `~/.claude/projects/C--OSPanel-home-devDigest/`: `<session>.jsonl` + `<session>/subagents/agent-<id>.jsonl` with `agent-<id>.meta.json` (`agentType`, `description`). Entry fields include `type`, `timestamp` (ISO UTC), `cwd`, `gitBranch`, `sessionId`, `isSidechain`, `attributionSkill`, `message.content[]`. Skill calls = `type:"assistant"` block `{type:"tool_use", name:"Skill", input:{skill, args?}}`; slash commands = user text `<command-name>/name</command-name>`; Edit/Write/Read carry `input.file_path` (absolute, Windows backslashes). `attributionSkill` counts seen: devdigest-demo 88, git-commit-style 74, engineering-insights 52, package-docs 29. No `Skill` call found inside any subagent transcript so far. |
| L5 | Scale of a real branch: `lesson-1` vs merge-base `c6af1e45` = 112 files; code: client 54 files / 2 084 lines, server 17 / 4 092 (the rest is Markdown, demo inputs, `.gitattributes`). |
| L6 | Rules the mechanical checks enforce: root `AGENTS.md` → "Do not touch", "Non-default conventions", "Verification"; `server/AGENTS.md` → "Do not touch" (migrations, lock, `src/vendor/shared` mirror, score recomputed from grounded findings); `TESTING.md` suite map (server-integration and e2e need Docker). |
| L7 | Existing "not blocking" precedent: `frontend-architecture/SKILL.md:137-160` "Review signals (not rules)" and the `Signals:` report line; `security/SKILL.md:12-24` confidence table (LOW = do not report). |
