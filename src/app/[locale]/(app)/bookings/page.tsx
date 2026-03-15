"use client";

import * as React from "react";
import { Plus, Folder, Edit2, Trash2, Link2, Loader2, Info, Search, MapPin, RefreshCcw, CheckCircle2, AlertCircle, MessageCircle, Copy, ClipboardCheck, X, Download, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatSessionDate, formatSessionTime, formatTemplateSessionDate } from "@/utils/format-date";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { BatchImportButton } from "@/components/batch-import";
import { TablePagination, paginateArray } from "@/components/ui/table-pagination";
import { buildExtraFieldTemplateVars, getEventExtraFields } from "@/utils/form-extra-fields";
import {
    buildCustomFieldTemplateVars,
    extractBuiltInExtraFieldValues,
    extractCustomFieldSnapshots,
    getGroupedCustomLayoutSections,
    type FormLayoutItem,
} from "@/components/form-builder/booking-form-layout";
import {
    getBookingServiceLabel,
    getBookingServiceNames,
    normalizeLegacyServiceRecord,
    normalizeBookingServiceSelections,
    type BookingServiceSelection,
} from "@/lib/booking-services";
import { TableColumnManager } from "@/components/ui/table-column-manager";
import {
    lockBoundaryColumns,
    mergeTableColumnPreferences,
    updateTableColumnPreferenceMap,
    type TableColumnPreference,
} from "@/lib/table-column-prefs";
import {
    buildBookingMetadataColumns,
    getBookingMetadataValue,
} from "@/lib/booking-table-columns";
import { getWhatsAppTemplateContent } from "@/lib/whatsapp-template";
import {
    DEFAULT_CLIENT_STATUSES,
    getBookingStatusOptions,
} from "@/lib/client-status";
import * as XLSX from "xlsx";

const selectFilterClass = "h-9 rounded-md border border-input bg-background/50 px-3 pr-8 text-sm outline-none cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23999%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

type FreelancerInfo = { id: string; name: string; whatsapp_number: string | null };

type Booking = {
    id: string;
    booking_code: string;
    client_name: string;
    client_whatsapp: string | null;
    session_date: string | null;
    status: string;
    total_price: number;
    dp_paid: number;
    drive_folder_url: string | null;
    location: string | null;
    notes: string | null;
    services: { id?: string; name: string; price?: number; is_addon?: boolean | null } | null;
    event_type: string | null;
    freelance?: FreelancerInfo | null; // old single FK (backward compat)
    booking_freelancers: FreelancerInfo[]; // new junction data
    tracking_uuid: string | null;
    location_detail: string | null;
    extra_fields?: Record<string, unknown> | null;
    booking_services?: unknown[];
    service_selections?: BookingServiceSelection[];
    service_label?: string;
    created_at?: string;
};

type BookingFilterField = {
    key: string;
    label: string;
    mode: "contains" | "exact";
    options?: string[];
};

const DEFAULT_STATUS_OPTS = getBookingStatusOptions(DEFAULT_CLIENT_STATUSES);
const STATUS_COLOR_PALETTE = [
    "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-none",
    "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 border-none",
    "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-none",
    "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border-none",
    "bg-pink-100 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400 border-none",
    "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400 border-none",
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-none",
    "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400 border-none",
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 border-none",
    "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border-none",
];
const BASE_BOOKING_COLUMNS: TableColumnPreference[] = [
    { id: "name", label: "Nama", visible: true, locked: true },
    { id: "invoice", label: "Invoice", visible: true },
    { id: "package", label: "Paket", visible: true },
    { id: "schedule", label: "Jadwal", visible: true },
    { id: "location", label: "Lokasi", visible: true },
    { id: "status", label: "Status", visible: true },
    { id: "freelancer", label: "Freelance", visible: true },
    { id: "price", label: "Harga", visible: true },
    { id: "actions", label: "Aksi", visible: true, locked: true },
];

type SavedTemplate = {
    id: string;
    type: string;
    name?: string | null;
    content: string;
    content_en: string;
    event_type: string | null;
};

function generateWATemplate(booking: Booking, locale: string, savedTemplates: SavedTemplate[], studioName: string, freelancerName?: string) {
    const sessionStr = booking.session_date ? formatTemplateSessionDate(booking.session_date, { locale: locale === "en" ? "en" : "id" }) : "-";
    const sessionTime = booking.session_date ? formatSessionTime(booking.session_date) : "-";
    const serviceName = booking.service_label || booking.services?.name || "-";

    // Build replacement map
    const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
    const vars: Record<string, string> = {
        client_name: booking.client_name,
        booking_code: booking.booking_code,
        session_date: sessionStr,
        session_time: sessionTime,
        service_name: serviceName,
        total_price: new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(booking.total_price || 0),
        dp_paid: new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(booking.dp_paid || 0),
        studio_name: studioName || "",
        freelancer_name: freelancerName || "",
        event_type: booking.event_type || "-",
        location: booking.location || "-",
        location_maps_url: booking.location ? `https://maps.google.com/maps?q=${encodeURIComponent(booking.location)}` : "-",
        detail_location: booking.location_detail || "-",
        notes: booking.notes || "-",
        tracking_link: booking.tracking_uuid ? `${siteUrl}/id/track/${booking.tracking_uuid}` : "-",
        invoice_url: `${siteUrl}/api/public/invoice?code=${encodeURIComponent(booking.booking_code)}`,
        ...buildExtraFieldTemplateVars(booking.extra_fields),
        ...buildCustomFieldTemplateVars(booking.extra_fields),
    };

    function applyVars(tpl: string) {
        return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`);
    }

    if (freelancerName) {
        const content = getWhatsAppTemplateContent(
            savedTemplates,
            "whatsapp_freelancer",
            locale,
            booking.event_type,
        );
        return applyVars(content);
    }

    const content = getWhatsAppTemplateContent(
        savedTemplates,
        "whatsapp_client",
        locale,
    );
    return applyVars(content);
}

export default function BookingsPage() {
    const supabase = createClient();
    const t = useTranslations("Bookings");
    const tb = useTranslations("BookingsPage");
    const locale = useLocale();
    const [bookings, setBookings] = React.useState<Booking[]>([]);
    const [savedTemplates, setSavedTemplates] = React.useState<SavedTemplate[]>([]);
    const [packages, setPackages] = React.useState<string[]>([]);
    const [freelancerNames, setFreelancerNames] = React.useState<string[]>([]);
    const [formSectionsByEventType, setFormSectionsByEventType] = React.useState<Record<string, FormLayoutItem[]>>({});
    const [loading, setLoading] = React.useState(true);
    const [copiedId, setCopiedId] = React.useState<string | null>(null);
    const [studioName, setStudioName] = React.useState("");
    const [statusOpts, setStatusOpts] = React.useState<string[]>(DEFAULT_STATUS_OPTS);
    const [defaultWaTarget, setDefaultWaTarget] = React.useState<"client" | "freelancer">("client");
    const [columns, setColumns] = React.useState<TableColumnPreference[]>(lockBoundaryColumns(BASE_BOOKING_COLUMNS));
    const [columnManagerOpen, setColumnManagerOpen] = React.useState(false);
    const [savingColumns, setSavingColumns] = React.useState(false);

    // Filters & Search
    const [searchQuery, setSearchQuery] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState("All");
    const [packageFilter, setPackageFilter] = React.useState("All");
    const [freelanceFilter, setFreelanceFilter] = React.useState("All");
    const [eventTypeFilter, setEventTypeFilter] = React.useState("All");
    const [dateFromFilter, setDateFromFilter] = React.useState("");
    const [dateToFilter, setDateToFilter] = React.useState("");
    const [extraFieldFilters, setExtraFieldFilters] = React.useState<Record<string, string>>({});
    const [sortOrder, setSortOrder] = React.useState<"booking_newest" | "booking_oldest" | "session_newest" | "session_oldest">("booking_newest");
    const [showFilterPanel, setShowFilterPanel] = React.useState(false);
    const [currentPage, setCurrentPage] = React.useState(1);
    const [itemsPerPage, setItemsPerPage] = React.useState(10);

    // Modals
    const [statusModal, setStatusModal] = React.useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });
    const [newStatus, setNewStatus] = React.useState("");
    const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);

    const [deleteModal, setDeleteModal] = React.useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });
    const [isDeleting, setIsDeleting] = React.useState(false);

    // Drive link popup
    const [driveLinkPopup, setDriveLinkPopup] = React.useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });
    const [driveLinkInput, setDriveLinkInput] = React.useState("");
    const [savingDriveLink, setSavingDriveLink] = React.useState(false);
    const statusColors = React.useMemo(() => {
        const map: Record<string, string> = {};
        statusOpts
            .filter((status) => status.toLowerCase() !== "batal")
            .forEach((status, index) => {
                map[status] = STATUS_COLOR_PALETTE[index % STATUS_COLOR_PALETTE.length];
            });
        map.Batal = "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-none";
        return map;
    }, [statusOpts]);

    // WA Freelancer popup
    const [waPopup, setWaPopup] = React.useState<{ open: boolean; freelancers: FreelancerInfo[]; booking: Booking | null }>({ open: false, freelancers: [], booking: null });

    const fetchTemplates = React.useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from("templates").select("id, type, name, content, content_en, event_type").eq("user_id", user.id);
        setSavedTemplates((data || []) as SavedTemplate[]);
    }, [supabase]);




    const fetchData = React.useCallback(async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch studio name for WA templates
        const { data: profile } = await supabase.from("profiles").select("studio_name, custom_client_statuses, default_wa_target, form_sections, table_column_preferences").eq("id", user.id).single();
        const profileData = profile as ({
            studio_name?: string | null;
            custom_client_statuses?: string[] | null;
            default_wa_target?: "client" | "freelancer" | null;
            form_sections?: unknown;
            table_column_preferences?: { bookings?: TableColumnPreference[] } | null;
        } & Record<string, unknown>) | null;
        const rawSections = (profile as Record<string, unknown> | null)?.form_sections;
        const resolvedSections =
            rawSections && typeof rawSections === "object" && !Array.isArray(rawSections)
                ? (rawSections as Record<string, FormLayoutItem[]>)
                : Array.isArray(rawSections)
                    ? { Umum: rawSections as FormLayoutItem[] }
                    : {};

        if (profile?.studio_name) setStudioName(profile.studio_name);
        setStatusOpts(getBookingStatusOptions(profileData?.custom_client_statuses));
        if (profileData?.default_wa_target) setDefaultWaTarget(profileData.default_wa_target);
        if (rawSections && typeof rawSections === "object" && !Array.isArray(rawSections)) {
            setFormSectionsByEventType(rawSections as Record<string, FormLayoutItem[]>);
        } else if (Array.isArray(rawSections)) {
            setFormSectionsByEventType({ Umum: rawSections as FormLayoutItem[] });
        } else {
            setFormSectionsByEventType({});
        }

        const { data } = await supabase
            .from("bookings")
            .select("id, booking_code, client_name, client_whatsapp, session_date, status, total_price, dp_paid, drive_folder_url, location, location_detail, notes, event_type, tracking_uuid, extra_fields, created_at, services(id, name, price, is_addon), booking_services(id, kind, sort_order, service:services(id, name, price, is_addon)), freelance(id, name, whatsapp_number), booking_freelance(freelance_id, freelance(id, name, whatsapp_number))")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        // Normalize: merge booking_freelancers into a flat array
        type BookingRow = Omit<Booking, "booking_freelancers" | "service_selections" | "service_label"> & {
            freelance?: FreelancerInfo | null;
            booking_freelance?: Array<{ freelance: FreelancerInfo | null }>;
        };
        const bgs = ((data || []) as unknown as BookingRow[]).map((b) => {
            const junctionFreelancers = (b.booking_freelance || []).map((bf) => bf.freelance).filter((item): item is FreelancerInfo => Boolean(item));
            const legacyService = normalizeLegacyServiceRecord(b.services);
            const serviceSelections = normalizeBookingServiceSelections(
                b.booking_services,
                b.services,
            );
            return {
                ...b,
                booking_freelancers: junctionFreelancers.length > 0 ? junctionFreelancers : b.freelance ? [b.freelance] : [],
                service_selections: serviceSelections,
                service_label: getBookingServiceLabel(serviceSelections, { kind: "main", fallback: legacyService?.name || "-" }),
            };
        }) as unknown as Booking[];
        const nextColumnDefaults = lockBoundaryColumns([
            ...BASE_BOOKING_COLUMNS.slice(0, -1),
            ...buildBookingMetadataColumns(bgs, resolvedSections),
            BASE_BOOKING_COLUMNS[BASE_BOOKING_COLUMNS.length - 1],
        ]);
        setBookings(bgs);
        setColumns(
            mergeTableColumnPreferences(
                nextColumnDefaults,
                profileData?.table_column_preferences?.bookings,
            ),
        );
        setPackages(Array.from(new Set(bgs.flatMap(b => getBookingServiceNames(b.service_selections || [], "main")).filter(Boolean))) as string[]);
        setFreelancerNames(Array.from(new Set(bgs.flatMap(b => b.booking_freelancers.map(f => f.name)).filter(Boolean))) as string[]);
        setLoading(false);
    }, [supabase]);

    async function saveColumnPreferences(nextColumns: TableColumnPreference[]) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setSavingColumns(true);
        const { data: profile } = await supabase
            .from("profiles")
            .select("table_column_preferences")
            .eq("id", user.id)
            .single();
        const payload = updateTableColumnPreferenceMap(
            profile?.table_column_preferences,
            "bookings",
            nextColumns,
        );
        await supabase
            .from("profiles")
            .update({ table_column_preferences: payload })
            .eq("id", user.id);
        setColumns(nextColumns);
        setSavingColumns(false);
        setColumnManagerOpen(false);
    }

    React.useEffect(() => {
        void fetchData();
        void fetchTemplates();
    }, [fetchData, fetchTemplates]);

    async function handleUpdateStatus() {
        if (!statusModal.booking || !newStatus) return;
        setIsUpdatingStatus(true);
        const { error } = await supabase.from("bookings").update({ status: newStatus, client_status: newStatus }).eq("id", statusModal.booking.id);
        if (!error) {
            setBookings(prev => prev.map(b => b.id === statusModal.booking?.id ? { ...b, status: newStatus } : b));
            setStatusModal({ open: false, booking: null });
        } else { alert(tb("failedUpdateStatus")); }
        setIsUpdatingStatus(false);
    }

    async function confirmDelete() {
        if (!deleteModal.booking) return;
        setIsDeleting(true);
        const { error } = await supabase.from("bookings").delete().eq("id", deleteModal.booking.id);
        if (!error) {
            setBookings(prev => prev.filter(b => b.id !== deleteModal.booking?.id));
            setDeleteModal({ open: false, booking: null });
        } else { alert(tb("failedDeleteBooking")); }
        setIsDeleting(false);
    }

    function sendWhatsAppClient(booking: Booking) {
        if (!booking.client_whatsapp) { alert(tb("waNotAvailable")); return; }
        const cleaned = booking.client_whatsapp.replace(/^0/, "62").replace(/[^0-9]/g, "");
        const msg = encodeURIComponent(generateWATemplate(booking, locale, savedTemplates, studioName));
        window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${msg}`, "_blank");
    }

    function copyTemplate(booking: Booking) {
        const template = generateWATemplate(booking, locale, savedTemplates, studioName);
        navigator.clipboard.writeText(template);
        setCopiedId(booking.id);
        setTimeout(() => setCopiedId(null), 2000);
    }

    const formatDate = (d: string | null) => {
        if (!d) return "-";
        return formatSessionDate(d, { locale: locale === "en" ? "en" : "id", withDay: false });
    };

    const formatCurrency = (n: number) =>
        n ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n) : "-";

    function renderDesktopHeader(column: TableColumnPreference) {
        switch (column.id) {
            case "name":
                return <th key={column.id} className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{t("namaKlien")}</th>;
            case "invoice":
                return <th key={column.id} className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{tb("invoice")}</th>;
            case "package":
                return <th key={column.id} className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{t("paket")}</th>;
            case "schedule":
                return <th key={column.id} className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{t("jadwal")}</th>;
            case "location":
                return <th key={column.id} className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{tb("location")}</th>;
            case "status":
                return <th key={column.id} className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{t("status")}</th>;
            case "freelancer":
                return <th key={column.id} className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{t("freelancer")}</th>;
            case "price":
                return <th key={column.id} className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{t("harga")}</th>;
            case "actions":
                return <th key={column.id} className="min-w-[220px] px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap text-right">{t("aksi")}</th>;
            default:
                return <th key={column.id} className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{column.label}</th>;
        }
    }

    function renderDesktopCell(booking: Booking, column: TableColumnPreference) {
        switch (column.id) {
            case "name":
                return (
                    <td key={column.id} className="px-4 py-3 max-w-[140px]">
                        <div className="font-medium text-foreground truncate">{booking.client_name}</div>
                        {booking.client_whatsapp && (
                            <div className="text-[11px] text-muted-foreground truncate">{booking.client_whatsapp}</div>
                        )}
                    </td>
                );
            case "invoice":
                return (
                    <td key={column.id} className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[10px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded border border-border/50">
                            {booking.booking_code}
                        </span>
                    </td>
                );
            case "package":
                return <td key={column.id} className="px-4 py-3 max-w-[150px] truncate text-muted-foreground" title={booking.service_label || booking.services?.name || "-"}>{booking.service_label || booking.services?.name || "-"}</td>;
            case "schedule":
                return <td key={column.id} className="px-4 py-3 whitespace-nowrap text-muted-foreground font-light">{formatDate(booking.session_date)}</td>;
            case "location":
                return (
                    <td key={column.id} className="px-4 py-3 max-w-[180px]">
                        {booking.location ? (
                            <div className="flex items-center gap-1">
                                <span className="truncate text-xs text-muted-foreground" title={booking.location}>{booking.location}</span>
                                <button type="button" onClick={() => window.open(`https://maps.google.com/maps?q=${encodeURIComponent(booking.location!)}`, "_blank")}
                                    className="text-blue-500 hover:text-blue-600 transition-colors shrink-0">
                                    <MapPin className="w-3 h-3" />
                                </button>
                            </div>
                        ) : <span className="text-muted-foreground">-</span>}
                    </td>
                );
            case "status":
                return <td key={column.id} className="px-4 py-3 whitespace-nowrap"><StatusBadge status={booking.status} statusClass={statusColors[booking.status]} /></td>;
            case "freelancer":
                return (
                    <td key={column.id} className="px-4 py-3 max-w-[130px] truncate text-muted-foreground" title={booking.booking_freelancers.length > 0 ? booking.booking_freelancers.map(f => f.name).join(", ") : "-"}>
                        {booking.booking_freelancers.length > 0
                            ? booking.booking_freelancers.map(f => f.name).join(", ")
                            : "-"}
                    </td>
                );
            case "price":
                return <td key={column.id} className="px-4 py-3 whitespace-nowrap font-medium text-foreground">{formatCurrency(booking.total_price)}</td>;
            case "actions":
                return (
                    <td key={column.id} className="min-w-[220px] px-4 py-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                            <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-violet-500 hover:bg-transparent hover:text-violet-600" title={tb("copyTemplate")}
                                onClick={() => copyTemplate(booking)}>
                                {copiedId === booking.id ? <ClipboardCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-green-500 hover:bg-transparent hover:text-green-600"
                                title={booking.booking_freelancers.length > 0 ? `${tb("waFreelance")} (${booking.booking_freelancers.length})` : tb("whatsapp")}
                                disabled={booking.booking_freelancers.length === 0 && !booking.client_whatsapp}
                                onClick={() => {
                                    if (defaultWaTarget === "client" || booking.booking_freelancers.length === 0) {
                                        if (booking.client_whatsapp) sendWhatsAppClient(booking);
                                        else if (booking.booking_freelancers.length === 1 && booking.booking_freelancers[0].whatsapp_number) {
                                            const f = booking.booking_freelancers[0];
                                            const cleaned = f.whatsapp_number!.replace(/^0/, "62").replace(/[^0-9]/g, "");
                                            const msg = encodeURIComponent(generateWATemplate(booking, locale, savedTemplates, studioName, f.name));
                                            window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${msg}`, "_blank");
                                        }
                                    } else {
                                        if (booking.booking_freelancers.length > 1) {
                                            setWaPopup({ open: true, freelancers: booking.booking_freelancers, booking });
                                        } else if (booking.booking_freelancers.length === 1 && booking.booking_freelancers[0].whatsapp_number) {
                                            const f = booking.booking_freelancers[0];
                                            const cleaned = f.whatsapp_number!.replace(/^0/, "62").replace(/[^0-9]/g, "");
                                            const msg = encodeURIComponent(generateWATemplate(booking, locale, savedTemplates, studioName, f.name));
                                            window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${msg}`, "_blank");
                                        } else {
                                            sendWhatsAppClient(booking);
                                        }
                                    }
                                }}>
                                <MessageCircle className="w-4 h-4" />
                            </Button>
                            {booking.drive_folder_url ? (
                                <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-blue-500 hover:bg-transparent hover:text-blue-600" title={tb("openDrive")} onClick={() => window.open(booking.drive_folder_url!, "_blank")}>
                                    <Folder className="w-4 h-4" />
                                </Button>
                            ) : (
                                <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-blue-400 hover:bg-transparent hover:text-blue-500" title="Set Link Drive"
                                    onClick={() => { setDriveLinkInput(""); setDriveLinkPopup({ open: true, booking }); }}>
                                    <Link2 className="w-4 h-4" />
                                </Button>
                            )}
                            <Link href={`/bookings/${booking.id}`}>
                                <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-slate-500 hover:bg-transparent hover:text-slate-700" title={tb("detail")}>
                                    <Info className="w-4 h-4" />
                                </Button>
                            </Link>
                            <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-orange-500 hover:bg-transparent hover:text-orange-600" title={tb("changeStatusBtn")}
                                onClick={() => { setNewStatus(booking.status); setStatusModal({ open: true, booking }); }}>
                                <RefreshCcw className="w-4 h-4" />
                            </Button>
                            <Link href={`/bookings/${booking.id}/edit`}>
                                <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-blue-500 hover:bg-transparent hover:text-blue-600" title={tb("editBtn")}>
                                    <Edit2 className="w-4 h-4" />
                                </Button>
                            </Link>
                            <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-red-500 hover:bg-transparent hover:text-red-600" title={tb("deleteBtn")}
                                onClick={() => setDeleteModal({ open: true, booking })}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </td>
                );
            default:
                return (
                    <td key={column.id} className="px-4 py-3 max-w-[180px] truncate text-muted-foreground" title={getBookingMetadataValue(booking.extra_fields, column.id)}>
                        {getBookingMetadataValue(booking.extra_fields, column.id)}
                    </td>
                );
        }
    }

    function renderMobileValue(booking: Booking, column: TableColumnPreference) {
        switch (column.id) {
            case "invoice":
                return booking.booking_code;
            case "package":
                return booking.service_label || booking.services?.name || "-";
            case "schedule":
                return formatDate(booking.session_date);
            case "location":
                return booking.location || "-";
            case "status":
                return booking.status;
            case "freelancer":
                return booking.booking_freelancers.length > 0
                    ? booking.booking_freelancers.map((freelancer) => freelancer.name).join(", ")
                    : "-";
            case "price":
                return formatCurrency(booking.total_price);
            default:
                return getBookingMetadataValue(booking.extra_fields, column.id);
        }
    }

    const activeExtraFilterFields = React.useMemo<BookingFilterField[]>(() => {
        if (eventTypeFilter === "All") return [];

        const builtInFields: BookingFilterField[] = getEventExtraFields(eventTypeFilter).map((field) => ({
            key: field.key,
            label: field.label,
            mode: "contains",
        }));
        const customFields = getGroupedCustomLayoutSections(
            formSectionsByEventType[eventTypeFilter] || formSectionsByEventType.Umum || [],
            eventTypeFilter,
        )
            .flatMap((section) => section.items)
            .filter((item): item is Extract<FormLayoutItem, { kind: "custom_field" }> => item.kind === "custom_field")
            .map((item) => ({
                key: item.id,
                label: item.label,
                mode: item.type === "select" || item.type === "checkbox" ? "exact" as const : "contains" as const,
                options: item.options,
            }));

        return [...builtInFields, ...customFields].map((field) => ({
            ...field,
            options: field.mode === "exact"
                ? Array.from(new Set(
                    (field.options && field.options.length > 0
                        ? field.options
                        : bookings.map((booking) => {
                            const customSnapshot = extractCustomFieldSnapshots(booking.extra_fields).find((item) => item.id === field.key);
                            return customSnapshot?.value || "";
                        })
                    ).filter((value): value is string => typeof value === "string" && value.trim().length > 0),
                ))
                : undefined,
        }));
    }, [bookings, eventTypeFilter, formSectionsByEventType]);

    React.useEffect(() => {
        setExtraFieldFilters((prev) =>
            Object.fromEntries(
                Object.entries(prev).filter(([key]) =>
                    activeExtraFilterFields.some((field) => field.key === key),
                ),
            ),
        );
    }, [activeExtraFilterFields]);

    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, statusFilter, packageFilter, freelanceFilter, eventTypeFilter, dateFromFilter, dateToFilter, extraFieldFilters, sortOrder]);

    const orderedVisibleColumns = React.useMemo(
        () => columns.filter((column) => column.visible),
        [columns],
    );

    React.useEffect(() => {
        const nextDefaults = lockBoundaryColumns([
            ...BASE_BOOKING_COLUMNS.slice(0, -1),
            ...buildBookingMetadataColumns(bookings, formSectionsByEventType),
            BASE_BOOKING_COLUMNS[BASE_BOOKING_COLUMNS.length - 1],
        ]);
        setColumns((current) => mergeTableColumnPreferences(nextDefaults, current));
    }, [bookings, formSectionsByEventType]);

    const filteredBookings = bookings.filter(b => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = !searchQuery || (
            b.client_name.toLowerCase().includes(q) ||
            b.booking_code.toLowerCase().includes(q) ||
            (b.location && b.location.toLowerCase().includes(q))
        );
        const matchesStatus = statusFilter === "All" || b.status === statusFilter;
        const matchesPackage = packageFilter === "All" || getBookingServiceNames(b.service_selections || [], "main").includes(packageFilter);
        const matchesFreelance = freelanceFilter === "All" || b.booking_freelancers.some(f => f.name === freelanceFilter);
        const sessionDateValue = b.session_date ? b.session_date.slice(0, 10) : "";
        const matchesDateFrom = !dateFromFilter || (sessionDateValue && sessionDateValue >= dateFromFilter);
        const matchesDateTo = !dateToFilter || (sessionDateValue && sessionDateValue <= dateToFilter);
        const matchesEventType = eventTypeFilter === "All" || b.event_type === eventTypeFilter;
        const builtInExtraFields = extractBuiltInExtraFieldValues(b.extra_fields);
        const customFieldMap = Object.fromEntries(
            extractCustomFieldSnapshots(b.extra_fields).map((item) => [item.id, item.value]),
        ) as Record<string, string>;
        const matchesExtraFields = activeExtraFilterFields.every((field) => {
            const filterValue = extraFieldFilters[field.key]?.trim();
            if (!filterValue) return true;
            const sourceValue = (builtInExtraFields[field.key] || customFieldMap[field.key] || "").trim();
            if (!sourceValue) return false;
            return field.mode === "exact"
                ? sourceValue === filterValue
                : sourceValue.toLowerCase().includes(filterValue.toLowerCase());
        });
        return matchesSearch && matchesStatus && matchesPackage && matchesFreelance && matchesDateFrom && matchesDateTo && matchesEventType && matchesExtraFields;
    }).sort((a, b) => {
        if (sortOrder === "booking_newest") {
            return (b.created_at || "").localeCompare(a.created_at || "");
        }
        if (sortOrder === "booking_oldest") {
            return (a.created_at || "").localeCompare(b.created_at || "");
        }
        if (sortOrder === "session_newest") {
            return (a.session_date || "").localeCompare(b.session_date || "");
        }
        return (b.session_date || "").localeCompare(a.session_date || "");
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h2>
                    <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="gap-2 h-9" onClick={() => {
                        const exportData = filteredBookings.map((b: Booking) => ({
                            [tb("exportBookingCode")]: b.booking_code,
                            [tb("exportClientName")]: b.client_name,
                            [tb("exportWhatsApp")]: b.client_whatsapp || "",
                            [tb("exportSessionDate")]: b.session_date ? formatSessionDate(b.session_date, { dateOnly: true }) : "",
                            [tb("exportLocation")]: b.location || "",
                            [tb("exportPackage")]: b.service_label || b.services?.name || "",
                            [tb("exportTotalPrice")]: b.total_price || 0,
                            [tb("exportDPPaid")]: b.dp_paid || 0,
                            [tb("exportStatus")]: b.status,
                        }));
                        const ws = XLSX.utils.json_to_sheet(exportData);
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, "Bookings");
                        XLSX.writeFile(wb, `bookings_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
                    }}>
                        <Download className="w-4 h-4" /> {tb("export")}
                    </Button>
                    <TableColumnManager
                        title="Kelola Kolom Daftar Booking"
                        description="Atur kolom yang ditampilkan dan ubah urutannya. Kolom Nama dan Aksi selalu terkunci."
                        columns={columns}
                        open={columnManagerOpen}
                        onOpenChange={setColumnManagerOpen}
                        onChange={setColumns}
                        onSave={() => saveColumnPreferences(columns)}
                        saving={savingColumns}
                    />
                    <BatchImportButton onImported={() => fetchData()} />
                    <Link href="/bookings/new">
                        <Button className="gap-2 h-9 bg-foreground text-background hover:bg-foreground/90">
                            <Plus className="w-4 h-4" /> {tb("addClient")}
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Search + Controls */}
            <div className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={tb("searchPlaceholder")}
                            className="h-9 w-full rounded-md border border-input bg-background/50 pl-9 pr-3 text-sm focus-visible:ring-1 focus-visible:ring-ring outline-none transition-all"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            variant="outline"
                            className="h-9 gap-2"
                            onClick={() => setShowFilterPanel(prev => !prev)}
                        >
                            <ListOrdered className="w-4 h-4" />
                            Filter
                        </Button>
                        <select value={sortOrder} onChange={e => setSortOrder(e.target.value as typeof sortOrder)} className={selectFilterClass}>
                            <option value="booking_newest">Urutkan: Booking Terbaru</option>
                            <option value="booking_oldest">Urutkan: Booking Terlama</option>
                            <option value="session_newest">Urutkan: Jadwal Sesi Terdekat</option>
                            <option value="session_oldest">Urutkan: Jadwal Sesi Terjauh</option>
                        </select>
                        {(statusFilter !== "All" || packageFilter !== "All" || freelanceFilter !== "All" || eventTypeFilter !== "All" || dateFromFilter || dateToFilter || Object.values(extraFieldFilters).some(Boolean) || searchQuery || sortOrder !== "booking_newest") && (
                            <button
                                onClick={() => {
                                    setStatusFilter("All");
                                    setPackageFilter("All");
                                    setFreelanceFilter("All");
                                    setEventTypeFilter("All");
                                    setDateFromFilter("");
                                    setDateToFilter("");
                                    setExtraFieldFilters({});
                                    setSearchQuery("");
                                    setSortOrder("booking_newest");
                                }}
                                className="h-9 px-3 rounded-md border border-input bg-background/50 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" /> Reset
                            </button>
                        )}
                    </div>
                </div>
                {showFilterPanel && (
                    <div className="rounded-xl border bg-card p-5 shadow-sm">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            <div className="space-y-1.5 md:space-y-0 md:flex md:items-center md:gap-4">
                                <label className="text-xs font-medium text-muted-foreground md:w-24 md:shrink-0">Tanggal dari</label>
                                <input type="date" value={dateFromFilter} onChange={e => setDateFromFilter(e.target.value)} className={`${selectFilterClass} w-full`} />
                            </div>
                            <div className="space-y-1.5 md:space-y-0 md:flex md:items-center md:gap-4">
                                <label className="text-xs font-medium text-muted-foreground md:w-24 md:shrink-0">Tanggal sampai</label>
                                <input type="date" value={dateToFilter} onChange={e => setDateToFilter(e.target.value)} className={`${selectFilterClass} w-full`} />
                            </div>
                            <div className="space-y-1.5 md:space-y-0 md:flex md:items-center md:gap-4">
                                <label className="text-xs font-medium text-muted-foreground md:w-24 md:shrink-0">Jenis acara</label>
                                <select value={eventTypeFilter} onChange={e => setEventTypeFilter(e.target.value)} className={`${selectFilterClass} w-full`}>
                                    <option value="All">Semua Acara</option>
                                    {Array.from(new Set(bookings.map(b => b.event_type).filter(Boolean))).sort().map(t => (
                                        <option key={t} value={t!}>{t}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5 md:space-y-0 md:flex md:items-center md:gap-4">
                                <label className="text-xs font-medium text-muted-foreground md:w-24 md:shrink-0">Status</label>
                                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${selectFilterClass} w-full`}>
                                    <option value="All">{tb("allStatus")}</option>
                                    {statusOpts.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5 md:space-y-0 md:flex md:items-center md:gap-4">
                                <label className="text-xs font-medium text-muted-foreground md:w-24 md:shrink-0">Paket</label>
                                <select value={packageFilter} onChange={e => setPackageFilter(e.target.value)} className={`${selectFilterClass} w-full`}>
                                    <option value="All">{tb("allPackages")}</option>
                                    {packages.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5 md:space-y-0 md:flex md:items-center md:gap-4">
                                <label className="text-xs font-medium text-muted-foreground md:w-24 md:shrink-0">Freelance</label>
                                <select value={freelanceFilter} onChange={e => setFreelanceFilter(e.target.value)} className={`${selectFilterClass} w-full`}>
                                    <option value="All">{tb("allFreelance")}</option>
                                    {freelancerNames.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                            </div>
                            {activeExtraFilterFields.map((field) => (
                                <div key={field.key} className="space-y-1.5 md:space-y-0 md:flex md:items-center md:gap-4">
                                    <label className="text-xs font-medium text-muted-foreground md:w-24 md:shrink-0">{field.label}</label>
                                    {field.mode === "exact" ? (
                                        <select
                                            value={extraFieldFilters[field.key] || ""}
                                            onChange={e => setExtraFieldFilters(prev => ({ ...prev, [field.key]: e.target.value }))}
                                            className={`${selectFilterClass} w-full`}
                                        >
                                            <option value="">Semua</option>
                                            {(field.options || []).map((option) => (
                                                <option key={option} value={option}>{option}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={extraFieldFilters[field.key] || ""}
                                            onChange={e => setExtraFieldFilters(prev => ({ ...prev, [field.key]: e.target.value }))}
                                            placeholder={`Filter ${field.label.toLowerCase()}...`}
                                            className={`${selectFilterClass} w-full`}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
                {loading ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : filteredBookings.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">{tb("noDataFound")}</div>
                ) : (
                    paginateArray(filteredBookings, currentPage, itemsPerPage).map((booking) => (
                        <div key={booking.id} className="rounded-xl border bg-card shadow-sm p-4 space-y-3">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="font-semibold">{booking.client_name}</p>
                                    <p className="text-xs text-muted-foreground">{booking.booking_code}</p>
                                </div>
                                <StatusBadge status={booking.status} statusClass={statusColors[booking.status]} />
                            </div>
                            <div className="border-t pt-2 space-y-1.5 text-sm text-muted-foreground">
                                {orderedVisibleColumns
                                    .filter((column) => column.id !== "name" && column.id !== "actions")
                                    .map((column) => (
                                        <div key={column.id} className="flex items-start justify-between gap-3">
                                            <span className="shrink-0">{column.label}</span>
                                            <span className="max-w-[180px] truncate text-right text-foreground" title={String(renderMobileValue(booking, column) ?? "-")}>
                                                {renderMobileValue(booking, column)}
                                            </span>
                                        </div>
                                    ))}
                            </div>
                            <div className="flex items-center gap-1 pt-1 border-t flex-wrap">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-violet-500" title={tb("copyTemplate")} onClick={() => copyTemplate(booking)}>
                                    {copiedId === booking.id ? <ClipboardCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500" title={tb("whatsapp")}
                                    disabled={booking.booking_freelancers.length === 0 && !booking.client_whatsapp}
                                    onClick={() => {
                                        if (defaultWaTarget === "client" || booking.booking_freelancers.length === 0) {
                                            if (booking.client_whatsapp) sendWhatsAppClient(booking);
                                            else if (booking.booking_freelancers.length === 1 && booking.booking_freelancers[0].whatsapp_number) {
                                                const f = booking.booking_freelancers[0];
                                                const cleaned = f.whatsapp_number!.replace(/^0/, "62").replace(/[^0-9]/g, "");
                                                const msg = encodeURIComponent(generateWATemplate(booking, locale, savedTemplates, studioName, f.name));
                                                window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${msg}`, "_blank");
                                            }
                                        } else {
                                            if (booking.booking_freelancers.length > 1) { setWaPopup({ open: true, freelancers: booking.booking_freelancers, booking }); }
                                            else if (booking.booking_freelancers.length === 1 && booking.booking_freelancers[0].whatsapp_number) {
                                                const f = booking.booking_freelancers[0];
                                                const cleaned = f.whatsapp_number!.replace(/^0/, "62").replace(/[^0-9]/g, "");
                                                const msg = encodeURIComponent(generateWATemplate(booking, locale, savedTemplates, studioName, f.name));
                                                window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${msg}`, "_blank");
                                            } else { sendWhatsAppClient(booking); }
                                        }
                                    }}>
                                    <MessageCircle className="w-4 h-4" />
                                </Button>
                                <Link href={`/bookings/${booking.id}`}><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500"><Info className="w-4 h-4" /></Button></Link>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-500" onClick={() => { setNewStatus(booking.status); setStatusModal({ open: true, booking }); }}>
                                    <RefreshCcw className="w-4 h-4" />
                                </Button>
                                <Link href={`/bookings/${booking.id}/edit`}><Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500"><Edit2 className="w-4 h-4" /></Button></Link>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setDeleteModal({ open: true, booking })}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Desktop Table */}
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden hidden md:block">
                <div className="relative overflow-x-auto">
                    <table className="min-w-[1320px] w-full text-sm text-left border-collapse">
                        <thead className="text-[11px] uppercase bg-card border-b">
                            <tr>
                                {orderedVisibleColumns.map((column) => renderDesktopHeader(column))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {loading ? (
                                <tr><td colSpan={columns.filter((column) => column.visible).length} className="px-6 py-12 text-center text-muted-foreground">{t("memuat")}</td></tr>
                            ) : filteredBookings.length === 0 ? (
                                <tr><td colSpan={columns.filter((column) => column.visible).length} className="px-6 py-12 text-center text-muted-foreground text-xs italic">{tb("noDataFound")}</td></tr>
                            ) : (
                                paginateArray(filteredBookings, currentPage, itemsPerPage).map((booking) => (
                                    <tr key={booking.id} className="hover:bg-muted/30 transition-colors group">
                                        {orderedVisibleColumns.map((column) => renderDesktopCell(booking, column))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <TablePagination totalItems={filteredBookings.length} currentPage={currentPage} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} />
            </div>

            {/* Status Change Modal */}
            <Dialog open={statusModal.open} onOpenChange={(o) => !o && setStatusModal({ open: false, booking: null })}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{tb("changeStatus")}</DialogTitle>
                        <DialogDescription>
                            {tb("changeStatusDesc")} <strong>{statusModal.booking?.client_name}</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2 grid grid-cols-3 gap-2">
                        {statusOpts.map((opt) => (
                            <button key={opt} onClick={() => setNewStatus(opt)}
                                className={cn("flex items-center justify-center p-3 rounded-lg border text-xs font-medium transition-all hover:bg-muted/50",
                                    newStatus === opt ? "border-foreground bg-foreground/5 dark:bg-foreground/10" : "border-border text-muted-foreground")}>
                                <StatusBadge status={opt} statusClass={statusColors[opt]} className="scale-110" />
                            </button>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setStatusModal({ open: false, booking: null })} disabled={isUpdatingStatus}>{tb("cancel")}</Button>
                        <Button onClick={handleUpdateStatus} disabled={isUpdatingStatus || newStatus === statusModal.booking?.status}>
                            {isUpdatingStatus ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                            {tb("saveChanges")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Modal */}
            <Dialog open={deleteModal.open} onOpenChange={(o) => !o && setDeleteModal({ open: false, booking: null })}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader className="items-center text-center">
                        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-2">
                            <AlertCircle className="w-6 h-6 text-red-600" />
                        </div>
                        <DialogTitle className="text-xl">{tb("deleteBooking")}</DialogTitle>
                        <DialogDescription>
                            {tb("deleteBookingDesc", { name: deleteModal.booking?.client_name || "" })}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="sm:justify-center gap-2 pt-2">
                        <Button variant="outline" className="flex-1" onClick={() => setDeleteModal({ open: false, booking: null })} disabled={isDeleting}>{tb("cancel")}</Button>
                        <Button variant="destructive" className="flex-1" onClick={confirmDelete} disabled={isDeleting}>
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                            {tb("yesDelete")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* WA Freelancer Selection Popup */}
            <Dialog open={waPopup.open} onOpenChange={(o) => !o && setWaPopup({ open: false, freelancers: [], booking: null })}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{tb("waFreelance")}</DialogTitle>
                        <DialogDescription>{tb("selectFreelance")}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2 py-2">
                        {waPopup.freelancers.map((f) => (
                            <button
                                key={f.id}
                                disabled={!f.whatsapp_number}
                                onClick={() => {
                                    if (!f.whatsapp_number) return;
                                    const cleaned = f.whatsapp_number.replace(/^0/, "62").replace(/[^0-9]/g, "");
                                    const msg = waPopup.booking ? encodeURIComponent(generateWATemplate(waPopup.booking, locale, savedTemplates, studioName, f.name)) : encodeURIComponent(`Halo ${f.name}!`);
                                    window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${msg}`, "_blank");
                                    setWaPopup({ open: false, freelancers: [], booking: null });
                                }}
                                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-500/10 flex items-center justify-center shrink-0">
                                    <MessageCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">{f.name}</p>
                                    <p className="text-xs text-muted-foreground">{f.whatsapp_number || tb("numberNotAvailable")}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Drive Link Popup */}
            <Dialog open={driveLinkPopup.open} onOpenChange={(o) => { if (!o) setDriveLinkPopup({ open: false, booking: null }); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{tb("setDriveLink")}</DialogTitle>
                        <DialogDescription>{tb("setDriveLinkDesc")}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <input
                            type="url"
                            value={driveLinkInput}
                            onChange={e => setDriveLinkInput(e.target.value)}
                            placeholder="https://drive.google.com/drive/folders/..."
                            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDriveLinkPopup({ open: false, booking: null })}>{tb("cancel")}</Button>
                        <Button disabled={!driveLinkInput || savingDriveLink} className="gap-2" onClick={async () => {
                            if (!driveLinkPopup.booking || !driveLinkInput) return;
                            setSavingDriveLink(true);
                            await supabase.from("bookings").update({ drive_folder_url: driveLinkInput }).eq("id", driveLinkPopup.booking.id);
                            setBookings(prev => prev.map(b => b.id === driveLinkPopup.booking?.id ? { ...b, drive_folder_url: driveLinkInput } : b));
                            setSavingDriveLink(false);
                            setDriveLinkPopup({ open: false, booking: null });
                        }}>
                            {savingDriveLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                            {tb("save")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function StatusBadge({ status, className, statusClass }: { status: string; className?: string; statusClass?: string }) {
    if (statusClass) {
        return <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 font-medium rounded-full whitespace-nowrap border-none", statusClass, className)}>{status}</Badge>;
    }
    let variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" = "default";
    let customClass = "";
    switch (status.toLowerCase()) {
        case "pending": variant = "secondary"; customClass = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-none"; break;
        case "dp": variant = "warning"; break;
        case "terjadwal": variant = "default"; customClass = "bg-blue-500 text-white hover:bg-blue-600 border-none shadow-sm"; break;
        case "edit": case "cetak": variant = "outline"; customClass = "border-blue-200 text-blue-600 dark:border-blue-900/50 dark:text-blue-400"; break;
        case "selesai": variant = "success"; break;
        case "batal": variant = "destructive"; break;
    }
    return <Badge variant={variant} className={cn("text-[10px] px-2 py-0.5 font-medium rounded-full whitespace-nowrap", customClass, className)}>{status}</Badge>;
}
