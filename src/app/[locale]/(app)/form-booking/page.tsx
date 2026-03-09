"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { ExternalLink, Copy, ClipboardCheck, Eye, Loader2, Globe, Percent, Link2, Palette, List, ToggleRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

const ALL_EVENT_TYPES = ["Umum", "Wedding", "Akad", "Resepsi", "Wisuda", "Maternity", "Newborn", "Family", "Komersil", "Lainnya"];

export default function FormBookingPage() {
    const supabase = createClient();
    const locale = useLocale();
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [vendorSlug, setVendorSlug] = React.useState("");
    const [studioName, setStudioName] = React.useState("");
    const [minDpPercent, setMinDpPercent] = React.useState(50);
    const [savedMsg, setSavedMsg] = React.useState("");
    const [copied, setCopied] = React.useState(false);
    const [profileId, setProfileId] = React.useState("");

    // Customization
    const [brandColor, setBrandColor] = React.useState("#000000");
    const [greeting, setGreeting] = React.useState("");
    const [selectedEventTypes, setSelectedEventTypes] = React.useState<string[]>(ALL_EVENT_TYPES);
    const [showLocation, setShowLocation] = React.useState(true);
    const [showNotes, setShowNotes] = React.useState(true);
    const [showProof, setShowProof] = React.useState(true);

    const [iframeKey, setIframeKey] = React.useState(0);

    const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
    const formUrl = vendorSlug ? `${siteUrl}/${locale}/${vendorSlug}/formbooking` : "";

    React.useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: p } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .single();

            if (p) {
                setProfileId(p.id);
                setStudioName(p.studio_name || "");
                setMinDpPercent(p.min_dp_percent ?? 50);
                setBrandColor(p.form_brand_color || "#000000");
                setGreeting(p.form_greeting || "");
                setSelectedEventTypes(p.form_event_types?.length > 0 ? p.form_event_types : ALL_EVENT_TYPES);
                setShowLocation(p.form_show_location ?? true);
                setShowNotes(p.form_show_notes ?? true);
                setShowProof(p.form_show_proof ?? true);

                if (p.vendor_slug) {
                    setVendorSlug(p.vendor_slug);
                }
            }
            setLoading(false);
        }
        load();
    }, []);

    async function handleSave() {
        if (!profileId) return;
        setSaving(true);

        const slug = vendorSlug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

        await supabase.from("profiles").update({
            vendor_slug: slug || null,
            min_dp_percent: minDpPercent,
            form_brand_color: brandColor,
            form_greeting: greeting || null,
            form_event_types: selectedEventTypes,
            form_show_location: showLocation,
            form_show_notes: showNotes,
            form_show_proof: showProof,
        }).eq("id", profileId);

        setVendorSlug(slug);
        setSavedMsg("Tersimpan!");
        setIframeKey(k => k + 1); // refresh preview
        setTimeout(() => setSavedMsg(""), 3000);
        setSaving(false);
    }

    function copyUrl() {
        navigator.clipboard.writeText(formUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    function toggleEventType(t: string) {
        setSelectedEventTypes(prev =>
            prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
        );
    }

    const inputClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Form Booking Publik</h2>
                <p className="text-muted-foreground">Kelola dan bagikan form booking online untuk klien Anda.</p>
            </div>

            {/* URL Card */}
            {vendorSlug ? (
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-green-100 dark:bg-green-500/10">
                            <Link2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm">Form Booking Aktif</h3>
                            <p className="text-xs text-muted-foreground">Bagikan link ini ke klien Anda.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3 border">
                        <code className="flex-1 text-xs text-primary break-all font-mono">{formUrl}</code>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={copyUrl} title="Salin URL">
                            {copied ? <ClipboardCheck className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => window.open(formUrl, "_blank")} title="Buka">
                            <ExternalLink className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 text-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                        <Globe className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold">Form Booking Belum Aktif</h3>
                    <p className="text-sm text-muted-foreground">Isi custom URL di bawah untuk mengaktifkan form booking online.</p>
                </div>
            )}

            {/* Main Content: Settings + Preview side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LEFT: Settings */}
                <div className="space-y-6">
                    {/* URL & DP Settings */}
                    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                        <div className="px-6 py-4 border-b">
                            <h3 className="font-semibold flex items-center gap-2"><Globe className="w-4 h-4" /> Pengaturan URL & Pembayaran</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Custom URL</label>
                                <input
                                    value={vendorSlug}
                                    onChange={e => setVendorSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                                    placeholder={studioName?.toLowerCase().replace(/[^a-z0-9]/g, "-") || "nama-vendor"}
                                    className={inputClass}
                                />
                                <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md font-mono break-all">
                                    {siteUrl}/{locale}/<span className="text-primary font-semibold">{vendorSlug || "nama-vendor"}</span>/formbooking
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-1.5">
                                    <Percent className="w-3.5 h-3.5" /> Minimum DP
                                </label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        min={0} max={100} step={5}
                                        value={minDpPercent}
                                        onChange={e => setMinDpPercent(Number(e.target.value))}
                                        className="flex-1 accent-primary h-2 cursor-pointer"
                                    />
                                    <span className="text-sm font-bold w-12 text-right tabular-nums">{minDpPercent}%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Customization */}
                    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                        <div className="px-6 py-4 border-b">
                            <h3 className="font-semibold flex items-center gap-2"><Palette className="w-4 h-4" /> Kustomisasi Tampilan</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Warna Brand</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={brandColor}
                                        onChange={e => setBrandColor(e.target.value)}
                                        className="w-10 h-10 rounded-lg border cursor-pointer p-0.5"
                                    />
                                    <input
                                        value={brandColor}
                                        onChange={e => setBrandColor(e.target.value)}
                                        placeholder="#000000"
                                        className={inputClass + " !w-32"}
                                    />
                                    <div className="w-24 h-9 rounded-md" style={{ backgroundColor: brandColor }}></div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Teks Sapaan</label>
                                <input
                                    value={greeting}
                                    onChange={e => setGreeting(e.target.value)}
                                    placeholder="Silakan isi formulir di bawah ini untuk booking."
                                    className={inputClass}
                                />
                                <p className="text-xs text-muted-foreground">Kosongkan untuk menggunakan teks default.</p>
                            </div>
                        </div>
                    </div>

                    {/* Event Types */}
                    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                        <div className="px-6 py-4 border-b">
                            <h3 className="font-semibold flex items-center gap-2"><List className="w-4 h-4" /> Tipe Acara</h3>
                            <p className="text-xs text-muted-foreground mt-1">Pilih tipe acara yang tersedia di form booking.</p>
                        </div>
                        <div className="p-6">
                            <div className="flex flex-wrap gap-2">
                                {ALL_EVENT_TYPES.map(t => {
                                    const isActive = selectedEventTypes.includes(t);
                                    return (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => toggleEventType(t)}
                                            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${isActive ? "bg-primary text-primary-foreground border-primary" : "border-input text-muted-foreground hover:bg-muted/50"}`}
                                        >
                                            {t}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Field Toggles */}
                    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                        <div className="px-6 py-4 border-b">
                            <h3 className="font-semibold flex items-center gap-2"><ToggleRight className="w-4 h-4" /> Field Opsional</h3>
                            <p className="text-xs text-muted-foreground mt-1">Aktifkan/nonaktifkan field di form publik.</p>
                        </div>
                        <div className="p-6 space-y-3">
                            {[
                                { label: "Lokasi Acara", value: showLocation, setter: setShowLocation },
                                { label: "Catatan", value: showNotes, setter: setShowNotes },
                                { label: "Upload Bukti Pembayaran", value: showProof, setter: setShowProof },
                            ].map(item => (
                                <label key={item.label} className="flex items-center justify-between cursor-pointer group">
                                    <span className="text-sm font-medium">{item.label}</span>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={item.value}
                                        onClick={() => item.setter(!item.value)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${item.value ? "bg-primary" : "bg-muted"}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${item.value ? "translate-x-6" : "translate-x-1"}`} />
                                    </button>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex items-center gap-3">
                        <Button onClick={handleSave} disabled={saving} className="gap-2">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            Simpan Pengaturan
                        </Button>
                        {savedMsg && <span className="text-sm text-green-600 dark:text-green-400">{savedMsg}</span>}
                    </div>
                </div>

                {/* RIGHT: Preview */}
                {vendorSlug && (
                    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 space-y-4 sticky top-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold flex items-center gap-2"><Eye className="w-4 h-4" /> Preview</h3>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIframeKey(k => k + 1)} title="Refresh">
                                    <RefreshCw className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(formUrl, "_blank")} title="Buka di tab baru">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        </div>
                        <div className="aspect-[9/16] max-h-[700px] rounded-lg overflow-hidden border bg-muted">
                            <iframe
                                key={iframeKey}
                                src={formUrl}
                                className="w-full h-full"
                                title="Form Preview"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
