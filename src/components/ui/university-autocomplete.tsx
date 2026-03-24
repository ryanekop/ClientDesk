"use client";

import * as React from "react";
import { Check, Loader2, Search, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  buildUniversityDisplayName,
  cleanUniversityName,
  normalizeUniversityName,
  type UniversityReferenceItem,
} from "@/lib/university-references";

type UniversityAutocompleteStrings = {
  noResults?: string;
  selectionHint?: string;
  createLabel?: (name: string) => string;
  createError?: string;
};

type UniversityAutocompleteProps = {
  value: string;
  selectedId?: string;
  onValueChange: (value: string) => void;
  onSelect: (item: UniversityReferenceItem | null) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  inputClassName?: string;
  allowManualCreate?: boolean;
  strings?: UniversityAutocompleteStrings;
};

const DEFAULT_INPUT_CLASS =
  "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 pr-8 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const DEFAULT_STRINGS: Required<UniversityAutocompleteStrings> = {
  noResults: "Universitas tidak ditemukan.",
  selectionHint: "Pilih universitas dari suggestion yang tersedia.",
  createLabel: (name: string) => `Tambah "${name}" ke referensi`,
  createError: "Gagal menambahkan universitas ke referensi.",
};

export function UniversityAutocomplete({
  value,
  selectedId,
  onValueChange,
  onSelect,
  placeholder = "Cari universitas...",
  required = false,
  disabled = false,
  inputClassName,
  allowManualCreate = false,
  strings,
}: UniversityAutocompleteProps) {
  const uiStrings = { ...DEFAULT_STRINGS, ...strings };
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<UniversityReferenceItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(-1);

  const searchTerm = cleanUniversityName(value);

  React.useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  React.useEffect(() => {
    if (!open) {
      setActiveIndex(-1);
    }
  }, [open]);

  React.useEffect(() => {
    const normalizedSearchTerm = normalizeUniversityName(searchTerm);
    if (normalizedSearchTerm.length < 2) {
      setItems([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError("");
        const response = await fetch(
          `/api/public/universities/search?q=${encodeURIComponent(
            searchTerm,
          )}&limit=8`,
          {
            method: "GET",
            signal: controller.signal,
          },
        );

        const payload = await response.json().catch(() => ({ items: [] }));
        if (!response.ok) {
          throw new Error(payload.error || "Gagal mencari universitas.");
        }

        setItems(
          Array.isArray(payload.items)
            ? payload.items.filter(
                (item: unknown): item is UniversityReferenceItem =>
                  Boolean(item) &&
                  typeof item === "object" &&
                  typeof (item as UniversityReferenceItem).id === "string" &&
                  typeof (item as UniversityReferenceItem).name === "string" &&
                  typeof (item as UniversityReferenceItem).displayName === "string",
              )
            : [],
        );
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        setItems([]);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Gagal mencari universitas.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [searchTerm]);

  const invalidSelection =
    searchTerm.length > 0 && !selectedId && !loading && !creating;

  function handleInputChange(nextValue: string) {
    onValueChange(nextValue);
    onSelect(null);
    setOpen(true);
    setError("");
  }

  function selectItem(item: UniversityReferenceItem) {
    onValueChange(
      item.displayName || buildUniversityDisplayName(item.name, item.abbreviation),
    );
    onSelect(item);
    setItems((current) => {
      const alreadyExists = current.some((entry) => entry.id === item.id);
      return alreadyExists ? current : [item, ...current];
    });
    setOpen(false);
    setActiveIndex(-1);
    setError("");
  }

  async function handleManualCreate() {
    const cleanedName = cleanUniversityName(value);
    if (!cleanedName || creating) return;

    setCreating(true);
    setError("");

    try {
      const response = await fetch("/api/internal/reference/universities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: cleanedName }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.item) {
        throw new Error(payload.error || uiStrings.createError);
      }
      selectItem(payload.item as UniversityReferenceItem);
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : uiStrings.createError,
      );
    } finally {
      setCreating(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    const hasCreateAction =
      allowManualCreate &&
      searchTerm.length >= 2 &&
      items.length === 0 &&
      !loading &&
      !creating;
    const actionCount = items.length + (hasCreateAction ? 1 : 0);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      if (actionCount === 0) return;
      setActiveIndex((current) => (current + 1) % actionCount);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (actionCount === 0) return;
      setActiveIndex((current) =>
        current <= 0 ? actionCount - 1 : current - 1,
      );
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (event.key === "Enter" && open) {
      if (activeIndex >= 0 && activeIndex < items.length) {
        event.preventDefault();
        selectItem(items[activeIndex]);
        return;
      }
      if (hasCreateAction && activeIndex === items.length) {
        event.preventDefault();
        void handleManualCreate();
      }
    }
  }

  const showResults = open && (loading || items.length > 0 || !!error || invalidSelection);
  const canCreate =
    allowManualCreate &&
    searchTerm.length >= 2 &&
    items.length === 0 &&
    !loading;

  return (
    <div ref={rootRef} className="space-y-1.5">
      <div className="relative">
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => handleInputChange(event.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(DEFAULT_INPUT_CLASS, inputClassName)}
          required={required}
          disabled={disabled}
          autoComplete="off"
        />
        {loading || creating ? (
          <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <Search className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        )}

        {showResults ? (
          <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border bg-popover shadow-lg">
            {items.map((item, index) => {
              const selected = item.id === selectedId;
              const active = index === activeIndex;

              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectItem(item)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors",
                    active
                      ? "bg-muted"
                      : "hover:bg-muted/70",
                  )}
                >
                  <span className="truncate">
                    {item.displayName ||
                      buildUniversityDisplayName(item.name, item.abbreviation)}
                  </span>
                  {selected ? (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  ) : null}
                </button>
              );
            })}

            {!loading && items.length === 0 && !error ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {uiStrings.noResults}
              </div>
            ) : null}

            {canCreate ? (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void handleManualCreate()}
                className={cn(
                  "flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-muted/70",
                  activeIndex === items.length ? "bg-muted" : "",
                )}
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {uiStrings.createLabel(searchTerm)}
                </span>
              </button>
            ) : null}

            {error ? (
              <div className="border-t px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {invalidSelection ? (
        <p className="text-[11px] text-amber-600">{uiStrings.selectionHint}</p>
      ) : null}
    </div>
  );
}
