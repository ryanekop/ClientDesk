"use client";

import * as React from "react";
import { Camera, Trash2, Save, Key, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionFeedbackDialog } from "@/components/ui/action-feedback-dialog";
import { createClient } from "@/utils/supabase/client";
import { useTranslations, useLocale } from "next-intl";
import { ImageCropModal } from "@/components/ui/image-crop-modal";
import Link from "next/link";
import { createImplicitClient } from "@/utils/supabase/implicit-client";
import { optimizePngBlobForUpload } from "@/utils/optimize-png-blob";

function extractMissingColumnFromSupabaseError(
    error: { message?: string; details?: string; hint?: string } | null,
) {
    const messages = [error?.message, error?.details, error?.hint].filter(
        (value): value is string => Boolean(value),
    );

    for (const message of messages) {
        const schemaCacheMatch = message.match(/Could not find the '([^']+)' column/i);
        if (schemaCacheMatch?.[1]) {
            return schemaCacheMatch[1];
        }

        const postgresMatch = message.match(
            /column\s+["']?(?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)["']?\s+does not exist/i,
        );
        if (postgresMatch?.[1]) {
            return postgresMatch[1];
        }
    }

    return null;
}

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
    const [feedbackDialog, setFeedbackDialog] = React.useState<{
        open: boolean;
        title: string;
        message: string;
    }>({ open: false, title: "", message: "" });

    const showFeedback = React.useCallback((message: string, title?: string) => {
        setFeedbackDialog({
            open: true,
            title: title || t("infoTitle"),
            message,
        });
    }, [t]);

    React.useEffect(() => { fetchProfile(); }, []);

    const ensureProfileRecord = React.useEffectEvent(async () => {
        const response = await fetch("/api/profile/ensure", { method: "POST" });
        if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.error || t("failedPrepareProfile"));
        }
    });

    const invalidateProfilePublicCache = React.useEffectEvent(async () => {
        try {
            await fetch("/api/internal/cache/invalidate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scope: "profile" }),
            });
        } catch {
            // Best effort cache invalidation.
        }
    });

    const saveProfilePatch = React.useEffectEvent(async (patch: Record<string, unknown>) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            throw new Error(t("userNotFound"));
        }

        await ensureProfileRecord();
        const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);

        if (error) {
            throw error;
        }

        await invalidateProfilePublicCache();
    });

    async function fetchProfile() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setLoading(false);
            return;
        }

        await ensureProfileRecord();

        setUserId(user.id);
        setEmail(user.email || "");

        const loadProfilePromise = (async () => {
            const selectColumns = ["full_name", "avatar_url"];

            while (selectColumns.length > 0) {
                const { data, error } = await supabase
                    .from("profiles")
                    .select(selectColumns.join(", "))
                    .eq("id", user.id)
                    .single();

                if (!error) {
                    return data as { full_name?: string | null; avatar_url?: string | null } | null;
                }

                const missingColumn = extractMissingColumnFromSupabaseError(error);
                if (missingColumn && selectColumns.includes(missingColumn)) {
                    const nextColumns = selectColumns.filter((column) => column !== missingColumn);
                    selectColumns.splice(0, selectColumns.length, ...nextColumns);
                    continue;
                }

                return null;
            }

            return null;
        })();

        const subscriptionPromise = supabase
            .from("subscriptions")
            .select("tier, status, end_date, trial_end_date")
            .eq("user_id", user.id)
            .single();

        const [profile, { data: sub }] = await Promise.all([
            loadProfilePromise,
            subscriptionPromise,
        ]);

        setFullName(profile?.full_name || String(user.user_metadata?.full_name || user.email?.split("@")[0] || ""));
        setAvatarUrl(profile?.avatar_url || null);
        setSubscription(sub);

        setLoading(false);
    }

    async function handleSave() {
        setSaving(true);
        try {
            await saveProfilePatch({
                full_name: fullName,
            });
            await supabase.auth.updateUser({ data: { full_name: fullName } });
            setSavedMsg(t("berhasilSimpan"));
        } catch (error) {
            console.error("Save error:", error);
            setSavedMsg(t("failedSave"));
        } finally {
            setTimeout(() => setSavedMsg(""), 3000);
            setSaving(false);
        }
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

    // After crop, upload to public storage and save URL in profile
    async function handleCroppedAvatar(blob: Blob) {
        setShowCrop(false);
        setCropSrc(null);
        if (!userId) return;

        try {
            const optimizedBlob = await optimizePngBlobForUpload(blob, {
                maxBytes: 1024 * 1024,
                maxDimension: 1600,
                minDimension: 256,
            }).catch(() => {
                throw new Error(t("failedSavePhoto"));
            });
            const extension = optimizedBlob.type === "image/png" ? "png" : "jpg";
            const uploadFile = new File(
                [optimizedBlob],
                `avatar-${Date.now()}.${extension}`,
                { type: optimizedBlob.type || "image/png" },
            );
            const formData = new FormData();
            formData.append("assetType", "avatar");
            formData.append("file", uploadFile);

            const response = await fetch("/api/profile/branding-upload", {
                method: "POST",
                body: formData,
            });
            const payload = (await response.json().catch(() => null)) as
                | { success?: boolean; url?: string; error?: string }
                | null;

            if (!response.ok || !payload?.url) {
                throw new Error(payload?.error || t("failedSavePhoto"));
            }

            setAvatarUrl(payload.url);
        } catch (error) {
            const errorMessage =
                error instanceof Error && error.message
                    ? error.message
                    : t("failedSavePhoto");
            showFeedback(errorMessage);
        }
    }

    async function handleRemoveAvatar() {
        await saveProfilePatch({
            avatar_url: null,
        });
        setAvatarUrl(null);
    }

    async function handleResetPassword() {
        const implicitSupabase = createImplicitClient();
        const siteUrl = window.location.origin || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
        const { error } = await implicitSupabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${siteUrl}/${locale}/auth/callback?type=recovery`,
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

            <ActionFeedbackDialog
                open={feedbackDialog.open}
                onOpenChange={(open) =>
                    setFeedbackDialog((prev) => ({ ...prev, open }))
                }
                title={feedbackDialog.title}
                message={feedbackDialog.message}
                confirmLabel="OK"
            />
        </div>
    );
}
