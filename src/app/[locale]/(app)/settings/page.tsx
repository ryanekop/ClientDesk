"use client";

import * as React from "react";
import { Save, Loader2, Plus, Trash2, MessageSquare, Building2, Phone, Globe, Link2, Unlink, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";

const COUNTRY_CODES = [
    { code: "+62", flag: "🇮🇩", name: "Indonesia" },
    { code: "+60", flag: "🇲🇾", name: "Malaysia" },
    { code: "+65", flag: "🇸🇬", name: "Singapore" },
    { code: "+66", flag: "🇹🇭", name: "Thailand" },
    { code: "+63", flag: "🇵🇭", name: "Philippines" },
    { code: "+84", flag: "🇻🇳", name: "Vietnam" },
];

type Profile = {
    id: string;
    full_name: string;
    studio_name: string | null;
    whatsapp_number: string | null;
    vendor_slug: string | null;
};

type Template = {
    id: string;
    type: string;
    name: string;
    content: string;
    is_default: boolean;
};

const templateTypes = [
    { value: "whatsapp_client", label: "WA ke Klien" },
    { value: "whatsapp_freelancer", label: "WA ke Freelancer" },
    { value: "invoice", label: "Invoice" },
];

const variableHints: Record<string, string[]> = {
    whatsapp_client: ["{{client_name}}", "{{booking_code}}", "{{session_date}}", "{{service_name}}", "{{total_price}}", "{{dp_paid}}", "{{studio_name}}"],
    whatsapp_freelancer: ["{{freelancer_name}}", "{{client_name}}", "{{session_date}}", "{{service_name}}", "{{studio_name}}"],
    invoice: ["{{client_name}}", "{{booking_code}}", "{{service_name}}", "{{total_price}}", "{{dp_paid}}", "{{session_date}}"],
};

function slugify(str: string) {
    return str.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export default function SettingsPage() {
    const supabase = createClient();
    const t = useTranslations("Settings");
    const [profile, setProfile] = React.useState<Profile | null>(null);
    const [templates, setTemplates] = React.useState<Template[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [savedMsg, setSavedMsg] = React.useState("");

    // Controlled fields for profile
    const [studioName, setStudioName] = React.useState("");
    const [countryCode, setCountryCode] = React.useState("+62");
    const [waNumber, setWaNumber] = React.useState("");
    const [vendorSlug, setVendorSlug] = React.useState("");

    // Template form
    const [activeTab, setActiveTab] = React.useState("umum");
    const [templateContents, setTemplateContents] = React.useState<Record<string, string>>({});
    const [templateSaving, setTemplateSaving] = React.useState<string | null>(null);
    const [templateSavedMsg, setTemplateSavedMsg] = React.useState<string | null>(null);

    // Google integration
    const [isCalendarConnected, setIsCalendarConnected] = React.useState(false);
    const [isDriveConnected, setIsDriveConnected] = React.useState(false);

    React.useEffect(() => { fetchAll(); }, []);

    // Listen for Google auth popup callbacks
    React.useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === "GOOGLE_AUTH_SUCCESS") setIsCalendarConnected(true);
            if (event.data?.type === "GOOGLE_DRIVE_SUCCESS") setIsDriveConnected(true);
        };
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    async function fetchAll() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: p } = await supabase.from("profiles").select("id, full_name, studio_name, whatsapp_number, vendor_slug, google_access_token, google_drive_access_token").eq("id", user.id).single();
        const prof = p as Profile;
        setProfile(prof);
        setStudioName(prof?.studio_name || "");
        setIsCalendarConnected(!!(prof as any)?.google_access_token);
        setIsDriveConnected(!!(prof as any)?.google_drive_access_token);
        // Parse saved number into country code + local number
        const savedWa = prof?.whatsapp_number || "";
        const matchedCode = COUNTRY_CODES.find(c => savedWa.startsWith(c.code));
        if (matchedCode) {
            setCountryCode(matchedCode.code);
            setWaNumber(savedWa.slice(matchedCode.code.length));
        } else {
            setWaNumber(savedWa.replace(/^0/, ""));
        }
        setVendorSlug(prof?.vendor_slug || "");

        const { data: t } = await supabase.from("templates").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
        setTemplates((t || []) as Template[]);
        // Initialize template contents from existing templates
        const contents: Record<string, string> = {};
        templateTypes.forEach(tt => {
            const existing = (t || []).find((tmpl: any) => tmpl.type === tt.value);
            contents[tt.value] = existing?.content || "";
        });
        setTemplateContents(contents);
        setLoading(false);
    }

    async function handleSaveProfile(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!profile) return;
        setSaving(true);

        const slug = slugify(vendorSlug || studioName);

        await supabase.from("profiles").update({
            studio_name: studioName || null,
            whatsapp_number: waNumber ? `${countryCode}${waNumber}` : null,
            vendor_slug: slug || null,
        }).eq("id", profile.id);

        setVendorSlug(slug);
        setSavedMsg(t("berhasilSimpan"));
        setTimeout(() => setSavedMsg(""), 3000);
        setSaving(false);
        fetchAll();
    }

    async function handleSaveTemplate(type: string) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setTemplateSaving(type);

        const content = templateContents[type] || "";
        const existing = templates.find(t => t.type === type);

        if (existing) {
            await supabase.from("templates").update({ content }).eq("id", existing.id);
        } else if (content.trim()) {
            await supabase.from("templates").insert({
                user_id: user.id,
                type,
                name: templateTypes.find(tt => tt.value === type)?.label || type,
                content,
                is_default: true,
            });
        }

        setTemplateSaving(null);
        setTemplateSavedMsg(type);
        setTimeout(() => setTemplateSavedMsg(null), 3000);
        fetchAll();
    }

    const inputClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";
    const siteUrl = typeof window !== "undefined" ? window.location.origin : "https://clientdesk.ryanekoapp.web.id";
    const slugPreview = slugify(vendorSlug || studioName) || "nama-vendor";

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const tabs = [
        { key: "umum", label: "Umum" },
        { key: "template", label: "Template Pesan" },
        { key: "telegram", label: "Bot Telegram" },
    ];

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
                <p className="text-muted-foreground">{t("subtitle")}</p>
            </div>

            {/* Tab Navigation */}
            <div className="border-b">
                <div className="flex gap-0">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${activeTab === tab.key
                                    ? "border-foreground text-foreground"
                                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ═══ TAB: Umum ═══ */}
            {activeTab === "umum" && (
                <div className="space-y-6">
                    {/* Profile Section */}
                    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                        <div className="px-6 py-4 border-b">
                            <h3 className="font-semibold flex items-center gap-2"><Building2 className="w-4 h-4" /> {t("profilStudio")}</h3>
                            <p className="text-sm text-muted-foreground">{t("infoStudio")}</p>
                        </div>
                        <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Nama Vendor/Studio</label>
                                    <input value={studioName} onChange={e => setStudioName(e.target.value)} placeholder="Misal: Memori Studio" className={inputClass} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {t("nomorWA")}</label>
                                    <div className="flex gap-2">
                                        <select value={countryCode} onChange={e => setCountryCode(e.target.value)} className={inputClass + " !w-28 shrink-0 cursor-pointer"}>
                                            {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                                        </select>
                                        <input type="tel" value={waNumber} onChange={e => { const val = e.target.value.replace(/[^0-9]/g, ""); setWaNumber(val.startsWith("0") ? val.slice(1) : val); }} placeholder="8123456789" className={inputClass} />
                                    </div>
                                </div>
                            </div>

                            {/* Custom URL Slug */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Custom URL Form Booking</label>
                                <input
                                    value={vendorSlug}
                                    onChange={e => setVendorSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                                    placeholder={slugify(studioName) || "nama-vendor"}
                                    className={inputClass}
                                />
                                <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md font-mono break-all">
                                    {siteUrl}/formbooking/<span className="text-primary font-semibold">{slugPreview}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                                <Button type="submit" disabled={saving} className="gap-2">
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {t("simpanProfil")}
                                </Button>
                                {savedMsg && <span className="text-sm text-green-600 dark:text-green-400">{savedMsg}</span>}
                            </div>
                        </form>
                    </div>

                    {/* Google Integration Section */}
                    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                        <div className="px-6 py-4 border-b">
                            <h3 className="font-semibold flex items-center gap-2">
                                <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                                Integrasi Google
                            </h3>
                            <p className="text-sm text-muted-foreground">Hubungkan akun Google untuk sinkronisasi kalender dan penyimpanan file.</p>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Google Calendar */}
                            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/10">
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" className="text-blue-600 dark:text-blue-400" strokeWidth="2" /><path d="M3 10h18" stroke="currentColor" className="text-blue-600 dark:text-blue-400" strokeWidth="2" /><path d="M16 2v4M8 2v4" stroke="currentColor" className="text-blue-600 dark:text-blue-400" strokeWidth="2" strokeLinecap="round" /></svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Google Calendar</p>
                                        <p className="text-xs text-muted-foreground">Sinkronisasi jadwal sesi ke Google Calendar</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isCalendarConnected ? (
                                        <>
                                            <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Terhubung</span>
                                            <Button variant="outline" size="sm" className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" onClick={async () => {
                                                if (!confirm("Putuskan koneksi Google Calendar?")) return;
                                                const { data: { user } } = await supabase.auth.getUser();
                                                if (!user) return;
                                                await supabase.from("profiles").update({ google_access_token: null, google_refresh_token: null, google_token_expiry: null }).eq("id", user.id);
                                                setIsCalendarConnected(false);
                                            }}>
                                                <Unlink className="w-3.5 h-3.5" /> Putuskan
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Belum terhubung</span>
                                            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                                                const w = 500, h = 600;
                                                const left = window.screenX + (window.outerWidth - w) / 2;
                                                const top = window.screenY + (window.outerHeight - h) / 2;
                                                window.open("/api/google/auth", "google-auth", `width=${w},height=${h},left=${left},top=${top},popup=yes`);
                                            }}>
                                                <Link2 className="w-3.5 h-3.5" /> Hubungkan
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Google Drive */}
                            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-500/10">
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 19h20L12 2z" stroke="currentColor" className="text-green-600 dark:text-green-400" strokeWidth="2" strokeLinejoin="round" /><path d="M7.5 12.5h9" stroke="currentColor" className="text-green-600 dark:text-green-400" strokeWidth="2" /></svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Google Drive</p>
                                        <p className="text-xs text-muted-foreground">Simpan file klien langsung ke Google Drive</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isDriveConnected ? (
                                        <>
                                            <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Terhubung</span>
                                            <Button variant="outline" size="sm" className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" onClick={async () => {
                                                if (!confirm("Putuskan koneksi Google Drive?")) return;
                                                const { data: { user } } = await supabase.auth.getUser();
                                                if (!user) return;
                                                await supabase.from("profiles").update({ google_drive_access_token: null, google_drive_refresh_token: null }).eq("id", user.id);
                                                setIsDriveConnected(false);
                                            }}>
                                                <Unlink className="w-3.5 h-3.5" /> Putuskan
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Belum terhubung</span>
                                            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                                                const w = 500, h = 600;
                                                const left = window.screenX + (window.outerWidth - w) / 2;
                                                const top = window.screenY + (window.outerHeight - h) / 2;
                                                window.open("/api/google/drive/auth", "google-drive-auth", `width=${w},height=${h},left=${left},top=${top},popup=yes`);
                                            }}>
                                                <Link2 className="w-3.5 h-3.5" /> Hubungkan
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ TAB: Template Pesan ═══ */}
            {activeTab === "template" && (
                <div className="space-y-6">
                    {templateTypes.map(tt => {
                        const content = templateContents[tt.value] || "";
                        const hints = variableHints[tt.value] || [];
                        const preview = content
                            ? content.replace(/\{\{(\w+)\}\}/g, (_, key) => {
                                const previews: Record<string, string> = {
                                    client_name: "Budi",
                                    booking_code: "INV-100120250001",
                                    session_date: "15 April 2026",
                                    service_name: "Paket Wedding",
                                    total_price: "Rp 5.000.000",
                                    dp_paid: "Rp 2.500.000",
                                    studio_name: studioName || "Memori Studio",
                                    freelancer_name: "Andi",
                                };
                                return previews[key] || `{{${key}}}`;
                            })
                            : "(Pesan kosong)";

                        return (
                            <div key={tt.value} className="rounded-xl border bg-card text-card-foreground shadow-sm">
                                <div className="px-6 py-4 border-b">
                                    <h3 className="font-semibold flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4" />
                                        {tt.label}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        {tt.value === "whatsapp_client" && "Template pesan WhatsApp untuk klien"}
                                        {tt.value === "whatsapp_freelancer" && "Template pesan WhatsApp untuk freelancer"}
                                        {tt.value === "invoice" && "Template pesan invoice"}
                                    </p>
                                </div>
                                <div className="p-6 space-y-4">
                                    {/* Variables */}
                                    <div>
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Variables</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {hints.map(v => (
                                                <button
                                                    key={v}
                                                    type="button"
                                                    onClick={() => setTemplateContents(prev => ({ ...prev, [tt.value]: (prev[tt.value] || "") + v }))}
                                                    className="text-[11px] font-mono px-2 py-1 rounded-md border bg-muted/50 text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                                                >
                                                    {v.replace(/\{\{|\}\}/g, "")}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Textarea */}
                                    <textarea
                                        value={content}
                                        onChange={e => setTemplateContents(prev => ({ ...prev, [tt.value]: e.target.value }))}
                                        rows={5}
                                        placeholder={`Tulis template pesan ${tt.label}...`}
                                        className="placeholder:text-muted-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-y"
                                    />

                                    {/* Preview */}
                                    <div className="bg-muted/30 rounded-md px-4 py-3 border">
                                        <p className="text-xs font-medium text-muted-foreground mb-1">Preview:</p>
                                        <pre className="text-sm whitespace-pre-wrap font-sans text-foreground/80">{preview}</pre>
                                    </div>

                                    {/* Save */}
                                    <div className="flex items-center gap-3">
                                        <Button size="sm" className="gap-2" onClick={() => handleSaveTemplate(tt.value)} disabled={templateSaving === tt.value}>
                                            {templateSaving === tt.value ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                            Simpan
                                        </Button>
                                        {templateSavedMsg === tt.value && <span className="text-sm text-green-600 dark:text-green-400">Tersimpan ✓</span>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ═══ TAB: Bot Telegram ═══ */}
            {activeTab === "telegram" && (
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                    <div className="px-6 py-4 border-b">
                        <h3 className="font-semibold">Bot Telegram</h3>
                        <p className="text-sm text-muted-foreground">Konfigurasi bot Telegram untuk notifikasi otomatis.</p>
                    </div>
                    <div className="p-8 text-center space-y-3">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto text-3xl">🤖</div>
                        <h4 className="font-semibold">Segera Hadir</h4>
                        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                            Fitur Bot Telegram sedang dalam pengembangan. Anda akan dapat menerima notifikasi booking baru secara otomatis.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
