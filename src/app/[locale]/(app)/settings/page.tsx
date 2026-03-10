"use client";

import * as React from "react";
import { Save, Loader2, MessageSquare, Building2, Phone, Globe, Link2, Unlink, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";

const COUNTRY_CODES = [
    { code: "+62", flag: "🇮🇩", name: "Indonesia" },
    { code: "+60", flag: "🇲🇾", name: "Malaysia" },
    { code: "+65", flag: "🇸🇬", name: "Singapore" },
    { code: "+66", flag: "🇹🇭", name: "Thailand" },
    { code: "+63", flag: "🇵🇭", name: "Philippines" },
    { code: "+84", flag: "🇻🇳", name: "Vietnam" },
];

const EVENT_TYPES = ["Umum", "Wedding", "Akad", "Resepsi", "Wisuda", "Maternity", "Newborn", "Family", "Komersil", "Lainnya"];

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
    content_en: string;
    is_default: boolean;
    event_type: string | null;
};

const templateTypes = [
    { value: "whatsapp_client", label: "Whatsapp ke Klien" },
    { value: "whatsapp_freelancer", label: "Whatsapp ke Freelance" },
    { value: "invoice", label: "Invoice" },
];

const variableHints: Record<string, string[]> = {
    whatsapp_client: ["{{client_name}}", "{{booking_code}}", "{{session_date}}", "{{service_name}}", "{{total_price}}", "{{dp_paid}}", "{{studio_name}}", "{{invoice_url}}"],
    whatsapp_freelancer: ["{{freelancer_name}}", "{{client_name}}", "{{session_date}}", "{{service_name}}", "{{studio_name}}", "{{event_type}}", "{{location}}"],
    invoice: ["{{client_name}}", "{{booking_code}}", "{{service_name}}", "{{total_price}}", "{{dp_paid}}", "{{session_date}}", "{{invoice_url}}"],
};

function slugify(str: string) {
    return str.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

// Google Calendar SVG Logo
function GoogleCalendarLogo({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M152.637 39.4023H47.3628V152.598H152.637V39.4023Z" fill="white" />
            <path d="M118.125 86.7812C116.344 85.3047 113.555 83.5234 109.754 81.4375C105.949 79.3516 103.012 77.8672 100.93 76.9883C96.918 75.2305 94.1875 74.5547 92.7383 74.9727C91.2891 75.3867 90.4375 77.3398 90.168 80.832L89.7383 86.4375L80.5664 82.2695C79.7891 81.918 78.8047 82.3516 77.6172 83.5703C76.4258 84.793 75.832 85.7891 75.832 86.5625C75.832 87.3359 76.4258 88.3203 77.6172 89.5117C78.8047 90.707 79.7891 91.1602 80.5664 90.8094L89.4336 86.7812L88.8906 94.7734C88.6914 97.8438 89.2188 99.7266 90.4766 100.422C91.7344 101.117 94.6367 100.434 99.1836 98.375C101.266 97.4961 104.203 95.8789 107.996 93.5234C111.789 91.168 114.59 89.2266 116.395 87.6953C117.453 86.8164 118.078 86.2422 118.266 85.9727C118.453 85.7031 118.422 85.5 118.172 85.3672C117.926 85.2305 117.543 85.2734 117.031 85.4844C116.516 85.6953 116.117 85.8398 115.832 85.9141L118.125 86.7812Z" fill="white" />
            <path d="M152.637 39.4023L130.883 17.7734L130.883 39.4023L152.637 39.4023Z" fill="#EA4335" />
            <path d="M152.637 152.598L130.883 174.227L130.883 152.598L152.637 152.598Z" fill="#34A853" />
            <path d="M47.3628 152.598L25.6094 174.227V152.598H47.3628Z" fill="#188038" />
            <path d="M152.637 39.4023H130.883V17.7734L152.637 39.4023Z" fill="#EA4335" />
            <path d="M25.6094 39.4023H47.3628L47.3628 17.7734L25.6094 39.4023Z" fill="#1967D2" />
            <path d="M130.883 17.7734H47.3628V39.4023H130.883V17.7734Z" fill="#EA4335" />
            <path d="M47.3628 39.4023H25.6094V152.598H47.3628V39.4023Z" fill="#4285F4" />
            <path d="M130.883 152.598H47.3628V174.227H130.883V152.598Z" fill="#34A853" />
            <path d="M152.637 39.4023V152.598H130.883V174.227L174.391 130.969V39.4023H152.637Z" fill="#FBBC04" />
            <path d="M174.391 39.4023H152.637L174.391 17.7734V39.4023Z" fill="#EA4335" />
            <path d="M174.391 130.969L152.637 152.598V130.969H174.391Z" fill="#E5AD06" />
            <path d="M25.6094 174.227L47.3628 152.598V174.227H25.6094Z" fill="#188038" />
            <path d="M25.6094 39.4023L47.3628 17.7734V39.4023H25.6094Z" fill="#1A73E8" />
            <path d="M76.75 126.875C73.2461 124.309 70.6641 120.73 69.0039 116.133H75.5859C76.918 119.254 78.8906 121.746 81.5078 123.609C84.125 125.473 87.2578 126.402 90.9102 126.402C95.0586 126.402 98.4805 125.199 101.172 122.793C103.863 120.39 105.207 117.34 105.207 113.648C105.207 109.883 103.809 106.793 101.012 104.387C98.2148 101.98 94.6797 100.777 90.4062 100.777H86.0938V94.6484H90.0547C93.7773 94.6484 96.9336 93.5703 99.5195 91.418C102.105 89.2656 103.398 86.4648 103.398 83.0156C103.398 79.9219 102.258 77.418 99.9727 75.5C97.6875 73.582 94.8906 72.625 91.5742 72.625C88.332 72.625 85.5781 73.4961 83.3164 75.2383C81.0547 76.9805 79.3594 79.3516 78.2344 82.3438H71.8008C73.0703 77.9609 75.4258 74.3477 78.8672 71.5C82.3086 68.6523 86.4883 67.2305 91.4102 67.2305C94.9141 67.2305 98.0586 67.9805 100.844 69.4805C103.629 70.9805 105.809 73.0195 107.383 75.5977C108.953 78.1758 109.738 81.0195 109.738 84.125C109.738 87.3047 108.875 90.1602 107.148 92.6992C105.422 95.2344 103.121 97.1523 100.246 98.4531V98.8047C103.68 100.105 106.434 102.16 108.512 104.977C110.586 107.793 111.625 111.121 111.625 113.961C111.625 117.211 110.768 120.172 109.051 122.844C107.336 125.512 104.984 127.629 101.996 129.199C99.0078 130.766 95.6523 131.551 91.9297 131.551C86.2891 131.551 80.2539 129.441 76.75 126.875Z" fill="#4285F4" />
            <path d="M126.797 130.852V69.9766L115.984 73.3867V67.582L131.504 61.875H132.945V130.852H126.797Z" fill="#4285F4" />
        </svg>
    );
}

// Google Drive SVG Logo
function GoogleDriveLogo({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
            <path d="M6.6 66.85L3.3 72.35 16.6 78H70.8L74.1 72.35 6.6 66.85Z" fill="#0066DA" />
            <path d="M43.65 25L29.05 0H58.25L72.85 25L43.65 25Z" fill="#00AC47" />
            <path d="M72.85 25L87.3 50.35 74.1 72.35 70.8 78 43.65 25H72.85Z" fill="#EA4335" />
            <path d="M43.65 25L29.05 0 0 50.35 3.3 72.35 6.6 66.85L43.65 25Z" fill="#00832D" />
            <path d="M0 50.35L16.6 78H6.6L3.3 72.35L0 50.35Z" fill="#2684FC" />
            <path d="M43.65 25L6.6 66.85L74.1 72.35L43.65 25Z" fill="#FFBA00" />
            <path d="M74.1 72.35L87.3 50.35L72.85 25L43.65 25L74.1 72.35Z" fill="#EA4335" />
            <path d="M29.05 0L0 50.35L43.65 25L29.05 0Z" fill="#00AC47" />
        </svg>
    );
}

export default function SettingsPage() {
    const supabase = createClient();
    const t = useTranslations("Settings");
    const locale = useLocale();
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
    const [templateContentsEn, setTemplateContentsEn] = React.useState<Record<string, string>>({});
    const [templateSaving, setTemplateSaving] = React.useState<string | null>(null);
    const [templateSavedMsg, setTemplateSavedMsg] = React.useState<string | null>(null);

    // Event type selector for freelancer template
    const [selectedEventType, setSelectedEventType] = React.useState("Umum");

    // Language tab per template
    const [templateLang, setTemplateLang] = React.useState<Record<string, "id" | "en">>({});

    // Google integration
    const [isCalendarConnected, setIsCalendarConnected] = React.useState(false);
    const [isDriveConnected, setIsDriveConnected] = React.useState(false);

    // Disconnect modal
    const [disconnectModal, setDisconnectModal] = React.useState<{ open: boolean; service: "calendar" | "drive" | null }>({ open: false, service: null });
    const [isDisconnecting, setIsDisconnecting] = React.useState(false);

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
        const savedWa = prof?.whatsapp_number || "";
        const matchedCode = COUNTRY_CODES.find(c => savedWa.startsWith(c.code));
        if (matchedCode) {
            setCountryCode(matchedCode.code);
            setWaNumber(savedWa.slice(matchedCode.code.length));
        } else {
            setWaNumber(savedWa.replace(/^0/, ""));
        }
        setVendorSlug(prof?.vendor_slug || "");

        const { data: tData } = await supabase.from("templates").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
        const allTemplates = (tData || []) as Template[];
        setTemplates(allTemplates);

        // Initialize template contents from existing templates
        const contents: Record<string, string> = {};
        const contentsEn: Record<string, string> = {};
        templateTypes.forEach(tt => {
            if (tt.value === "whatsapp_freelancer") {
                // Initialize per event type
                EVENT_TYPES.forEach(et => {
                    const key = `${tt.value}__${et}`;
                    const existing = allTemplates.find((tmpl: any) => tmpl.type === tt.value && (tmpl.event_type || "Umum") === et);
                    contents[key] = existing?.content || "";
                    contentsEn[key] = existing?.content_en || "";
                });
            } else {
                const existing = allTemplates.find((tmpl: any) => tmpl.type === tt.value);
                contents[tt.value] = existing?.content || "";
                contentsEn[tt.value] = existing?.content_en || "";
            }
        });
        setTemplateContents(contents);
        setTemplateContentsEn(contentsEn);
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

    async function handleSaveTemplate(type: string, eventType?: string) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const saveKey = eventType ? `${type}__${eventType}` : type;
        setTemplateSaving(saveKey);

        const content = templateContents[saveKey] || "";
        const contentEn = templateContentsEn[saveKey] || "";
        const existing = templates.find(t => t.type === type && (eventType ? (t.event_type || "Umum") === eventType : !t.event_type || t.event_type === null));

        if (existing) {
            await supabase.from("templates").update({ content, content_en: contentEn }).eq("id", existing.id);
        } else if (content.trim() || contentEn.trim()) {
            await supabase.from("templates").insert({
                user_id: user.id,
                type,
                name: templateTypes.find(tt => tt.value === type)?.label || type,
                content,
                content_en: contentEn,
                is_default: true,
                event_type: eventType || null,
            });
        }

        setTemplateSaving(null);
        setTemplateSavedMsg(saveKey);
        setTimeout(() => setTemplateSavedMsg(null), 3000);
        fetchAll();
    }

    async function handleDisconnect() {
        if (!disconnectModal.service) return;
        setIsDisconnecting(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setIsDisconnecting(false); return; }

        if (disconnectModal.service === "calendar") {
            await supabase.from("profiles").update({ google_access_token: null, google_refresh_token: null, google_token_expiry: null }).eq("id", user.id);
            setIsCalendarConnected(false);
        } else {
            await supabase.from("profiles").update({ google_drive_access_token: null, google_drive_refresh_token: null }).eq("id", user.id);
            setIsDriveConnected(false);
        }
        setIsDisconnecting(false);
        setDisconnectModal({ open: false, service: null });
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

    const previewData: Record<string, string> = {
        client_name: "Budi",
        booking_code: "INV-100120250001",
        session_date: "15 April 2026",
        service_name: "Paket Wedding",
        total_price: "Rp 5.000.000",
        dp_paid: "Rp 2.500.000",
        studio_name: studioName || "Memori Studio",
        freelancer_name: "Andi",
        event_type: selectedEventType,
        location: "Jakarta Convention Center",
    };

    function renderPreview(content: string) {
        if (!content) return "(Pesan kosong)";
        return content.replace(/\{\{(\w+)\}\}/g, (_, key) => previewData[key] || `{{${key}}}`);
    }

    function renderTemplateCard(tt: typeof templateTypes[0]) {
        const isFreelancer = tt.value === "whatsapp_freelancer";
        const contentKey = isFreelancer ? `${tt.value}__${selectedEventType}` : tt.value;
        const currentLang = templateLang[contentKey] || "id";
        const content = currentLang === "id" ? (templateContents[contentKey] || "") : (templateContentsEn[contentKey] || "");
        const hints = variableHints[tt.value] || [];
        const preview = renderPreview(content);

        return (
            <div key={tt.value} className="rounded-xl border bg-card text-card-foreground shadow-sm">
                <div className="px-6 py-4 border-b">
                    <h3 className="font-semibold flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        {tt.label}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        {tt.value === "whatsapp_client" && "Template pesan Whatsapp untuk klien"}
                        {tt.value === "whatsapp_freelancer" && "Template pesan Whatsapp untuk freelance, bisa berbeda per jenis acara"}
                        {tt.value === "invoice" && "Template pesan invoice"}
                    </p>
                </div>
                <div className="p-6 space-y-4">
                    {/* Event Type Selector for Freelancer */}
                    {isFreelancer && (
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Jenis Acara</label>
                            <select
                                value={selectedEventType}
                                onChange={e => setSelectedEventType(e.target.value)}
                                className={inputClass + " cursor-pointer"}
                            >
                                {EVENT_TYPES.map(et => (
                                    <option key={et} value={et}>{et}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Variables */}
                    <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Variables</p>
                        <div className="flex flex-wrap gap-1.5">
                            {hints.map(v => (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => {
                                        if (currentLang === "id") {
                                            setTemplateContents(prev => ({ ...prev, [contentKey]: (prev[contentKey] || "") + v }));
                                        } else {
                                            setTemplateContentsEn(prev => ({ ...prev, [contentKey]: (prev[contentKey] || "") + v }));
                                        }
                                    }}
                                    className="text-[11px] px-2 py-1 rounded-md border bg-muted/50 text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                                >
                                    {v.replace(/\{\{|\}\}/g, "")}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Language Tabs */}
                    <div className="flex rounded-lg border overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setTemplateLang(prev => ({ ...prev, [contentKey]: "id" }))}
                            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${currentLang === "id"
                                ? "bg-foreground text-background"
                                : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                                }`}
                        >
                            Indonesian 🇮🇩
                        </button>
                        <button
                            type="button"
                            onClick={() => setTemplateLang(prev => ({ ...prev, [contentKey]: "en" }))}
                            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${currentLang === "en"
                                ? "bg-foreground text-background"
                                : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                                }`}
                        >
                            English 🇬🇧
                        </button>
                    </div>

                    {/* Textarea */}
                    <textarea
                        value={content}
                        onChange={e => {
                            if (currentLang === "id") {
                                setTemplateContents(prev => ({ ...prev, [contentKey]: e.target.value }));
                            } else {
                                setTemplateContentsEn(prev => ({ ...prev, [contentKey]: e.target.value }));
                            }
                        }}
                        rows={5}
                        placeholder={currentLang === "id"
                            ? `Tulis template pesan dalam Bahasa Indonesia ...`
                            : `Write message template in English ...`}
                        className="placeholder:text-muted-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-y"
                    />

                    {/* Preview */}
                    <div className="bg-muted/30 rounded-md px-4 py-3 border">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Preview:</p>
                        <pre className="text-sm whitespace-pre-wrap font-sans text-foreground/80">{preview}</pre>
                    </div>

                    {/* Save */}
                    <div className="flex items-center gap-3">
                        <Button size="sm" className="gap-2" onClick={() => handleSaveTemplate(tt.value, isFreelancer ? selectedEventType : undefined)} disabled={templateSaving === contentKey}>
                            {templateSaving === contentKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            Simpan
                        </Button>
                        {templateSavedMsg === contentKey && <span className="text-sm text-green-600 dark:text-green-400">Tersimpan ✓</span>}
                    </div>
                </div>
            </div>
        );
    }

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
                                <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md break-all">
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
                                    <div className="w-10 h-10 rounded-lg bg-white dark:bg-white/10 flex items-center justify-center border">
                                        <GoogleCalendarLogo className="w-7 h-7" />
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
                                            <Button variant="outline" size="sm" className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" onClick={() => setDisconnectModal({ open: true, service: "calendar" })}>
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
                                    <div className="w-10 h-10 rounded-lg bg-white dark:bg-white/10 flex items-center justify-center border">
                                        <GoogleDriveLogo className="w-7 h-7" />
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
                                            <Button variant="outline" size="sm" className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" onClick={() => setDisconnectModal({ open: true, service: "drive" })}>
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
                    {templateTypes.map(tt => renderTemplateCard(tt))}
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

            {/* Disconnect Confirmation Modal */}
            <Dialog open={disconnectModal.open} onOpenChange={(o) => !o && setDisconnectModal({ open: false, service: null })}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader className="items-center text-center">
                        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-2">
                            <AlertCircle className="w-6 h-6 text-red-600" />
                        </div>
                        <DialogTitle className="text-xl">Putuskan Koneksi?</DialogTitle>
                        <DialogDescription>
                            {disconnectModal.service === "calendar"
                                ? "Apakah Anda yakin ingin memutuskan koneksi Google Calendar? Sinkronisasi jadwal akan berhenti."
                                : "Apakah Anda yakin ingin memutuskan koneksi Google Drive? Penyimpanan file otomatis akan berhenti."
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="sm:justify-center gap-2 pt-2">
                        <Button variant="outline" className="flex-1" onClick={() => setDisconnectModal({ open: false, service: null })} disabled={isDisconnecting}>Batal</Button>
                        <Button variant="destructive" className="flex-1" onClick={handleDisconnect} disabled={isDisconnecting}>
                            {isDisconnecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Unlink className="w-4 h-4 mr-2" />}
                            Ya, Putuskan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
