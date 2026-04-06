"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, Search } from "lucide-react";

import { cn } from "@/lib/utils";

type ServiceAutocompleteItem = {
  id: string;
  name: string;
  is_addon?: boolean;
  event_types?: string[] | null;
};

type ServiceAutocompleteStrings = {
  noResults?: string;
  searchError?: string;
};

type ServiceAutocompleteProps = {
  value: string;
  onValueChange: (value: string) => void;
  onSelect?: (item: ServiceAutocompleteItem | null) => void;
  placeholder?: string;
  disabled?: boolean;
  inputClassName?: string;
  containerClassName?: string;
  onPaste?: (event: React.ClipboardEvent<HTMLInputElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  usePortalMenu?: boolean;
  portalMinWidth?: number;
  group: "main" | "addon";
  eventType?: string;
  selectionMode?: "single" | "append";
  separator?: string;
  strings?: ServiceAutocompleteStrings;
};

const DEFAULT_INPUT_CLASS =
  "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 pr-8 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

function splitMultiValueTokens(value: string) {
  return value
    .split(/\r?\n|[|,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueTokensCaseInsensitive(tokens: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const token of tokens) {
    const key = token.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(token.trim());
  }
  return unique;
}

export function ServiceAutocomplete({
  value,
  onValueChange,
  onSelect,
  placeholder,
  disabled = false,
  inputClassName,
  containerClassName,
  onPaste,
  onBlur,
  usePortalMenu = false,
  portalMinWidth = 480,
  group,
  eventType = "",
  selectionMode = "single",
  separator = " | ",
  strings,
}: ServiceAutocompleteProps) {
  const uiStrings = React.useMemo<Required<ServiceAutocompleteStrings>>(
    () => ({
      noResults:
        group === "addon" ? "Add-on tidak ditemukan." : "Paket utama tidak ditemukan.",
      searchError: "Gagal memuat suggestion layanan.",
      ...strings,
    }),
    [group, strings],
  );

  const resolvedPlaceholder =
    placeholder || (group === "addon" ? "Cari add-on..." : "Cari paket utama...");

  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const portalMenuRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);
  const [portalMenuPosition, setPortalMenuPosition] = React.useState<{
    ready: boolean;
    top: number;
    left: number;
    width: number;
  }>({
    ready: false,
    top: 0,
    left: 0,
    width: 0,
  });
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<ServiceAutocompleteItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(-1);

  const searchTerm = React.useMemo(() => {
    const trimmed = value.trim();
    if (selectionMode !== "append") return trimmed;
    const segments = trimmed.split(/[|,\n]/);
    return (segments[segments.length - 1] || "").trim();
  }, [selectionMode, value]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      const insideRoot = rootRef.current?.contains(target);
      const insidePortalMenu = portalMenuRef.current?.contains(target);
      if (!insideRoot && !insidePortalMenu) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  React.useEffect(() => {
    if (!open) setActiveIndex(-1);
  }, [open]);

  React.useEffect(() => {
    if (searchTerm.length < 2) {
      setItems([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError("");
        const params = new URLSearchParams({
          q: searchTerm,
          group,
          limit: "8",
        });
        if (eventType.trim()) {
          params.set("eventType", eventType.trim());
        }
        const response = await fetch(
          `/api/internal/reference/services/search?${params.toString()}`,
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
                (item: unknown): item is ServiceAutocompleteItem =>
                  Boolean(item) &&
                  typeof item === "object" &&
                  typeof (item as ServiceAutocompleteItem).id === "string" &&
                  typeof (item as ServiceAutocompleteItem).name === "string",
              )
            : [],
        );
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        setItems([]);
        setError(
          fetchError instanceof Error ? fetchError.message : uiStrings.searchError,
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [eventType, group, searchTerm, uiStrings.searchError]);

  function selectItem(item: ServiceAutocompleteItem) {
    if (selectionMode === "append") {
      const hasSeparator = /[|,\n]/.test(value);
      const baseTokens = hasSeparator ? splitMultiValueTokens(value) : [];
      const nextTokens = uniqueTokensCaseInsensitive([...baseTokens, item.name]);
      onValueChange(nextTokens.join(separator));
      onSelect?.(item);
      setOpen(false);
      setActiveIndex(-1);
      setError("");
      return;
    }

    onValueChange(item.name);
    onSelect?.(item);
    setOpen(false);
    setActiveIndex(-1);
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
      setActiveIndex((current) => (current <= 0 ? actionCount - 1 : current - 1));
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === "Enter" && open && activeIndex >= 0 && activeIndex < items.length) {
      event.preventDefault();
      selectItem(items[activeIndex]);
    }
  }

  const showResults = open && (loading || items.length > 0 || Boolean(error));
  const shouldRenderPortal = mounted && usePortalMenu && showResults;

  const updatePortalMenuPosition = React.useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(
      Math.max(rect.width, portalMinWidth),
      Math.max(320, viewportWidth - 32),
    );
    const left = Math.min(
      Math.max(16, rect.left),
      Math.max(16, viewportWidth - width - 16),
    );
    const measuredHeight = Math.min(portalMenuRef.current?.offsetHeight || 280, 360);
    const showAbove =
      rect.bottom + 8 + measuredHeight > viewportHeight - 16 &&
      rect.top - 8 - measuredHeight >= 16;
    const top = showAbove
      ? Math.max(16, rect.top - measuredHeight - 8)
      : Math.min(viewportHeight - measuredHeight - 16, rect.bottom + 8);
    setPortalMenuPosition({ ready: true, top, left, width });
  }, [portalMinWidth]);

  React.useEffect(() => {
    if (!shouldRenderPortal) {
      setPortalMenuPosition((prev) =>
        prev.ready ? { ...prev, ready: false } : prev,
      );
      return;
    }
    const rafId = window.requestAnimationFrame(() => {
      updatePortalMenuPosition();
    });
    const onWindowChange = () => updatePortalMenuPosition();
    window.addEventListener("resize", onWindowChange);
    window.addEventListener("scroll", onWindowChange, true);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onWindowChange);
      window.removeEventListener("scroll", onWindowChange, true);
    };
  }, [shouldRenderPortal, updatePortalMenuPosition, items.length, loading, error]);

  const menuContent = (
    <div className="max-h-[320px] overflow-y-auto rounded-lg border bg-popover shadow-lg">
      {items.map((item, index) => {
        const active = index === activeIndex;
        const selected = value.trim().toLowerCase() === item.name.trim().toLowerCase();
        return (
          <button
            key={item.id}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => selectItem(item)}
            className={cn(
              "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors",
              active ? "bg-muted" : "hover:bg-muted/70",
            )}
          >
            <span className="truncate">{item.name}</span>
            {selected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
          </button>
        );
      })}

      {!loading && items.length === 0 && !error ? (
        <div className="px-3 py-2 text-sm text-muted-foreground">{uiStrings.noResults}</div>
      ) : null}

      {error ? (
        <div className="border-t px-3 py-2 text-sm text-destructive">{error}</div>
      ) : null}
    </div>
  );

  const resultsMenu = showResults
    ? shouldRenderPortal
      ? createPortal(
          <div
            ref={portalMenuRef}
            className={cn(
              "fixed z-[170] transition-[opacity,transform] duration-100",
              portalMenuPosition.ready
                ? "opacity-100 scale-100 pointer-events-auto"
                : "opacity-0 scale-95 pointer-events-none",
            )}
            style={{
              top: portalMenuPosition.top,
              left: portalMenuPosition.left,
              width: portalMenuPosition.width,
              transformOrigin: "top left",
            }}
          >
            {menuContent}
          </div>,
          document.body,
        )
      : (
          <div className="absolute z-30 mt-1 w-full">{menuContent}</div>
        )
    : null;

  return (
    <div ref={rootRef} className={cn("relative", containerClassName)}>
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
          onSelect?.(null);
          setOpen(true);
          setError("");
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        onPaste={onPaste}
        onBlur={onBlur}
        placeholder={resolvedPlaceholder}
        className={cn(DEFAULT_INPUT_CLASS, inputClassName)}
        disabled={disabled}
        autoComplete="off"
      />
      {loading ? (
        <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : (
        <Search className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      )}
      {resultsMenu}
    </div>
  );
}

