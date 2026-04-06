"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, MapPin } from "lucide-react";
import { useLocale } from "next-intl";

import { cn } from "@/lib/utils";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

const DEFAULT_INPUT_CLASS =
  "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 pr-8 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type PredictionItem = {
  placeId: string;
  description: string;
  primaryText: string;
  secondaryText: string;
};

type LocationPortalSelectionMeta = {
  address: string;
  lat: number | null;
  lng: number | null;
  source: "autocomplete" | "manual" | "clear";
};

type LocationPortalAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  onLocationChange?: (meta: LocationPortalSelectionMeta) => void;
  placeholder?: string;
  disabled?: boolean;
  inputClassName?: string;
  containerClassName?: string;
  onPaste?: (event: React.ClipboardEvent<HTMLInputElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  portalMinWidth?: number;
};

let mapsLoaded = false;
let mapsLoading = false;
const mapsLoadCallbacks: Array<(loaded: boolean) => void> = [];

function loadGoogleMapsPlaces(language: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!GOOGLE_MAPS_API_KEY) {
      resolve(false);
      return;
    }

    if (window.google?.maps?.places) {
      mapsLoaded = true;
      resolve(true);
      return;
    }

    if (mapsLoaded && window.google?.maps?.places) {
      resolve(true);
      return;
    }

    mapsLoadCallbacks.push(resolve);
    if (mapsLoading) return;
    mapsLoading = true;

    const script = document.createElement("script");
    const normalizedLanguage = language.trim() || "id";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&language=${encodeURIComponent(normalizedLanguage)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      mapsLoaded = true;
      mapsLoading = false;
      mapsLoadCallbacks.forEach((callback) => callback(true));
      mapsLoadCallbacks.length = 0;
    };
    script.onerror = () => {
      mapsLoading = false;
      mapsLoadCallbacks.forEach((callback) => callback(false));
      mapsLoadCallbacks.length = 0;
    };
    document.head.appendChild(script);
  });
}

export function LocationPortalAutocomplete({
  value,
  onChange,
  onLocationChange,
  placeholder,
  disabled = false,
  inputClassName,
  containerClassName,
  onPaste,
  onBlur,
  portalMinWidth = 480,
}: LocationPortalAutocompleteProps) {
  const locale = useLocale();
  const mapsLanguage = locale === "en" ? "en" : "id";
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const portalMenuRef = React.useRef<HTMLDivElement>(null);
  const predictionServiceRef = React.useRef<google.maps.places.AutocompleteService | null>(
    null,
  );
  const placeDetailsServiceRef = React.useRef<google.maps.places.PlacesService | null>(
    null,
  );

  const [mounted, setMounted] = React.useState(false);
  const [mapsReady, setMapsReady] = React.useState(false);
  const [mapsChecked, setMapsChecked] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<PredictionItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(-1);
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

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const ensureMapsLoaded = React.useCallback(async () => {
    if (mapsChecked) return mapsReady;
    const loaded = await loadGoogleMapsPlaces(mapsLanguage);
    setMapsReady(loaded && Boolean(window.google?.maps?.places));
    setMapsChecked(true);
    return loaded;
  }, [mapsChecked, mapsLanguage, mapsReady]);

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
    if (!open) {
      setActiveIndex(-1);
    }
  }, [open]);

  React.useEffect(() => {
    const term = value.trim();
    if (term.length < 2 || !open) {
      setItems([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError("");
        const loaded = await ensureMapsLoaded();
        if (!loaded || !window.google?.maps?.places || controller.signal.aborted) {
          setItems([]);
          setLoading(false);
          return;
        }

        if (!predictionServiceRef.current) {
          predictionServiceRef.current = new google.maps.places.AutocompleteService();
        }

        predictionServiceRef.current.getPlacePredictions(
          {
            input: term,
            componentRestrictions: { country: "id" },
          },
          (predictions, status) => {
            if (controller.signal.aborted) return;
            if (
              status !== google.maps.places.PlacesServiceStatus.OK ||
              !Array.isArray(predictions)
            ) {
              setItems([]);
              setLoading(false);
              return;
            }
            const normalized = predictions.map((prediction) => ({
              placeId: prediction.place_id,
              description: prediction.description || "",
              primaryText:
                prediction.structured_formatting?.main_text ||
                prediction.description ||
                "",
              secondaryText:
                prediction.structured_formatting?.secondary_text || "",
            }));
            setItems(normalized);
            setLoading(false);
          },
        );
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        setItems([]);
        setLoading(false);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Gagal memuat suggestion lokasi.",
        );
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [value, open, ensureMapsLoaded]);

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

  const showResults = open && (loading || items.length > 0 || Boolean(error));

  React.useEffect(() => {
    if (!showResults || !mounted) {
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
  }, [showResults, mounted, updatePortalMenuPosition, items.length, loading, error]);

  const selectItem = React.useCallback(
    (item: PredictionItem) => {
      if (!window.google?.maps?.places) {
        onChange(item.description);
        onLocationChange?.({
          address: item.description,
          lat: null,
          lng: null,
          source: "autocomplete",
        });
        setOpen(false);
        return;
      }

      if (!placeDetailsServiceRef.current) {
        placeDetailsServiceRef.current = new google.maps.places.PlacesService(
          document.createElement("div"),
        );
      }

      placeDetailsServiceRef.current.getDetails(
        {
          placeId: item.placeId,
          fields: ["formatted_address", "geometry", "name"],
        },
        (place, status) => {
          const fallbackAddress = item.description || item.primaryText;
          if (
            status !== google.maps.places.PlacesServiceStatus.OK ||
            !place
          ) {
            onChange(fallbackAddress);
            onLocationChange?.({
              address: fallbackAddress,
              lat: null,
              lng: null,
              source: "autocomplete",
            });
            setOpen(false);
            return;
          }

          const formattedAddress = (place.formatted_address || "").trim();
          const placeName = (place.name || "").trim();
          const address =
            formattedAddress && placeName && !formattedAddress.startsWith(placeName)
              ? `${placeName}, ${formattedAddress}`
              : formattedAddress || placeName || fallbackAddress;
          const lat = place.geometry?.location?.lat() ?? null;
          const lng = place.geometry?.location?.lng() ?? null;
          onChange(address);
          onLocationChange?.({
            address,
            lat,
            lng,
            source: "autocomplete",
          });
          setOpen(false);
        },
      );
    },
    [onChange, onLocationChange],
  );

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

  const menuContent = (
    <div className="max-h-[320px] overflow-y-auto rounded-lg border bg-popover shadow-lg">
      {items.map((item, index) => {
        const active = index === activeIndex;
        const selected =
          value.trim().toLowerCase() === item.description.trim().toLowerCase();
        return (
          <button
            key={item.placeId}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => selectItem(item)}
            className={cn(
              "flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm transition-colors",
              active ? "bg-muted" : "hover:bg-muted/70",
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate">{item.primaryText}</p>
              {item.secondaryText ? (
                <p className="truncate text-xs text-muted-foreground">
                  {item.secondaryText}
                </p>
              ) : null}
            </div>
            {selected ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : null}
          </button>
        );
      })}

      {!loading && items.length === 0 && !error ? (
        <div className="px-3 py-2 text-sm text-muted-foreground">
          Lokasi tidak ditemukan.
        </div>
      ) : null}

      {error ? (
        <div className="border-t px-3 py-2 text-sm text-destructive">{error}</div>
      ) : null}
    </div>
  );

  const menuPortal = showResults && mounted
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
    : null;

  return (
    <div ref={rootRef} className={cn("relative", containerClassName)}>
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value;
          onChange(nextValue);
          if (!nextValue.trim()) {
            onLocationChange?.({
              address: "",
              lat: null,
              lng: null,
              source: "clear",
            });
          } else {
            onLocationChange?.({
              address: nextValue,
              lat: null,
              lng: null,
              source: "manual",
            });
          }
          setOpen(true);
          setError("");
        }}
        onFocus={() => {
          setOpen(true);
          void ensureMapsLoaded();
        }}
        onKeyDown={handleKeyDown}
        onPaste={onPaste}
        onBlur={onBlur}
        placeholder={placeholder || "Cari lokasi..."}
        className={cn(DEFAULT_INPUT_CLASS, inputClassName)}
        disabled={disabled}
        autoComplete="off"
      />
      {loading ? (
        <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : (
        <MapPin className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      )}
      {menuPortal}
    </div>
  );
}

export type { LocationPortalSelectionMeta };
