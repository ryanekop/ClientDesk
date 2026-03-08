"use client";

import * as React from "react";
import { Save, Loader2, Plus, Trash2, MessageSquare, User, Building2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";

type Profile = {
    id: string;
    full_name: string;
    studio_name: string | null;
    whatsapp_number: string | null;
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

export default function SettingsPage() {
    const supabase = createClient();
    const t = useTranslations("Settings");
    const [profile, setProfile] = React.useState<Profile | null>(null);
    const [templates, setTemplates] = React.useState<Template[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [savedMsg, setSavedMsg] = React.useState("");

    // Template form
    const [newType, setNewType] = React.useState("whatsapp_client");
    const [newName, setNewName] = React.useState("");
    const [newContent, setNewContent] = React.useState("");
    const [showAddTemplate, setShowAddTemplate] = React.useState(false);

    React.useEffect(() => { fetchAll(); }, []);

    async function fetchAll() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: p } = await supabase.from("profiles").select("id, full_name, studio_name, whatsapp_number").eq("id", user.id).single();
        setProfile(p as Profile);

        const { data: t } = await supabase.from("templates").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
        setTemplates((t || []) as Template[]);
        setLoading(false);
    }

    async function handleSaveProfile(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!profile) return;
        setSaving(true);

        const fd = new FormData(e.currentTarget);
        await supabase.from("profiles").update({
            full_name: fd.get("full_name") as string,
            studio_name: fd.get("studio_name") as string || null,
            whatsapp_number: fd.get("whatsapp_number") as string || null,
        }).eq("id", profile.id);

        setSavedMsg(t("berhasilSimpan"));
        setTimeout(() => setSavedMsg(""), 3000);
        setSaving(false);
        fetchAll();
    }

    async function handleAddTemplate() {
        if (!newName.trim() || !newContent.trim()) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase.from("templates").insert({
            user_id: user.id,
            type: newType,
            name: newName,
            content: newContent,
            is_default: false,
        });

        setNewName(""); setNewContent(""); setShowAddTemplate(false);
        fetchAll();
    }

    async function handleDeleteTemplate(id: string) {
        if (!confirm(t("hapusConfirm"))) return;
        await supabase.from("templates").delete().eq("id", id);
        fetchAll();
    }

    async function handleSetDefault(id: string, type: string) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        // Unset all defaults for this type first
        await supabase.from("templates").update({ is_default: false }).eq("user_id", user.id).eq("type", type);
        await supabase.from("templates").update({ is_default: true }).eq("id", id);
        fetchAll();
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
        <div className="space-y-8 max-w-3xl">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
                <p className="text-muted-foreground">{t("subtitle")}</p>
            </div>

            {/* Profile Section */}
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                <div className="px-6 py-4 border-b">
                    <h3 className="font-semibold flex items-center gap-2"><Building2 className="w-4 h-4" /> {t("profilStudio")}</h3>
                    <p className="text-sm text-muted-foreground">{t("infoStudio")}</p>
                </div>
                <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {t("namaLengkap")}</label>
                            <input name="full_name" required defaultValue={profile?.full_name || ""} className={inputClass} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> {t("namaStudio")}</label>
                            <input name="studio_name" defaultValue={profile?.studio_name || ""} placeholder="Misal: Studio XYZ" className={inputClass} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {t("nomorWA")}</label>
                        <input name="whatsapp_number" type="tel" defaultValue={profile?.whatsapp_number || ""} placeholder="08123456789" className={inputClass} />
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

            {/* Templates Section */}
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                <div className="px-6 py-4 border-b flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold flex items-center gap-2"><MessageSquare className="w-4 h-4" /> {t("templatePesan")}</h3>
                        <p className="text-sm text-muted-foreground">{t("templateDesc")}</p>
                    </div>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAddTemplate(!showAddTemplate)}>
                        <Plus className="w-3.5 h-3.5" /> {t("tambah")}
                    </Button>
                </div>

                {/* Add Template Form */}
                {showAddTemplate && (
                    <div className="p-6 border-b bg-muted/30 space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t("tipeTemplate")}</label>
                                <select value={newType} onChange={(e) => setNewType(e.target.value)} className={inputClass}>
                                    {templateTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t("namaTemplate")}</label>
                                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Misal: Konfirmasi Booking" className={inputClass} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t("isiTemplate")}</label>
                            <textarea
                                value={newContent}
                                onChange={(e) => setNewContent(e.target.value)}
                                rows={4}
                                placeholder="Halo {{client_name}}, booking Anda dengan kode {{booking_code}} sudah dikonfirmasi..."
                                className="placeholder:text-muted-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-none"
                            />
                            <div className="flex flex-wrap gap-1.5 mt-1">
                                {(variableHints[newType] || []).map(v => (
                                    <button
                                        key={v}
                                        type="button"
                                        onClick={() => setNewContent(prev => prev + v)}
                                        className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                                    >
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" onClick={handleAddTemplate}>{t("simpanTemplate")}</Button>
                            <Button size="sm" variant="outline" onClick={() => setShowAddTemplate(false)}>{t("batal")}</Button>
                        </div>
                    </div>
                )}

                {/* Template List */}
                <div className="divide-y">
                    {templates.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                            {t("belumAdaTemplate")}
                        </div>
                    ) : templates.map((t) => (
                        <div key={t.id} className="p-4 px-6 hover:bg-muted/30 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-sm">{t.name}</span>
                                        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                                            {templateTypes.find(tt => tt.value === t.type)?.label || t.type}
                                        </span>
                                        {t.is_default && (
                                            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Default</span>
                                        )}
                                    </div>
                                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">{t.content}</pre>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    {!t.is_default && (
                                        <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => handleSetDefault(t.id, t.type)}>
                                            Set Default
                                        </Button>
                                    )}
                                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleDeleteTemplate(t.id)}>
                                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
