# API Contract Reviewer skills (HW02)

The four skills of the API Contract Reviewer, kept as files so the homework is
reproducible (`../../../specs/HW02-conventions-and-api-contract.md` D11, #43).
The agent itself is created in the UI with the prompt in
`../../agent-prompts/api-contract-reviewer.md` (D10). Nothing here is seeded.

| Skill | Type | In the UI |
|---|---|---|
| [`breaking-change`](breaking-change/SKILL.md) | rubric | created (Skills → Add → Create) |
| [`response-schema`](response-schema/SKILL.md) | custom | created |
| [`semver-discipline`](semver-discipline/SKILL.md) | rubric | created |
| [`deprecation-policy`](deprecation-policy/SKILL.md) | convention | imported as `.zip` (#16) |

Each `SKILL.md` has the import frontmatter (`name`, `description` as a
"Use when …" directive, `type`) and ends with a Good / Bad example from an
unrelated domain (orders, products).

Pack the imported one from `server/`:

```
pnpm skill:pack ../docs/agent-skills/api-contract/deprecation-policy <out>/deprecation-policy.zip
```

To create one in the UI, copy its description into Description and everything
after the closing `---` into the body.

Integrity: no file here, and neither prompt, may name an experiment defect.
Run the grep in the spec's D11 after every edit; it must print nothing.
