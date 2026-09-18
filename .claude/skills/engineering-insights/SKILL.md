---
name: engineering-insights
description: "Captures non-obvious engineering insights into the project's per-module INSIGHTS.md files (append-only). Use proactively in ANY session the moment a durable lesson appears — a debugging dead end, a surprising library/tool behavior, a decision with a non-obvious reason, a recurring error with its fix, an approach that worked or failed. Also use as a wrap-up at the end of any meaningful task (over 30 minutes with a problem, solution, or discovery) or when the user says insights, learnings, lessons, retro, or wrap-up."
---

# Engineering Insights

Persist lessons across sessions by appending them to the right module's
`INSIGHTS.md`. The file is what the previous session's agent left for the
current one — treat writing it as part of the job, not an afterthought.

See `examples.md` for vague-vs-useful entry pairs and correction/conflict
patterns.

---

## When to capture / when to skip

**Two triggers:**

1. **Capture as you go** — the moment something non-obvious happens: a fix that
   took real debugging, a library behaving unexpectedly, a decision made for a
   reason the code doesn't show, a dead end worth not repeating.
2. **Wrap-up** — at the end of any meaningful task (>30 min with a problem,
   solution, or discovery), review the session and extract **2–5** entries.
   Not more: signal quality beats volume.

**Skip (do not write):**

- Trivial edits, config touch-ups, routine renames.
- Anything obvious to anyone reading the code — the test for every entry:
  *"If this would be obvious to anyone reading the code — don't write it."*
- Anything the linter/typecheck already catches.
- A replay of what happened — extract the lesson, not the history.

## Routing — which INSIGHTS.md

Write to the file of the package the work actually touched:

| Work touched | File |
|---|---|
| `server/**` | `server/INSIGHTS.md` |
| `client/**` | `client/INSIGHTS.md` |
| `reviewer-core/**` | `reviewer-core/INSIGHTS.md` |
| `e2e/**` | `e2e/INSIGHTS.md` |
| Multiple packages, repo tooling (scripts, docker, git, CI), shared contracts, docs | `INSIGHTS.md` (root) |

## File sections — where an insight goes

Every INSIGHTS.md has the same seven fixed sections. Append under the one that
fits; never invent new sections:

| Section | What belongs there |
|---|---|
| What Works | Approaches and solutions that succeeded here |
| What Doesn't Work | Dead ends and antipatterns (most-skipped, most valuable) |
| Codebase Patterns | Conventions and architectural decisions, with the why |
| Tool & Library Notes | Dependency quirks, version surprises |
| Recurring Errors & Fixes | Errors seen more than once + the fix |
| Session Notes | Dated one-line session summaries (wrap-up only) |
| Open Questions | Things left unresolved or unverified |

## Entry format

```
- YYYY-MM-DD: <actionable statement> (evidence: file:line, command, or error message)
```

Quality gate — an entry must be **actionable cold**: an agent reading it with
zero session context knows exactly what to do or avoid. Name the concrete
module/file/command; state the alternative, not just the problem.

## Rules

- **Append-only.** Never rewrite or delete existing entries. To correct an
  outdated entry, append a dated note referencing it (see `examples.md`).
  Two entries that contradict each other → append an explicit dated resolution.
- **Read before writing.** Open the target file first; if the lesson is already
  there, don't duplicate it (extend it with a dated note if you learned more).
- **English**, terse and declarative — the format is optimized for an LLM
  reader, matching the rest of the repo's docs.
- Findings that harden into permanent rules get **promoted**: to the module's
  `CLAUDE.md` if they must be seen every session, or to a hook/slash command if
  they must be deterministic. Note the promotion in INSIGHTS.md.

## Wrap-up workflow

Copy this checklist and work through it:

```
Wrap-up:
- [ ] 1. Review the session: attempts, errors, decisions, surprises, dead ends
- [ ] 2. Draft candidates; apply the quality gate to each (aim for 2–5 survivors)
- [ ] 3. Route each entry to its module's INSIGHTS.md (table above)
- [ ] 4. Read each target file; drop duplicates
- [ ] 5. Append entries under the correct sections
- [ ] 6. Add one dated line to Session Notes summarizing the session
- [ ] 7. Report to the user: what was written, to which files
```

If nothing survives the quality gate, say so and write nothing — an honest
empty wrap-up beats generic filler.

## Maintenance (human-owned, not this skill's job)

- INSIGHTS.md is a **draft under review** — the human spot-checks entries;
  a wrong summary is corrected, not trusted.
- Monthly prune: delete obsolete entries (a stale quirk-note is worse than
  none), consolidate near-duplicates, resolve contradictions.
- Over ~200 entries in one file → split into domain files
  (`INSIGHTS-<domain>.md`) and link them from the main one.
- **L06 bridge:** the manual trigger is known to be unreliable ("if you skip
  the wrap-up, the system doesn't learn"). When that friction becomes real, a
  Stop-hook will make capture automatic — that is a planned course lesson, not
  something to improvise now.
