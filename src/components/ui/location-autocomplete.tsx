"use client";

import * as React from "react";
import { MapPin, Loader2, X } from "lucide-react";

const inputClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

interface Suggestion {
    display_name: string;
    lat: string;
    lon: string;
}

interface LocationAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    name?: string;
}

export function LocationAutocomplete({ value, onChange, placeholder = "Cari lokasi...", name }: LocationAutocompleteProps) {
    const [query, setQuery] = React.useState(value);
    const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [showDropdown, setShowDropdown] = React.useState(false);
    const debounceRef = React.useRef<NodeJS.Timeout | null>(null);
    const wrapperRef = React.useRef<HTMLDivElement>(null);

    // Sync external value
    React.useEffect(() => {
        setQuery(value);
    }, [value]);

    // Close dropdown on outside click
    React.useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    function handleInput(val: string) {
        setQuery(val);
        onChange(val);

        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (val.length < 3) {
            setSuggestions([]);
            setShowDropdown(false);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&limit=5&countrycodes=id&accept-language=id`,
                    { headers: { "User-Agent": "ClientDesk/1.0" } }
                );
                const data: Suggestion[] = await res.json();
                setSuggestions(data);
                setShowDropdown(data.length > 0);
            } catch {
                setSuggestions([]);
            }
            setLoading(false);
        }, 400);
    }

    function selectSuggestion(s: Suggestion) {
        // Shorten the display name - take first 2-3 parts
        const parts = s.display_name.split(", ");
        const short = parts.slice(0, 3).join(", ");
        setQuery(short);
        onChange(short);
        setShowDropdown(false);
    }

    function openMaps() {
        if (query) {
            window.open(`https://maps.google.com/maps?q=${encodeURIComponent(query)}`, "_blank");
        }
    }

    function clearInput() {
        setQuery("");
        onChange("");
        setSuggestions([]);
        setShowDropdown(false);
    }

    return (
        <div ref={wrapperRef} className="relative">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <input
                        name={name}
                        value={query}
                        onChange={e => handleInput(e.target.value)}
                        onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
                        placeholder={placeholder}
                        className={inputClass + " pr-8"}
                        autoComplete="off"
                    />
                    {loading && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2" />
                    )}
                    {!loading && query && (
                        <button type="button" onClick={clearInput}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                <button type="button" onClick={openMaps} title="Buka di Google Maps"
                    className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors shrink-0">
                    <MapPin className="w-4 h-4" />
                </button>
            </div>

            {/* Dropdown */}
            {showDropdown && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
                    {suggestions.map((s, i) => {
                        const parts = s.display_name.split(", ");
                        const main = parts[0];
                        const sub = parts.slice(1, 4).join(", ");
                        return (
                            <button
                                key={i}
                                type="button"
                                onClick={() => selectSuggestion(s)}
                                className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-accent transition-colors border-b border-border/50 last:border-0"
                            >
                                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{main}</p>
                                    <p className="text-xs text-muted-foreground truncate">{sub}</p>
                                </div>
                            </button>
                        );
                    })}
                    <div className="px-3 py-1.5 text-[10px] text-muted-foreground/60 bg-muted/30">
                        Powered by OpenStreetMap
                    </div>
                </div>
            )}
        </div>
    );
}
