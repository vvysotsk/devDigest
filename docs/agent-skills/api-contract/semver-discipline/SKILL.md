---
name: semver-discipline
description: "Use when a diff changes a public contract: decide whether the change needs a major, minor or patch release, and flag a breaking change shipped without a major bump or a new API version."
type: rubric
---
# Semver discipline

A version number tells callers whether they can upgrade without changing their
code. Decide which bump the diff needs, then check that it got it.

## Which bump
- **Major** — any breaking change (see `breaking-change`): a caller that
  worked before must change its code.
- **Minor** — a new, backward-compatible capability: a new route, a new
  optional parameter, a new response field.
- **Patch** — a fix that changes no contract.

## Where the version lives — check each one the repository uses
- The API path or header version (`/v1/…`, `Accept-Version`).
- `version` in `package.json` of a published client or SDK.
- `info.version` of an OpenAPI document.
- The changelog entry, which must say "BREAKING" for a major change.

## Reporting
- A breaking change with no major bump and no new API version → CRITICAL,
  anchored on the changed contract line; say which version should change.
- A breaking change with a major bump but no changelog note → WARNING.
- A minor or patch change bumped as major → SUGGESTION.
- If the repository versions nothing at all, report the breaking change once
  under `breaking-change` and do not add a second finding here.

## Good / Bad

Bad: `POST /v1/products` now requires a `categoryId` body field. The path
stays `/v1`, the SDK goes from `3.4.0` to `3.5.0`, and the changelog says
"Products: category support". Old clients now get 400.

Good: the required field ships as `POST /v2/products`, `/v1` keeps accepting
the old body, the SDK goes to `4.0.0`, and the changelog starts with
"BREAKING: `categoryId` is required on /v2/products".
