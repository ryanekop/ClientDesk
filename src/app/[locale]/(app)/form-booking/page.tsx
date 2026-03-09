"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { ExternalLink, Copy, ClipboardCheck, Eye, Loader2, Percent, Link2, Palette, List, ToggleRight, RefreshCw, RotateCcw, CreditCard, Plus, Trash2 } from "lucide-react";
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
                setMinDpPercent(p.min_dp_percent ?? DEFAULTS.minDpPercent);
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
                    <p className="text-sm text-muted-foreground">Form booking akan aktif setelah Anda menyimpan pengaturan. URL akan digenerate otomatis dari nama studio.</p>
                </div>
            )}

            {/* Main Content: Settings + Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* LEFT: Settings */}
                <div className="space-y-6">
                    {/* Payment Settings */}
                    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                        <div className="px-6 py-4 border-b">
                            <h3 className="font-semibold flex items-center gap-2"><Percent className="w-4 h-4" /> Pengaturan Pembayaran</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Minimum DP</label>
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

                {/* RIGHT: Preview */}
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 space-y-4 sticky top-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold flex items-center gap-2"><Eye className="w-4 h-4" /> Preview</h3>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIframeKey(k => k + 1)} title="Refresh">
                                <RefreshCw className="w-3.5 h-3.5" />
                            </Button>
                            {vendorSlug && (
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(formUrl, "_blank")} title="Buka di tab baru">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </Button>
                            )}
                        </div>
                    </div>
                    {vendorSlug ? (
                        <div className="flex justify-center">
                            <div className="w-full max-w-[400px] aspect-[9/16] max-h-[700px] rounded-lg overflow-hidden border bg-muted">
                                <iframe key={iframeKey} src={formUrl} className="w-full h-full" title="Form Preview" />
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-64 text-center">
                            <p className="text-sm text-muted-foreground">Simpan pengaturan terlebih dahulu untuk melihat preview.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
