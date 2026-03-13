"use client";

import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  Loader2,
  CheckCircle2,
  Upload,
  MapPin,
  Camera,
  MessageCircle,
  CreditCard,
  FileText,
  QrCode,
  Banknote,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { compressImage } from "@/utils/compress-image";
import { LocationAutocomplete } from "@/components/ui/location-autocomplete";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslations } from "next-intl";
import {
  buildCustomFieldSnapshots,
  EVENT_EXTRA_FIELDS,
  groupFormLayoutBySection,
  normalizeStoredFormLayout,
  type FormLayoutItem,
} from "@/components/form-builder/booking-form-layout";
import { isRichTextEmpty, sanitizeRichTextHtml } from "@/utils/rich-text";
import {
  createPaymentSourceFromBank,
  getEnabledBankAccounts,
  getPaymentMethodLabel,
  normalizeBankAccounts,
  normalizePaymentMethods,
  type BankAccount,
  type PaymentMethod,
  type PaymentSource,
} from "@/lib/payment-config";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Service = {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  description: string | null;
  event_types: string[] | null;
  is_addon: boolean;
};

export type Vendor = {
  id: string;
  studio_name: string | null;
  whatsapp_number: string | null;
  min_dp_percent: number | null;
  min_dp_map: Record<string, number | { mode: string; value: number }> | null;
  avatar_url: string | null;
  invoice_logo_url: string | null;
  form_brand_color: string;
  form_greeting: string | null;
  form_event_types: string[] | null;
  custom_event_types: string[];
  form_show_location: boolean;
  form_show_notes: boolean;
  form_show_proof: boolean;
  form_terms_enabled: boolean;
  form_terms_agreement_text: string | null;
  form_terms_link_text: string | null;
  form_terms_suffix_text: string | null;
  form_terms_content: string | null;
  form_sections: FormLayoutItem[] | Record<string, FormLayoutItem[]>;
  form_payment_methods: PaymentMethod[];
  qris_image_url: string | null;
  bank_accounts: BankAccount[];
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

function createPaymentProofPath(ext?: string) {
  const safeExt = ext && ext.length > 0 ? ext : "bin";
  return `payment-proofs/${crypto.randomUUID()}.${safeExt}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BookingFormClientProps {
  vendor: Vendor;
  services: Service[];
}

type PreviewVendorPayload = Partial<
  Pick<
    Vendor,
    | "studio_name"
    | "min_dp_percent"
    | "min_dp_map"
    | "form_brand_color"
    | "form_greeting"
    | "form_event_types"
    | "custom_event_types"
    | "form_show_notes"
    | "form_show_proof"
    | "form_terms_enabled"
    | "form_terms_agreement_text"
    | "form_terms_link_text"
    | "form_terms_suffix_text"
    | "form_terms_content"
    | "form_sections"
    | "form_payment_methods"
    | "qris_image_url"
    | "bank_accounts"
  >
>;

type PreviewMessage = {
  type: "clientdesk:form-preview-update";
  previewKey: string;
  payload: PreviewVendorPayload;
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function BookingFormClient({
  vendor,
  services,
}: BookingFormClientProps) {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params?.vendorSlug as string;
  const supabase = React.useMemo(() => createClient(), []);
  const t = useTranslations("BookingForm");
  const previewMode = searchParams.get("preview") === "1";
  const previewStorageKey = searchParams.get("previewKey") || "";
  const [previewVendor, setPreviewVendor] = React.useState<PreviewVendorPayload | null>(null);

  React.useEffect(() => {
    if (!previewMode || !previewStorageKey || typeof window === "undefined") return;

    function loadPreviewVendor() {
      const raw = window.localStorage.getItem(previewStorageKey);
      if (!raw) return;

      try {
        setPreviewVendor(JSON.parse(raw) as PreviewVendorPayload);
      } catch {
        setPreviewVendor(null);
      }
    }

    function handlePreviewMessage(event: MessageEvent<PreviewMessage>) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "clientdesk:form-preview-update") return;
      if (event.data.previewKey !== previewStorageKey) return;
      setPreviewVendor(event.data.payload);
    }

    loadPreviewVendor();
    window.addEventListener("storage", loadPreviewVendor);
    window.addEventListener("message", handlePreviewMessage);
    return () => {
      window.removeEventListener("storage", loadPreviewVendor);
      window.removeEventListener("message", handlePreviewMessage);
    };
  }, [previewMode, previewStorageKey]);

  const effectiveVendor = React.useMemo<Vendor>(
    () => {
      const rawFormEventTypes =
        (previewVendor?.form_event_types as unknown) ?? vendor.form_event_types;
      const rawCustomEventTypes =
        (previewVendor?.custom_event_types as unknown) ?? vendor.custom_event_types;
      const rawBankAccounts =
        (previewVendor?.bank_accounts as unknown) ?? vendor.bank_accounts;

      return {
        ...vendor,
        ...(previewVendor || {}),
        custom_event_types: toStringArray(rawCustomEventTypes),
        form_payment_methods: normalizePaymentMethods(
          (previewVendor?.form_payment_methods as unknown) ??
            vendor.form_payment_methods,
        ),
        qris_image_url:
          typeof previewVendor?.qris_image_url === "string"
            ? previewVendor.qris_image_url
            : vendor.qris_image_url,
        bank_accounts: normalizeBankAccounts(rawBankAccounts),
        form_sections:
          (previewVendor?.form_sections as Vendor["form_sections"] | undefined) ??
          vendor.form_sections,
        form_event_types: Array.isArray(rawFormEventTypes)
          ? toStringArray(rawFormEventTypes)
          : null,
      };
    },
    [previewVendor, vendor],
  );

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
  const [selectedAddons, setSelectedAddons] = React.useState<Set<string>>(new Set());
  const [dpDisplay, setDpDisplay] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [locationDetail, setLocationDetail] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [instagram, setInstagram] = React.useState("");
  const [customFields, setCustomFields] = React.useState<Record<string, string>>({});
  const [extraData, setExtraData] = React.useState<Record<string, string>>({});
  const [splitDates, setSplitDates] = React.useState(false);
  const [akadDate, setAkadDate] = React.useState("");
  const [resepsiDate, setResepsiDate] = React.useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = React.useState<PaymentMethod | null>(null);
  const [selectedPaymentSource, setSelectedPaymentSource] = React.useState<PaymentSource | null>(null);
  const [proofFile, setProofFile] = React.useState<File | null>(null);
  const [proofPreview, setProofPreview] = React.useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = React.useState(false);
  const [termsAccepted, setTermsAccepted] = React.useState(false);
  const [termsDialogOpen, setTermsDialogOpen] = React.useState(false);
  const [error, setError] = React.useState("");

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const autoDpAmountRef = React.useRef<number | null>(null);

  // ── Helpers ──

  function getMinDpForEvent(et?: string): { mode: "percent" | "fixed"; value: number } {
    const eventKey = et ?? eventType;
    const fallbackPercent = effectiveVendor.min_dp_percent ?? 50;
    if (eventKey && effectiveVendor.min_dp_map && effectiveVendor.min_dp_map[eventKey] !== undefined) {
      const entry = effectiveVendor.min_dp_map[eventKey];
      if (typeof entry === "number") return { mode: "percent", value: entry }; // backward compat
      return { mode: (entry.mode as "percent" | "fixed") || "percent", value: entry.value ?? fallbackPercent };
    }
    return { mode: "percent", value: fallbackPercent };
  }

  /** Calculate minimum DP amount given a service price */
  function calcMinDpAmount(price: number, dpConfig?: { mode: string; value: number }): number {
    const cfg = dpConfig ?? getMinDpForEvent();
    return cfg.mode === "fixed" ? cfg.value : Math.ceil((price * cfg.value) / 100);
  }

  function handleServiceChange(id: string) {
    setServiceId(id);
    const svc = services.find((s) => s.id === id) ?? null;
    setSelectedService(svc);
    if (svc) {
      const minDP = getMinDpForEvent();
      const selectedAddonTotal = services
        .filter((service) => selectedAddons.has(service.id))
        .reduce((sum, service) => sum + service.price, 0);
      const minAmount = calcMinDpAmount(svc.price + selectedAddonTotal, minDP);
      autoDpAmountRef.current = minAmount;
      setDpDisplay(formatNumber(minAmount));
    } else {
      autoDpAmountRef.current = null;
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

    if (!selectedPaymentMethod) {
      setError(t("errorPaymentMethod"));
      return;
    }

    if (selectedPaymentMethod === "bank" && !selectedPaymentSource) {
      setError(t("errorPaymentSource"));
      return;
    }

    if (selectedPaymentMethod === "qris" && !effectiveVendor.qris_image_url) {
      setError(t("paymentNoQris"));
      return;
    }

    if (hasTerms && !termsAccepted) {
      setError(t("errorTermsRequired"));
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
      const minAmount = calcMinDpAmount(selectedBookingTotal, minDP);
      if (dpValue < minAmount) {
        setError(
          minDP.mode === "fixed"
            ? t("errorDPMinFixed", { amount: formatCurrency(minAmount) })
            : t("errorDPMin", {
                percent: String(minDP.value),
                amount: formatCurrency(minAmount),
              }),
        );
        return;
      }
    }

    setSubmitting(true);

    // Upload bukti pembayaran jika ada
    let paymentProofUrl: string | null = null;
    if (proofFile && selectedPaymentMethod !== "cash") {
      setUploadingProof(true);
      try {
        const compressed = proofFile.type.startsWith("image/")
          ? await compressImage(proofFile, 1200, 0.7)
          : proofFile;
        const ext = proofFile.type.startsWith("image/")
          ? "jpg"
          : proofFile.name.split(".").pop();
        const path = createPaymentProofPath(ext);
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
      const mergedExtra = { ...extraData };
      let finalSessionDate = sessionDate;
      if (eventType === "Wedding" && splitDates) {
          mergedExtra.tanggal_akad = akadDate || "";
          mergedExtra.tanggal_resepsi = resepsiDate || "";
          if (akadDate && resepsiDate) {
              finalSessionDate = akadDate < resepsiDate ? akadDate : resepsiDate;
          } else {
              finalSessionDate = akadDate || resepsiDate || sessionDate;
          }
      }
      const customFieldSnapshots = buildCustomFieldSnapshots(
        normalizedActiveLayout,
        eventType || "Umum",
        customFields,
      );

      const res = await fetch("/api/public/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorSlug: slug,
          clientName,
          clientWhatsapp: fullPhone,
          eventType: eventType || null,
          sessionDate: finalSessionDate,
          serviceId,
          totalPrice: selectedBookingTotal,
          dpPaid: dpValue,
          location: finalLocation || null,
          locationDetail: locationDetail || null,
          notes: notes || null,
          extraData: {
            ...(Object.keys(mergedExtra).length > 0 ? mergedExtra : {}),
            ...(selectedAddons.size > 0
              ? {
                  addon_ids: Array.from(selectedAddons),
                  addon_names: selectedAddonServices.map((service) => service.name),
                }
              : {}),
            ...(hasTerms
              ? {
                  terms_accepted: true,
                  terms_accepted_at: new Date().toISOString(),
                }
              : {}),
            ...(customFieldSnapshots.length > 0 ? { custom_fields: customFieldSnapshots } : {}),
          },
          paymentProofUrl: selectedPaymentMethod === "cash" ? null : paymentProofUrl,
          paymentMethod: selectedPaymentMethod,
          paymentSource: selectedPaymentSource,
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
      `\n💰 Total: ${formatCurrency(selectedBookingTotal)}\n` +
      `✅ DP: ${formatCurrency(dpVal)}\n` +
      `💳 Metode: ${selectedPaymentMethod ? getPaymentMethodLabel(selectedPaymentMethod) : "-"}\n` +
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
  const selectedAddonServices = services.filter((service) =>
    selectedAddons.has(service.id),
  );
  const selectedAddonTotal = selectedAddonServices.reduce(
    (sum, service) => sum + service.price,
    0,
  );
  const selectedBookingTotal = (selectedService?.price || 0) + selectedAddonTotal;
  const currentMinDpAmount = selectedService
    ? calcMinDpAmount(selectedBookingTotal, minDP)
    : 0;
  const currentExtraFields = EVENT_EXTRA_FIELDS[eventType] || [];
  const brandColor = effectiveVendor.form_brand_color || "#000000";
  const formSectionsByEventType = React.useMemo(() => {
    if (Array.isArray(effectiveVendor.form_sections)) {
      return { Umum: normalizeStoredFormLayout(effectiveVendor.form_sections, "Umum") };
    }
    if (effectiveVendor.form_sections && typeof effectiveVendor.form_sections === "object") {
      return Object.fromEntries(
        Object.entries(effectiveVendor.form_sections).map(([k, v]) => [
          k,
          normalizeStoredFormLayout(v, k),
        ]),
      ) as Record<string, FormLayoutItem[]>;
    }
    return { Umum: normalizeStoredFormLayout([], "Umum") } as Record<string, FormLayoutItem[]>;
  }, [effectiveVendor.form_sections]);
  const activeLayout = !eventType
    ? formSectionsByEventType.Umum || normalizeStoredFormLayout([], "Umum")
    : formSectionsByEventType[eventType] ||
      formSectionsByEventType.Umum ||
      normalizeStoredFormLayout([], eventType);
  const normalizedActiveLayout = normalizeStoredFormLayout(
    activeLayout,
    eventType || "Umum",
  );
  const activeSections = groupFormLayoutBySection(
    normalizedActiveLayout,
    eventType || "Umum",
  );
  const availableEventTypes = effectiveVendor.form_event_types?.length
    ? [...effectiveVendor.form_event_types, ...(effectiveVendor.custom_event_types || []).filter(t => effectiveVendor.form_event_types!.includes(t))]
    : [...EVENT_TYPES, ...(effectiveVendor.custom_event_types || [])];
  const termsAgreementText =
    effectiveVendor.form_terms_agreement_text?.trim() || t("termsAgreementDefault");
  const termsLinkText =
    effectiveVendor.form_terms_link_text?.trim() || t("termsLinkDefault");
  const termsSuffixText = effectiveVendor.form_terms_suffix_text?.trim() || "";
  const termsContent = React.useMemo(
    () => sanitizeRichTextHtml(effectiveVendor.form_terms_content || ""),
    [effectiveVendor.form_terms_content],
  );
  const hasTerms = effectiveVendor.form_terms_enabled && !isRichTextEmpty(termsContent);
  const availablePaymentMethods = React.useMemo(
    () =>
      effectiveVendor.form_payment_methods.length > 0
        ? effectiveVendor.form_payment_methods
        : (["bank"] as PaymentMethod[]),
    [effectiveVendor.form_payment_methods],
  );
  const enabledBankAccounts = React.useMemo(
    () => getEnabledBankAccounts(effectiveVendor.bank_accounts || []),
    [effectiveVendor.bank_accounts],
  );

  React.useEffect(() => {
    if (!selectedService) {
      autoDpAmountRef.current = null;
      return;
    }

    const nextMinAmount = currentMinDpAmount;
    setDpDisplay((current) => {
      const parsed = parseFormatted(current);
      const previousAutoAmount = autoDpAmountRef.current;
      autoDpAmountRef.current = nextMinAmount;

      if (current === "" || parsed === "" || parsed === previousAutoAmount) {
        return formatNumber(nextMinAmount);
      }

      return current;
    });
  }, [currentMinDpAmount, selectedService]);

  React.useEffect(() => {
    if (availablePaymentMethods.length === 1) {
      setSelectedPaymentMethod(availablePaymentMethods[0]);
      return;
    }

    setSelectedPaymentMethod((current) => {
      if (current && availablePaymentMethods.includes(current)) return current;
      return availablePaymentMethods[0] ?? null;
    });
  }, [availablePaymentMethods]);

  React.useEffect(() => {
    if (!selectedPaymentMethod) {
      setSelectedPaymentSource(null);
      return;
    }

    if (selectedPaymentMethod === "bank") {
      setSelectedPaymentSource((current) => {
        if (current?.type === "bank") {
          const matched = enabledBankAccounts.find(
            (bank) => bank.id === current.bank_id,
          );
          if (matched) return createPaymentSourceFromBank(matched);
        }

        return enabledBankAccounts[0]
          ? createPaymentSourceFromBank(enabledBankAccounts[0])
          : null;
      });
      return;
    }

    setSelectedPaymentSource({
      type: selectedPaymentMethod,
      label: getPaymentMethodLabel(selectedPaymentMethod),
    });
  }, [enabledBankAccounts, selectedPaymentMethod]);

  React.useEffect(() => {
    if (selectedPaymentMethod !== "cash") return;
    setProofFile(null);
    setProofPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [selectedPaymentMethod]);

  // Filter services by selected event type, split main vs addon
  const filteredServices = eventType
    ? services.filter(s => !s.is_addon && (!s.event_types || s.event_types.length === 0 || s.event_types.includes(eventType)))
    : services.filter(s => !s.is_addon);
  const addonServices = eventType
    ? services.filter(s => s.is_addon && (!s.event_types || s.event_types.length === 0 || s.event_types.includes(eventType)))
    : services.filter(s => s.is_addon);

  function renderCustomField(field: Extract<FormLayoutItem, { kind: "custom_field" }>) {
    const choiceOptions =
      field.type === "checkbox"
        ? field.options && field.options.length > 0
          ? field.options
          : ["Ya", "Tidak"]
        : field.options || [];

    return (
      <div key={field.id} className="space-y-1.5">
        <label className="text-sm font-medium">
          {field.label}
          {field.required && <span className="text-red-500"> *</span>}
        </label>
        {field.type === "textarea" ? (
          <textarea
            value={customFields[field.id] || ""}
            onChange={(e) =>
              setCustomFields((prev) => ({ ...prev, [field.id]: e.target.value }))
            }
            placeholder={field.placeholder}
            required={field.required}
            rows={3}
            className="placeholder:text-muted-foreground w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-none transition-all"
          />
        ) : field.type === "select" ? (
          <select
            value={customFields[field.id] || ""}
            onChange={(e) =>
              setCustomFields((prev) => ({ ...prev, [field.id]: e.target.value }))
            }
            required={field.required}
            className={selectClass}
          >
            <option value="">{field.placeholder || "Pilih..."}</option>
            {choiceOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : field.type === "checkbox" ? (
          <div className="space-y-2">
            {choiceOptions.map((opt) => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={field.id}
                  value={opt}
                  checked={customFields[field.id] === opt}
                  onChange={(e) =>
                    setCustomFields((prev) => ({
                      ...prev,
                      [field.id]: e.target.value,
                    }))
                  }
                  required={field.required}
                  className="accent-primary w-4 h-4"
                />
                <span className="text-sm">{opt}</span>
              </label>
            ))}
          </div>
        ) : (
          <input
            type={field.type === "number" ? "number" : "text"}
            value={customFields[field.id] || ""}
            onChange={(e) =>
              setCustomFields((prev) => ({ ...prev, [field.id]: e.target.value }))
            }
            placeholder={field.placeholder}
            required={field.required}
            className={inputClass}
          />
        )}
      </div>
    );
  }

  function renderEventExtraField(extraKey: string) {
    const field = currentExtraFields.find((item) => item.key === extraKey);
    if (!field) return null;

    return (
      <div
        key={`extra:${extraKey}`}
        className={`space-y-1.5 ${field.isLocation || field.fullWidth || currentExtraFields.length === 1 ? "col-span-full" : ""}`}
      >
        <label className="text-sm font-medium">
          {field.label}
          {field.required && <span className="text-red-500"> *</span>}
        </label>
        {field.isLocation ? (
          <LocationAutocomplete
            value={extraData[field.key] || ""}
            onChange={(value) =>
              setExtraData((prev) => ({ ...prev, [field.key]: value }))
            }
            placeholder={`Cari lokasi ${field.label.toLowerCase()}...`}
          />
        ) : field.isNumeric ? (
          <input
            value={extraData[field.key] || ""}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, "");
              const num = parseInt(raw, 10);
              setExtraData((prev) => ({
                ...prev,
                [field.key]:
                  raw === "" ? "" : new Intl.NumberFormat("id-ID").format(num),
              }));
            }}
            placeholder={field.label}
            className={inputClass}
            required={field.required}
            inputMode="numeric"
          />
        ) : (
          <input
            value={extraData[field.key] || ""}
            onChange={(e) =>
              setExtraData((prev) => ({
                ...prev,
                [field.key]: e.target.value,
              }))
            }
            placeholder={field.label}
            className={inputClass}
            required={field.required}
          />
        )}
      </div>
    );
  }

  function renderBuiltInField(item: Extract<FormLayoutItem, { kind: "builtin_field" }>) {
    switch (item.builtinId) {
      case "client_name":
        return (
          <div key={item.id} className="space-y-1.5">
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
        );
      case "client_whatsapp":
        return (
          <div key={item.id} className="space-y-1.5">
            <label className="text-sm font-medium">
              {t("nomorWhatsapp")} <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className={selectClass + " !w-28 shrink-0"}
              >
                {COUNTRY_CODES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.flag} {country.code}
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
        );
      case "instagram":
        return (
          <div key={item.id} className="space-y-1.5">
            <label className="text-sm font-medium">Instagram</label>
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
        );
      case "event_type":
        return (
          <div key={item.id} className="space-y-1.5">
            <label className="text-sm font-medium">
              {t("tipeAcara")} <span className="text-red-500">*</span>
            </label>
            <select
              value={eventType}
              onChange={(e) => {
                setEventType(e.target.value);
                setExtraData({});
                setCustomFields({});
                setServiceId("");
                setSelectedService(null);
                setSelectedAddons(new Set());
                autoDpAmountRef.current = null;
                setDpDisplay("");
                if (selectedService) {
                  const newMinDP = getMinDpForEvent(e.target.value);
                  const minAmount = calcMinDpAmount(selectedService.price, newMinDP);
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
        );
      case "wedding_split_toggle":
        if (eventType !== "Wedding") return null;
        return (
          <div key={item.id} className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSplitDates(!splitDates)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${splitDates ? "bg-primary" : "bg-gray-300"}`}
            >
              <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${splitDates ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            <span className="text-sm font-medium">Akad &amp; Resepsi beda hari</span>
          </div>
        );
      case "akad_date":
        if (eventType !== "Wedding" || !splitDates) return null;
        return (
          <div key={item.id} className="space-y-1.5">
            <label className="text-sm font-medium">Tanggal Akad <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={akadDate ? akadDate.split("T")[0] : ""}
              onChange={(e) => {
                const timePart = akadDate?.split("T")[1] || "10:00";
                setAkadDate(e.target.value ? `${e.target.value}T${timePart}` : "");
              }}
              className={inputClass}
              required
            />
          </div>
        );
      case "akad_time":
        if (eventType !== "Wedding" || !splitDates) return null;
        return (
          <div key={item.id} className="space-y-1.5">
            <label className="text-sm font-medium">Jam Akad <span className="text-red-500">*</span></label>
            <input
              type="time"
              value={akadDate ? akadDate.split("T")[1] || "10:00" : ""}
              onChange={(e) => {
                const datePart = akadDate?.split("T")[0] || "";
                if (datePart) setAkadDate(`${datePart}T${e.target.value}`);
              }}
              className={inputClass}
            />
          </div>
        );
      case "resepsi_date":
        if (eventType !== "Wedding" || !splitDates) return null;
        return (
          <div key={item.id} className="space-y-1.5">
            <label className="text-sm font-medium">Tanggal Resepsi <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={resepsiDate ? resepsiDate.split("T")[0] : ""}
              onChange={(e) => {
                const timePart = resepsiDate?.split("T")[1] || "10:00";
                setResepsiDate(e.target.value ? `${e.target.value}T${timePart}` : "");
              }}
              className={inputClass}
              required
            />
          </div>
        );
      case "resepsi_time":
        if (eventType !== "Wedding" || !splitDates) return null;
        return (
          <div key={item.id} className="space-y-1.5">
            <label className="text-sm font-medium">Jam Resepsi <span className="text-red-500">*</span></label>
            <input
              type="time"
              value={resepsiDate ? resepsiDate.split("T")[1] || "10:00" : ""}
              onChange={(e) => {
                const datePart = resepsiDate?.split("T")[0] || "";
                if (datePart) setResepsiDate(`${datePart}T${e.target.value}`);
              }}
              className={inputClass}
            />
          </div>
        );
      case "session_date":
        if (eventType === "Wedding" && splitDates) return null;
        return (
          <div key={item.id} className="space-y-1.5">
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
        );
      case "session_time":
        if (eventType === "Wedding" && splitDates) return null;
        return (
          <div key={item.id} className="space-y-1.5">
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
        );
      case "location":
        if (eventType === "Wedding" || effectiveVendor.form_show_location === false) return null;
        return (
          <div key={item.id} className="space-y-1.5">
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
        );
      case "location_detail":
        return (
          <div key={item.id} className="space-y-1.5">
            <label className="text-sm font-medium">Detail Lokasi</label>
            <input
              value={locationDetail}
              onChange={(e) => setLocationDetail(e.target.value)}
              placeholder="Contoh: Gedung Utama, Lt. 3, Ruang Ballroom A"
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            />
          </div>
        );
      case "notes":
        if (effectiveVendor.form_show_notes === false) return null;
        return (
          <div key={item.id} className="space-y-1.5">
            <label className="text-sm font-medium">{t("catatan")}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={t("catatanPlaceholder")}
              className="placeholder:text-muted-foreground w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-none transition-all"
            />
          </div>
        );
      case "service_package":
        return (
          <div key={item.id} className="space-y-3">
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
                {filteredServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} — {formatCurrency(service.price)}
                    {service.original_price && service.original_price > service.price
                      ? ` (was ${formatCurrency(service.original_price)})`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
            {selectedService && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{selectedService.name}</span>
                  <span className="text-lg font-bold text-primary">
                    {formatCurrency(selectedService.price)}
                  </span>
                  {selectedService.original_price &&
                    selectedService.original_price > selectedService.price && (
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
          </div>
        );
      case "addon_packages":
        if (addonServices.length === 0) return null;
        return (
          <div key={item.id} className="space-y-2">
            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1 border-t" />
              <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Paket Tambahan</span>
              <div className="flex-1 border-t" />
            </div>
            {addonServices.map((addon) => (
              <label
                key={addon.id}
                className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all ${selectedAddons.has(addon.id) ? "border-primary bg-primary/5" : "border-input hover:bg-muted/30"}`}
              >
                <input
                  type="checkbox"
                  checked={selectedAddons.has(addon.id)}
                  onChange={() => {
                    setSelectedAddons((prev) => {
                      const next = new Set(prev);
                      if (next.has(addon.id)) next.delete(addon.id);
                      else next.add(addon.id);
                      return next;
                    });
                  }}
                  className="accent-primary w-4 h-4 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{addon.name}</span>
                  {addon.description && (
                    <p className="text-[11px] text-muted-foreground truncate">{addon.description}</p>
                  )}
                </div>
                <span className="text-sm font-semibold text-primary whitespace-nowrap">
                  +{formatCurrency(addon.price)}
                </span>
              </label>
            ))}
            {selectedAddons.size > 0 && selectedService && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex justify-between">
                  <span>Paket utama</span>
                  <span>{formatCurrency(selectedService.price)}</span>
                </div>
                {selectedAddonServices.map((service) => (
                    <div key={service.id} className="flex justify-between text-muted-foreground">
                      <span>+ {service.name}</span>
                      <span>{formatCurrency(service.price)}</span>
                    </div>
                  ))}
                <div className="flex justify-between font-bold border-t pt-1 mt-1">
                  <span>Total</span>
                  <span>{formatCurrency(selectedBookingTotal)}</span>
                </div>
              </div>
            )}
          </div>
        );
      case "dp_paid":
        return (
          <div key={item.id} className="space-y-1.5">
            <label className="text-sm font-medium">
              {minDP.mode === "fixed"
                ? `DP (Minimal ${formatCurrency(minDP.value)})`
                : t("dpMinimal", { percent: String(minDP.value) })}{" "}
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
                    ? formatNumber(currentMinDpAmount)
                    : "0"
                }
                className={`${inputClass} ${
                  selectedService &&
                  dpDisplay &&
                  Number(parseFormatted(dpDisplay)) <
                    currentMinDpAmount
                    ? "!border-red-500 focus-visible:!border-red-500 focus-visible:!ring-red-500/30"
                    : ""
                }`}
                required
              />
            </div>
            {selectedService && dpDisplay && Number(parseFormatted(dpDisplay)) <
              currentMinDpAmount ? (
              <p className="text-xs text-red-500 font-medium">
                {minDP.mode === "fixed"
                  ? t("dpMinWarningFixed", {
                      amount: formatCurrency(currentMinDpAmount),
                    })
                  : t("dpMinWarning", {
                      percent: String(minDP.value),
                      amount: formatCurrency(currentMinDpAmount),
                    })}
              </p>
            ) : selectedService ? (
              <p className="text-xs text-muted-foreground">
                Minimum: {formatCurrency(currentMinDpAmount)}
              </p>
            ) : null}
          </div>
        );
      case "bank_accounts":
        if (availablePaymentMethods.length === 0) return null;
        return (
          <div key={item.id} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {t("paymentMethod")} <span className="text-red-500">*</span>
              </label>
              <div className="space-y-3">
                {availablePaymentMethods.map((method) => {
                  const active = selectedPaymentMethod === method;
                  const Icon =
                    method === "bank"
                      ? CreditCard
                      : method === "qris"
                        ? QrCode
                        : Banknote;

                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setSelectedPaymentMethod(method)}
                      className={`w-full rounded-xl border p-4 text-left transition-all cursor-pointer ${
                        active
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-input hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                              active
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">
                              {method === "bank"
                                ? t("paymentMethodBank")
                                : method === "qris"
                                  ? t("paymentMethodQris")
                                  : t("paymentMethodCash")}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {method === "bank"
                                ? t("paymentMethodBankDesc")
                                : method === "qris"
                                  ? t("paymentMethodQrisDesc")
                                  : t("paymentMethodCashDesc")}
                            </p>
                          </div>
                        </div>
                        <div
                          className={`mt-1 h-5 w-5 rounded-full border ${
                            active
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/30"
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedPaymentMethod === "bank" && (
              <div className="space-y-3">
                <label className="text-sm font-medium">
                  {t("paymentSourceBank")} <span className="text-red-500">*</span>
                </label>
                {enabledBankAccounts.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    {t("paymentNoBank")}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {enabledBankAccounts.map((bank) => {
                      const isSelected =
                        selectedPaymentSource?.type === "bank" &&
                        selectedPaymentSource.bank_id === bank.id;

                      return (
                        <button
                          key={bank.id}
                          type="button"
                          onClick={() =>
                            setSelectedPaymentSource(
                              createPaymentSourceFromBank(bank),
                            )
                          }
                          className={`w-full rounded-xl border p-4 text-left transition-all cursor-pointer ${
                            isSelected
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-input hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-base font-semibold">{bank.bank_name}</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                {t("paymentMethodBankDescSingle", { bank: bank.bank_name })}
                              </p>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedPaymentSource?.type === "bank" && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/80 dark:border-blue-500/20 dark:bg-blue-500/5 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
                      <CreditCard className="w-4 h-4" />
                      {selectedPaymentSource.bank_name}
                    </div>
                    <div className="rounded-lg bg-background/80 p-4">
                      <p className="font-mono text-lg font-bold tracking-wide">
                        {selectedPaymentSource.account_number}
                      </p>
                      {selectedPaymentSource.account_name && (
                        <p className="text-sm text-muted-foreground mt-1">
                          a.n. {selectedPaymentSource.account_name}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedPaymentMethod === "qris" && (
              <div className="space-y-3">
                <label className="text-sm font-medium">
                  {t("paymentSourceQris")}
                </label>
                <div className="rounded-xl border border-blue-200 bg-blue-50/80 dark:border-blue-500/20 dark:bg-blue-500/5 p-4 sm:p-5">
                  <div className="rounded-lg bg-background/80 p-4 sm:p-6 min-h-56 flex items-center justify-center">
                    {effectiveVendor.qris_image_url ? (
                      <img
                        src={effectiveVendor.qris_image_url}
                        alt={t("paymentMethodQris")}
                        referrerPolicy="no-referrer"
                        className="w-full max-h-[22rem] object-contain mx-auto"
                      />
                    ) : (
                      <div className="text-center text-sm text-muted-foreground">
                        {t("paymentNoQris")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {selectedPaymentMethod === "cash" && (
              <div className="rounded-xl border p-4 text-sm text-muted-foreground bg-muted/20">
                {t("paymentCashNote")}
              </div>
            )}
          </div>
        );
      case "payment_proof":
        if (!selectedPaymentMethod || selectedPaymentMethod === "cash") return null;
        return (
          <div key={item.id} className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" />
              {t("buktiPembayaran")}
            </label>
            <p className="text-xs text-muted-foreground">
              {selectedPaymentMethod === "qris"
                ? t("paymentProofQrisHint")
                : t("paymentProofBankHint")}
            </p>
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
                  <p className="text-sm text-muted-foreground">{t("klikUpload")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("formatFile")}</p>
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
        );
      default:
        if (item.builtinId.startsWith("extra:")) {
          return renderEventExtraField(item.builtinId.slice(6));
        }
        return null;
    }
  }

  function renderLayoutItem(item: FormLayoutItem) {
    if (item.kind === "builtin_section") return null;
    if (item.kind === "custom_section") {
      return (
        <div key={item.id} className="space-y-2 pt-1">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <h4 className="text-sm font-semibold text-foreground/85">
              {item.title}
            </h4>
            <div className="h-px flex-1 bg-border" />
          </div>
        </div>
      );
    }
    if (item.kind === "custom_field") {
      return renderCustomField(item);
    }
    return renderBuiltInField(item);
  }

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
            {effectiveVendor.invoice_logo_url ? (
              <img
                src={effectiveVendor.invoice_logo_url}
                alt="Logo"
                className="w-full h-full object-contain p-1"
              />
            ) : effectiveVendor.avatar_url ? (
              <img
                src={effectiveVendor.avatar_url}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              effectiveVendor.studio_name?.charAt(0)?.toUpperCase() || "V"
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {effectiveVendor.studio_name || "Studio"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {effectiveVendor.form_greeting || t("greetingDefault")}
            </p>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-background rounded-2xl shadow-lg border p-6 sm:p-8 space-y-5"
        >
          {activeSections.map((section) => {
            const renderedItems = section.items
              .map((item) => renderLayoutItem(item))
              .filter(Boolean);

            if (renderedItems.length === 0) return null;

            return (
              <section key={section.section.sectionId} className="space-y-4">
                <div className="space-y-1">
                  <h3
                    className="text-base font-semibold"
                    style={{ color: brandColor }}
                  >
                    {section.section.title}
                  </h3>
                  <div className="h-px w-full bg-border" />
                </div>
                <div className="space-y-4">{renderedItems}</div>
              </section>
            );
          })}

          {hasTerms && (
            <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
              <div className="flex items-start gap-3">
                <input
                  id="booking-terms"
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => {
                    setTermsAccepted(e.target.checked);
                    if (e.target.checked) setError("");
                  }}
                  className="mt-1 h-4 w-4 rounded border-input accent-primary"
                />
                <label
                  htmlFor="booking-terms"
                  className="text-sm leading-6 text-muted-foreground"
                >
                  {termsAgreementText}{" "}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setTermsDialogOpen(true);
                    }}
                    className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-4 cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {termsLinkText}
                  </button>
                  {termsSuffixText ? ` ${termsSuffixText}` : ""}
                </label>
              </div>
            </section>
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

        {hasTerms && (
          <Dialog open={termsDialogOpen} onOpenChange={setTermsDialogOpen}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{termsLinkText}</DialogTitle>
                <DialogDescription>
                  {t("termsDialogDescription")}
                </DialogDescription>
              </DialogHeader>
              <div
                className="max-h-[55vh] overflow-y-auto rounded-lg border bg-muted/20 p-4 text-sm leading-6 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic [&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-item [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: termsContent }}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setTermsDialogOpen(false)}
                  className="inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-medium transition-colors hover:bg-muted cursor-pointer"
                >
                  {t("tutup")}
                </button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        <p className="text-center text-xs text-muted-foreground pb-4">
          Powered by <span className="font-semibold">Client Desk</span>
        </p>
      </div>
    </div>
  );
}
