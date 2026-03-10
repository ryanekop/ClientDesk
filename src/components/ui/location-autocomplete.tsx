"use client";

import * as React from "react";
import { MapPin, Loader2, X } from "lucide-react";

const inputClass =
  "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// Load Google Maps script once globally
let googleMapsLoaded = false;
let googleMapsLoading = false;
const loadCallbacks: (() => void)[] = [];

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve) => {
    if (googleMapsLoaded && window.google?.maps) {
      resolve();
      return;
    }
    loadCallbacks.push(resolve);
    if (googleMapsLoading) return;
    googleMapsLoading = true;

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&language=id`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      googleMapsLoaded = true;
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
    };
    document.head.appendChild(script);
  });
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  name?: string;
}

export function LocationAutocomplete({
  value,
  onChange,
  placeholder = "Cari lokasi...",
  name,
}: LocationAutocompleteProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const autocompleteRef = React.useRef<google.maps.places.Autocomplete | null>(
    null,
  );
  const [showMap, setShowMap] = React.useState(false);
  const [mapCenter, setMapCenter] = React.useState<{
    lat: number;
    lng: number;
  }>({ lat: -6.2, lng: 106.8 });
  const [ready, setReady] = React.useState(false);
  const [loadTriggered, setLoadTriggered] = React.useState(false);

  // Inisialisasi autocomplete setelah Google Maps siap
  const initAutocomplete = React.useCallback(() => {
    if (inputRef.current && !autocompleteRef.current && window.google?.maps) {
      const ac = new google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: "id" },
        fields: ["formatted_address", "geometry", "name"],
      });
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (place?.formatted_address) {
          onChange(
            place.name
              ? `${place.name}, ${place.formatted_address}`
              : place.formatted_address,
          );
          if (place.geometry?.location) {
            setMapCenter({
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            });
          }
        }
      });
      autocompleteRef.current = ac;
    }
  }, [onChange]);

  // Lazy load — hanya muat Google Maps saat user fokus ke input, bukan saat mount
  const handleFocus = React.useCallback(() => {
    if (loadTriggered) return;
    setLoadTriggered(true);
    loadGoogleMaps().then(() => {
      setReady(true);
      initAutocomplete();
    });
  }, [loadTriggered, initAutocomplete]);

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
              onChange={(e) => onChange(e.target.value)}
              onFocus={handleFocus}
              placeholder={placeholder}
              className={inputClass + " pr-8"}
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
          <button
            type="button"
            onClick={openMapPicker}
            title="Pilih di Peta"
            className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors shrink-0"
          >
            <MapPin className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Map Picker Modal */}
      {showMap && (
        <MapPickerModal
          center={mapCenter}
          currentValue={value}
          onSelect={(address, lat, lng) => {
            onChange(address);
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
  onSelect,
  onClose,
}: {
  center: { lat: number; lng: number };
  currentValue: string;
  onSelect: (address: string, lat: number, lng: number) => void;
  onClose: () => void;
}) {
  const mapRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const googleMapRef = React.useRef<google.maps.Map | null>(null);
  const markerRef = React.useRef<google.maps.Marker | null>(null);
  const [selectedAddress, setSelectedAddress] = React.useState(currentValue);
  const [selectedLatLng, setSelectedLatLng] = React.useState(center);

  React.useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;

    const map = new google.maps.Map(mapRef.current, {
      center,
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    googleMapRef.current = map;

    const marker = new google.maps.Marker({
      position: center,
      map,
      draggable: true,
      animation: google.maps.Animation.DROP,
    });
    markerRef.current = marker;

    // Geocode when marker is dragged
    marker.addListener("dragend", () => {
      const pos = marker.getPosition();
      if (!pos) return;
      const lat = pos.lat();
      const lng = pos.lng();
      setSelectedLatLng({ lat, lng });

      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results?.[0]) {
          setSelectedAddress(results[0].formatted_address);
        }
      });
    });

    // Click on map moves marker
    map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      marker.setPosition(e.latLng);
      setSelectedLatLng({ lat, lng });

      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results?.[0]) {
          setSelectedAddress(results[0].formatted_address);
        }
      });
    });

    // Search autocomplete in map
    if (searchRef.current) {
      const searchAC = new google.maps.places.Autocomplete(searchRef.current, {
        componentRestrictions: { country: "id" },
        fields: ["formatted_address", "geometry", "name"],
      });
      searchAC.bindTo("bounds", map);
      searchAC.addListener("place_changed", () => {
        const place = searchAC.getPlace();
        if (place?.geometry?.location) {
          const loc = place.geometry.location;
          map.setCenter(loc);
          map.setZoom(16);
          marker.setPosition(loc);
          setSelectedLatLng({ lat: loc.lat(), lng: loc.lng() });
          setSelectedAddress(
            place.name
              ? `${place.name}, ${place.formatted_address}`
              : place.formatted_address || "",
          );
        }
      });
    }
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card rounded-xl shadow-2xl w-[90vw] max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Pilih Lokasi di Peta</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Search */}
        <div className="px-4 py-2 border-b">
          <input
            ref={searchRef}
            type="text"
            placeholder="Cari tempat di peta..."
            className={inputClass}
            autoComplete="off"
          />
        </div>
        {/* Map */}
        <div ref={mapRef} className="w-full h-[50vh] min-h-[300px]" />
        {/* Footer */}
        <div className="px-4 py-3 border-t flex items-center justify-between gap-3 bg-muted/30">
          <p className="text-xs text-muted-foreground truncate flex-1">
            {selectedAddress || "Klik atau drag pin untuk memilih lokasi"}
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center h-8 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedAddress)
                  onSelect(
                    selectedAddress,
                    selectedLatLng.lat,
                    selectedLatLng.lng,
                  );
              }}
              className="inline-flex items-center justify-center h-8 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors gap-1.5"
            >
              <MapPin className="w-3.5 h-3.5" /> Pilih Lokasi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
