/* FindingsHoverCard — hover/focus trigger that shows a FindingsPopover.

   Opening: mouseenter (after `openDelayMs`, cancelled if the pointer leaves
   first — so a quick sweep over a list never opens or fetches anything) or
   keyboard focus (immediately). `onOpen` fires at the moment of opening, which
   lets the PR list start its lazy fetch only then.

   Closing: mouseleave with a ~100 ms grace (the popover is a DOM child of the
   wrapper, so moving into it does not count as leaving), blur outside the
   wrapper, Escape, window resize, and any scroll — except scrolls that happen
   INSIDE the popover itself, otherwise a long list of findings would close its
   own popover while being scrolled. The popover is position:fixed, so it would
   drift away from its trigger on outer scroll.

   Clicks inside the popover are swallowed (list rows navigate on click); a
   click on the trigger itself is NOT intercepted, so a link/button wrapped by
   the card keeps working. */
"use client";

import React from "react";
import type { FindingRecord } from "@devdigest/shared";
import { FindingsPopover } from "./FindingsPopover";
import { s } from "./styles";

const CLOSE_GRACE_MS = 100;

export function FindingsHoverCard({
  children,
  findings,
  title,
  loading,
  loadingText,
  emptyText,
  onOpen,
  openDelayMs = 0,
  ariaLabel,
}: {
  children: React.ReactNode;
  findings: readonly FindingRecord[];
  title: string;
  loading?: boolean;
  loadingText?: string;
  emptyText?: string;
  /** Called once per opening (hover after the delay, or focus). */
  onOpen?: () => void;
  openDelayMs?: number;
  ariaLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState<DOMRect | null>(null);
  const wrapRef = React.useRef<HTMLSpanElement | null>(null);
  const triggerRef = React.useRef<HTMLSpanElement | null>(null);
  const popoverRef = React.useRef<HTMLDivElement | null>(null);
  const openTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onOpenRef = React.useRef(onOpen);
  onOpenRef.current = onOpen;

  const clearTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  };

  const doOpen = React.useCallback(() => {
    setAnchor(triggerRef.current?.getBoundingClientRect() ?? null);
    setOpen(true);
    onOpenRef.current?.();
  }, []);

  const doClose = React.useCallback(() => {
    clearTimers();
    setOpen(false);
  }, []);

  const onMouseEnter = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (open || openTimer.current) return;
    if (openDelayMs > 0) {
      openTimer.current = setTimeout(() => {
        openTimer.current = null;
        doOpen();
      }, openDelayMs);
    } else {
      doOpen();
    }
  };

  const onMouseLeave = () => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (!open) return;
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setOpen(false);
    }, CLOSE_GRACE_MS);
  };

  const onFocus = () => {
    if (!open) doOpen();
  };

  const onBlur = (e: React.FocusEvent) => {
    const next = e.relatedTarget as Node | null;
    if (next && wrapRef.current?.contains(next)) return;
    doClose();
  };

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") doClose();
    };
    const onScroll = (e: Event) => {
      const target = e.target as Node | null;
      if (target && popoverRef.current?.contains(target)) return; // scrolling the list itself
      doClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", doClose);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", doClose);
    };
  }, [open, doClose]);

  React.useEffect(() => clearTimers, []);

  return (
    <span
      ref={wrapRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{ display: "inline-flex", position: "relative" }}
    >
      <span
        ref={triggerRef}
        tabIndex={0}
        role="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel ?? title}
        style={s.trigger}
      >
        {children}
      </span>
      {open && (
        <FindingsPopover
          ref={popoverRef}
          anchor={anchor}
          findings={findings}
          title={title}
          loading={loading}
          loadingText={loadingText}
          emptyText={emptyText}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </span>
  );
}
