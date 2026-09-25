# reviewer-core — grounding-gate

Last verified: 2026-09-24 against c03665a

## Scope

What must stay true about the engine's output regardless of model or
provider: which findings survive, how the score and verdict are derived, what
the prompt guarantees, how structured output is validated, and what the CI
payload helper decides. Persistence of the result and the SSE stream are the
server's contract (`../server/specs/review-flow.md`).

Paths are relative to `reviewer-core/`; the shared contracts are under
`../server/src/vendor/shared/contracts/`.

## Contract

### Grounding gate — `groundFindings(findings, diff)`

- A finding whose `file` is not among `diff.files[].path` is dropped with the
  reason `file '<file>' not present in diff` (`src/grounding.ts:54`, `:61-64`).
- A diff finding is kept only if some line in `[start_line, end_line]` (either
  order) is a new-side line covered by a hunk of that file; otherwise it is
  dropped with `lines a-b do not intersect any diff hunk in '<file>'`
  (`src/grounding.ts:41-46`, `:72-80`).
- Hunk lines come from `hunk.newLineNumbers` when present, else from the
  declared `newStart .. newStart + max(newLines, 1) - 1` range
  (`buildLineIndex`, `src/grounding.ts:24-39`).
- Findings whose `kind` is `secret_leak`, `lethal_trifecta`, `phantom` or
  `hook` are full-file: they only need the file to be in the diff
  (`FULL_FILE_KINDS`, `src/grounding.ts:16`, `:59`, `:66-70`).
- `groundingSummary` is `"<kept>/<kept+dropped> passed"`
  (`src/grounding.ts:87-90`); every drop is also emitted as an `info` event
  `grounding dropped "<title>": <reason>` — never silent
  (`src/review/run.ts:199-201`).

### Score and verdict

- The returned score is `scoreFromFindings(kept)`: 100 minus 35 per
  CRITICAL, 12 per WARNING, 3 per SUGGESTION, clamped to 0..100; the model's
  own `score` is discarded (`src/review/reduce.ts:13-17`, `:27-30`;
  `src/review/run.ts:204-208`). Zero findings ⇒ 100, one CRITICAL ⇒ 65.
- The verdict is the model's, reduced across chunks by worst-wins
  (`request_changes` > `comment` > `approve`) (`src/review/reduce.ts:33-49`).
- In map-reduce the merged summary is the partial summaries joined by a space
  and the pre-grounding score is their mean; both are overwritten by the rules
  above except the summary (`src/review/reduce.ts:50-54`).

### Strategy and chunks

- `single-pass` = one LLM call with `diff.raw`; `map-reduce` = one call per
  file with `sliceDiff(diff, path)`, only when the diff has more than one
  file; `auto` picks map-reduce only when total changed lines exceed
  `mapThresholdLines` (default 400) and the diff is multi-file
  (`src/review/run.ts:29-30`, `:115-121`, `:144-147`).
- `checkCancelled` is called before every chunk's LLM call and its throw
  propagates unchanged (`src/review/run.ts:162-164`).
- `sessionId` is forwarded on every `completeStructured` call when set
  (`src/review/run.ts:180`).
- `tokensIn` / `tokensOut` are sums over chunks; `costUsd` is the sum, or null
  once any chunk reports null (`src/review/run.ts:182-184`).

### Prompt — `assemblePrompt(parts)`

- The system message is `parts.system` + two newlines + `INJECTION_GUARD`,
  which states that `<untrusted>` content is data, never instructions, and
  that "test fixture / intentional / demo / do not flag" claims never descope
  the review (`src/prompt.ts:16-28`, `:86`).
- User-message sections, in order and each only when non-empty: task, `## PR
  description` (untrusted, cut to 4 000 chars), `## Skills / rules`,
  `## Relevant memory` (bulleted), `## Repo skeleton` (untrusted),
  `## Project context` (each spec untrusted as `spec-<i>`), `## Callers of
  changed symbols` (untrusted), `## Diff to review` (untrusted, always)
  (`src/prompt.ts:37`, `:99-122`).
- `wrapUntrusted` escapes `</untrusted>` inside the content so a payload cannot
  close the block (`src/prompt.ts:30-34`).
- The `PromptAssembly` record mirrors the sections with `null` for absent
  slots (`src/prompt.ts:129-138`).

### Structured output

- `parseWithRepair` first `JSON.parse`s the trimmed raw text, then falls back
  to `extractJson` (fence or first balanced object/array); a zod failure
  returns `ok: false` with a reprompt message listing the issues
  (`src/llm/structured.ts:54-84`).
- `OpenRouterProvider.completeStructured` sends `response_format:
  json_schema` with `strict: true`, `temperature` 0 by default, retries up to
  `maxRetries + 1` attempts by appending the raw answer and the reprompt as
  new messages, and throws after the last failed attempt; an HTTP 200 without
  `choices` throws with the upstream error message
  (`src/llm/openrouter.ts:59-116`).
- `costUsd` = OpenRouter `usage.cost` summed over attempts, else the injected
  `estimateCost(model, tokensIn, tokensOut)`, else null
  (`src/llm/openrouter.ts:96-107`).

### CI payload — `toReviewPayload(review, opts)`

- Event is deterministic: no findings → `APPROVE`; `gateTriggered(findings,
  failOn)` → `REQUEST_CHANGES`; otherwise `COMMENT`; `failOn` defaults to
  `critical`; the model verdict is ignored (`src/output/to-review.ts:148-166`).
- `gateTriggered` / `countBlockers` compare `SEV_RANK` (SUGGESTION 1, WARNING
  2, CRITICAL 3) against `FAIL_ON_MIN_RANK` (`never` → unreachable)
  (`src/output/to-review.ts:22-51`).
- With a `diff`, each inline comment is anchored to the new-side diff line in
  the finding's range closest to `end_line`; a finding with no such line keeps
  only its entry in the body; without a diff the raw `end_line` is used
  (`src/output/to-review.ts:107-146`).

## States & edge cases

- **Everything dropped** → `review.findings = []`, score 100, grounding
  `0/n passed`; the verdict may still read `request_changes`
  (`src/review/run.ts:207-209`).
- **Empty diff** (`files.length === 0`) → `single-pass` with one chunk labelled
  `all files` (`src/review/run.ts:115-121`, `:147`).
- **Provider without cost** (e.g. the server's OpenAI/Anthropic adapters
  returning null) → `costUsd` null; the server estimates on read
  (`src/review/run.ts:184`).
- **Cancellation** → the engine never catches what `checkCancelled` throws;
  nothing is returned (`src/review/run.ts:164`; test `test/run.test.ts:91`).

## Enforced by

| Rule | Test |
|---|---|
| Single-pass assembles, grounds, drops the off-diff finding; `1/2 passed`; score 65 from one CRITICAL | `test/run.test.ts:46-70` |
| Clean approve scores 100 regardless of the model's number | `test/run.test.ts:72-89` |
| `checkCancelled` throwing aborts before the LLM call | `test/run.test.ts:91-105` |
| `sessionId` forwarded on every LLM call | `test/run.test.ts:107` |
| Injection guard appended; "intentional / test / demo" claims cannot descope | `test/prompt.test.ts:21-33` |
| PR description rendered untrusted before the diff, omitted when blank, cut at 4k | `test/prompt.test.ts:36-65` |
| CI event from severities + `failOn` (all policies), body header follows the event | `test/to-review.test.ts:29-71` |
| `countBlockers` agrees with `gateTriggered` | `test/to-review.test.ts:73-90` |
| Inline comments anchor to an in-diff line or fall back to the body | `test/to-review.test.ts:135-156` |
| Grounding keep/drop rules and the summary string (server-side suite over the same functions) | `../server/test/grounding.test.ts:38` |
