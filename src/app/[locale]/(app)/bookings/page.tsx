"use client";

import * as React from "react";
import { Plus, Folder, Edit2, Trash2, Link2, Loader2, Info, Search, MapPin, RefreshCcw, CheckCircle2, AlertCircle, MessageCircle, Copy, ClipboardCheck, X, Download, ListOrdered, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionIconButton } from "@/components/ui/action-icon-button";
import { ActionFeedbackDialog } from "@/components/ui/action-feedback-dialog";
import { CancelStatusPaymentDialog } from "@/components/cancel-status-payment-dialog";
import { formatSessionDate, formatSessionTime, formatTemplateSessionDate } from "@/utils/format-date";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import {
    BookingWriteReadonlyBanner,
    useBookingWriteAccess,
    useBookingWriteGuard,
} from "@/lib/booking-write-access-context";
import { getBookingWriteBlockedMessage } from "@/lib/booking-write-access";
import { cn } from "@/lib/utils";
import { BatchImportButton } from "@/components/batch-import";
import { PageHeader } from "@/components/ui/page-header";
import { TablePagination } from "@/components/ui/table-pagination";
import { TableActionMenuPortal } from "@/components/ui/table-action-menu-portal";
import { useSuccessToast } from "@/components/ui/success-toast";
import { CardListSkeleton, TableRowsSkeleton } from "@/components/ui/data-skeletons";
import {
    buildExtraFieldTemplateVars,
    buildMultiSessionTemplateVars,
    getEventExtraFields,
} from "@/utils/form-extra-fields";
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
    resolveUnifiedBookingStatus,
} from "@/lib/client-status";
import {
    buildGoogleMapsQueryUrl,
    buildGoogleMapsUrlOrFallback,
} from "@/utils/location";
import { buildWhatsAppUrl, openWhatsAppUrl } from "@/utils/whatsapp-link";
import {
    isTransitionToCancelled,
    syncGoogleCalendarForStatusTransition,
} from "@/utils/google-calendar-status-sync";
import { buildCancelPaymentPatch, type CancelPaymentPolicy } from "@/lib/cancel-payment";
import { buildAutoDpVerificationPatch } from "@/lib/final-settlement";
import { fetchPaginatedJson } from "@/lib/pagination/http";
import type { PaginatedQueryState } from "@/lib/pagination/types";
import * as XLSX from "xlsx";

const selectFilterClass = "h-9 rounded-md border border-input bg-background/50 px-3 pr-8 text-sm outline-none cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23999%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

type FreelancerInfo = { id: string; name: string; whatsapp_number: string | null };

type Booking = {
    id: string;
    booking_code: string;
    client_name: string;
    client_whatsapp: string | null;
    booking_date: string | null;
    session_date: string | null;
    status: string;
    client_status: string | null;
    queue_position: number | null;
    total_price: number;
    dp_paid: number;
    dp_verified_amount?: number | null;
    dp_verified_at?: string | null;
    dp_refund_amount?: number | null;
    dp_refunded_at?: string | null;
    drive_folder_url: string | null;
    fastpik_project_id: string | null;
    fastpik_project_link: string | null;
    fastpik_project_edit_link: string | null;
    location: string | null;
    location_lat: number | null;
    location_lng: number | null;
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
    { id: "booking_date", label: "Tanggal Booking", visible: true },
    { id: "package", label: "Paket", visible: true },
    { id: "schedule", label: "Jadwal", visible: true },
    { id: "location", label: "Lokasi", visible: true },
    { id: "status", label: "Status", visible: true },
    { id: "freelancer", label: "Freelance", visible: true },
    { id: "price", label: "Harga", visible: true },
    { id: "actions", label: "Aksi", visible: true, locked: true },
];
const BOOKING_FILTER_STORAGE_PREFIX = "clientdesk:bookings:filters";
const BOOKING_ITEMS_PER_PAGE_STORAGE_PREFIX = "clientdesk:bookings:items_per_page";
const PAGINATION_PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;
const DEFAULT_ITEMS_PER_PAGE = 10;
const BOOKING_SORT_ORDERS = [
    "booking_newest",
    "booking_oldest",
    "session_newest",
    "session_oldest",
] as const;
type BookingSortOrder = (typeof BOOKING_SORT_ORDERS)[number];

type BookingFilterStoragePayload = {
    searchQuery: string;
    statusFilter: string;
    packageFilter: string;
    freelanceFilter: string;
    eventTypeFilter: string;
    dateFromFilter: string;
    dateToFilter: string;
    extraFieldFilters: Record<string, string>;
    sortOrder: BookingSortOrder;
};

type BookingPageMetadata = {
    studioName: string;
    statusOptions: string[];
    queueTriggerStatus: string;
    dpVerifyTriggerStatus: string;
    defaultWaTarget: "client" | "freelancer";
    packages: string[];
    freelancerNames: string[];
    availableEventTypes: string[];
    formSectionsByEventType: Record<string, FormLayoutItem[]>;
    tableColumnPreferences: TableColumnPreference[] | null;
    metadataRows: Array<{
        event_type?: string | null;
        extra_fields?: Record<string, unknown> | null;
    }>;
    extraFieldRows: Array<{
        event_type?: string | null;
        extra_fields?: Record<string, unknown> | null;
    }>;
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeItemsPerPageValue(value: unknown) {
    const parsed = typeof value === "number" ? value : Number(value);
    return PAGINATION_PER_PAGE_OPTIONS.includes(
        parsed as (typeof PAGINATION_PER_PAGE_OPTIONS)[number],
    )
        ? parsed
        : DEFAULT_ITEMS_PER_PAGE;
}

type SavedTemplate = {
    id: string;
    type: string;
    name?: string | null;
    content: string;
    content_en: string;
    event_type: string | null;
};

function generateWATemplate(booking: Booking, locale: string, savedTemplates: SavedTemplate[], studioName: string, freelancerName?: string) {
    const templateLocale = locale === "en" ? "en" : "id";
    const sessionStr = booking.session_date ? formatTemplateSessionDate(booking.session_date, { locale: locale === "en" ? "en" : "id" }) : "-";
    const sessionTime = booking.session_date ? formatSessionTime(booking.session_date) : "-";
    const serviceName = booking.service_label || booking.services?.name || "-";

    // Build replacement map
    const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
    const vars: Record<string, string> = {
        client_name: booking.client_name,
        client_whatsapp: booking.client_whatsapp || "-",
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
        location_maps_url: buildGoogleMapsUrlOrFallback(
            {
                address: booking.location,
                lat: booking.location_lat,
                lng: booking.location_lng,
            },
            "-",
        ),
        detail_location: booking.location_detail || "-",
        notes: booking.notes || "-",
        tracking_link: booking.tracking_uuid ? `${siteUrl}/id/track/${booking.tracking_uuid}` : "-",
        invoice_url: `${siteUrl}/api/public/invoice?code=${encodeURIComponent(booking.booking_code)}`,
        ...buildExtraFieldTemplateVars(booking.extra_fields),
        ...buildMultiSessionTemplateVars(booking.extra_fields, {
            locale: templateLocale,
        }),
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
        booking.event_type,
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
    const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
    const [filtersHydrated, setFiltersHydrated] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [copiedClientTemplateId, setCopiedClientTemplateId] = React.useState<string | null>(null);
    const [copiedFreelancerTemplateId, setCopiedFreelancerTemplateId] = React.useState<string | null>(null);
    const [studioName, setStudioName] = React.useState("");
    const [statusOpts, setStatusOpts] = React.useState<string[]>(DEFAULT_STATUS_OPTS);
    const [queueTriggerStatus, setQueueTriggerStatus] = React.useState("Antrian Edit");
    const [dpVerifyTriggerStatus, setDpVerifyTriggerStatus] = React.useState("");
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
    const [sortOrder, setSortOrder] = React.useState<BookingSortOrder>("booking_newest");
    const [showFilterPanel, setShowFilterPanel] = React.useState(false);
    const [currentPage, setCurrentPage] = React.useState(1);
    const [itemsPerPage, setItemsPerPage] = React.useState(10);
    const [itemsPerPageHydrated, setItemsPerPageHydrated] = React.useState(false);
    const [totalItems, setTotalItems] = React.useState(0);
    const [availableEventTypes, setAvailableEventTypes] = React.useState<string[]>([]);
    const [metadataRows, setMetadataRows] = React.useState<Array<{ event_type?: string | null; extra_fields?: Record<string, unknown> | null }>>([]);
    const [extraFieldRows, setExtraFieldRows] = React.useState<Array<{ event_type?: string | null; extra_fields?: Record<string, unknown> | null }>>([]);

    // Modals
    const [statusModal, setStatusModal] = React.useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });
    const [cancelStatusConfirmOpen, setCancelStatusConfirmOpen] = React.useState(false);
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
    const [copyFreelancerPopup, setCopyFreelancerPopup] = React.useState<{ open: boolean; freelancers: FreelancerInfo[]; booking: Booking | null }>({ open: false, freelancers: [], booking: null });
    const [waMenuBookingId, setWaMenuBookingId] = React.useState<string | null>(null);
    const [copyMenuBookingId, setCopyMenuBookingId] = React.useState<string | null>(null);
    const [waMenuAnchorEl, setWaMenuAnchorEl] = React.useState<HTMLElement | null>(null);
    const [copyMenuAnchorEl, setCopyMenuAnchorEl] = React.useState<HTMLElement | null>(null);
    const [waTargetPopup, setWaTargetPopup] = React.useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });
    const [copyTargetPopup, setCopyTargetPopup] = React.useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });
    const [feedbackDialog, setFeedbackDialog] = React.useState<{ open: boolean; message: string }>({ open: false, message: "" });
    const { showSuccessToast, successToastNode } = useSuccessToast();
    const { canWriteBookings } = useBookingWriteAccess();
    const bookingWriteBlockedMessage = React.useMemo(
        () => getBookingWriteBlockedMessage(locale),
        [locale],
    );
    const requireBookingWrite = useBookingWriteGuard(({ message }) => {
        setFeedbackDialog({ open: true, message });
    });
    const hasLoadedBookingsRef = React.useRef(false);

    const closeDesktopMenus = React.useCallback(() => {
        setWaMenuBookingId(null);
        setCopyMenuBookingId(null);
        setWaMenuAnchorEl(null);
        setCopyMenuAnchorEl(null);
    }, []);

    const resetFilters = React.useCallback(() => {
        setStatusFilter("All");
        setPackageFilter("All");
        setFreelanceFilter("All");
        setEventTypeFilter("All");
        setDateFromFilter("");
        setDateToFilter("");
        setExtraFieldFilters({});
        setSearchQuery("");
        setSortOrder("booking_newest");
    }, []);

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
                // Silent by design: Drive link update should not fail due to integration sync.
            }
        },
        [locale],
    );

    const fetchTemplates = React.useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from("templates").select("id, type, name, content, content_en, event_type").eq("user_id", user.id);
        setSavedTemplates((data || []) as SavedTemplate[]);
    }, [supabase]);
    const fetchData = React.useCallback(async (mode: "initial" | "refresh" = "refresh") => {
        if (!itemsPerPageHydrated || !filtersHydrated) return;

        if (mode === "initial") {
            setLoading(true);
        } else {
            setRefreshing(true);
        }

        try {
            const params = new URLSearchParams({
                page: String(currentPage),
                perPage: String(itemsPerPage),
                search: searchQuery,
                status: statusFilter,
                package: packageFilter,
                freelance: freelanceFilter,
                eventType: eventTypeFilter,
                dateFrom: dateFromFilter,
                dateTo: dateToFilter,
                sortOrder,
                extraFilters: JSON.stringify(extraFieldFilters),
            });

            const response = await fetchPaginatedJson<Booking, BookingPageMetadata>(
                `/api/internal/bookings?${params.toString()}`,
            );
            const metadata = response.metadata;
            const nextColumnDefaults = lockBoundaryColumns([
                ...BASE_BOOKING_COLUMNS.slice(0, -1),
                ...buildBookingMetadataColumns(
                    metadata?.metadataRows || [],
                    metadata?.formSectionsByEventType || {},
                ),
                BASE_BOOKING_COLUMNS[BASE_BOOKING_COLUMNS.length - 1],
            ]);

            setBookings(response.items);
            setTotalItems(response.totalItems);
            setStudioName(metadata?.studioName || "");
            setStatusOpts(metadata?.statusOptions || DEFAULT_STATUS_OPTS);
            setQueueTriggerStatus(metadata?.queueTriggerStatus || "Antrian Edit");
            setDpVerifyTriggerStatus(metadata?.dpVerifyTriggerStatus || "");
            setDefaultWaTarget(metadata?.defaultWaTarget || "client");
            setPackages(metadata?.packages || []);
            setFreelancerNames(metadata?.freelancerNames || []);
            setAvailableEventTypes(metadata?.availableEventTypes || []);
            setFormSectionsByEventType(metadata?.formSectionsByEventType || {});
            setMetadataRows(metadata?.metadataRows || []);
            setExtraFieldRows(metadata?.extraFieldRows || []);
            setColumns(
                mergeTableColumnPreferences(
                    nextColumnDefaults,
                    metadata?.tableColumnPreferences || undefined,
                ),
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [
        currentPage,
        dateFromFilter,
        dateToFilter,
        eventTypeFilter,
        extraFieldFilters,
        filtersHydrated,
        freelanceFilter,
        itemsPerPage,
        itemsPerPageHydrated,
        packageFilter,
        searchQuery,
        sortOrder,
        statusFilter,
    ]);

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
        async function hydrateCurrentUser() {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUserId(user?.id || null);
        }

        void hydrateCurrentUser();
        void fetchTemplates();
    }, [fetchTemplates, supabase]);

    React.useEffect(() => {
        if (!currentUserId) return;
        setFiltersHydrated(false);
        const storageKey = `${BOOKING_FILTER_STORAGE_PREFIX}:${currentUserId}`;

        try {
            const raw = window.localStorage.getItem(storageKey);
            if (!raw) {
                resetFilters();
                return;
            }

            const parsed = JSON.parse(raw) as unknown;
            if (!isObjectRecord(parsed)) {
                resetFilters();
                return;
            }

            const readString = (key: keyof BookingFilterStoragePayload, fallback: string) => {
                const value = parsed[key];
                return typeof value === "string" ? value : fallback;
            };

            setSearchQuery(readString("searchQuery", ""));
            setStatusFilter(readString("statusFilter", "All") || "All");
            setPackageFilter(readString("packageFilter", "All") || "All");
            setFreelanceFilter(readString("freelanceFilter", "All") || "All");
            setEventTypeFilter(readString("eventTypeFilter", "All") || "All");
            setDateFromFilter(readString("dateFromFilter", ""));
            setDateToFilter(readString("dateToFilter", ""));

            const rawExtraFieldFilters = parsed.extraFieldFilters;
            if (isObjectRecord(rawExtraFieldFilters)) {
                const normalizedExtraFilters = Object.fromEntries(
                    Object.entries(rawExtraFieldFilters).filter(
                        ([, value]) => typeof value === "string",
                    ),
                ) as Record<string, string>;
                setExtraFieldFilters(normalizedExtraFilters);
            } else {
                setExtraFieldFilters({});
            }

            const parsedSortOrder = parsed.sortOrder;
            setSortOrder(
                typeof parsedSortOrder === "string" &&
                    BOOKING_SORT_ORDERS.includes(parsedSortOrder as BookingSortOrder)
                    ? (parsedSortOrder as BookingSortOrder)
                    : "booking_newest",
            );
        } catch {
            resetFilters();
        } finally {
            setFiltersHydrated(true);
        }
    }, [currentUserId, resetFilters]);

    React.useEffect(() => {
        if (!currentUserId) {
            setItemsPerPageHydrated(false);
            return;
        }
        const storageKey = `${BOOKING_ITEMS_PER_PAGE_STORAGE_PREFIX}:${currentUserId}`;

        try {
            const raw = window.localStorage.getItem(storageKey);
            setItemsPerPage(normalizeItemsPerPageValue(raw));
        } catch {
            setItemsPerPage(DEFAULT_ITEMS_PER_PAGE);
        } finally {
            setItemsPerPageHydrated(true);
        }
    }, [currentUserId]);

    React.useEffect(() => {
        if (!currentUserId || !itemsPerPageHydrated) return;
        const storageKey = `${BOOKING_ITEMS_PER_PAGE_STORAGE_PREFIX}:${currentUserId}`;

        try {
            window.localStorage.setItem(storageKey, String(normalizeItemsPerPageValue(itemsPerPage)));
        } catch {
            // Ignore storage write failures.
        }
    }, [currentUserId, itemsPerPage, itemsPerPageHydrated]);

    React.useEffect(() => {
        if (!currentUserId) return;
        const storageKey = `${BOOKING_ITEMS_PER_PAGE_STORAGE_PREFIX}:${currentUserId}`;
        function handleStorage(event: StorageEvent) {
            if (event.storageArea !== window.localStorage) return;
            if (event.key !== storageKey) return;
            setItemsPerPage(normalizeItemsPerPageValue(event.newValue));
        }
        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, [currentUserId]);

    React.useEffect(() => {
        if (!itemsPerPageHydrated || !filtersHydrated) return;
        const mode = hasLoadedBookingsRef.current ? "refresh" : "initial";
        hasLoadedBookingsRef.current = true;
        void fetchData(mode);
    }, [fetchData, filtersHydrated, itemsPerPageHydrated]);

    React.useEffect(() => {
        if (!waMenuBookingId && !copyMenuBookingId) return;
        function handleOutsideClick(event: MouseEvent) {
            const target = event.target as HTMLElement | null;
            if (target?.closest("[data-wa-menu-root='true']")) return;
            if (target?.closest("[data-copy-menu-root='true']")) return;
            if (target?.closest("[data-table-action-menu-root='true']")) return;
            closeDesktopMenus();
        }
        function handleEscape(event: KeyboardEvent) {
            if (event.key !== "Escape") return;
            closeDesktopMenus();
        }
        document.addEventListener("mousedown", handleOutsideClick);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [closeDesktopMenus, copyMenuBookingId, waMenuBookingId]);

    async function handleUpdateStatus(options?: {
        skipCancelConfirmation?: boolean;
        cancelPayment?: { policy: CancelPaymentPolicy; refundAmount: number };
    }) {
        if (!requireBookingWrite()) return;
        if (!statusModal.booking || !newStatus) return;
        const activeBooking = bookings.find((booking) => booking.id === statusModal.booking?.id) || statusModal.booking;
        const bookingId = activeBooking.id;
        const previousStatus = activeBooking.client_status || activeBooking.status || null;
        const nextStatus = newStatus || null;

        if (
            isTransitionToCancelled(previousStatus, nextStatus) &&
            !options?.skipCancelConfirmation
        ) {
            setCancelStatusConfirmOpen(true);
            return;
        }

        setIsUpdatingStatus(true);
        const trigger = queueTriggerStatus?.trim();
        const wasQueue = Boolean(trigger) && previousStatus === trigger;
        const isQueue = Boolean(trigger) && nextStatus === trigger;
        const isCancelling = isTransitionToCancelled(previousStatus, nextStatus);
        const cancelPatch = isCancelling
            ? buildCancelPaymentPatch({
                policy: options?.cancelPayment?.policy || "forfeit",
                refundAmount: options?.cancelPayment?.refundAmount || 0,
                verifiedAmount: activeBooking.dp_verified_amount || 0,
            })
            : null;
        const autoDpPatch = buildAutoDpVerificationPatch({
            previousStatus,
            nextStatus,
            triggerStatus: dpVerifyTriggerStatus,
            dpPaid: activeBooking.dp_paid,
            dpVerifiedAt: activeBooking.dp_verified_at,
        });

        try {
            if (isQueue && !wasQueue) {
                const { data: queueRows } = await supabase
                    .from("bookings")
                    .select("queue_position")
                    .eq("client_status", trigger)
                    .not("queue_position", "is", null);
                const maxPos = ((queueRows || []) as Array<{ queue_position?: number | null }>)
                    .reduce((max, booking) => Math.max(max, booking.queue_position || 0), 0);
                const newPos = maxPos + 1;
                const { error } = await supabase
                    .from("bookings")
                    .update({
                        status: nextStatus,
                        client_status: nextStatus,
                        queue_position: newPos,
                        ...(cancelPatch || {}),
                        ...(autoDpPatch || {}),
                    })
                    .eq("id", bookingId);
                if (error) {
                    setFeedbackDialog({ open: true, message: tb("failedUpdateStatus") });
                    return;
                }
            } else if (wasQueue && !isQueue) {
                const { error } = await supabase
                    .from("bookings")
                    .update({
                        status: nextStatus,
                        client_status: nextStatus,
                        queue_position: null,
                        ...(cancelPatch || {}),
                        ...(autoDpPatch || {}),
                    })
                    .eq("id", bookingId);
                if (error) {
                    setFeedbackDialog({ open: true, message: tb("failedUpdateStatus") });
                    return;
                }

                const { data: remainingQueueRows } = await supabase
                    .from("bookings")
                    .select("id, queue_position")
                    .eq("client_status", trigger)
                    .neq("id", bookingId)
                    .not("queue_position", "is", null)
                    .order("queue_position", { ascending: true });
                const remainingQueue = ((remainingQueueRows || []) as Array<{ id: string; queue_position?: number | null }>);
                for (let i = 0; i < remainingQueue.length; i += 1) {
                    await supabase.from("bookings").update({ queue_position: i + 1 }).eq("id", remainingQueue[i].id);
                }
            } else {
                const { error } = await supabase
                    .from("bookings")
                    .update({
                        status: nextStatus,
                        client_status: nextStatus,
                        ...(cancelPatch || {}),
                        ...(autoDpPatch || {}),
                    })
                    .eq("id", bookingId);
                if (error) {
                    setFeedbackDialog({ open: true, message: tb("failedUpdateStatus") });
                    return;
                }
            }

            setCancelStatusConfirmOpen(false);
            setStatusModal({ open: false, booking: null });
            const calendarWarning = await syncGoogleCalendarForStatusTransition({
                bookingId,
                previousStatus,
                nextStatus,
                locale,
            });
            if (calendarWarning) {
                setFeedbackDialog({ open: true, message: calendarWarning });
            }
            void fetchData("refresh");
        } finally {
            setIsUpdatingStatus(false);
        }
    }

    async function confirmDelete() {
        if (!requireBookingWrite()) return;
        if (!deleteModal.booking) return;
        setIsDeleting(true);

        const bookingToDelete = deleteModal.booking;
        const warningDetails: string[] = [];

        try {
            const calendarRes = await fetch("/api/google/calendar-delete-booking", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bookingId: bookingToDelete.id }),
            });
            const calendarResult = await calendarRes.json().catch(() => null) as {
                success?: boolean;
                failedCount?: number;
                errors?: string[];
                error?: string;
            } | null;

            if (!calendarRes.ok) {
                warningDetails.push(
                    locale === "en"
                        ? `Google Calendar event deletion failed: ${calendarResult?.error || "Unknown error"}`
                        : `Event Google Calendar gagal dihapus: ${calendarResult?.error || "Unknown error"}`,
                );
            } else if (calendarResult && calendarResult.success === false) {
                const firstError = Array.isArray(calendarResult.errors) ? calendarResult.errors[0] : null;
                warningDetails.push(
                    locale === "en"
                        ? `Some Google Calendar events failed to delete.${firstError ? ` ${firstError}` : ""}`
                        : `Sebagian event Google Calendar gagal dihapus.${firstError ? ` ${firstError}` : ""}`,
                );
            }
        } catch {
            warningDetails.push(
                locale === "en"
                    ? "Failed to remove Google Calendar event."
                    : "Event Google Calendar gagal dihapus.",
            );
        }

        const hasFastpikProject = Boolean(
            bookingToDelete.fastpik_project_id?.trim() ||
            bookingToDelete.fastpik_project_link?.trim() ||
            bookingToDelete.fastpik_project_edit_link?.trim(),
        );

        if (hasFastpikProject) {
            try {
                const fastpikRes = await fetch("/api/integrations/fastpik/delete-booking-project", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        bookingId: bookingToDelete.id,
                        locale,
                    }),
                });
                const fastpikResult = await fastpikRes.json().catch(() => null) as {
                    success?: boolean;
                    message?: string;
                    error?: string;
                } | null;

                if (!fastpikRes.ok || fastpikResult?.success === false) {
                    const reason =
                        (typeof fastpikResult?.message === "string" &&
                            fastpikResult.message.trim()) ||
                        (typeof fastpikResult?.error === "string" &&
                            fastpikResult.error.trim()) ||
                        "Unknown error";
                    warningDetails.push(
                        locale === "en"
                            ? `Fastpik project deletion failed: ${reason}`
                            : `Project Fastpik gagal dihapus: ${reason}`,
                    );
                }
            } catch {
                warningDetails.push(
                    locale === "en"
                        ? "Failed to delete Fastpik project."
                        : "Project Fastpik gagal dihapus.",
                );
            }
        }

        const { error } = await supabase.from("bookings").delete().eq("id", bookingToDelete.id);
        if (!error) {
            setDeleteModal({ open: false, booking: null });
            void fetchData("refresh");
            if (warningDetails.length > 0) {
                const warningMessage = locale === "en"
                    ? `Booking deleted with warning${warningDetails.length > 1 ? "s" : ""}: ${warningDetails.join(" ")}`
                    : `Booking berhasil dihapus dengan peringatan: ${warningDetails.join(" ")}`;
                setFeedbackDialog({ open: true, message: warningMessage });
            }
        } else {
            setFeedbackDialog({ open: true, message: tb("failedDeleteBooking") });
        }
        setIsDeleting(false);
    }

    function sendWhatsAppClient(booking: Booking) {
        if (!booking.client_whatsapp) {
            setFeedbackDialog({ open: true, message: tb("waNotAvailable") });
            return;
        }
        const cleaned = booking.client_whatsapp.replace(/^0/, "62").replace(/[^0-9]/g, "");
        const msg = generateWATemplate(booking, locale, savedTemplates, studioName);
        openWhatsAppUrl(buildWhatsAppUrl(cleaned, msg));
    }

    function sendWhatsAppFreelancer(booking: Booking, freelancer: FreelancerInfo) {
        if (!freelancer.whatsapp_number) {
            setFeedbackDialog({ open: true, message: tb("waFreelancerNotAvailable") });
            return;
        }
        const cleaned = freelancer.whatsapp_number.replace(/^0/, "62").replace(/[^0-9]/g, "");
        const msg = generateWATemplate(booking, locale, savedTemplates, studioName, freelancer.name);
        openWhatsAppUrl(buildWhatsAppUrl(cleaned, msg));
    }

    function handleDefaultWhatsAppAction(booking: Booking) {
        if (defaultWaTarget === "client" || booking.booking_freelancers.length === 0) {
            if (booking.client_whatsapp) sendWhatsAppClient(booking);
            else if (booking.booking_freelancers.length === 1 && booking.booking_freelancers[0].whatsapp_number) {
                sendWhatsAppFreelancer(booking, booking.booking_freelancers[0]);
            }
            return;
        }

        if (booking.booking_freelancers.length > 1) {
            setWaPopup({ open: true, freelancers: booking.booking_freelancers, booking });
        } else if (booking.booking_freelancers.length === 1 && booking.booking_freelancers[0].whatsapp_number) {
            sendWhatsAppFreelancer(booking, booking.booking_freelancers[0]);
        } else {
            sendWhatsAppClient(booking);
        }
    }

    function handleExplicitWhatsAppAction(booking: Booking, target: "client" | "freelancer") {
        if (target === "client") {
            if (!booking.client_whatsapp) {
                setFeedbackDialog({ open: true, message: tb("waNotAvailable") });
                return;
            }
            sendWhatsAppClient(booking);
            return;
        }

        if (booking.booking_freelancers.length === 0) {
            setFeedbackDialog({ open: true, message: tb("waFreelancerNotAvailable") });
            return;
        }

        if (booking.booking_freelancers.length > 1) {
            if (!booking.booking_freelancers.some((freelancer) => freelancer.whatsapp_number)) {
                setFeedbackDialog({ open: true, message: tb("waFreelancerNotAvailable") });
                return;
            }
            setWaPopup({ open: true, freelancers: booking.booking_freelancers, booking });
            return;
        }

        const freelancer = booking.booking_freelancers[0];
        if (!freelancer.whatsapp_number) {
            setFeedbackDialog({ open: true, message: tb("waFreelancerNotAvailable") });
            return;
        }
        sendWhatsAppFreelancer(booking, freelancer);
    }

    async function copyClientTemplate(booking: Booking) {
        const template = generateWATemplate(booking, locale, savedTemplates, studioName);
        try {
            await navigator.clipboard.writeText(template);
            showSuccessToast("Template klien berhasil disalin.");
            setCopiedClientTemplateId(booking.id);
            setTimeout(() => {
                setCopiedClientTemplateId((current) => current === booking.id ? null : current);
            }, 2000);
        } catch {
            setFeedbackDialog({
                open: true,
                message: locale === "en" ? "Failed to copy client template." : "Gagal menyalin template klien.",
            });
        }
    }

    async function copyFreelancerTemplate(booking: Booking, freelancer: FreelancerInfo) {
        const template = generateWATemplate(
            booking,
            locale,
            savedTemplates,
            studioName,
            freelancer.name,
        );
        try {
            await navigator.clipboard.writeText(template);
            showSuccessToast("Template freelance berhasil disalin.");
            setCopiedFreelancerTemplateId(booking.id);
            setTimeout(() => {
                setCopiedFreelancerTemplateId((current) => current === booking.id ? null : current);
            }, 2000);
        } catch {
            setFeedbackDialog({
                open: true,
                message:
                    locale === "en"
                        ? "Failed to copy freelancer template."
                        : "Gagal menyalin template freelance.",
            });
        }
    }

    function handleDefaultCopyAction(booking: Booking) {
        void copyClientTemplate(booking);
    }

    function handleExplicitCopyAction(booking: Booking, target: "client" | "freelancer") {
        if (target === "client") {
            void copyClientTemplate(booking);
            return;
        }

        if (booking.booking_freelancers.length === 0) {
            setFeedbackDialog({ open: true, message: tb("templateFreelancerNotAvailable") });
            return;
        }

        if (booking.booking_freelancers.length > 1) {
            setCopyFreelancerPopup({ open: true, freelancers: booking.booking_freelancers, booking });
            return;
        }

        void copyFreelancerTemplate(booking, booking.booking_freelancers[0]);
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
            case "booking_date":
                return <th key={column.id} className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Tanggal Booking</th>;
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
            case "booking_date":
                return (
                    <td key={column.id} className="px-4 py-3 whitespace-nowrap text-muted-foreground font-light">
                        {booking.booking_date
                            ? formatSessionDate(booking.booking_date, {
                                locale: locale === "en" ? "en" : "id",
                                withDay: false,
                                withTime: false,
                                dateOnly: true,
                            })
                            : "-"}
                    </td>
                );
            case "schedule":
                return <td key={column.id} className="px-4 py-3 whitespace-nowrap text-muted-foreground font-light">{formatDate(booking.session_date)}</td>;
            case "location":
                return (
                    <td key={column.id} className="px-4 py-3 max-w-[180px]">
                        {booking.location ? (
                            <div className="flex items-center gap-1">
                                <span className="truncate text-xs text-muted-foreground" title={booking.location}>{booking.location}</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const mapsUrl = buildGoogleMapsQueryUrl({
                                            address: booking.location,
                                            lat: booking.location_lat,
                                            lng: booking.location_lng,
                                        });
                                        if (mapsUrl) window.open(mapsUrl, "_blank");
                                    }}
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
                            <div className="relative" data-copy-menu-root="true">
                                <div className="flex items-stretch overflow-hidden rounded-md border border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                                    <button
                                        type="button"
                                        title={tb("copyPrimaryAction")}
                                        onClick={() => {
                                            closeDesktopMenus();
                                            handleDefaultCopyAction(booking);
                                        }}
                                        className="inline-flex h-8 w-8 items-center justify-center transition-colors hover:bg-violet-100 dark:hover:bg-violet-800/60"
                                    >
                                        {copiedClientTemplateId === booking.id ? (
                                            <ClipboardCheck className="w-4 h-4" />
                                        ) : (
                                            <Copy className="w-4 h-4" />
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        title={tb("copyMoreActions")}
                                        onClick={(event) => {
                                            const anchorEl = event.currentTarget;
                                            const shouldClose = copyMenuBookingId === booking.id;
                                            setWaMenuBookingId(null);
                                            setWaMenuAnchorEl(null);
                                            setCopyMenuBookingId(shouldClose ? null : booking.id);
                                            setCopyMenuAnchorEl(shouldClose ? null : anchorEl);
                                        }}
                                        className="inline-flex h-8 w-6 items-center justify-center border-l border-violet-200 transition-colors hover:bg-violet-100 dark:border-violet-700 dark:hover:bg-violet-800/60"
                                    >
                                        <ChevronDown className="w-3 h-3" />
                                    </button>
                                </div>
                                <TableActionMenuPortal
                                    open={copyMenuBookingId === booking.id}
                                    anchorEl={copyMenuAnchorEl}
                                    className="w-48"
                                >
                                        <button
                                            type="button"
                                            onClick={() => {
                                                closeDesktopMenus();
                                                handleExplicitCopyAction(booking, "client");
                                            }}
                                            className="flex w-full items-center rounded px-2.5 py-2 text-left text-xs text-foreground transition-colors hover:bg-muted"
                                        >
                                            {tb("copyToClient")}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                closeDesktopMenus();
                                                handleExplicitCopyAction(booking, "freelancer");
                                            }}
                                            className="flex w-full items-center rounded px-2.5 py-2 text-left text-xs text-foreground transition-colors hover:bg-muted"
                                        >
                                            {tb("copyToFreelancer")}
                                        </button>
                                </TableActionMenuPortal>
                            </div>
                            <div className="relative" data-wa-menu-root="true">
                                <div className="flex items-stretch overflow-hidden rounded-md border border-green-200 bg-green-50 text-green-600 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300">
                                    <button
                                        type="button"
                                        title={tb("waPrimaryAction")}
                                        disabled={booking.booking_freelancers.length === 0 && !booking.client_whatsapp}
                                        onClick={() => {
                                            closeDesktopMenus();
                                            handleDefaultWhatsAppAction(booking);
                                        }}
                                        className="inline-flex h-8 w-8 items-center justify-center transition-colors hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-green-800/60"
                                    >
                                        <MessageCircle className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        title={tb("waMoreActions")}
                                        disabled={booking.booking_freelancers.length === 0 && !booking.client_whatsapp}
                                        onClick={(event) => {
                                            const anchorEl = event.currentTarget;
                                            const shouldClose = waMenuBookingId === booking.id;
                                            setCopyMenuBookingId(null);
                                            setCopyMenuAnchorEl(null);
                                            setWaMenuBookingId(shouldClose ? null : booking.id);
                                            setWaMenuAnchorEl(shouldClose ? null : anchorEl);
                                        }}
                                        className="inline-flex h-8 w-6 items-center justify-center border-l border-green-200 transition-colors hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-green-700 dark:hover:bg-green-800/60"
                                    >
                                        <ChevronDown className="w-3 h-3" />
                                    </button>
                                </div>
                                <TableActionMenuPortal
                                    open={waMenuBookingId === booking.id}
                                    anchorEl={waMenuAnchorEl}
                                    className="w-44"
                                >
                                        <button
                                            type="button"
                                            onClick={() => {
                                                closeDesktopMenus();
                                                handleExplicitWhatsAppAction(booking, "client");
                                            }}
                                            className="flex w-full items-center rounded px-2.5 py-2 text-left text-xs text-foreground transition-colors hover:bg-muted"
                                        >
                                            {tb("sendToClient")}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                closeDesktopMenus();
                                                handleExplicitWhatsAppAction(booking, "freelancer");
                                            }}
                                            className="flex w-full items-center rounded px-2.5 py-2 text-left text-xs text-foreground transition-colors hover:bg-muted"
                                        >
                                            {tb("sendToFreelancer")}
                                        </button>
                                </TableActionMenuPortal>
                            </div>
                            {booking.drive_folder_url ? (
                                <ActionIconButton tone="blue" title={tb("openDrive")} onClick={() => window.open(booking.drive_folder_url!, "_blank")}>
                                    <Folder className="w-4 h-4" />
                                </ActionIconButton>
                            ) : (
                                <ActionIconButton
                                    tone="blue"
                                    title={!canWriteBookings ? bookingWriteBlockedMessage : "Set Link Drive"}
                                    onClick={() => { setDriveLinkInput(""); setDriveLinkPopup({ open: true, booking }); }}
                                    disabled={!canWriteBookings}
                                >
                                    <Link2 className="w-4 h-4" />
                                </ActionIconButton>
                            )}
                            <Link href={`/bookings/${booking.id}`}>
                                <ActionIconButton tone="slate" title={tb("detail")}>
                                    <Info className="w-4 h-4" />
                                </ActionIconButton>
                            </Link>
                            <ActionIconButton
                                tone="orange"
                                title={!canWriteBookings ? bookingWriteBlockedMessage : tb("changeStatusBtn")}
                                onClick={() => { setNewStatus(booking.client_status || booking.status); setStatusModal({ open: true, booking }); }}
                                disabled={!canWriteBookings}
                            >
                                <RefreshCcw className="w-4 h-4" />
                            </ActionIconButton>
                            {canWriteBookings ? (
                                <Link href={`/bookings/${booking.id}/edit`}>
                                    <ActionIconButton tone="indigo" title={tb("editBtn")}>
                                        <Edit2 className="w-4 h-4" />
                                    </ActionIconButton>
                                </Link>
                            ) : (
                                <ActionIconButton tone="indigo" title={bookingWriteBlockedMessage} disabled>
                                    <Edit2 className="w-4 h-4" />
                                </ActionIconButton>
                            )}
                            <ActionIconButton
                                tone="red"
                                title={!canWriteBookings ? bookingWriteBlockedMessage : tb("deleteBtn")}
                                onClick={() => setDeleteModal({ open: true, booking })}
                                disabled={!canWriteBookings}
                            >
                                <Trash2 className="w-4 h-4" />
                            </ActionIconButton>
                        </div>
                    </td>
                );
            default:
                return (
                    <td key={column.id} className="px-4 py-3 max-w-[180px] truncate text-muted-foreground" title={getBookingMetadataValue(booking.extra_fields, column.id, { locale: locale === "en" ? "en" : "id" })}>
                        {getBookingMetadataValue(booking.extra_fields, column.id, { locale: locale === "en" ? "en" : "id" })}
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
            case "booking_date":
                return booking.booking_date
                    ? formatSessionDate(booking.booking_date, {
                        locale: locale === "en" ? "en" : "id",
                        withDay: false,
                        withTime: false,
                        dateOnly: true,
                    })
                    : "-";
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
                return getBookingMetadataValue(booking.extra_fields, column.id, { locale: locale === "en" ? "en" : "id" });
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
                        : extraFieldRows.map((booking) => {
                            const customSnapshot = extractCustomFieldSnapshots(booking.extra_fields).find((item) => item.id === field.key);
                            return customSnapshot?.value || "";
                        })
                    ).filter((value): value is string => typeof value === "string" && value.trim().length > 0),
                ))
                : undefined,
        }));
    }, [eventTypeFilter, extraFieldRows, formSectionsByEventType]);

    React.useEffect(() => {
        if (!filtersHydrated || loading || refreshing) return;

        if (statusFilter !== "All" && !statusOpts.includes(statusFilter)) {
            setStatusFilter("All");
        }
        if (packageFilter !== "All" && !packages.includes(packageFilter)) {
            setPackageFilter("All");
        }
        if (freelanceFilter !== "All" && !freelancerNames.includes(freelanceFilter)) {
            setFreelanceFilter("All");
        }
        if (eventTypeFilter !== "All" && !availableEventTypes.includes(eventTypeFilter)) {
            setEventTypeFilter("All");
        }

        setExtraFieldFilters((prev) => {
            const fieldMap = new Map(
                activeExtraFilterFields.map((field) => [field.key, field]),
            );
            let changed = false;
            const next: Record<string, string> = {};

            for (const [key, value] of Object.entries(prev)) {
                const field = fieldMap.get(key);
                if (!field || typeof value !== "string") {
                    changed = true;
                    continue;
                }

                if (
                    field.mode === "exact" &&
                    value.length > 0 &&
                    Array.isArray(field.options) &&
                    !field.options.includes(value)
                ) {
                    changed = true;
                    next[key] = "";
                    continue;
                }

                next[key] = value;
            }

            return changed ? next : prev;
        });
    }, [
        activeExtraFilterFields,
        availableEventTypes,
        eventTypeFilter,
        filtersHydrated,
        freelanceFilter,
        freelancerNames,
        loading,
        packageFilter,
        packages,
        refreshing,
        statusFilter,
        statusOpts,
    ]);

    React.useEffect(() => {
        if (!filtersHydrated || !currentUserId) return;
        const storageKey = `${BOOKING_FILTER_STORAGE_PREFIX}:${currentUserId}`;
        const payload: BookingFilterStoragePayload = {
            searchQuery,
            statusFilter,
            packageFilter,
            freelanceFilter,
            eventTypeFilter,
            dateFromFilter,
            dateToFilter,
            extraFieldFilters,
            sortOrder,
        };

        try {
            window.localStorage.setItem(storageKey, JSON.stringify(payload));
        } catch {
            // Ignore storage write failures.
        }
    }, [
        currentUserId,
        dateFromFilter,
        dateToFilter,
        eventTypeFilter,
        extraFieldFilters,
        filtersHydrated,
        freelanceFilter,
        packageFilter,
        searchQuery,
        sortOrder,
        statusFilter,
    ]);

    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, statusFilter, packageFilter, freelanceFilter, eventTypeFilter, dateFromFilter, dateToFilter, extraFieldFilters, sortOrder, itemsPerPage]);

    React.useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, itemsPerPage, totalItems]);

    const orderedVisibleColumns = React.useMemo(
        () => columns.filter((column) => column.visible),
        [columns],
    );

    React.useEffect(() => {
        const nextDefaults = lockBoundaryColumns([
            ...BASE_BOOKING_COLUMNS.slice(0, -1),
            ...buildBookingMetadataColumns(metadataRows, formSectionsByEventType),
            BASE_BOOKING_COLUMNS[BASE_BOOKING_COLUMNS.length - 1],
        ]);
        setColumns((current) => mergeTableColumnPreferences(nextDefaults, current));
    }, [formSectionsByEventType, metadataRows]);

    const filteredBookings = bookings;
    const queryState = React.useMemo<PaginatedQueryState>(() => ({
        page: currentPage,
        perPage: itemsPerPage,
        totalItems,
        isLoading: loading,
        isRefreshing: refreshing,
    }), [currentPage, itemsPerPage, totalItems, loading, refreshing]);

    async function exportBookings() {
        const params = new URLSearchParams({
            page: "1",
            perPage: String(Math.max(totalItems, 1)),
            search: searchQuery,
            status: statusFilter,
            package: packageFilter,
            freelance: freelanceFilter,
            eventType: eventTypeFilter,
            dateFrom: dateFromFilter,
            dateTo: dateToFilter,
            sortOrder,
            extraFilters: JSON.stringify(extraFieldFilters),
            export: "1",
        });
        const response = await fetchPaginatedJson<Booking, BookingPageMetadata>(
            `/api/internal/bookings?${params.toString()}`,
        );
        const exportData = response.items.map((booking) => ({
            [tb("exportBookingCode")]: booking.booking_code,
            [tb("exportClientName")]: booking.client_name,
            [tb("exportWhatsApp")]: booking.client_whatsapp || "",
            [tb("exportSessionDate")]: booking.session_date ? formatSessionDate(booking.session_date, { dateOnly: true }) : "",
            [tb("exportLocation")]: booking.location || "",
            [tb("exportPackage")]: booking.service_label || booking.services?.name || "",
            [tb("exportTotalPrice")]: booking.total_price || 0,
            [tb("exportDPPaid")]: booking.dp_paid || 0,
            [tb("exportStatus")]: booking.status,
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Bookings");
        XLSX.writeFile(wb, `bookings_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    return (
        <div className="space-y-6">
            {successToastNode}
            <BookingWriteReadonlyBanner />
            {/* Header */}
            <PageHeader
                actions={(
                    <>
                        <Button variant="outline" className="w-full lg:w-auto" onClick={() => { void exportBookings(); }}>
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
                            triggerClassName="w-full lg:w-auto"
                        />
                        <BatchImportButton
                            onImported={() => fetchData("refresh")}
                            canCommitBookings={canWriteBookings}
                            bookingWriteBlockedMessage={bookingWriteBlockedMessage}
                            buttonClassName="w-full lg:w-auto"
                        />
                        {canWriteBookings ? (
                            <Button asChild className="w-full bg-foreground text-background hover:bg-foreground/90 lg:w-auto">
                                <Link href="/bookings/new">
                                    <Plus className="w-4 h-4" /> {tb("addClient")}
                                </Link>
                            </Button>
                        ) : (
                            <Button
                                className="w-full bg-foreground text-background hover:bg-foreground/90 lg:w-auto"
                                disabled
                                title={bookingWriteBlockedMessage}
                            >
                                <Plus className="w-4 h-4" /> {tb("addClient")}
                            </Button>
                        )}
                    </>
                )}
            >
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h2>
                    <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
                </div>
            </PageHeader>

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
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                        <Button
                            variant="outline"
                            className="h-9 w-full gap-2 sm:w-auto"
                            onClick={() => setShowFilterPanel(prev => !prev)}
                        >
                            <ListOrdered className="w-4 h-4" />
                            Filter
                        </Button>
                        <select value={sortOrder} onChange={e => setSortOrder(e.target.value as BookingSortOrder)} className={`${selectFilterClass} w-full sm:w-auto`}>
                            <option value="booking_newest">Urutkan: Booking Terbaru</option>
                            <option value="booking_oldest">Urutkan: Booking Terlama</option>
                            <option value="session_newest">Urutkan: Jadwal Sesi Terdekat</option>
                            <option value="session_oldest">Urutkan: Jadwal Sesi Terjauh</option>
                        </select>
                        {(statusFilter !== "All" || packageFilter !== "All" || freelanceFilter !== "All" || eventTypeFilter !== "All" || dateFromFilter || dateToFilter || Object.values(extraFieldFilters).some(Boolean) || searchQuery || sortOrder !== "booking_newest") && (
                            <button
                                onClick={resetFilters}
                                className="h-9 w-full px-3 rounded-md border border-input bg-background/50 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer sm:w-auto"
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
                                    {availableEventTypes.map(t => (
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
                {queryState.isLoading || queryState.isRefreshing ? (
                    <CardListSkeleton count={Math.min(queryState.perPage, 4)} />
                ) : queryState.totalItems === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">{tb("noDataFound")}</div>
                ) : (
                    filteredBookings.map((booking) => (
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
                                <ActionIconButton tone="violet" title={tb("copyTemplate")} onClick={() => setCopyTargetPopup({ open: true, booking })}>
                                    {copiedClientTemplateId === booking.id || copiedFreelancerTemplateId === booking.id ? (
                                        <ClipboardCheck className="w-4 h-4" />
                                    ) : (
                                        <Copy className="w-4 h-4" />
                                    )}
                                </ActionIconButton>
                                <ActionIconButton tone="green" title={tb("whatsapp")}
                                    disabled={booking.booking_freelancers.length === 0 && !booking.client_whatsapp}
                                    onClick={() => setWaTargetPopup({ open: true, booking })}>
                                    <MessageCircle className="w-4 h-4" />
                                </ActionIconButton>
                                <Link href={`/bookings/${booking.id}`}><ActionIconButton tone="slate"><Info className="w-4 h-4" /></ActionIconButton></Link>
                                <ActionIconButton
                                    tone="orange"
                                    onClick={() => { setNewStatus(booking.client_status || booking.status); setStatusModal({ open: true, booking }); }}
                                    disabled={!canWriteBookings}
                                    title={!canWriteBookings ? bookingWriteBlockedMessage : undefined}
                                >
                                    <RefreshCcw className="w-4 h-4" />
                                </ActionIconButton>
                                {canWriteBookings ? (
                                    <Link href={`/bookings/${booking.id}/edit`}><ActionIconButton tone="indigo"><Edit2 className="w-4 h-4" /></ActionIconButton></Link>
                                ) : (
                                    <ActionIconButton tone="indigo" disabled title={bookingWriteBlockedMessage}><Edit2 className="w-4 h-4" /></ActionIconButton>
                                )}
                                <ActionIconButton
                                    tone="red"
                                    onClick={() => setDeleteModal({ open: true, booking })}
                                    disabled={!canWriteBookings}
                                    title={!canWriteBookings ? bookingWriteBlockedMessage : undefined}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </ActionIconButton>
                            </div>
                        </div>
                    ))
                )}
            </div>
            {!queryState.isLoading && !queryState.isRefreshing && queryState.totalItems > 0 ? (
                <div className="md:hidden">
                    <TablePagination
                        totalItems={queryState.totalItems}
                        currentPage={queryState.page}
                        itemsPerPage={queryState.perPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                        perPageOptions={[...PAGINATION_PER_PAGE_OPTIONS]}
                    />
                </div>
            ) : null}

            {/* Desktop Table */}
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-visible hidden md:block">
                <div className="relative overflow-x-auto overflow-y-visible">
                    <table className="min-w-[1320px] w-full text-sm text-left border-collapse">
                        <thead className="text-[11px] uppercase bg-card border-b">
                            <tr>
                                {orderedVisibleColumns.map((column) => renderDesktopHeader(column))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {queryState.isLoading || queryState.isRefreshing ? (
                                <TableRowsSkeleton
                                    rows={Math.min(queryState.perPage, 6)}
                                    columns={orderedVisibleColumns.length}
                                />
                            ) : queryState.totalItems === 0 ? (
                                <tr><td colSpan={columns.filter((column) => column.visible).length} className="px-6 py-12 text-center text-muted-foreground text-xs italic">{tb("noDataFound")}</td></tr>
                            ) : (
                                filteredBookings.map((booking) => (
                                    <tr key={booking.id} className="hover:bg-muted/30 transition-colors group">
                                        {orderedVisibleColumns.map((column) => renderDesktopCell(booking, column))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <TablePagination totalItems={queryState.totalItems} currentPage={queryState.page} itemsPerPage={queryState.perPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} perPageOptions={[...PAGINATION_PER_PAGE_OPTIONS]} />
            </div>

            {/* Status Change Modal */}
            <Dialog open={statusModal.open} onOpenChange={(o) => {
                if (!o) {
                    setCancelStatusConfirmOpen(false);
                    setStatusModal({ open: false, booking: null });
                }
            }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{tb("changeStatus")}</DialogTitle>
                        <DialogDescription>
                            {tb("changeStatusDesc")} <strong>{statusModal.booking?.client_name}</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-2 py-2 sm:grid-cols-3">
                        {statusOpts.map((opt) => (
                            <button key={opt} onClick={() => setNewStatus(opt)}
                                className={cn("flex min-h-[3.25rem] items-center justify-center rounded-lg border px-2 py-2 text-xs font-medium transition-all hover:bg-muted/50",
                                    newStatus === opt ? "border-foreground bg-foreground/5 dark:bg-foreground/10" : "border-border text-muted-foreground")}>
                                <StatusBadge
                                    status={opt}
                                    statusClass={statusColors[opt]}
                                    className="h-auto max-w-full justify-center whitespace-normal break-words px-2 py-1 text-center leading-snug"
                                />
                            </button>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setCancelStatusConfirmOpen(false);
                                setStatusModal({ open: false, booking: null });
                            }}
                            disabled={isUpdatingStatus}
                        >
                            {tb("cancel")}
                        </Button>
                        <Button
                            onClick={() => { void handleUpdateStatus(); }}
                            disabled={
                                !canWriteBookings ||
                                isUpdatingStatus ||
                                newStatus === (statusModal.booking?.client_status || statusModal.booking?.status)
                            }
                        >
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
                        <Button variant="destructive" className="flex-1" onClick={confirmDelete} disabled={isDeleting || !canWriteBookings}>
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                            {tb("yesDelete")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Template Target Picker (Mobile) */}
            <Dialog open={copyTargetPopup.open} onOpenChange={(o) => !o && setCopyTargetPopup({ open: false, booking: null })}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{tb("copyTargetPickerTitle")}</DialogTitle>
                        <DialogDescription>{tb("copyTargetPickerDesc")}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2 py-2">
                        <button
                            type="button"
                            className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/50 cursor-pointer"
                            onClick={() => {
                                const booking = copyTargetPopup.booking;
                                setCopyTargetPopup({ open: false, booking: null });
                                if (!booking) return;
                                handleExplicitCopyAction(booking, "client");
                            }}
                        >
                            <span>{tb("copyToClient")}</span>
                            <Copy className="w-4 h-4 text-violet-600" />
                        </button>
                        <button
                            type="button"
                            className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/50 cursor-pointer"
                            onClick={() => {
                                const booking = copyTargetPopup.booking;
                                setCopyTargetPopup({ open: false, booking: null });
                                if (!booking) return;
                                handleExplicitCopyAction(booking, "freelancer");
                            }}
                        >
                            <span>{tb("copyToFreelancer")}</span>
                            <Copy className="w-4 h-4 text-violet-600" />
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* WA Target Picker (Mobile) */}
            <Dialog open={waTargetPopup.open} onOpenChange={(o) => !o && setWaTargetPopup({ open: false, booking: null })}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{tb("waTargetPickerTitle")}</DialogTitle>
                        <DialogDescription>{tb("waTargetPickerDesc")}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2 py-2">
                        <button
                            type="button"
                            className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/50 cursor-pointer"
                            onClick={() => {
                                const booking = waTargetPopup.booking;
                                setWaTargetPopup({ open: false, booking: null });
                                if (!booking) return;
                                handleExplicitWhatsAppAction(booking, "client");
                            }}
                        >
                            <span>{tb("sendToClient")}</span>
                            <MessageCircle className="w-4 h-4 text-green-600" />
                        </button>
                        <button
                            type="button"
                            className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/50 cursor-pointer"
                            onClick={() => {
                                const booking = waTargetPopup.booking;
                                setWaTargetPopup({ open: false, booking: null });
                                if (!booking) return;
                                handleExplicitWhatsAppAction(booking, "freelancer");
                            }}
                        >
                            <span>{tb("sendToFreelancer")}</span>
                            <MessageCircle className="w-4 h-4 text-green-600" />
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            <CancelStatusPaymentDialog
                open={cancelStatusConfirmOpen}
                onOpenChange={setCancelStatusConfirmOpen}
                bookingName={statusModal.booking?.client_name || ""}
                maxRefundAmount={Math.max(statusModal.booking?.dp_verified_amount || 0, 0)}
                loading={isUpdatingStatus}
                onConfirm={({ policy, refundAmount }) => {
                    void handleUpdateStatus({
                        skipCancelConfirmation: true,
                        cancelPayment: { policy, refundAmount },
                    });
                }}
            />

            <ActionFeedbackDialog
                open={feedbackDialog.open}
                onOpenChange={(open) => setFeedbackDialog((prev) => ({ ...prev, open }))}
                title={tb("feedbackTitle")}
                message={feedbackDialog.message}
                confirmLabel={tb("feedbackOk")}
            />

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
                                    if (!waPopup.booking) return;
                                    sendWhatsAppFreelancer(waPopup.booking, f);
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

            {/* Copy Template Freelancer Selection Popup */}
            <Dialog open={copyFreelancerPopup.open} onOpenChange={(o) => !o && setCopyFreelancerPopup({ open: false, freelancers: [], booking: null })}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{tb("copyFreelance")}</DialogTitle>
                        <DialogDescription>{tb("selectFreelanceTemplate")}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2 py-2">
                        {copyFreelancerPopup.freelancers.map((f) => (
                            <button
                                key={f.id}
                                onClick={() => {
                                    if (!copyFreelancerPopup.booking) return;
                                    void copyFreelancerTemplate(copyFreelancerPopup.booking, f);
                                    setCopyFreelancerPopup({ open: false, freelancers: [], booking: null });
                                }}
                                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left cursor-pointer"
                            >
                                <div className="w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center shrink-0">
                                    <Copy className="w-4 h-4 text-violet-600 dark:text-violet-400" />
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
                        <Button disabled={!driveLinkInput || savingDriveLink || !canWriteBookings} className="gap-2" onClick={async () => {
                            if (!requireBookingWrite()) return;
                            if (!driveLinkPopup.booking || !driveLinkInput) return;
                            setSavingDriveLink(true);
                            await supabase.from("bookings").update({ drive_folder_url: driveLinkInput }).eq("id", driveLinkPopup.booking.id);
                            void triggerFastpikAutoSync(driveLinkPopup.booking.id);
                            setSavingDriveLink(false);
                            setDriveLinkPopup({ open: false, booking: null });
                            void fetchData("refresh");
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
