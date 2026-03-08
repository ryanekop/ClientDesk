"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { ExternalLink, Copy, ClipboardCheck, Eye, Loader2, Globe, Percent, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";

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

    const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
    const formUrl = vendorSlug ? `${siteUrl}/${locale}/book/${vendorSlug}` : "";

    React.useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: p } = await supabase
                .from("profiles")
                .select("id, studio_name, vendor_slug, min_dp_percent")
                .eq("id", user.id)
                .single();

            if (p) {
                setProfileId(p.id);
                setStudioName(p.studio_name || "");
                setVendorSlug(p.vendor_slug || "");
                setMinDpPercent(p.min_dp_percent ?? 50);
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
        }).eq("id", profileId);

        setVendorSlug(slug);
        setSavedMsg("Tersimpan!");
        setTimeout(() => setSavedMsg(""), 3000);
        setSaving(false);
    }

    function copyUrl() {
        navigator.clipboard.writeText(formUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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
        <div className="space-y-6 max-w-3xl">
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

            {/* Settings */}
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                <div className="px-6 py-4 border-b">
                    <h3 className="font-semibold">Pengaturan Form</h3>
                    <p className="text-sm text-muted-foreground">Kustomisasi URL dan pengaturan pembayaran.</p>
                </div>
                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Custom URL</label>
                        <input
                            value={vendorSlug}
                            onChange={e => setVendorSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                            placeholder={studioName?.toLowerCase().replace(/[^a-z0-9]/g, "-") || "nama-vendor"}
                            className={inputClass}
                        />
                        <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md font-mono break-all">
                            {siteUrl}/{locale}/book/<span className="text-primary font-semibold">{vendorSlug || "nama-vendor"}</span>
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
                        <p className="text-xs text-muted-foreground">
                            Klien wajib bayar minimal {minDpPercent}% dari harga paket saat booking via form publik.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <Button onClick={handleSave} disabled={saving} className="gap-2">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            Simpan Pengaturan
                        </Button>
                        {savedMsg && <span className="text-sm text-green-600 dark:text-green-400">{savedMsg}</span>}
                    </div>
                </div>
            </div>

            {/* Preview */}
            {vendorSlug && (
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold flex items-center gap-2"><Eye className="w-4 h-4" /> Preview</h3>
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.open(formUrl, "_blank")}>
                            <ExternalLink className="w-3.5 h-3.5" /> Buka Form
                        </Button>
                    </div>
                    <div className="aspect-[9/16] sm:aspect-[3/4] max-h-[500px] rounded-lg overflow-hidden border bg-muted">
                        <iframe
                            src={formUrl}
                            className="w-full h-full"
                            title="Form Preview"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
