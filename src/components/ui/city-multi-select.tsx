"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  buildCityDisplayName,
  type CityReferenceItem,
} from "@/lib/city-references";

type CityMultiSelectProps = {
  options: CityReferenceItem[];
  values: string[];
  onChange: (cityCodes: string[]) => void;
  hiddenInputName?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  mobileTitle?: string;
  disabled?: boolean;
  className?: string;
};

const MOBILE_BREAKPOINT = "(max-width: 767px)";

function normalizeValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

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

export function CityMultiSelect({
  options,
  values,
  onChange,
  hiddenInputName,
  placeholder = "Bebas semua kota / kabupaten",
  searchPlaceholder = "Cari kota / kabupaten...",
  emptyText = "Data tidak ditemukan.",
  mobileTitle = "Kota / Kabupaten",
  disabled = false,
  className,
}: CityMultiSelectProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [desktopPanelStyle, setDesktopPanelStyle] = React.useState<React.CSSProperties>({});

  const isMobile = useIsMobile();
  const selectedSet = React.useMemo(() => new Set(values), [values]);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((item) => {
      const haystack = `${item.city_name} ${item.province_name} ${item.city_code}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [options, query]);

  const selectedItems = React.useMemo(
    () => options.filter((item) => selectedSet.has(item.city_code)),
    [options, selectedSet],
  );

  const updateDesktopPanelPosition = React.useCallback(() => {
    if (!triggerRef.current || typeof window === "undefined") return;

    const rect = triggerRef.current.getBoundingClientRect();
    const horizontalPadding = 12;
    const minPanelWidth = Math.max(rect.width, 520);
    const maxPanelWidth = Math.max(320, window.innerWidth - horizontalPadding * 2);
    const panelWidth = Math.min(minPanelWidth, maxPanelWidth);

    const left = Math.min(
      Math.max(horizontalPadding, rect.left),
      window.innerWidth - panelWidth - horizontalPadding,
    );

    setDesktopPanelStyle({
      width: panelWidth,
      top: rect.bottom + 6,
      left,
    });
  }, []);

  React.useEffect(() => {
    if (!open || isMobile) return;

    updateDesktopPanelPosition();

    function handleViewportChange() {
      updateDesktopPanelPosition();
    }

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, isMobile, updateDesktopPanelPosition]);

  React.useEffect(() => {
    if (!open || isMobile) return;

    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
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

  function toggleCity(cityCode: string) {
    if (selectedSet.has(cityCode)) {
      onChange(values.filter((value) => value !== cityCode));
      return;
    }
    onChange(normalizeValues([...values, cityCode]));
  }

  function clearAll() {
    onChange([]);
  }

  const optionsList = (
    <>
      <div className="border-b p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 w-full rounded-md border border-input bg-background py-1 pl-7 pr-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[2px]"
            autoFocus
          />
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto py-1">
        {filteredOptions.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">{emptyText}</div>
        ) : (
          filteredOptions.map((item) => {
            const checked = selectedSet.has(item.city_code);
            return (
              <button
                key={item.city_code}
                type="button"
                onClick={() => toggleCity(item.city_code)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
              >
                <span className="truncate">{buildCityDisplayName(item)}</span>
                <span
                  className={cn(
                    "inline-flex h-4 w-4 items-center justify-center rounded border",
                    checked
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40 text-transparent",
                  )}
                >
                  <Check className="h-3.5 w-3.5" />
                </span>
              </button>
            );
          })
        )}
      </div>
      <div className="flex items-center justify-between border-t px-3 py-2">
        <span className="text-xs text-muted-foreground">
          {values.length === 0
            ? "Paket berlaku untuk semua kota / kabupaten."
            : `${values.length} kota / kabupaten dipilih.`}
        </span>
        <button
          type="button"
          onClick={clearAll}
          className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Reset
        </button>
      </div>
    </>
  );

  return (
    <div ref={rootRef} className={cn("space-y-2", className)}>
      {hiddenInputName
        ? values.map((code) => (
            <input key={code} type="hidden" name={hiddenInputName} value={code} />
          ))
        : null}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={cn("truncate", values.length === 0 && "text-muted-foreground")}>
          {values.length === 0 ? placeholder : `${values.length} kota / kabupaten dipilih`}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && mounted && !isMobile
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed z-[160] rounded-lg border bg-popover shadow-lg"
              style={desktopPanelStyle}
            >
              {optionsList}
            </div>,
            document.body,
          )
        : null}

      {mounted && isMobile
        ? createPortal(
            <div
              className={cn(
                "fixed inset-0 z-[160] md:hidden transition-[visibility]",
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
                  "absolute inset-x-0 bottom-0 flex max-h-[70dvh] flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl transition-transform duration-200 ease-out",
                  open ? "translate-y-0" : "translate-y-full",
                )}
              >
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <p className="text-sm font-semibold">{mobileTitle}</p>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">{optionsList}</div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {selectedItems.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedItems.map((item) => (
            <button
              key={item.city_code}
              type="button"
              onClick={() => toggleCity(item.city_code)}
              className="inline-flex items-center gap-1 rounded-full border border-input bg-muted/40 px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-muted"
            >
              <span className="max-w-[18rem] truncate">{buildCityDisplayName(item)}</span>
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
