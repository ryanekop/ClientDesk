"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type TableActionMenuPortalProps = {
  open: boolean;
  anchorEl: HTMLElement | null;
  children: React.ReactNode;
  className?: string;
  offset?: number;
  align?: "start" | "end";
};

type MenuPosition = {
  top: number;
  left: number;
  ready: boolean;
};

const VIEWPORT_PADDING = 8;

export function TableActionMenuPortal({
  open,
  anchorEl,
  children,
  className,
  offset = 6,
  align = "end",
}: TableActionMenuPortalProps) {
  const [mounted, setMounted] = React.useState(false);
  const [position, setPosition] = React.useState<MenuPosition>({
    top: 0,
    left: 0,
    ready: false,
  });
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  React.useLayoutEffect(() => {
    if (!open || !mounted || !anchorEl) return;

    let rafId = 0;

    const updatePosition = () => {
      const menuEl = menuRef.current;
      if (!menuEl || !anchorEl) return;

      const anchorRect = anchorEl.getBoundingClientRect();
      const menuRect = menuEl.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let left =
        align === "start"
          ? anchorRect.left
          : anchorRect.right - menuRect.width;
      left = Math.max(
        VIEWPORT_PADDING,
        Math.min(left, viewportWidth - menuRect.width - VIEWPORT_PADDING),
      );

      const canOpenUp =
        anchorRect.top - offset - menuRect.height >= VIEWPORT_PADDING;
      const shouldOpenUp =
        anchorRect.bottom + offset + menuRect.height >
          viewportHeight - VIEWPORT_PADDING && canOpenUp;

      let top = shouldOpenUp
        ? anchorRect.top - offset - menuRect.height
        : anchorRect.bottom + offset;
      top = Math.max(
        VIEWPORT_PADDING,
        Math.min(top, viewportHeight - menuRect.height - VIEWPORT_PADDING),
      );

      setPosition((current) => {
        if (current.ready && current.top === top && current.left === left) {
          return current;
        }
        return { top, left, ready: true };
      });
    };

    const scheduleUpdate = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updatePosition);
    };

    scheduleUpdate();

    window.addEventListener("resize", scheduleUpdate, { passive: true });
    window.addEventListener("scroll", scheduleUpdate, {
      passive: true,
      capture: true,
    });

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(scheduleUpdate)
        : null;
    if (observer) {
      observer.observe(anchorEl);
      if (menuRef.current) observer.observe(menuRef.current);
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
      observer?.disconnect();
      setPosition((current) => ({ ...current, ready: false }));
    };
  }, [align, anchorEl, mounted, offset, open]);

  if (!mounted || !open || !anchorEl) return null;

  return createPortal(
    <div
      ref={menuRef}
      data-table-action-menu-root="true"
      className={cn(
        "fixed z-[120] rounded-md border border-border bg-card p-1 shadow-lg transition-all duration-150 ease-out",
        position.ready
          ? "pointer-events-auto opacity-100 scale-100"
          : "pointer-events-none opacity-0 scale-95",
        className,
      )}
      style={{ top: position.top, left: position.left, transformOrigin: "top right" }}
    >
      {children}
    </div>,
    document.body,
  );
}
