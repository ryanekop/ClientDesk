"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Save, Loader2, Users, CalendarClock, Wallet, StickyNote, Plus, Link2, CheckCircle2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionFeedbackDialog } from "@/components/ui/action-feedback-dialog";
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
import { CitySingleSelect } from "@/components/ui/city-single-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { BookingAdminCustomFields } from "@/components/form-builder/booking-admin-custom-fields";
import {
    buildCustomFieldSnapshots,
    getGroupedCustomLayoutSections,
    resolveNormalizedActiveFormLayout,
    type FormLayoutItem,
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
} from "@/lib/client-status";
import { createBookingCode, isDuplicateBookingCodeError } from "@/lib/booking-code";
import { resolvePreferredLocation } from "@/utils/location";
import {
    buildEditableSpecialOfferSnapshot,
    computeSpecialOfferTotal,
    mergeSpecialOfferSnapshotIntoExtraFields,
} from "@/lib/booking-special-offer";
import {
    getUniversityReferenceId,
    hasUniversityValue,
    UNIVERSITY_EXTRA_FIELD_KEY,
    UNIVERSITY_REFERENCE_EXTRA_KEY,
} from "@/lib/university-references";
import { normalizeFormSectionsByEventType } from "@/lib/form-sections";
import {
    getBookingDurationMinutes,
    type BookingServiceSelection,
} from "@/lib/booking-services";
import {
    buildWisudaSessionDurationOverride,
    getWisudaSessionDurationExtraFieldKey,
} from "@/lib/wisuda-session-duration";
import {
    buildCityDisplayName,
    normalizeCityCode,
    type CityReferenceItem,
} from "@/lib/city-references";
import { filterServicesForBookingSelection } from "@/lib/service-availability";
import { buildServiceSoftPalette, resolveHexColor } from "@/lib/service-colors";

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

const EXTRA_FIELDS: Record<string, ExtraFieldDefinition[]> = {
    Wisuda: [
        { key: "universitas", labelKey: "university" },
        { key: "fakultas", labelKey: "faculty" },
        { key: "tempat_wisuda_1", labelKey: "wisudaSession1Venue", isLocation: true },
        { key: "tempat_wisuda_2", labelKey: "wisudaSession2Venue", isLocation: true },
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
};
type Freelance = { id: string; name: string; google_email?: string | null };
type LocationCoords = { lat: number | null; lng: number | null };
type ProfileRow = {
    custom_client_statuses?: string[] | null;
    form_sections?: unknown;
    form_event_types?: string[] | null;
    custom_event_types?: unknown;
    form_brand_color?: string | null;
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

function sanitizePhone(raw: string): string {
    // Strip leading 0, +62, 62
    let cleaned = raw.replace(/[^0-9]/g, "");
    if (cleaned.startsWith("62")) cleaned = cleaned.slice(2);
    if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
    return cleaned;
}

function sanitizeDurationInput(value: string) {
    return value.replace(/\D+/g, "");
}

const WISUDA_SESSION_DURATION_EXTRA_FIELD_KEY =
    getWisudaSessionDurationExtraFieldKey();

function compareServicesByCatalogOrder(a: Service, b: Service) {
    const aSort = typeof a.sort_order === "number" ? a.sort_order : Number.MAX_SAFE_INTEGER;
    const bSort = typeof b.sort_order === "number" ? b.sort_order : Number.MAX_SAFE_INTEGER;
    if (aSort !== bSort) return aSort - bSort;
    return a.name.localeCompare(b.name);
}

export default function NewBookingPage() {
    const router = useRouter();
    const locale = useLocale();
    const tBookingEditor = useTranslations("BookingEditor");
    const supabase = createClient();
    const [saving, setSaving] = React.useState(false);
    const [calendarWarning, setCalendarWarning] = React.useState<string | null>(null);
    const [services, setServices] = React.useState<Service[]>([]);
    const [cityOptions, setCityOptions] = React.useState<CityReferenceItem[]>([]);
    const [freelancers, setFreelancers] = React.useState<Freelance[]>([]);
    const [eventTypeOptions, setEventTypeOptions] = React.useState<string[]>(EVENT_TYPES);

    const [clientName, setClientName] = React.useState("");
    const [eventType, setEventType] = React.useState("");
    const [selectedCityCode, setSelectedCityCode] = React.useState("");
    const [extraFields, setExtraFields] = React.useState<Record<string, string>>({});
    const [extraLocationCoords, setExtraLocationCoords] = React.useState<Record<string, LocationCoords>>({});
    const [location, setLocation] = React.useState("");
    const [locationCoords, setLocationCoords] = React.useState<LocationCoords>({ lat: null, lng: null });
    const [locationDetail, setLocationDetail] = React.useState("");
    const [totalPrice, setTotalPrice] = React.useState(0);
    const [dpPaid, setDpPaid] = React.useState<number | "">("");
    const [accommodationFee, setAccommodationFee] = React.useState<number | "">("");
    const [discountAmount, setDiscountAmount] = React.useState<number | "">("");
    const [selectedServiceIds, setSelectedServiceIds] = React.useState<string[]>([]);
    const [selectedAddonIds, setSelectedAddonIds] = React.useState<string[]>([]);
    const [defaultServiceColor, setDefaultServiceColor] = React.useState("#000000");
    const [packageDialogOpen, setPackageDialogOpen] = React.useState(false);
    const [addonDialogOpen, setAddonDialogOpen] = React.useState(false);
    const [packageSearchQuery, setPackageSearchQuery] = React.useState("");
    const [addonSearchQuery, setAddonSearchQuery] = React.useState("");
    const [selectedFreelancerIds, setSelectedFreelancerIds] = React.useState<string[]>([]);
    const [countryCode, setCountryCode] = React.useState("+62");
    const [phoneNumber, setPhoneNumber] = React.useState("");
    const [instagram, setInstagram] = React.useState("");
    const [sessionDate, setSessionDate] = React.useState("");
    const [splitDates, setSplitDates] = React.useState(false);
    const [akadDate, setAkadDate] = React.useState("");
    const [resepsiDate, setResepsiDate] = React.useState("");
    const [wisudaSession1Date, setWisudaSession1Date] = React.useState("");
    const [wisudaSession2Date, setWisudaSession2Date] = React.useState("");
    const [isWisudaDurationOverrideEnabled, setIsWisudaDurationOverrideEnabled] = React.useState(false);
    const [wisudaSession1DurationInput, setWisudaSession1DurationInput] = React.useState("");
    const [wisudaSession2DurationInput, setWisudaSession2DurationInput] = React.useState("");
    const [statusOptions, setStatusOptions] = React.useState<string[]>(
        getBookingStatusOptions(DEFAULT_CLIENT_STATUSES),
    );
    const initialBookingStatus = React.useMemo(
        () => getInitialBookingStatus(statusOptions),
        [statusOptions],
    );
    const [notes, setNotes] = React.useState("");
    const [adminNotes, setAdminNotes] = React.useState("");
    const [driveFolderUrl, setDriveFolderUrl] = React.useState("");
    const [portfolioUrl, setPortfolioUrl] = React.useState("");
    const [formSectionsByEventType, setFormSectionsByEventType] = React.useState<Record<string, FormLayoutItem[]>>({});
    const [customFieldValues, setCustomFieldValues] = React.useState<Record<string, string>>({});

    // Custom popups
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
    const { canWriteBookings } = useBookingWriteAccess();

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
                // Silent by design: booking save should not fail because integration sync fails.
            }
        },
        [locale],
    );

    React.useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const [{ data: svcs }, { data: frees }, { data: prof }, { data: cityRefs }] = await Promise.all([
                supabase
                    .from("services")
                    .select("id, name, price, original_price, description, color, duration_minutes, affects_schedule, is_addon, is_public, sort_order, event_types")
                    .eq("user_id", user.id)
                    .eq("is_active", true),
                supabase.from("freelance").select("id, name, google_email").eq("user_id", user.id).eq("status", "active"),
                supabase.from("profiles").select("custom_client_statuses, form_sections, form_event_types, custom_event_types, form_brand_color").eq("id", user.id).single(),
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
            const profileRow = (prof ?? null) as ProfileRow | null;
            setDefaultServiceColor(
                resolveHexColor(profileRow?.form_brand_color, "#000000"),
            );
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
            setFreelancers((frees || []) as Freelance[]);
            const nextStatusOptions = getBookingStatusOptions(
                profileRow?.custom_client_statuses as string[] | null | undefined,
            );
            setStatusOptions(nextStatusOptions);
            setEventTypeOptions(getActiveEventTypes({
                customEventTypes: normalizeEventTypeList(profileRow?.custom_event_types),
                activeEventTypes: profileRow?.form_event_types,
            }));
            setFormSectionsByEventType(
                normalizeFormSectionsByEventType(
                    (profileRow as Record<string, unknown> | null)?.form_sections,
                ),
            );
        }
        load();
    }, [supabase]);

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

    const sortedServices = React.useMemo(
        () => [...services].sort(compareServicesByCatalogOrder),
        [services],
    );
    const normalizedSelectedCityCode = normalizeCityCode(selectedCityCode);
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
    React.useEffect(() => {
        const availableMainIds = new Set(mainServices.map((service) => service.id));
        setSelectedServiceIds((prev) => {
            const next = prev.filter((serviceId) => availableMainIds.has(serviceId));
            if (
                next.length === prev.length &&
                next.every((serviceId, index) => serviceId === prev[index])
            ) {
                return prev;
            }
            return next;
        });
    }, [mainServices]);
    React.useEffect(() => {
        const availableAddonIds = new Set(addonServices.map((service) => service.id));
        setSelectedAddonIds((prev) => {
            const next = prev.filter((serviceId) => availableAddonIds.has(serviceId));
            if (
                next.length === prev.length &&
                next.every((serviceId, index) => serviceId === prev[index])
            ) {
                return prev;
            }
            return next;
        });
    }, [addonServices]);
    const selectedServiceSelections = React.useMemo<BookingServiceSelection[]>(
        () => [
            ...selectedMainServices.map((service, index) => ({
                id: service.id,
                booking_service_id: null,
                kind: "main" as const,
                sort_order: index,
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
        [selectedMainServices, selectedAddonServices],
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
        const packageTotal = selectedMainServices.reduce(
            (sum, service) => sum + service.price,
            0,
        );
        const addonTotal = selectedAddonServices.reduce(
            (sum, service) => sum + service.price,
            0,
        );
        const accommodationFeeValue =
            typeof accommodationFee === "number" ? accommodationFee : 0;
        const discountAmountValue =
            typeof discountAmount === "number" ? discountAmount : 0;
        setTotalPrice(
            computeSpecialOfferTotal({
                packageTotal,
                addonTotal,
                accommodationFee: accommodationFeeValue,
                discountAmount: discountAmountValue,
            }),
        );
    }, [
        accommodationFee,
        discountAmount,
        selectedAddonServices,
        selectedMainServices,
    ]);

    const normalizedEventType = React.useMemo(
        () => normalizeEventTypeName(eventType) || eventType,
        [eventType],
    );

    const activeFormLayout = React.useMemo(
        () =>
            resolveNormalizedActiveFormLayout(
                formSectionsByEventType,
                normalizedEventType,
            ),
        [formSectionsByEventType, normalizedEventType],
    );

    const currentExtraFields = React.useMemo(
        () => getLayoutExtraFields(activeFormLayout),
        [activeFormLayout],
    );
    const sessionLocationExtraFields = React.useMemo(() => {
        if (eventType === "Wedding") {
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
        );
    }, [activeFormLayout, normalizedEventType]);

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

    const toggleFreelancer = (id: string) => {
        setSelectedFreelancerIds(prev => {
            if (prev.includes(id)) return prev.filter(f => f !== id);
            if (prev.length >= 5) return prev;
            return [...prev, id];
        });
    };

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
        }).select("id, name, price, original_price, description, color, duration_minutes, affects_schedule, is_addon, is_public, sort_order, event_types").single();
        if (!error && data) {
            const s = data as Service;
            setServices(prev => [...prev, s].sort(compareServicesByCatalogOrder));
            setSelectedServiceIds(prev => (prev.includes(s.id) ? prev : [...prev, s.id]));
            setCustomServiceName(""); setCustomServicePrice(""); setCustomServiceDesc("");
            setShowCustomServicePopup(false);
        } else { showFeedback(tBookingEditor("failedSaveNewPackage")); }
        setSavingCustomService(false);
    }

    async function saveCustomFreelancer() {
        if (!requireBookingWrite()) return;
        if (!customFreelancerName.trim()) return;
        setSavingCustomFreelancer(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase.from("freelance").insert({
            user_id: user.id,
            name: customFreelancerName.trim(),
            role: customFreelancerRole || "Photographer",
            whatsapp_number: customFreelancerWa ? `${customFreelancerCountryCode}${customFreelancerWa}`.replace(/[^0-9+]/g, "") : null,
            status: "active",
        }).select("id, name").single();
        if (!error && data) {
            const f = data as Freelance;
            setFreelancers(prev => [...prev, f]);
            setSelectedFreelancerIds(prev => prev.length < 5 ? [...prev, f.id] : prev);
            setCustomFreelancerName(""); setCustomFreelancerWa(""); setCustomFreelancerRole("Photographer"); setCustomFreelancerCountryCode("+62");
            setShowCustomFreelancerPopup(false);
        } else { console.error(error); showFeedback(tBookingEditor("failedSaveNewFreelancer")); }
        setSavingCustomFreelancer(false);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!requireBookingWrite()) return;
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const isWeddingEvent = eventType === "Wedding";
            const isWisudaEvent = eventType === "Wisuda";
            const isSplitSessionEnabled =
                splitDates && (isWeddingEvent || isWisudaEvent);

            if (
                isWeddingEvent &&
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
            if (!normalizedSelectedCityCode || !selectedCity) {
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

            // Determine session_date: if split, use earliest; merge extra_fields with dates
            let finalSessionDate = sessionDate || null;
            const mergedExtra: Record<string, unknown> = { ...extraFields };
            if (isWeddingEvent && isSplitSessionEnabled) {
                mergedExtra.tanggal_akad = akadDate || "";
                mergedExtra.tanggal_resepsi = resepsiDate || "";
                // session_date = earliest date for sorting/calendar
                if (akadDate && resepsiDate) {
                    finalSessionDate = akadDate < resepsiDate ? akadDate : resepsiDate;
                } else {
                    finalSessionDate = akadDate || resepsiDate || null;
                }
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
            } else {
                delete mergedExtra.tanggal_wisuda_1;
                delete mergedExtra.tanggal_wisuda_2;
                delete mergedExtra.tempat_wisuda_1;
                delete mergedExtra.tempat_wisuda_2;
                delete mergedExtra[WISUDA_SESSION_DURATION_EXTRA_FIELD_KEY];
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

            const packageTotalValue = selectedMainServices.reduce(
                (sum, service) => sum + service.price,
                0,
            );
            const addonTotalValue = selectedAddonServices.reduce(
                (sum, service) => sum + service.price,
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
            const customFieldSnapshots = buildCustomFieldSnapshots(
                activeFormLayout,
                normalizedEventType || "Umum",
                customFieldValues,
            );
            const nextSpecialOffer = buildEditableSpecialOfferSnapshot({
                existingSnapshot: null,
                selectedEventType: eventType,
                selectedPackageServiceIds: selectedServiceIds,
                selectedAddonServiceIds: selectedAddonIds,
                packageTotal: packageTotalValue,
                addonTotal: addonTotalValue,
                accommodationFee: accommodationFeeValue,
                discountAmount: discountAmountValue,
                includeWhenZero: true,
            });
            const nextExtraFieldsPayload = mergeSpecialOfferSnapshotIntoExtraFields(
                {
                    ...resolvedExtraFields,
                    ...(customFieldSnapshots.length > 0
                        ? { custom_fields: customFieldSnapshots }
                        : {}),
                },
                nextSpecialOffer,
            );
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

            const bookingPayload = {
                user_id: user.id,
                client_name: clientName,
                client_whatsapp: fullPhone,
                session_date: finalSessionDate,
                location: resolvedLocation.location,
                location_lat: resolvedLocation.locationLat,
                location_lng: resolvedLocation.locationLng,
                location_detail: locationDetail || null,
                instagram: instagram || null,
                event_type: eventType,
                service_id: selectedServiceIds[0] || null,
                city_code: normalizedSelectedCityCode,
                city_name: selectedCity.city_name,
                freelance_id: selectedFreelancerIds[0] || null,
                total_price: totalPriceValue,
                dp_paid: parseFloat(dpPaid.toString()) || 0,
                status: initialBookingStatus,
                client_status: initialBookingStatus,
                notes: notes || null,
                admin_notes: adminNotes || null,
                drive_folder_url: driveFolderUrl || null,
                portfolio_url: portfolioUrl || null,
                extra_fields: nextExtraFieldsPayload,
            };

            let booking: { id: string } | null = null;
            let insertError: { code?: string | null; message?: string | null } | null = null;

            for (let attempt = 0; attempt < 5; attempt++) {
                const { data, error } = await supabase
                    .from("bookings")
                    .insert({
                        ...bookingPayload,
                        booking_code: createBookingCode(),
                    })
                    .select("id")
                    .single();

                if (!error && data) {
                    booking = data;
                    insertError = null;
                    break;
                }

                insertError = error;
                if (isDuplicateBookingCodeError(error)) {
                    continue;
                }
                break;
            }

            if (!booking) {
                showFeedback(insertError?.message || tBookingEditor("failedSaveBooking"));
                return;
            }

            // Insert into junction table
            const bookingServiceRows = [
                ...selectedServiceIds.map((serviceId, index) => ({
                    booking_id: booking.id,
                    service_id: serviceId,
                    kind: "main" as const,
                    sort_order: index,
                })),
                ...selectedAddonIds.map((serviceId, index) => ({
                    booking_id: booking.id,
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

            if (selectedFreelancerIds.length > 0) {
                await supabase.from("booking_freelance").insert(
                    selectedFreelancerIds.map(fid => ({ booking_id: booking.id, freelance_id: fid }))
                );
            }

            if (finalSessionDate) {
                try {
                    const selectedFreelancerEmails = freelancers
                        .filter(f => selectedFreelancerIds.includes(f.id))
                        .map(f => f.google_email)
                        .filter((email): email is string => Boolean(email));
                    const noEmailNames = freelancers
                        .filter(f => selectedFreelancerIds.includes(f.id) && !f.google_email)
                        .map(f => f.name);

                    const res = await fetch("/api/google/calendar-invite", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            bookingId: booking.id,
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
            } else if (selectedFreelancerIds.length > 0) {
                setCalendarWarning(tBookingEditor("calendarInviteSkippedNoSession"));
                setTimeout(() => setCalendarWarning(null), 5000);
            }

            void triggerFastpikAutoSync(booking.id);
            router.push(`/${locale}/bookings/${booking.id}?saved=create`);
        } finally {
            setSaving(false);
        }
    }

    const reqMark = <span className="text-red-500 ml-0.5">*</span>;

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
                <Link href="/bookings">
                    <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="w-4 h-4" /></Button>
                </Link>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{tBookingEditor("createBookingTitle")}</h2>
                    <p className="text-muted-foreground text-sm">{tBookingEditor("createBookingSubtitle")}</p>
                </div>
            </div>

            <BookingWriteReadonlyBanner />

            <form onSubmit={handleSubmit} className="space-y-6">
                <fieldset disabled={!canWriteBookings} className="space-y-6">
                {/* Informasi Klien */}
                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
                    <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Users className="w-4 h-4" /> Informasi Klien
                    </h3>
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Nama{reqMark}</label>
                            <input value={clientName} onChange={e => setClientName(e.target.value)} required placeholder={tBookingEditor("clientNamePlaceholderNew")} className={inputClass} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Nomor WhatsApp{reqMark}</label>
                            <div className="flex gap-1.5">
                                <select value={countryCode} onChange={e => setCountryCode(e.target.value)}
                                    className={cn(selectClass, "w-[110px] shrink-0 text-xs")}>
                                    {COUNTRY_CODES.map(c => (
                                        <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                                    ))}
                                </select>
                                <input
                                    required type="tel"
                                    value={phoneNumber}
                                    onChange={e => setPhoneNumber(sanitizePhone(e.target.value))}
                                    placeholder="812345678"
                                    className={cn(inputClass, "flex-1")}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5 col-span-full">
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

                {/* Detail Sesi */}
                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
                    <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <CalendarClock className="w-4 h-4" /> Detail Sesi
                    </h3>
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                        <div className="col-span-full space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Tipe Acara{reqMark}</label>
                            <select value={eventType} onChange={e => {
                                setEventType(e.target.value);
                                setSplitDates(false);
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

                        {/* Split dates toggle */}
                        {(eventType === "Wedding" || eventType === "Wisuda") && (
                            <div className="col-span-full flex items-center gap-3">
                                <button type="button" onClick={() => {
                                    const nextSplitDates = !splitDates;
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

                        {/* Dual dates for split sessions */}
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
                        ) : eventType === "Wisuda" && splitDates ? (
                            <>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Tanggal Sesi 1{reqMark}</label>
                                    <input type="date" value={wisudaSession1Date ? wisudaSession1Date.split("T")[0] : ""} onChange={e => {
                                        const timePart = wisudaSession1Date?.split("T")[1] || "10:00";
                                        setWisudaSession1Date(e.target.value ? `${e.target.value}T${timePart}` : "");
                                    }} required className={cn(inputClass, "block")} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Jam Sesi 1{reqMark}</label>
                                    <input type="time" value={wisudaSession1Date ? wisudaSession1Date.split("T")[1] || "10:00" : ""} onChange={e => {
                                        const datePart = wisudaSession1Date?.split("T")[0] || "";
                                        if (datePart) setWisudaSession1Date(`${datePart}T${e.target.value}`);
                                    }} className={cn(inputClass, "block")} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Tanggal Sesi 2{reqMark}</label>
                                    <input type="date" value={wisudaSession2Date ? wisudaSession2Date.split("T")[0] : ""} onChange={e => {
                                        const timePart = wisudaSession2Date?.split("T")[1] || "10:00";
                                        setWisudaSession2Date(e.target.value ? `${e.target.value}T${timePart}` : "");
                                    }} required className={cn(inputClass, "block")} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Jam Sesi 2{reqMark}</label>
                                    <input type="time" value={wisudaSession2Date ? wisudaSession2Date.split("T")[1] || "10:00" : ""} onChange={e => {
                                        const datePart = wisudaSession2Date?.split("T")[0] || "";
                                        if (datePart) setWisudaSession2Date(`${datePart}T${e.target.value}`);
                                    }} className={cn(inputClass, "block")} />
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

                        <div className="space-y-1.5 col-span-full">
                            <label className="text-xs font-medium text-muted-foreground">Status Awal</label>
                            <input value={initialBookingStatus} readOnly className={inputClass} />
                            <p className="text-[11px] text-muted-foreground">Status awal selalu Pending. Ubah status setelah booking dibuat.</p>
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
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {eventType !== "Wedding" && !(eventType === "Wisuda" && splitDates) && (
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
                        </div>
                        <div className="col-span-full space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Paket / Layanan{reqMark}</label>
                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={() => setPackageDialogOpen(true)}
                                    disabled={!normalizedSelectedCityCode || !eventType}
                                    className="flex w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all hover:bg-muted/30 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <span className="text-left">
                                        {selectedMainServices.length > 0
                                            ? `${selectedMainServices.length} paket dipilih`
                                            : !normalizedSelectedCityCode
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
                                                    <p className="text-sm font-medium">{service.name}</p>
                                                    {service.description ? (
                                                        <p className="text-xs text-muted-foreground">{service.description}</p>
                                                    ) : null}
                                                </div>
                                                <div className="shrink-0 text-right">
                                                    <p className="text-lg font-bold" style={{ color: tone.color }}>{formatCurrency(service.price)}</p>
                                                    {service.original_price && service.original_price > service.price ? (
                                                        <p className="text-[11px] text-muted-foreground line-through">{formatCurrency(service.original_price)}</p>
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
                                disabled={addonServices.length === 0 || !normalizedSelectedCityCode || !eventType}
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
                                                    <p className="font-medium">{addon.name}</p>
                                                    {addon.description ? (
                                                        <p className="text-[11px] text-muted-foreground truncate">
                                                            {addon.description}
                                                        </p>
                                                    ) : null}
                                                </div>
                                                <span className="font-semibold whitespace-nowrap" style={{ color: tone.color }}>
                                                    +{formatCurrency(addon.price)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {selectedAddonServices.length > 0 && selectedMainServices.length > 0 && (
                                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                                    {selectedMainServices.map((service) => {
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
                                                <span>{service.name}</span>
                                                <span style={{ color: tone.color }}>{formatCurrency(service.price)}</span>
                                            </div>
                                        );
                                    })}
                                    {selectedAddonServices.map((service) => {
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
                                                <span>+ {service.name}</span>
                                                <span style={{ color: tone.color }}>{formatCurrency(service.price)}</span>
                                            </div>
                                        );
                                    })}
                                    <div className="flex justify-between font-bold border-t pt-1 mt-1">
                                        <span>Total</span>
                                        <span>{formatCurrency(totalPrice)}</span>
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
                                            selectedFreelancerIds.includes(f.id)
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
                            {selectedFreelancerIds.length > 0 && (
                                <p className="text-[10px] text-muted-foreground">{selectedFreelancerIds.length}/5 dipilih</p>
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

                {/* Keuangan */}
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
                                    required type="text" inputMode="numeric"
                                    value={formatNumber(totalPrice)}
                                    readOnly
                                    placeholder="0"
                                    className={cn(inputClass, "flex-1 bg-muted/40")}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">DP Dibayar{reqMark}</label>
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-muted-foreground shrink-0">Rp</span>
                                <input
                                    required type="text" inputMode="numeric"
                                    value={formatNumber(dpPaid)}
                                    onChange={e => setDpPaid(parseFormattedNumber(e.target.value))}
                                    placeholder="0"
                                    className={cn(inputClass, "flex-1")}
                                />
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
                                    onChange={e => setAccommodationFee(parseFormattedNumber(e.target.value))}
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
                                    onChange={e => setDiscountAmount(parseFormattedNumber(e.target.value))}
                                    placeholder="0"
                                    className={cn(inputClass, "flex-1")}
                                />
                            </div>
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
                </div>

                {/* Catatan */}
                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-3">
                    <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <StickyNote className="w-4 h-4" /> Catatan
                    </h3>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Permintaan khusus, detail tambahan..." className={textareaClass} />
                </div>
                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-3">
                    <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <StickyNote className="w-4 h-4" /> Catatan Admin
                    </h3>
                    <textarea
                        value={adminNotes}
                        onChange={e => setAdminNotes(e.target.value)}
                        rows={3}
                        placeholder={tBookingEditor("adminNotesPlaceholder")}
                        className={textareaClass}
                    />
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
                    <Link href="/bookings"><Button type="button" variant="ghost" className="text-muted-foreground hover:text-foreground">Batal</Button></Link>
                    <Button type="submit" disabled={saving || !canWriteBookings} className="gap-2 bg-foreground text-background hover:bg-foreground/90 px-8">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Simpan Booking
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
                            {!normalizedSelectedCityCode ? (
                                <div className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
                                    Pilih kota/kabupaten dulu untuk melihat paket.
                                </div>
                            ) : !eventType ? (
                                <div className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
                                    Pilih tipe acara dulu untuk melihat paket.
                                </div>
                            ) : mainServices.length === 0 ? (
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
                                            className={`flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-all cursor-pointer hover:opacity-95 ${selected ? "shadow-sm" : ""}`}
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
                                                    <p className="text-sm font-medium">{service.name}</p>
                                                    {service.description ? (
                                                        <p className="text-[11px] text-muted-foreground">
                                                            {service.description}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <p className="text-sm font-semibold" style={{ color: tone.color }}>
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
                            {!normalizedSelectedCityCode ? (
                                <div className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
                                    Pilih kota/kabupaten dulu untuk melihat add-on.
                                </div>
                            ) : !eventType ? (
                                <div className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
                                    Pilih tipe acara dulu untuk melihat add-on.
                                </div>
                            ) : addonServices.length === 0 ? (
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
                                            className={`flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-all cursor-pointer hover:opacity-95 ${selected ? "shadow-sm" : ""}`}
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
                                                    <p className="text-sm font-medium">{addon.name}</p>
                                                    {addon.description ? (
                                                        <p className="text-[11px] text-muted-foreground">
                                                            {addon.description}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <p className="text-sm font-semibold" style={{ color: tone.color }}>
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

            {/* Custom Service Popup */}
            <Dialog open={showCustomServicePopup} onOpenChange={setShowCustomServicePopup}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> Tambah Paket Baru</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Nama Paket <span className="text-red-500">*</span></label>
                            <input value={customServiceName} onChange={e => setCustomServiceName(e.target.value)} placeholder={tBookingEditor("customPackageExampleNew")} className={inputClass} autoFocus />
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
                            {savingCustomService ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                            Simpan & Pilih
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Custom Freelancer Popup */}
            <Dialog open={showCustomFreelancerPopup} onOpenChange={setShowCustomFreelancerPopup}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> Tambah Freelance Baru</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Nama Freelance <span className="text-red-500">*</span></label>
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
                            <label className="text-xs font-medium text-muted-foreground">Nomor WhatsApp</label>
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
                            {savingCustomFreelancer ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                            Simpan & Pilih
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
        </div>
        </>
    );
}
