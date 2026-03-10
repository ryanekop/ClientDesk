"use client";

import * as React from "react";
import { Camera, Trash2, Save, Key, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { useTranslations, useLocale } from "next-intl";
import { ImageCropModal } from "@/components/ui/image-crop-modal";
import Link from "next/link";

export default function ProfilePage() {
    const supabase = createClient();
    const t = useTranslations("Profile");
    const locale = useLocale();
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [savedMsg, setSavedMsg] = React.useState("");
    const [resetMsg, setResetMsg] = React.useState("");

    const [userId, setUserId] = React.useState("");
    const [fullName, setFullName] = React.useState("");
    const [email, setEmail] = React.useState("");
    const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
    const [subscription, setSubscription] = React.useState<{ tier: string; status: string; end_date: string | null; trial_end_date: string | null } | null>(null);

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Crop state
    const [cropSrc, setCropSrc] = React.useState<string | null>(null);
    const [showCrop, setShowCrop] = React.useState(false);

    React.useEffect(() => { fetchProfile(); }, []);

    async function fetchProfile() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setUserId(user.id);
        setEmail(user.email || "");

        // Fetch full_name first (always exists)
        const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .single();

        if (profile) {
            setFullName(profile.full_name || "");
        }

        // Try fetching avatar_url separately (column may not exist yet)
        try {
            const { data: avatarData } = await supabase
                .from("profiles")
                .select("avatar_url")
                .eq("id", user.id)
                .single();
            if (avatarData?.avatar_url) {
                setAvatarUrl(avatarData.avatar_url);
            }
        } catch {
            // avatar_url column doesn't exist yet — ignore
        }

        // Fetch subscription
        const { data: sub } = await supabase
            .from("subscriptions")
            .select("tier, status, end_date, trial_end_date")
            .eq("user_id", user.id)
            .single();
        setSubscription(sub);

        setLoading(false);
    }

    async function handleSave() {
        setSaving(true);
        const { error } = await supabase.from("profiles").update({
            full_name: fullName,
        }).eq("id", userId);

        if (error) {
            console.error("Save error:", error);
            setSavedMsg("Gagal menyimpan.");
        } else {
            // Also update auth user metadata so it persists
            await supabase.auth.updateUser({ data: { full_name: fullName } });
            setSavedMsg(t("berhasilSimpan"));
        }
        setTimeout(() => setSavedMsg(""), 3000);
        setSaving(false);
    }

    // When file selected, show crop modal
    function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            setCropSrc(reader.result as string);
            setShowCrop(true);
        };
        reader.readAsDataURL(file);
        e.target.value = ""; // reset so same file can be selected again
    }

    // After crop, save as base64 data URI
    async function handleCroppedAvatar(blob: Blob) {
        setShowCrop(false);
        setCropSrc(null);
        if (!userId) return;

        try {
            const reader = new FileReader();
            reader.onload = async () => {
                const base64 = reader.result as string;
                await supabase.from("profiles").update({
                    avatar_url: base64,
                }).eq("id", userId);
                setAvatarUrl(base64);
            };
            reader.readAsDataURL(blob);
        } catch {
            alert("Gagal menyimpan foto.");
        }
    }

    async function handleRemoveAvatar() {
        await supabase.from("profiles").update({
            avatar_url: null,
        }).eq("id", userId);
        setAvatarUrl(null);
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
                <div className="p-6 sm:p-8 space-y-5">
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
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />
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

                    {/* Email (readonly) */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t("email")}</label>
                        <input
                            value={email}
                            readOnly
                            className={`${inputClass} !bg-gray-100 dark:!bg-gray-800 text-muted-foreground cursor-not-allowed`}
                        />
                        <p className="text-xs text-muted-foreground">{t("emailNote")}</p>
                    </div>

                    {/* Status Membership */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t("statusMembership")}</label>
                        {subscription ? (() => {
                            const isLifetime = subscription.tier === 'lifetime';
                            const isPro = subscription.tier.startsWith('pro_') || isLifetime;
                            const isTrial = subscription.status === 'trial' || subscription.tier === 'free';
                            const expiryDate = isLifetime ? null : (subscription.end_date || subscription.trial_end_date);
                            const expiry = expiryDate ? new Date(expiryDate) : null;
                            const daysLeft = expiry ? Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / 86400000)) : null;
                            const isExpired = expiry ? expiry < new Date() : false;

                            const tierLabel = isLifetime ? t('tierLifetime') :
                                subscription.tier === 'pro_yearly' ? t('tierProYearly') :
                                    subscription.tier === 'pro_quarterly' ? t('tierProQuarterly') :
                                        subscription.tier === 'pro_monthly' ? t('tierProMonthly') :
                                            isTrial ? 'Trial' : 'Free';

                            const badgeBg = isPro
                                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                                : 'bg-muted text-muted-foreground border';
                            const badgeIcon = isLifetime ? '👑' : isPro ? '🔥' : '⏱️';

                            return (
                                <div className={`flex items-center justify-between rounded-lg border p-4 ${isExpired ? 'border-red-300 bg-red-50 dark:bg-red-950/20' : ''}`}>
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badgeBg}`}>
                                            {badgeIcon} {isPro ? 'Pro' : 'Trial'}
                                        </span>
                                        <div>
                                            <p className="text-sm font-medium">{tierLabel}</p>
                                            {isLifetime ? (
                                                <p className="text-xs text-muted-foreground">{t('berlakuSelamanya')}</p>
                                            ) : expiry ? (
                                                <p className={`text-xs ${isExpired ? 'text-red-500' : daysLeft !== null && daysLeft <= 7 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                                                    {isExpired
                                                        ? `⚠️ ${t('expired')}`
                                                        : `${t('berlakuSampai')}: ${expiry.toLocaleDateString(locale === 'en' ? 'en-US' : 'id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} (${daysLeft} ${t('hariLagi')})`
                                                    }
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>
                                    <Link href={`/${locale}/pricing`}>
                                        <Button size="sm" className="gap-1.5 text-xs">
                                            <RefreshCw className="w-3 h-3" /> {t('gantiPaket')}
                                        </Button>
                                    </Link>
                                </div>
                            );
                        })() : (
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <p className="text-sm text-muted-foreground">{t('noSubscription')}</p>
                                <Link href={`/${locale}/pricing`}>
                                    <Button size="sm" className="gap-1.5 text-xs">
                                        <RefreshCw className="w-3 h-3" /> {t('lihatPaket')}
                                    </Button>
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Messages */}
                    {savedMsg && <p className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 rounded-lg px-4 py-3">{savedMsg}</p>}
                    {resetMsg && <p className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 rounded-lg px-4 py-3">{resetMsg}</p>}

                    {/* Save */}
                    <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3">
                        <Button onClick={handleSave} disabled={saving} className="gap-2 h-9 text-sm">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {t("simpan")}
                        </Button>
                        <Button variant="outline" onClick={handleResetPassword} className="gap-2 h-9 text-sm">
                            <Key className="w-4 h-4" />
                            {t("resetPassword")}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Avatar Crop Modal */}
            {cropSrc && (
                <ImageCropModal
                    open={showCrop}
                    imageSrc={cropSrc}
                    title="Crop Foto Profil"
                    aspect={1}
                    cropShape="round"
                    onClose={() => { setShowCrop(false); setCropSrc(null); }}
                    onCropComplete={handleCroppedAvatar}
                />
            )}
        </div>
    );
}
