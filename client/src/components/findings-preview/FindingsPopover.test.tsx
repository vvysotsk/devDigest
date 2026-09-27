/**
 * FindingsPopover — read-only previews (no Accept/Reject), sorted by severity,
 * with loading / empty states.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { finding } from "./test-fixtures";
import { FindingsPopover } from "./FindingsPopover";

afterEach(cleanup);

const ANCHOR = { top: 10, bottom: 30, left: 100, right: 160 } as DOMRect;

describe("FindingsPopover", () => {
  it("shows the title and one read-only preview per finding, sorted by severity", () => {
    render(
      <FindingsPopover
        anchor={ANCHOR}
        title="2 findings"
        findings={[
          finding({ id: "s1", severity: "SUGGESTION", title: "Extract magic number 3600", category: "style" }),
          finding({ id: "w1", title: "N+1 query in user list endpoint" }),
        ]}
      />,
    );
    expect(screen.getByRole("dialog", { name: "2 findings" })).toBeInTheDocument();
    const titles = screen.getAllByText(/N\+1 query|Extract magic number/).map((el) => el.textContent);
    expect(titles).toEqual(["N+1 query in user list endpoint", "Extract magic number 3600"]);
    expect(screen.getAllByText("src/api/users.ts:45-52")).toHaveLength(2);
    expect(screen.getAllByText("86% conf")).toHaveLength(2);
    expect(screen.getByText("perf")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("loading and empty states", () => {
    const { rerender } = render(
      <FindingsPopover anchor={ANCHOR} title="t" findings={[]} loading loadingText="Loading findings…" />,
    );
    expect(screen.getByText("Loading findings…")).toBeInTheDocument();
    rerender(<FindingsPopover anchor={ANCHOR} title="t" findings={[]} emptyText="No findings in this run." />);
    expect(screen.getByText("No findings in this run.")).toBeInTheDocument();
  });

  it("error state wins over loading and lists nothing", () => {
    render(<FindingsPopover anchor={ANCHOR} title="t" findings={[]} loading loadingText="Loading…" errorText="Boom" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Boom");
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });

  it("is positioned fixed below the anchor", () => {
    render(<FindingsPopover anchor={ANCHOR} title="t" findings={[]} />);
    const el = screen.getByRole("dialog");
    expect(el).toHaveStyle({ position: "fixed", top: "36px", left: "100px" });
  });
});
