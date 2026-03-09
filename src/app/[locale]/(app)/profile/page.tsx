"use client";

import * as React from "react";
import { Camera, Trash2, Save, Key, Loader2, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";

export default function ProfilePage() {
    const supabase = createClient();
    const t = useTranslations("Profile");
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [savedMsg, setSavedMsg] = React.useState("");
    const [resetMsg, setResetMsg] = React.useState("");

    const [userId, setUserId] = React.useState("");
    const [fullName, setFullName] = React.useState("");
    const [email, setEmail] = React.useState("");
    const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
    const [invoiceLogoUrl, setInvoiceLogoUrl] = React.useState<string | null>(null);

    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const logoInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => { fetchProfile(); }, []);

    async function fetchProfile() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setUserId(user.id);
        setEmail(user.email || "");

        const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, avatar_url, invoice_logo_url")
            .eq("id", user.id)
            .single();

        if (profile) {
            setFullName(profile.full_name || "");
            setAvatarUrl(profile.avatar_url || null);
            setInvoiceLogoUrl(profile.invoice_logo_url || null);
        }
        setLoading(false);
    }

    async function handleSave() {
        setSaving(true);
        await supabase.from("profiles").update({
            full_name: fullName,
        }).eq("id", userId);

        setSavedMsg(t("berhasilSimpan"));
        setTimeout(() => setSavedMsg(""), 3000);
        setSaving(false);
    }

    async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !userId) return;

        const ext = file.name.split(".").pop();
        const path = `avatars/${userId}.${ext}`;

        const { error } = await supabase.storage
            .from("avatars")
            .upload(path, file, { upsert: true });

        if (error) {
            alert(t("gagalUpload") + ": " + error.message);
            return;
        }

        const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);

        await supabase.from("profiles").update({
            avatar_url: publicUrl.publicUrl,
        }).eq("id", userId);

        setAvatarUrl(publicUrl.publicUrl + "?t=" + Date.now());
    }

    async function handleRemoveAvatar() {
        await supabase.from("profiles").update({
            avatar_url: null,
        }).eq("id", userId);
        setAvatarUrl(null);
    }

    async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !userId) return;

        const ext = file.name.split(".").pop();
        const path = `logos/${userId}_invoice.${ext}`;

        const { error } = await supabase.storage
            .from("avatars")
            .upload(path, file, { upsert: true });

        if (error) {
            alert("Gagal upload logo: " + error.message);
            return;
        }

        const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);

        await supabase.from("profiles").update({
            invoice_logo_url: publicUrl.publicUrl,
        }).eq("id", userId);

        setInvoiceLogoUrl(publicUrl.publicUrl + "?t=" + Date.now());
    }

    async function handleRemoveLogo() {
        await supabase.from("profiles").update({
            invoice_logo_url: null,
        }).eq("id", userId);
        setInvoiceLogoUrl(null);
    }

    async function handleResetPassword() {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin,
        });
        if (error) {
            setResetMsg(t("resetFailed") + ": " + error.message);
        } else {
            setResetMsg(t("resetSent"));
        }
        setTimeout(() => setResetMsg(""), 5000);
    }

    const inputClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input h-10 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                <div className="p-6 sm:p-8 space-y-8">
                    {/* Avatar */}
                    <div className="flex flex-col items-center gap-3">
                        <div className="relative">
                            <div className="w-28 h-28 rounded-full border-2 border-muted overflow-hidden bg-muted flex items-center justify-center">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-4xl font-bold text-muted-foreground">
                                        {fullName ? fullName.charAt(0).toUpperCase() : "U"}
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                            >
                                <Camera className="w-4 h-4" />
                            </button>
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">{t("klikUpload")}</span>
                            {avatarUrl && (
                                <button onClick={handleRemoveAvatar} className="flex items-center gap-1 text-red-500 hover:text-red-600 cursor-pointer">
                                    <Trash2 className="w-3.5 h-3.5" /> {t("hapus")}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Name */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t("nama")}</label>
                        <input
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className={inputClass}
                            placeholder={t("namaPlaceholder")}
                        />
                    </div>

                    {/* Invoice Logo */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium">Logo Invoice</label>
                        <p className="text-xs text-muted-foreground -mt-1">Logo ini akan digunakan di invoice. Jika kosong, akan menggunakan nama studio.</p>
                        <div className="flex items-center gap-4">
                            <div className="w-32 h-16 rounded-lg border-2 border-dashed border-muted overflow-hidden bg-muted/30 flex items-center justify-center">
                                {invoiceLogoUrl ? (
                                    <img src={invoiceLogoUrl} alt="Logo" className="max-w-full max-h-full object-contain p-1" />
                                ) : (
                                    <ImagePlus className="w-6 h-6 text-muted-foreground" />
                                )}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} className="gap-1.5 cursor-pointer">
                                    <Camera className="w-3.5 h-3.5" /> {invoiceLogoUrl ? "Ganti Logo" : "Upload Logo"}
                                </Button>
                                {invoiceLogoUrl && (
                                    <button onClick={handleRemoveLogo} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 cursor-pointer">
                                        <Trash2 className="w-3 h-3" /> Hapus Logo
                                    </button>
                                )}
                            </div>
                            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                        </div>
                    </div>

                    {/* Email (readonly) */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t("email")}</label>
                        <input
                            value={email}
                            readOnly
                            className={`${inputClass} bg-muted/50 cursor-not-allowed`}
                        />
                        <p className="text-xs text-muted-foreground">{t("emailNote")}</p>
                    </div>

                    {/* Save */}
                    <Button onClick={handleSave} disabled={saving} className="w-full gap-2 h-11 text-base">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {t("simpan")}
                    </Button>
                    {savedMsg && <p className="text-center text-sm text-green-600 dark:text-green-400">{savedMsg}</p>}

                    {/* Reset Password */}
                    <Button variant="outline" onClick={handleResetPassword} className="w-full gap-2 h-11 text-base">
                        <Key className="w-4 h-4" />
                        {t("resetPassword")}
                    </Button>
                    {resetMsg && <p className="text-center text-sm text-muted-foreground">{resetMsg}</p>}
                </div>
            </div>
        </div>
    );
}
