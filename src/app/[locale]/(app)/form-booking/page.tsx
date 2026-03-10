"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { ExternalLink, Copy, ClipboardCheck, Loader2, Percent, Palette, List, ToggleRight, RotateCcw, CreditCard, Plus, Trash2, RefreshCw, Settings2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

const ALL_EVENT_TYPES = ["Umum", "Wedding", "Akad", "Resepsi", "Wisuda", "Maternity", "Newborn", "Family", "Komersil", "Lainnya"];

type BankAccount = { bank_name: string; account_number: string; account_name: string };

const EMPTY_BANK: BankAccount = { bank_name: "", account_number: "", account_name: "" };

const DEFAULTS = {
    brandColor: "#000000",
    greeting: "",
    eventTypes: ALL_EVENT_TYPES,
    showNotes: true,
    showProof: true,
    minDpPercent: 50,
    minDpMap: {} as Record<string, number>,
    bankAccounts: [] as BankAccount[],
};

export default function FormBookingPage() {
    const supabase = createClient();
    const locale = useLocale();
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [vendorSlug, setVendorSlug] = React.useState("");
    const [studioName, setStudioName] = React.useState("");
    const [minDpPercent, setMinDpPercent] = React.useState(DEFAULTS.minDpPercent);
    const [minDpMap, setMinDpMap] = React.useState<Record<string, number>>(DEFAULTS.minDpMap);
    const [selectedDpEventType, setSelectedDpEventType] = React.useState("Umum");
    const [savedMsg, setSavedMsg] = React.useState("");
    const [copied, setCopied] = React.useState(false);
    const [profileId, setProfileId] = React.useState("");
    const [showResetConfirm, setShowResetConfirm] = React.useState(false);

    // Customization
    const [brandColor, setBrandColor] = React.useState(DEFAULTS.brandColor);
    const [greeting, setGreeting] = React.useState(DEFAULTS.greeting);
    const [selectedEventTypes, setSelectedEventTypes] = React.useState<string[]>(DEFAULTS.eventTypes);
    const [showNotes, setShowNotes] = React.useState(DEFAULTS.showNotes);
    const [showProof, setShowProof] = React.useState(DEFAULTS.showProof);

    // Bank accounts (max 5)
    const [bankAccounts, setBankAccounts] = React.useState<BankAccount[]>([]);

    const [iframeKey, setIframeKey] = React.useState(0);
    const [mobileTab, setMobileTab] = React.useState<"settings" | "preview">("settings");

    const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
    const formUrl = vendorSlug ? `${siteUrl}/${locale}/formbooking/${vendorSlug}` : "";

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
                setMinDpPercent(p.min_dp_percent ?? DEFAULTS.minDpPercent);
                // Load per-event-type DP map
                const savedMap = (typeof p.min_dp_map === "object" && p.min_dp_map !== null) ? p.min_dp_map as Record<string, number> : {};
                setMinDpMap(savedMap);
                setBrandColor(p.form_brand_color || DEFAULTS.brandColor);
                setGreeting(p.form_greeting || DEFAULTS.greeting);
                setSelectedEventTypes(p.form_event_types?.length > 0 ? p.form_event_types : DEFAULTS.eventTypes);
                setShowNotes(p.form_show_notes ?? DEFAULTS.showNotes);
                setShowProof(p.form_show_proof ?? DEFAULTS.showProof);
                setBankAccounts(Array.isArray(p.bank_accounts) && p.bank_accounts.length > 0 ? p.bank_accounts : []);

                if (p.vendor_slug) {
                    setVendorSlug(p.vendor_slug);
                }
            }
            setLoading(false);
        }
        load();
    }, []);

    // Get DP% for currently selected event type
    function getDpForEventType(eventType: string): number {
        return minDpMap[eventType] ?? minDpPercent;
    }

    function setDpForEventType(eventType: string, value: number) {
        setMinDpMap(prev => ({ ...prev, [eventType]: value }));
    }

    async function handleSave() {
        if (!profileId) return;
        setSaving(true);

        let slug = vendorSlug;
        if (!slug && studioName) {
            slug = studioName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
            setVendorSlug(slug);
        }

        // Filter out empty bank accounts
        const validBanks = bankAccounts.filter(b => b.bank_name && b.account_number);

        await supabase.from("profiles").update({
            vendor_slug: slug || null,
            min_dp_percent: minDpPercent,
            min_dp_map: minDpMap,
            form_brand_color: brandColor,
            form_greeting: greeting || null,
            form_event_types: selectedEventTypes,
            form_show_notes: showNotes,
            form_show_proof: showProof,
            bank_accounts: validBanks,
        }).eq("id", profileId);

        setBankAccounts(validBanks);
        setSavedMsg("Tersimpan!");
        setIframeKey(k => k + 1);
        setTimeout(() => setSavedMsg(""), 3000);
        setSaving(false);
    }

    function handleResetDefault() {
        setBrandColor(DEFAULTS.brandColor);
        setGreeting(DEFAULTS.greeting);
        setSelectedEventTypes([...DEFAULTS.eventTypes]);
        setShowNotes(DEFAULTS.showNotes);
        setShowProof(DEFAULTS.showProof);
        setMinDpPercent(DEFAULTS.minDpPercent);
        setMinDpMap({});
        setBankAccounts([]);
        setShowResetConfirm(false);
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

    function updateBank(index: number, field: keyof BankAccount, value: string) {
        setBankAccounts(prev => prev.map((b, i) => i === index ? { ...b, [field]: value } : b));
    }

    function addBank() {
        if (bankAccounts.length < 5) setBankAccounts(prev => [...prev, { ...EMPTY_BANK }]);
    }

    function removeBank(index: number) {
        setBankAccounts(prev => prev.filter((_, i) => i !== index));
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

            {/* Main Content: Settings + Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start pb-20 lg:pb-0">
                {/* LEFT: Settings — hidden on mobile when viewing preview */}
                <div className={`space-y-6 ${mobileTab === "preview" ? "hidden lg:block" : ""}`}>
                    {/* Payment Settings */}
                    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                        <div className="px-6 py-4 border-b">
                            <h3 className="font-semibold flex items-center gap-2"><Percent className="w-4 h-4" /> Pengaturan Pembayaran</h3>
                            <p className="text-xs text-muted-foreground mt-1">Atur minimum DP berbeda untuk setiap jenis acara.</p>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Event type selector */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Jenis Acara</label>
                                <select
                                    value={selectedDpEventType}
                                    onChange={e => setSelectedDpEventType(e.target.value)}
                                    className={inputClass + " cursor-pointer"}
                                >
                                    {selectedEventTypes.map(et => (
                                        <option key={et} value={et}>{et}</option>
                                    ))}
                                </select>
                            </div>

                            {/* DP Slider for selected event type */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Minimum DP — <span className="text-primary">{selectedDpEventType}</span></label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        min={0} max={100} step={5}
                                        value={getDpForEventType(selectedDpEventType)}
                                        onChange={e => setDpForEventType(selectedDpEventType, Number(e.target.value))}
                                        className="flex-1 accent-primary h-2 cursor-pointer"
                                    />
                                    <span className="text-sm font-bold w-12 text-right tabular-nums">{getDpForEventType(selectedDpEventType)}%</span>
                                </div>
                            </div>

                            {/* Summary of all DP values */}
                            {Object.keys(minDpMap).length > 0 && (
                                <div className="pt-3 border-t space-y-1">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ringkasan DP</p>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedEventTypes.map(et => {
                                            const dp = minDpMap[et] ?? minDpPercent;
                                            return (
                                                <span key={et} className="text-[11px] px-2 py-1 rounded-md border bg-muted/50 text-muted-foreground">
                                                    {et}: <strong>{dp}%</strong>
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bank Accounts */}
                    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                        <div className="px-6 py-4 border-b">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4" /> Rekening Pembayaran</h3>
                                    <p className="text-xs text-muted-foreground mt-1">Maksimal 5 rekening. Akan ditampilkan di form booking publik.</p>
                                </div>
                                {bankAccounts.length < 5 && (
                                    <Button variant="outline" size="sm" onClick={addBank} className="gap-1.5 shrink-0">
                                        <Plus className="w-3.5 h-3.5" /> Tambah
                                    </Button>
                                )}
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            {bankAccounts.length === 0 ? (
                                <div className="text-center py-6">
                                    <CreditCard className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground">Belum ada rekening.</p>
                                    <Button variant="outline" size="sm" onClick={addBank} className="gap-1.5 mt-3">
                                        <Plus className="w-3.5 h-3.5" /> Tambah Rekening
                                    </Button>
                                </div>
                            ) : (
                                bankAccounts.map((bank, i) => (
                                    <div key={i} className="rounded-lg border p-4 space-y-3 relative">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-muted-foreground">Rekening #{i + 1}</span>
                                            <button type="button" onClick={() => removeBank(i)} className="text-red-500 hover:text-red-600 transition-colors cursor-pointer">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-muted-foreground">Bank / E-Wallet</label>
                                                <input value={bank.bank_name} onChange={e => updateBank(i, "bank_name", e.target.value)} placeholder="BCA / DANA" className={inputClass} />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-muted-foreground">Nomor Rekening</label>
                                                <input value={bank.account_number} onChange={e => updateBank(i, "account_number", e.target.value)} placeholder="1234567890" className={inputClass} />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-muted-foreground">Atas Nama</label>
                                                <input value={bank.account_name} onChange={e => updateBank(i, "account_name", e.target.value)} placeholder="Nama" className={inputClass} />
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
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
                                    <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)} className="w-10 h-10 rounded-lg border cursor-pointer p-0.5" />
                                    <input value={brandColor} onChange={e => setBrandColor(e.target.value)} placeholder="#000000" className={inputClass + " !w-32"} />
                                    <div className="w-24 h-9 rounded-md" style={{ backgroundColor: brandColor }}></div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Teks Sapaan</label>
                                <input value={greeting} onChange={e => setGreeting(e.target.value)} placeholder="Silakan isi formulir di bawah ini untuk booking." className={inputClass} />
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
                                        <button key={t} type="button" onClick={() => toggleEventType(t)}
                                            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${isActive ? "bg-primary text-primary-foreground border-primary" : "border-input text-muted-foreground hover:bg-muted/50"}`}
                                        >{t}</button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Field Toggles */}
                    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                        <div className="px-6 py-4 border-b">
                            <h3 className="font-semibold flex items-center gap-2"><ToggleRight className="w-4 h-4" /> Field Opsional</h3>
                        </div>
                        <div className="p-6 space-y-3">
                            {[
                                { label: "Catatan", value: showNotes, setter: setShowNotes },
                                { label: "Upload Bukti Pembayaran", value: showProof, setter: setShowProof },
                            ].map(item => (
                                <label key={item.label} className="flex items-center justify-between cursor-pointer">
                                    <span className="text-sm font-medium">{item.label}</span>
                                    <button type="button" role="switch" aria-checked={item.value} onClick={() => item.setter(!item.value)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${item.value ? "bg-primary" : "bg-muted"}`}>
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${item.value ? "translate-x-6" : "translate-x-1"}`} />
                                    </button>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Save + Reset */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <Button onClick={handleSave} disabled={saving} className="gap-2">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            Simpan Pengaturan
                        </Button>
                        <Button variant="outline" onClick={() => setShowResetConfirm(true)} className="gap-2 text-muted-foreground">
                            <RotateCcw className="w-4 h-4" /> Reset Default
                        </Button>
                        {savedMsg && <span className="text-sm text-green-600 dark:text-green-400">{savedMsg}</span>}
                    </div>

                    {showResetConfirm && (
                        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowResetConfirm(false)}>
                            <div className="bg-card rounded-xl border shadow-lg p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
                                <h3 className="font-semibold text-lg">Reset ke Default?</h3>
                                <p className="text-sm text-muted-foreground">Semua pengaturan form akan dikembalikan ke nilai default. Perubahan belum tersimpan sampai Anda klik &quot;Simpan Pengaturan&quot;.</p>
                                <div className="flex gap-3 justify-end">
                                    <Button variant="outline" onClick={() => setShowResetConfirm(false)}>Batal</Button>
                                    <Button variant="destructive" onClick={handleResetDefault} className="gap-1.5">
                                        <RotateCcw className="w-4 h-4" /> Reset
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT: Linktree-Style Preview — hidden on mobile when viewing settings */}
                <div className={`sticky top-4 space-y-3 ${mobileTab === "settings" ? "hidden lg:block" : ""}`}>
                    {/* Preview Header with Buttons */}
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-muted-foreground">Preview</h3>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIframeKey(k => k + 1)} title="Refresh">
                                <RefreshCw className="w-3.5 h-3.5" />
                            </Button>
                            {vendorSlug && (
                                <>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyUrl} title="Salin URL">
                                        {copied ? <ClipboardCheck className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(formUrl, "_blank")} title="Buka di tab baru">
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    {vendorSlug ? (
                        <div className="flex justify-center">
                            {/* Linktree-style phone preview */}
                            <div className="w-full max-w-[380px]">
                                {/* URL Bar */}
                                <div className="bg-muted/80 dark:bg-muted/40 rounded-t-2xl px-4 py-2.5 flex items-center gap-2 border border-b-0">
                                    <div className="flex gap-1">
                                        <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                                        <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
                                    </div>
                                    <div className="flex-1 text-center">
                                        <span className="text-[11px] text-muted-foreground truncate block">{formUrl.replace(/^https?:\/\//, "")}</span>
                                    </div>
                                </div>

                                {/* iframe content — fits viewport height */}
                                <div className="rounded-b-2xl overflow-hidden border border-t-0 bg-white dark:bg-background" style={{ height: "calc(100vh - 180px)" }}>
                                    <iframe key={iframeKey} src={formUrl} className="w-full h-full" title="Form Preview" />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-64 rounded-2xl border bg-muted/20">
                            <p className="text-sm text-muted-foreground text-center px-6">Simpan pengaturan terlebih dahulu untuk melihat preview.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Bottom Tab Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t z-40 lg:hidden">
                <div className="flex">
                    <button
                        onClick={() => setMobileTab("settings")}
                        className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors cursor-pointer ${mobileTab === "settings" ? "text-primary" : "text-muted-foreground"}`}
                    >
                        <Settings2 className="w-5 h-5" />
                        Settings
                    </button>
                    <button
                        onClick={() => setMobileTab("preview")}
                        className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors cursor-pointer ${mobileTab === "preview" ? "text-primary" : "text-muted-foreground"}`}
                    >
                        <Eye className="w-5 h-5" />
                        Preview
                    </button>
                </div>
            </div>
        </div>
    );
}
