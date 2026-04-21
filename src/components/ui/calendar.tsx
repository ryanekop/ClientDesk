"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const isRangeMode = props.mode === "range";

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        ...classNames,
        root: cn("relative w-fit", classNames?.root),
        months: cn("flex flex-col gap-4 sm:flex-row", classNames?.months),
        month: cn("space-y-4", classNames?.month),
        month_caption: cn("flex h-8 items-center justify-center px-8", classNames?.month_caption),
        caption_label: cn("text-sm font-medium", classNames?.caption_label),
        nav: cn("absolute right-2 top-2 flex items-center gap-1", classNames?.nav),
        button_previous: cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md border border-input bg-background p-0 text-muted-foreground shadow-xs hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
          classNames?.button_previous,
        ),
        button_next: cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md border border-input bg-background p-0 text-muted-foreground shadow-xs hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
          classNames?.button_next,
        ),
        month_grid: cn("w-full border-collapse", classNames?.month_grid),
        weekdays: cn("flex", classNames?.weekdays),
        weekday: cn(
          "w-9 rounded-md text-[0.8rem] font-normal text-muted-foreground",
          classNames?.weekday,
        ),
        week: cn("mt-2 flex w-full", classNames?.week),
        day: cn(
          "relative h-9 w-9 p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected].day-outside)]:bg-accent/50",
          isRangeMode
            ? "[&:has(.day-range-end)]:rounded-r-md [&:has(.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md [&:has([aria-selected])]:bg-accent"
            : "[&:has([aria-selected])]:rounded-md [&:has([aria-selected])]:bg-accent",
          classNames?.day,
        ),
        day_button: cn(
          "flex h-9 w-9 items-center justify-center rounded-md p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          classNames?.day_button,
        ),
        selected: cn(
          !isRangeMode &&
            "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground [&>button]:focus:bg-primary [&>button]:focus:text-primary-foreground",
          classNames?.selected,
        ),
        range_start: cn(
          "day-range-start [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground [&>button]:focus:bg-primary [&>button]:focus:text-primary-foreground",
          classNames?.range_start,
        ),
        range_end: cn(
          "day-range-end [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground [&>button]:focus:bg-primary [&>button]:focus:text-primary-foreground",
          classNames?.range_end,
        ),
        range_middle: cn(
          "aria-selected:bg-accent aria-selected:text-accent-foreground [&>button]:bg-transparent [&>button]:text-foreground [&>button]:hover:bg-transparent [&>button]:hover:text-foreground [&>button]:focus:bg-transparent [&>button]:focus:text-foreground [&>button]:rounded-none",
          classNames?.range_middle,
        ),
        today: cn("[&>button]:bg-accent [&>button]:text-accent-foreground", classNames?.today),
        outside: cn(
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
          classNames?.outside,
        ),
        disabled: cn("text-muted-foreground opacity-50", classNames?.disabled),
        hidden: cn("invisible", classNames?.hidden),
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("h-4 w-4", chevronClassName)} />
          ) : (
            <ChevronRight className={cn("h-4 w-4", chevronClassName)} />
          ),
        ...props.components,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
