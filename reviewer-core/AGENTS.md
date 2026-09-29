# reviewer-core/ — the review engine (@devdigest/reviewer-core)

## Commands

`npm test` · `npm run typecheck` (npm, not pnpm — this package has
`package-lock.json`; `scripts/dev.sh` installs it with `npm ci`)

## Before answering

Always search this package's `docs/`, `specs/` and `INSIGHTS.md` for what the
user asks about first — these are curated and may already answer it — then
read code.

## The one rule

This package is PURE: no DB, no fs, no GitHub, no HTTP — the only side effect
is the injected LLMProvider. Do not add imports that break this; persistence,
SSE, cancellation and cost live in `server/src/modules/reviews/run-executor.ts`.

One documented exception: `src/llm/openrouter.ts` (`OpenRouterProvider`,
OpenAI SDK + `fetch`) is an LLM adapter that lives here because the server
and the CI runner share it. No other network code belongs here; the trigger
to move it out is in the `onion-architecture` skill. `src/llm/structured.ts`
imports only the pure `openai/helpers/zod` converter.

## Do not touch

- `package-lock.json` — never edit by hand or regenerate unprompted; it
  changes only with an intentional `package.json` change, committed together.

## Non-default conventions

- Pipeline: diff → context → prompt → LLM (single-pass, or map-reduce per
  file for large multi-file diffs) → reduce → grounding gate → findings.
- The grounding gate drops any finding whose file:line is absent from the
  real diff — dropped findings are logged with a reason, never silently.
- Untrusted input (PR body, specs) is delimiter-wrapped in the prompt; only
  our system prompt is trusted.
- LLM structured output is zod-validated with a retry budget.
- `@devdigest/shared` resolves to `../server/src/vendor/shared` via tsconfig
  alias — contract changes happen there, not here.

## Read when

- This package's place in the backend layers (domain core, the one port,
  what may import what) → use the `onion-architecture` skill (`.claude/skills/onion-architecture/SKILL.md`)
- Pipeline stages and data flow → read `docs/pipeline.md`
- Grounding gate rules (what must stay true) → read `specs/grounding-gate.md`
- Pipeline details, public API → read `README.md`
- How the server wraps the engine → read `../server/src/modules/reviews/`
- Past lessons here → read `INSIGHTS.md`
