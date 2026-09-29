---
name: deprecation-policy
description: "Use when a diff removes or replaces a public field, parameter or route: require the old form to stay, marked deprecated with a sunset date and a replacement, instead of a silent removal."
type: convention
---
# Deprecation policy

Callers cannot move off something they were never told is going away. Retire
public API in three steps: announce, keep, remove.

## Rules
1. **Announce.** Mark the old field, parameter or route as deprecated where
   callers see it:
   - `@deprecated` JSDoc on the schema field or type;
   - `deprecated: true` in the OpenAPI description;
   - `Deprecation` and `Sunset` response headers on a deprecated route.
   Name the replacement and the sunset date.
2. **Keep.** The old form keeps working, with the same meaning, until the
   sunset date and at least one release. A replacement field is served next
   to the old one, not instead of it.
3. **Remove.** Only in a major version (see `semver-discipline`), after the
   sunset date, with a changelog note.

## Reporting
- A public field, parameter or route removed or replaced in the same change
  that introduces its replacement → CRITICAL: a silent removal.
- Deprecated but with no replacement named, or no sunset date → WARNING.
- Removed after a documented sunset, in a major version → not a finding.

## Good / Bad

Bad: the products API replaces the `sku` query parameter of
`GET /products` with `productCode` in one change. Requests with `?sku=` now
return every product.

```ts
const ListProductsQuery = z.object({ productCode: z.string().optional() });
```

Good: both parameters work until the sunset, and the old one is marked.

```ts
const ListProductsQuery = z.object({
  productCode: z.string().optional(),
  /** @deprecated Use `productCode`. Sunset: 2027-03-31. */
  sku: z.string().optional(),
});
// Handler: productCode ?? sku; responses to ?sku= carry
// `Deprecation: true` and `Sunset: Wed, 31 Mar 2027 00:00:00 GMT`.
```
