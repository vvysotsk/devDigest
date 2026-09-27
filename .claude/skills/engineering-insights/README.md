# engineering-insights — README

The agent loads `SKILL.md` only; this file is for people maintaining the skill.

## What it does

Keeps the lessons of one session for the next one. Each package has an
`INSIGHTS.md` (`server/`, `client/`, `reviewer-core/`, `e2e/`; the root file
is only for repo tooling). The agent writes an entry when something
non-obvious happens: a test fails for a real reason, the user corrects the
approach, something needs a second attempt, a tool behaves unexpectedly, or
the agent picks one option over another for a reason the code does not
show.

## How it works

1. **Capture at the moment.** The agent writes the entry in the same turn
   as the event, while the evidence is on screen, not at the end of the
   session.
2. **Quality gate.** One question: would an agent new to this area, reading
   only the file it is about to change, repeat this mistake or lose time on
   it? If yes, write it. Typos, obvious error messages, "implemented X" and
   generic advice do not qualify.
3. **Routing.** The entry goes to the `INSIGHTS.md` of the package that
   contains the evidence file. A lesson that spans packages gets one entry in
   each of them.
4. **Format.** One line: date, what to do or avoid and the alternative, and
   the evidence as `path:line` (plus the command or error text for
   environment lessons). An entry without a line number is not finished.
   Sections are fixed.
5. **Append-only.** Entries are never rewritten or deleted. A correction is
   a dated note under the old entry. A lesson every session must see is
   promoted to the package `CLAUDE.md`.
6. **Checkpoint before every commit.** The agent lists this task's
   candidates, writes the ones that pass the gate, and ends the report with
   `INSIGHTS: +N in <files>` or `INSIGHTS: none — <reason>`. Root
   `CLAUDE.md` → "Before every commit" makes this mandatory.

A person owns maintenance: spot-check new entries, prune monthly, merge
duplicates, and split a file past about 200 entries into
`INSIGHTS-<domain>.md`.

**Not in self-review.** The skill has no `metadata.applies_to`, so
`pr-self-review` does not route files to it. It is a process skill: the
checkpoint happens at commit time, not at PR time.

## Files

- `SKILL.md` — triggers, checkpoint, quality gate, routing, entry format,
  sections, rules, wrap-up workflow.
- `examples.md` — weak and strong entries, real ones from this repo, how to
  correct an entry and how to resolve a contradiction.

## Changelog

The skill has no `metadata.version`. Add a dated line here when you change
`SKILL.md` or `examples.md`.

- **2026-09-24** — rewrite, because the first version produced almost empty
  INSIGHTS files: event triggers captured in the same turn, a mandatory
  checkpoint before every commit with the `INSIGHTS:` report line, routing
  by the package of the evidence file, date and `path:line` required, the
  "new agent" quality gate, and real examples from this repo.
- **2026-09-18** — first version: per-module `INSIGHTS.md` with seven fixed
  sections, append-only, capture "proactively" and at wrap-up.

## Planned

Deterministic capture with a Stop hook is a later course lesson (L06). Until
then, capture depends on the agent following the triggers and the
checkpoint.
