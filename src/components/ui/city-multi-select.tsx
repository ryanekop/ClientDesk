"use client";

import * as React from "react";
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
  disabled?: boolean;
  className?: string;
};

function normalizeValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function CityMultiSelect({
  options,
  values,
  onChange,
  hiddenInputName,
  placeholder = "Bebas semua kota / kabupaten",
  searchPlaceholder = "Cari kota / kabupaten...",
  emptyText = "Data tidak ditemukan.",
  disabled = false,
  className,
}: CityMultiSelectProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const selectedSet = React.useMemo(() => new Set(values), [values]);

  React.useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
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

  return (
    <div ref={rootRef} className={cn("space-y-2", className)}>
      {hiddenInputName
        ? values.map((code) => (
            <input key={code} type="hidden" name={hiddenInputName} value={code} />
          ))
        : null}

      <button
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

      {open ? (
        <div className="rounded-lg border bg-popover shadow-sm">
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
          <div className="max-h-64 overflow-y-auto py-1">
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
        </div>
      ) : null}

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
