/**
 * SkillBodyEditor sizing — the textarea is exactly as tall as its lines (never
 * shorter, so it never scrolls internally) and at least as wide as its longest
 * line; the gutter shows one number per row.
 */
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../messages/en/skills.json";
import { LINE_HEIGHT, MIN_ROWS, PAD_Y } from "./constants";
import { SkillBodyEditor } from "./SkillBodyEditor";

afterEach(cleanup);

function Controlled({ initial }: { initial: string }) {
  const [value, setValue] = React.useState(initial);
  return (
    <SkillBodyEditor fileName="rubric.md" value={value} onChange={setValue} dirty={false} savedTokens={0} />
  );
}

function renderEditor(initial: string) {
  render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <Controlled initial={initial} />
    </NextIntlClientProvider>,
  );
  const body = screen.getByRole("textbox", { name: "Skill body" }) as HTMLTextAreaElement;
  const gutterNumbers = () => body.previousElementSibling!.children.length;
  return { body, gutterNumbers };
}

const linesOf = (n: number) => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join("\n");
const heightFor = (rows: number) => `${rows * LINE_HEIGHT + 2 * PAD_Y}px`;

describe("SkillBodyEditor — size follows the content", () => {
  it("a short body keeps the MIN_ROWS height and gutter", () => {
    const { body, gutterNumbers } = renderEditor(linesOf(3));
    expect(body.style.height).toBe(heightFor(MIN_ROWS));
    expect(gutterNumbers()).toBe(MIN_ROWS);
  });

  it("a 35-line body is 35 lines tall with 35 gutter numbers", () => {
    const { body, gutterNumbers } = renderEditor(linesOf(35));
    expect(body.style.height).toBe(heightFor(35));
    expect(gutterNumbers()).toBe(35);
  });

  it("a 200-char line makes the textarea at least 200ch wide", () => {
    const { body } = renderEditor(`short\n${"x".repeat(200)}`);
    const ch = Number(/calc\((\d+)ch/.exec(body.style.minWidth)?.[1]);
    expect(ch).toBeGreaterThanOrEqual(200);
  });

  it("typing a new line raises the height by one LINE_HEIGHT", async () => {
    const user = userEvent.setup();
    const { body, gutterNumbers } = renderEditor(linesOf(20));
    expect(body.style.height).toBe(heightFor(20));

    await user.type(body, "{Enter}line 21");
    expect(body.style.height).toBe(heightFor(21));
    expect(gutterNumbers()).toBe(21);
  });
});
