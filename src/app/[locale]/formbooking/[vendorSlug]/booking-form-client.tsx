"use client";

import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  AtSign,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  MapPin,
  MessageCircle,
  FileText,
  LayoutGrid,
  List,
  Minus,
  Package,
  Phone,
  Plus,
  Tag,
  User,
  type LucideIcon,
} from "lucide-react";
import {
  LocationAutocomplete,
  type LocationSelectionMeta,
} from "@/components/ui/location-autocomplete";
import { UniversityAutocomplete } from "@/components/ui/university-autocomplete";
import { CitySingleSelect } from "@/components/ui/city-single-select";
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
  groupFormLayoutBySection,
  resolveBuiltInFieldRequired,
  type BuiltInFieldId,
  type FormLayoutMode,
  type FormLayoutItem,
} from "@/components/form-builder/booking-form-layout";
import { FileDropzone } from "@/components/public/file-dropzone";
import { PaymentMethodSection } from "@/components/public/payment-method-section";
import {
  getLayoutExtraFields,
} from "@/utils/form-extra-fields";
import { isRichTextEmpty, sanitizeRichTextHtml } from "@/utils/rich-text";
import {
  createPaymentSourceFromBank,
  getEnabledBankAccounts,
  getPaymentMethodLabel,
  getPaymentSourceLabel,
  normalizeBankAccounts,
  normalizePaymentMethods,
  type BankAccount,
  type PaymentMethod,
  type PaymentSource,
} from "@/lib/payment-config";
import {
  getActiveEventTypes,
  LEGACY_PUBLIC_CUSTOM_EVENT_TYPE,
  normalizeEventTypeName,
  normalizeEventTypeList,
  PUBLIC_CUSTOM_EVENT_TYPE,
} from "@/lib/event-type-config";
import { fillWhatsAppTemplate } from "@/lib/whatsapp-template";
import {
  buildBookingServicePayloadItemsFromSelection,
  getBookingDurationMinutes,
  normalizeBookingServiceQuantity,
  normalizeBookingServiceQuantityMap,
  type BookingServiceQuantityMap,
  type BookingServiceSelection,
} from "@/lib/booking-services";
import { buildBookingWhatsAppTemplateVars } from "@/lib/booking-whatsapp-template-vars";
import { resolveBookingCalendarSessions } from "@/lib/booking-calendar-sessions";
import { resolveSessionDurationMinutesBySessionKey } from "@/lib/wisuda-session-duration";
import {
  buildGoogleMapsUrlOrFallback,
  resolvePreferredLocation,
  type LocationCoordinates,
} from "@/utils/location";
import {
  formatSessionDate,
  formatSessionTimeRange,
} from "@/utils/format-date";
import { buildWhatsAppUrl, openWhatsAppUrl } from "@/utils/whatsapp-link";
import {
  SPECIAL_LINK_EXPIRED_ERROR_CODE,
  type BookingSpecialOfferStatus,
  computeSpecialOfferTotal,
  normalizeSpecialOfferToken,
  normalizeUuidList,
} from "@/lib/booking-special-offer";
import {
  getUniversityReferenceId,
  hasUniversityValue,
  UNIVERSITY_EXTRA_FIELD_KEY,
  UNIVERSITY_REFERENCE_EXTRA_KEY,
} from "@/lib/university-references";
import { useTenant } from "@/lib/tenant-context";
import { shouldHideTenantBranding } from "@/lib/tenant-branding";
import {
  resolveNormalizedLayoutFromStoredSections,
} from "@/lib/form-sections";
import { compressImage } from "@/utils/compress-image";
import {
  buildCityDisplayName,
  normalizeCityCode,
  type CityReferenceItem,
} from "@/lib/city-references";
import {
  buildServiceSoftPalette,
  resolveHexColor,
} from "@/lib/service-colors";
import {
  filterServicesForBookingSelection,
  isCityScopedBookingEventType,
} from "@/lib/service-availability";
import { MAX_GOOGLE_UPLOAD_BYTES } from "@/lib/security/public-upload";

const CONFIRMATION_SUBMIT_GUARD_MS = 350;

// ─── Types ────────────────────────────────────────────────────────────────────

export type Service = {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  description: string | null;
  color?: string | null;
  event_types: string[] | null;
  is_addon: boolean;
  is_public?: boolean | null;
  sort_order?: number;
  duration_minutes?: number | null;
  affects_schedule?: boolean | null;
  created_at?: string;
  city_codes?: string[] | null;
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
  form_show_addons: boolean;
  form_allow_multiple_packages: boolean;
  form_allow_multiple_addons: boolean;
  form_hide_service_prices: boolean;
  form_show_wedding_split: boolean;
  form_show_wisuda_split: boolean;
  form_show_proof: boolean;
  form_terms_enabled: boolean;
  form_terms_agreement_text: string | null;
  form_terms_link_text: string | null;
  form_terms_suffix_text: string | null;
  form_terms_content: string | null;
  form_sections: unknown;
  form_payment_methods: PaymentMethod[];
  qris_image_url: string | null;
  bank_accounts: BankAccount[];
  seo_meta_title?: string | null;
  seo_meta_description?: string | null;
  seo_meta_keywords?: string | null;
  seo_og_image_url?: string | null;
  seo_form_meta_title?: string | null;
  seo_form_meta_description?: string | null;
  seo_form_meta_keywords?: string | null;
  seo_form_og_image_url?: string | null;
  seo_track_meta_title?: string | null;
  seo_track_meta_description?: string | null;
  seo_track_meta_keywords?: string | null;
  seo_track_og_image_url?: string | null;
  seo_settlement_meta_title?: string | null;
  seo_settlement_meta_description?: string | null;
  seo_settlement_meta_keywords?: string | null;
  seo_settlement_og_image_url?: string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

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

const PAYMENT_PROOF_MAX_BYTES = MAX_GOOGLE_UPLOAD_BYTES;
const PAYMENT_PROOF_IMAGE_COMPRESSION_STEPS = [
  { maxSize: 2200, quality: 0.88 },
  { maxSize: 1800, quality: 0.82 },
  { maxSize: 1440, quality: 0.76 },
  { maxSize: 1200, quality: 0.68 },
] as const;

const PAYMENT_CONFIRM_BUILTIN_IDS = new Set([
  "dp_paid",
  "bank_accounts",
  "payment_proof",
]);
const PACKAGE_SELECTION_BUILTIN_IDS = new Set([
  "service_package",
  "addon_packages",
]);
const WEDDING_SPLIT_LOCATION_EXTRA_IDS = new Set([
  "extra:tempat_akad",
  "extra:tempat_resepsi",
]);
const WISUDA_SPLIT_LOCATION_EXTRA_IDS = new Set([
  "extra:tempat_wisuda_1",
  "extra:tempat_wisuda_2",
]);
const PRE_EVENT_SELECTION_BUILTIN_IDS = new Set([
  "client_name",
  "client_whatsapp",
  "instagram",
  "event_type",
]);
type BookingStep = 1 | 2 | 3 | 4;

function isSplitLocationExtraBuiltinId(eventType: string, builtinId: string) {
  if (eventType === "Wedding") {
    return WEDDING_SPLIT_LOCATION_EXTRA_IDS.has(builtinId);
  }
  if (eventType === "Wisuda") {
    return WISUDA_SPLIT_LOCATION_EXTRA_IDS.has(builtinId);
  }
  return false;
}

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

function sanitizeNumericCustomFieldValue(value: string): string {
  return value.replace(/\D+/g, "");
}

function hasDateTimeTimePart(value: string | null | undefined) {
  if (!value) return false;
  const normalized = value.trim();
  if (!normalized) return false;
  const [, timePart = ""] = normalized.split("T");
  return timePart.trim().length > 0;
}

function getBuiltInFieldIcon(builtinId: BuiltInFieldId): LucideIcon {
  if (builtinId.startsWith("extra:")) return List;

  switch (builtinId) {
    case "client_name":
      return User;
    case "client_whatsapp":
      return Phone;
    case "instagram":
      return AtSign;
    case "event_type":
      return Tag;
    case "session_date":
    case "akad_date":
    case "resepsi_date":
    case "wisuda_session1_date":
    case "wisuda_session2_date":
      return CalendarDays;
    case "session_time":
    case "akad_time":
    case "resepsi_time":
    case "wisuda_session1_time":
    case "wisuda_session2_time":
      return Clock3;
    case "location":
    case "location_detail":
      return MapPin;
    case "notes":
      return FileText;
    case "service_package":
    case "addon_packages":
      return Package;
    case "dp_paid":
      return Banknote;
    case "bank_accounts":
      return CreditCard;
    case "payment_proof":
      return FileText;
    default:
      return List;
  }
}

type SummaryRow = {
  label: string;
  value: string;
  icon?: LucideIcon;
  startsSessionGroup?: boolean;
};

const BOOKING_FORM_DRAFT_VERSION = 1;
const BOOKING_FORM_DRAFT_WRITE_DELAY_MS = 250;

type BookingFormDraft = {
  version: typeof BOOKING_FORM_DRAFT_VERSION;
  clientName: string;
  countryCode: string;
  phone: string;
  eventType: string;
  sessionDate: string;
  selectedCityCode: string;
  selectedServiceIds: string[];
  selectedServiceQuantities: BookingServiceQuantityMap;
  selectedAddons: string[];
  selectedAddonQuantities: BookingServiceQuantityMap;
  dpDisplay: string;
  location: string;
  locationCoords: LocationCoordinates;
  locationDetail: string;
  notes: string;
  instagram: string;
  customFields: Record<string, string>;
  extraData: Record<string, string>;
  extraLocationCoords: Record<string, LocationCoordinates>;
  splitDates: boolean;
  akadDate: string;
  resepsiDate: string;
  wisudaSession1Date: string;
  wisudaSession2Date: string;
  selectedPaymentMethod: PaymentMethod | null;
  selectedPaymentSource: PaymentSource | null;
  termsAccepted: boolean;
  termsViewedOnce: boolean;
  currentStep: BookingStep;
  maxUnlockedStep: BookingStep;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeStringRecord(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(asRecord(value)).flatMap(([key, rawValue]) =>
      typeof rawValue === "string" ? [[key, rawValue]] : [],
    ),
  );
}

function normalizeNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeLocationCoordinatesValue(value: unknown): LocationCoordinates {
  const record = asRecord(value);
  return {
    lat: normalizeNullableNumber(record.lat),
    lng: normalizeNullableNumber(record.lng),
  };
}

function normalizeExtraLocationCoordinatesValue(
  value: unknown,
): Record<string, LocationCoordinates> {
  return Object.fromEntries(
    Object.entries(asRecord(value)).map(([key, rawValue]) => [
      key,
      normalizeLocationCoordinatesValue(rawValue),
    ]),
  );
}

function normalizeBookingServiceQuantityRecord(
  value: unknown,
): BookingServiceQuantityMap {
  return Object.fromEntries(
    Object.entries(asRecord(value)).map(([key, rawValue]) => [
      key,
      normalizeBookingServiceQuantity(rawValue),
    ]),
  );
}

function normalizeBookingStepValue(value: unknown): BookingStep {
  if (value === 2 || value === 3 || value === 4) return value;
  return 1;
}

function normalizePaymentMethodValue(value: unknown): PaymentMethod | null {
  if (value === "bank" || value === "qris" || value === "cash") {
    return value;
  }
  return null;
}

function normalizePaymentSourceValue(value: unknown): PaymentSource | null {
  const record = asRecord(value);
  const type = normalizePaymentMethodValue(record.type);
  if (!type) return null;

  if (type === "bank") {
    const bankId =
      typeof record.bank_id === "string" && record.bank_id.trim().length > 0
        ? record.bank_id.trim()
        : "";
    const bankName =
      typeof record.bank_name === "string" ? record.bank_name : "";
    const accountNumber =
      typeof record.account_number === "string" ? record.account_number : "";
    const accountName =
      typeof record.account_name === "string" ? record.account_name : "";
    const label =
      typeof record.label === "string" && record.label.trim().length > 0
        ? record.label
        : bankName;

    if (!bankId) return null;

    return {
      type,
      bank_id: bankId,
      bank_name: bankName,
      account_number: accountNumber,
      account_name: accountName,
      label,
    };
  }

  return {
    type,
    label:
      typeof record.label === "string" && record.label.trim().length > 0
        ? record.label
        : getPaymentMethodLabel(type),
  };
}

function buildBookingFormDraftStorageKey({
  vendorId,
  slug,
  offerToken,
}: {
  vendorId: string;
  slug: string;
  offerToken?: string | null;
}) {
  return [
    "clientdesk",
    "booking-form-draft",
    String(BOOKING_FORM_DRAFT_VERSION),
    vendorId.trim() || "unknown-vendor",
    slug.trim() || "slugless",
    offerToken?.trim() || "default",
  ]
    .map((part) => encodeURIComponent(part))
    .join(":");
}

function parseBookingFormDraft(raw: string | null): BookingFormDraft | null {
  if (!raw) return null;

  try {
    const parsed = asRecord(JSON.parse(raw));
    if (parsed.version !== BOOKING_FORM_DRAFT_VERSION) {
      return null;
    }

    const selectedServiceIds = normalizeUuidList(parsed.selectedServiceIds);
    const selectedAddons = normalizeUuidList(parsed.selectedAddons);
    const maxUnlockedStep = normalizeBookingStepValue(parsed.maxUnlockedStep);
    const currentStep = normalizeBookingStepValue(parsed.currentStep);
    const normalizedCurrentStep =
      currentStep > maxUnlockedStep ? maxUnlockedStep : currentStep;
    const termsAccepted = parsed.termsAccepted === true;
    const termsViewedOnce =
      parsed.termsViewedOnce === true || termsAccepted;

    return {
      version: BOOKING_FORM_DRAFT_VERSION,
      clientName:
        typeof parsed.clientName === "string" ? parsed.clientName : "",
      countryCode:
        typeof parsed.countryCode === "string" && parsed.countryCode.trim().length > 0
          ? parsed.countryCode
          : "+62",
      phone: typeof parsed.phone === "string" ? parsed.phone : "",
      eventType: typeof parsed.eventType === "string" ? parsed.eventType : "",
      sessionDate:
        typeof parsed.sessionDate === "string" ? parsed.sessionDate : "",
      selectedCityCode:
        typeof parsed.selectedCityCode === "string" ? parsed.selectedCityCode : "",
      selectedServiceIds,
      selectedServiceQuantities: normalizeBookingServiceQuantityMap(
        normalizeBookingServiceQuantityRecord(parsed.selectedServiceQuantities),
        { selectedIds: selectedServiceIds },
      ),
      selectedAddons,
      selectedAddonQuantities: normalizeBookingServiceQuantityMap(
        normalizeBookingServiceQuantityRecord(parsed.selectedAddonQuantities),
        { selectedIds: selectedAddons },
      ),
      dpDisplay: typeof parsed.dpDisplay === "string" ? parsed.dpDisplay : "",
      location: typeof parsed.location === "string" ? parsed.location : "",
      locationCoords: normalizeLocationCoordinatesValue(parsed.locationCoords),
      locationDetail:
        typeof parsed.locationDetail === "string" ? parsed.locationDetail : "",
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
      instagram: typeof parsed.instagram === "string" ? parsed.instagram : "",
      customFields: normalizeStringRecord(parsed.customFields),
      extraData: normalizeStringRecord(parsed.extraData),
      extraLocationCoords: normalizeExtraLocationCoordinatesValue(
        parsed.extraLocationCoords,
      ),
      splitDates: parsed.splitDates === true,
      akadDate: typeof parsed.akadDate === "string" ? parsed.akadDate : "",
      resepsiDate:
        typeof parsed.resepsiDate === "string" ? parsed.resepsiDate : "",
      wisudaSession1Date:
        typeof parsed.wisudaSession1Date === "string"
          ? parsed.wisudaSession1Date
          : "",
      wisudaSession2Date:
        typeof parsed.wisudaSession2Date === "string"
          ? parsed.wisudaSession2Date
          : "",
      selectedPaymentMethod: normalizePaymentMethodValue(
        parsed.selectedPaymentMethod,
      ),
      selectedPaymentSource: normalizePaymentSourceValue(
        parsed.selectedPaymentSource,
      ),
      termsAccepted,
      termsViewedOnce,
      currentStep: normalizedCurrentStep,
      maxUnlockedStep,
    };
  } catch {
    return null;
  }
}

function compareServicesByCatalogOrder(a: Service, b: Service) {
  const aSort = typeof a.sort_order === "number" ? a.sort_order : Number.MAX_SAFE_INTEGER;
  const bSort = typeof b.sort_order === "number" ? b.sort_order : Number.MAX_SAFE_INTEGER;
  if (aSort !== bSort) return aSort - bSort;
  const aCreatedAt = a.created_at || "";
  const bCreatedAt = b.created_at || "";
  if (aCreatedAt !== bCreatedAt) return aCreatedAt.localeCompare(bCreatedAt);
  return a.name.localeCompare(b.name);
}

function extractSlugFromPath(pathname: string) {
  const match = pathname.match(/\/formbooking\/([^/?#]+)/i);
  if (match && match[1]) {
    return decodeURIComponent(match[1]).trim();
  }
  return "";
}

async function optimizePaymentProofImageForUpload(file: File) {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  let candidateFile = file;
  for (const step of PAYMENT_PROOF_IMAGE_COMPRESSION_STEPS) {
    if (candidateFile.size <= PAYMENT_PROOF_MAX_BYTES) break;
    const compressedBlob = await compressImage(
      candidateFile,
      step.maxSize,
      step.quality,
    );
    const fileBaseName = file.name.replace(/\.[^/.]+$/, "") || "payment-proof";
    candidateFile = new File(
      [compressedBlob],
      `${fileBaseName}.jpg`,
      {
        type: "image/jpeg",
        lastModified: Date.now(),
      },
    );
  }

  return candidateFile;
}

function getDisplayLabelForBuiltInField(
  item: Extract<FormLayoutItem, { kind: "builtin_field" }>,
  fallback: string,
) {
  if (typeof item.labelOverride !== "string") return fallback;
  return item.labelOverride.trim().length > 0 ? item.labelOverride : fallback;
}

function getDisplayDescriptionForField(
  item:
    | Extract<FormLayoutItem, { kind: "builtin_field" }>
    | Extract<FormLayoutItem, { kind: "custom_field" }>,
) {
  if (typeof item.description !== "string") return "";
  return item.description.trim().length > 0 ? item.description : "";
}

function isPaymentConfirmField(item: FormLayoutItem) {
  return (
    item.kind === "builtin_field" &&
    PAYMENT_CONFIRM_BUILTIN_IDS.has(item.builtinId)
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BookingFormClientProps {
  vendor: Vendor;
  services: Service[];
  cities: CityReferenceItem[];
  vendorSlug?: string;
  specialOfferToken?: string | null;
  specialOfferStatus?: BookingSpecialOfferStatus;
  specialOfferRule?: {
    id: string;
    name: string;
    eventTypeLocked: boolean;
    eventTypes: string[];
    packageLocked: boolean;
    packageServiceIds: string[];
    addonLocked: boolean;
    addonServiceIds: string[];
    accommodationFee: number;
    discountAmount: number;
    disableDp: boolean;
  } | null;
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
    | "form_show_addons"
    | "form_allow_multiple_packages"
    | "form_allow_multiple_addons"
    | "form_hide_service_prices"
    | "form_show_wedding_split"
    | "form_show_wisuda_split"
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
> & {
  preview_editor_event_type?: string | null;
  preview_editor_layout_mode?: FormLayoutMode | null;
};

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
  cities,
  vendorSlug,
  specialOfferToken,
  specialOfferStatus,
  specialOfferRule,
}: BookingFormClientProps) {
  const params = useParams();
  const searchParams = useSearchParams();
  const slugFromParams =
    typeof params?.vendorSlug === "string" ? params.vendorSlug : "";
  const slug = vendorSlug || slugFromParams;
  const localeCode = params?.locale === "en" ? "en" : "id";
  const t = useTranslations("BookingForm");
  const tenant = useTenant();
  const showPoweredBy = !shouldHideTenantBranding({
    id: tenant.id,
    domain: tenant.domain,
  });
  const normalizedOfferToken = normalizeSpecialOfferToken(specialOfferToken);
  const previewMode = searchParams.get("preview") === "1";
  const previewStorageKey = searchParams.get("previewKey") || "";
  const draftStorageKey = React.useMemo(
    () =>
      previewMode
        ? ""
        : buildBookingFormDraftStorageKey({
            vendorId: vendor.id,
            slug,
            offerToken: normalizedOfferToken,
          }),
    [normalizedOfferToken, previewMode, slug, vendor.id],
  );
  const [previewVendor, setPreviewVendor] = React.useState<PreviewVendorPayload | null>(null);
  const lastAppliedPreviewEditorSyncKeyRef = React.useRef<string | null>(null);
  const previewEditorEventTypeRaw =
    typeof previewVendor?.preview_editor_event_type === "string"
      ? previewVendor.preview_editor_event_type.trim()
      : "";
  const previewEditorEventType = previewEditorEventTypeRaw
    ? normalizeEventTypeName(previewEditorEventTypeRaw) || previewEditorEventTypeRaw
    : "";
  const previewEditorLayoutMode: FormLayoutMode | null =
    previewVendor?.preview_editor_layout_mode === "split" ||
    previewVendor?.preview_editor_layout_mode === "normal"
      ? previewVendor.preview_editor_layout_mode
      : null;

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

  React.useEffect(() => {
    if (!previewMode || typeof window === "undefined") return;

    function handlePreviewLinkClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");
      const href = anchor?.getAttribute("href");
      if (!anchor || !href) return;
      event.preventDefault();
      window.open(anchor.href, "_blank", "noopener,noreferrer");
    }

    document.addEventListener("click", handlePreviewLinkClick, true);
    return () => document.removeEventListener("click", handlePreviewLinkClick, true);
  }, [previewMode]);

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
        form_allow_multiple_packages:
          previewVendor?.form_allow_multiple_packages ??
          vendor.form_allow_multiple_packages ??
          true,
        form_allow_multiple_addons:
          previewVendor?.form_allow_multiple_addons ??
          vendor.form_allow_multiple_addons ??
          true,
      };
    },
    [previewVendor, vendor],
  );

  // ── Submission state ──
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [resolvedSpecialOfferStatus, setResolvedSpecialOfferStatus] =
    React.useState<BookingSpecialOfferStatus>(() => {
      if (specialOfferStatus) return specialOfferStatus;
      return normalizedOfferToken && specialOfferRule ? "active" : "none";
    });
  const [resultData, setResultData] = React.useState<{
    bookingCode?: string;
    vendorWhatsapp?: string;
    vendorName?: string;
    bookingConfirmTemplate?: string | null;
  } | null>(null);

  // ── Form state ──
  const [clientName, setClientName] = React.useState("");
  const [countryCode, setCountryCode] = React.useState("+62");
  const [phone, setPhone] = React.useState("");
  const [eventType, setEventType] = React.useState("");
  const [sessionDate, setSessionDate] = React.useState("");
  const [selectedCityCode, setSelectedCityCode] = React.useState("");
  const [selectedServiceIds, setSelectedServiceIds] = React.useState<string[]>([]);
  const [selectedServiceQuantities, setSelectedServiceQuantities] =
    React.useState<BookingServiceQuantityMap>({});
  const [selectedAddons, setSelectedAddons] = React.useState<Set<string>>(new Set());
  const [selectedAddonQuantities, setSelectedAddonQuantities] =
    React.useState<BookingServiceQuantityMap>({});
  const [dpDisplay, setDpDisplay] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [locationCoords, setLocationCoords] = React.useState<LocationCoordinates>({
    lat: null,
    lng: null,
  });
  const [locationDetail, setLocationDetail] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [instagram, setInstagram] = React.useState("");
  const [customFields, setCustomFields] = React.useState<Record<string, string>>({});
  const [extraData, setExtraData] = React.useState<Record<string, string>>({});
  const [extraLocationCoords, setExtraLocationCoords] = React.useState<
    Record<string, LocationCoordinates>
  >({});
  const [splitDates, setSplitDates] = React.useState(false);
  const [akadDate, setAkadDate] = React.useState("");
  const [resepsiDate, setResepsiDate] = React.useState("");
  const [wisudaSession1Date, setWisudaSession1Date] = React.useState("");
  const [wisudaSession2Date, setWisudaSession2Date] = React.useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = React.useState<PaymentMethod | null>(null);
  const [selectedPaymentSource, setSelectedPaymentSource] = React.useState<PaymentSource | null>(null);
  const [proofFile, setProofFile] = React.useState<File | null>(null);
  const [proofPreview, setProofPreview] = React.useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = React.useState(false);
  const [termsAccepted, setTermsAccepted] = React.useState(false);
  const [termsDialogOpen, setTermsDialogOpen] = React.useState(false);
  const [termsViewedOnce, setTermsViewedOnce] = React.useState(false);
  const [packageDialogOpen, setPackageDialogOpen] = React.useState(false);
  const [addonDialogOpen, setAddonDialogOpen] = React.useState(false);
  const [packageViewMode, setPackageViewMode] = React.useState<"list" | "grid">("list");
  const [addonViewMode, setAddonViewMode] = React.useState<"list" | "grid">("list");
  const [packageSearchQuery, setPackageSearchQuery] = React.useState("");
  const [addonSearchQuery, setAddonSearchQuery] = React.useState("");
  const [error, setError] = React.useState("");
  const [currentStep, setCurrentStep] = React.useState<BookingStep>(1);
  const [maxUnlockedStep, setMaxUnlockedStep] = React.useState<BookingStep>(1);
  const [confirmationSubmitEnabled, setConfirmationSubmitEnabled] =
    React.useState(true);
  const [draftHydrated, setDraftHydrated] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement | null>(null);

  const autoDpAmountRef = React.useRef<number | null>(null);
  const confirmationSubmitTimerRef = React.useRef<number | null>(null);
  const isSpecialOfferActive = Boolean(
    resolvedSpecialOfferStatus === "active" &&
      normalizedOfferToken &&
      specialOfferRule,
  );
  const isSpecialOfferDpDisabled =
    isSpecialOfferActive && specialOfferRule?.disableDp === true;
  const eventTypeLocked = isSpecialOfferActive && specialOfferRule?.eventTypeLocked === true;
  const packageLocked = isSpecialOfferActive && specialOfferRule?.packageLocked === true;
  const addonLocked = isSpecialOfferActive && specialOfferRule?.addonLocked === true;
  const allowMultiplePackages = effectiveVendor.form_allow_multiple_packages ?? true;
  const allowMultipleAddons = effectiveVendor.form_allow_multiple_addons ?? true;
  const shouldHideServicePrices =
    effectiveVendor.form_hide_service_prices === true && !isSpecialOfferActive;
  const accommodationFee = isSpecialOfferActive ? specialOfferRule?.accommodationFee || 0 : 0;
  const discountAmount = isSpecialOfferActive ? specialOfferRule?.discountAmount || 0 : 0;
  const specialEventTypes = React.useMemo(
    () => normalizeEventTypeList(specialOfferRule?.eventTypes),
    [specialOfferRule?.eventTypes],
  );
  const specialPackageServiceIds = React.useMemo(() => {
    if (!specialOfferRule) return [];
    const mainIds = services
      .filter((service) => !service.is_addon)
      .map((service) => service.id);
    const mainIdSet = new Set(mainIds);
    return normalizeUuidList(specialOfferRule.packageServiceIds).filter((id) =>
      mainIdSet.has(id),
    );
  }, [services, specialOfferRule]);
  const specialAddonServiceIds = React.useMemo(() => {
    if (!specialOfferRule) return [];
    const addonIds = services
      .filter((service) => service.is_addon)
      .map((service) => service.id);
    const addonIdSet = new Set(addonIds);
    return normalizeUuidList(specialOfferRule.addonServiceIds).filter((id) =>
      addonIdSet.has(id),
    );
  }, [services, specialOfferRule]);

  React.useEffect(() => {
    if (!specialOfferStatus) return;
    setResolvedSpecialOfferStatus(specialOfferStatus);
  }, [specialOfferStatus]);

  const clearConfirmationSubmitTimer = React.useCallback(() => {
    if (confirmationSubmitTimerRef.current === null || typeof window === "undefined") {
      return;
    }
    window.clearTimeout(confirmationSubmitTimerRef.current);
    confirmationSubmitTimerRef.current = null;
  }, []);

  const temporarilyDisableConfirmationSubmit = React.useCallback(() => {
    clearConfirmationSubmitTimer();
    setConfirmationSubmitEnabled(false);
    if (typeof window === "undefined") return;
    confirmationSubmitTimerRef.current = window.setTimeout(() => {
      confirmationSubmitTimerRef.current = null;
      setConfirmationSubmitEnabled(true);
    }, CONFIRMATION_SUBMIT_GUARD_MS);
  }, [clearConfirmationSubmitTimer]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!draftStorageKey) {
      setDraftHydrated(true);
      return;
    }

    const raw = window.sessionStorage.getItem(draftStorageKey);
    const draft = parseBookingFormDraft(raw);
    if (!draft) {
      if (raw) {
        window.sessionStorage.removeItem(draftStorageKey);
      }
      setDraftHydrated(true);
      return;
    }

    setClientName(draft.clientName);
    setCountryCode(draft.countryCode);
    setPhone(draft.phone);
    setEventType(draft.eventType);
    setSessionDate(draft.sessionDate);
    setSelectedCityCode(draft.selectedCityCode);
    setSelectedServiceIds(draft.selectedServiceIds);
    setSelectedServiceQuantities(draft.selectedServiceQuantities);
    setSelectedAddons(new Set(draft.selectedAddons));
    setSelectedAddonQuantities(draft.selectedAddonQuantities);
    setDpDisplay(draft.dpDisplay);
    setLocation(draft.location);
    setLocationCoords(draft.locationCoords);
    setLocationDetail(draft.locationDetail);
    setNotes(draft.notes);
    setInstagram(draft.instagram);
    setCustomFields(draft.customFields);
    setExtraData(draft.extraData);
    setExtraLocationCoords(draft.extraLocationCoords);
    setSplitDates(draft.splitDates);
    setAkadDate(draft.akadDate);
    setResepsiDate(draft.resepsiDate);
    setWisudaSession1Date(draft.wisudaSession1Date);
    setWisudaSession2Date(draft.wisudaSession2Date);
    setSelectedPaymentMethod(draft.selectedPaymentMethod);
    setSelectedPaymentSource(draft.selectedPaymentSource);
    setTermsAccepted(draft.termsAccepted);
    setTermsViewedOnce(draft.termsViewedOnce);
    setCurrentStep(draft.currentStep);
    setMaxUnlockedStep(draft.maxUnlockedStep);
    setDraftHydrated(true);
  }, [draftStorageKey]);

  React.useEffect(() => {
    if (
      effectiveVendor.form_show_addons === false &&
      selectedAddons.size > 0 &&
      !isSpecialOfferActive
    ) {
      setSelectedAddons(new Set());
      setSelectedAddonQuantities({});
    }
    if (effectiveVendor.form_show_addons === false && addonDialogOpen) {
      setAddonDialogOpen(false);
    }
  }, [
    addonDialogOpen,
    effectiveVendor.form_show_addons,
    isSpecialOfferActive,
    selectedAddons.size,
  ]);

  React.useEffect(() => {
    if (!isSpecialOfferActive) return;
    if (packageLocked) {
      setSelectedServiceIds((prev) => {
        const prevNormalized = normalizeUuidList(prev);
        if (
          prevNormalized.length === specialPackageServiceIds.length &&
          prevNormalized.every((id) => specialPackageServiceIds.includes(id))
        ) {
          return prev;
        }
        return [...specialPackageServiceIds];
      });
      setSelectedServiceQuantities(
        normalizeBookingServiceQuantityMap(
          Object.fromEntries(
            specialPackageServiceIds.map((serviceId) => [serviceId, 1]),
          ),
          {
            selectedIds: specialPackageServiceIds,
            forceSingleUnit: true,
          },
        ),
      );
    }
    if (addonLocked) {
      setSelectedAddons((prev) => {
        const prevNormalized = normalizeUuidList(Array.from(prev));
        if (
          prevNormalized.length === specialAddonServiceIds.length &&
          prevNormalized.every((id) => specialAddonServiceIds.includes(id))
        ) {
          return prev;
        }
        return new Set(specialAddonServiceIds);
      });
      setSelectedAddonQuantities(
        normalizeBookingServiceQuantityMap(
          Object.fromEntries(
            specialAddonServiceIds.map((serviceId) => [serviceId, 1]),
          ),
          {
            selectedIds: specialAddonServiceIds,
            forceSingleUnit: true,
          },
        ),
      );
    }
  }, [
    addonLocked,
    isSpecialOfferActive,
    packageLocked,
    specialAddonServiceIds,
    specialPackageServiceIds,
  ]);

  React.useEffect(() => {
    if (!isSpecialOfferActive || specialEventTypes.length === 0) return;
    if (eventTypeLocked) {
      setEventType((current) =>
        specialEventTypes.includes(current) ? current : specialEventTypes[0],
      );
      return;
    }
    setEventType((current) => (current ? current : specialEventTypes[0]));
  }, [eventTypeLocked, isSpecialOfferActive, specialEventTypes]);

  React.useEffect(() => {
    if (!eventType) {
      setPackageDialogOpen(false);
      setAddonDialogOpen(false);
    }
  }, [eventType]);

  React.useEffect(() => {
    if (!splitDates) return;

    if (eventType === "Wedding" && effectiveVendor.form_show_wedding_split === false) {
      setSplitDates(false);
      return;
    }

    if (eventType === "Wisuda" && effectiveVendor.form_show_wisuda_split === false) {
      setSplitDates(false);
    }
  }, [
    effectiveVendor.form_show_wedding_split,
    effectiveVendor.form_show_wisuda_split,
    eventType,
    splitDates,
  ]);

  // ── Helpers ──

  function getMinDpForEvent(et?: string): { mode: "percent" | "fixed"; value: number } {
    const normalizedEventKey = normalizeEventTypeName(et ?? eventType);
    const fallbackPercent = effectiveVendor.min_dp_percent ?? 50;
    const dpMap = effectiveVendor.min_dp_map;
    const entry =
      normalizedEventKey && dpMap
        ? dpMap[normalizedEventKey] ??
          (normalizedEventKey === PUBLIC_CUSTOM_EVENT_TYPE
            ? dpMap[LEGACY_PUBLIC_CUSTOM_EVENT_TYPE]
            : undefined)
        : undefined;
    if (entry !== undefined) {
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
    if (packageLocked) return;
    setSelectedServiceIds((prev) => {
      if (!allowMultiplePackages) {
        return prev.includes(id) ? [] : [id];
      }
      return prev.includes(id)
        ? prev.filter((serviceId) => serviceId !== id)
        : [...prev, id];
    });
    setSelectedServiceQuantities((prev) => {
      if (!allowMultiplePackages) {
        return id in prev && Object.keys(prev).length === 1 ? {} : { [id]: 1 };
      }
      const next = { ...prev };
      if (id in next) {
        delete next[id];
      } else {
        next[id] = 1;
      }
      return next;
    });
  }

  function handleAddonToggle(id: string) {
    if (addonLocked) return;
    setSelectedAddons((prev) => {
      if (!allowMultipleAddons) {
        if (prev.has(id)) {
          return new Set<string>();
        }
        return new Set([id]);
      }
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectedAddonQuantities((prev) => {
      if (!allowMultipleAddons) {
        return id in prev && Object.keys(prev).length === 1 ? {} : { [id]: 1 };
      }
      const next = { ...prev };
      if (id in next) {
        delete next[id];
      } else {
        next[id] = 1;
      }
      return next;
    });
  }

  function changeServiceQuantity(
    kind: "main" | "addon",
    serviceId: string,
    nextQuantity: number,
  ) {
    const normalizedQuantity = normalizeBookingServiceQuantity(nextQuantity);
    if (kind === "main") {
      if (!allowMultiplePackages || packageLocked) return;
      setSelectedServiceIds((prev) =>
        prev.includes(serviceId) ? prev : [...prev, serviceId],
      );
      setSelectedServiceQuantities((prev) => ({
        ...prev,
        [serviceId]: normalizedQuantity,
      }));
      return;
    }
    if (!allowMultipleAddons || addonLocked) return;
    setSelectedAddons((prev) => new Set(prev).add(serviceId));
    setSelectedAddonQuantities((prev) => ({
      ...prev,
      [serviceId]: normalizedQuantity,
    }));
  }

  function renderQuantityControl(
    kind: "main" | "addon",
    serviceId: string,
    quantity: number,
  ) {
    const canAdjust =
      kind === "main"
        ? allowMultiplePackages && !packageLocked
        : allowMultipleAddons && !addonLocked;
    const normalizedQuantity = normalizeBookingServiceQuantity(quantity);

    if (!canAdjust) {
      return normalizedQuantity > 1 ? (
        <span className="text-xs font-medium text-muted-foreground">
          x{normalizedQuantity}
        </span>
      ) : null;
    }

    return (
      <div className="inline-flex items-center gap-1 rounded-full border px-1 py-0.5">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            changeServiceQuantity(kind, serviceId, normalizedQuantity - 1);
          }}
          disabled={normalizedQuantity <= 1}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Kurangi jumlah"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-6 text-center text-xs font-semibold">
          {normalizedQuantity}
        </span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            changeServiceQuantity(kind, serviceId, normalizedQuantity + 1);
          }}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted/60"
          aria-label="Tambah jumlah"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  async function handleProofFile(file: File | null) {
    setError("");

    if (!file) {
      setProofFile(null);
      setProofPreview(null);
      return;
    }

    let nextFile = file;
    if (file.type.startsWith("image/")) {
      try {
        nextFile = await optimizePaymentProofImageForUpload(file);
      } catch {
        setError(
          localeCode === "en"
            ? "The selected image could not be processed. Please choose a different image."
            : "Gambar yang dipilih tidak dapat diproses. Silakan pilih gambar lain.",
        );
        setProofFile(null);
        setProofPreview(null);
        return;
      }
    }

    if (nextFile.size > PAYMENT_PROOF_MAX_BYTES) {
      setError(t("errorFileTooLarge"));
      setProofFile(null);
      setProofPreview(null);
      return;
    }

    setProofFile(nextFile);
    if (nextFile.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setProofPreview(reader.result as string);
      reader.readAsDataURL(nextFile);
    } else {
      setProofPreview(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (currentStep !== 4) {
      return;
    }
    if (!confirmationSubmitEnabled) {
      return;
    }
    setError("");

    const getVisibleBuiltInField = (builtinId: BuiltInFieldId) =>
      visibleActiveLayout.find(
        (item): item is Extract<FormLayoutItem, { kind: "builtin_field" }> =>
          item.kind === "builtin_field" && item.builtinId === builtinId,
      );
    const hasBuiltInField = (builtinId: BuiltInFieldId) =>
      Boolean(getVisibleBuiltInField(builtinId));
    const isRequiredBuiltInField = (builtinId: BuiltInFieldId) => {
      const builtInField = getVisibleBuiltInField(builtinId);
      if (!builtInField) return false;
      return resolveBuiltInFieldRequired(builtInField);
    };
    const hasExtraField = (key: string) =>
      hasBuiltInField(`extra:${key}`);
    const isWeddingEvent = eventType === "Wedding";
    const isWisudaEvent = eventType === "Wisuda";
    const isSplitSessionEnabled =
      splitDates && (isWeddingEvent || isWisudaEvent);

    const requiresClientName = isRequiredBuiltInField("client_name");
    const requiresClientWhatsapp = isRequiredBuiltInField("client_whatsapp");
    const requiresEventType = isRequiredBuiltInField("event_type");
    const requiresServicePackage = isRequiredBuiltInField("service_package");
    const requiresCitySelection = requiresServicePackage && isCityScopedEvent;
    const requiresSessionDate =
      isRequiredBuiltInField("session_date") &&
      !isSplitSessionEnabled;
    const requiresSessionTime =
      isRequiredBuiltInField("session_time") &&
      !isSplitSessionEnabled;
    const requiresAkadDate =
      isRequiredBuiltInField("akad_date") && isWeddingEvent && isSplitSessionEnabled;
    const requiresAkadTime =
      isRequiredBuiltInField("akad_time") && isWeddingEvent && isSplitSessionEnabled;
    const requiresResepsiDate =
      isRequiredBuiltInField("resepsi_date") && isWeddingEvent && isSplitSessionEnabled;
    const requiresResepsiTime =
      isRequiredBuiltInField("resepsi_time") && isWeddingEvent && isSplitSessionEnabled;
    const requiresWisudaSession1Date =
      isRequiredBuiltInField("wisuda_session1_date") &&
      isWisudaEvent &&
      isSplitSessionEnabled;
    const requiresWisudaSession1Time =
      isRequiredBuiltInField("wisuda_session1_time") &&
      isWisudaEvent &&
      isSplitSessionEnabled;
    const requiresWisudaSession2Date =
      isRequiredBuiltInField("wisuda_session2_date") &&
      isWisudaEvent &&
      isSplitSessionEnabled;
    const requiresWisudaSession2Time =
      isRequiredBuiltInField("wisuda_session2_time") &&
      isWisudaEvent &&
      isSplitSessionEnabled;
    const requiresLocation =
      isRequiredBuiltInField("location") && showsLocationField;

    if (requiresCitySelection && !normalizedSelectedCityCode) {
      setError(
        localeCode === "en"
          ? "Please select your city/regency before choosing a package."
          : "Pilih kota/kabupaten terlebih dahulu sebelum memilih paket.",
      );
      return;
    }

    if (
      (requiresClientName && !clientName.trim()) ||
      (requiresClientWhatsapp && !phone.trim()) ||
      (requiresEventType && !eventType) ||
      (requiresSessionDate && !sessionDate) ||
      (requiresSessionTime && !hasDateTimeTimePart(sessionDate)) ||
      (requiresAkadDate && !akadDate) ||
      (requiresAkadTime && !hasDateTimeTimePart(akadDate)) ||
      (requiresResepsiDate && !resepsiDate) ||
      (requiresResepsiTime && !hasDateTimeTimePart(resepsiDate)) ||
      (requiresWisudaSession1Date && !wisudaSession1Date) ||
      (requiresWisudaSession1Time && !hasDateTimeTimePart(wisudaSession1Date)) ||
      (requiresWisudaSession2Date && !wisudaSession2Date) ||
      (requiresWisudaSession2Time && !hasDateTimeTimePart(wisudaSession2Date)) ||
      (requiresServicePackage && selectedServiceIds.length === 0) ||
      (requiresLocation && !location)
    ) {
      setError(t("errorWajib"));
      return;
    }

    if (
      isWeddingEvent &&
      ((hasExtraField("tempat_akad") && !extraData.tempat_akad) ||
        (hasExtraField("tempat_resepsi") && !extraData.tempat_resepsi))
    ) {
      setError(t("errorLokasiWedding"));
      return;
    }
    if (
      isWisudaEvent &&
      isSplitSessionEnabled &&
      ((hasExtraField("tempat_wisuda_1") && !extraData.tempat_wisuda_1) ||
        (hasExtraField("tempat_wisuda_2") && !extraData.tempat_wisuda_2))
    ) {
      setError("Mohon lengkapi Lokasi Sesi 1 dan Lokasi Sesi 2.");
      return;
    }

    if (hasExtraField(UNIVERSITY_EXTRA_FIELD_KEY)) {
      const hasUniversityName = hasUniversityValue(extraData);
      const selectedUniversityRefId = getUniversityReferenceId(extraData);
      if (!hasUniversityName || !selectedUniversityRefId) {
        setError(t("errorUniversityRequired"));
        return;
      }
    }

    if (!isSpecialOfferDpDisabled && !selectedPaymentMethod) {
      setError(t("errorPaymentMethod"));
      return;
    }

    if (
      !isSpecialOfferDpDisabled &&
      selectedPaymentMethod === "bank" &&
      !selectedPaymentSource
    ) {
      setError(t("errorPaymentSource"));
      return;
    }

    if (
      !isSpecialOfferDpDisabled &&
      selectedPaymentMethod === "qris" &&
      !effectiveVendor.qris_image_url
    ) {
      setError(t("paymentNoQris"));
      return;
    }

    if (proofRequired && !proofFile) {
      setError(t("errorProof"));
      return;
    }

    if (hasTerms && !termsAccepted) {
      setError(t("errorTermsRequired"));
      return;
    }

    const normalizedCustomFields: Record<string, string> = { ...customFields };
    let customNumberFieldErrorLabel = "";
    let customFieldsNormalized = false;
    visibleActiveLayout.forEach((item) => {
      if (
        customNumberFieldErrorLabel ||
        item.kind !== "custom_field" ||
        item.type !== "number"
      ) {
        return;
      }

      const rawValue = customFields[item.id];
      if (typeof rawValue !== "string" || rawValue.length === 0) {
        return;
      }

      const sanitizedValue = sanitizeNumericCustomFieldValue(rawValue);
      if (!sanitizedValue) {
        customNumberFieldErrorLabel = item.label?.trim() || "";
        return;
      }

      if (sanitizedValue !== rawValue) {
        normalizedCustomFields[item.id] = sanitizedValue;
        customFieldsNormalized = true;
      }
    });

    if (customNumberFieldErrorLabel) {
      const fallbackLabel =
        localeCode === "en" ? "number field" : "field angka";
      const label = customNumberFieldErrorLabel || fallbackLabel;
      setError(
        localeCode === "en"
          ? `The "${label}" field must contain numbers only.`
          : `Field "${label}" harus diisi angka saja.`,
      );
      return;
    }

    if (customFieldsNormalized) {
      setCustomFields(normalizedCustomFields);
    }

    const fullPhone = `${countryCode}${phone}`.replace(/[^0-9+]/g, "");
    const dpValue = isSpecialOfferDpDisabled ? 0 : parseFormatted(dpDisplay) || 0;
    if (requiresCitySelection && !selectedCity) {
      setError(
        localeCode === "en"
          ? "Selected city/regency is invalid."
          : "Kota/kabupaten yang dipilih tidak valid.",
      );
      return;
    }
    const resolvedLocation = resolvePreferredLocation(
      isWeddingEvent
        ? [
            {
              address: extraData.tempat_akad,
              lat: extraLocationCoords.tempat_akad?.lat,
              lng: extraLocationCoords.tempat_akad?.lng,
            },
            {
              address: extraData.tempat_resepsi,
              lat: extraLocationCoords.tempat_resepsi?.lat,
              lng: extraLocationCoords.tempat_resepsi?.lng,
            },
            {
              address: location,
              lat: locationCoords.lat,
              lng: locationCoords.lng,
            },
          ]
        : isWisudaEvent && isSplitSessionEnabled
          ? [
              {
                address: extraData.tempat_wisuda_1,
                lat: extraLocationCoords.tempat_wisuda_1?.lat,
                lng: extraLocationCoords.tempat_wisuda_1?.lng,
              },
              {
                address: extraData.tempat_wisuda_2,
                lat: extraLocationCoords.tempat_wisuda_2?.lat,
                lng: extraLocationCoords.tempat_wisuda_2?.lng,
              },
              {
                address: location,
                lat: locationCoords.lat,
                lng: locationCoords.lng,
              },
            ]
        : [
            {
              address: location,
              lat: locationCoords.lat,
              lng: locationCoords.lng,
            },
          ],
    );
    const finalLocation = resolvedLocation.location;
    const activeSelectedMainServices = services.filter(
      (service) => !service.is_addon && selectedServiceIds.includes(service.id),
    );
    const activeSelectedService = activeSelectedMainServices[0] || null;
    const activeSelectedAddonTotal = services
      .filter((service) => service.is_addon && selectedAddons.has(service.id))
      .reduce(
        (sum, service) =>
          sum + service.price * (selectedAddonQuantityMap[service.id] || 1),
        0,
      );
    const activeSelectedPackageTotal = activeSelectedMainServices.reduce(
      (sum, service) =>
        sum + service.price * (selectedMainQuantities[service.id] || 1),
      0,
    );
    const activeSelectedBookingTotal = computeSpecialOfferTotal({
      packageTotal: activeSelectedPackageTotal,
      addonTotal: activeSelectedAddonTotal,
      accommodationFee,
      discountAmount,
    });

    const minDP = getMinDpForEvent();
    if (!isSpecialOfferDpDisabled && activeSelectedService) {
      const minAmount = calcMinDpAmount(activeSelectedBookingTotal, minDP);
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

    if (
      !isSpecialOfferDpDisabled &&
      proofFile &&
      selectedPaymentMethod !== "cash"
    ) {
      setUploadingProof(true);
    }

    try {
      const mergedExtra = { ...extraData };
      let finalSessionDate = sessionDate;
      if (isWeddingEvent && isSplitSessionEnabled) {
          mergedExtra.tanggal_akad = akadDate || "";
          mergedExtra.tanggal_resepsi = resepsiDate || "";
          if (akadDate && resepsiDate) {
              finalSessionDate = akadDate < resepsiDate ? akadDate : resepsiDate;
          } else {
              finalSessionDate = akadDate || resepsiDate || sessionDate;
          }
      } else if (isWisudaEvent && isSplitSessionEnabled) {
          mergedExtra.tanggal_wisuda_1 = wisudaSession1Date || "";
          mergedExtra.tanggal_wisuda_2 = wisudaSession2Date || "";
          if (wisudaSession1Date && wisudaSession2Date) {
              finalSessionDate =
                wisudaSession1Date < wisudaSession2Date
                  ? wisudaSession1Date
                  : wisudaSession2Date;
          } else {
              finalSessionDate =
                wisudaSession1Date || wisudaSession2Date || sessionDate;
          }
      } else if (isWisudaEvent) {
          delete mergedExtra.tanggal_wisuda_1;
          delete mergedExtra.tanggal_wisuda_2;
          delete mergedExtra.tempat_wisuda_1;
          delete mergedExtra.tempat_wisuda_2;
      }
      if (!hasExtraField(UNIVERSITY_EXTRA_FIELD_KEY)) {
        delete mergedExtra[UNIVERSITY_EXTRA_FIELD_KEY];
        delete mergedExtra[UNIVERSITY_REFERENCE_EXTRA_KEY];
      }
      delete mergedExtra.universitas_abbreviation_draft;
      const customFieldSnapshots = buildCustomFieldSnapshots(
        visibleActiveLayout,
        eventType || "Umum",
        normalizedCustomFields,
      );

      const formData = new FormData();
      const slugFromPath =
        typeof window !== "undefined"
          ? extractSlugFromPath(window.location.pathname)
          : "";
      formData.append("vendorId", vendor.id);
      formData.append("vendorSlug", slug);
      if (slugFromPath) {
        formData.append("vendorSlugPath", slugFromPath);
      }
      formData.append("clientName", clientName);
      formData.append("clientWhatsapp", fullPhone);
      formData.append("eventType", eventType || "");
      formData.append("sessionDate", finalSessionDate);
      formData.append("serviceId", selectedServiceIds[0] || "");
      formData.append(
        "serviceSelections",
        JSON.stringify([
          ...buildBookingServicePayloadItemsFromSelection(
            selectedServiceIds,
            selectedMainQuantities,
            "main",
          ),
          ...buildBookingServicePayloadItemsFromSelection(
            Array.from(selectedAddons),
            selectedAddonQuantityMap,
            "addon",
          ),
        ]),
      );
      formData.append("serviceIds", JSON.stringify(selectedServiceIds));
      formData.append("cityCode", isCityScopedEvent ? normalizedSelectedCityCode : "");
      formData.append(
        "cityName",
        isCityScopedEvent && selectedCity ? selectedCity.city_name : "",
      );
      if (normalizedOfferToken) {
        formData.append("offerToken", normalizedOfferToken);
      }
      formData.append("dpPaid", String(dpValue));
      formData.append("location", finalLocation || "");
      formData.append("locationLat", String(resolvedLocation.locationLat ?? ""));
      formData.append("locationLng", String(resolvedLocation.locationLng ?? ""));
      formData.append("locationDetail", locationDetail || "");
      formData.append("notes", notes || "");
      formData.append(
        "extraData",
        JSON.stringify({
          ...(Object.keys(mergedExtra).length > 0 ? mergedExtra : {}),
          ...(selectedAddons.size > 0
            ? {
                addon_ids: Array.from(selectedAddons),
                addon_names: selectedAddonServices.map((service) => {
                  const quantity = selectedAddonQuantityMap[service.id] || 1;
                  return quantity > 1 ? `${service.name} x${quantity}` : service.name;
                }),
              }
            : {}),
          ...(hasTerms
            ? {
                terms_accepted: true,
                terms_accepted_at: new Date().toISOString(),
              }
            : {}),
          ...(customFieldSnapshots.length > 0 ? { custom_fields: customFieldSnapshots } : {}),
        }),
      );
      if (!isSpecialOfferDpDisabled && selectedPaymentMethod) {
        formData.append("paymentMethod", selectedPaymentMethod);
        if (selectedPaymentSource) {
          formData.append("paymentSource", JSON.stringify(selectedPaymentSource));
        }
      }
      formData.append("instagram", instagram || "");
      if (
        !isSpecialOfferDpDisabled &&
        proofFile &&
        selectedPaymentMethod !== "cash"
      ) {
        formData.append("paymentProofFile", proofFile);
      }

      const res = await fetch("/api/public/booking", {
        method: "POST",
        body: formData,
      });

      const payload = (
        res.headers.get("content-type")?.includes("application/json")
          ? await res.json().catch(() => null)
          : null
      ) as
        | {
            success?: boolean;
            bookingCode?: string;
            vendorWhatsapp?: string;
            vendorName?: string;
            bookingConfirmTemplate?: string | null;
            code?: string;
            error?: string;
          }
        | null;

      if (!res.ok) {
        if (res.status === 413) {
          setError(t("errorFileTooLarge"));
          return;
        }
        if (payload?.code === SPECIAL_LINK_EXPIRED_ERROR_CODE) {
          setResolvedSpecialOfferStatus("expired");
          setError("");
          return;
        }
        setError(payload?.error || "Gagal mengirim booking.");
        return;
      }

      if (payload?.success) {
        if (draftStorageKey && typeof window !== "undefined") {
          window.sessionStorage.removeItem(draftStorageKey);
        }
        setSubmitted(true);
        setResultData(payload);
      } else if (payload?.code === SPECIAL_LINK_EXPIRED_ERROR_CODE) {
        setResolvedSpecialOfferStatus("expired");
        setError("");
      } else {
        setError(payload?.error || "Gagal mengirim booking.");
      }
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setUploadingProof(false);
      setSubmitting(false);
    }
  }

  function openWhatsAppConfirmation() {
    if (!resultData?.vendorWhatsapp) return;
    const wa = resultData.vendorWhatsapp
      .replace(/^0/, "62")
      .replace(/[^0-9]/g, "");
    const clientWhatsapp = `${countryCode}${phone}`.replace(/[^0-9+]/g, "") || "-";
    const svcName =
      selectedMainServices
        .map((service) => {
          const quantity = selectedMainQuantities[service.id] || 1;
          return quantity > 1 ? `${service.name} x${quantity}` : service.name;
        })
        .join(", ") || "-";
    const isWeddingEvent = eventType === "Wedding";
    const isWisudaEvent = eventType === "Wisuda";
    const isSplitSessionEnabled =
      splitDates && (isWeddingEvent || isWisudaEvent);

    const mergedExtraForTemplate = { ...extraData };
    let resolvedSessionDate = sessionDate;
    if (isWeddingEvent && isSplitSessionEnabled) {
      mergedExtraForTemplate.tanggal_akad = akadDate || "";
      mergedExtraForTemplate.tanggal_resepsi = resepsiDate || "";
      if (akadDate && resepsiDate) {
        resolvedSessionDate = akadDate < resepsiDate ? akadDate : resepsiDate;
      } else {
        resolvedSessionDate = akadDate || resepsiDate || sessionDate;
      }
    } else if (isWisudaEvent && isSplitSessionEnabled) {
      mergedExtraForTemplate.tanggal_wisuda_1 = wisudaSession1Date || "";
      mergedExtraForTemplate.tanggal_wisuda_2 = wisudaSession2Date || "";
      if (wisudaSession1Date && wisudaSession2Date) {
        resolvedSessionDate =
          wisudaSession1Date < wisudaSession2Date
            ? wisudaSession1Date
            : wisudaSession2Date;
      } else {
        resolvedSessionDate =
          wisudaSession1Date || wisudaSession2Date || sessionDate;
      }
    } else if (isWisudaEvent) {
      delete mergedExtraForTemplate.tanggal_wisuda_1;
      delete mergedExtraForTemplate.tanggal_wisuda_2;
      delete mergedExtraForTemplate.tempat_wisuda_1;
      delete mergedExtraForTemplate.tempat_wisuda_2;
    }

    const dateStr = resolvedSessionDate
      ? new Date(resolvedSessionDate).toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "-";
    const dpVal = isSpecialOfferDpDisabled ? 0 : parseFormatted(dpDisplay) || 0;
    const resolvedLocation = resolvePreferredLocation(
      isWeddingEvent
        ? [
            {
              address: extraData.tempat_akad,
              lat: extraLocationCoords.tempat_akad?.lat,
              lng: extraLocationCoords.tempat_akad?.lng,
            },
            {
              address: extraData.tempat_resepsi,
              lat: extraLocationCoords.tempat_resepsi?.lat,
              lng: extraLocationCoords.tempat_resepsi?.lng,
            },
            {
              address: location,
              lat: locationCoords.lat,
              lng: locationCoords.lng,
            },
          ]
        : isWisudaEvent && isSplitSessionEnabled
          ? [
              {
                address: extraData.tempat_wisuda_1,
                lat: extraLocationCoords.tempat_wisuda_1?.lat,
                lng: extraLocationCoords.tempat_wisuda_1?.lng,
              },
              {
                address: extraData.tempat_wisuda_2,
                lat: extraLocationCoords.tempat_wisuda_2?.lat,
                lng: extraLocationCoords.tempat_wisuda_2?.lng,
              },
              {
                address: location,
                lat: locationCoords.lat,
                lng: locationCoords.lng,
              },
            ]
        : [
            {
              address: location,
              lat: locationCoords.lat,
              lng: locationCoords.lng,
            },
          ],
    );
    const mapsUrl = buildGoogleMapsUrlOrFallback(
      {
        address: resolvedLocation.location,
        lat: resolvedLocation.locationLat,
        lng: resolvedLocation.locationLng,
      },
      "-",
    );
    const serviceSelectionsForTemplate: BookingServiceSelection[] = [
      ...selectedMainServices.map((service, index) => ({
        id: service.id,
        booking_service_id: null,
        kind: "main" as const,
        sort_order: index,
        quantity: selectedMainQuantities[service.id] || 1,
        service: {
          id: service.id,
          name: service.name,
          duration_minutes: service.duration_minutes ?? null,
          is_addon: service.is_addon ?? false,
          affects_schedule: service.affects_schedule ?? null,
        },
      })),
      ...selectedAddonServices.map((service, index) => ({
        id: service.id,
        booking_service_id: null,
        kind: "addon" as const,
        sort_order: index,
        quantity: selectedAddonQuantityMap[service.id] || 1,
        service: {
          id: service.id,
          name: service.name,
          duration_minutes: service.duration_minutes ?? null,
          is_addon: service.is_addon ?? true,
          affects_schedule: service.affects_schedule ?? null,
        },
      })),
    ];
    const msg =
      (resultData.bookingConfirmTemplate || "").trim()
        ? fillWhatsAppTemplate(
            resultData.bookingConfirmTemplate || "",
            buildBookingWhatsAppTemplateVars({
              booking: {
                client_name: clientName || "-",
                client_whatsapp: clientWhatsapp,
                instagram,
                booking_code: resultData.bookingCode || "-",
                session_date: resolvedSessionDate || null,
                total_price: selectedBookingTotal,
                dp_paid: dpVal,
                payment_method: selectedPaymentMethod,
                payment_source: selectedPaymentSource,
                event_type: eventType || null,
                location: resolvedLocation.location || null,
                location_lat: resolvedLocation.locationLat,
                location_lng: resolvedLocation.locationLng,
                location_detail: locationDetail || null,
                notes: notes || null,
                extra_fields: mergedExtraForTemplate,
                service_label: svcName,
                service_selections: serviceSelectionsForTemplate,
              },
              locale: localeCode,
              studioName: resultData.vendorName || "Admin",
              trackingLink: "-",
              invoiceUrl: "-",
            }),
          )
        : `Halo ${resultData.vendorName || "Admin"}, saya baru saja booking melalui form online.\n\n` +
          `📋 *Detail Booking*\n` +
          `Kode: *${resultData.bookingCode}*\n` +
          `Nama: ${clientName}\n` +
          `Paket: ${svcName}\n` +
          `Jadwal: ${dateStr}\n` +
          (resolvedLocation.location ? `Lokasi: ${resolvedLocation.location}\n` : "") +
          `\n💰 Total: ${formatCurrency(selectedBookingTotal)}\n` +
          `✅ DP: ${formatCurrency(dpVal)}\n` +
          `💳 Metode: ${selectedPaymentMethod ? getPaymentMethodLabel(selectedPaymentMethod) : "-"}\n` +
          `🏦 Sumber: ${getPaymentSourceLabel(selectedPaymentSource) || "-"}\n` +
          (proofFile ? "📎 Bukti transfer sudah diupload.\n" : "") +
          (instagram ? `📸 Instagram: ${instagram}\n` : "") +
          `\nMohon konfirmasi booking saya. Terima kasih! 🙏`;

    openWhatsAppUrl(buildWhatsAppUrl(wa, msg));
  }

  // ── Styles ──

  const inputClass =
    "placeholder:text-muted-foreground h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] transition-all";
  const selectClass =
    inputClass +
    " cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23999%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat pr-8";

  function buildFieldLabelNode({
    text,
    required,
    icon,
  }: {
    text: string;
    required?: boolean;
    icon?: LucideIcon;
  }) {
    const Icon = icon;
    return (
      <span className="inline-flex items-center gap-1.5">
        {Icon ? <Icon className="h-3.5 w-3.5 text-muted-foreground" /> : null}
        <span>{text}</span>
        {required ? <span className="text-red-500">*</span> : null}
      </span>
    );
  }

  const minDP = getMinDpForEvent();
  const normalizedEventType = normalizeEventTypeName(eventType) || eventType;
  const hasSelectedEventType = eventType.trim().length > 0;
  const isSplitCapableEventType = eventType === "Wedding" || eventType === "Wisuda";
  const isSplitLayoutMode = isSplitCapableEventType && splitDates;
  const activeLayoutMode: FormLayoutMode = isSplitLayoutMode ? "split" : "normal";
  const hideGeneralLocationForSplit = isSplitLayoutMode;
  const hideSplitLocationExtras = isSplitCapableEventType && !splitDates;
  const brandColor = resolveHexColor(effectiveVendor.form_brand_color, "#000000");
  const normalizedActiveLayout = React.useMemo(
    () =>
      resolveNormalizedLayoutFromStoredSections(
        effectiveVendor.form_sections,
        normalizedEventType || "Umum",
        { layoutMode: activeLayoutMode },
      ),
    [activeLayoutMode, effectiveVendor.form_sections, normalizedEventType],
  );
  const visibleActiveLayout = React.useMemo(
    () =>
      normalizedActiveLayout.filter((item) => {
        if (item.kind === "builtin_field" || item.kind === "custom_field") {
          if (item.hidden === true) return false;
          if (
            hideGeneralLocationForSplit &&
            item.kind === "builtin_field" &&
            item.builtinId === "location"
          ) {
            return false;
          }
          if (
            hideSplitLocationExtras &&
            item.kind === "builtin_field" &&
            isSplitLocationExtraBuiltinId(eventType, item.builtinId)
          ) {
            return false;
          }
          if (!hasSelectedEventType) {
            return (
              item.kind === "builtin_field" &&
              PRE_EVENT_SELECTION_BUILTIN_IDS.has(item.builtinId)
            );
          }
          return true;
        }
        return hasSelectedEventType;
      }),
    [
      eventType,
      hasSelectedEventType,
      hideGeneralLocationForSplit,
      hideSplitLocationExtras,
      normalizedActiveLayout,
    ],
  );
  const currentExtraFields = getLayoutExtraFields(visibleActiveLayout);
  const activeSections = React.useMemo(
    () =>
      groupFormLayoutBySection(
        normalizedActiveLayout,
        normalizedEventType || "Umum",
        { layoutMode: activeLayoutMode },
      ).map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (item.kind === "builtin_field" || item.kind === "custom_field") {
            if (item.hidden === true) return false;
            if (
              hideGeneralLocationForSplit &&
              item.kind === "builtin_field" &&
              item.builtinId === "location"
            ) {
              return false;
            }
            if (
              hideSplitLocationExtras &&
              item.kind === "builtin_field" &&
              isSplitLocationExtraBuiltinId(eventType, item.builtinId)
            ) {
              return false;
            }
            if (!hasSelectedEventType) {
              return (
                item.kind === "builtin_field" &&
                PRE_EVENT_SELECTION_BUILTIN_IDS.has(item.builtinId)
              );
            }
            return true;
          }
          return hasSelectedEventType;
        }),
      })),
    [
      eventType,
      hasSelectedEventType,
      hideGeneralLocationForSplit,
      hideSplitLocationExtras,
      normalizedActiveLayout,
      activeLayoutMode,
      normalizedEventType,
    ],
  );
  const infoStepSections = React.useMemo(
    () =>
      activeSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => {
            if (isPaymentConfirmField(item)) return false;
            if (
              item.kind === "builtin_field" &&
              PACKAGE_SELECTION_BUILTIN_IDS.has(item.builtinId)
            ) {
              return false;
            }
            return true;
          }),
        }))
        .filter((section) => section.items.length > 0),
    [activeSections],
  );
  const packageSelectionSections = React.useMemo(
    () =>
      activeSections
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) =>
              item.kind === "builtin_field" &&
              PACKAGE_SELECTION_BUILTIN_IDS.has(item.builtinId),
          ),
        }))
        .filter((section) => section.items.length > 0),
    [activeSections],
  );
  const paymentConfirmationSections = React.useMemo(
    () =>
      activeSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => isPaymentConfirmField(item)),
        }))
        .filter((section) => section.items.length > 0),
    [activeSections],
  );
  const showsLocationField =
    effectiveVendor.form_show_location !== false &&
    visibleActiveLayout.some(
      (item) =>
        item.kind === "builtin_field" &&
        item.builtinId === "location",
    );
  const availableEventTypes = React.useMemo(
    () =>
      getActiveEventTypes({
        customEventTypes: normalizeEventTypeList(effectiveVendor.custom_event_types),
        activeEventTypes: effectiveVendor.form_event_types,
      }),
    [effectiveVendor.custom_event_types, effectiveVendor.form_event_types],
  );
  const eventTypeOptions = React.useMemo(() => {
    if (!eventTypeLocked) return availableEventTypes;
    const whitelist = specialEventTypes.filter((item) =>
      availableEventTypes.includes(item),
    );
    return whitelist.length > 0 ? whitelist : availableEventTypes;
  }, [availableEventTypes, eventTypeLocked, specialEventTypes]);

  React.useEffect(() => {
    if (!previewMode) return;
    if (!previewEditorEventType || !previewEditorLayoutMode) {
      lastAppliedPreviewEditorSyncKeyRef.current = null;
      return;
    }
    if (!eventTypeOptions.includes(previewEditorEventType)) return;
    const syncKey = `${previewEditorEventType}:${previewEditorLayoutMode}`;
    if (lastAppliedPreviewEditorSyncKeyRef.current === syncKey) return;
    lastAppliedPreviewEditorSyncKeyRef.current = syncKey;
    const resolvedEventTypeForSync =
      eventType === previewEditorEventType
        ? eventType
        : previewEditorEventType;

    if (eventType !== previewEditorEventType) {
      setEventType(previewEditorEventType);
    }

    if (
      resolvedEventTypeForSync !== "Wedding" &&
      resolvedEventTypeForSync !== "Wisuda"
    ) {
      if (splitDates) setSplitDates(false);
      return;
    }

    const splitAllowed =
      resolvedEventTypeForSync === "Wedding"
        ? effectiveVendor.form_show_wedding_split !== false
        : effectiveVendor.form_show_wisuda_split !== false;
    const desiredSplit = previewEditorLayoutMode === "split" && splitAllowed;
    if (splitDates !== desiredSplit) {
      setSplitDates(desiredSplit);
    }
  }, [
    previewMode,
    previewEditorEventType,
    previewEditorLayoutMode,
    eventTypeOptions,
    eventType,
    splitDates,
    effectiveVendor.form_show_wedding_split,
    effectiveVendor.form_show_wisuda_split,
  ]);
  const isCityScopedEvent = React.useMemo(
    () => isCityScopedBookingEventType(eventType),
    [eventType],
  );
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
  const canAcceptTerms = termsViewedOnce;
  const proofRequired =
    !isSpecialOfferDpDisabled &&
    effectiveVendor.form_show_proof !== false &&
    Boolean(selectedPaymentMethod) &&
    selectedPaymentMethod !== "cash";
  const availablePaymentMethods = React.useMemo(
    () => {
      if (isSpecialOfferDpDisabled) return [];
      return effectiveVendor.form_payment_methods.length > 0
        ? effectiveVendor.form_payment_methods
        : (["bank"] as PaymentMethod[]);
    },
    [effectiveVendor.form_payment_methods, isSpecialOfferDpDisabled],
  );
  const enabledBankAccounts = React.useMemo(
    () => getEnabledBankAccounts(effectiveVendor.bank_accounts || []),
    [effectiveVendor.bank_accounts],
  );
  const sortedServices = React.useMemo(
    () => [...services].sort(compareServicesByCatalogOrder),
    [services],
  );
  const cityOptions = React.useMemo(
    () =>
      [...cities].sort((left, right) => {
        if (left.province_code !== right.province_code) {
          return left.province_code.localeCompare(right.province_code);
        }
        return left.city_name.localeCompare(right.city_name);
      }),
    [cities],
  );
  const normalizedSelectedCityCode = normalizeCityCode(selectedCityCode);
  const selectedCity = React.useMemo(
    () =>
      cityOptions.find((item) => item.city_code === normalizedSelectedCityCode) || null,
    [cityOptions, normalizedSelectedCityCode],
  );

  const handleTermsDialogOpenChange = React.useCallback((open: boolean) => {
    setTermsDialogOpen(open);
    if (open) {
      setTermsViewedOnce(true);
    }
  }, [setTermsDialogOpen, setTermsViewedOnce]);

  React.useEffect(() => {
    if (!hasTerms) {
      setTermsAccepted(false);
      setTermsViewedOnce(false);
      setTermsDialogOpen(false);
    }
  }, [hasTerms]);
  const filteredServices = React.useMemo(
    () =>
      filterServicesForBookingSelection(sortedServices, {
        eventType,
        cityCode: normalizedSelectedCityCode,
        group: "main",
      }),
    [eventType, normalizedSelectedCityCode, sortedServices],
  );
  const addonServices = React.useMemo(
    () =>
      filterServicesForBookingSelection(sortedServices, {
        eventType,
        cityCode: normalizedSelectedCityCode,
        group: "addon",
      }),
    [eventType, normalizedSelectedCityCode, sortedServices],
  );
  const searchedMainServices = React.useMemo(() => {
    const query = packageSearchQuery.trim().toLowerCase();
    if (!query) return filteredServices;
    return filteredServices.filter((service) =>
      service.name.toLowerCase().includes(query) ||
      (service.description || "").toLowerCase().includes(query),
    );
  }, [filteredServices, packageSearchQuery]);
  const searchedAddonServices = React.useMemo(() => {
    const query = addonSearchQuery.trim().toLowerCase();
    if (!query) return addonServices;
    return addonServices.filter((service) =>
      service.name.toLowerCase().includes(query) ||
      (service.description || "").toLowerCase().includes(query),
    );
  }, [addonServices, addonSearchQuery]);
  const selectedMainQuantities = React.useMemo(
    () =>
      normalizeBookingServiceQuantityMap(selectedServiceQuantities, {
        selectedIds: selectedServiceIds,
      }),
    [selectedServiceIds, selectedServiceQuantities],
  );
  const selectedAddonQuantityMap = React.useMemo(
    () =>
      normalizeBookingServiceQuantityMap(selectedAddonQuantities, {
        selectedIds: Array.from(selectedAddons),
      }),
    [selectedAddonQuantities, selectedAddons],
  );
  const bookingFormDraft = React.useMemo<BookingFormDraft>(
    () => ({
      version: BOOKING_FORM_DRAFT_VERSION,
      clientName,
      countryCode,
      phone,
      eventType,
      sessionDate,
      selectedCityCode,
      selectedServiceIds,
      selectedServiceQuantities: selectedMainQuantities,
      selectedAddons: Array.from(selectedAddons),
      selectedAddonQuantities: selectedAddonQuantityMap,
      dpDisplay,
      location,
      locationCoords,
      locationDetail,
      notes,
      instagram,
      customFields,
      extraData,
      extraLocationCoords,
      splitDates,
      akadDate,
      resepsiDate,
      wisudaSession1Date,
      wisudaSession2Date,
      selectedPaymentMethod,
      selectedPaymentSource,
      termsAccepted,
      termsViewedOnce,
      currentStep,
      maxUnlockedStep,
    }),
    [
      akadDate,
      clientName,
      countryCode,
      currentStep,
      customFields,
      dpDisplay,
      eventType,
      extraData,
      extraLocationCoords,
      instagram,
      location,
      locationCoords,
      locationDetail,
      maxUnlockedStep,
      notes,
      phone,
      resepsiDate,
      selectedAddonQuantityMap,
      selectedAddons,
      selectedCityCode,
      selectedMainQuantities,
      selectedPaymentMethod,
      selectedPaymentSource,
      selectedServiceIds,
      sessionDate,
      splitDates,
      termsAccepted,
      termsViewedOnce,
      wisudaSession1Date,
      wisudaSession2Date,
    ],
  );

  React.useEffect(() => {
    if (!draftHydrated || !draftStorageKey || submitted || typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      window.sessionStorage.setItem(
        draftStorageKey,
        JSON.stringify(bookingFormDraft),
      );
    }, BOOKING_FORM_DRAFT_WRITE_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [bookingFormDraft, draftHydrated, draftStorageKey, submitted]);
  const selectedMainServices = sortedServices.filter(
    (service) => !service.is_addon && selectedServiceIds.includes(service.id),
  );
  const selectedService = selectedMainServices[0] || null;
  const selectedAddonServices = sortedServices.filter(
    (service) => service.is_addon && selectedAddons.has(service.id),
  );

  React.useEffect(() => {
    if (isCityScopedEvent && !normalizedSelectedCityCode) {
      setPackageDialogOpen(false);
      setAddonDialogOpen(false);
    }
  }, [isCityScopedEvent, normalizedSelectedCityCode]);
  React.useEffect(() => {
    if (!isCityScopedEvent && selectedCityCode) {
      setSelectedCityCode("");
    }
  }, [isCityScopedEvent, selectedCityCode]);

  React.useEffect(() => {
    if (isSpecialOfferActive && packageLocked) return;
    const availableMainIds = new Set(filteredServices.map((service) => service.id));
    setSelectedServiceIds((prev) => {
      const next = prev.filter((serviceId) => availableMainIds.has(serviceId));
      if (next.length === prev.length && next.every((serviceId, index) => serviceId === prev[index])) {
        return prev;
      }
      return next;
    });
    setSelectedServiceQuantities((prev) =>
      normalizeBookingServiceQuantityMap(prev, {
        selectedIds: selectedServiceIds,
        validIds: availableMainIds,
      }),
    );
  }, [filteredServices, isSpecialOfferActive, packageLocked, selectedServiceIds]);

  React.useEffect(() => {
    if (isSpecialOfferActive && addonLocked) return;
    const availableAddonIds = new Set(addonServices.map((service) => service.id));
    setSelectedAddons((prev) => {
      const next = new Set(
        Array.from(prev).filter((serviceId) => availableAddonIds.has(serviceId)),
      );
      if (next.size === prev.size) {
        let unchanged = true;
        for (const serviceId of prev) {
          if (!next.has(serviceId)) {
            unchanged = false;
            break;
          }
        }
        if (unchanged) return prev;
      }
      return next;
    });
    setSelectedAddonQuantities((prev) =>
      normalizeBookingServiceQuantityMap(prev, {
        selectedIds: Array.from(selectedAddons),
        validIds: availableAddonIds,
      }),
    );
  }, [addonLocked, addonServices, isSpecialOfferActive, selectedAddons]);

  React.useEffect(() => {
    if (packageLocked || allowMultiplePackages) return;
    setSelectedServiceIds((prev) => (prev.length <= 1 ? prev : [prev[0]]));
    setSelectedServiceQuantities((prev) =>
      normalizeBookingServiceQuantityMap(prev, {
        selectedIds: selectedServiceIds.slice(0, 1),
        forceSingleUnit: true,
      }),
    );
  }, [allowMultiplePackages, packageLocked, selectedServiceIds]);

  React.useEffect(() => {
    if (addonLocked || allowMultipleAddons) return;
    setSelectedAddons((prev) => {
      if (prev.size <= 1) return prev;
      const first = prev.values().next().value as string | undefined;
      return first ? new Set([first]) : new Set<string>();
    });
    setSelectedAddonQuantities((prev) =>
      normalizeBookingServiceQuantityMap(prev, {
        selectedIds: Array.from(selectedAddons).slice(0, 1),
        forceSingleUnit: true,
      }),
    );
  }, [addonLocked, allowMultipleAddons, selectedAddons]);

  const selectedPackageTotal = selectedMainServices.reduce(
    (sum, service) =>
      sum + service.price * (selectedMainQuantities[service.id] || 1),
    0,
  );
  const selectedAddonTotal = selectedAddonServices.reduce(
    (sum, service) =>
      sum + service.price * (selectedAddonQuantityMap[service.id] || 1),
    0,
  );
  const selectedBookingTotal = computeSpecialOfferTotal({
    packageTotal: selectedPackageTotal,
    addonTotal: selectedAddonTotal,
    accommodationFee,
    discountAmount,
  });
  const currentMinDpAmount = selectedService
    ? isSpecialOfferDpDisabled
      ? 0
      : calcMinDpAmount(selectedBookingTotal, minDP)
    : 0;

  React.useEffect(() => {
    if (isSpecialOfferDpDisabled) {
      autoDpAmountRef.current = null;
      setDpDisplay("");
      return;
    }

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
  }, [currentMinDpAmount, isSpecialOfferDpDisabled, selectedService]);

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
    if (isSpecialOfferDpDisabled) {
      setProofFile(null);
      setProofPreview(null);
      return;
    }

    if (selectedPaymentMethod !== "cash") return;
    setProofFile(null);
    setProofPreview(null);
  }, [isSpecialOfferDpDisabled, selectedPaymentMethod]);

  const visibleBuiltInFieldById = React.useMemo(() => {
    const map = new Map<
      string,
      Extract<FormLayoutItem, { kind: "builtin_field" }>
    >();
    visibleActiveLayout.forEach((item) => {
      if (item.kind !== "builtin_field") return;
      if (!map.has(item.builtinId)) {
        map.set(item.builtinId, item);
      }
    });
    return map;
  }, [visibleActiveLayout]);

  const hasVisibleBuiltInField = React.useCallback(
    (builtinId: string) => visibleBuiltInFieldById.has(builtinId),
    [visibleBuiltInFieldById],
  );
  const isBuiltInFieldRequired = React.useCallback(
    (builtinId: BuiltInFieldId) => {
      const builtInField = visibleBuiltInFieldById.get(builtinId);
      if (!builtInField) return false;
      return resolveBuiltInFieldRequired(builtInField);
    },
    [visibleBuiltInFieldById],
  );

  const step1ValidationState = React.useMemo(() => {
    const isWeddingEvent = eventType === "Wedding";
    const isWisudaEvent = eventType === "Wisuda";
    const isSplitSessionEnabled = splitDates && (isWeddingEvent || isWisudaEvent);
    const requiresLocation =
      isBuiltInFieldRequired("location") &&
      effectiveVendor.form_show_location !== false &&
      !isSplitSessionEnabled;
    const infoStepItems = infoStepSections.flatMap((section) => section.items);

    for (const item of infoStepItems) {
      if (item.kind === "custom_field") {
        if (item.required && !customFields[item.id]?.trim()) {
          return {
            valid: false,
            errorMessage: t("errorWajib"),
            firstInvalidFieldKey: `custom:${item.id}`,
          };
        }
        continue;
      }

      if (item.kind !== "builtin_field") continue;
      const isUniversityBuiltInField =
        item.builtinId === `extra:${UNIVERSITY_EXTRA_FIELD_KEY}`;
      if (isUniversityBuiltInField) {
        const hasUniversityName = hasUniversityValue(extraData);
        const selectedUniversityRefId = getUniversityReferenceId(extraData);
        if (!hasUniversityName || !selectedUniversityRefId) {
          return {
            valid: false,
            errorMessage: t("errorUniversityRequired"),
            firstInvalidFieldKey: item.builtinId,
          };
        }
        continue;
      }

      const isRequired = resolveBuiltInFieldRequired(item);
      if (!isRequired) continue;

      const fail = (errorMessage: string) => ({
        valid: false,
        errorMessage,
        firstInvalidFieldKey: item.builtinId,
      });

      switch (item.builtinId) {
        case "client_name":
          if (!clientName.trim()) return fail(t("errorWajib"));
          break;
        case "client_whatsapp":
          if (!phone.trim()) return fail(t("errorWajib"));
          break;
        case "instagram":
          if (!instagram.trim()) return fail(t("errorWajib"));
          break;
        case "event_type":
          if (!eventType) return fail(t("errorWajib"));
          break;
        case "session_date":
          if (!isSplitSessionEnabled && !sessionDate) return fail(t("errorWajib"));
          break;
        case "session_time":
          if (!isSplitSessionEnabled && !hasDateTimeTimePart(sessionDate)) {
            return fail(t("errorWajib"));
          }
          break;
        case "akad_date":
          if (isWeddingEvent && isSplitSessionEnabled && !akadDate) {
            return fail(t("errorWajib"));
          }
          break;
        case "akad_time":
          if (
            isWeddingEvent &&
            isSplitSessionEnabled &&
            !hasDateTimeTimePart(akadDate)
          ) {
            return fail(t("errorWajib"));
          }
          break;
        case "resepsi_date":
          if (isWeddingEvent && isSplitSessionEnabled && !resepsiDate) {
            return fail(t("errorWajib"));
          }
          break;
        case "resepsi_time":
          if (
            isWeddingEvent &&
            isSplitSessionEnabled &&
            !hasDateTimeTimePart(resepsiDate)
          ) {
            return fail(t("errorWajib"));
          }
          break;
        case "wisuda_session1_date":
          if (isWisudaEvent && isSplitSessionEnabled && !wisudaSession1Date) {
            return fail(t("errorWajib"));
          }
          break;
        case "wisuda_session1_time":
          if (
            isWisudaEvent &&
            isSplitSessionEnabled &&
            !hasDateTimeTimePart(wisudaSession1Date)
          ) {
            return fail(t("errorWajib"));
          }
          break;
        case "wisuda_session2_date":
          if (isWisudaEvent && isSplitSessionEnabled && !wisudaSession2Date) {
            return fail(t("errorWajib"));
          }
          break;
        case "wisuda_session2_time":
          if (
            isWisudaEvent &&
            isSplitSessionEnabled &&
            !hasDateTimeTimePart(wisudaSession2Date)
          ) {
            return fail(t("errorWajib"));
          }
          break;
        case "location":
          if (requiresLocation && !location.trim()) return fail(t("errorWajib"));
          break;
        case "location_detail":
          if (!locationDetail.trim()) return fail(t("errorWajib"));
          break;
        case "notes":
          if (!notes.trim()) return fail(t("errorWajib"));
          break;
        default:
          if (!item.builtinId.startsWith("extra:")) break;
          {
            const extraKey = item.builtinId.slice("extra:".length);
            const extraValue = extraData[extraKey]?.trim() || "";
            const extraDefinition = currentExtraFields.find(
              (field) => field.key === extraKey,
            );
            const isSplitLocationExtra =
              extraKey === "tempat_akad" ||
              extraKey === "tempat_resepsi" ||
              extraKey === "tempat_wisuda_1" ||
              extraKey === "tempat_wisuda_2";
            if (isSplitLocationExtra && !isSplitSessionEnabled) {
              break;
            }
            const isRequiredExtraField =
              (extraDefinition?.required === true || isRequired) &&
              hasVisibleBuiltInField(item.builtinId);
            if (!isRequiredExtraField || extraValue) break;

            if (
              isWeddingEvent &&
              (extraKey === "tempat_akad" || extraKey === "tempat_resepsi")
            ) {
              return fail(t("errorLokasiWedding"));
            }
            if (
              isWisudaEvent &&
              (extraKey === "tempat_wisuda_1" || extraKey === "tempat_wisuda_2")
            ) {
              return fail(
                localeCode === "en"
                  ? "Please complete Session 1 and Session 2 locations."
                  : "Mohon lengkapi Lokasi Sesi 1 dan Lokasi Sesi 2.",
              );
            }

            return fail(t("errorWajib"));
          }
      }
    }

    return { valid: true, errorMessage: "", firstInvalidFieldKey: null as string | null };
  }, [
    akadDate,
    clientName,
    currentExtraFields,
    customFields,
    eventType,
    extraData,
    hasVisibleBuiltInField,
    infoStepSections,
    instagram,
    isBuiltInFieldRequired,
    localeCode,
    location,
    locationDetail,
    notes,
    phone,
    resepsiDate,
    sessionDate,
    splitDates,
    t,
    wisudaSession1Date,
    wisudaSession2Date,
    effectiveVendor.form_show_location,
  ]);

  const step2ValidationState = React.useMemo(() => {
    const requiresServicePackage = isBuiltInFieldRequired("service_package");

    if (requiresServicePackage && isCityScopedEvent && !normalizedSelectedCityCode) {
      return {
        valid: false,
        errorMessage:
          localeCode === "en"
            ? "Please select your city/regency before choosing a package."
            : "Pilih kota/kabupaten terlebih dahulu sebelum memilih paket.",
        firstInvalidFieldKey: "service_package",
      };
    }

    if (requiresServicePackage && selectedServiceIds.length === 0) {
      return {
        valid: false,
        errorMessage: t("errorWajib"),
        firstInvalidFieldKey: "service_package",
      };
    }

    return { valid: true, errorMessage: "", firstInvalidFieldKey: null as string | null };
  }, [
    isBuiltInFieldRequired,
    isCityScopedEvent,
    localeCode,
    normalizedSelectedCityCode,
    selectedServiceIds.length,
    t,
  ]);

  React.useEffect(() => {
    setMaxUnlockedStep((prev) => {
      if (!step1ValidationState.valid) return 1;
      if (!step2ValidationState.valid) return prev > 2 ? 2 : prev;
      return prev;
    });
  }, [step1ValidationState.valid, step2ValidationState.valid]);

  React.useEffect(() => {
    if (!step1ValidationState.valid && currentStep !== 1) {
      setCurrentStep(1);
      return;
    }
    if (step1ValidationState.valid && !step2ValidationState.valid && currentStep > 2) {
      setCurrentStep(2);
    }
  }, [currentStep, step1ValidationState.valid, step2ValidationState.valid]);

  React.useEffect(() => {
    if (currentStep === 4) return;
    clearConfirmationSubmitTimer();
    setConfirmationSubmitEnabled(true);
  }, [clearConfirmationSubmitTimer, currentStep]);

  React.useEffect(() => () => {
    clearConfirmationSubmitTimer();
  }, [clearConfirmationSubmitTimer]);

  const scrollToFormTop = React.useCallback(() => {
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, []);

  const focusAndScrollToField = React.useCallback((fieldKey: string | null | undefined) => {
    if (!fieldKey) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const escapedFieldKey = fieldKey.replace(/"/g, '\\"');
        const container = formRef.current?.querySelector<HTMLElement>(
          `[data-field-key="${escapedFieldKey}"]`,
        );
        if (!container) return;
        container.scrollIntoView({ behavior: "smooth", block: "center" });
        const focusable = container.querySelector<HTMLElement>(
          "input, select, textarea, button, [tabindex]:not([tabindex='-1'])",
        );
        if (focusable && typeof focusable.focus === "function") {
          focusable.focus({ preventScroll: true });
        }
      });
    });
  }, []);

  function goToStep(step: BookingStep) {
    if (step > maxUnlockedStep) return;
    if (step >= 2 && !step1ValidationState.valid) {
      setError(step1ValidationState.errorMessage || t("errorWajib"));
      setCurrentStep(1);
      focusAndScrollToField(step1ValidationState.firstInvalidFieldKey);
      return;
    }
    if (step >= 3 && !step2ValidationState.valid) {
      setError(step2ValidationState.errorMessage || t("errorWajib"));
      setCurrentStep(2);
      focusAndScrollToField(step2ValidationState.firstInvalidFieldKey);
      return;
    }
    setError("");
    setCurrentStep(step);
    scrollToFormTop();
  }

  function goNextStep() {
    if (currentStep === 1) {
      if (!step1ValidationState.valid) {
        setError(step1ValidationState.errorMessage || t("errorWajib"));
        focusAndScrollToField(step1ValidationState.firstInvalidFieldKey);
        return;
      }
      setError("");
      setMaxUnlockedStep((prev) => (prev < 2 ? 2 : prev));
      setCurrentStep(2);
      scrollToFormTop();
      return;
    }

    if (currentStep === 2) {
      if (!step2ValidationState.valid) {
        setError(step2ValidationState.errorMessage || t("errorWajib"));
        focusAndScrollToField(step2ValidationState.firstInvalidFieldKey);
        return;
      }
      setError("");
      setMaxUnlockedStep((prev) => (prev < 3 ? 3 : prev));
      setCurrentStep(3);
      scrollToFormTop();
      return;
    }

    if (currentStep === 3) {
      setError("");
      temporarilyDisableConfirmationSubmit();
      setMaxUnlockedStep((prev) => (prev < 4 ? 4 : prev));
      setCurrentStep(4);
      scrollToFormTop();
    }
  }

  function goPrevStep() {
    setError("");
    setCurrentStep((prev) => (prev <= 1 ? 1 : ((prev - 1) as BookingStep)));
    scrollToFormTop();
  }

  function renderCustomField(field: Extract<FormLayoutItem, { kind: "custom_field" }>) {
    const description = getDisplayDescriptionForField(field);
    const choiceOptions =
      field.type === "checkbox"
        ? field.options && field.options.length > 0
          ? field.options
          : ["Ya", "Tidak"]
        : field.options || [];

    return (
      <div key={field.id} className="space-y-1.5">
        <label className="text-sm font-medium">
          {buildFieldLabelNode({
            text: field.label,
            required: field.required,
            icon: List,
          })}
        </label>
        {description ? <p className="text-xs text-muted-foreground whitespace-pre-line break-words leading-relaxed">{description}</p> : null}
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
            type="text"
            inputMode={field.type === "number" ? "numeric" : undefined}
            value={customFields[field.id] || ""}
            onChange={(e) => {
              const nextValue =
                field.type === "number"
                  ? sanitizeNumericCustomFieldValue(e.target.value)
                  : e.target.value;
              setCustomFields((prev) => ({ ...prev, [field.id]: nextValue }));
            }}
            placeholder={field.placeholder}
            required={field.required}
            className={inputClass}
          />
        )}
      </div>
    );
  }

  function renderEventExtraField(
    extraKey: string,
    display?: { labelOverride?: string; description?: string },
  ) {
    const field = currentExtraFields.find((item) => item.key === extraKey);
    if (!field) return null;
    const label =
      typeof display?.labelOverride === "string" &&
      display.labelOverride.trim().length > 0
        ? display.labelOverride
        : field.label;
    const description =
      typeof display?.description === "string" &&
      display.description.trim().length > 0
        ? display.description
        : "";
    const isWisudaSplitLocationField =
      field.key === "tempat_wisuda_1" || field.key === "tempat_wisuda_2";
    const isWeddingSplitLocationField =
      field.key === "tempat_akad" || field.key === "tempat_resepsi";
    if (eventType === "Wedding" && !splitDates && isWeddingSplitLocationField) {
      return null;
    }
    if (eventType === "Wisuda" && !splitDates && isWisudaSplitLocationField) {
      return null;
    }

    return (
      <div
        key={`extra:${extraKey}`}
        className={`space-y-1.5 ${field.isLocation || field.fullWidth || currentExtraFields.length === 1 ? "col-span-full" : ""}`}
      >
        <label className="text-sm font-medium">
          {buildFieldLabelNode({
            text: label,
            required: field.required,
            icon: field.isLocation ? MapPin : List,
          })}
        </label>
        {description ? (
          <p className="text-xs text-muted-foreground whitespace-pre-line break-words leading-relaxed">{description}</p>
        ) : null}
        {field.key === UNIVERSITY_EXTRA_FIELD_KEY ? (
          <UniversityAutocomplete
            value={extraData[field.key] || ""}
            selectedId={extraData[UNIVERSITY_REFERENCE_EXTRA_KEY] || ""}
            onValueChange={(value) =>
              setExtraData((prev) => ({ ...prev, [field.key]: value }))
            }
            onSelect={(item) =>
              setExtraData((prev) => {
                const next = { ...prev };
                if (item) {
                  next[field.key] = item.displayName || item.name;
                  next[UNIVERSITY_REFERENCE_EXTRA_KEY] = item.id;
                } else {
                  delete next[UNIVERSITY_REFERENCE_EXTRA_KEY];
                }
                return next;
              })
            }
            placeholder={t("universityPlaceholder")}
            required={field.required}
            strings={{
              noResults: t("universityNoResults"),
              selectionHint: t("universitySelectionHint"),
            }}
          />
        ) : field.isLocation ? (
          <LocationAutocomplete
            value={extraData[field.key] || ""}
            onChange={(value) =>
              setExtraData((prev) => ({ ...prev, [field.key]: value }))
            }
            onLocationChange={(meta: LocationSelectionMeta) => {
              setExtraLocationCoords((prev) => ({
                ...prev,
                [field.key]:
                  meta.source === "manual" || meta.source === "clear"
                    ? { lat: null, lng: null }
                    : { lat: meta.lat, lng: meta.lng },
              }));
            }}
            placeholder={`Cari lokasi ${label.toLowerCase()}...`}
            initialLat={extraLocationCoords[field.key]?.lat ?? null}
            initialLng={extraLocationCoords[field.key]?.lng ?? null}
            required={field.required}
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
            placeholder={label}
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
            placeholder={label}
            className={inputClass}
            required={field.required}
          />
        )}
      </div>
    );
  }

  function renderBuiltInField(item: Extract<FormLayoutItem, { kind: "builtin_field" }>) {
    const fieldLabel = (fallback: string) =>
      getDisplayLabelForBuiltInField(item, fallback);
    const fieldDescription = getDisplayDescriptionForField(item);
    const builtInFieldRequired = resolveBuiltInFieldRequired(item);
    const builtInFieldIcon = getBuiltInFieldIcon(item.builtinId);

    switch (item.builtinId) {
      case "client_name":
        return (
          <div key={item.id} className="space-y-1.5">
            <label className="text-sm font-medium">
              {buildFieldLabelNode({
                text: fieldLabel(t("namaLengkap")),
                required: builtInFieldRequired,
                icon: builtInFieldIcon,
              })}
            </label>
            {fieldDescription ? (
              <p className="text-xs text-muted-foreground whitespace-pre-line break-words leading-relaxed">{fieldDescription}</p>
            ) : null}
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder={t("namaPlaceholder")}
              className={inputClass}
              required={builtInFieldRequired}
            />
          </div>
        );
      case "client_whatsapp":
        return (
          <div key={item.id} className="space-y-1.5">
            <label className="text-sm font-medium">
              {buildFieldLabelNode({
                text: fieldLabel(t("nomorWhatsapp")),
                required: builtInFieldRequired,
                icon: builtInFieldIcon,
              })}
            </label>
            {fieldDescription ? (
              <p className="text-xs text-muted-foreground whitespace-pre-line break-words leading-relaxed">{fieldDescription}</p>
            ) : null}
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
                required={builtInFieldRequired}
              />
            </div>
          </div>
        );
      case "instagram":
        return (
          <div key={item.id} className="space-y-1.5">
            <label className="text-sm font-medium">
              {buildFieldLabelNode({
                text: fieldLabel("Instagram"),
                required: builtInFieldRequired,
                icon: builtInFieldIcon,
              })}
            </label>
            {fieldDescription ? (
              <p className="text-xs text-muted-foreground whitespace-pre-line break-words leading-relaxed">{fieldDescription}</p>
            ) : null}
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
              {buildFieldLabelNode({
                text: fieldLabel(t("tipeAcara")),
                required: builtInFieldRequired,
                icon: builtInFieldIcon,
              })}
            </label>
            {fieldDescription ? (
              <p className="text-xs text-muted-foreground whitespace-pre-line break-words leading-relaxed">{fieldDescription}</p>
            ) : null}
            <select
              value={eventType}
              onChange={(e) => {
                setEventType(e.target.value);
                setSplitDates(false);
                setAkadDate("");
                setResepsiDate("");
                setWisudaSession1Date("");
                setWisudaSession2Date("");
                setExtraData({});
                setExtraLocationCoords({});
                setCustomFields({});
                setSelectedServiceIds(
                  isSpecialOfferActive ? [...specialPackageServiceIds] : [],
                );
                setSelectedAddons(
                  isSpecialOfferActive
                    ? new Set(specialAddonServiceIds)
                    : new Set(),
                );
                setPackageSearchQuery("");
                setAddonSearchQuery("");
                autoDpAmountRef.current = null;
                setDpDisplay("");
              }}
              className={selectClass}
              required={builtInFieldRequired}
            >
              <option value="">{t("pilihTipe")}</option>
              {eventTypeOptions.map((et) => (
                <option key={et} value={et}>
                  {et}
                </option>
              ))}
            </select>
          </div>
        );
      case "wedding_split_toggle":
        if (
          eventType !== "Wedding" ||
          effectiveVendor.form_show_wedding_split === false
        ) {
          return null;
        }
        return (
          <div key={item.id} className="space-y-1.5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSplitDates(!splitDates)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${splitDates ? "bg-primary" : "bg-gray-300"}`}
              >
                <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${splitDates ? "translate-x-4" : "translate-x-0"}`} />
              </button>
              <span className="text-sm font-medium">
                {buildFieldLabelNode({
                  text: fieldLabel("Akad & Resepsi beda hari"),
                  icon: builtInFieldIcon,
                })}
              </span>
            </div>
            {fieldDescription ? (
              <p className="text-xs text-muted-foreground whitespace-pre-line break-words leading-relaxed">{fieldDescription}</p>
            ) : null}
          </div>
        );
      case "wisuda_split_toggle":
        if (
          eventType !== "Wisuda" ||
          effectiveVendor.form_show_wisuda_split === false
        ) {
          return null;
        }
        return (
          <div key={item.id} className="space-y-1.5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSplitDates(!splitDates)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${splitDates ? "bg-primary" : "bg-gray-300"}`}
              >
                <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${splitDates ? "translate-x-4" : "translate-x-0"}`} />
              </button>
              <span className="text-sm font-medium">
                {buildFieldLabelNode({
                  text: fieldLabel("Sesi 1 & Sesi 2 beda waktu/lokasi"),
                  icon: builtInFieldIcon,
                })}
              </span>
            </div>
            {fieldDescription ? (
              <p className="text-xs text-muted-foreground whitespace-pre-line break-words leading-relaxed">{fieldDescription}</p>
            ) : null}
          </div>
        );
      case "akad_date":
        if (eventType !== "Wedding" || !splitDates) return null;
        return (
          <div key={item.id} className="space-y-1.5">
            <label className="text-sm font-medium">
              {buildFieldLabelNode({
                text: fieldLabel("Tanggal Akad"),
                required: builtInFieldRequired,
                icon: builtInFieldIcon,
              })}
            </label>
            {fieldDescription ? (
              <p className="text-xs text-muted-foreground whitespace-pre-line break-words leading-relaxed">{fieldDescription}</p>
            ) : null}
            <input
              type="date"
              value={akadDate ? akadDate.split("T")[0] : ""}
              onChange={(e) => {
                const timePart = akadDate?.split("T")[1] || "10:00";
                setAkadDate(e.target.value ? `${e.target.value}T${timePart}` : "");
              }}
              className={inputClass}
              required={builtInFieldRequired}
            />
          </div>
        );
      case "akad_time":
        if (eventType !== "Wedding" || !splitDates) return null;
        return (
          <div key={item.id} className="space-y-1.5">
            <label className="text-sm font-medium">
              {buildFieldLabelNode({
                text: fieldLabel("Jam Akad"),
                required: builtInFieldRequired,
                icon: builtInFieldIcon,
              })}
            </label>
            {fieldDescription ? (
              <p className="text-xs text-muted-foreground whitespace-pre-line break-words leading-relaxed">{fieldDescription}</p>
            ) : null}
            <input
              type="time"
              value={akadDate ? akadDate.split("T")[1] || "10:00" : ""}
              onChange={(e) => {
                const datePart = akadDate?.split("T")[0] || "";
                if (datePart) setAkadDate(`${datePart}T${e.target.value}`);
              }}
              className={inputClass}
              required={builtInFieldRequired}
            />
          </div>
        );
      case "resepsi_date":
        if (eventType !== "Wedding" || !splitDates) return null;
        return (
          <div key={item.id} className="space-y-1.5">
            <label className="text-sm font-medium">
              {buildFieldLabelNode({
                text: fieldLabel("Tanggal Resepsi"),
                required: builtInFieldRequired,
                icon: builtInFieldIcon,
              })}
            </label>
            {fieldDescription ? (
              <p className="text-xs text-muted-foreground whitespace-pre-line break-words leading-relaxed">{fieldDescription}</p>
            ) : null}
            <input
              type="date"
              value={resepsiDate ? resepsiDate.split("T")[0] : ""}
              onChange={(e) => {
                const timePart = resepsiDate?.split("T")[1] || "10:00";
                setResepsiDate(e.target.value ? `${e.target.value}T${timePart}` : "");
              }}
              className={inputClass}
              required={builtInFieldRequired}
            />
          </div>
        );
      case "resepsi_time":
        if (eventType !== "Wedding" || !splitDates) return null;
        return (
          <div key={item.id} className="space-y-1.5">
            <label className="text-sm font-medium">
              {buildFieldLabelNode({
                text: fieldLabel("Jam Resepsi"),
                required: builtInFieldRequired,
                icon: builtInFieldIcon,
              })}
            </label>
            {fieldDescription ? (
              <p className="text-xs text-muted-foreground whitespace-pre-line break-words leading-relaxed">{fieldDescription}</p>
            ) : null}
            <input
              type="time"
              value={resepsiDate ? resepsiDate.split("T")[1] || "10:00" : ""}
              onChange={(e) => {
                const datePart = resepsiDate?.split("T")[0] || "";
                if (datePart) setResepsiDate(`${datePart}T${e.target.value}`);
              }}
              className={inputClass}
              required={builtInFieldRequired}
            />
          </div>
        );
      case "wisuda_session1_date":
        if (eventType !== "Wisuda" || !splitDates) return null;
        return (
          <div key={item.id} className="space-y-1.5">
            <label className="text-sm font-medium">
              {buildFieldLabelNode({
                text: fieldLabel("Tanggal Sesi 1"),
                required: builtInFieldRequired,
                icon: builtInFieldIcon,
              })}
            </label>
            {fieldDescription ? (
              <p className="text-xs text-muted-foreground whitespace-pre-line break-words leading-relaxed">{fieldDescription}</p>
            ) : null}
            <input
              type="date"
              value={wisudaSession1Date ? wisudaSession1Date.split("T")[0] : ""}
              onChange={(e) => {
                const timePart = wisudaSession1Date?.split("T")[1] || "10:00";
                setWisudaSession1Date(e.target.value ? `${e.target.value}T${timePart}` : "");
              }}
              className={inputClass}
              required={builtInFieldRequired}
            />
          </div>
        );
      case "wisuda_session1_time":
        if (eventType !== "Wisuda" || !splitDates) return null;
        return (
          <div key={item.id} className="space-y-1.5">
            <label className="text-sm font-medium">
              {buildFieldLabelNode({
                text: fieldLabel("Jam Sesi 1"),
                required: builtInFieldRequired,
                icon: builtInFieldIcon,
              })}
            </label>
            {fieldDescription ? (
              <p className="text-xs text-muted-foreground whitespace-pre-line break-words leading-relaxed">{fieldDescription}</p>
            ) : null}
            <input
              type="time"
              value={wisudaSession1Date ? wisudaSession1Date.split("T")[1] || "10:00" : ""}
              onChange={(e) => {
                const datePart = wisudaSession1Date?.split("T")[0] || "";
                if (datePart) setWisudaSession1Date(`${datePart}T${e.target.value}`);
              }}
              className={inputClass}
              required={builtInFieldRequired}
            />
          </div>
        );
      case "wisuda_session2_date":
        if (eventType !== "Wisuda" || !splitDates) return null;
        return (
          <div key={item.id} className="space-y-1.5">
            <label className="text-sm font-medium">
              {buildFieldLabelNode({
                text: fieldLabel("Tanggal Sesi 2"),
                required: builtInFieldRequired,
                icon: builtInFieldIcon,
              })}
            </label>
            {fieldDescription ? (
              <p className="text-xs text-muted-foreground whitespace-pre-line break-words leading-relaxed">{fieldDescription}</p>
            ) : null}
            <input
              type="date"
              value={wisudaSession2Date ? wisudaSession2Date.split("T")[0] : ""}
              onChange={(e) => {
                const timePart = wisudaSession2Date?.split("T")[1] || "10:00";
                setWisudaSession2Date(e.target.value ? `${e.target.value}T${timePart}` : "");
              }}
              className={inputClass}
              required={builtInFieldRequired}
            />
          </div>
        );
      case "wisuda_session2_time":
        if (eventType !== "Wisuda" || !splitDates) return null;
        return (
          <div key={item.id} className="space-y-1.5">
            <label className="text-sm font-medium">
              {buildFieldLabelNode({
                text: fieldLabel("Jam Sesi 2"),
                required: builtInFieldRequired,
                icon: builtInFieldIcon,
              })}
            </label>
            {fieldDescription ? (
              <p className="text-xs text-muted-foreground whitespace-pre-line break-words leading-relaxed">{fieldDescription}</p>
            ) : null}
            <input
              type="time"
              value={wisudaSession2Date ? wisudaSession2Date.split("T")[1] || "10:00" : ""}
              onChange={(e) => {
                const datePart = wisudaSession2Date?.split("T")[0] || "";
                if (datePart) setWisudaSession2Date(`${datePart}T${e.target.value}`);
              }}
              className={inputClass}
              required={builtInFieldRequired}
            />
          </div>
        );
      case "session_date":
        if ((eventType === "Wedding" || eventType === "Wisuda") && splitDates) return null;
        return (
          <div key={item.id} className="space-y-1.5">
            <label className="text-sm font-medium">
              {buildFieldLabelNode({
                text: fieldLabel(t("jadwalSesi")),
                required: builtInFieldRequired,
                icon: builtInFieldIcon,
              })}
            </label>
            {fieldDescription ? (
              <p className="text-xs text-muted-foreground whitespace-pre-line break-words leading-relaxed">{fieldDescription}</p>
            ) : null}
            <input
              type="date"
              value={sessionDate ? sessionDate.split("T")[0] : ""}
              onChange={(e) => {
                const timePart = sessionDate?.split("T")[1] || "10:00";
                setSessionDate(e.target.value ? `${e.target.value}T${timePart}` : "");
              }}
              className={inputClass}
              required={builtInFieldRequired}
            />
          </div>
        );
      case "session_time":
        if ((eventType === "Wedding" || eventType === "Wisuda") && splitDates) return null;
        return (
          <div key={item.id} className="space-y-1.5">
            <label className="text-sm font-medium">
              {buildFieldLabelNode({
                text: fieldLabel(t("jam") || "Jam"),
                required: builtInFieldRequired,
                icon: builtInFieldIcon,
              })}
            </label>
            {fieldDescription ? (
              <p className="text-xs text-muted-foreground whitespace-pre-line break-words leading-relaxed">{fieldDescription}</p>
            ) : null}
            <input
              type="time"
              value={sessionDate ? sessionDate.split("T")[1] || "10:00" : ""}
              onChange={(e) => {
                const datePart = sessionDate?.split("T")[0] || "";
                if (datePart) setSessionDate(`${datePart}T${e.target.value}`);
              }}
              className={inputClass}
              required={builtInFieldRequired}
            />
          </div>
        );
      case "location":
        if (effectiveVendor.form_show_location === false) {
          return null;
        }
        return (
          <div key={item.id} className="space-y-1.5">
            <label className="text-sm font-medium">
              {buildFieldLabelNode({
                text: fieldLabel(t("lokasi")),
                required: builtInFieldRequired,
                icon: builtInFieldIcon,
              })}
            </label>
            {fieldDescription ? (
              <p className="text-xs text-muted-foreground whitespace-pre-line break-words leading-relaxed">{fieldDescription}</p>
            ) : null}
            <LocationAutocomplete
              value={location}
              onChange={setLocation}
              onLocationChange={(meta: LocationSelectionMeta) => {
                setLocationCoords(
                  meta.source === "manual" || meta.source === "clear"
                    ? { lat: null, lng: null }
                    : { lat: meta.lat, lng: meta.lng },
                );
              }}
              placeholder={t("cariLokasi")}
              initialLat={locationCoords.lat}
              initialLng={locationCoords.lng}
              required={builtInFieldRequired}
            />
          </div>
        );
      case "location_detail":
        return (
          <div key={item.id} className="space-y-1.5">
            <label className="text-sm font-medium">
              {buildFieldLabelNode({
                text: fieldLabel("Detail Lokasi"),
                required: builtInFieldRequired,
                icon: builtInFieldIcon,
              })}
            </label>
            {fieldDescription ? (
              <p className="text-xs text-muted-foreground whitespace-pre-line break-words leading-relaxed">{fieldDescription}</p>
            ) : null}
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
            <label className="text-sm font-medium">
              {buildFieldLabelNode({
                text: fieldLabel(t("catatan")),
                required: builtInFieldRequired,
                icon: builtInFieldIcon,
              })}
            </label>
            {fieldDescription ? (
              <p className="text-xs text-muted-foreground whitespace-pre-line break-words leading-relaxed">{fieldDescription}</p>
            ) : null}
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
            {isCityScopedEvent ? (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {buildFieldLabelNode({
                    text: "Kota / Kabupaten",
                    required: builtInFieldRequired,
                    icon: List,
                  })}
                </label>
                <CitySingleSelect
                  options={cityOptions}
                  value={normalizedSelectedCityCode}
                  onChange={setSelectedCityCode}
                  placeholder="Pilih kota / kabupaten"
                  searchPlaceholder="Cari kota / kabupaten..."
                  emptyText="Data kota / kabupaten tidak ditemukan."
                />
                {selectedCity ? (
                  <p className="text-[11px] text-muted-foreground">
                    Wilayah terpilih: {buildCityDisplayName(selectedCity)}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {buildFieldLabelNode({
                  text: fieldLabel(t("paketLayanan")),
                  required: builtInFieldRequired,
                  icon: builtInFieldIcon,
                })}
              </label>
              {fieldDescription ? (
                <p className="text-xs text-muted-foreground whitespace-pre-line break-words leading-relaxed">{fieldDescription}</p>
              ) : null}
              {isCityScopedEvent && !normalizedSelectedCityCode ? (
                <div className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
                  Pilih kota/kabupaten dulu untuk menampilkan paket yang tersedia.
                </div>
              ) : !eventType ? (
                <div className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
                  Pilih tipe acara dulu untuk menampilkan paket yang tersedia.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (packageLocked) return;
                    setPackageDialogOpen(true);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all ${packageLocked ? "cursor-not-allowed opacity-80" : "hover:bg-muted/30 cursor-pointer"}`}
                >
                  <span className="text-left">
                    {selectedMainServices.length > 0
                      ? allowMultiplePackages
                        ? `${selectedMainServices.length} paket dipilih`
                        : selectedMainServices[0]
                          ? `${selectedMainServices[0].name}${(selectedMainQuantities[selectedMainServices[0].id] || 1) > 1 ? ` x${selectedMainQuantities[selectedMainServices[0].id] || 1}` : ""}`
                          : "1 paket dipilih"
                      : "Pilih Paket / Layanan"}
                  </span>
                  <span className="text-xs font-medium text-primary">
                    {packageLocked ? "Terkunci" : "Buka Daftar"}
                  </span>
                </button>
              )}
              <p className="text-[11px] text-muted-foreground">
                {allowMultiplePackages
                  ? "Mode paket: bisa pilih lebih dari satu."
                  : "Mode paket: hanya bisa pilih satu."}
              </p>
            </div>
            {selectedMainServices.length > 0 && (
              <div className="space-y-2">
                {selectedMainServices.map((service) => {
                  const quantity = selectedMainQuantities[service.id] || 1;
                  const tone = buildServiceSoftPalette({
                    serviceColor: service.color,
                    fallbackColor: brandColor,
                    selected: true,
                  });
                  return (
                    <div
                      key={service.id}
                      className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2"
                      style={{
                        backgroundColor: tone.backgroundColor,
                        borderColor: tone.borderColor,
                        boxShadow: `0 0 0 1px ${tone.ringColor}`,
                      }}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">
                            {service.name}
                            {quantity > 1 ? ` x${quantity}` : ""}
                          </p>
                          {renderQuantityControl("main", service.id, quantity)}
                        </div>
                        {service.description ? (
                          <p className="text-xs text-muted-foreground whitespace-pre-line break-words">{service.description}</p>
                        ) : null}
                      </div>
                      {!shouldHideServicePrices ? (
                        <div className="shrink-0 text-right">
                          <p className="text-lg font-bold" style={{ color: tone.color }}>
                            {formatCurrency(service.price * quantity)}
                          </p>
                          {service.original_price && service.original_price > service.price ? (
                            <p className="text-[11px] text-muted-foreground line-through">{formatCurrency(service.original_price * quantity)}</p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      case "addon_packages":
        if (
          !eventType ||
          (
            (effectiveVendor.form_show_addons === false || addonServices.length === 0) &&
            !(isSpecialOfferActive && (selectedAddonServices.length > 0 || specialAddonServiceIds.length > 0))
          )
        ) return null;
        return (
          <div key={item.id} className="space-y-2">
            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1 border-t" />
              <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                {fieldLabel("Paket Tambahan")}
              </span>
              <div className="flex-1 border-t" />
            </div>
            {fieldDescription ? (
              <p className="text-xs text-muted-foreground whitespace-pre-line break-words leading-relaxed">{fieldDescription}</p>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (addonLocked) return;
                setAddonDialogOpen(true);
              }}
              className={`flex w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all ${addonLocked ? "cursor-not-allowed opacity-80" : "hover:bg-muted/30 cursor-pointer"}`}
            >
              <span className="text-left">
                {selectedAddonServices.length > 0
                  ? allowMultipleAddons
                    ? `${selectedAddonServices.length} add-on dipilih`
                    : selectedAddonServices[0]
                      ? `${selectedAddonServices[0].name}${(selectedAddonQuantityMap[selectedAddonServices[0].id] || 1) > 1 ? ` x${selectedAddonQuantityMap[selectedAddonServices[0].id] || 1}` : ""}`
                      : "1 add-on dipilih"
                  : "Pilih Add-on"}
              </span>
              <span className="text-xs font-medium text-primary">
                {addonLocked ? "Terkunci" : "Buka Daftar"}
              </span>
            </button>
            <p className="text-[11px] text-muted-foreground">
              {allowMultipleAddons
                ? "Mode add-on: bisa pilih lebih dari satu."
                : "Mode add-on: hanya bisa pilih satu."}
            </p>
            {selectedAddonServices.length > 0 && (
              <div className="space-y-2">
                {selectedAddonServices.map((addon) => {
                  const quantity = selectedAddonQuantityMap[addon.id] || 1;
                  const tone = buildServiceSoftPalette({
                    serviceColor: addon.color,
                    fallbackColor: brandColor,
                    selected: true,
                  });
                  return (
                    <div
                      key={addon.id}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                      style={{
                        backgroundColor: tone.backgroundColor,
                        borderColor: tone.borderColor,
                        boxShadow: `0 0 0 1px ${tone.ringColor}`,
                      }}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">
                            {addon.name}
                            {quantity > 1 ? ` x${quantity}` : ""}
                          </p>
                          {renderQuantityControl("addon", addon.id, quantity)}
                        </div>
                        {addon.description ? (
                          <p className="text-[11px] text-muted-foreground whitespace-pre-line break-words">
                            {addon.description}
                          </p>
                        ) : null}
                      </div>
                      {!shouldHideServicePrices ? (
                        <span
                          className="font-semibold whitespace-nowrap"
                          style={{ color: tone.color }}
                        >
                          +{formatCurrency(addon.price * quantity)}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
            {(selectedMainServices.length > 0 && (selectedAddons.size > 0 || isSpecialOfferActive)) && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                {selectedMainServices.map((service) => {
                  const quantity = selectedMainQuantities[service.id] || 1;
                  const tone = buildServiceSoftPalette({
                    serviceColor: service.color,
                    fallbackColor: brandColor,
                  });
                  return (
                    <div
                      key={service.id}
                      className="mb-1 flex items-center justify-between rounded-md border px-2 py-1"
                      style={{
                        backgroundColor: tone.summaryBackgroundColor,
                        borderColor: tone.summaryBorderColor,
                      }}
                    >
                      <span>
                        {service.name}
                        {quantity > 1 ? ` x${quantity}` : ""}
                      </span>
                      <span style={{ color: tone.color }}>
                        {formatCurrency(service.price * quantity)}
                      </span>
                    </div>
                  );
                })}
                {selectedAddonServices.map((service) => {
                  const quantity = selectedAddonQuantityMap[service.id] || 1;
                  const tone = buildServiceSoftPalette({
                    serviceColor: service.color,
                    fallbackColor: brandColor,
                  });
                  return (
                    <div
                      key={service.id}
                      className="mb-1 flex items-center justify-between rounded-md border px-2 py-1 text-muted-foreground"
                      style={{
                        backgroundColor: tone.summaryBackgroundColor,
                        borderColor: tone.summaryBorderColor,
                      }}
                    >
                      <span>
                        + {service.name}
                        {quantity > 1 ? ` x${quantity}` : ""}
                      </span>
                      <span style={{ color: tone.color }}>
                        {formatCurrency(service.price * quantity)}
                      </span>
                    </div>
                  );
                })}
                {isSpecialOfferActive && accommodationFee > 0 ? (
                  <div className="flex justify-between text-muted-foreground">
                    <span>+ Akomodasi</span>
                    <span>{formatCurrency(accommodationFee)}</span>
                  </div>
                ) : null}
                {isSpecialOfferActive && discountAmount > 0 ? (
                  <div className="flex justify-between text-muted-foreground">
                    <span>- Diskon</span>
                    <span>{formatCurrency(discountAmount)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between font-bold border-t pt-1 mt-1">
                  <span>Total</span>
                  <span>{formatCurrency(selectedBookingTotal)}</span>
                </div>
              </div>
            )}
          </div>
        );
      case "dp_paid":
        if (isSpecialOfferDpDisabled) return null;
        return (
          <div key={item.id} className="space-y-1.5">
            <label className="text-sm font-medium">
              {buildFieldLabelNode({
                text: fieldLabel(
                  eventType
                    ? minDP.mode === "fixed"
                      ? `DP (Minimal ${formatCurrency(minDP.value)})`
                      : t("dpMinimal", { percent: String(minDP.value) })
                    : "DP",
                ),
                required: builtInFieldRequired,
                icon: builtInFieldIcon,
              })}
            </label>
            {fieldDescription ? (
              <p className="text-xs text-muted-foreground whitespace-pre-line break-words leading-relaxed">{fieldDescription}</p>
            ) : null}
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
                required={builtInFieldRequired}
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
        if (isSpecialOfferDpDisabled || availablePaymentMethods.length === 0) return null;
        return (
          <div key={item.id} className="space-y-4">
            {fieldDescription ? (
              <p className="text-xs text-muted-foreground whitespace-pre-line break-words leading-relaxed">{fieldDescription}</p>
            ) : null}
            <PaymentMethodSection
              methods={availablePaymentMethods}
              selectedMethod={selectedPaymentMethod}
              selectedSource={selectedPaymentSource}
              onSelectMethod={setSelectedPaymentMethod}
              onSelectSource={setSelectedPaymentSource}
                bankAccounts={enabledBankAccounts}
                qrisImageUrl={effectiveVendor.qris_image_url}
                brandColor={brandColor}
                labels={{
                  methodLabel: buildFieldLabelNode({
                    text: fieldLabel(t("paymentMethod")),
                    required: builtInFieldRequired,
                    icon: builtInFieldIcon,
                  }),
                  bankLabel: buildFieldLabelNode({
                    text: t("paymentSourceBank"),
                    required: builtInFieldRequired,
                    icon: CreditCard,
                  }),
                  bankEmpty: t("paymentNoBank"),
                  qrisLabel: t("paymentSourceQris"),
                  qrisEmpty: t("paymentNoQris"),
                  qrisLoadError: t("qrisLoadError"),
                  cashNote: t("paymentCashNote"),
                  accountNumberLabel: t("accountNumberLabel"),
                  copyLabel: t("copyLabel"),
                copiedLabel: t("copiedLabel"),
                bankDescriptions: {
                  bank: t("paymentMethodBankDesc"),
                  qris: t("paymentMethodQrisDesc"),
                  cash: t("paymentMethodCashDesc"),
                },
              }}
            />
          </div>
        );
      case "payment_proof":
        if (
          isSpecialOfferDpDisabled ||
          effectiveVendor.form_show_proof === false ||
          !selectedPaymentMethod ||
          selectedPaymentMethod === "cash"
        ) return null;
        return (
          <div key={item.id} className="space-y-1.5">
            <FileDropzone
              file={proofFile}
              previewUrl={proofPreview}
              accept="image/*,.pdf"
              label={buildFieldLabelNode({
                text: fieldLabel(t("buktiPembayaran")),
                required: builtInFieldRequired && proofRequired,
                icon: builtInFieldIcon,
              })}
              helperText={
                fieldDescription ||
                (selectedPaymentMethod === "qris"
                  ? t("paymentProofQrisHint")
                  : t("paymentProofBankHint"))
              }
              emptyText={t("klikUpload")}
              emptySubtext={t("dragDropHint", { format: t("formatFile") })}
              removeLabel={t("removeFile")}
              onFileSelect={handleProofFile}
            />
          </div>
        );
      default:
        if (item.builtinId.startsWith("extra:")) {
          return renderEventExtraField(item.builtinId.slice(6), {
            labelOverride: item.labelOverride,
            description: item.description,
          });
        }
        return null;
    }
  }

  function renderLayoutItem(item: FormLayoutItem) {
    if (item.kind === "builtin_section") return null;
    if (
      (item.kind === "builtin_field" || item.kind === "custom_field") &&
      item.hidden === true
    ) {
      return null;
    }
    if (item.kind === "custom_section") {
      const sectionNotesLabel =
        typeof item.notesLabel === "string" && item.notesLabel.trim().length > 0
          ? item.notesLabel
          : "";
      const sectionDescription =
        typeof item.description === "string" && item.description.trim().length > 0
          ? item.description
          : "";
      return (
        <div key={item.id} className="space-y-2 pt-1">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <h4 className="text-sm font-semibold text-foreground/85">
              {item.title}
            </h4>
            <div className="h-px flex-1 bg-border" />
          </div>
          {sectionDescription ? (
            <div className="space-y-1">
              {sectionNotesLabel ? (
                <p className="text-sm font-medium text-foreground break-words">
                  {sectionNotesLabel}
                </p>
              ) : null}
              <p className="text-sm text-muted-foreground whitespace-pre-line break-words leading-relaxed">
                {sectionDescription}
              </p>
            </div>
          ) : null}
        </div>
      );
    }
    const fieldKey =
      item.kind === "custom_field" ? `custom:${item.id}` : item.builtinId;
    const renderedItem =
      item.kind === "custom_field" ? renderCustomField(item) : renderBuiltInField(item);
    if (!renderedItem) return null;

    return (
      <div key={`field-anchor:${item.id}`} data-field-key={fieldKey}>
        {renderedItem}
      </div>
    );
  }

  const getBuiltInDisplayLabel = React.useCallback((
    builtinId: string,
    fallbackLabel: string,
  ) => {
    const layoutItem = visibleActiveLayout.find(
      (item): item is Extract<FormLayoutItem, { kind: "builtin_field" }> =>
        item.kind === "builtin_field" && item.builtinId === builtinId,
    );
    if (!layoutItem) return fallbackLabel;
    return getDisplayLabelForBuiltInField(layoutItem, fallbackLabel);
  }, [visibleActiveLayout]);

  const summaryLocale = localeCode === "en" ? "en" : "id";
  const summaryFullWhatsapp = phone ? `${countryCode}${phone}` : "";
  const buildSummarySessionFieldLabel = React.useCallback(
    (sessionLabel: string, kind: "date" | "time" | "location") => {
      const normalizedSessionLabel = sessionLabel.trim();
      if (!normalizedSessionLabel) {
        if (kind === "date") return t("summaryDateLabel");
        if (kind === "time") return t("summaryTimeLabel");
        return t("summaryLocationLabel");
      }

      if (localeCode === "en") {
        if (kind === "date") return `${normalizedSessionLabel} Date`;
        if (kind === "time") return `${normalizedSessionLabel} Time`;
        return `${normalizedSessionLabel} Location`;
      }

      if (kind === "date") return `Tanggal ${normalizedSessionLabel}`;
      if (kind === "time") return `Jam ${normalizedSessionLabel}`;
      return `Lokasi ${normalizedSessionLabel}`;
    },
    [localeCode, t],
  );
  const summaryExtraData = React.useMemo(() => {
    const merged = { ...extraData };
    if (eventType === "Wedding" && splitDates) {
      merged.tanggal_akad = akadDate || "";
      merged.tanggal_resepsi = resepsiDate || "";
    }
    if (eventType === "Wisuda" && splitDates) {
      merged.tanggal_wisuda_1 = wisudaSession1Date || "";
      merged.tanggal_wisuda_2 = wisudaSession2Date || "";
    }
    return merged;
  }, [
    akadDate,
    eventType,
    extraData,
    resepsiDate,
    splitDates,
    wisudaSession1Date,
    wisudaSession2Date,
  ]);
  const summaryResolvedLocation = React.useMemo(() => {
    const isWeddingEvent = eventType === "Wedding";
    const isWisudaEvent = eventType === "Wisuda";
    const isSplitSessionEnabled = splitDates && (isWeddingEvent || isWisudaEvent);
    return resolvePreferredLocation(
      isWeddingEvent
        ? [
            {
              address: extraData.tempat_akad,
              lat: extraLocationCoords.tempat_akad?.lat,
              lng: extraLocationCoords.tempat_akad?.lng,
            },
            {
              address: extraData.tempat_resepsi,
              lat: extraLocationCoords.tempat_resepsi?.lat,
              lng: extraLocationCoords.tempat_resepsi?.lng,
            },
            {
              address: location,
              lat: locationCoords.lat,
              lng: locationCoords.lng,
            },
          ]
        : isWisudaEvent && isSplitSessionEnabled
          ? [
              {
                address: extraData.tempat_wisuda_1,
                lat: extraLocationCoords.tempat_wisuda_1?.lat,
                lng: extraLocationCoords.tempat_wisuda_1?.lng,
              },
              {
                address: extraData.tempat_wisuda_2,
                lat: extraLocationCoords.tempat_wisuda_2?.lat,
                lng: extraLocationCoords.tempat_wisuda_2?.lng,
              },
              {
                address: location,
                lat: locationCoords.lat,
                lng: locationCoords.lng,
              },
            ]
          : [
              {
                address: location,
                lat: locationCoords.lat,
                lng: locationCoords.lng,
              },
            ],
    );
  }, [
    eventType,
    extraData.tempat_akad,
    extraData.tempat_resepsi,
    extraData.tempat_wisuda_1,
    extraData.tempat_wisuda_2,
    extraLocationCoords.tempat_akad?.lat,
    extraLocationCoords.tempat_akad?.lng,
    extraLocationCoords.tempat_resepsi?.lat,
    extraLocationCoords.tempat_resepsi?.lng,
    extraLocationCoords.tempat_wisuda_1?.lat,
    extraLocationCoords.tempat_wisuda_1?.lng,
    extraLocationCoords.tempat_wisuda_2?.lat,
    extraLocationCoords.tempat_wisuda_2?.lng,
    location,
    locationCoords.lat,
    locationCoords.lng,
    splitDates,
  ]);
  const summaryServiceSelections = React.useMemo<BookingServiceSelection[]>(
    () => [
      ...selectedMainServices.map((service, index) => ({
        id: service.id,
        booking_service_id: null,
        kind: "main" as const,
        sort_order: index,
        quantity: selectedMainQuantities[service.id] || 1,
        service: {
          id: service.id,
          name: service.name,
          duration_minutes: service.duration_minutes ?? null,
          is_addon: false,
          affects_schedule: service.affects_schedule ?? null,
        },
      })),
      ...selectedAddonServices.map((service, index) => ({
        id: service.id,
        booking_service_id: null,
        kind: "addon" as const,
        sort_order: index,
        quantity: selectedAddonQuantityMap[service.id] || 1,
        service: {
          id: service.id,
          name: service.name,
          duration_minutes: service.duration_minutes ?? null,
          is_addon: true,
          affects_schedule: service.affects_schedule ?? null,
        },
      })),
    ],
    [
      selectedAddonQuantityMap,
      selectedAddonServices,
      selectedMainQuantities,
      selectedMainServices,
    ],
  );
  const summarySessionRows = React.useMemo(() => {
    const totalDurationMinutes = getBookingDurationMinutes(summaryServiceSelections);
    const sessions = resolveBookingCalendarSessions({
      eventType,
      sessionDate: sessionDate || null,
      extraFields: summaryExtraData,
      defaultLocation: summaryResolvedLocation.location,
    });
    const sessionDurationMinutesByKey = resolveSessionDurationMinutesBySessionKey({
      eventType,
      sessions,
      totalDurationMinutes,
      extraFields: summaryExtraData,
    });
    return sessions.map((session) => {
      const durationMinutes =
        sessionDurationMinutesByKey[session.key] || totalDurationMinutes;
      return {
        key: session.key,
        label: session.label?.trim() || "",
        date: formatSessionDate(session.sessionDate, {
          locale: summaryLocale,
          withDay: false,
          withTime: false,
          dateOnly: true,
        }),
        time: formatSessionTimeRange(session.sessionDate, durationMinutes),
        location: session.location || summaryResolvedLocation.location || "-",
      };
    });
  }, [
    eventType,
    sessionDate,
    summaryExtraData,
    summaryLocale,
    summaryResolvedLocation.location,
    summaryServiceSelections,
  ]);
  const summaryExtraFieldRows = React.useMemo<SummaryRow[]>(() => {
    const rows: SummaryRow[] = [];
    visibleActiveLayout
      .filter(
        (item): item is Extract<FormLayoutItem, { kind: "builtin_field" }> =>
          item.kind === "builtin_field" && item.builtinId.startsWith("extra:"),
      )
      .forEach((item) => {
        const key = item.builtinId.slice("extra:".length);
        const extraDefinition = currentExtraFields.find((field) => field.key === key);
        if (eventType === "Wedding" && key === "nama_pasangan") {
          return;
        }
        if (isSplitLocationExtraBuiltinId(eventType, item.builtinId)) {
          return;
        }
        const value =
          key === UNIVERSITY_EXTRA_FIELD_KEY
            ? extraData[key] || ""
            : extraData[key] || "";
        if (!value.trim()) return;
        rows.push({
          label:
            (typeof item.labelOverride === "string" && item.labelOverride.trim().length > 0
              ? item.labelOverride
              : "") ||
            extraDefinition?.label ||
            key.replace(/_/g, " "),
          value,
          icon: extraDefinition?.isLocation ? MapPin : List,
        });
      });
    return rows;
  }, [currentExtraFields, eventType, extraData, visibleActiveLayout]);
  const summaryCustomFieldRows = React.useMemo<SummaryRow[]>(() => {
    const rows: SummaryRow[] = [];
    visibleActiveLayout
      .filter(
        (item): item is Extract<FormLayoutItem, { kind: "custom_field" }> =>
          item.kind === "custom_field",
      )
      .forEach((item) => {
        const value = customFields[item.id] || "";
        if (!value.trim()) return;
        rows.push({
          label: item.label || t("summaryCustomFieldFallback"),
          value,
          icon: List,
        });
      });
    return rows;
  }, [customFields, t, visibleActiveLayout]);
  const summaryClientInfoRows = React.useMemo<SummaryRow[]>(
    () =>
      [
        {
          label: getBuiltInDisplayLabel("client_name", t("summaryClientName")),
          value: clientName.trim(),
          icon: getBuiltInFieldIcon("client_name"),
        },
        {
          label: getBuiltInDisplayLabel(
            "extra:nama_pasangan",
            currentExtraFields.find((field) => field.key === "nama_pasangan")?.label ||
              "Nama Pasangan",
          ),
          value:
            eventType === "Wedding" ? extraData.nama_pasangan?.trim() || "" : "",
          icon: User,
        },
        {
          label: getBuiltInDisplayLabel("client_whatsapp", t("summaryWhatsapp")),
          value: summaryFullWhatsapp.trim(),
          icon: getBuiltInFieldIcon("client_whatsapp"),
        },
        {
          label: getBuiltInDisplayLabel("instagram", "Instagram"),
          value: instagram.trim() ? `@${instagram.trim().replace(/^@/, "")}` : "",
          icon: getBuiltInFieldIcon("instagram"),
        },
        {
          label: getBuiltInDisplayLabel("event_type", t("summaryEventType")),
          value: eventType.trim(),
          icon: getBuiltInFieldIcon("event_type"),
        },
        {
          label: t("summaryCity"),
          value: selectedCity ? buildCityDisplayName(selectedCity) : "",
          icon: List,
        },
      ].filter((row) => row.value.length > 0),
    [
      clientName,
      currentExtraFields,
      eventType,
      extraData.nama_pasangan,
      instagram,
      selectedCity,
      summaryFullWhatsapp,
      getBuiltInDisplayLabel,
      t,
    ],
  );
  const summarySessionDetailRows = React.useMemo<SummaryRow[]>(() => {
    const rows: SummaryRow[] = [];

    summarySessionRows.forEach((session) => {
      const startsReceptionGroup =
        eventType === "Wedding" &&
        splitDates &&
        session.key === "resepsi";
      rows.push({
        label: buildSummarySessionFieldLabel(session.label, "date"),
        value: session.date,
        icon: CalendarDays,
        startsSessionGroup: startsReceptionGroup,
      });
      rows.push({
        label: buildSummarySessionFieldLabel(session.label, "time"),
        value: session.time,
        icon: Clock3,
      });
      rows.push({
        label: buildSummarySessionFieldLabel(session.label, "location"),
        value: session.location,
        icon: MapPin,
      });
    });

    if (locationDetail.trim()) {
      rows.push({
        label: getBuiltInDisplayLabel("location_detail", t("summaryLocationDetailLabel")),
        value: locationDetail.trim(),
        icon: getBuiltInFieldIcon("location_detail"),
      });
    }

    if (notes.trim()) {
      rows.push({
        label: getBuiltInDisplayLabel("notes", t("catatan")),
        value: notes.trim(),
        icon: getBuiltInFieldIcon("notes"),
      });
    }

    summaryExtraFieldRows.forEach((row) => {
      rows.push(row);
    });
    summaryCustomFieldRows.forEach((row) => {
      rows.push(row);
    });

    return rows.filter((row) => row.value.length > 0);
  }, [
    buildSummarySessionFieldLabel,
    eventType,
    getBuiltInDisplayLabel,
    locationDetail,
    notes,
    splitDates,
    summaryCustomFieldRows,
    summaryExtraFieldRows,
    summarySessionRows,
  ]);
  const summaryPackageRows = React.useMemo<SummaryRow[]>(
    () =>
      [
        {
          label: getBuiltInDisplayLabel("service_package", t("summaryMainPackage")),
          value: selectedMainServices
            .map((service) => {
              const quantity = selectedMainQuantities[service.id] || 1;
              return quantity > 1 ? `${service.name} x${quantity}` : service.name;
            })
            .join(", "),
          icon: getBuiltInFieldIcon("service_package"),
        },
        {
          label: getBuiltInDisplayLabel("addon_packages", t("summaryAddon")),
          value: selectedAddonServices
            .map((service) => {
              const quantity = selectedAddonQuantityMap[service.id] || 1;
              return quantity > 1 ? `${service.name} x${quantity}` : service.name;
            })
            .join(", "),
          icon: getBuiltInFieldIcon("addon_packages"),
        },
      ].filter((row) => row.value.length > 0),
    [
      selectedAddonQuantityMap,
      selectedAddonServices,
      selectedMainQuantities,
      selectedMainServices,
      t,
      getBuiltInDisplayLabel,
    ],
  );
  const summaryCostRows = React.useMemo(() => {
    const rows: Array<{
      id: string;
      label: string;
      value: string;
      tone: "item" | "subtotal" | "adjustment" | "discount" | "total";
    }> = [];

    selectedMainServices.forEach((service) => {
      const quantity = selectedMainQuantities[service.id] || 1;
      rows.push({
        id: `package:${service.id}`,
        label: `${t("summaryCostPackageItem")} • ${service.name}${quantity > 1 ? ` x${quantity}` : ""}`,
        value: formatCurrency(service.price * quantity),
        tone: "item",
      });
    });

    selectedAddonServices.forEach((service) => {
      const quantity = selectedAddonQuantityMap[service.id] || 1;
      rows.push({
        id: `addon:${service.id}`,
        label: `${t("summaryCostAddonItem")} • ${service.name}${quantity > 1 ? ` x${quantity}` : ""}`,
        value: `+ ${formatCurrency(service.price * quantity)}`,
        tone: "item",
      });
    });

    rows.push({
      id: "subtotal-package",
      label: t("summaryCostPackageSubtotal"),
      value: formatCurrency(selectedPackageTotal),
      tone: "subtotal",
    });
    rows.push({
      id: "subtotal-addon",
      label: t("summaryCostAddonSubtotal"),
      value: formatCurrency(selectedAddonTotal),
      tone: "subtotal",
    });

    if (accommodationFee > 0) {
      rows.push({
        id: "accommodation-fee",
        label: t("summaryCostAccommodation"),
        value: `+ ${formatCurrency(accommodationFee)}`,
        tone: "adjustment",
      });
    }

    if (discountAmount > 0) {
      rows.push({
        id: "discount",
        label: t("summaryCostDiscount"),
        value: `- ${formatCurrency(discountAmount)}`,
        tone: "discount",
      });
    }

    rows.push({
      id: "total-booking",
      label: t("summaryTotal"),
      value: formatCurrency(selectedBookingTotal),
      tone: "total",
    });

    return rows;
  }, [
    accommodationFee,
    discountAmount,
    selectedAddonQuantityMap,
    selectedAddonServices,
    selectedAddonTotal,
    selectedBookingTotal,
    selectedMainQuantities,
    selectedMainServices,
    selectedPackageTotal,
    t,
  ]);

  function renderSummaryRowLabel(row: SummaryRow) {
    const Icon = row.icon || List;
    return (
      <span className="inline-flex items-start gap-1.5">
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span>{row.label}</span>
      </span>
    );
  }

  // ── Success screen ──

  if (resolvedSpecialOfferStatus === "expired") {
    return (
      <div
        className="public-light-theme min-h-screen flex items-center justify-center px-4"
        style={{
          backgroundImage: `linear-gradient(135deg, ${brandColor}12 0%, #fff8f1 45%, #ffffff 100%)`,
        }}
      >
        <div className="w-full max-w-md rounded-3xl border bg-background/95 p-8 text-center shadow-xl backdrop-blur-sm">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <AlertTriangle className="h-10 w-10" />
          </div>
          <div className="mt-6 space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">
              {t("specialLinkExpiredTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("specialLinkExpiredMessage")}
            </p>
          </div>
          <div
            className="mx-auto mt-6 h-1.5 w-20 rounded-full"
            style={{ backgroundColor: brandColor }}
          />
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="public-light-theme min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 px-4">
        <div className="text-center space-y-6 max-w-md mx-auto">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
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
    <div
      className="public-light-theme min-h-screen px-4 py-8 sm:py-12"
      style={{
        backgroundImage: `linear-gradient(135deg, ${brandColor}18 0%, #ffffff 40%, #f8fafc 100%)`,
      }}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Vendor Header */}
        <div className="text-center space-y-3">
          <div className="w-20 h-20 bg-background border-2 rounded-full mx-auto flex items-center justify-center font-bold text-2xl shadow-sm overflow-hidden">
            {effectiveVendor.avatar_url ? (
              <img
                src={effectiveVendor.avatar_url}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : effectiveVendor.invoice_logo_url ? (
              <img
                src={effectiveVendor.invoice_logo_url}
                alt="Logo"
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
            <p className="text-muted-foreground text-sm whitespace-pre-line break-words leading-relaxed">
              {effectiveVendor.form_greeting || t("greetingDefault")}
            </p>
          </div>
        </div>

        {/* Form */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="bg-background rounded-2xl shadow-lg border p-6 sm:p-8 space-y-5"
        >
          <div className="grid gap-2 md:grid-cols-4">
            {[
              { id: 1 as BookingStep, label: t("stepInfoClient") },
              { id: 2 as BookingStep, label: t("stepPackageAddon") },
              { id: 3 as BookingStep, label: t("stepSummary") },
              { id: 4 as BookingStep, label: t("stepPaymentConfirm") },
            ].map((step) => {
              const active = currentStep === step.id;
              const done = step.id < currentStep && step.id <= maxUnlockedStep;
              const locked = step.id > maxUnlockedStep;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => goToStep(step.id)}
                  disabled={locked}
                  title={locked ? t("stepLockedHint") : undefined}
                  className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                    active
                      ? "border-foreground bg-foreground/5"
                      : done
                        ? "border-green-200 bg-green-50"
                        : locked
                          ? "cursor-not-allowed border-input bg-background opacity-60"
                          : "border-input bg-background"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                        active
                          ? "bg-foreground text-background"
                          : done
                            ? "bg-green-600 text-white"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {step.id}
                    </span>
                    <span className="text-sm font-medium">{step.label}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {currentStep === 1 &&
            infoStepSections.map((section) => {
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

          {currentStep === 2 &&
            packageSelectionSections.map((section) => {
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
                      {t("stepPackageAddon")}
                    </h3>
                    <div className="h-px w-full bg-border" />
                  </div>
                  <div className="space-y-4">{renderedItems}</div>
                </section>
              );
            })}

          {currentStep === 3 && (
            <section className="space-y-5 rounded-xl border bg-muted/20 p-4 sm:p-5">
              <h3 className="text-base font-semibold" style={{ color: brandColor }}>
                {t("summaryTitle")}
              </h3>

              <div className="divide-y text-sm">
                <div className="space-y-2 py-4 first:pt-0">
                  <h4 className="text-sm font-semibold">{t("summarySectionClientInfo")}</h4>
                  {summaryClientInfoRows.length === 0 ? (
                    <p className="text-muted-foreground">-</p>
                  ) : (
                    <div className="space-y-1.5">
                      {summaryClientInfoRows.map((row) => (
                        <div
                          key={`${row.label}-${row.value}`}
                          className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                        >
                          <p className="text-muted-foreground break-words sm:max-w-[45%]">
                            {renderSummaryRowLabel(row)}
                          </p>
                          <p className="font-medium break-words leading-relaxed max-w-full sm:max-w-[55%] sm:text-right">{row.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2 py-4">
                  <h4 className="text-sm font-semibold">{t("summarySectionSessionDetail")}</h4>
                  {summarySessionDetailRows.length === 0 ? (
                    <p className="text-muted-foreground">-</p>
                  ) : (
                    <div className="space-y-1.5">
                      {summarySessionDetailRows.map((row) => (
                        <div
                          key={`${row.label}-${row.value}`}
                          className={`flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4 ${
                            row.startsSessionGroup
                              ? "border-t border-dashed border-border pt-3"
                              : ""
                          }`}
                        >
                          <p className="text-muted-foreground break-words sm:max-w-[45%]">
                            {renderSummaryRowLabel(row)}
                          </p>
                          <p className="font-medium break-words leading-relaxed max-w-full sm:max-w-[55%] sm:text-right">{row.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2 py-4">
                  <h4 className="text-sm font-semibold">{t("summarySectionPackageAddon")}</h4>
                  {summaryPackageRows.length === 0 ? (
                    <p className="text-muted-foreground">-</p>
                  ) : (
                    <div className="space-y-1.5">
                      {summaryPackageRows.map((row) => (
                        <div
                          key={`${row.label}-${row.value}`}
                          className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                        >
                          <p className="text-muted-foreground break-words sm:max-w-[45%]">
                            {renderSummaryRowLabel(row)}
                          </p>
                          <p className="font-medium break-words leading-relaxed max-w-full sm:max-w-[55%] sm:text-right">{row.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2 py-4 last:pb-0">
                  <h4 className="text-sm font-semibold">{t("summarySectionTotalBooking")}</h4>
                  <div className="space-y-1.5">
                    {summaryCostRows.map((row) => (
                      <div
                        key={row.id}
                        className={`flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4 ${
                          row.tone === "total"
                            ? "border-t pt-2 mt-2"
                            : ""
                        }`}
                      >
                        <p
                          className={
                            row.tone === "total"
                              ? "font-semibold break-words sm:max-w-[45%]"
                              : row.tone === "subtotal"
                                ? "font-medium break-words sm:max-w-[45%]"
                                : "text-muted-foreground break-words sm:max-w-[45%]"
                          }
                        >
                          {row.label}
                        </p>
                        <p
                          className={`break-words leading-relaxed max-w-full sm:max-w-[55%] sm:text-right ${
                            row.tone === "total"
                              ? "text-lg font-semibold"
                              : row.tone === "discount"
                                ? "font-medium text-rose-600"
                                : "font-medium"
                          }`}
                        >
                          {row.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">{t("summaryCheckHint")}</p>
            </section>
          )}

          {currentStep === 4 && (
            <>
              {paymentConfirmationSections.map((section) => {
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
                      disabled={!canAcceptTerms}
                      checked={termsAccepted}
                      onChange={(e) => {
                        setTermsAccepted(e.target.checked);
                        if (e.target.checked) setError("");
                      }}
                      className="mt-1 h-4 w-4 rounded border-input accent-primary disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <label
                      htmlFor="booking-terms"
                      className="text-sm leading-6 text-muted-foreground"
                    >
                      {termsAgreementText} <span className="text-red-500">*</span>{" "}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleTermsDialogOpenChange(true);
                        }}
                        className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-4 cursor-pointer"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {termsLinkText}
                      </button>
                      {termsSuffixText ? ` ${termsSuffixText}` : ""}
                    </label>
                  </div>
                  {!canAcceptTerms && (
                    <p className="text-xs text-muted-foreground">
                      {t("termsReadHint")}
                    </p>
                  )}
                </section>
              )}
            </>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={goPrevStep}
                className="inline-flex h-11 items-center justify-center rounded-lg border px-4 text-sm font-semibold transition-colors hover:bg-muted"
              >
                {t("buttonBack")}
              </button>
            ) : (
              <span />
            )}

            {currentStep < 4 ? (
              <button
                key="footer-next-button"
                type="button"
                onClick={goNextStep}
                data-step-action="next"
                className="inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: brandColor }}
              >
                {t("buttonNext")}
              </button>
            ) : (
              <button
                key="footer-submit-button"
                type="submit"
                disabled={submitting || !confirmationSubmitEnabled}
                data-step-action="submit"
                className="flex items-center justify-center gap-2 h-11 rounded-lg px-4 text-white font-semibold hover:opacity-90 transition-opacity shadow-lg cursor-pointer disabled:opacity-50 text-sm"
                style={{
                  backgroundColor: brandColor,
                  boxShadow: `0 10px 15px -3px ${brandColor}33`,
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {uploadingProof ? t("mengupload") : t("mengirim")}
                  </>
                ) : (
                  <>{t("kirimBooking")}</>
                )}
              </button>
            )}
          </div>
        </form>

        <Dialog open={packageDialogOpen} onOpenChange={setPackageDialogOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t("paketLayanan")}</DialogTitle>
              <DialogDescription>
                {allowMultiplePackages
                  ? "Pilih satu atau lebih paket utama sesuai kebutuhan."
                  : "Pilih satu paket utama."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <input
                value={packageSearchQuery}
                onChange={(event) => setPackageSearchQuery(event.target.value)}
                placeholder={t("searchPackagePlaceholder")}
                className={inputClass}
              />
              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => setPackageViewMode("list")}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                    packageViewMode === "list"
                      ? "border-foreground bg-foreground/5 text-foreground"
                      : "border-input text-muted-foreground hover:bg-muted/60"
                  }`}
                  title="Tampilan baris"
                  aria-label="Tampilan baris"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPackageViewMode("grid")}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                    packageViewMode === "grid"
                      ? "border-foreground bg-foreground/5 text-foreground"
                      : "border-input text-muted-foreground hover:bg-muted/60"
                  }`}
                  title="Tampilan kotak"
                  aria-label="Tampilan kotak"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
              <div
                className={`max-h-[55vh] overflow-y-auto pr-1 ${
                  packageViewMode === "grid"
                    ? "grid grid-cols-1 gap-2 sm:grid-cols-2"
                    : "space-y-2"
                }`}
              >
                {isCityScopedEvent && !normalizedSelectedCityCode ? (
                  <div className={`rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground ${packageViewMode === "grid" ? "sm:col-span-2" : ""}`}>
                    Pilih kota/kabupaten dulu untuk melihat paket.
                  </div>
                ) : filteredServices.length === 0 ? (
                  <div className={`rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground ${packageViewMode === "grid" ? "sm:col-span-2" : ""}`}>
                    Belum ada paket untuk tipe acara ini.
                  </div>
                ) : searchedMainServices.length === 0 ? (
                  <div className={`rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground ${packageViewMode === "grid" ? "sm:col-span-2" : ""}`}>
                    {t("noPackageSearchResults")}
                  </div>
                ) : (
                  searchedMainServices.map((service) => {
                    const selected = selectedServiceIds.includes(service.id);
                    const quantity = selectedMainQuantities[service.id] || 1;
                    const tone = buildServiceSoftPalette({
                      serviceColor: service.color,
                      fallbackColor: brandColor,
                      selected,
                    });
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => {
                          handleServiceChange(service.id);
                          if (!allowMultiplePackages && !packageLocked) {
                            setPackageDialogOpen(false);
                          }
                        }}
                        className={`flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-all cursor-pointer hover:opacity-95 ${selected ? "shadow-sm" : ""} ${packageViewMode === "grid" ? "h-full" : ""}`}
                        style={{
                          backgroundColor: tone.backgroundColor,
                          borderColor: tone.borderColor,
                          boxShadow: selected
                            ? `0 0 0 1px ${tone.ringColor}`
                            : undefined,
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded border"
                            style={{
                              borderColor: tone.iconBorderColor,
                              backgroundColor: selected ? tone.color : "transparent",
                              color: selected ? "#ffffff" : "transparent",
                            }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium">
                                {service.name}
                              </p>
                              {selected && quantity > 1 ? (
                                <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                  x{quantity}
                                </span>
                              ) : null}
                            </div>
                            {service.description ? (
                              <p className="text-[11px] text-muted-foreground whitespace-pre-line break-words">
                                {service.description}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        {!shouldHideServicePrices ? (
                          <div className="shrink-0 text-right">
                            <p
                              className="text-sm font-semibold"
                              style={{ color: tone.color }}
                            >
                              {formatCurrency(service.price * quantity)}
                            </p>
                            {service.original_price &&
                            service.original_price > service.price ? (
                              <p className="text-[11px] text-muted-foreground line-through">
                                {formatCurrency(service.original_price * quantity)}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPackageDialogOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-medium transition-colors hover:bg-muted cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={addonDialogOpen} onOpenChange={setAddonDialogOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Paket Add-on</DialogTitle>
              <DialogDescription>
                {allowMultipleAddons
                  ? "Pilih add-on tambahan, bisa pilih lebih dari satu."
                  : "Pilih satu add-on tambahan."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <input
                value={addonSearchQuery}
                onChange={(event) => setAddonSearchQuery(event.target.value)}
                placeholder={t("searchAddonPlaceholder")}
                className={inputClass}
              />
              <div className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => setAddonViewMode("list")}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                    addonViewMode === "list"
                      ? "border-foreground bg-foreground/5 text-foreground"
                      : "border-input text-muted-foreground hover:bg-muted/60"
                  }`}
                  title="Tampilan baris"
                  aria-label="Tampilan baris"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setAddonViewMode("grid")}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                    addonViewMode === "grid"
                      ? "border-foreground bg-foreground/5 text-foreground"
                      : "border-input text-muted-foreground hover:bg-muted/60"
                  }`}
                  title="Tampilan kotak"
                  aria-label="Tampilan kotak"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
              <div
                className={`max-h-[55vh] overflow-y-auto pr-1 ${
                  addonViewMode === "grid"
                    ? "grid grid-cols-1 gap-2 sm:grid-cols-2"
                    : "space-y-2"
                }`}
              >
                {isCityScopedEvent && !normalizedSelectedCityCode ? (
                  <div className={`rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground ${addonViewMode === "grid" ? "sm:col-span-2" : ""}`}>
                    Pilih kota/kabupaten dulu untuk melihat add-on.
                  </div>
                ) : addonServices.length === 0 ? (
                  <div className={`rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground ${addonViewMode === "grid" ? "sm:col-span-2" : ""}`}>
                    Belum ada add-on untuk tipe acara ini.
                  </div>
                ) : searchedAddonServices.length === 0 ? (
                  <div className={`rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground ${addonViewMode === "grid" ? "sm:col-span-2" : ""}`}>
                    {t("noAddonSearchResults")}
                  </div>
                ) : (
                  searchedAddonServices.map((addon) => {
                    const selected = selectedAddons.has(addon.id);
                    const quantity = selectedAddonQuantityMap[addon.id] || 1;
                    const tone = buildServiceSoftPalette({
                      serviceColor: addon.color,
                      fallbackColor: brandColor,
                      selected,
                    });
                    return (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() => {
                          handleAddonToggle(addon.id);
                          if (!allowMultipleAddons && !addonLocked) {
                            setAddonDialogOpen(false);
                          }
                        }}
                        className={`flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-all cursor-pointer hover:opacity-95 ${selected ? "shadow-sm" : ""} ${addonViewMode === "grid" ? "h-full" : ""}`}
                        style={{
                          backgroundColor: tone.backgroundColor,
                          borderColor: tone.borderColor,
                          boxShadow: selected
                            ? `0 0 0 1px ${tone.ringColor}`
                            : undefined,
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded border"
                            style={{
                              borderColor: tone.iconBorderColor,
                              backgroundColor: selected ? tone.color : "transparent",
                              color: selected ? "#ffffff" : "transparent",
                            }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium">{addon.name}</p>
                              {selected && quantity > 1 ? (
                                <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                  x{quantity}
                                </span>
                              ) : null}
                            </div>
                            {addon.description ? (
                              <p className="text-[11px] text-muted-foreground whitespace-pre-line break-words">
                                {addon.description}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        {!shouldHideServicePrices ? (
                          <div className="shrink-0 text-right">
                            <p
                              className="text-sm font-semibold"
                              style={{ color: tone.color }}
                            >
                              +{formatCurrency(addon.price * quantity)}
                            </p>
                          </div>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setAddonDialogOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-medium transition-colors hover:bg-muted cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {hasTerms && (
          <Dialog open={termsDialogOpen} onOpenChange={handleTermsDialogOpenChange}>
            <DialogContent className="sm:max-w-2xl flex max-h-[85vh] flex-col overflow-hidden overflow-y-hidden">
              <DialogHeader>
                <DialogTitle>{termsLinkText}</DialogTitle>
                <DialogDescription>
                  {t("termsDialogDescription")}
                </DialogDescription>
              </DialogHeader>
              <div
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg border bg-muted/20 p-4 text-sm leading-6 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic [&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-item [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
                style={{ WebkitOverflowScrolling: "touch" }}
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

        {showPoweredBy && (
          <p className="text-center text-xs text-muted-foreground pb-4">
            Powered by <span className="font-semibold">Client Desk</span>
          </p>
        )}
      </div>
    </div>
  );
}
