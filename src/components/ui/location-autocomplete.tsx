"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Loader2, MapPin, X } from "lucide-react";
import { LocationPointerIcon } from "@/components/icons/location-pointer-icon";

const inputClass =
  "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const DEFAULT_MAP_CENTER = { lat: -6.2, lng: 106.8 };
const LOCATION_BIAS_RADIUS_METERS = 15_000;

type LocationSelectionSource =
  | "autocomplete"
  | "map"
  | "gps"
  | "manual"
  | "clear";

export type LocationSelectionMeta = {
  address: string;
  lat: number | null;
  lng: number | null;
  source: LocationSelectionSource;
};

// Load Google Maps script once globally
let googleMapsLoaded = false;
let googleMapsLoading = false;
const loadCallbacks: (() => void)[] = [];

function loadGoogleMaps(language: string): Promise<void> {
  return new Promise((resolve) => {
    if (!GOOGLE_MAPS_API_KEY) {
      resolve();
      return;
    }

    if (googleMapsLoaded && window.google?.maps) {
      resolve();
      return;
    }
    loadCallbacks.push(resolve);
    if (googleMapsLoading) return;
    googleMapsLoading = true;

    const script = document.createElement("script");
    const normalizedLanguage = language.trim() || "id";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&language=${encodeURIComponent(normalizedLanguage)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      googleMapsLoaded = true;
      googleMapsLoading = false;
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
    };
    script.onerror = () => {
      googleMapsLoading = false;
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
    };
    document.head.appendChild(script);
  });
}

function resolveCoordinates(
  lat: number | null | undefined,
  lng: number | null | undefined,
): { lat: number; lng: number } | null {
  if (
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    typeof lng === "number" &&
    Number.isFinite(lng)
  ) {
    return { lat, lng };
  }

  return null;
}

function fallbackAddressFromCoords(lat: number, lng: number) {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onLocationChange?: (meta: LocationSelectionMeta) => void;
  placeholder?: string;
  name?: string;
  initialLat?: number | null;
  initialLng?: number | null;
  mapsLanguage?: string;
  showMapButton?: boolean;
  inputClassName?: string;
  onPaste?: (event: React.ClipboardEvent<HTMLInputElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  strings?: {
    mapButtonTitle?: string;
  };
}

export function LocationAutocomplete({
  value,
  onChange,
  onLocationChange,
  placeholder,
  name,
  initialLat,
  initialLng,
  mapsLanguage,
  showMapButton = true,
  inputClassName,
  onPaste,
  onBlur,
  strings,
}: LocationAutocompleteProps) {
  const locale = useLocale();
  const t = useTranslations("LocationAutocomplete");
  const resolvedPlaceholder = placeholder || t("searchPlaceholder");
  const uiStrings = React.useMemo(
    () => ({
      mapButtonTitle: t("mapButtonTitle"),
      ...strings,
    }),
    [strings, t],
  );
  const normalizedMapsLanguage = mapsLanguage?.trim() || (locale === "en" ? "en" : "id");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const autocompleteRef = React.useRef<google.maps.places.Autocomplete | null>(
    null,
  );
  const [showMap, setShowMap] = React.useState(false);
  const [mapCenter, setMapCenter] = React.useState<{
    lat: number;
    lng: number;
  }>(() => resolveCoordinates(initialLat, initialLng) ?? DEFAULT_MAP_CENTER);
  const [hasAutocompleteBias, setHasAutocompleteBias] = React.useState(
    () => Boolean(resolveCoordinates(initialLat, initialLng)),
  );
  const [ready, setReady] = React.useState(false);
  const [loadTriggered, setLoadTriggered] = React.useState(false);

  React.useEffect(() => {
    const coords = resolveCoordinates(initialLat, initialLng);
    if (!coords) return;
    setMapCenter(coords);
    setHasAutocompleteBias(true);
  }, [initialLat, initialLng]);

  const applyAutocompleteBias = React.useCallback(
    (ac: google.maps.places.Autocomplete) => {
      if (!window.google?.maps) return;
      if (!hasAutocompleteBias) return;
      const biasCenter = resolveCoordinates(mapCenter.lat, mapCenter.lng);
      if (!biasCenter) return;

      const biasCircle = new google.maps.Circle({
        center: biasCenter,
        radius: LOCATION_BIAS_RADIUS_METERS,
      });
      const bounds = biasCircle.getBounds();
      if (bounds) {
        ac.setBounds(bounds);
      }
      ac.setOptions({ strictBounds: false });
    },
    [hasAutocompleteBias, mapCenter],
  );

  // Inisialisasi autocomplete setelah Google Maps siap
  const initAutocomplete = React.useCallback(() => {
    if (inputRef.current && !autocompleteRef.current && window.google?.maps) {
      const ac = new google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: "id" },
        fields: ["formatted_address", "geometry", "name"],
        strictBounds: false,
      });
      applyAutocompleteBias(ac);
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        const nextAddress = place?.formatted_address
          ? place.name
            ? `${place.name}, ${place.formatted_address}`
            : place.formatted_address
          : "";

        if (!nextAddress) return;

        onChange(nextAddress);

        if (place.geometry?.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          setMapCenter({ lat, lng });
          setHasAutocompleteBias(true);
          onLocationChange?.({
            address: nextAddress,
            lat,
            lng,
            source: "autocomplete",
          });
          return;
        }

        onLocationChange?.({
          address: nextAddress,
          lat: null,
          lng: null,
          source: "autocomplete",
        });
      });
      autocompleteRef.current = ac;
    }
  }, [applyAutocompleteBias, onChange, onLocationChange]);

  React.useEffect(() => {
    if (autocompleteRef.current) {
      applyAutocompleteBias(autocompleteRef.current);
    }
  }, [applyAutocompleteBias]);

  // Lazy load — hanya muat Google Maps saat user fokus ke input, bukan saat mount
  const handleFocus = React.useCallback(() => {
    if (loadTriggered) return;
    setLoadTriggered(true);
    loadGoogleMaps(normalizedMapsLanguage).then(() => {
      setReady(true);
      initAutocomplete();
    });
  }, [loadTriggered, initAutocomplete, normalizedMapsLanguage]);

  // Jika script sudah ter-load sebelumnya (oleh instance lain), langsung pakai
  React.useEffect(() => {
    if (googleMapsLoaded && window.google?.maps) {
      setReady(true);
      setLoadTriggered(true);
      initAutocomplete();
    }
  }, [initAutocomplete]);

  // Keep input value in sync
  React.useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value;
    }
  }, [value]);

  function clearInput() {
    onChange("");
    setHasAutocompleteBias(false);
    onLocationChange?.({
      address: "",
      lat: null,
      lng: null,
      source: "clear",
    });
    if (inputRef.current) inputRef.current.value = "";
  }

  function openMapPicker() {
    setShowMap(true);
  }

  return (
    <>
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              name={name}
              defaultValue={value}
              onChange={(e) => {
                const nextValue = e.target.value;
                onChange(nextValue);
                if (!nextValue.trim()) {
                  setHasAutocompleteBias(false);
                }
                onLocationChange?.({
                  address: nextValue,
                  lat: null,
                  lng: null,
                  source: "manual",
                });
              }}
              onFocus={handleFocus}
              onPaste={onPaste}
              onBlur={onBlur}
              placeholder={resolvedPlaceholder}
              className={`${inputClass} pr-8 ${inputClassName || ""}`}
              autoComplete="off"
            />
            {loadTriggered && !ready && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2" />
            )}
            {ready && value && (
              <button
                type="button"
                onClick={clearInput}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {showMapButton ? (
            <button
              type="button"
              onClick={openMapPicker}
              title={uiStrings.mapButtonTitle}
              className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors shrink-0"
            >
              <MapPin className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Map Picker Modal */}
      {showMap && (
        <MapPickerModal
          center={mapCenter}
          currentValue={value}
          mapsLanguage={normalizedMapsLanguage}
          onSelect={(address, lat, lng, source) => {
            onChange(address);
            setHasAutocompleteBias(true);
            onLocationChange?.({
              address,
              lat,
              lng,
              source,
            });
            if (inputRef.current) inputRef.current.value = address;
            setMapCenter({ lat, lng });
            setShowMap(false);
          }}
          onClose={() => setShowMap(false)}
        />
      )}
    </>
  );
}

// ---- Map Picker Modal ----
function MapPickerModal({
  center,
  currentValue,
  mapsLanguage,
  onSelect,
  onClose,
}: {
  center: { lat: number; lng: number };
  currentValue: string;
  mapsLanguage: string;
  onSelect: (
    address: string,
    lat: number,
    lng: number,
    source: "map" | "gps",
  ) => void;
  onClose: () => void;
}) {
  const t = useTranslations("LocationAutocomplete");
  const mapRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const googleMapRef = React.useRef<google.maps.Map | null>(null);
  const markerRef = React.useRef<google.maps.Marker | null>(null);
  const [selectedAddress, setSelectedAddress] = React.useState(currentValue);
  const [selectedLatLng, setSelectedLatLng] = React.useState(center);
  const [selectedSource, setSelectedSource] = React.useState<"map" | "gps">(
    "map",
  );
  const [gpsLoading, setGpsLoading] = React.useState(false);
  const [gpsWarning, setGpsWarning] = React.useState<string | null>(null);
  const mapStrings = React.useMemo(
    () => ({
      modalTitle: t("modalTitle"),
      mapSearchPlaceholder: t("mapSearchPlaceholder"),
      useMyLocationTitle: t("useMyLocationTitle"),
      useMyLocationLabel: t("useMyLocationLabel"),
      gpsUnsupported: t("gpsUnsupported"),
      gpsAddressUnavailable: t("gpsAddressUnavailable"),
      gpsPermissionDenied: t("gpsPermissionDenied"),
      gpsUnavailable: t("gpsUnavailable"),
      gpsTimeout: t("gpsTimeout"),
      gpsGeneralError: t("gpsGeneralError"),
      selectedAddressFallback: t("selectedAddressFallback"),
      cancelLabel: t("cancelLabel"),
      confirmLabel: t("confirmLabel"),
    }),
    [t],
  );
  const useMyLocationLabel =
    (mapStrings.useMyLocationLabel || "").trim() || "Lokasi Saya";
  const useMyLocationTitle =
    (mapStrings.useMyLocationTitle || "").trim() || useMyLocationLabel;

  React.useEffect(() => {
    if (!gpsWarning) return;
    const timeoutId = window.setTimeout(() => setGpsWarning(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [gpsWarning]);

  React.useEffect(() => {
    function initMap() {
      if (!mapRef.current || !window.google?.maps) return;

      const geocoder = new google.maps.Geocoder();

      const map = new google.maps.Map(mapRef.current, {
        center,
        zoom: 15,
        mapTypeControl: true,
        mapTypeControlOptions: {
          position: google.maps.ControlPosition.LEFT_TOP,
          style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          mapTypeIds: [
            google.maps.MapTypeId.ROADMAP,
            google.maps.MapTypeId.SATELLITE,
          ],
        },
        streetViewControl: false,
        fullscreenControl: true,
      });
      googleMapRef.current = map;

      const marker = new google.maps.Marker({
        position: center,
        map,
        draggable: true,
        animation: google.maps.Animation.DROP,
      });
      markerRef.current = marker;

      const applyAddressByCoords = (lat: number, lng: number) => {
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === "OK" && results?.[0]) {
            setSelectedAddress(results[0].formatted_address);
          } else {
            setSelectedAddress(fallbackAddressFromCoords(lat, lng));
          }
        });
      };

      const moveMarker = (lat: number, lng: number) => {
        const latLng = new google.maps.LatLng(lat, lng);
        marker.setPosition(latLng);
        map.setCenter(latLng);
        setSelectedLatLng({ lat, lng });
      };

      // Geocode when marker is dragged
      marker.addListener("dragend", () => {
        const pos = marker.getPosition();
        if (!pos) return;
        const lat = pos.lat();
        const lng = pos.lng();
        setSelectedSource("map");
        setSelectedLatLng({ lat, lng });
        applyAddressByCoords(lat, lng);
      });

      // Click on map moves marker
      map.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        setSelectedSource("map");
        moveMarker(lat, lng);
        applyAddressByCoords(lat, lng);
      });

      // Search autocomplete in map
      if (searchRef.current) {
        const searchAC = new google.maps.places.Autocomplete(searchRef.current, {
          componentRestrictions: { country: "id" },
          fields: ["formatted_address", "geometry", "name"],
          strictBounds: false,
        });
        searchAC.bindTo("bounds", map);
        searchAC.addListener("place_changed", () => {
          const place = searchAC.getPlace();
          if (place?.geometry?.location) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            setSelectedSource("map");
            moveMarker(lat, lng);
            map.setZoom(16);
            setSelectedAddress(
              place.name
                ? `${place.name}, ${place.formatted_address}`
                : place.formatted_address || fallbackAddressFromCoords(lat, lng),
            );
          }
        });
      }
    }

    // If Google Maps already loaded, init immediately; otherwise load first
    if (googleMapsLoaded && window.google?.maps) {
      initMap();
    } else {
      loadGoogleMaps(mapsLanguage).then(() => {
        initMap();
      });
    }
  }, [center, currentValue, mapsLanguage]);

  function handleUseCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsWarning(mapStrings.gpsUnsupported);
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const map = googleMapRef.current;
        const marker = markerRef.current;

        if (map) {
          const latLng = new google.maps.LatLng(lat, lng);
          map.setCenter(latLng);
          map.setZoom(Math.max(map.getZoom() || 15, 16));
        }

        if (marker) {
          marker.setPosition({ lat, lng });
        }

        setSelectedSource("gps");
        setSelectedLatLng({ lat, lng });

        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          setGpsLoading(false);
          if (status === "OK" && results?.[0]) {
            setSelectedAddress(results[0].formatted_address);
            return;
          }

          setSelectedAddress(fallbackAddressFromCoords(lat, lng));
          setGpsWarning(mapStrings.gpsAddressUnavailable);
        });
      },
      (error) => {
        setGpsLoading(false);

        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsWarning(mapStrings.gpsPermissionDenied);
            break;
          case error.POSITION_UNAVAILABLE:
            setGpsWarning(mapStrings.gpsUnavailable);
            break;
          case error.TIMEOUT:
            setGpsWarning(mapStrings.gpsTimeout);
            break;
          default:
            setGpsWarning(mapStrings.gpsGeneralError);
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000,
      },
    );
  }

  return (
    <div
      className="map-picker-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="map-picker-panel bg-card rounded-xl shadow-2xl w-[90vw] max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">{mapStrings.modalTitle}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Search */}
        <div className="px-4 py-2 border-b space-y-2">
          <div className="flex items-center gap-2">
            <input
              ref={searchRef}
              type="text"
              placeholder={mapStrings.mapSearchPlaceholder}
              className={inputClass + " flex-1"}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={gpsLoading}
              className="map-picker-gps-button inline-flex h-9 min-w-[116px] shrink-0 items-center justify-center rounded-md border border-rose-200 bg-rose-50 px-3 text-rose-700 hover:border-rose-300 hover:bg-rose-100 transition-colors disabled:opacity-60 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200 dark:hover:bg-rose-900/30"
              title={useMyLocationTitle}
            >
              <span className="map-picker-gps-button-content inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium leading-none text-current">
                {gpsLoading ? (
                  <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
                ) : (
                  <LocationPointerIcon className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="text-current">{useMyLocationLabel}</span>
              </span>
            </button>
          </div>
          {gpsWarning && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 w-3.5 h-3.5 shrink-0" />
              <span className="flex-1">{gpsWarning}</span>
              <button
                type="button"
                onClick={() => setGpsWarning(null)}
                className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        {/* Map */}
        <div ref={mapRef} className="w-full h-[50vh] min-h-[300px]" />
        {/* Footer */}
        <div className="px-4 py-3 border-t flex items-center justify-between gap-3 bg-muted/30">
          <p className="text-xs text-muted-foreground truncate flex-1">
            {selectedAddress || mapStrings.selectedAddressFallback}
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center h-8 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent transition-colors"
            >
              {mapStrings.cancelLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                const finalAddress =
                  selectedAddress ||
                  fallbackAddressFromCoords(selectedLatLng.lat, selectedLatLng.lng);
                onSelect(
                  finalAddress,
                  selectedLatLng.lat,
                  selectedLatLng.lng,
                  selectedSource,
                );
              }}
              className="inline-flex items-center justify-center h-8 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors gap-1.5"
            >
              <MapPin className="w-3.5 h-3.5" /> {mapStrings.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
