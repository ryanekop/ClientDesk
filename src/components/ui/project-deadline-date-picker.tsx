"use client";

import * as React from "react";
import { format, isValid, parse } from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import { CalendarDays, X } from "lucide-react";

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

type ProjectDeadlineDatePickerProps = {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  locale: "id" | "en";
  placeholder: string;
  clearLabel?: string;
  title?: string;
  className?: string;
  triggerClassName?: string;
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

function parseDateOnly(value: string | null | undefined) {
  if (!value) return undefined;
  const parsed = parse(value, "yyyy-MM-dd", new Date());
  return isValid(parsed) ? parsed : undefined;
}

function formatDateOnly(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function formatDisplayDate(date: Date, locale: "id" | "en") {
  if (locale === "en") {
    return format(date, "MMM d, yyyy", { locale: enUS });
  }

  return format(date, "dd / MM / yyyy", { locale: idLocale });
}

export function ProjectDeadlineDatePicker({
  value,
  onChange,
  disabled = false,
  locale,
  placeholder,
  clearLabel,
  title,
  className,
  triggerClassName,
}: ProjectDeadlineDatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selectedDate = React.useMemo(() => parseDateOnly(value), [value]);
  const dateLocale = locale === "id" ? idLocale : enUS;
  const isMobile = useIsMobile();
  const resolvedClearLabel =
    clearLabel || (locale === "en" ? "Clear deadline" : "Hapus deadline");
  const sheetTitle = locale === "en" ? "Pick Deadline" : "Pilih Deadline";
  const sheetDescription =
    locale === "en"
      ? "Choose a project deadline date."
      : "Pilih tanggal deadline project.";

  function handleSelect(nextDate: Date | undefined) {
    if (!nextDate) return;
    onChange(formatDateOnly(nextDate));
    setOpen(false);
  }

  function handleClear() {
    onChange(null);
    setOpen(false);
  }

  const triggerButton = (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      data-empty={!selectedDate}
      title={title}
      className={cn(
        "h-8 w-[160px] justify-start px-2 text-left text-xs font-normal data-[empty=true]:text-muted-foreground",
        triggerClassName,
      )}
    >
      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">
        {selectedDate ? formatDisplayDate(selectedDate, locale) : placeholder}
      </span>
    </Button>
  );

  const calendarContent = (
    <div className="space-y-2 p-2">
      <Calendar
        mode="single"
        selected={selectedDate}
        defaultMonth={selectedDate || new Date()}
        onSelect={handleSelect}
        locale={dateLocale}
        initialFocus
      />
      {selectedDate ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-center text-muted-foreground"
          onClick={handleClear}
        >
          {resolvedClearLabel}
        </Button>
      ) : null}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <div className={cn("flex items-center gap-1.5", className)}>
          <SheetTrigger asChild>{triggerButton}</SheetTrigger>
        </div>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="max-h-[88dvh] overflow-y-auto rounded-t-2xl px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-4"
        >
          <SheetHeader className="flex-row items-center justify-between space-y-0">
            <SheetTitle className="text-base">{sheetTitle}</SheetTitle>
            <SheetClose className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </SheetClose>
            <SheetDescription className="sr-only">
              {sheetDescription}
            </SheetDescription>
          </SheetHeader>
          <div className="flex justify-center pt-2">{calendarContent}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("flex items-center gap-1.5", className)}>
        <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        {calendarContent}
      </PopoverContent>
    </Popover>
  );
}
