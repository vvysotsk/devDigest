/**
 * FindingsHoverCard — open on hover (after the intent delay) or focus; close on
 * leave (with a grace period that a move into the popover cancels), blur,
 * Escape, outer scroll and resize — but NOT on a scroll inside the popover.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { FindingsHoverCard } from "./FindingsHoverCard";
import { finding } from "@/test/fixtures";

afterEach(cleanup);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const FINDINGS = [finding({ id: "w1", title: "N+1 query" })];

function renderCard(props: Partial<React.ComponentProps<typeof FindingsHoverCard>> = {}) {
  const onOpen = vi.fn();
  render(
    <FindingsHoverCard title="1 finding" findings={FINDINGS} onOpen={onOpen} {...props}>
      <span>trigger</span>
    </FindingsHoverCard>,
  );
  return { onOpen, trigger: screen.getByRole("button", { name: "1 finding" }) };
}

const dialog = () => screen.queryByRole("dialog");

describe("FindingsHoverCard — opening", () => {
  it("opens immediately on hover when there is no delay", () => {
    const { onOpen, trigger } = renderCard();
    fireEvent.mouseEnter(trigger.parentElement!);
    expect(dialog()).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("with openDelayMs: a quick sweep neither opens nor calls onOpen; settling does both", () => {
    const { onOpen, trigger } = renderCard({ openDelayMs: 180 });
    const wrap = trigger.parentElement!;
    fireEvent.mouseEnter(wrap);
    act(() => vi.advanceTimersByTime(100));
    fireEvent.mouseLeave(wrap);
    act(() => vi.advanceTimersByTime(500));
    expect(dialog()).not.toBeInTheDocument();
    expect(onOpen).not.toHaveBeenCalled();

    fireEvent.mouseEnter(wrap);
    act(() => vi.advanceTimersByTime(180));
    expect(dialog()).toBeInTheDocument();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("keyboard focus opens immediately even with a hover delay", () => {
    const { onOpen, trigger } = renderCard({ openDelayMs: 180 });
    fireEvent.focus(trigger);
    expect(dialog()).toBeInTheDocument();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe("FindingsHoverCard — closing", () => {
  it("mouseleave closes after the grace period; re-entering (e.g. into the popover) cancels it", () => {
    const { trigger } = renderCard();
    const wrap = trigger.parentElement!;
    fireEvent.mouseEnter(wrap);
    fireEvent.mouseLeave(wrap);
    act(() => vi.advanceTimersByTime(50));
    expect(dialog()).toBeInTheDocument();
    fireEvent.mouseEnter(wrap); // pointer moved into the popover (a child of the wrapper)
    act(() => vi.advanceTimersByTime(500));
    expect(dialog()).toBeInTheDocument();

    fireEvent.mouseLeave(wrap);
    act(() => vi.advanceTimersByTime(120));
    expect(dialog()).not.toBeInTheDocument();
  });

  it("Escape closes", () => {
    const { trigger } = renderCard();
    fireEvent.focus(trigger);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(dialog()).not.toBeInTheDocument();
  });

  it("blur outside the wrapper closes", () => {
    const { trigger } = renderCard();
    fireEvent.focus(trigger);
    fireEvent.blur(trigger, { relatedTarget: document.body });
    expect(dialog()).not.toBeInTheDocument();
  });

  it("scrolling the page or resizing closes; scrolling INSIDE the popover does not", () => {
    const { trigger } = renderCard();
    fireEvent.focus(trigger);
    fireEvent.scroll(dialog()!);
    expect(dialog()).toBeInTheDocument();

    fireEvent.scroll(document);
    expect(dialog()).not.toBeInTheDocument();

    fireEvent.focus(trigger);
    expect(dialog()).toBeInTheDocument();
    fireEvent(window, new Event("resize"));
    expect(dialog()).not.toBeInTheDocument();
  });

  it("a click inside the popover does not bubble to the row; a click on the trigger does", () => {
    const onRowClick = vi.fn();
    render(
      <div onClick={onRowClick}>
        <FindingsHoverCard title="t" findings={FINDINGS}>
          <span>trigger</span>
        </FindingsHoverCard>
      </div>,
    );
    const trigger = screen.getByRole("button", { name: "t" });
    fireEvent.focus(trigger);
    fireEvent.click(dialog()!);
    expect(onRowClick).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });
});
