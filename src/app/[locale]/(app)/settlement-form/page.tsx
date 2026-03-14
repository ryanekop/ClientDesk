"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import {
  ClipboardCheck,
  Copy,
  CreditCard,
  Eye,
  ExternalLink,
  Globe,
  Loader2,
  Palette,
  QrCode,
  RefreshCw,
  Banknote,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import {
  getEnabledBankAccounts,
  normalizePaymentMethods,
  type PaymentMethod,
} from "@/lib/payment-config";

type PreviewPayload = {
  studio_name: string | null;
  settlement_form_brand_color: string;
  settlement_form_greeting: string | null;
  settlement_form_payment_methods: PaymentMethod[];
};

type SettingsSnapshot = {
  settlement_form_brand_color: string;
  settlement_form_greeting: string;
  settlement_form_payment_methods: PaymentMethod[];
  settlement_form_lang: string;
};

const DEFAULTS = {
  brandColor: "#10b981",
  greeting: "",
  paymentMethods: ["bank"] as PaymentMethod[],
  lang: "id",
};

function createSnapshot(input: SettingsSnapshot): SettingsSnapshot {
  return {
    settlement_form_brand_color: input.settlement_form_brand_color,
    settlement_form_greeting: input.settlement_form_greeting,
    settlement_form_payment_methods: input.settlement_form_payment_methods,
    settlement_form_lang: input.settlement_form_lang,
  };
}

export default function SettlementFormPage() {
  const supabase = React.useMemo(() => createClient(), []);
  const locale = useLocale();
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [savedMsg, setSavedMsg] = React.useState("");
  const [profileId, setProfileId] = React.useState("");
  const [studioName, setStudioName] = React.useState("");
  const [siteUrl, setSiteUrl] = React.useState("");
  const [sampleTrackingUuid, setSampleTrackingUuid] = React.useState("");
  const [sampleClientName, setSampleClientName] = React.useState("");
  const [sampleBookingCode, setSampleBookingCode] = React.useState("");
  const [lastSavedSnapshot, setLastSavedSnapshot] = React.useState<string | null>(null);
  const [iframeKey, setIframeKey] = React.useState(0);
  const [mobileTab, setMobileTab] = React.useState<"settings" | "preview">(
    "settings",
  );

  const [brandColor, setBrandColor] = React.useState(DEFAULTS.brandColor);
  const [greeting, setGreeting] = React.useState(DEFAULTS.greeting);
  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>(
    DEFAULTS.paymentMethods,
  );
  const [settlementFormLang, setSettlementFormLang] = React.useState(DEFAULTS.lang);
  const [enabledBankCount, setEnabledBankCount] = React.useState(0);
  const [hasQris, setHasQris] = React.useState(false);

  React.useEffect(() => {
    setSiteUrl(window.location.origin);
  }, []);

  React.useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: profile }, { data: bookingRows }] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, studio_name, bank_accounts, qris_image_url, qris_drive_file_id, settlement_form_brand_color, settlement_form_greeting, settlement_form_payment_methods, settlement_form_lang, form_payment_methods",
          )
          .eq("id", user.id)
          .single(),
        supabase
          .from("bookings")
          .select("tracking_uuid, client_name, booking_code")
          .eq("user_id", user.id)
          .not("tracking_uuid", "is", null)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      if (profile) {
        setProfileId(profile.id);
        setStudioName(profile.studio_name || "");
        setBrandColor(
          profile.settlement_form_brand_color || DEFAULTS.brandColor,
        );
        setGreeting(profile.settlement_form_greeting || DEFAULTS.greeting);
        const loadedMethods = normalizePaymentMethods(
          profile.settlement_form_payment_methods ??
            profile.form_payment_methods ??
            DEFAULTS.paymentMethods,
        );
        setPaymentMethods(loadedMethods);
        setSettlementFormLang(profile.settlement_form_lang || DEFAULTS.lang);
        setEnabledBankCount(
          getEnabledBankAccounts(profile.bank_accounts || []).length,
        );
        setHasQris(
          Boolean(profile.qris_drive_file_id || profile.qris_image_url),
        );
        setLastSavedSnapshot(
          JSON.stringify(
            createSnapshot({
              settlement_form_brand_color:
                profile.settlement_form_brand_color || DEFAULTS.brandColor,
              settlement_form_greeting:
                profile.settlement_form_greeting || DEFAULTS.greeting,
              settlement_form_payment_methods: loadedMethods,
              settlement_form_lang: profile.settlement_form_lang || DEFAULTS.lang,
            }),
          ),
        );
      }

      const sample = bookingRows?.[0];
      if (sample?.tracking_uuid) {
        setSampleTrackingUuid(sample.tracking_uuid);
        setSampleClientName(sample.client_name || "");
        setSampleBookingCode(sample.booking_code || "");
      }

      setLoading(false);
    }

    load();
  }, [supabase]);

  const previewStorageKey = React.useMemo(
    () => (sampleTrackingUuid ? `clientdesk:settlement-preview:${sampleTrackingUuid}` : ""),
    [sampleTrackingUuid],
  );
  const previewPayload = React.useMemo<PreviewPayload>(
    () => ({
      studio_name: studioName || null,
      settlement_form_brand_color: brandColor,
      settlement_form_greeting: greeting || null,
      settlement_form_payment_methods: paymentMethods,
    }),
    [brandColor, greeting, paymentMethods, studioName],
  );
  const settlementPath = sampleTrackingUuid
    ? `/${settlementFormLang}/settlement/${sampleTrackingUuid}`
    : "";
  const settlementUrl = settlementPath ? `${siteUrl}${settlementPath}` : "";
  const previewPath = sampleTrackingUuid && previewStorageKey
    ? `${settlementPath}?preview=1&previewKey=${encodeURIComponent(previewStorageKey)}`
    : "";

  React.useEffect(() => {
    if (typeof window === "undefined" || !previewStorageKey) return;
    window.localStorage.setItem(previewStorageKey, JSON.stringify(previewPayload));
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: "clientdesk:settlement-preview-update",
        previewKey: previewStorageKey,
        payload: previewPayload,
      },
      window.location.origin,
    );
  }, [previewPayload, previewStorageKey]);

  const draftSnapshot = React.useMemo(
    () =>
      createSnapshot({
        settlement_form_brand_color: brandColor,
        settlement_form_greeting: greeting,
        settlement_form_payment_methods: paymentMethods,
        settlement_form_lang: settlementFormLang,
      }),
    [brandColor, greeting, paymentMethods, settlementFormLang],
  );
  const hasUnsavedChanges =
    !loading &&
    lastSavedSnapshot !== null &&
    JSON.stringify(draftSnapshot) !== lastSavedSnapshot;

  function togglePaymentMethod(method: PaymentMethod) {
    setPaymentMethods((prev) =>
      prev.includes(method)
        ? prev.filter((item) => item !== method)
        : [...prev, method],
    );
  }

  async function handleSave() {
    if (!profileId) return;
    if (paymentMethods.length === 0) {
      setSavedMsg("Pilih minimal satu metode pembayaran.");
      return;
    }
    if (paymentMethods.includes("bank") && enabledBankCount === 0) {
      setSavedMsg("Belum ada rekening bank aktif. Atur dulu di Form Booking.");
      return;
    }
    if (paymentMethods.includes("qris") && !hasQris) {
      setSavedMsg("QRIS belum tersedia. Upload dulu di Form Booking.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        settlement_form_brand_color: brandColor,
        settlement_form_greeting: greeting || null,
        settlement_form_payment_methods: paymentMethods,
        settlement_form_lang: settlementFormLang,
      })
      .eq("id", profileId);
    setSaving(false);

    if (error) {
      setSavedMsg("Gagal menyimpan.");
      return;
    }

    const next = JSON.stringify(draftSnapshot);
    setLastSavedSnapshot(next);
    setSavedMsg("Tersimpan!");
    setIframeKey((prev) => prev + 1);
    setTimeout(() => setSavedMsg(""), 3000);
  }

  function copyUrl() {
    if (!settlementUrl) return;
    navigator.clipboard.writeText(settlementUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const inputClass =
    "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Form Pelunasan</h2>
        <p className="text-muted-foreground">
          Atur tampilan form pelunasan publik dan preview halaman yang akan dibuka klien.
        </p>
      </div>

      {!sampleTrackingUuid && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Belum ada booking dengan tracking link untuk dipakai sebagai preview. Buat satu booking dulu, lalu buka halaman ini lagi.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-start">
        <div className={`space-y-6 ${mobileTab === "preview" ? "hidden lg:block" : ""}`}>
          <div className="rounded-xl border bg-card shadow-sm">
            <div className="border-b px-6 py-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Palette className="w-4 h-4" /> Kustomisasi Tampilan
              </h3>
            </div>
            <div className="space-y-4 p-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Warna Brand</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="h-10 w-10 rounded-lg border cursor-pointer p-0.5"
                  />
                  <input
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className={inputClass + " !w-32"}
                  />
                  <div
                    className="h-9 w-24 rounded-md border"
                    style={{ backgroundColor: brandColor }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Teks Sapaan</label>
                <input
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  placeholder="Silakan lanjutkan pelunasan booking Anda."
                  className={inputClass}
                />
                <p className="text-xs text-muted-foreground">
                  Teks ini tampil di bagian atas form pelunasan.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> Bahasa Form
                </label>
                <select
                  value={settlementFormLang}
                  onChange={(e) => setSettlementFormLang(e.target.value)}
                  className={inputClass + " cursor-pointer"}
                >
                  <option value="id">🇮🇩 Bahasa Indonesia</option>
                  <option value="en">🇬🇧 English</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card shadow-sm">
            <div className="border-b px-6 py-4">
              <h3 className="font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Metode Pembayaran
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Sumber rekening bank dan QRIS tetap memakai data yang sudah diatur di halaman Form Booking.
              </p>
            </div>
            <div className="space-y-3 p-6">
              {[
                {
                  id: "bank" as PaymentMethod,
                  title: "Transfer Bank",
                  description:
                    enabledBankCount > 0
                      ? `${enabledBankCount} rekening aktif`
                      : "Belum ada rekening aktif",
                  icon: CreditCard,
                },
                {
                  id: "qris" as PaymentMethod,
                  title: "QRIS",
                  description: hasQris
                    ? "QRIS tersedia"
                    : "QRIS belum tersedia",
                  icon: QrCode,
                },
                {
                  id: "cash" as PaymentMethod,
                  title: "Cash",
                  description: "Pelunasan tunai diverifikasi admin",
                  icon: Banknote,
                },
              ].map((method) => {
                const Icon = method.icon;
                const active = paymentMethods.includes(method.id);
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => togglePaymentMethod(method.id)}
                    className={`w-full rounded-xl border p-4 text-left transition-all ${
                      active ? "border-primary bg-primary/5 shadow-sm" : "border-input hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                            active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{method.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {method.description}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`mt-1 h-5 w-5 rounded-full border ${
                          active ? "border-primary bg-primary" : "border-muted-foreground/30"
                        }`}
                      />
                    </div>
                  </button>
                );
              })}

              <p className="text-xs text-muted-foreground">
                Butuh edit rekening bank atau QRIS? Buka halaman{" "}
                <a href={`/${locale}/form-booking`} className="underline">
                  Form Booking
                </a>
                .
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Simpan Pengaturan
            </Button>
            {savedMsg ? (
              <span className="text-sm text-green-600 dark:text-green-400">
                {savedMsg}
              </span>
            ) : null}
            {hasUnsavedChanges ? (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                Ada perubahan yang belum disimpan.
              </span>
            ) : null}
          </div>
        </div>

        <div
          className={`sticky top-4 ${mobileTab === "settings" ? "hidden lg:flex" : "flex"}`}
          style={{ height: "calc(100vh - 12rem)", maxHeight: "calc(100vh - 12rem)" }}
        >
          <div className="flex w-full flex-col">
            <div className="mb-3 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground">Preview</h3>
                {sampleTrackingUuid ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    Sample booking: {sampleClientName || "-"} {sampleBookingCode ? `· ${sampleBookingCode}` : ""}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIframeKey((prev) => prev + 1)}
                  title="Refresh"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
                {settlementUrl ? (
                  <>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyUrl} title="Salin URL">
                      {copied ? (
                        <ClipboardCheck className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => window.open(settlementUrl, "_blank")}
                      title="Buka di tab baru"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </>
                ) : null}
              </div>
            </div>

            {previewPath ? (
              <div className="flex flex-1 min-h-0 justify-center">
                <div className="flex w-full max-w-[380px] min-h-0 flex-col">
                  <div className="flex items-center gap-2 rounded-t-2xl border border-b-0 bg-muted/80 px-4 py-2.5 shrink-0">
                    <div className="flex gap-1">
                      <div className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
                      <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/60" />
                      <div className="h-2.5 w-2.5 rounded-full bg-green-400/60" />
                    </div>
                    <div className="min-w-0 flex-1 text-center">
                      <span className="block w-full truncate overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-muted-foreground">
                        {settlementUrl.replace(/^https?:\/\//, "")}
                      </span>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-hidden rounded-b-2xl border border-t-0 bg-background">
                    <iframe
                      ref={iframeRef}
                      key={iframeKey}
                      src={previewPath}
                      className="h-full w-full"
                      title="Settlement Preview"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
                Preview akan muncul setelah ada booking yang punya tracking link.
              </div>
            )}
          </div>
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
            onClick={() => {
              setMobileTab("preview");
              setIframeKey((prev) => prev + 1);
            }}
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
