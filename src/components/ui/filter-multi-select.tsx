"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type FilterMultiSelectOption = {
  value: string;
  label: string;
};

type FilterMultiSelectProps = {
  values: string[];
  onChange: (nextValues: string[]) => void;
  options: FilterMultiSelectOption[];
  placeholder: string;
  allLabel?: string;
  countSuffix?: string;
  title?: string;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  mobileTitle?: string;
  disabled?: boolean;
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

export function FilterMultiSelect({
  values,
  onChange,
  options,
  placeholder,
  allLabel,
  countSuffix = "selected",
  title,
  className,
  triggerClassName,
  menuClassName,
  mobileTitle,
  disabled,
}: FilterMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile();

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

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

  const selectedSet = React.useMemo(() => new Set(values), [values]);
  const selectedOptions = React.useMemo(
    () => options.filter((option) => selectedSet.has(option.value)),
    [options, selectedSet],
  );

  const triggerLabel = React.useMemo(() => {
    if (selectedOptions.length === 0) return placeholder;
    if (selectedOptions.length === 1) return selectedOptions[0].label;
    return `${selectedOptions.length} ${countSuffix}`;
  }, [countSuffix, placeholder, selectedOptions]);

  const normalizeSelectedValues = React.useCallback(
    (nextSet: Set<string>) =>
      options.filter((option) => nextSet.has(option.value)).map((option) => option.value),
    [options],
  );

  const toggleValue = React.useCallback(
    (value: string) => {
      const nextSet = new Set(values);
      if (nextSet.has(value)) {
        nextSet.delete(value);
      } else {
        nextSet.add(value);
      }
      onChange(normalizeSelectedValues(nextSet));
    },
    [normalizeSelectedValues, onChange, values],
  );

  const optionButtons = (
    <div className={cn("max-h-64 overflow-y-auto p-1", menuClassName)}>
      {allLabel ? (
        <button
          type="button"
          onClick={() => onChange([])}
          aria-pressed={values.length === 0}
          className={cn(
            "mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            values.length === 0 ? "bg-muted font-medium" : "hover:bg-muted/70",
          )}
        >
          <span
            className={cn(
              "grid h-7 w-7 shrink-0 place-items-center rounded-md border transition-colors",
              values.length === 0
                ? "border-foreground bg-foreground text-background"
                : "border-input bg-background text-foreground",
            )}
            aria-hidden
          >
            <Check className={cn("h-4 w-4 transition-opacity", values.length === 0 ? "opacity-100" : "opacity-0")} />
          </span>
          <span className="min-w-0 flex-1 truncate">{allLabel}</span>
        </button>
      ) : null}
      {options.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">-</p>
      ) : (
        options.map((option) => {
          const isSelected = selectedSet.has(option.value);
          return (
            <button
              key={`${option.value}:${option.label}`}
              type="button"
              onClick={() => toggleValue(option.value)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isSelected ? "bg-muted font-medium" : "hover:bg-muted/70",
              )}
              aria-pressed={isSelected}
            >
              <span
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-md border transition-colors",
                  isSelected
                    ? "border-foreground bg-foreground text-background"
                    : "border-input bg-background text-foreground",
                )}
                aria-hidden
              >
                <Check
                  className={cn(
                    "h-4 w-4 transition-opacity",
                    isSelected ? "opacity-100" : "opacity-0",
                  )}
                />
              </span>
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
            </button>
          );
        })
      )}
    </div>
  );

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          setOpen((previous) => !previous);
        }}
        className={cn(
          "h-9 w-full rounded-md border border-input bg-background/50 px-3 text-sm outline-none transition-colors hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
          triggerClassName,
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={title}
        disabled={disabled}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="min-w-0 flex-1 truncate text-left">{triggerLabel}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </span>
      </button>

      {open && !isMobile ? (
        <div className="absolute left-0 top-[calc(100%+0.35rem)] z-[125] w-full rounded-md border bg-popover shadow-lg">
          {optionButtons}
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
                  "absolute inset-x-0 bottom-0 rounded-t-2xl border border-border bg-card shadow-2xl transition-transform duration-200 ease-out",
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
                <div className="max-h-[55dvh] overflow-y-auto py-2">{optionButtons}</div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
