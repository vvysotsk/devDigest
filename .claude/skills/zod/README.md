# Zod Best Practices Skill

A comprehensive guide for using Zod effectively in TypeScript applications. This skill provides 43 rules across 8 categories, organized by impact to help AI agents and developers write better validation code.

## Overview

Zod is a TypeScript-first schema declaration and validation library. This skill covers best practices for:

- **Schema Definition**: Choosing correct types, avoiding `z.any()`, proper string validations
- **Parsing & Validation**: Using `safeParse()`, async validation, error handling
- **Type Inference**: Leveraging `z.infer`, distinguishing input/output types
- **Error Handling**: Custom messages, internationalization, form error display
- **Object Schemas**: strict/strip modes, partial updates, discriminated unions
- **Schema Composition**: Reusable schemas, intersections, recursive types
- **Refinements & Transforms**: Custom validation, data transformation
- **Performance**: Caching, Zod Mini, lazy loading, batch validation

## Usage

### For Claude Code / AI Agents

The skill is automatically loaded when working with Zod code. Reference specific rules:

```
See references/parse-use-safeparse.md for safeParse best practices
```

### For Developers

Read `SKILL.md` for a quick reference, or `AGENTS.md` for the full compiled guide.

## File Structure

```
zod/
├── SKILL.md          # Quick reference with rule index
├── AGENTS.md         # Full compiled guide (all rules)
├── README.md         # This file
├── assets/templates/
│   └── _template.md  # Rule template
└── references/
    ├── _sections.md  # Category definitions
    ├── schema-*.md   # Schema definition rules
    ├── parse-*.md    # Parsing rules
    ├── type-*.md     # Type inference rules
    ├── error-*.md    # Error handling rules
    ├── object-*.md   # Object schema rules
    ├── compose-*.md  # Composition rules
    ├── refine-*.md   # Refinement rules
    └── perf-*.md     # Performance rules
```

## Rule Categories

| Priority | Category | Rules | Impact |
|----------|----------|-------|--------|
| 1 | Schema Definition | 6 | CRITICAL |
| 2 | Parsing & Validation | 6 | CRITICAL |
| 3 | Type Inference | 5 | HIGH |
| 4 | Error Handling | 5 | HIGH |
| 5 | Object Schemas | 6 | MEDIUM-HIGH |
| 6 | Schema Composition | 5 | MEDIUM |
| 7 | Refinements & Transforms | 5 | MEDIUM |
| 8 | Performance & Bundle | 5 | LOW-MEDIUM |

## Key Principles

1. **Type Safety First**: Always use `z.infer`, never duplicate types manually
2. **Validate at Boundaries**: Parse external data immediately at entry points
3. **User-Friendly Errors**: Provide custom messages, collect all issues
4. **Single Source of Truth**: Schema defines validation AND TypeScript types
5. **Composition Over Duplication**: Use extend, pick, omit, partial

## How it works in this repo

1. **When it loads.** The agent picks the skill by its `description` when it
   defines or changes a zod schema, parses input or infers a type.
2. **What it reads.** `SKILL.md` has the rule index. Each rule is a file in
   `references/`, and `AGENTS.md` has all rules in one file. The agent opens
   a rule file only when it needs it.
3. **In self-review.** `pr-self-review` sends a changed file to this skill
   when the file matches `metadata.applies_to`: the shared contracts
   (`server/src/vendor/shared/**`), module `routes.ts`, shared schemas,
   config, `reviewer-core/src/` and `client/src/lib/`. The skill is not
   blocking, so its findings are WARNING or SUGGESTION. Only a concrete
   runtime defect is CRITICAL.
4. **Project rules win.** All three packages use zod 3 (`^3.24`). The skill
   is written for zod 4, so v4-only APIs (Zod Mini, new top-level string
   formats) do not apply until an upgrade. The contracts in
   `server/src/vendor/shared` are the master copy and are mirrored to the
   client; `pr-self-review` checks the mirror. Routes validate with
   `fastify-type-provider-zod`.

## Changes in this repo

The skill came with the course starter repo.

- 2026-09-26 — `metadata.applies_to` added for `pr-self-review` routing. No
  rule changes.
- 2026-09-27 — this README: the file tree matches the folder (`references/`,
  `assets/templates/`; no `metadata.json`).

## Maintaining

The skill has no `metadata.version`, so `pr-self-review` keys its checks by
a hash of `SKILL.md`: any edit to `SKILL.md` re-checks every file the skill
covers. Edits to this README or to the reference files do not. When you edit
`SKILL.md`, add a line to "Changes in this repo".

## References

- [Zod Official Documentation](https://zod.dev/)
- [Zod v4 Release Notes](https://zod.dev/v4)
- [Zod GitHub](https://github.com/colinhacks/zod)
- [Zod Mini](https://zod.dev/packages/mini)
