"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { ArrowLeft, Save, Loader2, Users, CalendarClock, Wallet, StickyNote, Plus, Link2, CheckCircle2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionFeedbackDialog } from "@/components/ui/action-feedback-dialog";
import { CancelStatusPaymentDialog } from "@/components/cancel-status-payment-dialog";
import { createClient } from "@/utils/supabase/client";
import { Link } from "@/i18n/routing";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { BookingAdminCustomFields } from "@/components/form-builder/booking-admin-custom-fields";
import {
    buildCustomFieldSnapshots,
    extractCustomFieldValueMap,
    getGroupedCustomLayoutSections,
    normalizeStoredFormLayout,
    type FormLayoutItem,
} from "@/components/form-builder/booking-form-layout";
import {
    getActiveEventTypes,
    getBuiltInEventTypes,
    isShowAllPackagesEventType,
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
    getSettlementLabel,
    getSettlementStatus,
    getVerifiedDpAmount,
    normalizeFinalAdjustments,
} from "@/lib/final-settlement";
import {
    buildEditableSpecialOfferSnapshot,
    computeSpecialOfferTotal,
    mergeSpecialOfferSnapshotIntoExtraFields,
    resolveSpecialOfferSnapshotFromExtraFields,
} from "@/lib/booking-special-offer";
import {
    hasUniversityReferenceSelection,
    isUniversityExtraField,
    UNIVERSITY_REFERENCE_EXTRA_KEY,
} from "@/lib/university-references";

const inputClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";
const textareaClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-none";
const selectClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23999%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat pr-8";

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

const EXTRA_FIELDS_DEF: Record<string, { key: string; label: string; labelEn: string; isLocation?: boolean; fullWidth?: boolean; required?: boolean; isNumeric?: boolean }[]> = {
    Wisuda: [
        { key: "universitas", label: "Universitas", labelEn: "University" },
        { key: "fakultas", label: "Fakultas", labelEn: "Faculty" },
    ],
    Wedding: [
        { key: "nama_pasangan", label: "Nama Pasangan", labelEn: "Partner's Name", fullWidth: true, required: true },
        { key: "instagram_pasangan", label: "Instagram Pasangan", labelEn: "Partner's Instagram", fullWidth: true },
        { key: "jumlah_tamu", label: "Estimasi Tamu", labelEn: "Estimated Guests", fullWidth: true, isNumeric: true },
        { key: "tempat_akad", label: "Lokasi Akad", labelEn: "Akad Venue", isLocation: true, required: true },
        { key: "tempat_resepsi", label: "Lokasi Resepsi", labelEn: "Reception Venue", isLocation: true, required: true },
    ],
    Akad: [
        { key: "nama_pasangan", label: "Nama Pasangan", labelEn: "Partner's Name", fullWidth: true, required: true },
        { key: "instagram_pasangan", label: "Instagram Pasangan", labelEn: "Partner's Instagram", fullWidth: true },
        { key: "jumlah_tamu", label: "Estimasi Tamu", labelEn: "Estimated Guests", fullWidth: true, isNumeric: true },
    ],
    Resepsi: [
        { key: "nama_pasangan", label: "Nama Pasangan", labelEn: "Partner's Name", fullWidth: true, required: true },
        { key: "instagram_pasangan", label: "Instagram Pasangan", labelEn: "Partner's Instagram", fullWidth: true },
        { key: "jumlah_tamu", label: "Estimasi Tamu", labelEn: "Estimated Guests", fullWidth: true, isNumeric: true },
    ],
    Maternity: [
        { key: "usia_kehamilan", label: "Usia Kehamilan", labelEn: "Pregnancy Age" },
        { key: "gender_bayi", label: "Gender Bayi", labelEn: "Baby Gender" },
    ],
    Newborn: [
        { key: "nama_bayi", label: "Nama Bayi", labelEn: "Baby Name" },
        { key: "tanggal_lahir", label: "Tanggal Lahir", labelEn: "Date of Birth" },
    ],
    Komersil: [
        { key: "nama_brand", label: "Nama Brand", labelEn: "Brand Name" },
        { key: "tipe_konten", label: "Tipe Konten", labelEn: "Content Type" },
    ],
    Family: [{ key: "jumlah_anggota", label: "Jumlah Anggota", labelEn: "Members" }],
    Lamaran: [
        { key: "nama_pasangan", label: "Nama Pasangan", labelEn: "Partner's Name", fullWidth: true, required: true },
        { key: "instagram_pasangan", label: "Instagram Pasangan", labelEn: "Partner's Instagram", fullWidth: true },
        { key: "jumlah_tamu", label: "Estimasi Tamu", labelEn: "Estimated Guests", fullWidth: true, isNumeric: true },
    ],
    Prewedding: [
        { key: "nama_pasangan", label: "Nama Pasangan", labelEn: "Partner's Name", fullWidth: true, required: true },
        { key: "instagram_pasangan", label: "Instagram Pasangan", labelEn: "Partner's Instagram", fullWidth: true },
    ],
};

type Service = {
    id: string;
    name: string;
    price: number;
    original_price?: number | null;
    description?: string | null;
    is_addon?: boolean | null;
    is_public?: boolean | null;
    sort_order?: number | null;
    event_types?: string[] | null;
};
type Freelance = { id: string; name: string; google_email?: string | null };
type LocationCoords = { lat: number | null; lng: number | null };
type ProfileRow = {
    custom_client_statuses?: string[] | null;
    dp_verify_trigger_status?: string | null;
    form_sections?: unknown;
    form_event_types?: string[] | null;
    custom_event_types?: unknown;
};

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

function isServiceAvailableForEvent(service: Service, eventType: string) {
    if (!eventType) return false;
    if (isShowAllPackagesEventType(eventType)) return true;
    if (!service.event_types || service.event_types.length === 0) return true;
    const normalizedEventType = normalizeEventTypeName(eventType);
    if (!normalizedEventType) return false;
    return service.event_types.some(
        (serviceEventType) =>
            normalizeEventTypeName(serviceEventType) === normalizedEventType,
    );
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

export default function EditBookingPage() {
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();
    const locale = useLocale();
    const supabase = createClient();

    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [calendarWarning, setCalendarWarning] = React.useState<string | null>(null);
    const [services, setServices] = React.useState<Service[]>([]);
    const [freelancers, setFreelancers] = React.useState<Freelance[]>([]);
    const [eventTypeOptions, setEventTypeOptions] = React.useState<string[]>(EVENT_TYPES);

    const [clientName, setClientName] = React.useState("");
    const [countryCode, setCountryCode] = React.useState("+62");
    const [phoneNumber, setPhoneNumber] = React.useState("");
    const [instagram, setInstagram] = React.useState("");
    const [eventType, setEventType] = React.useState("Umum");
    const [bookingDate, setBookingDate] = React.useState("");
    const [createdAtDateFallback, setCreatedAtDateFallback] = React.useState("");
    const [sessionDate, setSessionDate] = React.useState("");
    const [location, setLocation] = React.useState("");
    const [locationCoords, setLocationCoords] = React.useState<LocationCoords>({ lat: null, lng: null });
    const [locationDetail, setLocationDetail] = React.useState("");
    const [selectedServiceIds, setSelectedServiceIds] = React.useState<string[]>([]);
    const [selectedAddonIds, setSelectedAddonIds] = React.useState<string[]>([]);
    const [packageDialogOpen, setPackageDialogOpen] = React.useState(false);
    const [addonDialogOpen, setAddonDialogOpen] = React.useState(false);
    const [packageSearchQuery, setPackageSearchQuery] = React.useState("");
    const [addonSearchQuery, setAddonSearchQuery] = React.useState("");
    const [freelancerIds, setFreelancerIds] = React.useState<string[]>([]);
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
    const [finalPaymentAmount, setFinalPaymentAmount] = React.useState(0);
    const [finalPaidAt, setFinalPaidAt] = React.useState<string | null>(null);
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
    const [portfolioUrl, setPortfolioUrl] = React.useState("");
    const [extraFields, setExtraFields] = React.useState<Record<string, string>>({});
    const [extraLocationCoords, setExtraLocationCoords] = React.useState<Record<string, LocationCoords>>({});
    const [customFieldValues, setCustomFieldValues] = React.useState<Record<string, string>>({});
    const [formSectionsByEventType, setFormSectionsByEventType] = React.useState<Record<string, FormLayoutItem[]>>({});
    const [splitDates, setSplitDates] = React.useState(false);
    const [akadDate, setAkadDate] = React.useState("");
    const [resepsiDate, setResepsiDate] = React.useState("");

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

    const showFeedback = React.useCallback((message: string, title?: string) => {
        setFeedbackDialog({
            open: true,
            title: title || (locale === "en" ? "Information" : "Informasi"),
            message,
        });
    }, [locale]);
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

    React.useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const [{ data: booking }, { data: svcs }, { data: frees }, { data: bfRows }, { data: bsRows }, { data: prof }] = await Promise.all([
                supabase.from("bookings").select("*").eq("id", id).single(),
                supabase.from("services").select("id, name, price, original_price, description, is_addon, is_public, sort_order, event_types").eq("user_id", user.id).eq("is_active", true),
                supabase.from("freelance").select("id, name, google_email").eq("user_id", user.id).eq("status", "active"),
                supabase.from("booking_freelance").select("freelance_id").eq("booking_id", id),
                supabase.from("booking_services").select("service_id, kind, sort_order").eq("booking_id", id).order("sort_order", { ascending: true }),
                supabase.from("profiles").select("custom_client_statuses, dp_verify_trigger_status, form_sections, form_event_types, custom_event_types").eq("id", user.id).single(),
            ]);
            const profileRow = (prof ?? null) as ProfileRow | null;
            const nextStatusOptions = getBookingStatusOptions(profileRow?.custom_client_statuses as string[] | null | undefined);
            setStatusOptions(nextStatusOptions);
            setDpVerifyTriggerStatus(profileRow?.dp_verify_trigger_status ?? "");
            setEventTypeOptions(getActiveEventTypes({
                customEventTypes: normalizeEventTypeList(profileRow?.custom_event_types),
                activeEventTypes: profileRow?.form_event_types,
            }));
            const rawSections = (prof as Record<string, unknown> | null)?.form_sections;
            if (Array.isArray(rawSections)) {
                setFormSectionsByEventType({ Umum: normalizeStoredFormLayout(rawSections, "Umum") });
            } else if (rawSections && typeof rawSections === "object") {
                setFormSectionsByEventType(
                    Object.entries(rawSections as Record<string, unknown>).reduce(
                        (acc, [key, value]) => {
                            const normalizedKey = normalizeEventTypeName(key) || key;
                            if (!(normalizedKey in acc) || key === normalizedKey) {
                                acc[normalizedKey] = normalizeStoredFormLayout(value, normalizedKey);
                            }
                            return acc;
                        },
                        {} as Record<string, FormLayoutItem[]>,
                    ),
                );
            }
            if (booking) {
                setClientName(booking.client_name || "");
                const parsed = parseExistingPhone(booking.client_whatsapp);
                setCountryCode(parsed.code);
                setPhoneNumber(parsed.number);
                setInstagram(booking.instagram || "");
                setEventType(normalizeEventTypeName(booking.event_type) || "Umum");
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
                const bookingServices = (bsRows || []) as Array<{ service_id: string; kind: string }>;
                const selectedMainIds = bookingServices.filter((row) => row.kind === "main").map((row) => row.service_id);
                const selectedAddons = bookingServices.filter((row) => row.kind === "addon").map((row) => row.service_id);
                setSelectedServiceIds(selectedMainIds.length > 0 ? selectedMainIds : booking.service_id ? [booking.service_id] : []);
                if (selectedAddons.length > 0) {
                    setSelectedAddonIds(selectedAddons);
                } else {
                    const legacyAddonIds = Array.isArray(booking.extra_fields?.addon_ids)
                        ? booking.extra_fields.addon_ids.filter((id: unknown): id is string => typeof id === "string")
                        : [];
                    setSelectedAddonIds(legacyAddonIds);
                }
                // Load multi-freelancer from junction table, fallback to old column
                const junctionIds = ((bfRows || []) as Array<{ freelance_id: string | null }>)
                    .map((row) => row.freelance_id)
                    .filter((freelanceId): freelanceId is string => Boolean(freelanceId));
                setFreelancerIds(junctionIds.length > 0 ? junctionIds : booking.freelance_id ? [booking.freelance_id] : []);
                const existingSpecialOffer = resolveSpecialOfferSnapshotFromExtraFields(booking.extra_fields);
                setDpPaid(booking.dp_paid || "");
                setAccommodationFee(existingSpecialOffer?.accommodation_fee ?? "");
                setDiscountAmount(existingSpecialOffer?.discount_amount ?? "");
                setInitialDpPaid(Number(booking.dp_paid) || 0);
                setDpVerifiedAmount(Number((booking as Record<string, unknown>).dp_verified_amount) || 0);
                setDpVerifiedAt(((booking as Record<string, unknown>).dp_verified_at as string | null) || null);
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
                setFinalPaymentAmount(Number((booking as Record<string, unknown>).final_payment_amount) || 0);
                setFinalPaidAt(((booking as Record<string, unknown>).final_paid_at as string | null) || null);
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
                }
                setExtraLocationCoords(seededExtraCoords);
                setCustomFieldValues(extractCustomFieldValueMap(booking.extra_fields));
                // Pre-populate splitDates from extra_fields
                if (booking.event_type === "Wedding" && booking.extra_fields?.tanggal_akad) {
                    setSplitDates(true);
                    setAkadDate(booking.extra_fields.tanggal_akad || "");
                    setResepsiDate(booking.extra_fields.tanggal_resepsi || "");
                }
            }
            setServices(((svcs || []) as Service[]).sort(compareServicesByCatalogOrder));
            setFreelancers((frees || []) as Freelance[]);
            setLoading(false);
        }
        load();
    }, [id, supabase]);

    const sortedServices = React.useMemo(
        () => [...services].sort(compareServicesByCatalogOrder),
        [services],
    );
    const mainServices = React.useMemo(
        () => sortedServices.filter((service) => !service.is_addon && isServiceAvailableForEvent(service, eventType)),
        [eventType, sortedServices],
    );
    const addonServices = React.useMemo(
        () => sortedServices.filter((service) => service.is_addon && isServiceAvailableForEvent(service, eventType)),
        [eventType, sortedServices],
    );
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
    const selectedMainServices = React.useMemo(
        () => mainServices.filter((service) => selectedServiceIds.includes(service.id)),
        [mainServices, selectedServiceIds],
    );
    const selectedAddonServices = React.useMemo(
        () => addonServices.filter((service) => selectedAddonIds.includes(service.id)),
        [addonServices, selectedAddonIds],
    );
    const toggleService = (serviceId: string) => {
        setSelectedServiceIds((prev) =>
            prev.includes(serviceId)
                ? prev.filter((item) => item !== serviceId)
                : [...prev, serviceId],
        );
    };
    const toggleAddon = (serviceId: string) => {
        setSelectedAddonIds((prev) =>
            prev.includes(serviceId)
                ? prev.filter((item) => item !== serviceId)
                : [...prev, serviceId],
        );
    };
    React.useEffect(() => {
        setSelectedServiceIds((prev) =>
            prev.filter((id) => mainServices.some((service) => service.id === id)),
        );
    }, [mainServices]);
    React.useEffect(() => {
        setSelectedAddonIds((prev) =>
            prev.filter((id) => addonServices.some((service) => service.id === id)),
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

    const activeCustomLayoutSections = React.useMemo(() => {
        const rawLayout =
            formSectionsByEventType[eventType] ||
            formSectionsByEventType.Umum ||
            [];
        return getGroupedCustomLayoutSections(rawLayout, eventType);
    }, [eventType, formSectionsByEventType]);

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
            sort_order: services.filter((service) => !service.is_addon).length,
        }).select("id, name, price, original_price, description, is_addon, is_public, sort_order, event_types").single();
        if (!error && data) {
            const s = data as Service;
            setServices(prev => [...prev, s].sort(compareServicesByCatalogOrder));
            setSelectedServiceIds(prev => (prev.includes(s.id) ? prev : [...prev, s.id]));
            setCustomServiceName(""); setCustomServicePrice(""); setCustomServiceDesc("");
            setShowCustomServicePopup(false);
        } else { showFeedback("Gagal menyimpan paket."); }
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
        }).select("id, name").single();
        if (!error && data) {
            const f = data as Freelance;
            setFreelancers(prev => [...prev, f]);
            setFreelancerIds(prev => prev.length < 5 ? [...prev, f.id] : prev);
            setCustomFreelancerName(""); setCustomFreelancerWa(""); setCustomFreelancerRole("Photographer"); setCustomFreelancerCountryCode("+62");
            setShowCustomFreelancerPopup(false);
        } else { console.error(error); showFeedback("Gagal menyimpan freelance."); }
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

        if (eventType === "Wedding" && (!extraFields.tempat_akad || !extraFields.tempat_resepsi)) {
            showFeedback("Lokasi Akad dan Lokasi Resepsi wajib diisi untuk acara Wedding.");
            setSaving(false);
            return;
        }
        if (selectedServiceIds.length === 0) {
            showFeedback("Pilih minimal satu paket utama.");
            setSaving(false);
            return;
        }
        if (!hasUniversityReferenceSelection(extraFields, eventType)) {
            showFeedback("Silakan pilih universitas dari suggestion yang tersedia.");
            setSaving(false);
            return;
        }

        const fullPhone = phoneNumber ? `${countryCode}${sanitizePhone(phoneNumber)}` : null;
        const packageTotalValue = selectedMainServices.reduce(
            (sum, service) => sum + (service.price || 0),
            0,
        );
        const addonTotalValue = selectedAddonServices.reduce(
            (sum, service) => sum + (service.price || 0),
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
        const dPaid = parseFloat(dpPaid.toString()) || 0;

        // Determine session_date: if split, use earliest; merge extra_fields with dates
        let finalSessionDate = sessionDate || null;
        const mergedExtra = { ...extraFields };
        if (eventType === "Wedding" && splitDates) {
            mergedExtra.tanggal_akad = akadDate || "";
            mergedExtra.tanggal_resepsi = resepsiDate || "";
            if (akadDate && resepsiDate) {
                finalSessionDate = akadDate < resepsiDate ? akadDate : resepsiDate;
            } else {
                finalSessionDate = akadDate || resepsiDate || null;
            }
        } else if (eventType === "Wedding" && !splitDates) {
            // Toggled off: remove split date fields
            delete mergedExtra.tanggal_akad;
            delete mergedExtra.tanggal_resepsi;
        }
        const customFieldSnapshots = buildCustomFieldSnapshots(
            formSectionsByEventType[eventType] || formSectionsByEventType.Umum || [],
            eventType,
            customFieldValues,
        );
        const existingSpecialOffer = resolveSpecialOfferSnapshotFromExtraFields(
            baseExtraFieldsObject,
        );
        const nextSpecialOffer = buildEditableSpecialOfferSnapshot({
            existingSnapshot: existingSpecialOffer,
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
                    typeof value !== "string",
            ),
        ) as Record<string, unknown>;
        const nextExtraFieldsPayload = mergeSpecialOfferSnapshotIntoExtraFields({
            ...preservedStructuredExtraFields,
            ...mergedExtra,
            ...(customFieldSnapshots.length > 0
                ? { custom_fields: customFieldSnapshots }
                : {}),
        }, nextSpecialOffer);
        const resolvedLocation = resolvePreferredLocation(
            eventType === "Wedding"
                ? [
                    {
                        address: extraFields.tempat_akad,
                        lat: extraLocationCoords.tempat_akad?.lat,
                        lng: extraLocationCoords.tempat_akad?.lng,
                    },
                    {
                        address: extraFields.tempat_resepsi,
                        lat: extraLocationCoords.tempat_resepsi?.lat,
                        lng: extraLocationCoords.tempat_resepsi?.lng,
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
        const verifiedDpResetPatch = shouldResetVerifiedDp
            ? {
                dp_verified_amount: 0,
                dp_verified_at: null,
                dp_refund_amount: 0,
                dp_refunded_at: null,
            }
            : {};
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
            freelance_id: freelancerIds[0] || null,
            total_price: tPrice,
            dp_paid: dPaid,
            is_fully_paid: dPaid >= tPrice && tPrice > 0,
            ...verifiedDpResetPatch,
            status: nextStatus,
            client_status: nextStatus,
            ...(cancelPatch || {}),
            ...(autoDpPatch || {}),
            notes: notes || null,
            admin_notes: adminNotes || null,
            drive_folder_url: driveFolderUrl || null,
            portfolio_url: portfolioUrl || null,
            extra_fields: nextExtraFieldsPayload,
            updated_at: new Date().toISOString(),
        }).eq("id", id);
        setSaving(false);

        if (error) {
            showFeedback("Gagal menyimpan perubahan.");
            return;
        }

        // Sync junction table
        await supabase.from("booking_freelance").delete().eq("booking_id", id);
        await supabase.from("booking_services").delete().eq("booking_id", id);
        const bookingServiceRows = [
            ...selectedServiceIds.map((serviceId, index) => ({
                booking_id: id,
                service_id: serviceId,
                kind: "main" as const,
                sort_order: index,
            })),
            ...selectedAddonIds.map((serviceId, index) => ({
                booking_id: id,
                service_id: serviceId,
                kind: "addon" as const,
                sort_order: index,
            })),
        ];
        if (bookingServiceRows.length > 0) {
            await supabase.from("booking_services").insert(
                bookingServiceRows,
            );
        }
        if (freelancerIds.length > 0) {
            await supabase.from("booking_freelance").insert(
                freelancerIds.map((freelancerId) => ({ booking_id: id, freelance_id: freelancerId })),
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
                        .filter((freelancer) => freelancerIds.includes(freelancer.id))
                        .map((freelancer) => freelancer.google_email)
                        .filter((email): email is string => Boolean(email));
                    const noEmailNames = freelancers
                        .filter((freelancer) => freelancerIds.includes(freelancer.id) && !freelancer.google_email)
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
                        setCalendarWarning(`⚠️ Booking tersimpan, tetapi sinkronisasi Google Calendar gagal: ${err.error || "Google Calendar belum terkoneksi"}`);
                        setTimeout(() => setCalendarWarning(null), 5000);
                    } else if (noEmailNames.length > 0) {
                        setCalendarWarning(`⚠️ Invite tim belum lengkap: ${noEmailNames.join(", ")} belum punya Google Email`);
                        setTimeout(() => setCalendarWarning(null), 5000);
                    }
                } catch {
                    setCalendarWarning("⚠️ Booking tersimpan, tetapi sinkronisasi Google Calendar gagal dijalankan.");
                    setTimeout(() => setCalendarWarning(null), 5000);
                }
            } else if (freelancerIds.length > 0) {
                setCalendarWarning("⚠️ Calendar invite tidak terkirim: jadwal sesi belum diisi");
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
        if (shouldResetVerifiedDp) {
            setDpVerifiedAmount(0);
            setDpVerifiedAt(null);
            setDpRefundAmount(0);
            setDpRefundedAt(null);
        }
        setCancelStatusConfirmOpen(false);
        void triggerFastpikAutoSync(id);
        router.push(`/${locale}/bookings/${id}`);
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
        const patch = {
            dp_verified_amount: dpValue,
            dp_verified_at: verifiedAt,
            dp_refund_amount: 0,
            dp_refunded_at: null,
        };

        const { error } = await supabase.from("bookings").update(patch).eq("id", id);
        setMarkingDpVerified(false);

        if (error) {
            showFeedback("Gagal menandai DP sebagai terverifikasi.");
            return;
        }

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
        };
        const { error } = await supabase.from("bookings").update(patch).eq("id", id);
        setMarkingDpUnverified(false);

        if (error) {
            showFeedback("Gagal membatalkan verifikasi DP.");
            return;
        }

        setDpVerifiedAmount(0);
        setDpVerifiedAt(null);
        setDpRefundAmount(0);
        setDpRefundedAt(null);
    }

    const packageTotalValue = selectedMainServices.reduce(
        (sum, service) => sum + (service.price || 0),
        0,
    );
    const addonTotalValue = selectedAddonServices.reduce(
        (sum, service) => sum + (service.price || 0),
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
    const fullyPaidByCurrentDp = dpPaidValue >= totalPriceValue && totalPriceValue > 0;
    const normalizedFinalAdjustments = normalizeFinalAdjustments(finalAdjustmentsRaw);
    const finalAdjustmentsTotal = getFinalAdjustmentsTotal(normalizedFinalAdjustments);
    const finalInvoiceTotal = getFinalInvoiceTotal(totalPriceValue, normalizedFinalAdjustments);
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
        is_fully_paid: isFullyPaid || fullyPaidByCurrentDp,
    };
    const verifiedDpAmount = getVerifiedDpAmount(verifiedPaymentInput);
    const resolvedDpRefundAmount = getDpRefundAmount(verifiedPaymentInput);
    const verifiedFinalPayment = finalPaidAt ? finalPaymentAmount || 0 : 0;
    const netVerifiedRevenue = getNetVerifiedRevenueAmount(verifiedPaymentInput);
    const remainingPayment = getRemainingFinalPayment(verifiedPaymentInput);
    const initialPaymentStatus = fullyPaidByCurrentDp || isFullyPaid
        ? "Lunas"
        : verifiedDpAmount > 0
            ? "DP Terverifikasi"
            : dpPaidValue > 0
                ? "DP Menunggu Verifikasi"
                : "Belum Dibayar";
    const settlementStatus = getSettlementStatus(settlementStatusValue);
    const initialPriceBreakdown = {
        packageTotal: packageTotalValue,
        addonTotal: addonTotalValue,
        accommodationFee: accommodationFeeValue,
        discountAmount: discountAmountValue,
    };

    const currentExtraFields = EXTRA_FIELDS_DEF[eventType] || [];
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
                <Link href={`/bookings/${id}`}>
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
                            <input required value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nama klien" className={inputClass} />
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
                            {currentExtraFields.map(f => (
                                <div key={f.key} className={`space-y-1.5 ${f.isLocation || f.fullWidth || currentExtraFields.length === 1 ? "col-span-full" : ""}`}>
                                    <label className="text-xs font-medium text-muted-foreground">{locale === "id" ? f.label : f.labelEn}{f.required && <span className="text-red-500 ml-0.5">*</span>}</label>
                                    {isUniversityExtraField({
                                        eventType,
                                        fieldKey: f.key,
                                    }) ? (
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
                                            placeholder={locale === "en" ? "Search university..." : "Cari universitas..."}
                                            required={f.required}
                                            allowManualCreate
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
                                            placeholder={`Cari lokasi ${f.label.toLowerCase()}...`}
                                            initialLat={extraLocationCoords[f.key]?.lat ?? null}
                                            initialLng={extraLocationCoords[f.key]?.lng ?? null}
                                        />
                                    ) : f.isNumeric ? (
                                        <input placeholder={f.label} value={extraFields[f.key] || ""} onChange={e => {
                                            const raw = e.target.value.replace(/[^0-9]/g, "");
                                            const num = parseInt(raw, 10);
                                            setExtraFields(prev => ({ ...prev, [f.key]: raw === "" ? "" : new Intl.NumberFormat("id-ID").format(num) }));
                                        }} className={inputClass} required={f.required} inputMode="numeric" />
                                    ) : (
                                        <input placeholder={f.label} value={extraFields[f.key] || ""} onChange={e => setExtraFields(prev => ({ ...prev, [f.key]: e.target.value }))} className={inputClass} required={f.required} />
                                    )}
                                </div>
                            ))}
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
                        <CalendarClock className="w-4 h-4" /> Detail Sesi
                    </h3>
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                        <div className="col-span-full space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Tipe Acara{reqMark}</label>
                            <select value={eventType} onChange={e => { setEventType(e.target.value); setExtraFields({}); setExtraLocationCoords({}); setCustomFieldValues({}); setPackageSearchQuery(""); setAddonSearchQuery(""); }} className={selectClass} required>
                                {eventTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="col-span-full space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Tanggal Booking</label>
                            <input
                                type="date"
                                value={bookingDate}
                                onChange={e => setBookingDate(e.target.value)}
                                className={cn(inputClass, "block")}
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Dipakai untuk urutan Booking Terbaru/Terlama.
                            </p>
                        </div>

                        {/* Wedding split dates toggle */}
                        {eventType === "Wedding" && (
                            <div className="col-span-full flex items-center gap-3">
                                <button type="button" onClick={() => setSplitDates(!splitDates)}
                                    className={cn("relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors", splitDates ? "bg-primary" : "bg-muted-foreground/30")}
                                >
                                    <span className={cn("pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform", splitDates ? "translate-x-4" : "translate-x-0")} />
                                </button>
                                <span className="text-xs font-medium text-muted-foreground">Akad &amp; Resepsi beda hari</span>
                            </div>
                        )}

                        {eventType === "Wedding" && splitDates ? (
                            <>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Tanggal Akad{reqMark}</label>
                                    <input type="date" value={akadDate ? akadDate.split("T")[0] : ""} onChange={e => {
                                        const timePart = akadDate?.split("T")[1] || "10:00";
                                        setAkadDate(e.target.value ? `${e.target.value}T${timePart}` : "");
                                    }} required className={cn(inputClass, "block")} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Jam Akad{reqMark}</label>
                                    <input type="time" value={akadDate ? akadDate.split("T")[1] || "10:00" : ""} onChange={e => {
                                        const datePart = akadDate?.split("T")[0] || "";
                                        if (datePart) setAkadDate(`${datePart}T${e.target.value}`);
                                    }} className={cn(inputClass, "block")} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Tanggal Resepsi{reqMark}</label>
                                    <input type="date" value={resepsiDate ? resepsiDate.split("T")[0] : ""} onChange={e => {
                                        const timePart = resepsiDate?.split("T")[1] || "10:00";
                                        setResepsiDate(e.target.value ? `${e.target.value}T${timePart}` : "");
                                    }} required className={cn(inputClass, "block")} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Jam Resepsi{reqMark}</label>
                                    <input type="time" value={resepsiDate ? resepsiDate.split("T")[1] || "10:00" : ""} onChange={e => {
                                        const datePart = resepsiDate?.split("T")[0] || "";
                                        if (datePart) setResepsiDate(`${datePart}T${e.target.value}`);
                                    }} className={cn(inputClass, "block")} />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Tanggal{reqMark}</label>
                                    <input type="date" value={sessionDate ? sessionDate.split("T")[0] : ""} onChange={e => {
                                        const timePart = sessionDate?.split("T")[1] || "10:00";
                                        setSessionDate(e.target.value ? `${e.target.value}T${timePart}` : "");
                                    }} required className={cn(inputClass, "block")} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Jam{reqMark}</label>
                                    <input type="time" value={sessionDate ? sessionDate.split("T")[1] || "10:00" : ""} onChange={e => {
                                        const datePart = sessionDate?.split("T")[0] || "";
                                        if (datePart) setSessionDate(`${datePart}T${e.target.value}`);
                                    }} className={cn(inputClass, "block")} />
                                </div>
                            </>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Status{reqMark}</label>
                            <select value={status} onChange={e => setStatus(e.target.value)} className={selectClass} required>
                                {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        {eventType !== "Wedding" && (
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
                                    placeholder="Cari lokasi sesi foto..."
                                    initialLat={locationCoords.lat}
                                    initialLng={locationCoords.lng}
                                />
                            </div>
                        )}
                        <div className="col-span-full space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Detail Lokasi</label>
                            <input value={locationDetail} onChange={e => setLocationDetail(e.target.value)} placeholder="Contoh: Gedung Utama, Lt. 3, Ruang Ballroom A" className={inputClass} />
                        </div>
                        <div className="col-span-full space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Paket / Layanan{reqMark}</label>
                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={() => setPackageDialogOpen(true)}
                                    className="flex w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all hover:bg-muted/30 cursor-pointer"
                                >
                                    <span className="text-left">
                                        {selectedMainServices.length > 0
                                            ? `${selectedMainServices.length} paket dipilih`
                                            : "Pilih Paket / Layanan"}
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
                                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                                    {selectedMainServices.map((service) => (
                                        <div key={service.id} className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium">{service.name}</p>
                                                {service.description ? (
                                                    <p className="text-xs text-muted-foreground">{service.description}</p>
                                                ) : null}
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <p className="text-lg font-bold text-primary">{formatCurrency(service.price)}</p>
                                                {service.original_price && service.original_price > service.price ? (
                                                    <p className="text-[11px] text-muted-foreground line-through">{formatCurrency(service.original_price)}</p>
                                                ) : null}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="col-span-full space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Add-on (opsional)</label>
                            <button
                                type="button"
                                onClick={() => setAddonDialogOpen(true)}
                                disabled={addonServices.length === 0}
                                className="flex w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all hover:bg-muted/30 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <span className="text-left">
                                    {selectedAddonServices.length > 0
                                        ? `${selectedAddonServices.length} add-on dipilih`
                                        : "Pilih Add-on"}
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
                                    {selectedAddonServices.map((addon) => (
                                        <div
                                            key={addon.id}
                                            className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm"
                                        >
                                            <div className="min-w-0">
                                                <p className="font-medium">{addon.name}</p>
                                                {addon.description ? (
                                                    <p className="text-[11px] text-muted-foreground truncate">
                                                        {addon.description}
                                                    </p>
                                                ) : null}
                                            </div>
                                            <span className="font-semibold text-primary whitespace-nowrap">
                                                +{formatCurrency(addon.price)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {selectedAddonServices.length > 0 && selectedMainServices.length > 0 && (
                                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                                    {selectedMainServices.map((service) => (
                                        <div key={service.id} className="flex justify-between">
                                            <span>{service.name}</span>
                                            <span>{formatCurrency(service.price)}</span>
                                        </div>
                                    ))}
                                    {selectedAddonServices.map((service) => (
                                        <div key={service.id} className="flex justify-between text-muted-foreground">
                                            <span>+ {service.name}</span>
                                            <span>{formatCurrency(service.price)}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between font-bold border-t pt-1 mt-1">
                                        <span>Total</span>
                                        <span>{formatCurrency(totalPriceValue)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="col-span-full space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Freelance (max 5)</label>
                            <div className="flex flex-wrap gap-2">
                                {freelancers.map(f => (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => toggleFreelancer(f.id)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer",
                                            freelancerIds.includes(f.id)
                                                ? "border-foreground bg-foreground/5 dark:bg-foreground/10 text-foreground"
                                                : "border-input text-muted-foreground hover:bg-muted/50"
                                        )}
                                    >
                                        {f.name}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setShowCustomFreelancerPopup(true)}
                                    className="px-3 py-1.5 rounded-lg border border-dashed border-input text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer"
                                >
                                    ＋ Tambah Baru
                                </button>
                            </div>
                            {freelancerIds.length > 0 && (
                                <p className="text-[10px] text-muted-foreground">{freelancerIds.length}/5 dipilih</p>
                            )}
                        </div>
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
                            <label className="text-xs font-medium text-muted-foreground">DP Dibayar{reqMark}</label>
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-muted-foreground shrink-0">Rp</span>
                                <input required type="text" inputMode="numeric" value={formatNumber(dpPaid)} onChange={e => setDpPaid(parseFormattedNumber(e.target.value))} placeholder="0" className={cn(inputClass, "flex-1")} />
                            </div>
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
                                <span className="font-semibold text-green-700 dark:text-green-400">Total Terverifikasi Bersih</span>
                                <span className="font-semibold text-green-700 dark:text-green-400">{formatCurrency(netVerifiedRevenue)}</span>
                            </div>
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
                    <textarea rows={4} value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="Catatan internal admin (tidak tampil ke klien/freelance)..." className={textareaClass} />
                </div>

                {/* Link Google Drive */}
                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-3">
                    <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Link2 className="w-4 h-4" /> Link Google Drive
                    </h3>
                    <input type="url" value={driveFolderUrl} onChange={e => setDriveFolderUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/..." className={inputClass} />
                    <p className="text-[11px] text-muted-foreground">Tempelkan link folder Google Drive klien di sini (opsional).</p>
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
                    <Link href={`/bookings/${id}`}><Button type="button" variant="ghost" className="text-muted-foreground hover:text-foreground">Batal</Button></Link>
                    <Button type="submit" disabled={saving || !canWriteBookings} className="gap-2 bg-foreground text-background hover:bg-foreground/90 px-8">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Simpan Perubahan
                    </Button>
                </div>
            </form>

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
                        <div className="max-h-[55vh] overflow-y-auto space-y-2 pr-1">
                            {mainServices.length === 0 ? (
                                <div className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
                                    Belum ada paket untuk tipe acara ini.
                                </div>
                            ) : searchedMainServices.length === 0 ? (
                                <div className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
                                    Tidak ada hasil pencarian paket.
                                </div>
                            ) : (
                                searchedMainServices.map((service) => {
                                    const selected = selectedServiceIds.includes(service.id);
                                    return (
                                        <button
                                            key={service.id}
                                            type="button"
                                            onClick={() => toggleService(service.id)}
                                            className={`flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-all cursor-pointer ${selected ? "border-primary bg-primary/5" : "border-input hover:bg-muted/30"}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <span className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30 text-transparent"}`}>
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium">{service.name}</p>
                                                    {service.description ? (
                                                        <p className="text-[11px] text-muted-foreground">
                                                            {service.description}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <p className="text-sm font-semibold text-primary">
                                                    {formatCurrency(service.price)}
                                                </p>
                                                {service.original_price && service.original_price > service.price ? (
                                                    <p className="text-[11px] text-muted-foreground line-through">
                                                        {formatCurrency(service.original_price)}
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
                        <div className="max-h-[55vh] overflow-y-auto space-y-2 pr-1">
                            {addonServices.length === 0 ? (
                                <div className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
                                    Belum ada add-on untuk tipe acara ini.
                                </div>
                            ) : searchedAddonServices.length === 0 ? (
                                <div className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
                                    Tidak ada hasil pencarian add-on.
                                </div>
                            ) : (
                                searchedAddonServices.map((addon) => {
                                    const selected = selectedAddonIds.includes(addon.id);
                                    return (
                                        <button
                                            key={addon.id}
                                            type="button"
                                            onClick={() => toggleAddon(addon.id)}
                                            className={`flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-all cursor-pointer ${selected ? "border-primary bg-primary/5" : "border-input hover:bg-muted/30"}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <span className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30 text-transparent"}`}>
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium">{addon.name}</p>
                                                    {addon.description ? (
                                                        <p className="text-[11px] text-muted-foreground">
                                                            {addon.description}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <p className="text-sm font-semibold text-primary">
                                                    +{formatCurrency(addon.price)}
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
                            <input value={customServiceName} onChange={e => setCustomServiceName(e.target.value)} placeholder="Contoh: Paket Gold" className={inputClass} autoFocus />
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
                                <option value="MUA">MUA</option>
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
