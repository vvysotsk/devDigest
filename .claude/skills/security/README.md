# security — README

The agent loads `SKILL.md` only; this file is for people maintaining the skill.

## What it does

Web application security based on OWASP Top 10:2025: access control,
misconfiguration, supply chain, cryptography, injection, insecure design,
authentication, data integrity, logging, error handling, file uploads,
secret detection and agentic AI security. Every finding needs a confidence
level.

## How it works

1. **When it loads.** The agent picks the skill by its `description` when it
   reviews code for vulnerabilities or touches input handling, secrets, auth
   or API endpoints.
2. **What it reads.** `SKILL.md` has the rules and the review process.
   `examples.md` has unsafe/safe code pairs, `checklists.md` has short
   checklists, and `references.md` lists the sources.
3. **In self-review.** The skill is **blocking**
   (`metadata.blocking: "true"`). `pr-self-review` sends it all source files
   of `server/`, `client/`, `reviewer-core/` and `e2e/`, every
   `package.json` and `.github/**`, but not tests. A finding is CRITICAL
   only at HIGH confidence: the vulnerable pattern is there and the input is
   traced to an attacker. At medium confidence it is at most a WARNING.
   `pr-self-review` also has its own mechanical checks for secret-shaped
   strings and `process.env` in feature code.
4. **Project rules win.** The examples are for Express, MongoDB and JWT.
   This repo uses Fastify, PostgreSQL with Drizzle and zod validation, so
   the agent applies the principle, not the stack-specific code. Secrets
   live in `~/.devdigest/secrets.json` behind the secrets provider
   (`server/src/adapters/secrets/`); feature code never reads
   `process.env`.

## Files

- `SKILL.md` — rules, review process, severity classification.
- `examples.md` — unsafe and safe code pairs.
- `checklists.md` — quick checklists.
- `references.md` — all sources.

## Changes in this repo

The skill came with the course starter repo.

- 2026-09-26 — `metadata.applies_to` and `metadata.blocking: "true"` added
  for `pr-self-review`. No rule changes.

## Maintaining

The skill has no `metadata.version`, so `pr-self-review` keys its checks by
a hash of `SKILL.md`: any edit to `SKILL.md` re-checks every file the skill
covers. Edits to this README or to the reference files do not. When you edit
`SKILL.md`, add a line to "Changes in this repo".
