# Templates

Section lists are the default shape; drop a section that does not apply
rather than filling it with filler.

## docs/<name>.md

```markdown
# <package> — <architecture | ui-architecture | pipeline>

Last verified: YYYY-MM-DD against <short sha>

## Purpose
One paragraph: what this package does and what it deliberately does not do.

## Layout
| Path | Role |
|---|---|

## Data flow
Mermaid diagram OR numbered steps of one real request/run, each step naming
the file that does it.

## Boundaries & dependencies
What it may import / call, what it must not (and where that is enforced).

## Extension points
Where to add a new route / page / stage / flow, with the files to touch.

## Open questions
(only if any; marked as unverified)
```

## specs/<name>.md

```markdown
# <package> — <review-flow | pages | grounding-gate | flows-contract>

Last verified: YYYY-MM-DD against <short sha>

## Scope
What this spec guarantees and what it leaves to other files (link them).

## Contract
One subsection per surface / route / stage. Each rule is a short statement
that can be checked, followed by evidence:

- `GET /repos/:id/pulls` returns `PrMeta[]`; `cost_usd` is null when no run
  had usage data (evidence: `src/modules/pulls/routes.ts:211`, test
  `test/reviews.it.test.ts`).

## States & edge cases
Empty / loading / error / legacy-data behaviour.

## Enforced by
| Rule | Test |
|---|---|
```

## Good vs bad lines

**Bad (docs):** `The server uses dependency injection for flexibility.`
**Good (docs):** `Every module gets its dependencies from Container (src/platform/container.ts); routes read container.* and never construct adapters themselves — tests replace them through ContainerOverrides.`

**Bad (spec):** `Findings are validated.`
**Good (spec):** `A finding whose file:line is not in the PR diff is dropped before persist and logged with a reason (evidence: reviewer-core/src/grounding.ts, test server/test/grounding.test.ts).`

**Bad (either):** `We will add caching later.` → does not belong; put it in
Open questions only if it is a real unresolved decision.
