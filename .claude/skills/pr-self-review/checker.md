# pr-self-review — checker instructions (read by a checker subagent)

You check ONE batch: one skill × a few changed files. You are read-only:
never edit, write, commit or run commands. The batch file already holds each
file's diff (with context); Read the current file, and Grep/Glob the repo,
when a rule needs more.

1. Read the batch file you were given (JSON: `skill`, `files[]` with
   `path`, `status`, `added_lines`, `diff`, and `findings_file`).
2. Load the skill with the Skill tool (`skill: <skill>`). If the Skill tool
   is unavailable, Read `.claude/skills/<skill>/SKILL.md` instead and add
   `"SKILL.md read directly"` to `rules_applied`. Open the skill's reference files only when a rule
   points to them.
3. Review ONLY the added/changed lines in each file's `diff`
   (`added_lines`). Read the whole file or its neighbours when a rule needs
   context (imports, folder placement, the route's test). Existing code on
   unchanged lines is out of scope even if it breaks a rule.
4. Report only violations of a rule the skill actually states. No rule
   → no finding. Anything the skill calls a "signal", "consider" or a
   threshold is at most `SUGGESTION`. The `rule` field is the rule's name
   ONLY, so the same finding keeps its id when checked again:
   - the id alone when the skill numbers its rules: `R3`, `check 7`, `A05`.
     When a rule has both (onion: `R3` / `check 2`), use `R<n>`;
   - otherwise the exact section heading from the skill's SKILL.md:
     `Component Design`, `Review signals`, `Map`.
   The specific sub-rule (a signal name, a Map row) and the reasoning go in
   `title` and `explanation`, never in `rule`.
5. Severity:
   - `CRITICAL` — only (a) a must/never rule of a skill marked blocking
     (frontend-architecture, onion-architecture), (b) `security` at HIGH
     confidence (vulnerable pattern + attacker-controlled input traced),
     (c) any skill: a concrete runtime defect you can point to (hook called
     conditionally, unawaited reply, data loss).
   - `WARNING` — a stated rule is broken, no concrete defect.
   - `SUGGESTION` — signals, style, "consider".
   - Low confidence → do not report. Medium → at most `WARNING`.
6. Every finding cites an added line: `start_line`/`end_line` from the new
   side, and `evidence` = the exact text of one cited added line (copy it).
   A finding that is about where a NEW or MOVED file lives uses
   `"kind": "placement"`, `start_line: 1`, `evidence: ""`.
7. Output: ONE JSON object, nothing else:

```json
{
  "checked_files": ["server/src/modules/pulls/routes.ts"],
  "rules_applied": ["R2", "R3", "check 7"],
  "findings": [{
    "severity": "WARNING",
    "rule": "R3",
    "path": "server/src/modules/pulls/routes.ts",
    "start_line": 88, "end_line": 88,
    "evidence": "app.get('/pulls/:id/meta', async (req) => {",
    "title": "New route without schema.response",
    "explanation": "One or two sentences: what breaks and why the rule applies.",
    "fix": "Concrete change.",
    "confidence": "high"
  }]
}
```

- `checked_files` — every batch file you actually reviewed against the
  skill, exactly as its `path` in the batch. Leave out a file you did not
  get to; do not list a file just because it has no findings unless you
  checked it. Only listed files are recorded as checked; the rest are
  planned again and the run is marked incomplete.
- `rules_applied` — the rule ids or headings of the skill you checked the
  files against (all of them, not only the violated ones). Empty means
  nothing was checked.
- `findings` — `[]` when clean.

Return the object as your final message (the orchestrator saves it to
`findings_file`). Keep `explanation` and `fix` short.
