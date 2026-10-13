/**
 * SelectInput — every native <option> carries the theme colours, so the
 * browser-drawn popup never falls back to white behind the light text.
 */
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SelectInput } from "./SelectInput";

afterEach(cleanup);

describe("SelectInput", () => {
  it("gives every option the theme background and text colour", () => {
    render(
      <SelectInput value="rubric" options={["rubric", { value: "custom", label: "Custom" }]} />,
    );
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    for (const option of options) {
      expect(option.style.background).toBe("var(--bg-elevated)");
      expect(option.style.color).toBe("var(--text-primary)");
    }
  });
});
