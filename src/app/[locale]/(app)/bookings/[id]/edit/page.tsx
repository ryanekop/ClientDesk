"use client";

import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Save, Loader2, Users, CalendarClock, Wallet, StickyNote, Plus, Minus, Link2, CheckCircle2, Search, List, LayoutGrid, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionFeedbackDialog } from "@/components/ui/action-feedback-dialog";
import { CancelStatusPaymentDialog } from "@/components/cancel-status-payment-dialog";
import { createClient } from "@/utils/supabase/client";
import { Link, useRouter } from "@/i18n/routing";
import {
    BookingWriteReadonlyBanner,
    useBookingWriteAccess,
    useBookingWriteGuard,
} from "@/lib/booking-write-access-context";
import {
    LocationAutocomplete,
    type LocationSelectionMeta,
} from "@/components/ui/location-autocomplete";
import { UniversityAutocomplete } from "@/components/ui/university-autocomplete";
import { CitySingleSelect } from "@/components/ui/city-single-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
    adminNativeDateTimeInputClass,
    adminNativeSelectClass,
} from "@/components/ui/admin-native-form-controls";
import { cn } from "@/lib/utils";
import { BookingAdminCustomFields } from "@/components/form-builder/booking-admin-custom-fields";
import {
    buildCustomFieldSnapshots,
    extractCustomFieldValueMap,
    getGroupedCustomLayoutSections,
    resolveNormalizedActiveFormLayout,
} from "@/components/form-builder/booking-form-layout";
import { getLayoutExtraFields } from "@/utils/form-extra-fields";
import {
    getActiveEventTypes,
    getBuiltInEventTypes,
    normalizeEventTypeName,
    normalizeEventTypeList,
} from "@/lib/event-type-config";
import {
    DEFAULT_CLIENT_STATUSES,
    getBookingStatusOptions,
    getInitialBookingStatus,
    isCancelledBookingStatus,
    resolveUnifiedBookingStatus,
} from "@/lib/client-status";
import { resolvePreferredLocation } from "@/utils/location";
import {
    isTransitionToCancelled,
    syncGoogleCalendarForStatusTransition,
} from "@/utils/google-calendar-status-sync";
import { buildCancelPaymentPatch, type CancelPaymentPolicy } from "@/lib/cancel-payment";
import {
    buildAutoDpVerificationPatch,
    getDpRefundAmount,
    getFinalAdjustmentsTotal,
    getFinalInvoiceTotal,
    getNetVerifiedRevenueAmount,
    getRemainingFinalPayment,
    isBookingFullyPaid,
    getSettlementLabel,
    getSettlementStatus,
    getVerifiedDpAmount,
    normalizeFinalAdjustments,
} from "@/lib/final-settlement";
import {
    appendUniqueOperationalCosts,
    buildOperationalCostFromDefaultItem,
    buildOperationalCostFromTemplateItem,
    getNetRevenueAfterOperationalCosts,
    getOperationalCostsTotal,
    normalizeOperationalCostPricelistItems,
    normalizeOperationalCosts,
    normalizeOperationalCostTemplates,
    normalizeDefaultOperationalCosts,
    type OperationalCost,
    type OperationalCostTemplate,
    type DefaultOperationalCostItem,
} from "@/lib/operational-costs";
import {
    buildEditableSpecialOfferSnapshot,
    computeSpecialOfferTotal,
    mergeSpecialOfferSnapshotIntoExtraFields,
    resolveSpecialOfferSnapshotFromExtraFields,
} from "@/lib/booking-special-offer";
import {
    getUniversityReferenceId,
    hasUniversityValue,
    UNIVERSITY_EXTRA_FIELD_KEY,
    UNIVERSITY_REFERENCE_EXTRA_KEY,
} from "@/lib/university-references";
import {
    normalizeModeAwareFormSectionsByEventType,
    type ModeAwareFormSectionsByEventType,
} from "@/lib/form-sections";
import {
    buildBookingServicePayloadItemsFromSelection,
    getBookingDurationMinutes,
    normalizeBookingServiceQuantity,
    normalizeBookingServiceQuantityMap,
    toBookingServicesPayload,
    type BookingServiceQuantityMap,
    type BookingServiceSelection,
} from "@/lib/booking-services";
import {
    buildWisudaSessionDurationOverride,
    getWisudaSessionDurationExtraFieldKey,
    parseWisudaSessionDurationOverride,
} from "@/lib/wisuda-session-duration";
import {
    buildCityDisplayName,
    normalizeCityCode,
    type CityReferenceItem,
} from "@/lib/city-references";
import {
    filterServicesForBookingSelection,
    isCityScopedBookingEventType,
} from "@/lib/service-availability";
import {
    getValidBankAccounts,
    getPaymentMethodLabel,
    getPaymentSourceOptionValue,
    normalizeBankAccounts,
    resolvePaymentSourceFromOptionValue,
    type BankAccount,
    type PaymentSource,
} from "@/lib/payment-config";
import {
    buildServiceSoftPalette,
    normalizeHexColor,
    resolveHexColor,
    withAlpha,
} from "@/lib/service-colors";
import {
    FREELANCER_ASSIGNMENTS_EXTRA_FIELD_KEY,
    MAX_FREELANCERS_PER_SESSION,
    SESSION_FREELANCER_LABELS,
    buildSessionFreelancerUnion,
    ensureAssignmentsForSessionKeys,
    normalizeFreelancerIdList,
    normalizeSessionFreelancerAssignments,
    readSessionFreelancerAssignmentsFromExtraFields,
    resolveSplitFreelancerSessionKeys,
    type SessionFreelancerAssignments,
} from "@/lib/freelancer-session-assignments";

const inputClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";
const textareaClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-none";
const selectClass = adminNativeSelectClass;
const dateTimeInputClass = `${adminNativeDateTimeInputClass} block`;

const EVENT_TYPES = getBuiltInEventTypes();

const COUNTRY_CODES = [
    { code: "+62", flag: "🇮🇩", name: "Indonesia" },
    { code: "+60", flag: "🇲🇾", name: "Malaysia" },
    { code: "+65", flag: "🇸🇬", name: "Singapore" },
    { code: "+66", flag: "🇹🇭", name: "Thailand" },
    { code: "+84", flag: "🇻🇳", name: "Vietnam" },
    { code: "+63", flag: "🇵🇭", name: "Philippines" },
    { code: "+95", flag: "🇲🇲", name: "Myanmar" },
    { code: "+856", flag: "🇱🇦", name: "Laos" },
    { code: "+855", flag: "🇰🇭", name: "Cambodia" },
    { code: "+673", flag: "🇧🇳", name: "Brunei" },
    { code: "+670", flag: "🇹🇱", name: "Timor Leste" },
];

type ExtraFieldDefinition = {
    key: string;
    labelKey:
        | "university"
        | "faculty"
        | "partnerName"
        | "partnerInstagram"
        | "estimatedGuests"
        | "akadVenue"
        | "receptionVenue"
        | "wisudaSession1Venue"
        | "wisudaSession2Venue"
        | "pregnancyAge"
        | "babyGender"
        | "babyName"
        | "dateOfBirth"
        | "brandName"
        | "contentType"
        | "memberCount";
    isLocation?: boolean;
    fullWidth?: boolean;
    required?: boolean;
    isNumeric?: boolean;
};

const EXTRA_FIELDS_DEF: Record<string, ExtraFieldDefinition[]> = {
    Wisuda: [
        { key: "universitas", labelKey: "university", required: true },
        { key: "fakultas", labelKey: "faculty" },
        { key: "tempat_wisuda_1", labelKey: "wisudaSession1Venue", isLocation: true, required: true },
        { key: "tempat_wisuda_2", labelKey: "wisudaSession2Venue", isLocation: true, required: true },
    ],
    Wedding: [
        { key: "nama_pasangan", labelKey: "partnerName", fullWidth: true, required: true },
        { key: "instagram_pasangan", labelKey: "partnerInstagram", fullWidth: true },
        { key: "jumlah_tamu", labelKey: "estimatedGuests", fullWidth: true, isNumeric: true },
        { key: "tempat_akad", labelKey: "akadVenue", isLocation: true, required: true },
        { key: "tempat_resepsi", labelKey: "receptionVenue", isLocation: true, required: true },
    ],
    Akad: [
        { key: "nama_pasangan", labelKey: "partnerName", fullWidth: true, required: true },
        { key: "instagram_pasangan", labelKey: "partnerInstagram", fullWidth: true },
        { key: "jumlah_tamu", labelKey: "estimatedGuests", fullWidth: true, isNumeric: true },
    ],
    Resepsi: [
        { key: "nama_pasangan", labelKey: "partnerName", fullWidth: true, required: true },
        { key: "instagram_pasangan", labelKey: "partnerInstagram", fullWidth: true },
        { key: "jumlah_tamu", labelKey: "estimatedGuests", fullWidth: true, isNumeric: true },
    ],
    Maternity: [
        { key: "usia_kehamilan", labelKey: "pregnancyAge" },
        { key: "gender_bayi", labelKey: "babyGender" },
    ],
    Newborn: [
        { key: "nama_bayi", labelKey: "babyName" },
        { key: "tanggal_lahir", labelKey: "dateOfBirth" },
    ],
    Komersil: [
        { key: "nama_brand", labelKey: "brandName" },
        { key: "tipe_konten", labelKey: "contentType" },
    ],
    Family: [{ key: "jumlah_anggota", labelKey: "memberCount" }],
    Lamaran: [
        { key: "nama_pasangan", labelKey: "partnerName", fullWidth: true, required: true },
        { key: "instagram_pasangan", labelKey: "partnerInstagram", fullWidth: true },
        { key: "jumlah_tamu", labelKey: "estimatedGuests", fullWidth: true, isNumeric: true },
    ],
    Prewedding: [
        { key: "nama_pasangan", labelKey: "partnerName", fullWidth: true, required: true },
        { key: "instagram_pasangan", labelKey: "partnerInstagram", fullWidth: true },
    ],
};

type Service = {
    id: string;
    name: string;
    price: number;
    original_price?: number | null;
    description?: string | null;
    color?: string | null;
    duration_minutes?: number | null;
    affects_schedule?: boolean | null;
    is_addon?: boolean | null;
    is_public?: boolean | null;
    sort_order?: number | null;
    event_types?: string[] | null;
    city_codes?: string[] | null;
    default_operational_costs?: DefaultOperationalCostItem[] | null;
};
type Freelance = {
    id: string;
    name: string;
    google_email?: string | null;
    role?: string | null;
    tags: string[];
    pricelist?: unknown;
};
type LocationCoords = { lat: number | null; lng: number | null };
type ProfileRow = {
    role?: string | null;
    custom_client_statuses?: string[] | null;
    dp_verify_trigger_status?: string | null;
    form_sections?: unknown;
    form_event_types?: string[] | null;
    custom_event_types?: unknown;
    form_brand_color?: string | null;
    team_badge_colors?: unknown;
    operational_cost_templates?: unknown;
    bank_accounts?: unknown;
};

type BadgeColorMap = Record<string, string>;
type TeamBadgeColors = {
    roles: BadgeColorMap;
    tags: BadgeColorMap;
};

type EditableOperationalCost = {
    id: string;
    label: string;
    amount: number | "";
    created_at: string;
};

function buildPackageDefaultCostSignature(
    mainIds: string[],
    mainQuantities: BookingServiceQuantityMap,
    addonIds: string[],
    addonQuantities: BookingServiceQuantityMap,
) {
    return JSON.stringify({
        main: mainIds.map((serviceId) => [
            serviceId,
            mainQuantities[serviceId] || 1,
        ]),
        addon: addonIds.map((serviceId) => [
            serviceId,
            addonQuantities[serviceId] || 1,
        ]),
    });
}

const BOOKING_EDIT_NON_ADMIN_SELECT = [
    "id",
    "booking_code",
    "tracking_uuid",
    "client_name",
    "client_whatsapp",
    "instagram",
    "event_type",
    "city_code",
    "city_name",
    "booking_date",
    "created_at",
    "session_date",
    "location",
    "location_lat",
    "location_lng",
    "location_detail",
    "service_id",
    "freelance_id",
    "total_price",
    "dp_paid",
    "dp_verified_amount",
    "dp_verified_at",
    "dp_refund_amount",
    "dp_refunded_at",
    "settlement_status",
    "is_fully_paid",
    "final_adjustments",
    "final_payment_amount",
    "final_paid_at",
    "status",
    "client_status",
    "notes",
    "admin_notes",
    "drive_folder_url",
    "video_drive_folder_url",
    "portfolio_url",
    "extra_fields",
].join(", ");

const DEFAULT_TEAM_BADGE_COLORS: TeamBadgeColors = {
    roles: {},
    tags: {},
};

const EXTRA_FIELD_LABEL_KEYS = {
    universitas: "university",
    fakultas: "faculty",
    nama_pasangan: "partnerName",
    instagram_pasangan: "partnerInstagram",
    jumlah_tamu: "estimatedGuests",
    tempat_akad: "akadVenue",
    tempat_resepsi: "receptionVenue",
    tempat_wisuda_1: "wisudaSession1Venue",
    tempat_wisuda_2: "wisudaSession2Venue",
    usia_kehamilan: "pregnancyAge",
    gender_bayi: "babyGender",
    nama_bayi: "babyName",
    tanggal_lahir: "dateOfBirth",
    nama_brand: "brandName",
    tipe_konten: "contentType",
    jumlah_anggota: "memberCount",
} as const;

const SESSION_LOCATION_FIELD_KEYS = new Set([
    "tempat_akad",
    "tempat_resepsi",
    "tempat_wisuda_1",
    "tempat_wisuda_2",
]);

function formatNumber(n: number | ""): string {
    if (n === "" || n === 0) return "";
    return new Intl.NumberFormat("id-ID").format(n);
}
function parseFormattedNumber(s: string): number | "" {
    const cleaned = s.replace(/\./g, "").replace(/,/g, "");
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? "" : num;
}
function formatCurrency(n: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(n || 0);
}

function formatDateInputValue(value: string | null | undefined) {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "";
    }
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function dateInputToStableIso(value: string) {
    const normalized = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
    const parsed = new Date(`${normalized}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

const SAFE_EDITOR_RETURN_TO_PATHS = new Set([
    "/invoice-pelunasan",
]);

function normalizeSafeEditorReturnTo(value: string | null): string | null {
    const trimmed = value?.trim() || "";
    if (!trimmed) return null;
    if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;

    const [pathname] = trimmed.split("?");
    if (!SAFE_EDITOR_RETURN_TO_PATHS.has(pathname)) {
        return null;
    }

    return trimmed;
}

function sanitizePhone(raw: string): string {
    let cleaned = raw.replace(/[^0-9]/g, "");
    if (cleaned.startsWith("62")) cleaned = cleaned.slice(2);
    if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
    return cleaned;
}

function compareServicesByCatalogOrder(a: Service, b: Service) {
    const aSort = typeof a.sort_order === "number" ? a.sort_order : Number.MAX_SAFE_INTEGER;
    const bSort = typeof b.sort_order === "number" ? b.sort_order : Number.MAX_SAFE_INTEGER;
    if (aSort !== bSort) return aSort - bSort;
    return a.name.localeCompare(b.name);
}

function isSameSessionFreelancerAssignments(
    left: SessionFreelancerAssignments,
    right: SessionFreelancerAssignments,
) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;

    for (const key of leftKeys) {
        const leftIds = left[key] || [];
        const rightIds = right[key] || [];
        if (leftIds.length !== rightIds.length) return false;
        for (let index = 0; index < leftIds.length; index++) {
            if (leftIds[index] !== rightIds[index]) return false;
        }
    }

    return true;
}

function parseExistingPhone(full: string | null): { code: string; number: string } {
    if (!full) return { code: "+62", number: "" };
    const cleaned = full.replace(/[^0-9+]/g, "");
    for (const c of COUNTRY_CODES) {
        if (cleaned.startsWith(c.code)) return { code: c.code, number: cleaned.slice(c.code.length) };
        const numericCode = c.code.replace("+", "");
        if (cleaned.startsWith(numericCode)) return { code: c.code, number: cleaned.slice(numericCode.length) };
    }
    if (cleaned.startsWith("0")) return { code: "+62", number: cleaned.slice(1) };
    return { code: "+62", number: cleaned };
}

function sanitizeDurationInput(value: string) {
    return value.replace(/\D+/g, "");
}

function normalizeFreelancerTags(value: unknown) {
    if (!Array.isArray(value)) return [] as string[];
    const nextTags: string[] = [];
    for (const item of value) {
        if (typeof item !== "string") continue;
        const normalized = item.trim();
        if (!normalized || nextTags.includes(normalized)) continue;
        nextTags.push(normalized);
    }
    return nextTags;
}

function normalizeColorRecord(value: unknown): BadgeColorMap {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }
    const next: BadgeColorMap = {};
    Object.entries(value as Record<string, unknown>).forEach(([rawKey, rawColor]) => {
        const key = rawKey.trim();
        if (!key) return;
        const normalizedColor = normalizeHexColor(rawColor);
        if (!normalizedColor) return;
        next[key] = normalizedColor;
    });
    return next;
}

function toEditableOperationalCosts(items: OperationalCost[]): EditableOperationalCost[] {
    return items.map((item) => ({
        id: item.id,
        label: item.label,
        amount: item.amount || "",
        created_at: item.created_at,
    }));
}

function normalizeEditableOperationalCosts(items: EditableOperationalCost[]): OperationalCost[] {
    return items
        .map((item) => ({
            id: item.id || crypto.randomUUID(),
            label: item.label.trim(),
            amount: Math.max(
                Number(typeof item.amount === "number" ? item.amount : parseFloat(String(item.amount || 0))) || 0,
                0,
            ),
            created_at: item.created_at || new Date().toISOString(),
        }))
        .filter((item) => item.label.length > 0 && item.amount > 0);
}

function normalizeTeamBadgeColors(value: unknown): TeamBadgeColors {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { ...DEFAULT_TEAM_BADGE_COLORS };
    }
    const typed = value as { roles?: unknown; tags?: unknown };
    return {
        roles: normalizeColorRecord(typed.roles),
        tags: normalizeColorRecord(typed.tags),
    };
}

function buildBadgeStyle(colorMap: BadgeColorMap, key: string | null | undefined) {
    if (!key) return undefined;
    const color = normalizeHexColor(colorMap[key]);
    if (!color) return undefined;
    return {
        color,
        backgroundColor: withAlpha(color, 0.12),
        borderColor: withAlpha(color, 0.35),
    } as React.CSSProperties;
}

const WISUDA_SESSION_DURATION_EXTRA_FIELD_KEY =
    getWisudaSessionDurationExtraFieldKey();

export default function EditBookingPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const id = params.id as string;
    const router = useRouter();
    const locale = useLocale();
    const tBookingEditor = useTranslations("BookingEditor");
    const supabase = createClient();

    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [calendarWarning, setCalendarWarning] = React.useState<string | null>(null);
    const [services, setServices] = React.useState<Service[]>([]);
    const [cityOptions, setCityOptions] = React.useState<CityReferenceItem[]>([]);
    const [freelancers, setFreelancers] = React.useState<Freelance[]>([]);
    const [eventTypeOptions, setEventTypeOptions] = React.useState<string[]>(EVENT_TYPES);

    const [clientName, setClientName] = React.useState("");
    const [countryCode, setCountryCode] = React.useState("+62");
    const [phoneNumber, setPhoneNumber] = React.useState("");
    const [instagram, setInstagram] = React.useState("");
    const [eventType, setEventType] = React.useState("");
    const [selectedCityCode, setSelectedCityCode] = React.useState("");
    const [allowLegacyWisudaCityFallback, setAllowLegacyWisudaCityFallback] =
        React.useState(false);
    const [bookingDate, setBookingDate] = React.useState("");
    const [createdAtDateFallback, setCreatedAtDateFallback] = React.useState("");
    const [sessionDate, setSessionDate] = React.useState("");
    const [location, setLocation] = React.useState("");
    const [locationCoords, setLocationCoords] = React.useState<LocationCoords>({ lat: null, lng: null });
    const [locationDetail, setLocationDetail] = React.useState("");
    const [selectedServiceIds, setSelectedServiceIds] = React.useState<string[]>([]);
    const [selectedServiceQuantities, setSelectedServiceQuantities] = React.useState<BookingServiceQuantityMap>({});
    const [selectedAddonIds, setSelectedAddonIds] = React.useState<string[]>([]);
    const [selectedAddonQuantities, setSelectedAddonQuantities] = React.useState<BookingServiceQuantityMap>({});
    const [defaultServiceColor, setDefaultServiceColor] = React.useState("#000000");
    const [teamBadgeColors, setTeamBadgeColors] = React.useState<TeamBadgeColors>(DEFAULT_TEAM_BADGE_COLORS);
    const [packageDialogOpen, setPackageDialogOpen] = React.useState(false);
    const [addonDialogOpen, setAddonDialogOpen] = React.useState(false);
    const [packageViewMode, setPackageViewMode] = React.useState<"list" | "grid">("list");
    const [addonViewMode, setAddonViewMode] = React.useState<"list" | "grid">("list");
    const [packageSearchQuery, setPackageSearchQuery] = React.useState("");
    const [addonSearchQuery, setAddonSearchQuery] = React.useState("");
    const [freelancerDialogOpen, setFreelancerDialogOpen] = React.useState(false);
    const [freelancerViewMode, setFreelancerViewMode] = React.useState<"list" | "grid">("list");
    const [freelancerSearchQuery, setFreelancerSearchQuery] = React.useState("");
    const [activeFreelancerSessionKey, setActiveFreelancerSessionKey] = React.useState<string | null>(null);
    const [freelancerIds, setFreelancerIds] = React.useState<string[]>([]);
    const [freelancerAssignmentsBySession, setFreelancerAssignmentsBySession] =
        React.useState<SessionFreelancerAssignments>({});
    const [dpPaid, setDpPaid] = React.useState<number | "">("");
    const [accommodationFee, setAccommodationFee] = React.useState<number | "">("");
    const [discountAmount, setDiscountAmount] = React.useState<number | "">("");
    const [initialDpPaid, setInitialDpPaid] = React.useState(0);
    const [dpVerifiedAmount, setDpVerifiedAmount] = React.useState(0);
    const [dpVerifiedAt, setDpVerifiedAt] = React.useState<string | null>(null);
    const [dpRefundAmount, setDpRefundAmount] = React.useState(0);
    const [dpRefundedAt, setDpRefundedAt] = React.useState<string | null>(null);
    const [settlementStatusValue, setSettlementStatusValue] = React.useState("draft");
    const [isFullyPaid, setIsFullyPaid] = React.useState(false);
    const [finalAdjustmentsRaw, setFinalAdjustmentsRaw] = React.useState<unknown>(null);
    const [operationalCostItems, setOperationalCostItems] = React.useState<EditableOperationalCost[]>([]);
    const [operationalCostTemplates, setOperationalCostTemplates] = React.useState<OperationalCostTemplate[]>([]);
    const [operationalCostTemplateDialogOpen, setOperationalCostTemplateDialogOpen] = React.useState(false);
    const [operationalCostTemplateSearchQuery, setOperationalCostTemplateSearchQuery] = React.useState("");
    const [isCurrentUserAdmin, setIsCurrentUserAdmin] = React.useState(false);
    const [bankAccounts, setBankAccounts] = React.useState<BankAccount[]>([]);
    const [highlightOperationalCosts, setHighlightOperationalCosts] = React.useState(false);
    const [finalPaymentAmount, setFinalPaymentAmount] = React.useState(0);
    const [finalPaidAt, setFinalPaidAt] = React.useState<string | null>(null);
    const [paymentSourceValue, setPaymentSourceValue] = React.useState("");
    const [finalPaymentSourceValue, setFinalPaymentSourceValue] = React.useState("");
    const [baseExtraFieldsObject, setBaseExtraFieldsObject] = React.useState<Record<string, unknown> | null>(null);
    const [markingDpVerified, setMarkingDpVerified] = React.useState(false);
    const [markingDpUnverified, setMarkingDpUnverified] = React.useState(false);
    const [statusOptions, setStatusOptions] = React.useState<string[]>(
        getBookingStatusOptions(DEFAULT_CLIENT_STATUSES),
    );
    const [status, setStatus] = React.useState(
        getInitialBookingStatus(DEFAULT_CLIENT_STATUSES),
    );
    const [initialStatus, setInitialStatus] = React.useState(
        getInitialBookingStatus(DEFAULT_CLIENT_STATUSES),
    );
    const [dpVerifyTriggerStatus, setDpVerifyTriggerStatus] = React.useState("");
    const [notes, setNotes] = React.useState("");
    const [adminNotes, setAdminNotes] = React.useState("");
    const [driveFolderUrl, setDriveFolderUrl] = React.useState("");
    const [videoDriveFolderUrl, setVideoDriveFolderUrl] = React.useState("");
    const [portfolioUrl, setPortfolioUrl] = React.useState("");
    const [cacheInvalidationBooking, setCacheInvalidationBooking] = React.useState<{
        bookingCode: string | null;
        trackingUuid: string | null;
    }>({
        bookingCode: null,
        trackingUuid: null,
    });
    const [extraFields, setExtraFields] = React.useState<Record<string, string>>({});
    const [extraLocationCoords, setExtraLocationCoords] = React.useState<Record<string, LocationCoords>>({});
    const [customFieldValues, setCustomFieldValues] = React.useState<Record<string, string>>({});
    const [formSectionsByEventType, setFormSectionsByEventType] = React.useState<ModeAwareFormSectionsByEventType>({});
    const [splitDates, setSplitDates] = React.useState(false);
    const [akadDate, setAkadDate] = React.useState("");
    const [resepsiDate, setResepsiDate] = React.useState("");
    const [wisudaSession1Date, setWisudaSession1Date] = React.useState("");
    const [wisudaSession2Date, setWisudaSession2Date] = React.useState("");
    const [isWisudaDurationOverrideEnabled, setIsWisudaDurationOverrideEnabled] = React.useState(false);
    const [wisudaSession1DurationInput, setWisudaSession1DurationInput] = React.useState("");
    const [wisudaSession2DurationInput, setWisudaSession2DurationInput] = React.useState("");

    const [showCustomServicePopup, setShowCustomServicePopup] = React.useState(false);
    const [customServiceName, setCustomServiceName] = React.useState("");
    const [customServicePrice, setCustomServicePrice] = React.useState<number | "">("");
    const [customServiceDesc, setCustomServiceDesc] = React.useState("");
    const [savingCustomService, setSavingCustomService] = React.useState(false);

    const [showCustomFreelancerPopup, setShowCustomFreelancerPopup] = React.useState(false);
    const [customFreelancerName, setCustomFreelancerName] = React.useState("");
    const [customFreelancerWa, setCustomFreelancerWa] = React.useState("");
    const [customFreelancerRole, setCustomFreelancerRole] = React.useState("Photographer");
    const [savingCustomFreelancer, setSavingCustomFreelancer] = React.useState(false);
    const [customFreelancerCountryCode, setCustomFreelancerCountryCode] = React.useState("+62");
    const [feedbackDialog, setFeedbackDialog] = React.useState<{
        open: boolean;
        title: string;
        message: string;
    }>({ open: false, title: "", message: "" });
    const [cancelStatusConfirmOpen, setCancelStatusConfirmOpen] = React.useState(false);
    const { canWriteBookings } = useBookingWriteAccess();
    const operationalCostsSectionRef = React.useRef<HTMLDivElement | null>(null);
    const focusOperationalCostsHandledRef = React.useRef(false);
    const packageDefaultCostsHydratedRef = React.useRef(false);
    const packageDefaultCostsSignatureRef = React.useRef("");
    const focusTarget = searchParams.get("focus");
    const safeReturnTo = normalizeSafeEditorReturnTo(searchParams.get("returnTo"));
    const detailHref = `/bookings/${id}`;
    const cancelHref = safeReturnTo || detailHref;
    const saveRedirectHref = safeReturnTo || `${detailHref}?saved=edit`;

    const showFeedback = React.useCallback((message: string, title?: string) => {
        setFeedbackDialog({
            open: true,
            title: title || tBookingEditor("feedbackTitle"),
            message,
        });
    }, [tBookingEditor]);
    const requireBookingWrite = useBookingWriteGuard(({ message, title }) => {
        showFeedback(message, title);
    });

    const triggerFastpikAutoSync = React.useCallback(
        async (bookingId: string) => {
            if (!bookingId) return;
            try {
                await fetch("/api/integrations/fastpik/sync-booking", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        bookingId,
                        locale,
                        mode: "auto",
                    }),
                    keepalive: true,
                });
            } catch {
                // Silent by design: booking update should not fail due to integration sync.
            }
        },
        [locale],
    );

    const invalidateBookingPublicCache = React.useCallback(
        async (options?: { bookingCode?: string | null; trackingUuid?: string | null }) => {
            const bookingCode =
                options?.bookingCode?.trim() ||
                cacheInvalidationBooking.bookingCode?.trim() ||
                null;
            const trackingUuid =
                options?.trackingUuid?.trim() ||
                cacheInvalidationBooking.trackingUuid?.trim() ||
                null;
            if (!bookingCode && !trackingUuid) return;
            try {
                await fetch("/api/internal/cache/invalidate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        scope: "booking",
                        bookingCode,
                        trackingUuid,
                    }),
                });
            } catch {
                // Best effort cache invalidation.
            }
        },
        [cacheInvalidationBooking.bookingCode, cacheInvalidationBooking.trackingUuid],
    );

    const paymentSourceOptions = React.useMemo(() => {
        const validBanks = getValidBankAccounts(bankAccounts);
        return [
            { value: "cash", label: getPaymentMethodLabel("cash") },
            { value: "qris", label: getPaymentMethodLabel("qris") },
            ...validBanks.map((bank) => ({
                value: `bank:${bank.id}`,
                label: `${bank.bank_name}${bank.account_number ? ` - ${bank.account_number}` : ""}`,
            })),
        ];
    }, [bankAccounts]);

    React.useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            let { data: prof, error: profileError } = await supabase
                .from("profiles")
                .select("role, custom_client_statuses, dp_verify_trigger_status, form_sections, form_event_types, custom_event_types, form_brand_color, team_badge_colors, operational_cost_templates, bank_accounts")
                .eq("id", user.id)
                .single();
            if (
                profileError &&
                (profileError.message || "").includes("operational_cost_templates")
            ) {
                const fallbackProfile = await supabase
                    .from("profiles")
                    .select("role, custom_client_statuses, dp_verify_trigger_status, form_sections, form_event_types, custom_event_types, form_brand_color, team_badge_colors, bank_accounts")
                    .eq("id", user.id)
                    .single();
                prof = fallbackProfile.data;
                profileError = fallbackProfile.error;
            }
            if (profileError) {
                console.warn("Failed to load booking editor profile:", profileError.message);
            }
            const profileRow = (prof ?? null) as ProfileRow | null;
            const userIsAdmin = (profileRow?.role || "").trim().toLowerCase() === "admin";
            setIsCurrentUserAdmin(userIsAdmin);
            setBankAccounts(userIsAdmin ? normalizeBankAccounts(profileRow?.bank_accounts) : []);
            setOperationalCostTemplates(
                userIsAdmin
                    ? normalizeOperationalCostTemplates(profileRow?.operational_cost_templates)
                    : [],
            );

            const [{ data: booking }, { data: svcs }, { data: frees }, { data: bfRows }, { data: bsRows }, { data: cityRefs }] = await Promise.all([
                supabase
                    .from("bookings")
                    .select(userIsAdmin ? "*" : BOOKING_EDIT_NON_ADMIN_SELECT)
                    .eq("id", id)
                    .single(),
                supabase.from("services").select("id, name, price, original_price, description, color, duration_minutes, affects_schedule, is_addon, is_public, sort_order, event_types, default_operational_costs").eq("user_id", user.id).eq("is_active", true),
                supabase.from("freelance").select("id, name, google_email, role, tags, pricelist").eq("user_id", user.id).eq("status", "active"),
                supabase.from("booking_freelance").select("freelance_id").eq("booking_id", id),
                supabase.from("booking_services").select("service_id, kind, sort_order, quantity").eq("booking_id", id).order("sort_order", { ascending: true }),
                supabase
                    .from("region_city_references")
                    .select("city_code, city_name, province_code, province_name")
                    .order("province_code", { ascending: true })
                    .order("city_name", { ascending: true }),
            ]);
            const serviceRows = (svcs || []) as Service[];
            const serviceIds = serviceRows
                .map((service) => service.id)
                .filter((serviceId): serviceId is string => Boolean(serviceId));
            let serviceScopeRows: Array<{ service_id: string; city_code: string }> = [];
            if (serviceIds.length > 0) {
                const { data: scopeData } = await supabase
                    .from("service_city_scopes")
                    .select("service_id, city_code")
                    .eq("user_id", user.id)
                    .in("service_id", serviceIds);
                serviceScopeRows = (scopeData || []) as Array<{ service_id: string; city_code: string }>;
            }
            const serviceCityCodesMap = new Map<string, string[]>();
            serviceScopeRows.forEach((row) => {
                const cityCode = normalizeCityCode(row.city_code);
                if (!row.service_id || !cityCode) return;
                const current = serviceCityCodesMap.get(row.service_id) || [];
                if (!current.includes(cityCode)) {
                    current.push(cityCode);
                }
                serviceCityCodesMap.set(row.service_id, current);
            });
            setDefaultServiceColor(
                resolveHexColor(profileRow?.form_brand_color, "#000000"),
            );
            setTeamBadgeColors(
                normalizeTeamBadgeColors(profileRow?.team_badge_colors),
            );
            const nextStatusOptions = getBookingStatusOptions(profileRow?.custom_client_statuses as string[] | null | undefined);
            setStatusOptions(nextStatusOptions);
            setDpVerifyTriggerStatus(profileRow?.dp_verify_trigger_status ?? "");
            setEventTypeOptions(getActiveEventTypes({
                customEventTypes: normalizeEventTypeList(profileRow?.custom_event_types),
                activeEventTypes: profileRow?.form_event_types,
            }));
            setFormSectionsByEventType(
                normalizeModeAwareFormSectionsByEventType(
                    (prof as Record<string, unknown> | null)?.form_sections,
                ),
            );
            if (booking) {
                setCacheInvalidationBooking({
                    bookingCode:
                        typeof booking.booking_code === "string"
                            ? booking.booking_code
                            : null,
                    trackingUuid:
                        typeof booking.tracking_uuid === "string"
                            ? booking.tracking_uuid
                            : null,
                });
                setClientName(booking.client_name || "");
                const parsed = parseExistingPhone(booking.client_whatsapp);
                setCountryCode(parsed.code);
                setPhoneNumber(parsed.number);
                setInstagram(booking.instagram || "");
                const normalizedBookingEventType =
                    normalizeEventTypeName(booking.event_type) || "";
                const normalizedBookingCityCode = normalizeCityCode(
                    (booking as Record<string, unknown>).city_code,
                );
                setEventType(normalizedBookingEventType);
                setSelectedCityCode(normalizedBookingCityCode);
                setAllowLegacyWisudaCityFallback(
                    normalizedBookingEventType === "Wisuda" &&
                        !normalizedBookingCityCode,
                );
                const createdAtDate =
                    typeof (booking as Record<string, unknown>).created_at === "string" &&
                    String((booking as Record<string, unknown>).created_at).trim().length > 0
                        ? String((booking as Record<string, unknown>).created_at).slice(0, 10)
                        : "";
                setCreatedAtDateFallback(createdAtDate);
                setBookingDate(
                    typeof (booking as Record<string, unknown>).booking_date === "string" &&
                    String((booking as Record<string, unknown>).booking_date).trim().length > 0
                        ? String((booking as Record<string, unknown>).booking_date).slice(0, 10)
                        : createdAtDate,
                );
                setSessionDate(booking.session_date ? booking.session_date.slice(0, 16) : "");
                setLocation(booking.location || "");
                setLocationCoords({
                    lat: typeof booking.location_lat === "number" ? booking.location_lat : null,
                    lng: typeof booking.location_lng === "number" ? booking.location_lng : null,
                });
                setLocationDetail(booking.location_detail || "");
                const bookingServices = (bsRows || []) as Array<{ service_id: string; kind: string; quantity?: number | null }>;
                const selectedMainIds = bookingServices.filter((row) => row.kind === "main").map((row) => row.service_id);
                const selectedAddons = bookingServices.filter((row) => row.kind === "addon").map((row) => row.service_id);
                const resolvedMainIds = selectedMainIds.length > 0 ? selectedMainIds : booking.service_id ? [booking.service_id] : [];
                const resolvedMainQuantities = normalizeBookingServiceQuantityMap(
                    Object.fromEntries(
                        bookingServices
                            .filter((row) => row.kind === "main")
                            .map((row) => [row.service_id, row.quantity ?? 1]),
                    ),
                    {
                        selectedIds: resolvedMainIds,
                    },
                );
                setSelectedServiceIds(resolvedMainIds);
                setSelectedServiceQuantities(resolvedMainQuantities);
                let resolvedAddonIds = selectedAddons;
                let resolvedAddonQuantities: BookingServiceQuantityMap = {};
                if (selectedAddons.length > 0) {
                    resolvedAddonQuantities = normalizeBookingServiceQuantityMap(
                        Object.fromEntries(
                            bookingServices
                                .filter((row) => row.kind === "addon")
                                .map((row) => [row.service_id, row.quantity ?? 1]),
                        ),
                        { selectedIds: selectedAddons },
                    );
                } else {
                    const legacyAddonIds = Array.isArray(booking.extra_fields?.addon_ids)
                        ? booking.extra_fields.addon_ids.filter((id: unknown): id is string => typeof id === "string")
                        : [];
                    resolvedAddonIds = legacyAddonIds;
                    resolvedAddonQuantities = normalizeBookingServiceQuantityMap(
                        Object.fromEntries(
                            legacyAddonIds.map((addonId: string) => [addonId, 1]),
                        ),
                        { selectedIds: legacyAddonIds },
                    );
                }
                setSelectedAddonIds(resolvedAddonIds);
                setSelectedAddonQuantities(resolvedAddonQuantities);
                packageDefaultCostsSignatureRef.current = buildPackageDefaultCostSignature(
                    resolvedMainIds,
                    resolvedMainQuantities,
                    resolvedAddonIds,
                    resolvedAddonQuantities,
                );
                packageDefaultCostsHydratedRef.current = true;
                // Load multi-freelancer from junction table, fallback to old column
                const junctionIds = ((bfRows || []) as Array<{ freelance_id: string | null }>)
                    .map((row) => row.freelance_id)
                    .filter((freelanceId): freelanceId is string => Boolean(freelanceId));
                const fallbackFreelancerIds = junctionIds.length > 0
                    ? junctionIds
                    : booking.freelance_id
                        ? [booking.freelance_id]
                        : [];
                setFreelancerIds(fallbackFreelancerIds);
                const existingSpecialOffer = resolveSpecialOfferSnapshotFromExtraFields(booking.extra_fields);
                const normalizedDpPaid = Number(booking.dp_paid) || 0;
                setDpPaid(existingSpecialOffer?.dp_disabled ? normalizedDpPaid : booking.dp_paid || "");
                setAccommodationFee(existingSpecialOffer?.accommodation_fee ?? "");
                setDiscountAmount(existingSpecialOffer?.discount_amount ?? "");
                setInitialDpPaid(normalizedDpPaid);
                setDpVerifiedAmount(Number((booking as Record<string, unknown>).dp_verified_amount) || 0);
                setDpVerifiedAt(((booking as Record<string, unknown>).dp_verified_at as string | null) || null);
                setPaymentSourceValue(
                    getPaymentSourceOptionValue(
                        (booking as Record<string, unknown>).payment_source as PaymentSource | null,
                    ),
                );
                setDpRefundAmount(Number((booking as Record<string, unknown>).dp_refund_amount) || 0);
                setDpRefundedAt(((booking as Record<string, unknown>).dp_refunded_at as string | null) || null);
                setSettlementStatusValue(
                    typeof (booking as Record<string, unknown>).settlement_status === "string" &&
                    String((booking as Record<string, unknown>).settlement_status).trim().length > 0
                        ? String((booking as Record<string, unknown>).settlement_status)
                        : "draft",
                );
                setIsFullyPaid(Boolean((booking as Record<string, unknown>).is_fully_paid));
                setFinalAdjustmentsRaw((booking as Record<string, unknown>).final_adjustments ?? null);
                setOperationalCostItems(
                    userIsAdmin
                        ? toEditableOperationalCosts(
                            normalizeOperationalCosts((booking as Record<string, unknown>).operational_costs ?? null),
                        )
                        : [],
                );
                setFinalPaymentAmount(Number((booking as Record<string, unknown>).final_payment_amount) || 0);
                setFinalPaidAt(((booking as Record<string, unknown>).final_paid_at as string | null) || null);
                setFinalPaymentSourceValue(
                    getPaymentSourceOptionValue(
                        (booking as Record<string, unknown>).final_payment_source as PaymentSource | null,
                    ),
                );
                const unifiedStatus = resolveUnifiedBookingStatus({
                    status: booking.status,
                    clientStatus: booking.client_status,
                    statuses: nextStatusOptions,
                });
                setStatus(unifiedStatus);
                setInitialStatus(unifiedStatus);
                setNotes(booking.notes || "");
                setAdminNotes(
                    typeof (booking as Record<string, unknown>).admin_notes === "string"
                        ? String((booking as Record<string, unknown>).admin_notes)
                        : "",
                );
                setDriveFolderUrl(booking.drive_folder_url || "");
                setVideoDriveFolderUrl(
                    typeof (booking as Record<string, unknown>).video_drive_folder_url === "string"
                        ? String((booking as Record<string, unknown>).video_drive_folder_url)
                        : "",
                );
                setPortfolioUrl(booking.portfolio_url || "");
                const nextExtraFields = (booking.extra_fields ? Object.fromEntries(
                    Object.entries(booking.extra_fields).filter(([key, value]) => key !== "custom_fields" && typeof value === "string")
                ) : {}) as Record<string, string>;
                setBaseExtraFieldsObject(
                    booking.extra_fields && typeof booking.extra_fields === "object" && !Array.isArray(booking.extra_fields)
                        ? { ...(booking.extra_fields as Record<string, unknown>) }
                        : null,
                );
                setExtraFields(nextExtraFields);
                const seededExtraCoords: Record<string, LocationCoords> = {};
                if (
                    booking.location &&
                    typeof booking.location_lat === "number" &&
                    typeof booking.location_lng === "number"
                ) {
                    if (nextExtraFields.tempat_akad === booking.location) {
                        seededExtraCoords.tempat_akad = {
                            lat: booking.location_lat,
                            lng: booking.location_lng,
                        };
                    }
                    if (nextExtraFields.tempat_resepsi === booking.location) {
                        seededExtraCoords.tempat_resepsi = {
                            lat: booking.location_lat,
                            lng: booking.location_lng,
                        };
                    }
                    if (nextExtraFields.tempat_wisuda_1 === booking.location) {
                        seededExtraCoords.tempat_wisuda_1 = {
                            lat: booking.location_lat,
                            lng: booking.location_lng,
                        };
                    }
                    if (nextExtraFields.tempat_wisuda_2 === booking.location) {
                        seededExtraCoords.tempat_wisuda_2 = {
                            lat: booking.location_lat,
                            lng: booking.location_lng,
                        };
                    }
                }
                setExtraLocationCoords(seededExtraCoords);
                setCustomFieldValues(extractCustomFieldValueMap(booking.extra_fields));
                const extraFieldAssignments = readSessionFreelancerAssignmentsFromExtraFields(
                    booking.extra_fields,
                    {
                        validFreelancerIds: new Set(
                            ((frees || []) as Freelance[])
                                .map((freelancer) => freelancer.id)
                                .filter((freelancerId): freelancerId is string => Boolean(freelancerId)),
                        ),
                        maxItems: MAX_FREELANCERS_PER_SESSION,
                        preserveEmpty: true,
                    },
                );
                // Pre-populate splitDates from extra_fields
                if (booking.event_type === "Wedding" && booking.extra_fields?.tanggal_akad) {
                    setSplitDates(true);
                    setAkadDate(booking.extra_fields.tanggal_akad || "");
                    setResepsiDate(booking.extra_fields.tanggal_resepsi || "");
                    setFreelancerAssignmentsBySession(
                        ensureAssignmentsForSessionKeys({
                            assignments: extraFieldAssignments,
                            sessionKeys: ["akad", "resepsi"],
                            fallbackFreelancerIds,
                            maxPerSession: MAX_FREELANCERS_PER_SESSION,
                        }),
                    );
                    setIsWisudaDurationOverrideEnabled(false);
                    setWisudaSession1DurationInput("");
                    setWisudaSession2DurationInput("");
                } else if (booking.event_type === "Wisuda" && booking.extra_fields?.tanggal_wisuda_1) {
                    setSplitDates(true);
                    setWisudaSession1Date(booking.extra_fields.tanggal_wisuda_1 || "");
                    setWisudaSession2Date(booking.extra_fields.tanggal_wisuda_2 || "");
                    setFreelancerAssignmentsBySession(
                        ensureAssignmentsForSessionKeys({
                            assignments: extraFieldAssignments,
                            sessionKeys: ["wisuda_session_1", "wisuda_session_2"],
                            fallbackFreelancerIds,
                            maxPerSession: MAX_FREELANCERS_PER_SESSION,
                        }),
                    );
                    const wisudaDurationOverride = parseWisudaSessionDurationOverride(
                        booking.extra_fields,
                    );
                    if (wisudaDurationOverride) {
                        setIsWisudaDurationOverrideEnabled(true);
                        setWisudaSession1DurationInput(
                            String(wisudaDurationOverride.wisuda_session_1),
                        );
                        setWisudaSession2DurationInput(
                            String(wisudaDurationOverride.wisuda_session_2),
                        );
                    } else {
                        setIsWisudaDurationOverrideEnabled(false);
                        setWisudaSession1DurationInput("");
                        setWisudaSession2DurationInput("");
                    }
                } else {
                    setSplitDates(false);
                    setFreelancerAssignmentsBySession({});
                    setAkadDate("");
                    setResepsiDate("");
                    setWisudaSession1Date("");
                    setWisudaSession2Date("");
                    setIsWisudaDurationOverrideEnabled(false);
                    setWisudaSession1DurationInput("");
                    setWisudaSession2DurationInput("");
                }
            }
            setServices(
                serviceRows
                    .map((service) => ({
                        ...service,
                        city_codes: serviceCityCodesMap.get(service.id) || [],
                    }))
                    .sort(compareServicesByCatalogOrder),
            );
            setCityOptions(
                ((cityRefs || []) as CityReferenceItem[])
                    .map((city) => ({
                        city_code: normalizeCityCode(city.city_code),
                        city_name: city.city_name,
                        province_code: city.province_code,
                        province_name: city.province_name,
                    }))
                    .filter((city) => city.city_code),
            );
            const normalizedFreelancers = ((frees || []) as Array<Record<string, unknown>>).map((freelancer) => ({
                id: String(freelancer.id || ""),
                name: String(freelancer.name || ""),
                google_email: typeof freelancer.google_email === "string" ? freelancer.google_email : null,
                role: typeof freelancer.role === "string" ? freelancer.role : null,
                tags: normalizeFreelancerTags(freelancer.tags),
                pricelist: freelancer.pricelist ?? null,
            })).filter((freelancer) => freelancer.id && freelancer.name);
            setFreelancers(normalizedFreelancers);
            setLoading(false);
        }
        load();
    }, [id, supabase]);

    React.useEffect(() => {
        if (eventTypeOptions.length === 0) {
            setEventType("");
            return;
        }
        setEventType((current) =>
            current && eventTypeOptions.includes(current)
                ? current
                : eventTypeOptions[0],
        );
    }, [eventTypeOptions]);

    React.useEffect(() => {
        if (loading || !isCurrentUserAdmin) return;
        if (focusTarget !== "operational-costs") return;
        if (focusOperationalCostsHandledRef.current) return;

        focusOperationalCostsHandledRef.current = true;
        setHighlightOperationalCosts(true);

        const scrollTimer = window.setTimeout(() => {
            operationalCostsSectionRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }, 120);
        const highlightTimer = window.setTimeout(() => {
            setHighlightOperationalCosts(false);
        }, 2200);

        return () => {
            window.clearTimeout(scrollTimer);
            window.clearTimeout(highlightTimer);
        };
    }, [focusTarget, isCurrentUserAdmin, loading]);

    const sortedServices = React.useMemo(
        () => [...services].sort(compareServicesByCatalogOrder),
        [services],
    );
    const validFreelancerIds = React.useMemo(
        () =>
            new Set(
                freelancers
                    .map((freelancer) => freelancer.id)
                    .filter((freelancerId): freelancerId is string => Boolean(freelancerId)),
            ),
        [freelancers],
    );
    const splitFreelancerSessionKeys = React.useMemo(
        () =>
            resolveSplitFreelancerSessionKeys({
                eventType,
                splitDates,
            }),
        [eventType, splitDates],
    );
    const isSplitFreelancerMode = splitFreelancerSessionKeys.length > 0;
    const normalizedSelectedCityCode = normalizeCityCode(selectedCityCode);
    const isCityScopedEvent = React.useMemo(
        () => isCityScopedBookingEventType(eventType),
        [eventType],
    );
    const shouldAllowLegacyCityFallback = React.useMemo(
        () =>
            isCityScopedEvent &&
            !normalizedSelectedCityCode &&
            allowLegacyWisudaCityFallback,
        [allowLegacyWisudaCityFallback, isCityScopedEvent, normalizedSelectedCityCode],
    );
    const selectedCity = React.useMemo(
        () =>
            cityOptions.find((city) => city.city_code === normalizedSelectedCityCode) ||
            null,
        [cityOptions, normalizedSelectedCityCode],
    );
    const mainServices = React.useMemo(
        () =>
            filterServicesForBookingSelection(sortedServices, {
                eventType,
                cityCode: normalizedSelectedCityCode,
                allowCityFallbackWhenMissing: shouldAllowLegacyCityFallback,
                group: "main",
            }),
        [
            eventType,
            normalizedSelectedCityCode,
            shouldAllowLegacyCityFallback,
            sortedServices,
        ],
    );
    const addonServices = React.useMemo(
        () =>
            filterServicesForBookingSelection(sortedServices, {
                eventType,
                cityCode: normalizedSelectedCityCode,
                allowCityFallbackWhenMissing: shouldAllowLegacyCityFallback,
                group: "addon",
            }),
        [
            eventType,
            normalizedSelectedCityCode,
            shouldAllowLegacyCityFallback,
            sortedServices,
        ],
    );
    React.useEffect(() => {
        if (!isCityScopedEvent && selectedCityCode) {
            setSelectedCityCode("");
        }
    }, [isCityScopedEvent, selectedCityCode]);
    React.useEffect(() => {
        setFreelancerIds((prev) =>
            normalizeFreelancerIdList(prev, {
                validFreelancerIds,
            }),
        );
        setFreelancerAssignmentsBySession((prev) =>
            normalizeSessionFreelancerAssignments(prev, {
                validFreelancerIds,
                maxItems: MAX_FREELANCERS_PER_SESSION,
                preserveEmpty: true,
            }),
        );
    }, [validFreelancerIds]);
    React.useEffect(() => {
        if (!isSplitFreelancerMode) return;
        setFreelancerAssignmentsBySession((prev) => {
            const next = ensureAssignmentsForSessionKeys({
                assignments: prev,
                sessionKeys: splitFreelancerSessionKeys,
                fallbackFreelancerIds: freelancerIds,
                validFreelancerIds,
                maxPerSession: MAX_FREELANCERS_PER_SESSION,
            });
            return isSameSessionFreelancerAssignments(prev, next) ? prev : next;
        });
    }, [
        isSplitFreelancerMode,
        splitFreelancerSessionKeys,
        freelancerIds,
        validFreelancerIds,
    ]);
    React.useEffect(() => {
        if (!isSplitFreelancerMode && activeFreelancerSessionKey) {
            setActiveFreelancerSessionKey(null);
            return;
        }
        if (
            activeFreelancerSessionKey &&
            !splitFreelancerSessionKeys.includes(activeFreelancerSessionKey)
        ) {
            setActiveFreelancerSessionKey(null);
        }
    }, [
        activeFreelancerSessionKey,
        isSplitFreelancerMode,
        splitFreelancerSessionKeys,
    ]);
    const searchedMainServices = React.useMemo(() => {
        const query = packageSearchQuery.trim().toLowerCase();
        if (!query) return mainServices;
        return mainServices.filter((service) =>
            service.name.toLowerCase().includes(query) ||
            (service.description || "").toLowerCase().includes(query),
        );
    }, [mainServices, packageSearchQuery]);
    const searchedAddonServices = React.useMemo(() => {
        const query = addonSearchQuery.trim().toLowerCase();
        if (!query) return addonServices;
        return addonServices.filter((service) =>
            service.name.toLowerCase().includes(query) ||
            (service.description || "").toLowerCase().includes(query),
        );
    }, [addonServices, addonSearchQuery]);
    const searchedFreelancers = React.useMemo(() => {
        const query = freelancerSearchQuery.trim().toLowerCase();
        if (!query) return freelancers;
        return freelancers.filter((freelancer) =>
            freelancer.name.toLowerCase().includes(query) ||
            (freelancer.role || "").toLowerCase().includes(query) ||
            freelancer.tags.join(" ").toLowerCase().includes(query),
        );
    }, [freelancerSearchQuery, freelancers]);
    const freelancerNameById = React.useMemo(
        () =>
            new Map(
                freelancers.map((freelancer) => [freelancer.id, freelancer.name]),
            ),
        [freelancers],
    );
    const assignedFreelancerIdsForOperationalCosts = React.useMemo(
        () =>
            isSplitFreelancerMode
                ? buildSessionFreelancerUnion(
                    freelancerAssignmentsBySession,
                    splitFreelancerSessionKeys,
                )
                : normalizeFreelancerIdList(freelancerIds, {
                    validFreelancerIds,
                    maxItems: MAX_FREELANCERS_PER_SESSION,
                }),
        [
            freelancerAssignmentsBySession,
            freelancerIds,
            isSplitFreelancerMode,
            splitFreelancerSessionKeys,
            validFreelancerIds,
        ],
    );
    const assignedFreelancersForOperationalCosts = React.useMemo(
        () =>
            assignedFreelancerIdsForOperationalCosts
                .map((freelancerId) =>
                    freelancers.find((freelancer) => freelancer.id === freelancerId),
                )
                .filter((freelancer): freelancer is Freelance => Boolean(freelancer)),
        [assignedFreelancerIdsForOperationalCosts, freelancers],
    );
    const searchedOperationalCostTemplates = React.useMemo(() => {
        const query = operationalCostTemplateSearchQuery.trim().toLowerCase();
        if (!query) return operationalCostTemplates;
        return operationalCostTemplates.filter((template) =>
            template.name.toLowerCase().includes(query) ||
            template.items.some((item) => item.label.toLowerCase().includes(query)),
        );
    }, [operationalCostTemplateSearchQuery, operationalCostTemplates]);
    const specialOfferSnapshot = React.useMemo(
        () => resolveSpecialOfferSnapshotFromExtraFields(baseExtraFieldsObject),
        [baseExtraFieldsObject],
    );
    const isDpDisabledForThisBooking = specialOfferSnapshot?.dp_disabled === true;
    const assignedFreelancerOperationalCostOptions = React.useMemo(
        () =>
            assignedFreelancersForOperationalCosts.map((freelancer) => ({
                freelancer,
                items: normalizeOperationalCostPricelistItems(freelancer.pricelist),
            })),
        [assignedFreelancersForOperationalCosts],
    );
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
                selectedIds: selectedAddonIds,
            }),
        [selectedAddonIds, selectedAddonQuantities],
    );
    const selectedMainServices = React.useMemo(
        () => mainServices.filter((service) => selectedServiceIds.includes(service.id)),
        [mainServices, selectedServiceIds],
    );
    const selectedAddonServices = React.useMemo(
        () => addonServices.filter((service) => selectedAddonIds.includes(service.id)),
        [addonServices, selectedAddonIds],
    );
    React.useEffect(() => {
        if (!isCurrentUserAdmin || !packageDefaultCostsHydratedRef.current) return;

        const signature = buildPackageDefaultCostSignature(
            selectedServiceIds,
            selectedMainQuantities,
            selectedAddonIds,
            selectedAddonQuantityMap,
        );
        if (signature === packageDefaultCostsSignatureRef.current) return;
        packageDefaultCostsSignatureRef.current = signature;

        const nextCosts: OperationalCost[] = [
            ...selectedMainServices.flatMap((service) =>
                normalizeDefaultOperationalCosts(service.default_operational_costs).map((item) =>
                    buildOperationalCostFromDefaultItem(item, {
                        quantity: selectedMainQuantities[service.id] || 1,
                    }),
                ),
            ),
            ...selectedAddonServices.flatMap((service) =>
                normalizeDefaultOperationalCosts(service.default_operational_costs).map((item) =>
                    buildOperationalCostFromDefaultItem(item, {
                        quantity: selectedAddonQuantityMap[service.id] || 1,
                    }),
                ),
            ),
        ];
        if (nextCosts.length === 0) return;

        setOperationalCostItems((current) =>
            toEditableOperationalCosts(
                appendUniqueOperationalCosts(
                    normalizeEditableOperationalCosts(current),
                    nextCosts,
                ),
            ),
        );
    }, [
        isCurrentUserAdmin,
        selectedAddonIds,
        selectedAddonQuantityMap,
        selectedAddonServices,
        selectedMainQuantities,
        selectedMainServices,
        selectedServiceIds,
    ]);
    const selectedServiceSelections = React.useMemo<BookingServiceSelection[]>(
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
                    price: service.price,
                    original_price: service.original_price ?? null,
                    description: service.description ?? null,
                    duration_minutes: service.duration_minutes ?? null,
                    is_addon: service.is_addon ?? false,
                    affects_schedule: service.affects_schedule ?? null,
                    is_public: service.is_public ?? null,
                    event_types: service.event_types ?? null,
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
                    price: service.price,
                    original_price: service.original_price ?? null,
                    description: service.description ?? null,
                    duration_minutes: service.duration_minutes ?? null,
                    is_addon: service.is_addon ?? true,
                    affects_schedule: service.affects_schedule ?? null,
                    is_public: service.is_public ?? null,
                    event_types: service.event_types ?? null,
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
    const selectedScheduleDurationMinutes = React.useMemo(
        () => getBookingDurationMinutes(selectedServiceSelections),
        [selectedServiceSelections],
    );
    const wisudaDefaultSession1DurationMinutes = React.useMemo(
        () =>
            Math.floor(selectedScheduleDurationMinutes / 2) +
            (selectedScheduleDurationMinutes % 2),
        [selectedScheduleDurationMinutes],
    );
    const wisudaDefaultSession2DurationMinutes = React.useMemo(
        () =>
            Math.max(
                selectedScheduleDurationMinutes - wisudaDefaultSession1DurationMinutes,
                1,
            ),
        [selectedScheduleDurationMinutes, wisudaDefaultSession1DurationMinutes],
    );
    const toggleService = (serviceId: string) => {
        setSelectedServiceIds((prev) =>
            prev.includes(serviceId)
                ? prev.filter((item) => item !== serviceId)
                : [...prev, serviceId],
        );
        setSelectedServiceQuantities((prev) => {
            const next = { ...prev };
            if (serviceId in next) {
                delete next[serviceId];
            } else {
                next[serviceId] = 1;
            }
            return next;
        });
    };
    const toggleAddon = (serviceId: string) => {
        setSelectedAddonIds((prev) =>
            prev.includes(serviceId)
                ? prev.filter((item) => item !== serviceId)
                : [...prev, serviceId],
        );
        setSelectedAddonQuantities((prev) => {
            const next = { ...prev };
            if (serviceId in next) {
                delete next[serviceId];
            } else {
                next[serviceId] = 1;
            }
            return next;
        });
    };
    const changeServiceQuantity = React.useCallback((
        kind: "main" | "addon",
        serviceId: string,
        nextQuantity: number,
    ) => {
        const normalizedQuantity = normalizeBookingServiceQuantity(nextQuantity);
        if (kind === "main") {
            setSelectedServiceIds((prev) =>
                prev.includes(serviceId) ? prev : [...prev, serviceId],
            );
            setSelectedServiceQuantities((prev) => ({
                ...prev,
                [serviceId]: normalizedQuantity,
            }));
            return;
        }
        setSelectedAddonIds((prev) =>
            prev.includes(serviceId) ? prev : [...prev, serviceId],
        );
        setSelectedAddonQuantities((prev) => ({
            ...prev,
            [serviceId]: normalizedQuantity,
        }));
    }, []);
    const renderQuantityControl = React.useCallback((
        kind: "main" | "addon",
        serviceId: string,
        quantity: number,
    ) => {
        const normalizedQuantity = normalizeBookingServiceQuantity(quantity);
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
    }, [changeServiceQuantity]);
    React.useEffect(() => {
        const availableMainIds = new Set(mainServices.map((service) => service.id));
        setSelectedServiceIds((prev) => {
            const next = prev.filter((id) => availableMainIds.has(id));
            if (
                next.length === prev.length &&
                next.every((serviceId, index) => serviceId === prev[index])
            ) {
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
    }, [mainServices]);
    React.useEffect(() => {
        const availableAddonIds = new Set(addonServices.map((service) => service.id));
        setSelectedAddonIds((prev) => {
            const next = prev.filter((id) => availableAddonIds.has(id));
            if (
                next.length === prev.length &&
                next.every((serviceId, index) => serviceId === prev[index])
            ) {
                return prev;
            }
            return next;
        });
        setSelectedAddonQuantities((prev) =>
            normalizeBookingServiceQuantityMap(prev, {
                selectedIds: selectedAddonIds,
                validIds: availableAddonIds,
            }),
        );
    }, [addonServices]);
    React.useEffect(() => {
        if (!statusOptions.includes(status)) {
            setStatus(getInitialBookingStatus(statusOptions));
        }
    }, [statusOptions, status]);
    const toggleFreelancer = (fid: string) => {
        setFreelancerIds(prev => {
            if (prev.includes(fid)) return prev.filter(f => f !== fid);
            if (prev.length >= 5) return prev;
            return [...prev, fid];
        });
    };
    const toggleSessionFreelancer = (sessionKey: string, freelancerId: string) => {
        setFreelancerAssignmentsBySession((prev) => {
            const next = normalizeSessionFreelancerAssignments(prev, {
                validFreelancerIds,
                maxItems: MAX_FREELANCERS_PER_SESSION,
                preserveEmpty: true,
            });
            const current = next[sessionKey] || [];
            if (current.includes(freelancerId)) {
                return {
                    ...next,
                    [sessionKey]: current.filter((item) => item !== freelancerId),
                };
            }
            if (current.length >= MAX_FREELANCERS_PER_SESSION) {
                return next;
            }
            return {
                ...next,
                [sessionKey]: [...current, freelancerId],
            };
        });
    };
    const collapseSplitFreelancersToGlobal = React.useCallback(() => {
        const normalizedAssignments = normalizeSessionFreelancerAssignments(
            freelancerAssignmentsBySession,
            {
                validFreelancerIds,
                maxItems: MAX_FREELANCERS_PER_SESSION,
                preserveEmpty: true,
            },
        );
        const unionFreelancerIds = buildSessionFreelancerUnion(
            normalizedAssignments,
            splitFreelancerSessionKeys,
        );
        if (unionFreelancerIds.length > 0) {
            setFreelancerIds(unionFreelancerIds);
        }
    }, [
        freelancerAssignmentsBySession,
        splitFreelancerSessionKeys,
        validFreelancerIds,
    ]);
    const openFreelancerDialog = React.useCallback((sessionKey?: string) => {
        setActiveFreelancerSessionKey(sessionKey || null);
        setFreelancerSearchQuery("");
        setFreelancerDialogOpen(true);
    }, []);
    const selectedFreelancerIdsForDialog = activeFreelancerSessionKey
        ? freelancerAssignmentsBySession[activeFreelancerSessionKey] || []
        : freelancerIds;
    const freelancerDialogMaxSelection = activeFreelancerSessionKey
        ? MAX_FREELANCERS_PER_SESSION
        : 5;
    const activeFreelancerSessionLabel = activeFreelancerSessionKey
        ? SESSION_FREELANCER_LABELS[activeFreelancerSessionKey] ||
          activeFreelancerSessionKey
        : null;
    const toggleFreelancerFromDialog = (freelancerId: string) => {
        if (activeFreelancerSessionKey) {
            toggleSessionFreelancer(activeFreelancerSessionKey, freelancerId);
            return;
        }
        toggleFreelancer(freelancerId);
    };

    const normalizedEventType = React.useMemo(
        () => normalizeEventTypeName(eventType) || eventType,
        [eventType],
    );
    const activeLayoutMode =
        splitDates && (eventType === "Wedding" || eventType === "Wisuda")
            ? "split"
            : "normal";

    const activeFormLayout = React.useMemo(
        () =>
            resolveNormalizedActiveFormLayout(
                formSectionsByEventType,
                normalizedEventType,
                { layoutMode: activeLayoutMode },
            ),
        [activeLayoutMode, formSectionsByEventType, normalizedEventType],
    );

    const currentExtraFields = React.useMemo(
        () => getLayoutExtraFields(activeFormLayout),
        [activeFormLayout],
    );
    const sessionLocationExtraFields = React.useMemo(() => {
        if (eventType === "Wedding" && splitDates) {
            return currentExtraFields.filter(
                (field) =>
                    field.key === "tempat_akad" || field.key === "tempat_resepsi",
            );
        }
        if (eventType === "Wisuda" && splitDates) {
            return currentExtraFields.filter(
                (field) =>
                    field.key === "tempat_wisuda_1" ||
                    field.key === "tempat_wisuda_2",
            );
        }
        return [];
    }, [currentExtraFields, eventType, splitDates]);
    const hasUniversityExtraField = currentExtraFields.some(
        (field) => field.key === UNIVERSITY_EXTRA_FIELD_KEY,
    );

    const activeCustomLayoutSections = React.useMemo(() => {
        return getGroupedCustomLayoutSections(
            activeFormLayout,
            normalizedEventType || "Umum",
            { layoutMode: activeLayoutMode },
        );
    }, [activeFormLayout, activeLayoutMode, normalizedEventType]);

    React.useEffect(() => {
        if (eventType === "Wisuda" && splitDates) {
            return;
        }
        setIsWisudaDurationOverrideEnabled(false);
        setWisudaSession1DurationInput("");
        setWisudaSession2DurationInput("");
    }, [eventType, splitDates]);

    const clientCustomItems = activeCustomLayoutSections.find(section => section.sectionId === "client_info")?.items || [];
    const sessionCustomItems = activeCustomLayoutSections.find(section => section.sectionId === "session_details")?.items || [];
    const paymentCustomItems = activeCustomLayoutSections.find(section => section.sectionId === "payment_details")?.items || [];

    async function saveCustomService() {
        if (!requireBookingWrite()) return;
        if (!customServiceName.trim()) return;
        setSavingCustomService(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase.from("services").insert({
            user_id: user.id, name: customServiceName.trim(),
            description: customServiceDesc.trim() || null,
            price: parseFloat(customServicePrice.toString()) || 0,
            is_active: true,
            is_addon: false,
            is_public: true,
            color: resolveHexColor(defaultServiceColor, "#000000"),
            sort_order: services.filter((service) => !service.is_addon).length,
        }).select("id, name, price, original_price, description, color, duration_minutes, affects_schedule, is_addon, is_public, sort_order, event_types, default_operational_costs").single();
        if (!error && data) {
            const s = data as Service;
            setServices(prev => [...prev, s].sort(compareServicesByCatalogOrder));
            setSelectedServiceIds(prev => (prev.includes(s.id) ? prev : [...prev, s.id]));
            setSelectedServiceQuantities((prev) => ({ ...prev, [s.id]: 1 }));
            setCustomServiceName(""); setCustomServicePrice(""); setCustomServiceDesc("");
            setShowCustomServicePopup(false);
        } else { showFeedback(tBookingEditor("failedSavePackage")); }
        setSavingCustomService(false);
    }

    async function saveCustomFreelancer() {
        if (!requireBookingWrite()) return;
        if (!customFreelancerName.trim()) return;
        setSavingCustomFreelancer(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase.from("freelance").insert({
            user_id: user.id, name: customFreelancerName.trim(),
            role: customFreelancerRole || "Photographer",
            whatsapp_number: customFreelancerWa ? `${customFreelancerCountryCode}${customFreelancerWa}`.replace(/[^0-9+]/g, "") : null, status: "active",
        }).select("id, name, role, tags").single();
        if (!error && data) {
            const row = data as Record<string, unknown>;
            const f: Freelance = {
                id: String(row.id || ""),
                name: String(row.name || ""),
                role: typeof row.role === "string" ? row.role : null,
                tags: normalizeFreelancerTags(row.tags),
            };
            setFreelancers(prev => [...prev, f]);
            if (isSplitFreelancerMode) {
                setFreelancerAssignmentsBySession((prev) => {
                    const next = ensureAssignmentsForSessionKeys({
                        assignments: prev,
                        sessionKeys: splitFreelancerSessionKeys,
                        fallbackFreelancerIds: freelancerIds,
                        validFreelancerIds,
                        maxPerSession: MAX_FREELANCERS_PER_SESSION,
                    });
                    for (const sessionKey of splitFreelancerSessionKeys) {
                        const current = next[sessionKey] || [];
                        if (
                            !current.includes(f.id) &&
                            current.length < MAX_FREELANCERS_PER_SESSION
                        ) {
                            next[sessionKey] = [...current, f.id];
                        }
                    }
                    return next;
                });
            } else {
                setFreelancerIds(prev => prev.length < 5 ? [...prev, f.id] : prev);
            }
            setCustomFreelancerName(""); setCustomFreelancerWa(""); setCustomFreelancerRole("Photographer"); setCustomFreelancerCountryCode("+62");
            setShowCustomFreelancerPopup(false);
        } else { console.error(error); showFeedback(tBookingEditor("failedSaveFreelancer")); }
        setSavingCustomFreelancer(false);
    }

    async function submitBookingUpdate(options?: {
        skipCancelConfirmation?: boolean;
        cancelPayment?: { policy: CancelPaymentPolicy; refundAmount: number };
    }) {
        if (!requireBookingWrite()) return;
        if (
            isTransitionToCancelled(initialStatus, status) &&
            !options?.skipCancelConfirmation
        ) {
            setCancelStatusConfirmOpen(true);
            return;
        }

        setSaving(true);
        try {
            const isWeddingEvent = eventType === "Wedding";
            const isWisudaEvent = eventType === "Wisuda";
            const isSplitSessionEnabled =
                splitDates && (isWeddingEvent || isWisudaEvent);
            const splitSessionFreelancerAssignments = isSplitSessionEnabled
                ? ensureAssignmentsForSessionKeys({
                    assignments: freelancerAssignmentsBySession,
                    sessionKeys: splitFreelancerSessionKeys,
                    fallbackFreelancerIds: freelancerIds,
                    validFreelancerIds,
                    maxPerSession: MAX_FREELANCERS_PER_SESSION,
                })
                : {};
            const freelancerIdsForSave = isSplitSessionEnabled
                ? buildSessionFreelancerUnion(
                    splitSessionFreelancerAssignments,
                    splitFreelancerSessionKeys,
                )
                : normalizeFreelancerIdList(freelancerIds, {
                    validFreelancerIds,
                });

            if (
                isWeddingEvent &&
                isSplitSessionEnabled &&
                (!extraFields.tempat_akad || !extraFields.tempat_resepsi)
            ) {
                showFeedback(tBookingEditor("errorWeddingLocationRequired"));
                return;
            }
            if (
                isWisudaEvent &&
                isSplitSessionEnabled &&
                (!extraFields.tempat_wisuda_1 || !extraFields.tempat_wisuda_2)
            ) {
                showFeedback("Lokasi Sesi 1 dan Lokasi Sesi 2 wajib diisi untuk Wisuda split.");
                return;
            }
            if (isCityScopedEvent && (!normalizedSelectedCityCode || !selectedCity)) {
                showFeedback("Pilih kota/kabupaten terlebih dahulu sebelum memilih paket.");
                return;
            }
            if (selectedServiceIds.length === 0) {
                showFeedback(tBookingEditor("errorSelectMainPackage"));
                return;
            }
            const wisudaDurationOverride = buildWisudaSessionDurationOverride({
                session1Minutes: wisudaSession1DurationInput,
                session2Minutes: wisudaSession2DurationInput,
            });
            if (
                isWisudaEvent &&
                isSplitSessionEnabled &&
                isWisudaDurationOverrideEnabled
            ) {
                if (!wisudaDurationOverride) {
                    showFeedback("Durasi Sesi 1 dan Sesi 2 harus diisi angka positif.");
                    return;
                }
                const overrideTotal =
                    wisudaDurationOverride.wisuda_session_1 +
                    wisudaDurationOverride.wisuda_session_2;
                if (overrideTotal !== selectedScheduleDurationMinutes) {
                    showFeedback(
                        `Total durasi split harus ${selectedScheduleDurationMinutes} menit (sesuai paket).`,
                    );
                    return;
                }
            }
            if (
                hasUniversityExtraField &&
                (!hasUniversityValue(extraFields) || !getUniversityReferenceId(extraFields))
            ) {
                showFeedback(tBookingEditor("errorUniversitySuggestionRequired"));
                return;
            }

            const fullPhone = phoneNumber ? `${countryCode}${sanitizePhone(phoneNumber)}` : null;
            const packageTotalValue = selectedMainServices.reduce(
                (sum, service) =>
                    sum + (service.price || 0) * (selectedMainQuantities[service.id] || 1),
                0,
            );
            const addonTotalValue = selectedAddonServices.reduce(
                (sum, service) =>
                    sum + (service.price || 0) * (selectedAddonQuantityMap[service.id] || 1),
                0,
            );
            const accommodationFeeValue = typeof accommodationFee === "number" ? accommodationFee : 0;
            const discountAmountValue = typeof discountAmount === "number" ? discountAmount : 0;
            const tPrice = computeSpecialOfferTotal({
                packageTotal: packageTotalValue,
                addonTotal: addonTotalValue,
                accommodationFee: accommodationFeeValue,
                discountAmount: discountAmountValue,
            });
            const dPaid = Math.max(
                Number(
                    typeof dpPaid === "number"
                        ? dpPaid
                        : isDpDisabledForThisBooking
                            ? 0
                            : parseFloat(String(dpPaid || 0)),
                ) || 0,
                0,
            );

            // Determine session_date: if split, use earliest; merge extra_fields with dates
            let finalSessionDate = sessionDate || null;
            const mergedExtra: Record<string, unknown> = { ...extraFields };
            if (isWeddingEvent && isSplitSessionEnabled) {
                mergedExtra.tanggal_akad = akadDate || "";
                mergedExtra.tanggal_resepsi = resepsiDate || "";
                if (akadDate && resepsiDate) {
                    finalSessionDate = akadDate < resepsiDate ? akadDate : resepsiDate;
                } else {
                    finalSessionDate = akadDate || resepsiDate || null;
                }
                mergedExtra[FREELANCER_ASSIGNMENTS_EXTRA_FIELD_KEY] =
                    splitSessionFreelancerAssignments;
            } else if (isWeddingEvent && !isSplitSessionEnabled) {
                // Toggled off: remove split date fields
                delete mergedExtra.tanggal_akad;
                delete mergedExtra.tanggal_resepsi;
                delete mergedExtra.tempat_akad;
                delete mergedExtra.tempat_resepsi;
                delete mergedExtra[FREELANCER_ASSIGNMENTS_EXTRA_FIELD_KEY];
            } else if (isWisudaEvent && isSplitSessionEnabled) {
                mergedExtra.tanggal_wisuda_1 = wisudaSession1Date || "";
                mergedExtra.tanggal_wisuda_2 = wisudaSession2Date || "";
                if (isWisudaDurationOverrideEnabled && wisudaDurationOverride) {
                    mergedExtra[WISUDA_SESSION_DURATION_EXTRA_FIELD_KEY] =
                        wisudaDurationOverride;
                } else {
                    delete mergedExtra[WISUDA_SESSION_DURATION_EXTRA_FIELD_KEY];
                }
                if (wisudaSession1Date && wisudaSession2Date) {
                    finalSessionDate =
                        wisudaSession1Date < wisudaSession2Date
                            ? wisudaSession1Date
                            : wisudaSession2Date;
                } else {
                    finalSessionDate = wisudaSession1Date || wisudaSession2Date || null;
                }
                mergedExtra[FREELANCER_ASSIGNMENTS_EXTRA_FIELD_KEY] =
                    splitSessionFreelancerAssignments;
            } else if (isWisudaEvent && !isSplitSessionEnabled) {
                delete mergedExtra.tanggal_wisuda_1;
                delete mergedExtra.tanggal_wisuda_2;
                delete mergedExtra.tempat_wisuda_1;
                delete mergedExtra.tempat_wisuda_2;
                delete mergedExtra[WISUDA_SESSION_DURATION_EXTRA_FIELD_KEY];
                delete mergedExtra[FREELANCER_ASSIGNMENTS_EXTRA_FIELD_KEY];
            } else {
                delete mergedExtra[FREELANCER_ASSIGNMENTS_EXTRA_FIELD_KEY];
            }

            const stringExtraFields = Object.fromEntries(
                Object.entries(mergedExtra).filter(([, value]) => typeof value === "string"),
            ) as Record<string, string>;
            const nonStringExtraFields = Object.fromEntries(
                Object.entries(mergedExtra).filter(([, value]) => typeof value !== "string"),
            ) as Record<string, unknown>;
            if (!hasUniversityExtraField) {
                delete stringExtraFields[UNIVERSITY_EXTRA_FIELD_KEY];
                delete stringExtraFields[UNIVERSITY_REFERENCE_EXTRA_KEY];
            }
            delete stringExtraFields.universitas_abbreviation_draft;
            const resolvedStringExtraFields = { ...stringExtraFields };
            const resolvedExtraFields: Record<string, unknown> = {
                ...resolvedStringExtraFields,
                ...nonStringExtraFields,
            };

            const customFieldSnapshots = buildCustomFieldSnapshots(
                activeFormLayout,
                normalizedEventType || "Umum",
                customFieldValues,
                { layoutMode: activeLayoutMode },
            );
            const nextSpecialOffer = buildEditableSpecialOfferSnapshot({
                existingSnapshot: specialOfferSnapshot,
                selectedEventType: eventType,
                selectedPackageServiceIds: selectedServiceIds,
                selectedAddonServiceIds: selectedAddonIds,
                packageTotal: packageTotalValue,
                addonTotal: addonTotalValue,
                accommodationFee: accommodationFeeValue,
                discountAmount: discountAmountValue,
                includeWhenZero: true,
            });
            const preservedStructuredExtraFields = Object.fromEntries(
                Object.entries(baseExtraFieldsObject || {}).filter(
                    ([key, value]) =>
                        key !== "custom_fields" &&
                        key !== "special_offer" &&
                        key !== WISUDA_SESSION_DURATION_EXTRA_FIELD_KEY &&
                        typeof value !== "string",
                ),
            ) as Record<string, unknown>;
            const nextExtraFieldsPayload = mergeSpecialOfferSnapshotIntoExtraFields({
                ...preservedStructuredExtraFields,
                ...resolvedExtraFields,
                ...(customFieldSnapshots.length > 0
                    ? { custom_fields: customFieldSnapshots }
                    : {}),
            }, nextSpecialOffer);
            const resolvedLocation = resolvePreferredLocation(
                isWeddingEvent
                    ? [
                        {
                            address: resolvedStringExtraFields.tempat_akad,
                            lat: extraLocationCoords.tempat_akad?.lat,
                            lng: extraLocationCoords.tempat_akad?.lng,
                        },
                        {
                            address: resolvedStringExtraFields.tempat_resepsi,
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
                                address: resolvedStringExtraFields.tempat_wisuda_1,
                                lat: extraLocationCoords.tempat_wisuda_1?.lat,
                                lng: extraLocationCoords.tempat_wisuda_1?.lng,
                            },
                            {
                                address: resolvedStringExtraFields.tempat_wisuda_2,
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

            const previousStatus = initialStatus;
            const nextStatus = status;
            const dpChanged = dPaid !== initialDpPaid;
            const shouldResetVerifiedDp = dpChanged && Boolean(dpVerifiedAt);
            const isCancelling = isTransitionToCancelled(previousStatus, nextStatus);
            const cancelPatch = isCancelling
                ? buildCancelPaymentPatch({
                    policy: options?.cancelPayment?.policy || "forfeit",
                    refundAmount: options?.cancelPayment?.refundAmount || 0,
                    verifiedAmount: dpVerifiedAmount,
                })
                : null;
            const autoDpPatch = buildAutoDpVerificationPatch({
                previousStatus,
                nextStatus,
                triggerStatus: dpVerifyTriggerStatus,
                dpPaid: dPaid,
                dpVerifiedAt,
            });
            const normalizedFinalAdjustments = normalizeFinalAdjustments(finalAdjustmentsRaw);
            const nextDpVerifiedAt = shouldResetVerifiedDp
                ? null
                : autoDpPatch?.dp_verified_at || dpVerifiedAt;
            const nextDpVerifiedAmount = nextDpVerifiedAt ? dPaid : 0;
            const nextDpRefundAmount = nextDpVerifiedAt
                ? shouldResetVerifiedDp
                    ? 0
                    : dpRefundAmount
                : 0;
            const nextDpRefundedAt = nextDpVerifiedAt
                ? shouldResetVerifiedDp
                    ? null
                    : dpRefundedAt
                : null;
            const nextPaymentSource = isCurrentUserAdmin && nextDpVerifiedAt
                ? resolvePaymentSourceFromOptionValue(paymentSourceValue, bankAccounts)
                : null;
            const finalPaymentAmountForCheck = finalPaidAt
                ? Math.max(
                    finalPaymentAmount,
                    getRemainingFinalPayment({
                        total_price: tPrice,
                        dp_paid: dPaid,
                        dp_verified_amount: nextDpVerifiedAmount,
                        dp_verified_at: nextDpVerifiedAt,
                        dp_refund_amount: nextDpRefundAmount,
                        dp_refunded_at: nextDpRefundedAt,
                        final_adjustments: normalizedFinalAdjustments,
                        final_payment_amount: 0,
                        final_paid_at: null,
                        settlement_status: settlementStatusValue,
                        is_fully_paid: false,
                    }),
                )
                : 0;
            const nextFinalPaymentSource = isCurrentUserAdmin && finalPaidAt
                ? resolvePaymentSourceFromOptionValue(finalPaymentSourceValue, bankAccounts)
                : null;
            const nextSettlementStatus = finalPaidAt ? "paid" : settlementStatusValue;
            const nextIsFullyPaid = isBookingFullyPaid({
                total_price: tPrice,
                dp_paid: dPaid,
                dp_verified_amount: nextDpVerifiedAmount,
                dp_verified_at: nextDpVerifiedAt,
                dp_refund_amount: nextDpRefundAmount,
                dp_refunded_at: nextDpRefundedAt,
                final_adjustments: normalizedFinalAdjustments,
                final_payment_amount: finalPaymentAmountForCheck,
                final_paid_at: finalPaidAt,
                settlement_status: nextSettlementStatus,
                is_fully_paid: isFullyPaid,
            });
            const [existingFreelancerRowsResult, existingBookingFreelancerResult] = await Promise.all([
                supabase
                    .from("booking_freelance")
                    .select("freelance_id")
                    .eq("booking_id", id),
                supabase
                    .from("bookings")
                    .select("freelance_id")
                    .eq("id", id)
                    .single(),
            ]);
            if (existingFreelancerRowsResult.error || existingBookingFreelancerResult.error) {
                showFeedback(tBookingEditor("failedSaveChanges"));
                return;
            }

            const { error } = await supabase.from("bookings").update({
                client_name: clientName,
                client_whatsapp: fullPhone,
                instagram: instagram || null,
                event_type: eventType,
                booking_date: bookingDate || createdAtDateFallback || new Date().toISOString().slice(0, 10),
                session_date: finalSessionDate,
                location: resolvedLocation.location,
                location_lat: resolvedLocation.locationLat,
                location_lng: resolvedLocation.locationLng,
                location_detail: locationDetail || null,
                service_id: selectedServiceIds[0] || null,
                city_code: isCityScopedEvent ? normalizedSelectedCityCode : null,
                city_name:
                    isCityScopedEvent && selectedCity
                        ? selectedCity.city_name
                        : null,
                freelance_id: freelancerIdsForSave[0] || null,
                total_price: tPrice,
                dp_paid: dPaid,
                dp_verified_amount: nextDpVerifiedAmount,
                dp_verified_at: nextDpVerifiedAt,
                dp_refund_amount: nextDpRefundAmount,
                dp_refunded_at: nextDpRefundedAt,
                is_fully_paid: nextIsFullyPaid,
                settlement_status: nextSettlementStatus,
                final_payment_amount: finalPaymentAmountForCheck,
                final_paid_at: finalPaidAt,
                status: nextStatus,
                client_status: nextStatus,
                ...(cancelPatch || {}),
                notes: notes || null,
                admin_notes: adminNotes || null,
                drive_folder_url: driveFolderUrl || null,
                video_drive_folder_url: videoDriveFolderUrl || null,
                portfolio_url: portfolioUrl || null,
                ...(isCurrentUserAdmin
                    ? {
                        operational_costs: normalizedOperationalCosts,
                        payment_source: nextPaymentSource,
                        final_payment_source: nextFinalPaymentSource,
                    }
                    : {}),
                extra_fields: nextExtraFieldsPayload,
                updated_at: new Date().toISOString(),
            }).eq("id", id);

            if (error) {
                showFeedback(tBookingEditor("failedSaveChanges"));
                return;
            }
            await invalidateBookingPublicCache();

            // Sync junction table without dropping payment entries for freelancers that remain assigned.
            const existingFreelancerIds = Array.from(new Set(
                [
                    ...((existingFreelancerRowsResult.data || []) as Array<{ freelance_id: string | null }>)
                    .map((row) => row.freelance_id)
                    .filter((freelancerId): freelancerId is string => Boolean(freelancerId)),
                    ...(existingBookingFreelancerResult.data?.freelance_id
                        ? [existingBookingFreelancerResult.data.freelance_id]
                        : []),
                ],
            ));
            const nextFreelancerIdSet = new Set(freelancerIdsForSave);
            const existingFreelancerIdSet = new Set(existingFreelancerIds);
            const removedFreelancerIds = existingFreelancerIds.filter((freelancerId) => !nextFreelancerIdSet.has(freelancerId));
            const addedFreelancerIds = freelancerIdsForSave.filter((freelancerId) => !existingFreelancerIdSet.has(freelancerId));
            if (removedFreelancerIds.length > 0) {
                await supabase
                    .from("booking_freelance")
                    .delete()
                    .eq("booking_id", id)
                    .in("freelance_id", removedFreelancerIds);
                await supabase
                    .from("freelance_payment_entries")
                    .delete()
                    .eq("booking_id", id)
                    .in("freelance_id", removedFreelancerIds);
            }
            await supabase.from("booking_services").delete().eq("booking_id", id);
            const bookingServiceRows = toBookingServicesPayload([
                ...buildBookingServicePayloadItemsFromSelection(
                    selectedServiceIds,
                    selectedMainQuantities,
                    "main",
                ),
                ...buildBookingServicePayloadItemsFromSelection(
                    selectedAddonIds,
                    selectedAddonQuantityMap,
                    "addon",
                ),
            ]).map((row) => ({
                booking_id: id,
                ...row,
            }));
            if (bookingServiceRows.length > 0) {
                await supabase.from("booking_services").insert(
                    bookingServiceRows,
                );
            }
            if (addedFreelancerIds.length > 0) {
                await supabase.from("booking_freelance").insert(
                    addedFreelancerIds.map((freelancerId) => ({ booking_id: id, freelance_id: freelancerId })),
                );
            }

            const cancelledAfterSave = isCancelledBookingStatus(nextStatus);
            const transitionFromCancelled =
                isCancelledBookingStatus(previousStatus) &&
                !isCancelledBookingStatus(nextStatus);

            if (!cancelledAfterSave) {
                const shouldInviteCalendar = Boolean(finalSessionDate) || transitionFromCancelled;
                if (shouldInviteCalendar) {
                    try {
                        const selectedFreelancerEmails = freelancers
                            .filter((freelancer) => freelancerIdsForSave.includes(freelancer.id))
                            .map((freelancer) => freelancer.google_email)
                            .filter((email): email is string => Boolean(email));
                        const noEmailNames = freelancers
                            .filter((freelancer) => freelancerIdsForSave.includes(freelancer.id) && !freelancer.google_email)
                            .map((freelancer) => freelancer.name);

                        const res = await fetch("/api/google/calendar-invite", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                bookingId: id,
                                attendeeEmails: selectedFreelancerEmails,
                            }),
                        });
                        if (!res.ok) {
                            const err = await res.json().catch(() => ({}));
                            setCalendarWarning(
                                tBookingEditor("calendarSyncFailed", {
                                    reason: err.error || tBookingEditor("googleCalendarNotConnected"),
                                }),
                            );
                            setTimeout(() => setCalendarWarning(null), 5000);
                        } else if (noEmailNames.length > 0) {
                            setCalendarWarning(
                                tBookingEditor("calendarInviteIncomplete", {
                                    names: noEmailNames.join(", "),
                                }),
                            );
                            setTimeout(() => setCalendarWarning(null), 5000);
                        }
                    } catch {
                        setCalendarWarning(tBookingEditor("calendarSyncFailedRun"));
                        setTimeout(() => setCalendarWarning(null), 5000);
                    }
                } else if (freelancerIdsForSave.length > 0) {
                    setCalendarWarning(tBookingEditor("calendarInviteSkippedNoSession"));
                    setTimeout(() => setCalendarWarning(null), 5000);
                }
            }

            if (isTransitionToCancelled(previousStatus, nextStatus)) {
                const calendarTransitionWarning = await syncGoogleCalendarForStatusTransition({
                    bookingId: id,
                    previousStatus,
                    nextStatus,
                    locale,
                });
                if (calendarTransitionWarning) {
                    setCalendarWarning(`⚠️ ${calendarTransitionWarning}`);
                    setTimeout(() => setCalendarWarning(null), 5000);
                }
            }

            setInitialStatus(nextStatus);
            setInitialDpPaid(dPaid);
            setDpVerifiedAmount(nextDpVerifiedAmount);
            setDpVerifiedAt(nextDpVerifiedAt);
            setDpRefundAmount(nextDpRefundAmount);
            setDpRefundedAt(nextDpRefundedAt);
            setFinalPaymentAmount(finalPaymentAmountForCheck);
            setSettlementStatusValue(nextSettlementStatus);
            setCancelStatusConfirmOpen(false);
            void triggerFastpikAutoSync(id);
            setIsFullyPaid(nextIsFullyPaid);
            router.push(saveRedirectHref);
        } finally {
            setSaving(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        await submitBookingUpdate();
    }

    async function handleMarkDpVerified() {
        if (!requireBookingWrite()) return;
        const dpValue = Math.max(
            Number(typeof dpPaid === "number" ? dpPaid : parseFloat(String(dpPaid || 0))) || 0,
            0,
        );
        if (dpValue <= 0) return;

        setMarkingDpVerified(true);
        const verifiedAt = new Date().toISOString();
        const nextPaymentSource = isCurrentUserAdmin
            ? resolvePaymentSourceFromOptionValue(paymentSourceValue, bankAccounts)
            : null;
        const patch = {
            dp_verified_amount: dpValue,
            dp_verified_at: verifiedAt,
            dp_refund_amount: 0,
            dp_refunded_at: null,
            ...(isCurrentUserAdmin ? { payment_source: nextPaymentSource } : {}),
        };

        const { error } = await supabase.from("bookings").update(patch).eq("id", id);
        setMarkingDpVerified(false);

        if (error) {
            showFeedback(tBookingEditor("failedVerifyDp"));
            return;
        }
        await invalidateBookingPublicCache();

        setDpVerifiedAmount(dpValue);
        setDpVerifiedAt(verifiedAt);
        setDpRefundAmount(0);
        setDpRefundedAt(null);
    }

    async function handleMarkDpUnverified() {
        if (!requireBookingWrite()) return;
        setMarkingDpUnverified(true);
        const patch = {
            dp_verified_amount: 0,
            dp_verified_at: null,
            dp_refund_amount: 0,
            dp_refunded_at: null,
            ...(isCurrentUserAdmin ? { payment_source: null } : {}),
        };
        const { error } = await supabase.from("bookings").update(patch).eq("id", id);
        setMarkingDpUnverified(false);

        if (error) {
            showFeedback(tBookingEditor("failedUnverifyDp"));
            return;
        }
        await invalidateBookingPublicCache();

        setDpVerifiedAmount(0);
        setDpVerifiedAt(null);
        setDpRefundAmount(0);
        setDpRefundedAt(null);
        setPaymentSourceValue("");
    }

    function addOperationalCostItem() {
        setOperationalCostItems((prev) => [
            ...prev,
            {
                id: crypto.randomUUID(),
                label: "",
                amount: "",
                created_at: new Date().toISOString(),
            },
        ]);
    }

    function updateOperationalCostItem(
        id: string,
        field: "label" | "amount",
        value: string,
    ) {
        setOperationalCostItems((prev) =>
            prev.map((item) =>
                item.id === id
                    ? {
                        ...item,
                        [field]:
                            field === "amount"
                                ? parseFormattedNumber(value)
                                : value,
                    }
                    : item,
            ),
        );
    }

    function removeOperationalCostItem(id: string) {
        setOperationalCostItems((prev) => prev.filter((item) => item.id !== id));
    }

    function appendOperationalCostItems(items: OperationalCost[]) {
        if (!isCurrentUserAdmin || items.length === 0) return;
        setOperationalCostItems((prev) =>
            toEditableOperationalCosts(
                appendUniqueOperationalCosts(
                    normalizeEditableOperationalCosts(prev),
                    items,
                ),
            ),
        );
    }

    function applyOperationalCostTemplate(template: OperationalCostTemplate) {
        appendOperationalCostItems(
            template.items.map((item) => buildOperationalCostFromTemplateItem(item)),
        );
    }

    function applyFreelancerOperationalCostItem(
        freelancerName: string,
        item: { label: string; amount: number },
    ) {
        appendOperationalCostItems([
            buildOperationalCostFromTemplateItem(item, {
                labelPrefix: freelancerName,
            }),
        ]);
    }

    const packageTotalValue = selectedMainServices.reduce(
        (sum, service) =>
            sum + (service.price || 0) * (selectedMainQuantities[service.id] || 1),
        0,
    );
    const addonTotalValue = selectedAddonServices.reduce(
        (sum, service) =>
            sum + (service.price || 0) * (selectedAddonQuantityMap[service.id] || 1),
        0,
    );
    const accommodationFeeValue =
        typeof accommodationFee === "number" ? accommodationFee : 0;
    const discountAmountValue =
        typeof discountAmount === "number" ? discountAmount : 0;
    const totalPriceValue = computeSpecialOfferTotal({
        packageTotal: packageTotalValue,
        addonTotal: addonTotalValue,
        accommodationFee: accommodationFeeValue,
        discountAmount: discountAmountValue,
    });
    const dpPaidValue = typeof dpPaid === "number" ? dpPaid : 0;
    const normalizedFinalAdjustments = normalizeFinalAdjustments(finalAdjustmentsRaw);
    const finalAdjustmentsTotal = getFinalAdjustmentsTotal(normalizedFinalAdjustments);
    const normalizedOperationalCosts = normalizeEditableOperationalCosts(operationalCostItems);
    const operationalCostsTotal = getOperationalCostsTotal(normalizedOperationalCosts);
    const finalInvoiceTotal = getFinalInvoiceTotal(totalPriceValue, normalizedFinalAdjustments);
    const resolvedIsFullyPaid = isBookingFullyPaid({
        total_price: totalPriceValue,
        dp_paid: dpPaidValue,
        dp_verified_amount: dpVerifiedAmount,
        dp_verified_at: dpVerifiedAt,
        dp_refund_amount: dpRefundAmount,
        dp_refunded_at: dpRefundedAt,
        final_adjustments: normalizedFinalAdjustments,
        final_payment_amount: finalPaymentAmount,
        final_paid_at: finalPaidAt,
        settlement_status: settlementStatusValue,
        is_fully_paid: isFullyPaid,
    });
    const verifiedPaymentInput = {
        total_price: totalPriceValue,
        dp_paid: dpPaidValue,
        dp_verified_amount: dpVerifiedAmount,
        dp_verified_at: dpVerifiedAt,
        dp_refund_amount: dpRefundAmount,
        dp_refunded_at: dpRefundedAt,
        final_adjustments: normalizedFinalAdjustments,
        final_payment_amount: finalPaymentAmount,
        final_paid_at: finalPaidAt,
        settlement_status: settlementStatusValue,
        is_fully_paid: resolvedIsFullyPaid,
    };
    const verifiedDpAmount = getVerifiedDpAmount(verifiedPaymentInput);
    const resolvedDpRefundAmount = getDpRefundAmount(verifiedPaymentInput);
    const verifiedFinalPayment = finalPaidAt ? finalPaymentAmount || 0 : 0;
    const netVerifiedRevenue = getNetVerifiedRevenueAmount(verifiedPaymentInput);
    const netRevenueAfterOperationalCosts = getNetRevenueAfterOperationalCosts({
        ...verifiedPaymentInput,
        operational_costs: normalizedOperationalCosts,
    });
    const remainingPayment = getRemainingFinalPayment(verifiedPaymentInput);
    const initialPaymentStatus = resolvedIsFullyPaid
        ? "Lunas"
        : verifiedDpAmount > 0
            ? "DP Terverifikasi"
            : dpPaidValue > 0
                ? "DP Menunggu Verifikasi"
                : tBookingEditor("unpaid");
    const settlementStatus = getSettlementStatus(settlementStatusValue);
    const initialPriceBreakdown = {
        packageTotal: packageTotalValue,
        addonTotal: addonTotalValue,
        accommodationFee: accommodationFeeValue,
        discountAmount: discountAmountValue,
    };

    const reqMark = <span className="text-red-500 ml-0.5">*</span>;

    if (loading) return (
        <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
    );

    return (
        <>
            {calendarWarning && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 px-4 py-3 shadow-lg text-sm text-amber-800 dark:text-amber-200 max-w-md">
                        <span>{calendarWarning}</span>
                        <button onClick={() => setCalendarWarning(null)} className="ml-2 text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 shrink-0 cursor-pointer">✕</button>
                    </div>
                </div>
            )}
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            <div className="flex items-center gap-3">
                <Link href={cancelHref}>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="w-4 h-4" /></Button>
                </Link>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Edit Booking</h2>
                    <p className="text-muted-foreground text-sm">{clientName}</p>
                </div>
            </div>

            <BookingWriteReadonlyBanner />

            <form onSubmit={handleSubmit} className="space-y-6">
                <fieldset disabled={!canWriteBookings} className="space-y-6">
                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
                    <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Users className="w-4 h-4" /> Informasi Klien
                    </h3>
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Nama{reqMark}</label>
                            <input required value={clientName} onChange={e => setClientName(e.target.value)} placeholder={tBookingEditor("clientNamePlaceholderEdit")} className={inputClass} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Nomor WhatsApp{reqMark}</label>
                            <div className="flex gap-1.5">
                                <select value={countryCode} onChange={e => setCountryCode(e.target.value)} className={cn(selectClass, "w-[110px] shrink-0 text-xs")}>
                                    {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                                </select>
                                <input required type="tel" value={phoneNumber} onChange={e => setPhoneNumber(sanitizePhone(e.target.value))} placeholder="812345678" className={cn(inputClass, "flex-1")} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Instagram</label>
                            <input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@username" className={inputClass} />
                        </div>
                    </div>
                    {currentExtraFields.length > 0 && (
                        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 pt-3 border-t border-dashed">
                            {currentExtraFields.map(f => {
                                if (SESSION_LOCATION_FIELD_KEYS.has(f.key)) {
                                    return null;
                                }
                                const fieldLabelKey =
                                    EXTRA_FIELD_LABEL_KEYS[
                                        f.key as keyof typeof EXTRA_FIELD_LABEL_KEYS
                                    ];
                                const fieldLabel = fieldLabelKey
                                    ? tBookingEditor(`extraFieldLabels.${fieldLabelKey}`)
                                    : f.label;
                                return (
                                <div key={f.key} className={`space-y-1.5 ${f.isLocation || f.fullWidth || currentExtraFields.length === 1 ? "col-span-full" : ""}`}>
                                    <label className="text-xs font-medium text-muted-foreground">{fieldLabel}{f.required && <span className="text-red-500 ml-0.5">*</span>}</label>
                                    {f.key === UNIVERSITY_EXTRA_FIELD_KEY ? (
                                        <UniversityAutocomplete
                                            value={extraFields[f.key] || ""}
                                            selectedId={extraFields[UNIVERSITY_REFERENCE_EXTRA_KEY] || ""}
                                            onValueChange={value =>
                                                setExtraFields(prev => ({ ...prev, [f.key]: value }))
                                            }
                                            onSelect={(item) =>
                                                setExtraFields(prev => {
                                                    const next = { ...prev };
                                                    if (item) {
                                                        next[f.key] = item.displayName || item.name;
                                                        next[UNIVERSITY_REFERENCE_EXTRA_KEY] = item.id;
                                                    } else {
                                                        delete next[UNIVERSITY_REFERENCE_EXTRA_KEY];
                                                    }
                                                    return next;
                                                })
                                            }
                                            placeholder={tBookingEditor("searchUniversity")}
                                            required={f.required}
                                        />
                                    ) : f.isLocation ? (
                                        <LocationAutocomplete
                                            value={extraFields[f.key] || ""}
                                            onChange={v => setExtraFields(prev => ({ ...prev, [f.key]: v }))}
                                            onLocationChange={(meta: LocationSelectionMeta) => {
                                                setExtraLocationCoords((prev) => ({
                                                    ...prev,
                                                    [f.key]:
                                                        meta.source === "manual" || meta.source === "clear"
                                                            ? { lat: null, lng: null }
                                                            : { lat: meta.lat, lng: meta.lng },
                                                }));
                                            }}
                                            placeholder={
                                                tBookingEditor("searchLocationField", {
                                                    field: fieldLabel.toLowerCase(),
                                                })
                                            }
                                            initialLat={extraLocationCoords[f.key]?.lat ?? null}
                                            initialLng={extraLocationCoords[f.key]?.lng ?? null}
                                            required={f.required}
                                        />
                                    ) : f.isNumeric ? (
                                        <input placeholder={fieldLabel} value={extraFields[f.key] || ""} onChange={e => {
                                            const raw = e.target.value.replace(/[^0-9]/g, "");
                                            const num = parseInt(raw, 10);
                                            setExtraFields(prev => ({ ...prev, [f.key]: raw === "" ? "" : new Intl.NumberFormat("id-ID").format(num) }));
                                        }} className={inputClass} required={f.required} inputMode="numeric" />
                                    ) : (
                                        <input placeholder={fieldLabel} value={extraFields[f.key] || ""} onChange={e => setExtraFields(prev => ({ ...prev, [f.key]: e.target.value }))} className={inputClass} required={f.required} />
                                    )}
                                </div>
                            );})}
                        </div>
                    )}
                    {clientCustomItems.length > 0 && (
                        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 pt-3 border-t border-dashed">
                            <BookingAdminCustomFields
                                items={clientCustomItems}
                                values={customFieldValues}
                                onChange={(fieldId, value) => setCustomFieldValues(prev => ({ ...prev, [fieldId]: value }))}
                                inputClass={inputClass}
                                textareaClass={textareaClass}
                                selectClass={selectClass}
                            />
                        </div>
                    )}
                </div>

                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
                    <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <CalendarClock className="w-4 h-4" /> {tBookingEditor("sectionSessionDetail")}
                    </h3>
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                        <div className="col-span-full space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Tipe Acara{reqMark}</label>
                            <select value={eventType} onChange={e => {
                                if (isSplitFreelancerMode) {
                                    collapseSplitFreelancersToGlobal();
                                }
                                setEventType(e.target.value);
                                setSplitDates(false);
                                setFreelancerAssignmentsBySession({});
                                setAkadDate("");
                                setResepsiDate("");
                                setWisudaSession1Date("");
                                setWisudaSession2Date("");
                                setIsWisudaDurationOverrideEnabled(false);
                                setWisudaSession1DurationInput("");
                                setWisudaSession2DurationInput("");
                                setExtraFields({});
                                setExtraLocationCoords({});
                                setCustomFieldValues({});
                                setPackageSearchQuery("");
                                setAddonSearchQuery("");
                            }} className={selectClass} required>
                                {eventTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="col-span-full space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Tanggal Booking</label>
                            <input
                                type="date"
                                value={bookingDate}
                                onChange={e => setBookingDate(e.target.value)}
                                className={dateTimeInputClass}
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Dipakai untuk urutan Booking Terbaru/Terlama.
                            </p>
                        </div>

                        {/* Split dates toggle */}
                        {(eventType === "Wedding" || eventType === "Wisuda") && (
                            <div className="col-span-full flex items-center gap-3">
                                <button type="button" onClick={() => {
                                    const nextSplitDates = !splitDates;
                                    if (!nextSplitDates && isSplitFreelancerMode) {
                                        collapseSplitFreelancersToGlobal();
                                    }
                                    setSplitDates(nextSplitDates);
                                    if (!nextSplitDates && eventType === "Wisuda") {
                                        setIsWisudaDurationOverrideEnabled(false);
                                        setWisudaSession1DurationInput("");
                                        setWisudaSession2DurationInput("");
                                    }
                                }}
                                    className={cn("relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors", splitDates ? "bg-primary" : "bg-muted-foreground/30")}
                                >
                                    <span className={cn("pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform", splitDates ? "translate-x-4" : "translate-x-0")} />
                                </button>
                                <span className="text-xs font-medium text-muted-foreground">
                                    {eventType === "Wedding"
                                        ? "Akad & Resepsi beda hari"
                                        : "Sesi 1 & Sesi 2 beda waktu/lokasi"}
                                </span>
                            </div>
                        )}

                        {eventType === "Wedding" && splitDates ? (
                            <>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Tanggal Akad{reqMark}</label>
                                    <input type="date" value={akadDate ? akadDate.split("T")[0] : ""} onChange={e => {
                                        const timePart = akadDate?.split("T")[1] || "10:00";
                                        setAkadDate(e.target.value ? `${e.target.value}T${timePart}` : "");
                                    }} required className={dateTimeInputClass} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Jam Akad{reqMark}</label>
                                    <input type="time" value={akadDate ? akadDate.split("T")[1] || "10:00" : ""} onChange={e => {
                                        const datePart = akadDate?.split("T")[0] || "";
                                        if (datePart) setAkadDate(`${datePart}T${e.target.value}`);
                                    }} className={dateTimeInputClass} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Tanggal Resepsi{reqMark}</label>
                                    <input type="date" value={resepsiDate ? resepsiDate.split("T")[0] : ""} onChange={e => {
                                        const timePart = resepsiDate?.split("T")[1] || "10:00";
                                        setResepsiDate(e.target.value ? `${e.target.value}T${timePart}` : "");
                                    }} required className={dateTimeInputClass} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Jam Resepsi{reqMark}</label>
                                    <input type="time" value={resepsiDate ? resepsiDate.split("T")[1] || "10:00" : ""} onChange={e => {
                                        const datePart = resepsiDate?.split("T")[0] || "";
                                        if (datePart) setResepsiDate(`${datePart}T${e.target.value}`);
                                    }} className={dateTimeInputClass} />
                                </div>
                            </>
                        ) : eventType === "Wisuda" && splitDates ? (
                            <>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Tanggal Sesi 1{reqMark}</label>
                                    <input type="date" value={wisudaSession1Date ? wisudaSession1Date.split("T")[0] : ""} onChange={e => {
                                        const timePart = wisudaSession1Date?.split("T")[1] || "10:00";
                                        setWisudaSession1Date(e.target.value ? `${e.target.value}T${timePart}` : "");
                                    }} required className={dateTimeInputClass} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Jam Sesi 1{reqMark}</label>
                                    <input type="time" value={wisudaSession1Date ? wisudaSession1Date.split("T")[1] || "10:00" : ""} onChange={e => {
                                        const datePart = wisudaSession1Date?.split("T")[0] || "";
                                        if (datePart) setWisudaSession1Date(`${datePart}T${e.target.value}`);
                                    }} className={dateTimeInputClass} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Tanggal Sesi 2{reqMark}</label>
                                    <input type="date" value={wisudaSession2Date ? wisudaSession2Date.split("T")[0] : ""} onChange={e => {
                                        const timePart = wisudaSession2Date?.split("T")[1] || "10:00";
                                        setWisudaSession2Date(e.target.value ? `${e.target.value}T${timePart}` : "");
                                    }} required className={dateTimeInputClass} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Jam Sesi 2{reqMark}</label>
                                    <input type="time" value={wisudaSession2Date ? wisudaSession2Date.split("T")[1] || "10:00" : ""} onChange={e => {
                                        const datePart = wisudaSession2Date?.split("T")[0] || "";
                                        if (datePart) setWisudaSession2Date(`${datePart}T${e.target.value}`);
                                    }} className={dateTimeInputClass} />
                                </div>
                                <div className="col-span-full rounded-lg border border-dashed p-3 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const nextValue = !isWisudaDurationOverrideEnabled;
                                                setIsWisudaDurationOverrideEnabled(nextValue);
                                                if (!nextValue) {
                                                    setWisudaSession1DurationInput("");
                                                    setWisudaSession2DurationInput("");
                                                }
                                            }}
                                            className={cn(
                                                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                                                isWisudaDurationOverrideEnabled ? "bg-primary" : "bg-muted-foreground/30",
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform",
                                                    isWisudaDurationOverrideEnabled ? "translate-x-4" : "translate-x-0",
                                                )}
                                            />
                                        </button>
                                        <span className="text-xs font-medium text-muted-foreground">
                                            Override durasi sesi Wisuda
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        Total durasi paket: {selectedScheduleDurationMinutes} menit. Default:
                                        {" "}
                                        Sesi 1 {wisudaDefaultSession1DurationMinutes} menit,
                                        {" "}
                                        Sesi 2 {wisudaDefaultSession2DurationMinutes} menit.
                                    </p>
                                    {isWisudaDurationOverrideEnabled && (
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-muted-foreground">
                                                    Durasi Sesi 1 (menit){reqMark}
                                                </label>
                                                <input
                                                    value={wisudaSession1DurationInput}
                                                    onChange={(event) =>
                                                        setWisudaSession1DurationInput(
                                                            sanitizeDurationInput(event.target.value),
                                                        )
                                                    }
                                                    inputMode="numeric"
                                                    placeholder="60"
                                                    className={cn(inputClass, "block")}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-muted-foreground">
                                                    Durasi Sesi 2 (menit){reqMark}
                                                </label>
                                                <input
                                                    value={wisudaSession2DurationInput}
                                                    onChange={(event) =>
                                                        setWisudaSession2DurationInput(
                                                            sanitizeDurationInput(event.target.value),
                                                        )
                                                    }
                                                    inputMode="numeric"
                                                    placeholder="60"
                                                    className={cn(inputClass, "block")}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Tanggal{reqMark}</label>
                                    <input type="date" value={sessionDate ? sessionDate.split("T")[0] : ""} onChange={e => {
                                        const timePart = sessionDate?.split("T")[1] || "10:00";
                                        setSessionDate(e.target.value ? `${e.target.value}T${timePart}` : "");
                                    }} required className={dateTimeInputClass} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Jam{reqMark}</label>
                                    <input type="time" value={sessionDate ? sessionDate.split("T")[1] || "10:00" : ""} onChange={e => {
                                        const datePart = sessionDate?.split("T")[0] || "";
                                        if (datePart) setSessionDate(`${datePart}T${e.target.value}`);
                                    }} className={dateTimeInputClass} />
                                </div>
                            </>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Status{reqMark}</label>
                            <select value={status} onChange={e => setStatus(e.target.value)} className={selectClass} required>
                                {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        {sessionLocationExtraFields.length > 0 && (
                            <div className="col-span-full grid gap-y-4">
                                {sessionLocationExtraFields.map((field) => {
                                    const fieldLabelKey =
                                        EXTRA_FIELD_LABEL_KEYS[
                                            field.key as keyof typeof EXTRA_FIELD_LABEL_KEYS
                                        ];
                                    const fieldLabel = fieldLabelKey
                                        ? tBookingEditor(`extraFieldLabels.${fieldLabelKey}`)
                                        : field.label;
                                    return (
                                        <div key={field.key} className="space-y-1.5">
                                            <label className="text-xs font-medium text-muted-foreground">
                                                {fieldLabel}
                                                {field.required && (
                                                    <span className="text-red-500 ml-0.5">*</span>
                                                )}
                                            </label>
                                            <LocationAutocomplete
                                                value={extraFields[field.key] || ""}
                                                onChange={(value) =>
                                                    setExtraFields((prev) => ({
                                                        ...prev,
                                                        [field.key]: value,
                                                    }))
                                                }
                                                onLocationChange={(
                                                    meta: LocationSelectionMeta,
                                                ) => {
                                                    setExtraLocationCoords((prev) => ({
                                                        ...prev,
                                                        [field.key]:
                                                            meta.source === "manual" ||
                                                            meta.source === "clear"
                                                                ? { lat: null, lng: null }
                                                                : {
                                                                      lat: meta.lat,
                                                                      lng: meta.lng,
                                                                  },
                                                    }));
                                                }}
                                                placeholder={tBookingEditor(
                                                    "searchLocationField",
                                                    { field: fieldLabel.toLowerCase() },
                                                )}
                                                initialLat={
                                                    extraLocationCoords[field.key]?.lat ?? null
                                                }
                                                initialLng={
                                                    extraLocationCoords[field.key]?.lng ?? null
                                                }
                                                required={field.required}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {!(eventType === "Wedding" && splitDates) &&
                            !(eventType === "Wisuda" && splitDates) && (
                            <div className="col-span-full space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Lokasi Utama</label>
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
                                    placeholder={
                                        tBookingEditor("searchSessionLocation")
                                    }
                                    initialLat={locationCoords.lat}
                                    initialLng={locationCoords.lng}
                                />
                            </div>
                        )}
                        <div className="col-span-full space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Detail Lokasi</label>
                            <input value={locationDetail} onChange={e => setLocationDetail(e.target.value)} placeholder={tBookingEditor("locationDetailExample")} className={inputClass} />
                        </div>
                        {isCityScopedEvent ? (
                            <div className="col-span-full space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Kota / Kabupaten{reqMark}</label>
                                <CitySingleSelect
                                    options={cityOptions}
                                    value={normalizedSelectedCityCode}
                                    onChange={setSelectedCityCode}
                                    placeholder="Pilih kota / kabupaten"
                                    searchPlaceholder="Cari kota / kabupaten..."
                                    emptyText="Data kota / kabupaten tidak ditemukan."
                                    className="w-full"
                                />
                                {selectedCity ? (
                                    <p className="text-[11px] text-muted-foreground">
                                        Wilayah terpilih: {buildCityDisplayName(selectedCity)}
                                    </p>
                                ) : (
                                    <p className="text-[11px] text-muted-foreground">
                                        Pilih kota/kabupaten dulu untuk menampilkan paket.
                                    </p>
                                )}
                                {shouldAllowLegacyCityFallback ? (
                                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                                        Booking Wisuda lama ini belum memiliki kota. Pilih kota/kabupaten sebelum menyimpan perubahan.
                                    </p>
                                ) : null}
                            </div>
                        ) : null}
                        <div className="col-span-full space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Paket / Layanan{reqMark}</label>
                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={() => setPackageDialogOpen(true)}
                                    disabled={!eventType || (isCityScopedEvent && !normalizedSelectedCityCode && !shouldAllowLegacyCityFallback)}
                                    className="flex w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all hover:bg-muted/30 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <span className="text-left">
                                        {selectedMainServices.length > 0
                                            ? `${selectedMainServices.length} paket dipilih`
                                            : isCityScopedEvent &&
                                                !normalizedSelectedCityCode &&
                                                !shouldAllowLegacyCityFallback
                                                ? "Pilih kota / kabupaten dulu"
                                            : !eventType
                                                    ? "Pilih tipe acara dulu"
                                                    : tBookingEditor("selectPackageService")}
                                    </span>
                                    <span className="text-xs font-medium text-primary">
                                        Buka Daftar
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowCustomServicePopup(true)}
                                    className="w-full rounded-lg border border-dashed border-input px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/50"
                                >
                                    ＋ Tambah Paket Baru...
                                </button>
                            </div>
                            {selectedMainServices.length > 0 && (
                                <div className="space-y-2">
                                    {selectedMainServices.map((service) => {
                                        const quantity = selectedMainQuantities[service.id] || 1;
                                        const tone = buildServiceSoftPalette({
                                            serviceColor: service.color,
                                            fallbackColor: defaultServiceColor,
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
                                                <div className="shrink-0 text-right">
                                                    <p className="text-lg font-bold" style={{ color: tone.color }}>{formatCurrency(service.price * quantity)}</p>
                                                    {service.original_price && service.original_price > service.price ? (
                                                        <p className="text-[11px] text-muted-foreground line-through">{formatCurrency(service.original_price * quantity)}</p>
                                                    ) : null}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="col-span-full space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Add-on (opsional)</label>
                            <button
                                type="button"
                                onClick={() => setAddonDialogOpen(true)}
                                disabled={addonServices.length === 0 || !eventType || (isCityScopedEvent && !normalizedSelectedCityCode && !shouldAllowLegacyCityFallback)}
                                className="flex w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all hover:bg-muted/30 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <span className="text-left">
                                    {selectedAddonServices.length > 0
                                        ? `${selectedAddonServices.length} add-on dipilih`
                                        : tBookingEditor("selectAddon")}
                                </span>
                                <span className="text-xs font-medium text-primary">
                                    Buka Daftar
                                </span>
                            </button>
                            {addonServices.length === 0 ? (
                                <p className="rounded-lg border border-dashed border-input px-3 py-2 text-xs text-muted-foreground">
                                    Belum ada add-on aktif.
                                </p>
                            ) : null}
                            {selectedAddonServices.length > 0 && (
                                <div className="space-y-2">
                                    {selectedAddonServices.map((addon) => {
                                        const quantity = selectedAddonQuantityMap[addon.id] || 1;
                                        const tone = buildServiceSoftPalette({
                                            serviceColor: addon.color,
                                            fallbackColor: defaultServiceColor,
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
                                                <span className="font-semibold whitespace-nowrap" style={{ color: tone.color }}>
                                                    +{formatCurrency(addon.price * quantity)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {selectedAddonServices.length > 0 && selectedMainServices.length > 0 && (
                                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                                    {selectedMainServices.map((service) => {
                                        const quantity = selectedMainQuantities[service.id] || 1;
                                        const tone = buildServiceSoftPalette({
                                            serviceColor: service.color,
                                            fallbackColor: defaultServiceColor,
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
                                                <span>{service.name}{quantity > 1 ? ` x${quantity}` : ""}</span>
                                                <span style={{ color: tone.color }}>{formatCurrency(service.price * quantity)}</span>
                                            </div>
                                        );
                                    })}
                                    {selectedAddonServices.map((service) => {
                                        const quantity = selectedAddonQuantityMap[service.id] || 1;
                                        const tone = buildServiceSoftPalette({
                                            serviceColor: service.color,
                                            fallbackColor: defaultServiceColor,
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
                                                <span>+ {service.name}{quantity > 1 ? ` x${quantity}` : ""}</span>
                                                <span style={{ color: tone.color }}>{formatCurrency(service.price * quantity)}</span>
                                            </div>
                                        );
                                    })}
                                    <div className="flex justify-between font-bold border-t pt-1 mt-1">
                                        <span>Total</span>
                                        <span>{formatCurrency(totalPriceValue)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        {isSplitFreelancerMode ? (
                            <div className="col-span-full space-y-3">
                                <label className="text-xs font-medium text-muted-foreground">
                                    Freelance per sesi (max {MAX_FREELANCERS_PER_SESSION})
                                </label>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {splitFreelancerSessionKeys.map((sessionKey) => {
                                        const selectedSessionFreelancerIds =
                                            freelancerAssignmentsBySession[sessionKey] || [];
                                        const sessionLabel =
                                            SESSION_FREELANCER_LABELS[sessionKey] || sessionKey;
                                        return (
                                            <div key={sessionKey} className="rounded-lg border p-3 space-y-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-xs font-semibold text-muted-foreground">
                                                        {sessionLabel}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground">
                                                        {selectedSessionFreelancerIds.length}/
                                                        {MAX_FREELANCERS_PER_SESSION} dipilih
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        openFreelancerDialog(sessionKey)
                                                    }
                                                    className="inline-flex h-8 items-center rounded-lg border px-3 text-xs font-medium transition-colors hover:bg-muted/50 cursor-pointer"
                                                >
                                                    Pilih Freelance
                                                </button>
                                                {selectedSessionFreelancerIds.length > 0 ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {selectedSessionFreelancerIds.map((freelancerId) => (
                                                            <span
                                                                key={`${sessionKey}-${freelancerId}`}
                                                                className="rounded-lg border border-foreground/20 bg-foreground/5 px-2 py-1 text-[11px]"
                                                            >
                                                                {freelancerNameById.get(freelancerId) || freelancerId}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-[10px] text-muted-foreground">
                                                        Belum ada freelance dipilih.
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowCustomFreelancerPopup(true)}
                                    className="px-3 py-1.5 rounded-lg border border-dashed border-input text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer"
                                >
                                    ＋ Tambah Baru
                                </button>
                            </div>
                        ) : (
                            <div className="col-span-full space-y-2">
                                <label className="text-xs font-medium text-muted-foreground">
                                    Freelance (global, max 5)
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => openFreelancerDialog()}
                                        className="inline-flex h-8 items-center rounded-lg border px-3 text-xs font-medium transition-colors hover:bg-muted/50 cursor-pointer"
                                    >
                                        Pilih Freelance
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowCustomFreelancerPopup(true)}
                                        className="px-3 py-1.5 rounded-lg border border-dashed border-input text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer"
                                    >
                                        ＋ Tambah Baru
                                    </button>
                                </div>
                                {freelancerIds.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {freelancerIds.map((freelancerId) => (
                                            <span
                                                key={freelancerId}
                                                className="rounded-lg border border-foreground/20 bg-foreground/5 px-2 py-1 text-[11px]"
                                            >
                                                {freelancerNameById.get(freelancerId) || freelancerId}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-muted-foreground">
                                        Belum ada freelance dipilih.
                                    </p>
                                )}
                                <p className="text-[10px] text-muted-foreground">
                                    {freelancerIds.length}/5 dipilih
                                </p>
                            </div>
                        )}
                        {sessionCustomItems.length > 0 && (
                            <BookingAdminCustomFields
                                items={sessionCustomItems}
                                values={customFieldValues}
                                onChange={(fieldId, value) => setCustomFieldValues(prev => ({ ...prev, [fieldId]: value }))}
                                inputClass={inputClass}
                                textareaClass={textareaClass}
                                selectClass={selectClass}
                            />
                        )}
                    </div>
                </div>

                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
                    <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Wallet className="w-4 h-4" /> Keuangan
                    </h3>
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Harga Total{reqMark}</label>
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-muted-foreground shrink-0">Rp</span>
                                <input
                                    required
                                    type="text"
                                    inputMode="numeric"
                                    value={totalPriceValue > 0 ? formatNumber(totalPriceValue) : "0"}
                                    readOnly
                                    className={cn(inputClass, "flex-1 bg-muted/40")}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">
                                DP Dibayar
                            </label>
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-muted-foreground shrink-0">Rp</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={
                                        isDpDisabledForThisBooking
                                            ? String(typeof dpPaid === "number" ? dpPaid : 0)
                                            : formatNumber(dpPaid)
                                    }
                                    onChange={e => setDpPaid(parseFormattedNumber(e.target.value))}
                                    placeholder="0"
                                    className={cn(inputClass, "flex-1")}
                                />
                            </div>
                            {isDpDisabledForThisBooking ? (
                                <p className="text-[11px] text-muted-foreground">
                                    Booking ini dibuat tanpa DP dari form khusus.
                                </p>
                            ) : null}
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Biaya Akomodasi (Rp)</label>
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-muted-foreground shrink-0">Rp</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={formatNumber(accommodationFee)}
                                    onChange={(e) => setAccommodationFee(parseFormattedNumber(e.target.value))}
                                    placeholder="0"
                                    className={cn(inputClass, "flex-1")}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Diskon Nominal (Rp)</label>
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-muted-foreground shrink-0">Rp</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={formatNumber(discountAmount)}
                                    onChange={(e) => setDiscountAmount(parseFormattedNumber(e.target.value))}
                                    placeholder="0"
                                    className={cn(inputClass, "flex-1")}
                                />
                            </div>
                        </div>
                        <div className="col-span-full flex flex-wrap items-center gap-2">
                            {verifiedDpAmount > 0 ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5"
                                    onClick={() => void handleMarkDpUnverified()}
                                    disabled={markingDpUnverified}
                                >
                                    {markingDpUnverified ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                    )}
                                    Batal Tandai Lunas DP
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5"
                                    onClick={() => void handleMarkDpVerified()}
                                    disabled={markingDpVerified || dpPaidValue <= 0}
                                >
                                    {markingDpVerified ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                    )}
                                    Tandai Lunas DP
                                </Button>
                            )}
                        </div>
                        {isCurrentUserAdmin && (
                            <div className="col-span-full grid gap-3 md:grid-cols-2">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Sumber DP</label>
                                    <select
                                        value={paymentSourceValue}
                                        onChange={(event) => setPaymentSourceValue(event.target.value)}
                                        className={selectClass}
                                    >
                                        <option value="">Belum dipilih</option>
                                        {paymentSourceOptions.map((option) => (
                                            <option key={`dp-${option.value}`} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Tanggal Verifikasi DP</label>
                                    <input
                                        type="date"
                                        value={formatDateInputValue(dpVerifiedAt)}
                                        onChange={(event) => {
                                            const nextVerifiedAt = dateInputToStableIso(event.target.value);
                                            setDpVerifiedAt(nextVerifiedAt);
                                            setDpVerifiedAmount(nextVerifiedAt ? dpPaidValue : 0);
                                            if (!nextVerifiedAt) {
                                                setPaymentSourceValue("");
                                                setDpRefundAmount(0);
                                                setDpRefundedAt(null);
                                            }
                                        }}
                                        className={adminNativeDateTimeInputClass}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Sumber Pelunasan</label>
                                    <select
                                        value={finalPaymentSourceValue}
                                        onChange={(event) => setFinalPaymentSourceValue(event.target.value)}
                                        className={selectClass}
                                    >
                                        <option value="">Belum dipilih</option>
                                        {paymentSourceOptions.map((option) => (
                                            <option key={`final-${option.value}`} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Tanggal Pelunasan</label>
                                    <input
                                        type="date"
                                        value={formatDateInputValue(finalPaidAt)}
                                        onChange={(event) => {
                                            const nextFinalPaidAt = dateInputToStableIso(event.target.value);
                                            setFinalPaidAt(nextFinalPaidAt);
                                            if (nextFinalPaidAt) {
                                                setFinalPaymentAmount((prev) => prev > 0 ? prev : remainingPayment);
                                                setSettlementStatusValue("paid");
                                            } else {
                                                setFinalPaymentAmount(0);
                                                setFinalPaymentSourceValue("");
                                                setSettlementStatusValue("draft");
                                            }
                                        }}
                                        className={adminNativeDateTimeInputClass}
                                    />
                                </div>
                            </div>
                        )}
                        {paymentCustomItems.length > 0 && (
                            <BookingAdminCustomFields
                                items={paymentCustomItems}
                                values={customFieldValues}
                                onChange={(fieldId, value) => setCustomFieldValues(prev => ({ ...prev, [fieldId]: value }))}
                                inputClass={inputClass}
                                textareaClass={textareaClass}
                                selectClass={selectClass}
                            />
                        )}
                    </div>
                    {isCurrentUserAdmin && (
                    <div
                        id="operational-costs"
                        ref={operationalCostsSectionRef}
                        className={cn(
                            "scroll-mt-24 rounded-xl border bg-muted/20 p-4 space-y-3 transition-all duration-500",
                            highlightOperationalCosts && "ring-2 ring-orange-400/80 bg-orange-50/80 dark:bg-orange-500/10",
                        )}
                    >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h4 className="text-sm font-semibold">Biaya Operasional</h4>
                                <p className="text-xs text-muted-foreground">
                                    Biaya ini hanya mengurangi pemasukan bersih internal, tidak mengubah invoice klien.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5"
                                    onClick={() => setOperationalCostTemplateDialogOpen(true)}
                                >
                                    <Search className="w-3.5 h-3.5" />
                                    Pilih Template
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5"
                                    onClick={addOperationalCostItem}
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Tambah Biaya
                                </Button>
                            </div>
                        </div>

                        {operationalCostItems.length > 0 ? (
                            <div className="space-y-3">
                                {operationalCostItems.map((item, index) => (
                                    <div
                                        key={item.id}
                                        className="grid gap-3 rounded-lg border bg-background/80 p-3 md:grid-cols-[minmax(0,1fr)_220px_auto]"
                                    >
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-muted-foreground">
                                                Nama Biaya {index + 1}
                                            </label>
                                            <input
                                                type="text"
                                                value={item.label}
                                                onChange={(event) => updateOperationalCostItem(item.id, "label", event.target.value)}
                                                placeholder="Contoh: Biaya Freelance"
                                                className={inputClass}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-muted-foreground">Nominal (Rp)</label>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-sm font-medium text-muted-foreground shrink-0">Rp</span>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formatNumber(item.amount)}
                                                    onChange={(event) => updateOperationalCostItem(item.id, "amount", event.target.value)}
                                                    placeholder="0"
                                                    className={cn(inputClass, "flex-1")}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-end">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive"
                                                onClick={() => removeOperationalCostItem(item.id)}
                                                aria-label={`Hapus biaya operasional ${index + 1}`}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-lg border border-dashed bg-background/60 px-4 py-5 text-sm text-muted-foreground">
                                Belum ada biaya operasional.
                            </div>
                        )}
                    </div>
                    )}
                    <div className="rounded-xl border bg-muted/30 p-4 space-y-3 text-sm">
                        <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Status Pembayaran Awal</span>
                            <span className="font-medium">{initialPaymentStatus}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Status Pelunasan</span>
                            <span className="font-medium">{getSettlementLabel(settlementStatus)}</span>
                        </div>

                        <div className="border-t pt-3 space-y-2">
                            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Paket Awal</span><span>{formatCurrency(initialPriceBreakdown.packageTotal)}</span></div>
                            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Add-on Awal</span><span>{formatCurrency(initialPriceBreakdown.addonTotal)}</span></div>
                            {Number(initialPriceBreakdown.accommodationFee) > 0 ? (
                                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Akomodasi</span><span>{formatCurrency(initialPriceBreakdown.accommodationFee)}</span></div>
                            ) : null}
                            {Number(initialPriceBreakdown.discountAmount) > 0 ? (
                                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Diskon</span><span>- {formatCurrency(initialPriceBreakdown.discountAmount)}</span></div>
                            ) : null}
                            <div className="flex justify-between gap-4"><span className="text-muted-foreground">DP Dibayar</span><span>- {formatCurrency(dpPaidValue)}</span></div>
                            <div className="flex justify-between gap-4"><span className="text-muted-foreground">DP Terverifikasi</span><span>{formatCurrency(verifiedDpAmount)}</span></div>
                            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Refund DP</span><span>{formatCurrency(resolvedDpRefundAmount)}</span></div>
                            <div className="flex justify-between gap-4 border-t pt-2">
                                <span className="font-semibold text-green-700 dark:text-green-400">Total Awal</span>
                                <span className="font-semibold text-green-700 dark:text-green-400">{formatCurrency(totalPriceValue)}</span>
                            </div>
                        </div>

                        <div className="border-t pt-3 space-y-2">
                            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Add-on Akhir</span><span>{formatCurrency(finalAdjustmentsTotal)}</span></div>
                            <div className="flex justify-between gap-4">
                                <span className="font-semibold text-green-700 dark:text-green-400">Total Final</span>
                                <span className="font-semibold text-green-700 dark:text-green-400">{formatCurrency(finalInvoiceTotal)}</span>
                            </div>
                        </div>

                        <div className="border-t pt-3 space-y-2">
                            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Pelunasan Terverifikasi</span><span>{formatCurrency(verifiedFinalPayment)}</span></div>
                            <div className="flex justify-between gap-4">
                                <span className="font-semibold text-green-700 dark:text-green-400">Total Terverifikasi</span>
                                <span className="font-semibold text-green-700 dark:text-green-400">{formatCurrency(netVerifiedRevenue)}</span>
                            </div>
                            {isCurrentUserAdmin && (
                                <>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-muted-foreground">Biaya Operasional</span>
                                        <span>- {formatCurrency(operationalCostsTotal)}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="font-semibold text-green-700 dark:text-green-400">Pemasukan Bersih</span>
                                        <span className="font-semibold text-green-700 dark:text-green-400">{formatCurrency(netRevenueAfterOperationalCosts)}</span>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="border-t pt-3">
                            <div className="flex justify-between gap-4">
                                <span className="font-semibold">Sisa</span>
                                <span className={remainingPayment > 0 ? "font-semibold text-amber-600 dark:text-amber-400" : "font-semibold text-green-600 dark:text-green-400"}>
                                    {formatCurrency(remainingPayment)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-3">
                    <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <StickyNote className="w-4 h-4" /> Catatan
                    </h3>
                    <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Detail tambahan..." className={textareaClass} />
                </div>
                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-3">
                    <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <StickyNote className="w-4 h-4" /> Catatan Admin
                    </h3>
                    <textarea rows={4} value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder={tBookingEditor("adminNotesPlaceholder")} className={textareaClass} />
                </div>

                {/* Link Google Drive Hasil Foto */}
                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-3">
                    <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Link2 className="w-4 h-4" /> Link Google Drive Hasil Foto
                    </h3>
                    <input type="url" value={driveFolderUrl} onChange={e => setDriveFolderUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/..." className={inputClass} />
                    <p className="text-[11px] text-muted-foreground">Tempelkan link Google Drive hasil foto klien di sini (opsional).</p>
                </div>

                {/* Link Google Drive Hasil Video */}
                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-3">
                    <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Link2 className="w-4 h-4" /> Link Google Drive Hasil Video
                    </h3>
                    <input type="url" value={videoDriveFolderUrl} onChange={e => setVideoDriveFolderUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/..." className={inputClass} />
                    <p className="text-[11px] text-muted-foreground">Tempelkan link Google Drive hasil video klien di sini (opsional).</p>
                </div>

                {/* Link Portofolio IG */}
                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-3">
                    <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Link2 className="w-4 h-4" /> Link Portofolio Instagram
                    </h3>
                    <input type="url" value={portfolioUrl} onChange={e => setPortfolioUrl(e.target.value)} placeholder="https://www.instagram.com/p/..." className={inputClass} />
                    <p className="text-[11px] text-muted-foreground">Link postingan IG hasil foto (opsional).</p>
                </div>

                </fieldset>

                <div className="flex gap-3 justify-end pt-4">
                    <Link href={cancelHref}><Button type="button" variant="ghost" className="text-muted-foreground hover:text-foreground">Batal</Button></Link>
                    <Button type="submit" disabled={saving || !canWriteBookings} className="gap-2 bg-foreground text-background hover:bg-foreground/90 px-8">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Simpan Perubahan
                    </Button>
                </div>
            </form>

            <Dialog
                open={operationalCostTemplateDialogOpen}
                onOpenChange={(open) => {
                    setOperationalCostTemplateDialogOpen(open);
                    if (!open) setOperationalCostTemplateSearchQuery("");
                }}
            >
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Pilih Template Biaya Operasional</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                value={operationalCostTemplateSearchQuery}
                                onChange={(event) => setOperationalCostTemplateSearchQuery(event.target.value)}
                                placeholder="Cari template, item biaya, atau freelance..."
                                className={cn(inputClass, "pl-9")}
                            />
                        </div>

                        <div className="max-h-[62vh] space-y-5 overflow-y-auto pr-1">
                            <section className="space-y-2">
                                <div>
                                    <h4 className="text-sm font-semibold">Template Biaya</h4>
                                    <p className="text-xs text-muted-foreground">
                                        Item akan ditambahkan ke booking tanpa menghapus biaya yang sudah ada.
                                    </p>
                                </div>
                                {searchedOperationalCostTemplates.length > 0 ? (
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {searchedOperationalCostTemplates.map((template) => (
                                            <button
                                                key={template.id}
                                                type="button"
                                                className="rounded-lg border bg-background p-3 text-left transition hover:border-foreground/40 hover:bg-muted/30"
                                                onClick={() => applyOperationalCostTemplate(template)}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold">
                                                            {template.name}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {template.items.length} item
                                                        </p>
                                                    </div>
                                                    <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                </div>
                                                <div className="mt-3 space-y-1">
                                                    {template.items.slice(0, 4).map((item) => (
                                                        <div key={item.id} className="flex justify-between gap-3 text-xs">
                                                            <span className="min-w-0 truncate text-muted-foreground">
                                                                {item.label}
                                                            </span>
                                                            <span className="shrink-0 font-medium">
                                                                {formatCurrency(item.amount)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {template.items.length > 4 ? (
                                                        <p className="text-xs text-muted-foreground">
                                                            +{template.items.length - 4} item lain
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-dashed bg-muted/10 px-4 py-5 text-sm text-muted-foreground">
                                        Belum ada template biaya yang cocok.
                                    </div>
                                )}
                            </section>

                            <section className="space-y-2">
                                <div>
                                    <h4 className="text-sm font-semibold">Biaya Freelance</h4>
                                    <p className="text-xs text-muted-foreground">
                                        Muncul dari pricelist freelance yang sudah di-assign ke booking.
                                    </p>
                                </div>
                                {assignedFreelancerOperationalCostOptions.length > 0 ? (
                                    <div className="space-y-3">
                                        {assignedFreelancerOperationalCostOptions.map(({ freelancer, items }) => {
                                            const query = operationalCostTemplateSearchQuery.trim().toLowerCase();
                                            const visibleItems = query
                                                ? items.filter((item) =>
                                                    freelancer.name.toLowerCase().includes(query) ||
                                                    item.label.toLowerCase().includes(query),
                                                )
                                                : items;
                                            return (
                                                <div key={freelancer.id} className="rounded-lg border bg-background p-3">
                                                    <div className="mb-2">
                                                        <p className="text-sm font-semibold">{freelancer.name}</p>
                                                        {freelancer.role ? (
                                                            <p className="text-xs text-muted-foreground">{freelancer.role}</p>
                                                        ) : null}
                                                    </div>
                                                    {visibleItems.length > 0 ? (
                                                        <div className="grid gap-2 sm:grid-cols-2">
                                                            {visibleItems.map((item) => (
                                                                <button
                                                                    key={`${freelancer.id}-${item.id}`}
                                                                    type="button"
                                                                    className="flex items-center justify-between gap-3 rounded-md border bg-muted/10 px-3 py-2 text-left text-sm transition hover:border-foreground/40 hover:bg-muted/30"
                                                                    onClick={() =>
                                                                        applyFreelancerOperationalCostItem(
                                                                            freelancer.name,
                                                                            item,
                                                                        )
                                                                    }
                                                                >
                                                                    <span className="min-w-0 truncate">
                                                                        {item.label}
                                                                    </span>
                                                                    <span className="shrink-0 font-medium">
                                                                        {formatCurrency(item.amount)}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="rounded-md border border-dashed bg-muted/10 px-3 py-3 text-xs text-muted-foreground">
                                                            Belum ada pricelist yang cocok untuk freelance ini.
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-dashed bg-muted/10 px-4 py-5 text-sm text-muted-foreground">
                                        Belum ada freelance assigned dengan pricelist.
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOperationalCostTemplateDialogOpen(false)}
                        >
                            Selesai
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={freelancerDialogOpen}
                onOpenChange={(open) => {
                    setFreelancerDialogOpen(open);
                    if (!open) {
                        setFreelancerSearchQuery("");
                        setActiveFreelancerSessionKey(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {activeFreelancerSessionLabel
                                ? `Pilih Freelance - ${activeFreelancerSessionLabel}`
                                : "Pilih Freelance"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                value={freelancerSearchQuery}
                                onChange={(event) => setFreelancerSearchQuery(event.target.value)}
                                placeholder="Cari freelance..."
                                className={cn(inputClass, "pl-9")}
                            />
                        </div>
                        <div className="flex items-center justify-end gap-1">
                            <button
                                type="button"
                                onClick={() => setFreelancerViewMode("list")}
                                className={cn(
                                    "inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
                                    freelancerViewMode === "list"
                                        ? "border-foreground bg-foreground/5 text-foreground"
                                        : "border-input text-muted-foreground hover:bg-muted/60",
                                )}
                                title="Tampilan baris"
                                aria-label="Tampilan baris"
                            >
                                <List className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setFreelancerViewMode("grid")}
                                className={cn(
                                    "inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
                                    freelancerViewMode === "grid"
                                        ? "border-foreground bg-foreground/5 text-foreground"
                                        : "border-input text-muted-foreground hover:bg-muted/60",
                                )}
                                title="Tampilan kotak"
                                aria-label="Tampilan kotak"
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </button>
                        </div>
                        <div
                            className={cn(
                                "max-h-[55vh] overflow-y-auto pr-1",
                                freelancerViewMode === "grid"
                                    ? "grid grid-cols-1 gap-2 sm:grid-cols-2"
                                    : "space-y-2",
                            )}
                        >
                            {freelancers.length === 0 ? (
                                <div
                                    className={cn(
                                        "rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground",
                                        freelancerViewMode === "grid" ? "sm:col-span-2" : "",
                                    )}
                                >
                                    Belum ada freelance aktif.
                                </div>
                            ) : searchedFreelancers.length === 0 ? (
                                <div
                                    className={cn(
                                        "rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground",
                                        freelancerViewMode === "grid" ? "sm:col-span-2" : "",
                                    )}
                                >
                                    Tidak ada hasil pencarian freelance.
                                </div>
                            ) : (
                                searchedFreelancers.map((freelancer) => {
                                    const selected =
                                        selectedFreelancerIdsForDialog.includes(
                                            freelancer.id,
                                        );
                                    const roleBadgeStyle = buildBadgeStyle(
                                        teamBadgeColors.roles,
                                        freelancer.role,
                                    );
                                    const limitReached =
                                        !selected &&
                                        selectedFreelancerIdsForDialog.length >=
                                            freelancerDialogMaxSelection;
                                    return (
                                        <button
                                            key={freelancer.id}
                                            type="button"
                                            onClick={() =>
                                                toggleFreelancerFromDialog(freelancer.id)
                                            }
                                            disabled={limitReached}
                                            className={cn(
                                                "flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-all",
                                                selected
                                                    ? "border-foreground bg-foreground/5 text-foreground shadow-sm"
                                                    : "border-input text-foreground hover:bg-muted/40",
                                                limitReached
                                                    ? "cursor-not-allowed opacity-60"
                                                    : "cursor-pointer",
                                                freelancerViewMode === "grid"
                                                    ? "h-full"
                                                    : "",
                                            )}
                                        >
                                            <div className="flex items-start gap-3">
                                                <span
                                                    className={cn(
                                                        "mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded border",
                                                        selected
                                                            ? "border-foreground bg-foreground text-background"
                                                            : "border-input bg-transparent text-transparent",
                                                    )}
                                                >
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium">
                                                        {freelancer.name}
                                                    </p>
                                                    <div className="mt-1 flex flex-wrap items-center gap-1">
                                                        {freelancer.role ? (
                                                            <span
                                                                style={roleBadgeStyle}
                                                                className={cn(
                                                                    "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                                                                    !roleBadgeStyle && "bg-muted text-muted-foreground border-transparent",
                                                                )}
                                                            >
                                                                {freelancer.role}
                                                            </span>
                                                        ) : null}
                                                        {freelancer.tags.slice(0, 2).map((tag) => {
                                                            const tagBadgeStyle = buildBadgeStyle(
                                                                teamBadgeColors.tags,
                                                                tag,
                                                            );
                                                            return (
                                                                <span
                                                                    key={`${freelancer.id}-${tag}`}
                                                                    style={tagBadgeStyle}
                                                                    className={cn(
                                                                        "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                                                                        !tagBadgeStyle && "bg-primary/10 text-primary border-transparent",
                                                                    )}
                                                                >
                                                                    {tag}
                                                                </span>
                                                            );
                                                        })}
                                                        {freelancer.tags.length > 2 ? (
                                                            <span className="text-[10px] text-muted-foreground">
                                                                +{freelancer.tags.length - 2}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                            {selectedFreelancerIdsForDialog.length}/
                            {freelancerDialogMaxSelection} dipilih
                        </p>
                        <button
                            type="button"
                            onClick={() => setFreelancerDialogOpen(false)}
                            className="inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-medium transition-colors hover:bg-muted cursor-pointer"
                        >
                            Selesai
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={packageDialogOpen} onOpenChange={setPackageDialogOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Paket / Layanan</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                value={packageSearchQuery}
                                onChange={(event) => setPackageSearchQuery(event.target.value)}
                                placeholder="Cari paket..."
                                className={cn(inputClass, "pl-9")}
                            />
                        </div>
                        <div className="flex items-center justify-end gap-1">
                            <button
                                type="button"
                                onClick={() => setPackageViewMode("list")}
                                className={cn(
                                    "inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
                                    packageViewMode === "list"
                                        ? "border-foreground bg-foreground/5 text-foreground"
                                        : "border-input text-muted-foreground hover:bg-muted/60",
                                )}
                                title="Tampilan baris"
                                aria-label="Tampilan baris"
                            >
                                <List className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setPackageViewMode("grid")}
                                className={cn(
                                    "inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
                                    packageViewMode === "grid"
                                        ? "border-foreground bg-foreground/5 text-foreground"
                                        : "border-input text-muted-foreground hover:bg-muted/60",
                                )}
                                title="Tampilan kotak"
                                aria-label="Tampilan kotak"
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </button>
                        </div>
                        <div
                            className={cn(
                                "max-h-[55vh] overflow-y-auto pr-1",
                                packageViewMode === "grid"
                                    ? "grid grid-cols-1 gap-2 sm:grid-cols-2"
                                    : "space-y-2",
                            )}
                        >
                            {isCityScopedEvent &&
                            !normalizedSelectedCityCode &&
                            !shouldAllowLegacyCityFallback ? (
                                <div className={cn("rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground", packageViewMode === "grid" ? "sm:col-span-2" : "")}>
                                    Pilih kota/kabupaten dulu untuk melihat paket.
                                </div>
                            ) : !eventType ? (
                                <div className={cn("rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground", packageViewMode === "grid" ? "sm:col-span-2" : "")}>
                                    Pilih tipe acara dulu untuk melihat paket.
                                </div>
                            ) : mainServices.length === 0 ? (
                                <div className={cn("rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground", packageViewMode === "grid" ? "sm:col-span-2" : "")}>
                                    Belum ada paket untuk tipe acara ini.
                                </div>
                            ) : searchedMainServices.length === 0 ? (
                                <div className={cn("rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground", packageViewMode === "grid" ? "sm:col-span-2" : "")}>
                                    Tidak ada hasil pencarian paket.
                                </div>
                            ) : (
                                searchedMainServices.map((service) => {
                                    const selected = selectedServiceIds.includes(service.id);
                                    const quantity = selectedMainQuantities[service.id] || 1;
                                    const tone = buildServiceSoftPalette({
                                        serviceColor: service.color,
                                        fallbackColor: defaultServiceColor,
                                        selected,
                                    });
                                    return (
                                        <button
                                            key={service.id}
                                            type="button"
                                            onClick={() => toggleService(service.id)}
                                            className={`flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-all cursor-pointer hover:opacity-95 ${selected ? "shadow-sm" : ""} ${packageViewMode === "grid" ? "h-full" : ""}`}
                                            style={{
                                                backgroundColor: tone.backgroundColor,
                                                borderColor: tone.borderColor,
                                                boxShadow: selected ? `0 0 0 1px ${tone.ringColor}` : undefined,
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
                                                        <p className="text-sm font-medium">{service.name}</p>
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
                                            <div className="shrink-0 text-right">
                                                <p className="text-sm font-semibold" style={{ color: tone.color }}>
                                                    {formatCurrency(service.price * quantity)}
                                                </p>
                                                {service.original_price && service.original_price > service.price ? (
                                                    <p className="text-[11px] text-muted-foreground line-through">
                                                        {formatCurrency(service.original_price * quantity)}
                                                    </p>
                                                ) : null}
                                            </div>
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
                    </DialogHeader>
                    <div className="space-y-2">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                value={addonSearchQuery}
                                onChange={(event) => setAddonSearchQuery(event.target.value)}
                                placeholder="Cari add-on..."
                                className={cn(inputClass, "pl-9")}
                            />
                        </div>
                        <div className="flex items-center justify-end gap-1">
                            <button
                                type="button"
                                onClick={() => setAddonViewMode("list")}
                                className={cn(
                                    "inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
                                    addonViewMode === "list"
                                        ? "border-foreground bg-foreground/5 text-foreground"
                                        : "border-input text-muted-foreground hover:bg-muted/60",
                                )}
                                title="Tampilan baris"
                                aria-label="Tampilan baris"
                            >
                                <List className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setAddonViewMode("grid")}
                                className={cn(
                                    "inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
                                    addonViewMode === "grid"
                                        ? "border-foreground bg-foreground/5 text-foreground"
                                        : "border-input text-muted-foreground hover:bg-muted/60",
                                )}
                                title="Tampilan kotak"
                                aria-label="Tampilan kotak"
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </button>
                        </div>
                        <div
                            className={cn(
                                "max-h-[55vh] overflow-y-auto pr-1",
                                addonViewMode === "grid"
                                    ? "grid grid-cols-1 gap-2 sm:grid-cols-2"
                                    : "space-y-2",
                            )}
                        >
                            {isCityScopedEvent &&
                            !normalizedSelectedCityCode &&
                            !shouldAllowLegacyCityFallback ? (
                                <div className={cn("rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground", addonViewMode === "grid" ? "sm:col-span-2" : "")}>
                                    Pilih kota/kabupaten dulu untuk melihat add-on.
                                </div>
                            ) : !eventType ? (
                                <div className={cn("rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground", addonViewMode === "grid" ? "sm:col-span-2" : "")}>
                                    Pilih tipe acara dulu untuk melihat add-on.
                                </div>
                            ) : addonServices.length === 0 ? (
                                <div className={cn("rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground", addonViewMode === "grid" ? "sm:col-span-2" : "")}>
                                    Belum ada add-on untuk tipe acara ini.
                                </div>
                            ) : searchedAddonServices.length === 0 ? (
                                <div className={cn("rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground", addonViewMode === "grid" ? "sm:col-span-2" : "")}>
                                    Tidak ada hasil pencarian add-on.
                                </div>
                            ) : (
                                searchedAddonServices.map((addon) => {
                                    const selected = selectedAddonIds.includes(addon.id);
                                    const quantity = selectedAddonQuantityMap[addon.id] || 1;
                                    const tone = buildServiceSoftPalette({
                                        serviceColor: addon.color,
                                        fallbackColor: defaultServiceColor,
                                        selected,
                                    });
                                    return (
                                        <button
                                            key={addon.id}
                                            type="button"
                                            onClick={() => toggleAddon(addon.id)}
                                            className={`flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-all cursor-pointer hover:opacity-95 ${selected ? "shadow-sm" : ""} ${addonViewMode === "grid" ? "h-full" : ""}`}
                                            style={{
                                                backgroundColor: tone.backgroundColor,
                                                borderColor: tone.borderColor,
                                                boxShadow: selected ? `0 0 0 1px ${tone.ringColor}` : undefined,
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
                                            <div className="shrink-0 text-right">
                                                <p className="text-sm font-semibold" style={{ color: tone.color }}>
                                                    +{formatCurrency(addon.price * quantity)}
                                                </p>
                                            </div>
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

            <Dialog open={showCustomServicePopup} onOpenChange={setShowCustomServicePopup}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> Tambah Paket Baru</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Nama Paket <span className="text-red-500">*</span></label>
                            <input value={customServiceName} onChange={e => setCustomServiceName(e.target.value)} placeholder={tBookingEditor("customPackageExampleEdit")} className={inputClass} autoFocus />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Deskripsi</label>
                            <textarea value={customServiceDesc} onChange={e => setCustomServiceDesc(e.target.value)} placeholder="Deskripsi singkat paket..." rows={2} className={textareaClass} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Harga (Rp)</label>
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-muted-foreground shrink-0">Rp</span>
                                <input type="text" inputMode="numeric" value={formatNumber(customServicePrice)} onChange={e => setCustomServicePrice(parseFormattedNumber(e.target.value))} placeholder="0" className={cn(inputClass, "flex-1")} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCustomServicePopup(false)} disabled={savingCustomService}>Batal</Button>
                        <Button onClick={saveCustomService} disabled={savingCustomService || !customServiceName.trim()}>
                            {savingCustomService ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />} Simpan & Pilih
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showCustomFreelancerPopup} onOpenChange={setShowCustomFreelancerPopup}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> Tambah Freelance Baru</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Nama <span className="text-red-500">*</span></label>
                            <input value={customFreelancerName} onChange={e => setCustomFreelancerName(e.target.value)} placeholder="Nama lengkap" className={inputClass} autoFocus />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Role <span className="text-red-500">*</span></label>
                            <select value={customFreelancerRole} onChange={e => setCustomFreelancerRole(e.target.value)} className={selectClass}>
                                <option value="Photographer">Photographer</option>
                                <option value="Videographer">Videographer</option>
                                <option value="Editor">Editor</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">WhatsApp</label>
                            <div className="flex gap-2">
                                <select value={customFreelancerCountryCode} onChange={e => setCustomFreelancerCountryCode(e.target.value)} className={selectClass + " !w-28 shrink-0"}>
                                    {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                                </select>
                                <input value={customFreelancerWa} onChange={e => {
                                    const val = e.target.value.replace(/[^0-9]/g, "");
                                    setCustomFreelancerWa(val.startsWith("0") ? val.slice(1) : val.startsWith("62") ? val.slice(2) : val);
                                }} placeholder="8123456789" className={inputClass} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCustomFreelancerPopup(false)} disabled={savingCustomFreelancer}>Batal</Button>
                        <Button onClick={saveCustomFreelancer} disabled={savingCustomFreelancer || !customFreelancerName.trim()}>
                            {savingCustomFreelancer ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />} Simpan & Pilih
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ActionFeedbackDialog
                open={feedbackDialog.open}
                onOpenChange={(open) => setFeedbackDialog((prev) => ({ ...prev, open }))}
                title={feedbackDialog.title}
                message={feedbackDialog.message}
                confirmLabel="OK"
            />

            <CancelStatusPaymentDialog
                open={cancelStatusConfirmOpen}
                onOpenChange={setCancelStatusConfirmOpen}
                bookingName={clientName}
                maxRefundAmount={Math.max(dpVerifiedAmount || 0, 0)}
                loading={saving}
                onConfirm={({ policy, refundAmount }) => {
                    void submitBookingUpdate({
                        skipCancelConfirmation: true,
                        cancelPayment: { policy, refundAmount },
                    });
                }}
            />
        </div>
        </>
    );
}
