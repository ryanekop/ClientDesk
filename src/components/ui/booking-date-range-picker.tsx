"use client";

import * as React from "react";
import { format, isAfter, isSameDay, isValid, parse } from "date-fns";
import type { Locale } from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
  if (!value) return undefined;
  const parsed = parse(value, "yyyy-MM-dd", new Date());
  return isValid(parsed) ? parsed : undefined;
}

function formatInputDate(value: Date) {
  return format(value, "yyyy-MM-dd");
}

function normalizeRange(from: Date | undefined, to: Date | undefined): DateRange | undefined {
  if (!from && !to) return undefined;
  if (from && !to) return { from, to: from };
  if (!from && to) return { from: to, to };
  if (!from || !to) return undefined;

  return isAfter(from, to)
    ? { from: to, to: from }
    : { from, to };
}

function formatRangeLabel(
  range: DateRange | undefined,
  placeholder: string,
  dateLocale: Locale,
) {
  if (!range?.from || !range?.to) return placeholder;
  if (isSameDay(range.from, range.to)) {
    return format(range.from, "MMM d, yyyy", { locale: dateLocale });
  }

  return `${format(range.from, "MMM d", { locale: dateLocale })} - ${format(range.to, "MMM d, yyyy", { locale: dateLocale })}`;
}

function formatSummaryDate(value: Date | undefined, dateLocale: Locale) {
  return value ? format(value, "MMM d, yyyy", { locale: dateLocale }) : "-";
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
  const [open, setOpen] = React.useState(false);
  const selectedFrom = React.useMemo(() => parseInputDate(value.from), [value.from]);
  const selectedTo = React.useMemo(() => parseInputDate(value.to), [value.to]);
  const selectedRange = React.useMemo(
    () => normalizeRange(selectedFrom, selectedTo),
    [selectedFrom, selectedTo],
  );
  const [draftRange, setDraftRange] = React.useState<DateRange | undefined>(selectedRange);

  React.useEffect(() => {
    if (open) {
      setDraftRange(selectedRange);
    }
  }, [open, selectedRange]);

  const normalizedDraftRange = React.useMemo(
    () => normalizeRange(draftRange?.from, draftRange?.to),
    [draftRange],
  );

  const triggerLabel = React.useMemo(
    () => formatRangeLabel(selectedRange, placeholder, dateLocale),
    [dateLocale, placeholder, selectedRange],
  );

  function applySelection() {
    if (!draftRange?.from) return;
    const normalized = normalizeRange(draftRange.from, draftRange.to);
    if (!normalized?.from || !normalized.to) return;

    onApply({
      from: formatInputDate(normalized.from),
      to: formatInputDate(normalized.to),
    });
    setOpen(false);
  }

  function clearSelection() {
    setDraftRange(undefined);
    onClear();
    setOpen(false);
  }

  const triggerButton = (
    <button
      type="button"
      onClick={() => setOpen((previous) => !previous)}
      className="h-9 w-full rounded-md border border-input bg-background/50 px-3 text-sm outline-none transition-colors hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-ring"
      aria-expanded={open}
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
  );

  const pickerBody = (
    <div className="space-y-4 p-3 sm:p-4">
      <Calendar
        mode="range"
        selected={draftRange}
        defaultMonth={draftRange?.from || selectedRange?.from || new Date()}
        onSelect={setDraftRange}
        locale={dateLocale}
        numberOfMonths={isMobile ? 1 : 2}
        pagedNavigation={!isMobile}
        initialFocus
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">{startLabel}</p>
          <div className="h-9 rounded-md border border-input bg-background/50 px-3 text-sm leading-9">
            {formatSummaryDate(normalizedDraftRange?.from, dateLocale)}
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">{endLabel}</p>
          <div className="h-9 rounded-md border border-input bg-background/50 px-3 text-sm leading-9">
            {formatSummaryDate(normalizedDraftRange?.to, dateLocale)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clearSelection}
          className="flex-1"
        >
          {clearLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={applySelection}
          disabled={!draftRange?.from}
          className="flex-1"
        >
          {applyLabel}
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <div className={cn("relative", className)}>
          <SheetTrigger asChild>{triggerButton}</SheetTrigger>
        </div>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="max-h-[88dvh] overflow-y-auto rounded-t-2xl px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4"
        >
          <SheetHeader className="flex-row items-center justify-between space-y-0">
            <SheetTitle className="text-base">{mobileTitle || placeholder}</SheetTitle>
            <SheetClose className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </SheetClose>
            <SheetDescription className="sr-only">
              {placeholder}
            </SheetDescription>
          </SheetHeader>
          <div className="flex justify-center pt-2">{pickerBody}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("relative", className)}>
        <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        {pickerBody}
      </PopoverContent>
    </Popover>
  );
}
