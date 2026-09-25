---
name: package-docs
description: "Keeps each package's curated docs/ (how it works) and specs/ (what must stay true) in sync with the code. Use proactively at the end of ANY task whose diff touches server/, client/, reviewer-core/ or e2e/ — before reporting the task as done — and whenever a route, response shape, UI surface, pipeline stage, DI wiring or e2e precondition changes. Also use to seed or rebuild a package's docs/specs from scratch, or when the user says docs, specs, architecture doc, or 'update the docs'."
---

# Package docs & specs

Every package keeps two curated files that describe the code AS IT IS. They are
the first thing an engineer or agent reads before touching the package, so a
stale doc is a bug. This skill is the "definition of done" step for docs.

Templates and a good-vs-bad example: see `templates.md`.

---

## The files

| Package | docs (HOW it works) | specs (WHAT must stay true) |
|---|---|---|
| server | `server/docs/architecture.md` | `server/specs/review-flow.md` |
| client | `client/docs/ui-architecture.md` | `client/specs/pages.md` |
| reviewer-core | `reviewer-core/docs/pipeline.md` | `reviewer-core/specs/grounding-gate.md` |
| e2e | `e2e/docs/architecture.md` | `e2e/specs/flows-contract.md` |

A package may get MORE files when one grows past ~300 lines or a new area
appears (e.g. `server/specs/pr-list.md`); link every new file from the
package `CLAUDE.md` → "Read when" in the same change.

**docs/** — architecture and data flow: layers, boundaries, who calls whom,
where state lives, why the structure is the way it is. Answers "how does it
work / where do I put X".

**specs/** — observable behaviour and contracts that tests or users rely on:
routes and response shapes, UI surfaces and their empty/loading/error states,
pipeline invariants, seed-data preconditions. Answers "what must still be
true after my change". Each rule is checkable against code or a test.

**Not here:** lessons and gotchas → `INSIGHTS.md` (engineering-insights skill);
course feature specs → root `specs/LNN-<slug>.md`; history → git.

## When to run

1. **Task wrap-up (mandatory).** Before reporting a task done, for every
   package the diff touches, decide per file: update, or "no change needed —
   <reason>". Report the decision.
2. **Trigger events during work:** a new/changed route or response field; a
   new page, surface or state; a DI/container or adapter change; a new
   pipeline stage or gate rule; a change to e2e seed data or ports.
3. **Seed / rebuild:** a file is missing, a README stub, or clearly stale.

Skip only when the diff is internal and invisible to both files (a refactor
that keeps structure and behaviour, tests only, styling tweaks). Say so.

## Rules

- **Read the code first, then write.** Every claim must come from a file you
  opened in this session. Never describe planned or remembered behaviour.
- **Evidence:** name real paths for every component; spec rules cite
  `path:line` (or the test that enforces them). Prefer "enforced by
  `test/foo.test.ts`" where a test exists.
- **Line numbers come from reading ONE file at a time** (Read tool, or
  `grep -n` / `sed -n` on a single file). Never take them from output that
  concatenates several files (`cat a b c`, multi-file dumps): those numbers are
  cumulative and point past the end of the real file.
- **Present tense, as-is.** No "will", no "TODO", no changelog, no dates in
  body text. Unimplemented things go to "Open questions" at the bottom, marked.
- **Edit in place.** Unlike INSIGHTS.md these files are rewritable: fix the
  wrong sentence, delete the obsolete section. Keep the `Last verified:` line
  at the top current (`Last verified: YYYY-MM-DD against <short sha>`).
- **Package boundary.** Describe only this package; for the other side of a
  contract link the other package's file instead of copying it.
- **Terse English**, headings + short lists + tables; one mermaid diagram
  per doc at most (the `mermaid-diagram` skill has the syntax rules).
- **Size:** docs ≤ ~250 lines, specs ≤ ~300 lines; split instead of growing.
- Keep the package `CLAUDE.md` "Read when" lines pointing at existing files.

## Workflow

Copy this checklist and work through it:

```
package-docs:
- [ ] 1. List packages the diff touches (git diff --name-only against the base)
- [ ] 2. For each: open its docs + specs file (create from templates.md if missing)
- [ ] 3. For each changed area: re-read the code it describes; mark wrong/missing lines
- [ ] 4. Edit in place; add path / path:line evidence; update "Last verified"
- [ ] 5. New file added? → link it from the package CLAUDE.md "Read when"
- [ ] 6. Verify evidence with a script, not by eye: every path exists AND every
         :line is <= the file's length AND the cited line (±3) contains the symbol
         or statement the sentence is about. Fix every miss before reporting.
- [ ] 7. Report per package: updated <files> | no change needed — <reason>
```

## Seed mode (file missing or a stub)

Build it from the code, one package at a time:

1. Read the package `README.md`, `CLAUDE.md`, `INSIGHTS.md`, entry points and
   the directory tree.
2. docs: trace one real request/render/run end to end and write down the path
   with file names; then the layers and boundaries.
3. specs: collect the contracts from routes / zod schemas / page components /
   tests; each rule gets evidence.
4. Replace the README stub in `docs/`/`specs/` with a two-line index that
   links the real files (or remove it if the package README links them).
5. Show the user the result before moving to the next package.
