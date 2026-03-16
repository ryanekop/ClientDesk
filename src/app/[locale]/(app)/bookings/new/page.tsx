"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { ArrowLeft, Save, Loader2, Users, CalendarClock, Wallet, StickyNote, Plus, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionFeedbackDialog } from "@/components/ui/action-feedback-dialog";
import { createClient } from "@/utils/supabase/client";
import { Link } from "@/i18n/routing";
import {
    LocationAutocomplete,
    type LocationSelectionMeta,
} from "@/components/ui/location-autocomplete";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { BookingAdminCustomFields } from "@/components/form-builder/booking-admin-custom-fields";
import {
    buildCustomFieldSnapshots,
    getGroupedCustomLayoutSections,
    normalizeStoredFormLayout,
    type FormLayoutItem,
} from "@/components/form-builder/booking-form-layout";
import {
    getActiveEventTypes,
    getBuiltInEventTypes,
    normalizeEventTypeList,
} from "@/lib/event-type-config";
import {
    DEFAULT_CLIENT_STATUSES,
    getBookingStatusOptions,
    getInitialBookingStatus,
} from "@/lib/client-status";
import { createBookingCode, isDuplicateBookingCodeError } from "@/lib/booking-code";
import { resolvePreferredLocation } from "@/utils/location";

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

const EXTRA_FIELDS: Record<string, { key: string; label: string; labelEn: string; isLocation?: boolean; fullWidth?: boolean; required?: boolean; isNumeric?: boolean }[]> = {
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
    Family: [{ key: "jumlah_anggota", label: "Jumlah Anggota", labelEn: "Number of Members" }],
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
    is_addon?: boolean | null;
    is_public?: boolean | null;
};
type Freelance = { id: string; name: string };
type LocationCoords = { lat: number | null; lng: number | null };

function formatNumber(n: number | ""): string {
    if (n === "" || n === 0) return "";
    return new Intl.NumberFormat("id-ID").format(n);
}

function parseFormattedNumber(s: string): number | "" {
    const cleaned = s.replace(/\./g, "").replace(/,/g, "");
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? "" : num;
}

function sanitizePhone(raw: string): string {
    // Strip leading 0, +62, 62
    let cleaned = raw.replace(/[^0-9]/g, "");
    if (cleaned.startsWith("62")) cleaned = cleaned.slice(2);
    if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
    return cleaned;
}

export default function NewBookingPage() {
    const router = useRouter();
    const locale = useLocale();
    const supabase = createClient();
    const [saving, setSaving] = React.useState(false);
    const [calendarWarning, setCalendarWarning] = React.useState<string | null>(null);
    const [services, setServices] = React.useState<Service[]>([]);
    const [freelancers, setFreelancers] = React.useState<Freelance[]>([]);
    const [eventTypeOptions, setEventTypeOptions] = React.useState<string[]>(EVENT_TYPES);

    const [clientName, setClientName] = React.useState("");
    const [eventType, setEventType] = React.useState("Umum");
    const [extraFields, setExtraFields] = React.useState<Record<string, string>>({});
    const [extraLocationCoords, setExtraLocationCoords] = React.useState<Record<string, LocationCoords>>({});
    const [location, setLocation] = React.useState("");
    const [locationCoords, setLocationCoords] = React.useState<LocationCoords>({ lat: null, lng: null });
    const [locationDetail, setLocationDetail] = React.useState("");
    const [totalPrice, setTotalPrice] = React.useState<number | "">("");
    const [dpPaid, setDpPaid] = React.useState<number | "">("");
    const [selectedServiceIds, setSelectedServiceIds] = React.useState<string[]>([]);
    const [selectedAddonIds, setSelectedAddonIds] = React.useState<string[]>([]);
    const [selectedFreelancerIds, setSelectedFreelancerIds] = React.useState<string[]>([]);
    const [countryCode, setCountryCode] = React.useState("+62");
    const [phoneNumber, setPhoneNumber] = React.useState("");
    const [instagram, setInstagram] = React.useState("");
    const [sessionDate, setSessionDate] = React.useState("");
    const [splitDates, setSplitDates] = React.useState(false);
    const [akadDate, setAkadDate] = React.useState("");
    const [resepsiDate, setResepsiDate] = React.useState("");
    const [statusOptions, setStatusOptions] = React.useState<string[]>(
        getBookingStatusOptions(DEFAULT_CLIENT_STATUSES),
    );
    const initialBookingStatus = React.useMemo(
        () => getInitialBookingStatus(statusOptions),
        [statusOptions],
    );
    const [notes, setNotes] = React.useState("");
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

    const showFeedback = React.useCallback((message: string, title?: string) => {
        setFeedbackDialog({
            open: true,
            title: title || (locale === "en" ? "Information" : "Informasi"),
            message,
        });
    }, [locale]);

    React.useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const [{ data: svcs }, { data: frees }, { data: prof }] = await Promise.all([
                supabase.from("services").select("id, name, price, is_addon, is_public").eq("user_id", user.id).eq("is_active", true),
                supabase.from("freelance").select("id, name, google_email").eq("user_id", user.id).eq("status", "active"),
                supabase.from("profiles").select("custom_client_statuses, form_sections, form_event_types, custom_event_types").eq("id", user.id).single(),
            ]);
            setServices((svcs || []) as Service[]);
            setFreelancers((frees || []) as Freelance[]);
            const nextStatusOptions = getBookingStatusOptions((prof as any)?.custom_client_statuses as string[] | null | undefined);
            setStatusOptions(nextStatusOptions);
            setEventTypeOptions(getActiveEventTypes({
                customEventTypes: normalizeEventTypeList((prof as any)?.custom_event_types),
                activeEventTypes: (prof as any)?.form_event_types,
            }));
            const rawSections = (prof as Record<string, unknown> | null)?.form_sections;
            if (Array.isArray(rawSections)) {
                setFormSectionsByEventType({ Umum: normalizeStoredFormLayout(rawSections, "Umum") });
            } else if (rawSections && typeof rawSections === "object") {
                setFormSectionsByEventType(
                    Object.fromEntries(
                        Object.entries(rawSections as Record<string, unknown>).map(([key, value]) => [
                            key,
                            normalizeStoredFormLayout(value, key),
                        ]),
                    ) as Record<string, FormLayoutItem[]>,
                );
            }
        }
        load();
    }, []);

    const mainServices = React.useMemo(
        () => services.filter((service) => !service.is_addon),
        [services],
    );
    const addonServices = React.useMemo(
        () => services.filter((service) => service.is_addon),
        [services],
    );
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
        if (selectedMainServices.length === 0 && selectedAddonServices.length === 0) {
            setTotalPrice("");
            return;
        }
        setTotalPrice(
            selectedMainServices.reduce((sum, service) => sum + service.price, 0) +
            selectedAddonServices.reduce((sum, service) => sum + service.price, 0),
        );
    }, [selectedAddonServices, selectedMainServices]);

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

    const toggleFreelancer = (id: string) => {
        setSelectedFreelancerIds(prev => {
            if (prev.includes(id)) return prev.filter(f => f !== id);
            if (prev.length >= 5) return prev;
            return [...prev, id];
        });
    };

    async function saveCustomService() {
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
        }).select("id, name, price, is_addon, is_public").single();
        if (!error && data) {
            const s = data as Service;
            setServices(prev => [...prev, s]);
            setSelectedServiceIds(prev => (prev.includes(s.id) ? prev : [...prev, s.id]));
            setTotalPrice(prev => {
                const current = typeof prev === "number" ? prev : 0;
                return current > 0 ? current + s.price : s.price;
            });
            setCustomServiceName(""); setCustomServicePrice(""); setCustomServiceDesc("");
            setShowCustomServicePopup(false);
        } else { showFeedback("Gagal menyimpan paket baru."); }
        setSavingCustomService(false);
    }

    async function saveCustomFreelancer() {
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
        } else { console.error(error); showFeedback("Gagal menyimpan freelance baru."); }
        setSavingCustomFreelancer(false);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setSaving(false); return; }

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

        const fullPhone = phoneNumber ? `${countryCode}${sanitizePhone(phoneNumber)}` : null;

        // Determine session_date: if split, use earliest; merge extra_fields with dates
        let finalSessionDate = sessionDate || null;
        const mergedExtra = { ...extraFields };
        if (eventType === "Wedding" && splitDates) {
            mergedExtra.tanggal_akad = akadDate || "";
            mergedExtra.tanggal_resepsi = resepsiDate || "";
            // session_date = earliest date for sorting/calendar
            if (akadDate && resepsiDate) {
                finalSessionDate = akadDate < resepsiDate ? akadDate : resepsiDate;
            } else {
                finalSessionDate = akadDate || resepsiDate || null;
            }
        }
        const customFieldSnapshots = buildCustomFieldSnapshots(
            formSectionsByEventType[eventType] || formSectionsByEventType.Umum || [],
            eventType,
            customFieldValues,
        );
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
            freelance_id: selectedFreelancerIds[0] || null,
            total_price: parseFloat(totalPrice.toString()) || 0,
            dp_paid: parseFloat(dpPaid.toString()) || 0,
            status: initialBookingStatus,
            client_status: initialBookingStatus,
            notes: notes || null,
            drive_folder_url: driveFolderUrl || null,
            portfolio_url: portfolioUrl || null,
            extra_fields:
                Object.keys(mergedExtra).length > 0 || customFieldSnapshots.length > 0
                    ? {
                        ...mergedExtra,
                        ...(customFieldSnapshots.length > 0 ? { custom_fields: customFieldSnapshots } : {}),
                    }
                    : null,
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

        setSaving(false);
        if (booking) {
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
                        .map(f => (f as any).google_email)
                        .filter(Boolean);
                    const noEmailNames = freelancers
                        .filter(f => selectedFreelancerIds.includes(f.id) && !(f as any).google_email)
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
            } else if (selectedFreelancerIds.length > 0) {
                setCalendarWarning("⚠️ Calendar invite tidak terkirim: jadwal sesi belum diisi");
                setTimeout(() => setCalendarWarning(null), 5000);
            }

            router.push(`/${locale}/bookings/${booking.id}`);
        }
        else { showFeedback(insertError?.message || "Gagal menyimpan booking"); }
    }

    const currentExtraFields = EXTRA_FIELDS[eventType] || [];
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
                    <h2 className="text-2xl font-bold tracking-tight">Tambah Klien Baru</h2>
                    <p className="text-muted-foreground text-sm">Isi detail booking klien baru.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Informasi Klien */}
                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
                    <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Users className="w-4 h-4" /> Informasi Klien
                    </h3>
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Nama{reqMark}</label>
                            <input value={clientName} onChange={e => setClientName(e.target.value)} required placeholder="Nama lengkap klien" className={inputClass} />
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
                                    {f.isLocation ? (
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

                {/* Detail Sesi */}
                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
                    <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <CalendarClock className="w-4 h-4" /> Detail Sesi
                    </h3>
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                        <div className="col-span-full space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Tipe Acara{reqMark}</label>
                            <select value={eventType} onChange={e => { setEventType(e.target.value); setExtraFields({}); setExtraLocationCoords({}); setCustomFieldValues({}); }} className={selectClass} required>
                                {eventTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
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

                        {/* Dual dates for Wedding (split) */}
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
                            <label className="text-xs font-medium text-muted-foreground">Status Awal</label>
                            <input value={initialBookingStatus} readOnly className={inputClass} />
                            <p className="text-[11px] text-muted-foreground">Status awal selalu Pending. Ubah status setelah booking dibuat.</p>
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
                                {mainServices.map((service) => {
                                    const selected = selectedServiceIds.includes(service.id);
                                    return (
                                        <button
                                            key={service.id}
                                            type="button"
                                            onClick={() => toggleService(service.id)}
                                            className={cn(
                                                "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-all",
                                                selected
                                                    ? "border-foreground bg-foreground/5 dark:bg-foreground/10"
                                                    : "border-input hover:bg-muted/50"
                                            )}
                                        >
                                            <span>{service.name}</span>
                                            <span className="font-medium">Rp {formatNumber(service.price)}</span>
                                        </button>
                                    );
                                })}
                                <button
                                    type="button"
                                    onClick={() => setShowCustomServicePopup(true)}
                                    className="w-full rounded-lg border border-dashed border-input px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/50"
                                >
                                    ＋ Tambah Paket Baru...
                                </button>
                            </div>
                            {selectedMainServices.length > 0 && (
                                <p className="text-[11px] text-muted-foreground">
                                    Dipilih: {selectedMainServices.map(service => service.name).join(", ")}
                                </p>
                            )}
                        </div>
                        <div className="col-span-full space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Add-on (opsional)</label>
                            {addonServices.length === 0 ? (
                                <p className="rounded-lg border border-dashed border-input px-3 py-2 text-xs text-muted-foreground">
                                    Belum ada add-on aktif.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {addonServices.map((service) => {
                                        const selected = selectedAddonIds.includes(service.id);
                                        return (
                                            <button
                                                key={service.id}
                                                type="button"
                                                onClick={() => toggleAddon(service.id)}
                                                className={cn(
                                                    "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-all",
                                                    selected
                                                        ? "border-foreground bg-foreground/5 dark:bg-foreground/10"
                                                        : "border-input hover:bg-muted/50"
                                                )}
                                            >
                                                <span>{service.name}</span>
                                                <span className="font-medium">+ Rp {formatNumber(service.price)}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            {selectedAddonServices.length > 0 && (
                                <p className="text-[11px] text-muted-foreground">
                                    Dipilih: {selectedAddonServices.map(service => service.name).join(", ")}
                                </p>
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
                                    onChange={e => setTotalPrice(parseFormattedNumber(e.target.value))}
                                    placeholder="0"
                                    className={cn(inputClass, "flex-1")}
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

                <div className="flex gap-3 justify-end pt-4">
                    <Link href="/bookings"><Button type="button" variant="ghost" className="text-muted-foreground hover:text-foreground">Batal</Button></Link>
                    <Button type="submit" disabled={saving} className="gap-2 bg-foreground text-background hover:bg-foreground/90 px-8">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Simpan Booking
                    </Button>
                </div>
            </form>

            {/* Custom Service Popup */}
            <Dialog open={showCustomServicePopup} onOpenChange={setShowCustomServicePopup}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> Tambah Paket Baru</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Nama Paket <span className="text-red-500">*</span></label>
                            <input value={customServiceName} onChange={e => setCustomServiceName(e.target.value)} placeholder="Contoh: Paket Gold 2 Jam" className={inputClass} autoFocus />
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
