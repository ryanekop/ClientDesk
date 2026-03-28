"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, Search } from "lucide-react";

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
  searchError?: string;
  manualOptionLabel?: string;
  manualOptionHint?: string;
  manualModeHint?: string;
  manualAbbreviationLabel?: string;
  manualAbbreviationPlaceholder?: string;
  backToSuggestionsLabel?: string;
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
  allowManualEntry?: boolean;
  manualEntryActive?: boolean;
  onManualEntryActiveChange?: (value: boolean) => void;
  manualAbbreviationValue?: string;
  onManualAbbreviationChange?: (value: string) => void;
  strings?: UniversityAutocompleteStrings;
};

const DEFAULT_INPUT_CLASS =
  "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 pr-8 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function UniversityAutocomplete({
  value,
  selectedId,
  onValueChange,
  onSelect,
  placeholder,
  required = false,
  disabled = false,
  inputClassName,
  allowManualEntry = false,
  manualEntryActive = false,
  onManualEntryActiveChange,
  manualAbbreviationValue = "",
  onManualAbbreviationChange,
  strings,
}: UniversityAutocompleteProps) {
  const t = useTranslations("UniversityAutocomplete");
  const defaultStrings = React.useMemo<Required<UniversityAutocompleteStrings>>(
    () => ({
      noResults: t("noResults"),
      selectionHint: t("selectionHint"),
      searchError: t("searchError"),
      manualOptionLabel: t("manualOptionLabel"),
      manualOptionHint: t("manualOptionHint"),
      manualModeHint: t("manualModeHint"),
      manualAbbreviationLabel: t("manualAbbreviationLabel"),
      manualAbbreviationPlaceholder: t("manualAbbreviationPlaceholder"),
      backToSuggestionsLabel: t("backToSuggestionsLabel"),
    }),
    [t],
  );
  const uiStrings = { ...defaultStrings, ...strings };
  const resolvedPlaceholder = placeholder || t("placeholder");
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<UniversityReferenceItem[]>([]);
  const [loading, setLoading] = React.useState(false);
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
    if (manualEntryActive) {
      setItems([]);
      setLoading(false);
      setOpen(false);
      return;
    }

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
          throw new Error(uiStrings.searchError);
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
            : uiStrings.searchError,
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
  }, [manualEntryActive, searchTerm, uiStrings.searchError]);

  const invalidSelection =
    !manualEntryActive && searchTerm.length > 0 && !selectedId && !loading;

  function handleInputChange(nextValue: string) {
    onValueChange(nextValue);
    onSelect(null);
    if (!manualEntryActive) {
      setOpen(true);
    }
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
    onManualEntryActiveChange?.(false);
    onManualAbbreviationChange?.("");
  }

  function handleEnableManualEntry() {
    onSelect(null);
    onManualEntryActiveChange?.(true);
    setOpen(false);
    setError("");
    setActiveIndex(-1);
  }

  function handleDisableManualEntry() {
    onManualEntryActiveChange?.(false);
    onManualAbbreviationChange?.("");
    setError("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    const actionCount = items.length;

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
      }
    }
  }

  const showResults =
    !manualEntryActive &&
    open &&
    (loading || items.length > 0 || !!error || invalidSelection);

  return (
    <div ref={rootRef} className="space-y-1.5">
      <div className="relative">
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => handleInputChange(event.target.value)}
          onFocus={() => {
            if (!manualEntryActive) {
              setOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={resolvedPlaceholder}
          className={cn(DEFAULT_INPUT_CLASS, inputClassName)}
          required={required}
          disabled={disabled}
          autoComplete="off"
        />
        {loading ? (
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

            {error ? (
              <div className="border-t px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {manualEntryActive ? (
        <div className="space-y-2 rounded-lg border border-dashed bg-muted/25 p-3">
          <p className="text-[11px] text-muted-foreground">
            {uiStrings.manualModeHint}
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {uiStrings.manualAbbreviationLabel}
            </label>
            <input
              value={manualAbbreviationValue}
              onChange={(event) =>
                onManualAbbreviationChange?.(event.target.value)
              }
              placeholder={uiStrings.manualAbbreviationPlaceholder}
              className={cn(DEFAULT_INPUT_CLASS, inputClassName)}
              disabled={disabled}
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            onClick={handleDisableManualEntry}
            className="text-xs font-medium text-primary transition-opacity hover:opacity-80"
          >
            {uiStrings.backToSuggestionsLabel}
          </button>
        </div>
      ) : allowManualEntry ? (
        <div className="space-y-1">
          <button
            type="button"
            onClick={handleEnableManualEntry}
            className="text-xs font-medium text-primary transition-opacity hover:opacity-80"
          >
            {uiStrings.manualOptionLabel}
          </button>
          <p className="text-[11px] text-muted-foreground">
            {uiStrings.manualOptionHint}
          </p>
        </div>
      ) : null}

      {invalidSelection ? (
        <p className="text-[11px] text-amber-600">{uiStrings.selectionHint}</p>
      ) : null}
    </div>
  );
}
