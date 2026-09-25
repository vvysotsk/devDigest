---
name: engineering-insights
description: "Captures engineering lessons into the per-package INSIGHTS.md (server/, client/, reviewer-core/, e2e/; root only for repo tooling). Use IMMEDIATELY, in the same turn, when any of these happens: a test or typecheck fails for a reason other than a typo; the user or a reviewer corrects your approach, plan or assumption; something needed more than one attempt; a library, tool or the environment behaved unexpectedly; you chose one approach over another for a reason the code does not show. Also MANDATORY before every commit (insights checkpoint), and when the user says insights, learnings, lessons, retro or wrap-up."
---

# Engineering Insights

`INSIGHTS.md` is the memory one session leaves for the next. An empty file
after a week of work means lessons were lost, not that there were none: every
failed test, correction and second attempt is a candidate. Writing it is part
of the task, like tests.

Examples of weak vs strong entries: `examples.md`.

---

## Triggers — capture in the same turn

Write the entry the moment the event happens, while the evidence is on screen.
Do not postpone to "the end of the session" — by then it is forgotten.

| Event | Typical section |
|---|---|
| A test/typecheck failed and the fix was not a typo | Recurring Errors & Fixes / What Doesn't Work |
| The user or a reviewer corrected the approach, a plan item, or an assumption | What Doesn't Work / Codebase Patterns |
| An assumption about the code turned out wrong (a function returns more/less than its name says, a field means something else) | Codebase Patterns |
| Anything needed a second attempt (command, config, query, selector) | Recurring Errors & Fixes |
| A library, tool, OS or environment surprised you | Tool & Library Notes |
| You picked A over B for a reason the code does not show | Codebase Patterns / What Works |

## Checkpoint before every commit (mandatory)

Before `git commit`, list this task's candidates from the triggers above, then:
- write the ones that pass the gate, or
- state explicitly: `INSIGHTS: none — <why nothing qualified>`.

The task report ALWAYS has one line:
`INSIGHTS: +N in <file(s)>` or `INSIGHTS: none — <reason>`.

## Quality gate

Ask: **"Would an agent new to this area — reading only the file it is about
to change — repeat this mistake or lose time on it?"** Yes → write it.

- It qualifies even if the fact is technically visible somewhere in the code:
  the question is whether the CALLER would notice. Example: `resolveRunCost`
  returns a stored cost for failed runs — visible in `run-cost.ts`, invisible
  from `pulls/routes.ts`, and it broke a test.
- It does NOT qualify: typos, a lint/typecheck error with an obvious message,
  a replay of what was done ("implemented X"), generic advice ("be careful
  with async").
- No upper limit per task; no filler either.

## Routing — the package of the evidence

The entry goes to the `INSIGHTS.md` of the package that contains the evidence
file:

| Evidence file under | File |
|---|---|
| `server/**` | `server/INSIGHTS.md` |
| `client/**` | `client/INSIGHTS.md` |
| `reviewer-core/**` | `reviewer-core/INSIGHTS.md` |
| `e2e/**` | `e2e/INSIGHTS.md` |
| repo tooling only: `scripts/`, `.gitattributes`, `docker-compose.yml`, git, `.claude/`, Claude Code itself | `INSIGHTS.md` (root) |

A lesson that spans packages → one entry in EACH package, each with its own
evidence line. Never park a package lesson in the root file because the task
was "cross-package". Session Notes also go to each touched package.

## Entry format

```
- YYYY-MM-DD: <what to do / avoid, and the alternative> (evidence: <path>:<line>[, command or error text])
```

- **Date and `path:line` are required.** Path relative to the package root
  (`src/modules/_shared/run-cost.ts:28`). An entry without a line number is
  not finished — open the file and find the line.
- Environment lessons: cite the file the command runs (`scripts/dev.sh:37`,
  `package.json:12`) plus the exact error text.
- Actionable cold: name the module/file/command and the alternative.
- English, terse, declarative.

## Sections (fixed — never invent new ones)

What Works · What Doesn't Work · Codebase Patterns · Tool & Library Notes ·
Recurring Errors & Fixes · Session Notes · Open Questions

## Rules

- **Append-only.** Never rewrite or delete an entry; correct with a dated
  note under it (see `examples.md`). Contradiction → dated RESOLUTION line.
- **Read the target file first**; extend an existing entry with a dated note
  instead of duplicating it.
- **Promote** a lesson that must be seen every session to the package
  `CLAUDE.md`; note the promotion in INSIGHTS.md.
- A line number drifted after an edit → append a dated note with the new
  `path:line`, do not edit the old entry.

## Wrap-up / backfill workflow

```
insights:
- [ ] 1. Collect candidates: failed tests/typechecks, user corrections, retries,
         surprises, non-obvious choices (scan the conversation and git log -p)
- [ ] 2. Apply the gate; route each survivor by its evidence file
- [ ] 3. Read each target file; drop duplicates, extend near-duplicates
- [ ] 4. Find exact path:line for every entry
- [ ] 5. Append under the right section; one dated Session Notes line per touched package
- [ ] 6. Report: INSIGHTS: +N in <files> | none — <reason>
```

## Maintenance (human-owned)

INSIGHTS.md is a draft under review: the human spot-checks, prunes monthly,
consolidates duplicates, splits a file past ~200 entries into
`INSIGHTS-<domain>.md`. Deterministic capture (a Stop hook) is a planned
course lesson (L06) — do not improvise it now.
