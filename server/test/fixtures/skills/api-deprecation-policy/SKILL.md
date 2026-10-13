---
name: api-deprecation-policy
title: "API deprecation: how to retire an endpoint: step by step"
description: >
  Checks that a change which removes or alters a public API follows the
  deprecation policy: announce first, keep the old behaviour for one release,
  then remove.
type: convention
metadata:
  author: "platform-team: api guild"
  version: "1.2"
  tags:
    - api
    - deprecation
---
# API deprecation policy

A public API is a promise. Breaking it without notice breaks every client that
relies on it. Review the change against these rules.

## Rules

1. A public endpoint, field or parameter is never removed in the same release
   that deprecates it. The first release only marks it deprecated.
2. A deprecated element keeps working for at least one full release after the
   announcement. Its behaviour does not change during that window.
3. The deprecation is visible to clients: a `Deprecation` response header, a
   note in the API changelog and a comment in the API schema.
4. A replacement exists before the old element is deprecated, and the
   changelog names it.
5. Renaming a field counts as removing the old field and adding a new one:
   both rules above apply.

## What to report

- WARNING when a public element is removed or its type or meaning changes
  without a prior deprecation.
- WARNING when a deprecation has no replacement or no changelog entry.
- SUGGESTION when a deprecation header or schema comment is missing.

Cite the changed line. Do not report internal (non-public) code.
