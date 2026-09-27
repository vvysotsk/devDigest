/** Trace › Prompt assembly — the Skills block label carries count + ≈ tokens and one row per injected skill (L02 D7). */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { RunTrace } from "@devdigest/shared";
import runsMessages from "../../../../../../../../../../messages/en/runs.json";
import skillsMessages from "../../../../../../../../../../messages/en/skills.json";
import { TraceBody } from "./TraceBody";

afterEach(cleanup);

function trace(prompt: Partial<RunTrace["prompt_assembly"]>): RunTrace {
  return {
    config: { agent: "Test Quality", version: "2", provider: "openai", model: "gpt-4.1", pr: 483, source: "local" },
    stats: { duration_ms: 1000, tokens_in: 1000, tokens_out: 100, cost_usd: null, findings: 0, grounding: "0/0 passed" },
    prompt_assembly: { system: "You are a reviewer.", user: "Review PR #483", ...prompt },
    tool_calls: [],
    raw_output: "",
    memory_pulled: [],
    specs_read: [],
    log: [],
  };
}

async function renderPrompt(t: RunTrace) {
  const user = userEvent.setup();
  render(
    <NextIntlClientProvider locale="en" messages={{ runs: runsMessages, skills: skillsMessages }}>
      <TraceBody trace={t} findings={[]} />
    </NextIntlClientProvider>,
  );
  await user.click(screen.getByText("Prompt assembly"));
}

describe("TraceBody — Skills block", () => {
  it("labels the block with the skill count and summed ≈ tokens and lists each skill", async () => {
    await renderPrompt(
      trace({
        skills: "## Skills / rules\n### Skill: branch-coverage-check (manual, v1)\n…",
        skill_blocks: [
          { skill_id: "s1", name: "branch-coverage-check", version: 1, source: "manual", tokens: 412 },
          { skill_id: "s2", name: "api-deprecation-policy", version: 3, source: "imported_file", tokens: 118 },
        ],
      }),
    );
    expect(screen.getByText("Skills · 2 · ≈ 530 tok (cl100k)")).toBeInTheDocument();
    const rows = within(screen.getByRole("list", { name: "Skills (dynamic)" })).getAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual([
      "branch-coverage-checkv1Manual≈ 412 tok",
      "api-deprecation-policyv3Imported≈ 118 tok",
    ]);
  });

  it("keeps the plain Skills label for a trace without skill_blocks", async () => {
    await renderPrompt(trace({ skills: "### skill" }));
    expect(screen.getByText("Skills (dynamic)")).toBeInTheDocument();
    expect(screen.queryByText(/^Skills · /)).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Skills (dynamic)" })).not.toBeInTheDocument();
  });

  it("shows no Skills block when no skill was injected", async () => {
    await renderPrompt(trace({ skills: null }));
    expect(screen.queryByText(/^Skills/)).not.toBeInTheDocument();
  });
});
