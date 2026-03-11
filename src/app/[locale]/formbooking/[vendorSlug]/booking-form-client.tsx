"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  Loader2,
  CheckCircle2,
  Upload,
  CalendarDays,
  MapPin,
  Camera,
  MessageCircle,
  CreditCard,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { compressImage } from "@/utils/compress-image";
import { LocationAutocomplete } from "@/components/ui/location-autocomplete";
import { useTranslations } from "next-intl";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Service = {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  description: string | null;
  event_types: string[] | null;
};

export type Vendor = {
  id: string;
  studio_name: string | null;
  whatsapp_number: string | null;
  min_dp_percent: number | null;
  min_dp_map: Record<string, number> | null;
  avatar_url: string | null;
  invoice_logo_url: string | null;
  form_brand_color: string;
  form_greeting: string | null;
  form_event_types: string[] | null;
  form_show_location: boolean;
  form_show_notes: boolean;
  form_show_proof: boolean;
  bank_accounts: {
    bank_name: string;
    account_number: string;
    account_name: string;
  }[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  "Umum",
  "Wedding",
  "Akad",
  "Resepsi",
  "Wisuda",
  "Maternity",
  "Newborn",
  "Family",
  "Komersil",
  "Lamaran",
  "Prewedding",
  "Lainnya",
];

const EXTRA_FIELDS: Record<
  string,
  {
    key: string;
    label: string;
    isLocation?: boolean;
    fullWidth?: boolean;
    required?: boolean;
  }[]
> = {
  Wisuda: [
    { key: "universitas", label: "Universitas" },
    { key: "fakultas", label: "Fakultas" },
  ],
  Wedding: [
    {
      key: "nama_pasangan",
      label: "Nama Pasangan",
      fullWidth: true,
      required: true,
    },
    { key: "jumlah_tamu", label: "Estimasi Tamu", fullWidth: true },
    {
      key: "tempat_akad",
      label: "Lokasi Akad",
      isLocation: true,
      required: true,
    },
    {
      key: "tempat_resepsi",
      label: "Lokasi Resepsi",
      isLocation: true,
      required: true,
    },
  ],
  Akad: [
    {
      key: "nama_pasangan",
      label: "Nama Pasangan",
      fullWidth: true,
      required: true,
    },
    { key: "jumlah_tamu", label: "Estimasi Tamu", fullWidth: true },
  ],
  Resepsi: [
    {
      key: "nama_pasangan",
      label: "Nama Pasangan",
      fullWidth: true,
      required: true,
    },
    { key: "jumlah_tamu", label: "Estimasi Tamu", fullWidth: true },
  ],
  Lamaran: [
    {
      key: "nama_pasangan",
      label: "Nama Pasangan",
      fullWidth: true,
      required: true,
    },
    { key: "jumlah_tamu", label: "Estimasi Tamu", fullWidth: true },
  ],
  Prewedding: [
    {
      key: "nama_pasangan",
      label: "Nama Pasangan",
      fullWidth: true,
      required: true,
    },
  ],
  Maternity: [{ key: "usia_kandungan", label: "Usia Kandungan (bulan)" }],
  Newborn: [{ key: "nama_bayi", label: "Nama Bayi" }],
  Komersil: [{ key: "tipe_konten", label: "Tipe Konten" }],
  Family: [{ key: "jumlah_anggota", label: "Jumlah Anggota" }],
};

const COUNTRY_CODES = [
  { code: "+62", flag: "🇮🇩", name: "Indonesia" },
  { code: "+60", flag: "🇲🇾", name: "Malaysia" },
  { code: "+65", flag: "🇸🇬", name: "Singapore" },
  { code: "+66", flag: "🇹🇭", name: "Thailand" },
  { code: "+63", flag: "🇵🇭", name: "Philippines" },
  { code: "+84", flag: "🇻🇳", name: "Vietnam" },
  { code: "+95", flag: "🇲🇲", name: "Myanmar" },
  { code: "+856", flag: "🇱🇦", name: "Laos" },
  { code: "+855", flag: "🇰🇭", name: "Cambodia" },
  { code: "+673", flag: "🇧🇳", name: "Brunei" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

function formatNumber(n: number | ""): string {
  if (n === "" || n === 0) return "";
  return new Intl.NumberFormat("id-ID").format(n);
}

function parseFormatted(s: string): number | "" {
  const cleaned = s.replace(/\./g, "").replace(/,/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? "" : num;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BookingFormClientProps {
  vendor: Vendor;
  services: Service[];
}

export function BookingFormClient({
  vendor,
  services,
}: BookingFormClientProps) {
  const params = useParams();
  const slug = params?.vendorSlug as string;
  const supabase = createClient();
  const t = useTranslations("BookingForm");

  // ── Submission state ──
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [resultData, setResultData] = React.useState<{
    bookingCode?: string;
    vendorWhatsapp?: string;
    vendorName?: string;
  } | null>(null);

  // ── Form state ──
  const [clientName, setClientName] = React.useState("");
  const [countryCode, setCountryCode] = React.useState("+62");
  const [phone, setPhone] = React.useState("");
  const [eventType, setEventType] = React.useState("");
  const [sessionDate, setSessionDate] = React.useState("");
  const [serviceId, setServiceId] = React.useState("");
  const [selectedService, setSelectedService] = React.useState<Service | null>(
    null,
  );
  const [dpDisplay, setDpDisplay] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [locationDetail, setLocationDetail] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [instagram, setInstagram] = React.useState("");
  const [extraData, setExtraData] = React.useState<Record<string, string>>({});
  const [proofFile, setProofFile] = React.useState<File | null>(null);
  const [proofPreview, setProofPreview] = React.useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = React.useState(false);
  const [error, setError] = React.useState("");

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // ── Helpers ──

  function getMinDpForEvent(et?: string): number {
    const eventKey = et ?? eventType;
    if (
      eventKey &&
      vendor.min_dp_map &&
      vendor.min_dp_map[eventKey] !== undefined
    ) {
      return vendor.min_dp_map[eventKey];
    }
    return vendor.min_dp_percent ?? 50;
  }

  function handleServiceChange(id: string) {
    setServiceId(id);
    const svc = services.find((s) => s.id === id) ?? null;
    setSelectedService(svc);
    if (svc) {
      const minDP = getMinDpForEvent();
      const minAmount = Math.ceil((svc.price * minDP) / 100);
      setDpDisplay(formatNumber(minAmount));
    } else {
      setDpDisplay("");
    }
  }

  function handleProofFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = () => setProofPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (
      !clientName ||
      !phone ||
      !sessionDate ||
      !serviceId ||
      (!location && eventType !== "Wedding")
    ) {
      setError(t("errorWajib"));
      return;
    }

    if (
      eventType === "Wedding" &&
      (!extraData.tempat_akad || !extraData.tempat_resepsi)
    ) {
      setError(t("errorLokasiWedding"));
      return;
    }

    const fullPhone = `${countryCode}${phone}`.replace(/[^0-9+]/g, "");
    const dpValue = parseFormatted(dpDisplay) || 0;
    const finalLocation =
      eventType === "Wedding"
        ? extraData.tempat_akad || extraData.tempat_resepsi || location
        : location;

    const minDP = getMinDpForEvent();
    if (selectedService) {
      const minAmount = Math.ceil((selectedService.price * minDP) / 100);
      if (dpValue < minAmount) {
        setError(
          t("errorDPMin", {
            percent: String(minDP),
            amount: formatCurrency(minAmount),
          }),
        );
        return;
      }
    }

    setSubmitting(true);

    // Upload bukti pembayaran jika ada
    let paymentProofUrl: string | null = null;
    if (proofFile) {
      setUploadingProof(true);
      try {
        const compressed = proofFile.type.startsWith("image/")
          ? await compressImage(proofFile, 1200, 0.7)
          : proofFile;
        const ext = proofFile.type.startsWith("image/")
          ? "jpg"
          : proofFile.name.split(".").pop();
        const path = `payment-proofs/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("payment-proofs")
          .upload(path, compressed, {
            upsert: false,
            contentType: proofFile.type.startsWith("image/")
              ? "image/jpeg"
              : proofFile.type,
          });

        if (uploadErr) {
          setError(t("errorUpload") + uploadErr.message);
          setSubmitting(false);
          setUploadingProof(false);
          return;
        }
        const { data: publicUrl } = supabase.storage
          .from("payment-proofs")
          .getPublicUrl(path);
        paymentProofUrl = publicUrl.publicUrl;
      } catch {
        setError(t("errorCompress"));
        setSubmitting(false);
        setUploadingProof(false);
        return;
      }
      setUploadingProof(false);
    }

    try {
      const res = await fetch("/api/public/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorSlug: slug,
          clientName,
          clientWhatsapp: fullPhone,
          eventType: eventType || null,
          sessionDate,
          serviceId,
          totalPrice: selectedService?.price || 0,
          dpPaid: dpValue,
          location: finalLocation || null,
          locationDetail: locationDetail || null,
          notes: notes || null,
          extraData: Object.keys(extraData).length > 0 ? extraData : null,
          paymentProofUrl,
          instagram: instagram || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        setResultData(data);
      } else {
        setError(data.error || "Gagal mengirim booking.");
      }
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    }
    setSubmitting(false);
  }

  function openWhatsAppConfirmation() {
    if (!resultData?.vendorWhatsapp) return;
    const wa = resultData.vendorWhatsapp
      .replace(/^0/, "62")
      .replace(/[^0-9]/g, "");
    const svcName = selectedService?.name || "-";
    const dateStr = sessionDate
      ? new Date(sessionDate).toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "-";
    const dpVal = parseFormatted(dpDisplay) || 0;

    const msg =
      `Halo ${resultData.vendorName || "Admin"}, saya baru saja booking melalui form online.\n\n` +
      `📋 *Detail Booking*\n` +
      `Kode: *${resultData.bookingCode}*\n` +
      `Nama: ${clientName}\n` +
      `Paket: ${svcName}\n` +
      `Jadwal: ${dateStr}\n` +
      (location ? `Lokasi: ${location}\n` : "") +
      `\n💰 Total: ${formatCurrency(selectedService?.price || 0)}\n` +
      `✅ DP: ${formatCurrency(dpVal)}\n` +
      (proofFile ? "📎 Bukti transfer sudah diupload.\n" : "") +
      (instagram ? `📸 Instagram: ${instagram}\n` : "") +
      `\nMohon konfirmasi booking saya. Terima kasih! 🙏`;

    window.open(
      `https://api.whatsapp.com/send?phone=${wa}&text=${encodeURIComponent(msg)}`,
      "_blank",
    );
  }

  // ── Styles ──

  const inputClass =
    "placeholder:text-muted-foreground h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] transition-all";
  const selectClass =
    inputClass +
    " cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23999%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat pr-8";

  const minDP = getMinDpForEvent();
  const currentExtraFields = EXTRA_FIELDS[eventType] || [];
  const brandColor = vendor.form_brand_color || "#000000";
  const availableEventTypes = vendor.form_event_types?.length
    ? vendor.form_event_types
    : EVENT_TYPES;

  // Filter services by selected event type
  const filteredServices = eventType
    ? services.filter(s => !s.event_types || s.event_types.length === 0 || s.event_types.includes(eventType))
    : services;

  // ── Success screen ──

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 px-4">
        <div className="text-center space-y-6 max-w-md mx-auto">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-500/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">{t("booking Berhasil")}</h2>
            <p className="text-muted-foreground text-sm">{t("kodeBooking")}</p>
            <p className="text-3xl font-bold text-primary mt-1">
              {resultData?.bookingCode}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">{t("konfirmasiWA")}</p>
          <button
            onClick={openWhatsAppConfirmation}
            className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20 cursor-pointer text-base"
          >
            <MessageCircle className="w-5 h-5" />
            {t("konfirmasiViaWA")}
          </button>
        </div>
      </div>
    );
  }

  // ── Form ──

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-8 sm:py-12 px-4">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Vendor Header */}
        <div className="text-center space-y-3">
          <div className="w-20 h-20 bg-background border-2 rounded-full mx-auto flex items-center justify-center font-bold text-2xl shadow-sm overflow-hidden">
            {vendor.invoice_logo_url ? (
              <img
                src={vendor.invoice_logo_url}
                alt="Logo"
                className="w-full h-full object-contain p-1"
              />
            ) : vendor.avatar_url ? (
              <img
                src={vendor.avatar_url}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              vendor.studio_name?.charAt(0)?.toUpperCase() || "V"
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {vendor.studio_name || "Studio"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {vendor.form_greeting || t("greetingDefault")}
            </p>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-background rounded-2xl shadow-lg border p-6 sm:p-8 space-y-5"
        >
          {/* Client Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {t("infoKlien")}
            </h3>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t("namaLengkap")} <span className="text-red-500">*</span>
              </label>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder={t("namaPlaceholder")}
                className={inputClass}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t("nomorWhatsapp")} <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className={selectClass + " !w-28 shrink-0"}
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
                <input
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, "");
                    setPhone(
                      val.startsWith("0")
                        ? val.slice(1)
                        : val.startsWith("62")
                          ? val.slice(2)
                          : val,
                    );
                  }}
                  placeholder="8123456789"
                  className={inputClass}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Instagram
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                <input
                  value={instagram}
                  onChange={(e) => {
                    const val = e.target.value.replace(/^@/, "");
                    setInstagram(val);
                  }}
                  placeholder="username"
                  className={inputClass + " pl-7"}
                />
              </div>
            </div>
          </div>

          {/* Session Details */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" />
              {t("detailSesi")}
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="col-span-full space-y-1.5">
                <label className="text-sm font-medium">
                  {t("tipeAcara")} <span className="text-red-500">*</span>
                </label>
                <select
                  value={eventType}
                  onChange={(e) => {
                    setEventType(e.target.value);
                    setExtraData({});
                    // Reset service selection when event type changes (package may be filtered out)
                    setServiceId("");
                    setSelectedService(null);
                    setDpDisplay("");
                    if (selectedService) {
                      const newMinDP = getMinDpForEvent(e.target.value);
                      const minAmount = Math.ceil(
                        (selectedService.price * newMinDP) / 100,
                      );
                      setDpDisplay(formatNumber(minAmount));
                    }
                  }}
                  className={selectClass}
                  required
                >
                  <option value="">{t("pilihTipe")}</option>
                  {availableEventTypes.map((et) => (
                    <option key={et} value={et}>
                      {et}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {t("jadwalSesi")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={sessionDate ? sessionDate.split("T")[0] : ""}
                  onChange={(e) => {
                    const timePart = sessionDate?.split("T")[1] || "10:00";
                    setSessionDate(e.target.value ? `${e.target.value}T${timePart}` : "");
                  }}
                  className={inputClass}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {t("jam") || "Jam"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={sessionDate ? sessionDate.split("T")[1] || "10:00" : ""}
                  onChange={(e) => {
                    const datePart = sessionDate?.split("T")[0] || "";
                    if (datePart) setSessionDate(`${datePart}T${e.target.value}`);
                  }}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Extra event fields */}
            {currentExtraFields.length > 0 && (
              <div
                className={`grid gap-4 ${currentExtraFields.length === 1 ? "" : "sm:grid-cols-2"}`}
              >
                {currentExtraFields.map((f) => (
                  <div
                    key={f.key}
                    className={`space-y-1.5 ${f.isLocation || f.fullWidth || currentExtraFields.length === 1 ? "col-span-full" : ""}`}
                  >
                    <label className="text-sm font-medium">
                      {f.label}
                      {f.required && <span className="text-red-500"> *</span>}
                    </label>
                    {f.isLocation ? (
                      <LocationAutocomplete
                        value={extraData[f.key] || ""}
                        onChange={(v) =>
                          setExtraData((prev) => ({ ...prev, [f.key]: v }))
                        }
                        placeholder={`Cari lokasi ${f.label.toLowerCase()}...`}
                      />
                    ) : (
                      <input
                        value={extraData[f.key] || ""}
                        onChange={(e) =>
                          setExtraData((prev) => ({
                            ...prev,
                            [f.key]: e.target.value,
                          }))
                        }
                        placeholder={f.label}
                        className={inputClass}
                        required={f.required}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {eventType !== "Wedding" && vendor.form_show_location !== false && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {t("lokasi")} <span className="text-red-500">*</span>
                </label>
                <LocationAutocomplete
                  value={location}
                  onChange={setLocation}
                  placeholder={t("cariLokasi")}
                />
              </div>
            )}

            {/* Detail Lokasi */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Detail Lokasi
              </label>
              <input
                value={locationDetail}
                onChange={(e) => setLocationDetail(e.target.value)}
                placeholder="Contoh: Gedung Utama, Lt. 3, Ruang Ballroom A"
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              />
            </div>
          </div>

          {/* Package & Payment */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {t("paketPembayaran")}
            </h3>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t("paketLayanan")} <span className="text-red-500">*</span>
              </label>
              <select
                value={serviceId}
                onChange={(e) => handleServiceChange(e.target.value)}
                className={selectClass}
                required
              >
                <option value="">{t("pilihPaket")}</option>
                {filteredServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {formatCurrency(s.price)}{s.original_price && s.original_price > s.price ? ` (was ${formatCurrency(s.original_price)})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {selectedService && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">
                    {selectedService.name}
                  </span>
                  <span className="text-lg font-bold text-primary">
                    {formatCurrency(selectedService.price)}
                  </span>
                  {selectedService.original_price && selectedService.original_price > selectedService.price && (
                    <span className="text-sm text-muted-foreground line-through ml-2">
                      {formatCurrency(selectedService.original_price)}
                    </span>
                  )}
                </div>
                {selectedService.description && (
                  <p className="text-xs text-muted-foreground">
                    {selectedService.description}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t("dpMinimal", { percent: String(minDP) })}{" "}
                <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground shrink-0">
                  Rp
                </span>
                <input
                  value={dpDisplay}
                  onChange={(e) => {
                    const val = parseFormatted(e.target.value);
                    setDpDisplay(val === "" ? "" : formatNumber(val));
                  }}
                  placeholder={
                    selectedService
                      ? formatNumber(
                          Math.ceil((selectedService.price * minDP) / 100),
                        )
                      : "0"
                  }
                  className={`${inputClass} ${
                    selectedService &&
                    dpDisplay &&
                    Number(parseFormatted(dpDisplay)) <
                      Math.ceil((selectedService.price * minDP) / 100)
                      ? "!border-red-500 focus-visible:!border-red-500 focus-visible:!ring-red-500/30"
                      : ""
                  }`}
                  required
                />
              </div>
              {selectedService &&
              dpDisplay &&
              Number(parseFormatted(dpDisplay)) <
                Math.ceil((selectedService.price * minDP) / 100) ? (
                <p className="text-xs text-red-500 font-medium">
                  {t("dpMinWarning", {
                    percent: String(minDP),
                    amount: formatCurrency(
                      Math.ceil((selectedService.price * minDP) / 100),
                    ),
                  })}
                </p>
              ) : selectedService ? (
                <p className="text-xs text-muted-foreground">
                  Minimum:{" "}
                  {formatCurrency(
                    Math.ceil((selectedService.price * minDP) / 100),
                  )}
                </p>
              ) : null}
            </div>

            {/* Bank Info */}
            {vendor.bank_accounts && vendor.bank_accounts.length > 0 && (
              <div className="space-y-2">
                {vendor.bank_accounts.map(
                  (
                    bank: {
                      bank_name: string;
                      account_number: string;
                      account_name: string;
                    },
                    i: number,
                  ) => (
                    <div
                      key={i}
                      className="rounded-lg border bg-blue-50 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/20 p-3 space-y-1"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
                        <CreditCard className="w-3.5 h-3.5" />
                        {bank.bank_name}
                      </div>
                      <p className="font-mono text-sm font-bold tracking-wide">
                        {bank.account_number}
                      </p>
                      {bank.account_name && (
                        <p className="text-xs text-muted-foreground">
                          a.n. {bank.account_name}
                        </p>
                      )}
                    </div>
                  ),
                )}
              </div>
            )}

            {/* Bukti Pembayaran */}
            {vendor.form_show_proof !== false && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5" />
                  {t("buktiPembayaran")}
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  {proofPreview ? (
                    <img
                      src={proofPreview}
                      alt="Bukti"
                      className="max-h-40 rounded-lg object-contain"
                    />
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {t("klikUpload")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("formatFile")}
                      </p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleProofFile}
                />
              </div>
            )}
          </div>

          {/* Notes */}
          {vendor.form_show_notes !== false && (
            <div className="space-y-1.5 pt-2">
              <label className="text-sm font-medium">{t("catatan")}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder={t("catatanPlaceholder")}
                className="placeholder:text-muted-foreground w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-none transition-all"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 w-full h-12 rounded-lg text-white font-semibold hover:opacity-90 transition-opacity shadow-lg cursor-pointer disabled:opacity-50 text-base"
            style={{
              backgroundColor: brandColor,
              boxShadow: `0 10px 15px -3px ${brandColor}33`,
            }}
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {uploadingProof ? t("mengupload") : t("mengirim")}
              </>
            ) : (
              <>{t("kirimBooking")}</>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground pb-4">
          Powered by <span className="font-semibold">Client Desk</span>
        </p>
      </div>
    </div>
  );
}
