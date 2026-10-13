---
name: response-schema
description: "Use when a diff touches a response schema or a shared type behind one: compare every field's name, type and optionality before and after, for every route that uses the schema."
type: custom
---
# Response-schema check

A response schema is a promise to every caller of every route that returns it.
Check it field by field.

## How to check
1. List every response schema, serializer or exported response type the diff
   changes (zod objects, TypeScript interfaces, mapping functions).
2. For each one, list the routes that return it. A shared schema usually
   backs several routes; look for its imports in the diff and in the changed
   files' context.
3. Compare the schema before and after, field by field:
   - name;
   - type (`number` → `string`, object → array, single value → list);
   - required → optional, or non-null → nullable;
   - nesting level;
   - enum values.
4. Every difference from step 3 applies to every route from step 2, whether or
   not that route's handler is in the diff.

## What counts as breaking
- A field renamed or removed.
- A field's type changed.
- A field that was always present becomes optional or nullable: callers that
  read it without a check now fail.
- An enum value removed or merged.

Compatible: a new field; an optional field that becomes always present.

## Reporting
- Anchor the finding on the changed schema line.
- In the rationale, list the affected routes, including the ones whose
  handler the diff does not touch, and the field as `old → new`.
- Severity follows `breaking-change`: CRITICAL without a mitigation.

## Good / Bad

Bad: a shared `Product` schema makes `price` nullable. `GET /products/:id` is
in the diff, but `GET /products` and `GET /carts/:id` also return `Product`
and are not; the review only looks at the changed handler.

```ts
export const Product = z.object({ id: z.string(), price: z.number().nullable() });
```

Good: the review names every route that returns `Product` and reports the
change once per breaking difference: `price: number → number | null` breaks
`GET /products/:id`, `GET /products` and `GET /carts/:id`.
