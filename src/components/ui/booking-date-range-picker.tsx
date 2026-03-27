"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";

import { cn } from "@/lib/utils";

type BookingDateRangePickerProps = {
  value: {
    from: string;
    to: string;
  };
  onApply: (next: { from: string; to: string }) => void;
  onClear: () => void;
  locale: "id" | "en";
  placeholder: string;
  applyLabel: string;
  clearLabel: string;
  startLabel: string;
  endLabel: string;
  mobileTitle?: string;
  className?: string;
};

const MOBILE_BREAKPOINT = "(max-width: 767px)";

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const media = window.matchMedia(MOBILE_BREAKPOINT);
    const update = () => setIsMobile(media.matches);
    update();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }

    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  return isMobile;
}

function parseInputDate(value: string) {
  if (!value) return null;
  const parsed = parse(value, "yyyy-MM-dd", new Date());
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatInputDate(value: Date) {
  return format(value, "yyyy-MM-dd");
}

function getNormalizedRange(from: Date | null, to: Date | null) {
  if (!from && !to) {
    return { start: null, end: null } as { start: Date | null; end: Date | null };
  }

  if (from && !to) {
    return { start: from, end: from };
  }

  if (!from && to) {
    return { start: to, end: to };
  }

  if (!from || !to) {
    return { start: null, end: null } as { start: Date | null; end: Date | null };
  }

  return isAfter(from, to)
    ? { start: to, end: from }
    : { start: from, end: to };
}

export function BookingDateRangePicker({
  value,
  onApply,
  onClear,
  locale,
  placeholder,
  applyLabel,
  clearLabel,
  startLabel,
  endLabel,
  mobileTitle,
  className,
}: BookingDateRangePickerProps) {
  const dateLocale = locale === "id" ? idLocale : enUS;
  const isMobile = useIsMobile();
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [draftFrom, setDraftFrom] = React.useState<Date | null>(null);
  const [draftTo, setDraftTo] = React.useState<Date | null>(null);
  const [viewMonth, setViewMonth] = React.useState<Date>(() => startOfMonth(new Date()));
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  const selectedFrom = React.useMemo(() => parseInputDate(value.from), [value.from]);
  const selectedTo = React.useMemo(() => parseInputDate(value.to), [value.to]);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  React.useEffect(() => {
    if (!open) return;

    const fallbackMonth = startOfMonth(selectedFrom || selectedTo || new Date());
    setDraftFrom(selectedFrom);
    setDraftTo(selectedTo || selectedFrom);
    setViewMonth(fallbackMonth);
  }, [open, selectedFrom, selectedTo]);

  React.useEffect(() => {
    if (!open || isMobile) return;

    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [open, isMobile]);

  React.useEffect(() => {
    if (!open) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open || !isMobile) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, isMobile]);

  const normalizedDraftRange = React.useMemo(
    () => getNormalizedRange(draftFrom, draftTo),
    [draftFrom, draftTo],
  );

  const normalizedSelectedRange = React.useMemo(
    () => getNormalizedRange(selectedFrom, selectedTo),
    [selectedFrom, selectedTo],
  );

  const triggerLabel = React.useMemo(() => {
    const { start, end } = normalizedSelectedRange;
    if (!start || !end) return placeholder;
    if (isSameDay(start, end)) {
      return format(start, "MMM d, yyyy", { locale: dateLocale });
    }
    return `${format(start, "MMM d", { locale: dateLocale })} - ${format(end, "MMM d, yyyy", { locale: dateLocale })}`;
  }, [normalizedSelectedRange, placeholder, dateLocale]);

  const calendarStart = React.useMemo(
    () => startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 0 }),
    [viewMonth],
  );
  const calendarEnd = React.useMemo(
    () => endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 0 }),
    [viewMonth],
  );

  const calendarDays = React.useMemo(() => {
    const days: Date[] = [];
    let current = calendarStart;
    while (!isAfter(current, calendarEnd)) {
      days.push(current);
      current = addDays(current, 1);
    }
    return days;
  }, [calendarStart, calendarEnd]);

  const weekdayLabels = React.useMemo(() => {
    const firstDay = startOfWeek(new Date(), { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, index) =>
      format(addDays(firstDay, index), "EEEEE", { locale: dateLocale }),
    );
  }, [dateLocale]);

  function handleDayClick(day: Date) {
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(day);
      setDraftTo(null);
      return;
    }

    if (isBefore(day, draftFrom)) {
      setDraftTo(draftFrom);
      setDraftFrom(day);
      return;
    }

    setDraftTo(day);
  }

  function applySelection() {
    if (!draftFrom) {
      return;
    }

    const normalized = getNormalizedRange(draftFrom, draftTo);
    if (!normalized.start || !normalized.end) {
      return;
    }

    onApply({
      from: formatInputDate(normalized.start),
      to: formatInputDate(normalized.end),
    });
    setOpen(false);
  }

  function clearSelection() {
    setDraftFrom(null);
    setDraftTo(null);
    onClear();
    setOpen(false);
  }

  const draftStartLabel = normalizedDraftRange.start
    ? format(normalizedDraftRange.start, "MMM d, yyyy", { locale: dateLocale })
    : "-";
  const draftEndLabel = normalizedDraftRange.end
    ? format(normalizedDraftRange.end, "MMM d, yyyy", { locale: dateLocale })
    : "-";

  const pickerBody = (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <p className="text-base font-semibold">
          {format(viewMonth, "MMMM yyyy", { locale: dateLocale })}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewMonth((previous) => addMonths(previous, -1))}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMonth((previous) => addMonths(previous, 1))}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {weekdayLabels.map((label, index) => (
          <span key={`${label}-${index}`} className="py-1">
            {label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day) => {
          const { start, end } = normalizedDraftRange;
          const isStart = Boolean(start && isSameDay(day, start));
          const isEnd = Boolean(end && isSameDay(day, end));
          const isInRange = Boolean(
            start && end && isAfter(day, start) && isBefore(day, end),
          );
          const isCurrentMonth = isSameMonth(day, viewMonth);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => handleDayClick(day)}
              className={cn(
                "h-9 w-9 rounded-md text-sm transition-colors",
                isStart || isEnd
                  ? "bg-primary text-primary-foreground"
                  : isInRange
                    ? "bg-primary/15 text-foreground"
                    : "hover:bg-muted",
                !isCurrentMonth && "text-muted-foreground/50",
              )}
            >
              {format(day, "d", { locale: dateLocale })}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">{startLabel}</p>
          <div className="h-9 rounded-md border border-input bg-background/50 px-3 text-sm leading-9">
            {draftStartLabel}
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">{endLabel}</p>
          <div className="h-9 rounded-md border border-input bg-background/50 px-3 text-sm leading-9">
            {draftEndLabel}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={clearSelection}
          className="h-9 flex-1 rounded-md border border-input px-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
        >
          {clearLabel}
        </button>
        <button
          type="button"
          onClick={applySelection}
          disabled={!draftFrom}
          className="h-9 flex-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {applyLabel}
        </button>
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="h-9 w-full rounded-md border border-input bg-background/50 px-3 text-sm outline-none transition-colors hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2 truncate text-left">
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{triggerLabel}</span>
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </span>
      </button>

      {open && !isMobile ? (
        <div className="absolute left-0 top-[calc(100%+0.35rem)] z-[125] w-[min(24rem,calc(100vw-2rem))] rounded-xl border bg-popover shadow-lg">
          {pickerBody}
        </div>
      ) : null}

      {mounted && isMobile
        ? createPortal(
            <div
              className={cn(
                "fixed inset-0 z-[130] md:hidden transition-[visibility]",
                open ? "visible" : "invisible",
              )}
              aria-hidden={!open}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={cn(
                  "absolute inset-0 bg-black/45 transition-opacity",
                  open ? "opacity-100" : "opacity-0",
                )}
                aria-label="Close"
              />

              <div
                className={cn(
                  "absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-2xl border border-border bg-card shadow-2xl transition-transform duration-200 ease-out",
                  open ? "translate-y-0" : "translate-y-full",
                )}
              >
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <p className="text-sm font-semibold">{mobileTitle || placeholder}</p>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {pickerBody}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
