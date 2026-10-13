---
name: breaking-change
description: "Use when a diff changes or removes anything a caller relies on (a route, a parameter, a response field, a status code, an error format): classify each change as breaking or compatible and require a mitigation for every breaking one."
type: rubric
---
# Breaking-change rubric

The public contract is what existing callers already depend on: routes
(method + path), request parameters and bodies, response shapes, status codes
and error formats. Classify every change the diff makes to it.

## Breaking — a caller that worked before now fails or misreads the answer
- A route is removed or renamed, or its method changes.
- A request parameter or body field is removed or renamed, becomes required,
  accepts fewer values or tighter bounds, or its default changes meaning.
- A response field is removed or renamed, changes type, becomes optional or
  nullable, or moves to another nesting level.
- An enum value is removed or merged into another value.
- A success or error status code changes, or the error envelope changes.
- A shared schema or exported type changes. Every route that uses it changes
  too, including routes whose handler is not in the diff.

## Compatible
- A new route, a new optional request field, a new response field.
- A new enum value, when callers are documented to tolerate unknown values.

## Mitigation — every breaking change needs at least one
- A new API version (path or header) while the old one keeps working.
- The old name or shape kept next to the new one, marked deprecated
  (see `deprecation-policy`).
- Every caller updated in the same change, when all callers live in this
  repository.

## Reporting
- One finding per breaking difference, anchored on the changed schema or
  handler line. Do not merge several differences into one finding.
- State the contract as `old → new` and what an existing caller now does
  wrong.
- CRITICAL: breaking, on a public route, with no mitigation.
- WARNING: breaking, with an incomplete mitigation.
- Do not report compatible changes.

## Good / Bad

Bad: the `GET /orders/:id` response renames a field with no alias and no new
version. A client that reads `order.totalCents` now gets `undefined`.

```ts
// before
export const Order = z.object({ id: z.string(), totalCents: z.number().int() });
// after
export const Order = z.object({ id: z.string(), amountCents: z.number().int() });
```

Good: the new name ships next to the old one, which stays until the next
major version.

```ts
export const Order = z.object({
  id: z.string(),
  amountCents: z.number().int(),
  /** @deprecated Use `amountCents`. Removed in /v2. */
  totalCents: z.number().int(),
});
```
