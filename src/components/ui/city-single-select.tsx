"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  buildCityDisplayName,
  type CityReferenceItem,
} from "@/lib/city-references";

type CitySingleSelectProps = {
  options: CityReferenceItem[];
  value: string;
  onChange: (cityCode: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
};

export function CitySingleSelect({
  options,
  value,
  onChange,
  placeholder = "Pilih kota / kabupaten",
  searchPlaceholder = "Cari kota / kabupaten...",
  emptyText = "Data tidak ditemukan.",
  disabled = false,
  className,
}: CitySingleSelectProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const selected = React.useMemo(
    () => options.find((item) => item.city_code === value) || null,
    [options, value],
  );

  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((item) => {
      const haystack = `${item.city_name} ${item.province_name} ${item.city_code}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [options, query]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected ? buildCityDisplayName(selected) : placeholder}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open ? (
        <div className="absolute z-40 mt-1 w-full rounded-lg border bg-popover shadow-lg">
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
                const isSelected = item.city_code === value;
                return (
                  <button
                    key={item.city_code}
                    type="button"
                    onClick={() => {
                      onChange(item.city_code);
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
                  >
                    <span className="truncate">{buildCityDisplayName(item)}</span>
                    {isSelected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
