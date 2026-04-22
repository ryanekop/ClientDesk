"use client";

import * as React from "react";
import { Plus, Folder, Edit2, Trash2, Link2, Loader2, Info, Search, MapPin, RefreshCcw, CheckCircle2, AlertCircle, MessageCircle, Copy, ClipboardCheck, X, Download, ListOrdered, ChevronDown, Zap, Archive, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppCheckbox } from "@/components/ui/app-checkbox";
import { ActionIconButton } from "@/components/ui/action-icon-button";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { ActionFeedbackDialog } from "@/components/ui/action-feedback-dialog";
import { CancelStatusPaymentDialog } from "@/components/cancel-status-payment-dialog";
import { formatSessionDate } from "@/utils/format-date";
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
import {
    PageHeader,
    PAGE_HEADER_COMPACT_MOBILE_ACTIONS_CLASSNAME,
} from "@/components/ui/page-header";
import {
    adminNativeFieldBaseClass,
    adminNativeSelectClass,
} from "@/components/ui/admin-native-form-controls";
import { TablePagination } from "@/components/ui/table-pagination";
import { TableActionMenuPortal } from "@/components/ui/table-action-menu-portal";
import { useSuccessToast } from "@/components/ui/success-toast";
import { ManageActionToolbar } from "@/components/ui/manage-action-toolbar";
import { CardListSkeleton, TableRowsSkeleton } from "@/components/ui/data-skeletons";
import { useStickyTableColumns } from "@/components/ui/use-sticky-table-columns";
import { useResizableTableColumns } from "@/components/ui/use-resizable-table-columns";
import { FilterSingleSelect } from "@/components/ui/filter-single-select";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { BookingDateRangePicker } from "@/components/ui/booking-date-range-picker";
import {
    getEventExtraFields,
} from "@/utils/form-extra-fields";
import {
    extractCustomFieldSnapshots,
    getGroupedCustomLayoutSections,
    type FormLayoutItem,
} from "@/components/form-builder/booking-form-layout";
import {
    type BookingServiceSelection,
} from "@/lib/booking-services";
import { buildBookingStatusColorMap } from "@/lib/booking-status-badge";
import {
    buildBookingSessionDisplay,
    splitBookingSessionDisplayLines,
} from "@/lib/booking-session-display";
import { buildBookingWhatsAppTemplateVars } from "@/lib/booking-whatsapp-template-vars";
import { TableColumnManager } from "@/components/ui/table-column-manager";
import {
    areTableColumnPreferencesEqual,
    lockBoundaryColumns,
    mergeTableColumnPreferences,
    updateTableColumnPreferenceMap,
    type TableColumnPreference,
} from "@/lib/table-column-prefs";
import {
    buildBookingMetadataColumns,
    getBookingMetadataValue,
} from "@/lib/booking-table-columns";
import {
    type BookingArchiveMode,
    isArchivedBooking,
    normalizeBookingArchiveMode,
} from "@/lib/booking-archive";
import {
    getWhatsAppTemplateContent,
    resolveWhatsAppTemplateMode,
} from "@/lib/whatsapp-template";
import { resolveBookingCalendarSessions } from "@/lib/booking-calendar-sessions";
import {
    DEFAULT_CLIENT_STATUSES,
    getBookingStatusOptions,
} from "@/lib/client-status";
import {
    buildGoogleMapsQueryUrl,
} from "@/utils/location";
import { buildWhatsAppUrl, openWhatsAppUrl } from "@/utils/whatsapp-link";
import { normalizeHexColor, withAlpha } from "@/lib/service-colors";
import {
    isTransitionToCancelled,
    syncGoogleCalendarForStatusTransition,
} from "@/utils/google-calendar-status-sync";
import { buildCancelPaymentPatch, type CancelPaymentPolicy } from "@/lib/cancel-payment";
import { buildAutoDpVerificationPatch } from "@/lib/final-settlement";
import { updateBookingStatusWithQueueTransition } from "@/lib/booking-status-queue";
import { fetchPaginatedJson } from "@/lib/pagination/http";
import type { PaginatedQueryState } from "@/lib/pagination/types";
import { deleteBookingWithDependencies } from "@/lib/client-booking-delete";
import {
    type BulkActionKind,
    areAllVisibleSelected,
    pruneSelection,
    toggleSelectAllVisible,
    toggleSelection,
} from "@/lib/manage-selection";
import {
    getOnboardingActiveStep,
    markOnboardingStepCompleted,
    ONBOARDING_ACTIVE_STEP_EVENT,
} from "@/lib/onboarding";
import {
    FREELANCER_ASSIGNMENTS_EXTRA_FIELD_KEY,
    MAX_FREELANCERS_PER_SESSION,
    SESSION_FREELANCER_LABELS,
    buildSessionFreelancerUnion,
    ensureAssignmentsForSessionKeys,
    normalizeFreelancerIdList,
    readSessionFreelancerAssignmentsFromExtraFields,
    type SessionFreelancerAssignments,
} from "@/lib/freelancer-session-assignments";
import * as XLSX from "xlsx";

const selectFilterClass = `${adminNativeSelectClass} h-9 text-sm`;
const textFilterClass = `${adminNativeFieldBaseClass} h-9 rounded-md border px-3 text-sm`;

type FreelancerInfo = { id: string; name: string; whatsapp_number: string | null };

type SetFreelanceOption = {
    id: string;
    name: string;
    role: string | null;
    tags: string[];
    google_email: string | null;
    status: string | null;
};

type SetFreelanceDialogState = {
    open: boolean;
    booking: Booking | null;
};

type BookingFreelanceSession = {
    key: string;
    label: string;
};

type Booking = {
    id: string;
    booking_code: string;
    client_name: string;
    client_whatsapp: string | null;
    instagram?: string | null;
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
    archived_at?: string | null;
    archived_by?: string | null;
    location_detail: string | null;
    extra_fields?: Record<string, unknown> | null;
    booking_services?: unknown[];
    service_selections?: BookingServiceSelection[];
    service_label?: string;
    created_at?: string;
};

function normalizeFreelanceTags(value: unknown) {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];
}

function resolveBookingFreelanceSessions(booking: Booking): BookingFreelanceSession[] {
    const sessions = resolveBookingCalendarSessions({
        eventType: booking.event_type,
        sessionDate: booking.session_date,
        extraFields: booking.extra_fields,
        defaultLocation: booking.location,
    });

    if (sessions.length > 1) {
        return sessions.map((session) => ({
            key: session.key,
            label:
                session.label ||
                SESSION_FREELANCER_LABELS[session.key] ||
                session.key,
        }));
    }

    return [
        {
            key: "primary",
            label: SESSION_FREELANCER_LABELS.primary,
        },
    ];
}

type BookingFilterField = {
    key: string;
    label: string;
    mode: "contains" | "exact";
    options?: string[];
};

const DEFAULT_STATUS_OPTS = getBookingStatusOptions(DEFAULT_CLIENT_STATUSES);
const BASE_BOOKING_COLUMNS: TableColumnPreference[] = [
    { id: "row_number", label: "No.", visible: true, locked: true },
    { id: "name", label: "Nama", visible: true },
    { id: "invoice", label: "Invoice", visible: true },
    { id: "booking_date", label: "Booking Date", visible: true },
    { id: "package", label: "Paket", visible: true },
    { id: "event_type", label: "Tipe Acara", visible: false },
    { id: "session_date_display", label: "Session Date", visible: true },
    { id: "session_time_display", label: "Session Time", visible: true },
    { id: "location", label: "Lokasi", visible: true },
    { id: "status", label: "Status", visible: true },
    { id: "freelancer", label: "Freelance", visible: true },
    { id: "price", label: "Harga", visible: true },
    { id: "actions", label: "Aksi", visible: true, locked: true, pin: "right" },
];
const BOOKING_NON_RESIZABLE_COLUMN_IDS = ["select", "row_number", "actions"];
const BOOKING_COLUMN_MIN_WIDTHS: Record<string, number> = {
    select: 52,
    name: 140,
    invoice: 118,
    package: 150,
    event_type: 140,
    booking_date: 132,
    session_date_display: 170,
    session_time_display: 160,
    location: 170,
    status: 120,
    freelancer: 140,
    price: 124,
};
const BOOKING_MANAGE_SELECT_COLUMN: TableColumnPreference = {
    id: "select",
    label: "Select",
    visible: true,
    locked: true,
    pin: "left",
};
const BOOKING_FILTER_STORAGE_PREFIX = "clientdesk:bookings:filters";
const BOOKING_ITEMS_PER_PAGE_STORAGE_PREFIX = "clientdesk:bookings:items_per_page";
const PAGINATION_PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;
const DEFAULT_ITEMS_PER_PAGE = 10;
const SEARCH_DEBOUNCE_MS = 400;
const BOOKING_SORT_ORDERS = [
    "booking_newest",
    "booking_oldest",
    "session_newest",
    "session_oldest",
] as const;
type BookingSortOrder = (typeof BOOKING_SORT_ORDERS)[number];
type BookingDateBasis = "booking_date" | "session_date";

type BookingFilterStoragePayload = {
    searchQuery: string;
    archiveMode?: BookingArchiveMode | string;
    statusFilter: string[] | string;
    packageFilter: string[] | string;
    freelanceFilter: string[] | string;
    eventTypeFilter: string[] | string;
    dateFromFilter: string;
    dateToFilter: string;
    dateBasis?: BookingDateBasis;
    extraFieldFilters: Record<string, string>;
    sortOrder: BookingSortOrder;
};

type BookingPageMetadata = {
    studioName: string;
    statusOptions: string[];
    queueTriggerStatus: string;
    dpVerifyTriggerStatus: string;
    defaultWaTarget: "client" | "freelancer";
    bookingTableColorEnabled: boolean;
    financeTableColorEnabled: boolean;
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

function normalizeEventTypeTerminology(value: string) {
    return value
        .replace(/Jenis Acara/g, "Tipe Acara")
        .replace(/jenis acara/g, "tipe acara")
        .replace(/Jenis acara/g, "Tipe acara");
}

function normalizeBookingColumnLabels(
    columns: TableColumnPreference[],
    eventTypeLabel: string,
) {
    return columns.map((column) =>
        column.id === "event_type" && column.label !== eventTypeLabel
            ? { ...column, label: eventTypeLabel }
            : column,
    );
}

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

function normalizeSelectedFilterValues(
    values: string[],
    options: string[],
) {
    const optionSet = new Set(options);
    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const item of values) {
        if (!optionSet.has(item) || seen.has(item)) continue;
        seen.add(item);
        normalized.push(item);
    }

    return normalized;
}

function parseLegacyOrMultiFilterValue(value: unknown) {
    if (Array.isArray(value)) {
        const seen = new Set<string>();
        const normalized: string[] = [];
        value.forEach((item) => {
            if (typeof item !== "string") return;
            const trimmed = item.trim();
            if (!trimmed || trimmed.toLowerCase() === "all" || seen.has(trimmed)) return;
            seen.add(trimmed);
            normalized.push(trimmed);
        });
        return normalized;
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed || trimmed.toLowerCase() === "all") return [];
        return [trimmed];
    }

    return [] as string[];
}

function arraysAreEqual(a: string[], b: string[]) {
    if (a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
}

function isAbortError(error: unknown) {
    return error instanceof Error && error.name === "AbortError";
}

function parseDateBasisValue(value: unknown): BookingDateBasis {
    return value === "session_date" ? "session_date" : "booking_date";
}

function parseSortOrderValue(value: unknown): BookingSortOrder {
    if (typeof value === "string" && BOOKING_SORT_ORDERS.includes(value as BookingSortOrder)) {
        return value as BookingSortOrder;
    }
    return "booking_newest";
}

function getPrimaryMainServiceColor(
    serviceSelections?: BookingServiceSelection[],
) {
    const mainSelection = (serviceSelections || []).find(
        (selection) => selection.kind === "main",
    );
    return normalizeHexColor(mainSelection?.service?.color);
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
    const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
    const templateMode = resolveWhatsAppTemplateMode({
        eventType: booking.event_type,
        extraFields: booking.extra_fields,
    });
    const vars = buildBookingWhatsAppTemplateVars({
        booking,
        locale: templateLocale,
        studioName,
        freelancerName,
        trackingLink: booking.tracking_uuid ? `${siteUrl}/${templateLocale}/track/${booking.tracking_uuid}` : "-",
        invoiceUrl: `${siteUrl}/api/public/invoice?code=${encodeURIComponent(booking.booking_code)}`,
    });

    function applyVars(tpl: string) {
        return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
    }

    if (freelancerName) {
        const content = getWhatsAppTemplateContent(
            savedTemplates,
            "whatsapp_freelancer",
            locale,
            booking.event_type,
            templateMode,
        );
        return applyVars(content);
    }

    const content = getWhatsAppTemplateContent(
        savedTemplates,
        "whatsapp_client",
        locale,
        booking.event_type,
        templateMode,
    );
    return applyVars(content);
}

export default function BookingsPage() {
    const supabase = createClient();
    const t = useTranslations("Bookings");
    const tb = useTranslations("BookingsPage");
    const tc = useTranslations("Common");
    const tBatchImport = useTranslations("BatchImport");
    const locale = useLocale();
    const eventTypeLabel = normalizeEventTypeTerminology(tb("eventTypeLabel"));
    const applyBookingColumnLabelNormalization = React.useCallback(
        (nextColumns: TableColumnPreference[]) =>
            normalizeBookingColumnLabels(nextColumns, eventTypeLabel),
        [eventTypeLabel],
    );
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
    const [bookingTableColorEnabled, setBookingTableColorEnabled] = React.useState(false);
    const [columns, setColumns] = React.useState<TableColumnPreference[]>(lockBoundaryColumns(BASE_BOOKING_COLUMNS));
    const [columnManagerOpen, setColumnManagerOpen] = React.useState(false);
    const [savingColumns, setSavingColumns] = React.useState(false);
    const [resettingColumnWidths, setResettingColumnWidths] = React.useState(false);
    const [isManageMode, setIsManageMode] = React.useState(false);
    const [selectedBookingIds, setSelectedBookingIds] = React.useState<string[]>([]);
    const [bulkActionDialog, setBulkActionDialog] = React.useState<{
        open: boolean;
        action: BulkActionKind | null;
    }>({ open: false, action: null });
    const [bulkActionLoading, setBulkActionLoading] = React.useState(false);

    // Filters & Search
    const [searchQuery, setSearchQuery] = React.useState("");
    const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState<string[]>([]);
    const [packageFilter, setPackageFilter] = React.useState<string[]>([]);
    const [freelanceFilter, setFreelanceFilter] = React.useState<string[]>([]);
    const [eventTypeFilter, setEventTypeFilter] = React.useState<string[]>([]);
    const [dateFromFilter, setDateFromFilter] = React.useState("");
    const [dateToFilter, setDateToFilter] = React.useState("");
    const [dateBasis, setDateBasis] = React.useState<BookingDateBasis>("booking_date");
    const [extraFieldFilters, setExtraFieldFilters] = React.useState<Record<string, string>>({});
    const [sortOrder, setSortOrder] = React.useState<BookingSortOrder>("booking_newest");
    const [showFilterPanel, setShowFilterPanel] = React.useState(false);
    const [archiveMode, setArchiveMode] = React.useState<BookingArchiveMode>("active");
    const [currentPage, setCurrentPage] = React.useState(1);
    const [itemsPerPage, setItemsPerPage] = React.useState(10);
    const [itemsPerPageHydrated, setItemsPerPageHydrated] = React.useState(false);
    const [totalItems, setTotalItems] = React.useState(0);
    const [availableEventTypes, setAvailableEventTypes] = React.useState<string[]>([]);
    const [metadataRows, setMetadataRows] = React.useState<Array<{ event_type?: string | null; extra_fields?: Record<string, unknown> | null }>>([]);
    const [extraFieldRows, setExtraFieldRows] = React.useState<Array<{ event_type?: string | null; extra_fields?: Record<string, unknown> | null }>>([]);
    const browserTimeZone = React.useMemo(() => {
        try {
            const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
            return typeof resolved === "string" && resolved.trim().length > 0
                ? resolved
                : "UTC";
        } catch {
            return "UTC";
        }
    }, []);

    // Modals
    const [statusModal, setStatusModal] = React.useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });
    const [cancelStatusConfirmOpen, setCancelStatusConfirmOpen] = React.useState(false);
    const [newStatus, setNewStatus] = React.useState("");
    const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);

    const [deleteModal, setDeleteModal] = React.useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [archiveDialog, setArchiveDialog] = React.useState<{
        open: boolean;
        booking: Booking | null;
        nextArchived: boolean;
    }>({ open: false, booking: null, nextArchived: false });
    const [archiveSavingId, setArchiveSavingId] = React.useState<string | null>(null);

    // Drive link popup
    const [driveLinkPopup, setDriveLinkPopup] = React.useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });
    const [driveLinkInput, setDriveLinkInput] = React.useState("");
    const [savingDriveLink, setSavingDriveLink] = React.useState(false);
    const [setFreelanceDialog, setSetFreelanceDialog] = React.useState<SetFreelanceDialogState>({ open: false, booking: null });
    const [setFreelanceOptions, setSetFreelanceOptions] = React.useState<SetFreelanceOption[]>([]);
    const [setFreelanceLoading, setSetFreelanceLoading] = React.useState(false);
    const [setFreelanceSaving, setSetFreelanceSaving] = React.useState(false);
    const [setFreelanceLoadError, setSetFreelanceLoadError] = React.useState("");
    const [setFreelanceSearchQuery, setSetFreelanceSearchQuery] = React.useState("");
    const [setFreelanceActiveSessionKey, setSetFreelanceActiveSessionKey] = React.useState("primary");
    const [setFreelanceAssignments, setSetFreelanceAssignments] = React.useState<SessionFreelancerAssignments>({});
    const statusColors = React.useMemo(
        () => buildBookingStatusColorMap(statusOpts),
        [statusOpts],
    );

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
    const [mobileHeaderActionMenuOpen, setMobileHeaderActionMenuOpen] = React.useState(false);
    const [mobileHeaderActionMenuAnchorEl, setMobileHeaderActionMenuAnchorEl] = React.useState<HTMLElement | null>(null);
    const [batchImportOpen, setBatchImportOpen] = React.useState(false);
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
    const bookingMetadataCacheRef = React.useRef<BookingPageMetadata | null>(null);
    const bookingMetadataEventTypeFilterKeyRef = React.useRef("");
    React.useEffect(() => {
        const syncBookingsOverviewOnboarding = () => {
            if (getOnboardingActiveStep() === "bookingsOverview") {
                markOnboardingStepCompleted("bookingsOverview");
            }
        };

        syncBookingsOverviewOnboarding();
        window.addEventListener("storage", syncBookingsOverviewOnboarding);
        window.addEventListener(
            ONBOARDING_ACTIVE_STEP_EVENT,
            syncBookingsOverviewOnboarding as EventListener,
        );

        return () => {
            window.removeEventListener("storage", syncBookingsOverviewOnboarding);
            window.removeEventListener(
                ONBOARDING_ACTIVE_STEP_EVENT,
                syncBookingsOverviewOnboarding as EventListener,
            );
        };
    }, []);
    const activeFetchControllerRef = React.useRef<AbortController | null>(null);
    const latestFetchRequestIdRef = React.useRef(0);
    const invalidateProfilePublicCache = React.useCallback(async () => {
        try {
            await fetch("/api/internal/cache/invalidate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scope: "profile" }),
            });
        } catch {
            // Best effort cache invalidation.
        }
    }, []);
    const invalidateBookingPublicCache = React.useCallback(
        async (options: { bookingCode?: string | null; trackingUuid?: string | null }) => {
            const bookingCode = options.bookingCode?.trim() || null;
            const trackingUuid = options.trackingUuid?.trim() || null;
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
        [],
    );
    const setFreelanceSessions = React.useMemo(
        () =>
            setFreelanceDialog.booking
                ? resolveBookingFreelanceSessions(setFreelanceDialog.booking)
                : [{ key: "primary", label: SESSION_FREELANCER_LABELS.primary }],
        [setFreelanceDialog.booking],
    );
    const isSetFreelanceSplitMode = setFreelanceSessions.length > 1;
    const setFreelanceSelectedIds = React.useMemo(() => {
        const activeSession = setFreelanceActiveSessionKey || setFreelanceSessions[0]?.key || "primary";
        return setFreelanceAssignments[activeSession] || [];
    }, [setFreelanceActiveSessionKey, setFreelanceAssignments, setFreelanceSessions]);
    const setFreelanceSelectedIdsSet = React.useMemo(
        () => new Set(setFreelanceSelectedIds),
        [setFreelanceSelectedIds],
    );
    const setFreelanceUnionIds = React.useMemo(() => {
        if (!isSetFreelanceSplitMode) {
            return normalizeFreelancerIdList(
                setFreelanceAssignments.primary || setFreelanceSelectedIds,
                { maxItems: MAX_FREELANCERS_PER_SESSION },
            );
        }

        return buildSessionFreelancerUnion(
            setFreelanceAssignments,
            setFreelanceSessions.map((session) => session.key),
        );
    }, [
        isSetFreelanceSplitMode,
        setFreelanceAssignments,
        setFreelanceSelectedIds,
        setFreelanceSessions,
    ]);
    const filteredSetFreelanceOptions = React.useMemo(() => {
        const query = setFreelanceSearchQuery.trim().toLowerCase();
        if (!query) return setFreelanceOptions;

        return setFreelanceOptions.filter((freelancer) => {
            const haystack = [
                freelancer.name,
                freelancer.role || "",
                freelancer.google_email || "",
                freelancer.tags.join(" "),
            ]
                .join(" ")
                .toLowerCase();
            return haystack.includes(query);
        });
    }, [setFreelanceOptions, setFreelanceSearchQuery]);

    const fetchSetFreelanceOptions = React.useCallback(async () => {
        const resolvedUserId = currentUserId || (await supabase.auth.getUser()).data.user?.id || null;
        if (!resolvedUserId) {
            setSetFreelanceOptions([]);
            return;
        }

        setSetFreelanceLoading(true);
        setSetFreelanceLoadError("");
        try {
            const { data, error } = await supabase
                .from("freelance")
                .select("id, name, role, tags, google_email, status")
                .eq("user_id", resolvedUserId)
                .eq("status", "active")
                .order("name", { ascending: true });

            if (error) {
                setSetFreelanceOptions([]);
                setSetFreelanceLoadError(tb("setFreelanceLoadFailed"));
                return;
            }

            const nextOptions = ((data || []) as Array<Record<string, unknown>>)
                .filter((item) => typeof item.id === "string" && typeof item.name === "string")
                .map((item) => ({
                    id: String(item.id),
                    name: String(item.name),
                    role: typeof item.role === "string" && item.role.trim().length > 0
                        ? item.role.trim()
                        : null,
                    tags: normalizeFreelanceTags(item.tags),
                    google_email:
                        typeof item.google_email === "string" && item.google_email.trim().length > 0
                            ? item.google_email.trim()
                            : null,
                    status:
                        typeof item.status === "string" && item.status.trim().length > 0
                            ? item.status.trim()
                            : null,
                }));

            setSetFreelanceOptions(nextOptions);
        } catch {
            setSetFreelanceOptions([]);
            setSetFreelanceLoadError(tb("setFreelanceLoadFailed"));
        } finally {
            setSetFreelanceLoading(false);
        }
    }, [currentUserId, supabase, tb]);

    const openSetFreelanceDialog = React.useCallback((booking: Booking) => {
        const sessions = resolveBookingFreelanceSessions(booking);
        const fallbackFreelancerIds = normalizeFreelancerIdList(
            booking.booking_freelancers.map((freelancer) => freelancer.id),
            { maxItems: MAX_FREELANCERS_PER_SESSION },
        );
        const nextAssignments =
            sessions.length > 1
                ? ensureAssignmentsForSessionKeys({
                    assignments: readSessionFreelancerAssignmentsFromExtraFields(
                        booking.extra_fields,
                        { maxItems: MAX_FREELANCERS_PER_SESSION, preserveEmpty: true },
                    ),
                    sessionKeys: sessions.map((session) => session.key),
                    fallbackFreelancerIds,
                    maxPerSession: MAX_FREELANCERS_PER_SESSION,
                })
                : { primary: fallbackFreelancerIds };

        setSetFreelanceDialog({ open: true, booking });
        setSetFreelanceAssignments(nextAssignments);
        setSetFreelanceActiveSessionKey(sessions[0]?.key || "primary");
        setSetFreelanceSearchQuery("");
        void fetchSetFreelanceOptions();
    }, [fetchSetFreelanceOptions]);
    const closeSetFreelanceDialog = React.useCallback(() => {
        setSetFreelanceDialog({ open: false, booking: null });
        setSetFreelanceSearchQuery("");
        setSetFreelanceLoadError("");
        setSetFreelanceAssignments({});
        setSetFreelanceActiveSessionKey("primary");
    }, []);

    const toggleSetFreelanceSelection = React.useCallback((freelancerId: string) => {
        const activeSessionKey = setFreelanceActiveSessionKey || "primary";
        setSetFreelanceAssignments((current) => {
            const existing = current[activeSessionKey] || [];
            const nextValues = existing.includes(freelancerId)
                ? existing.filter((id) => id !== freelancerId)
                : normalizeFreelancerIdList([...existing, freelancerId], {
                    maxItems: MAX_FREELANCERS_PER_SESSION,
                });
            return {
                ...current,
                [activeSessionKey]: nextValues,
            };
        });
    }, [setFreelanceActiveSessionKey]);

    const applySetFreelanceSelectionToAllSessions = React.useCallback(() => {
        if (!isSetFreelanceSplitMode) return;
        const sourceValues = [...setFreelanceSelectedIds];
        setSetFreelanceAssignments((current) => {
            const next: SessionFreelancerAssignments = { ...current };
            setFreelanceSessions.forEach((session) => {
                next[session.key] = [...sourceValues];
            });
            return next;
        });
    }, [isSetFreelanceSplitMode, setFreelanceSelectedIds, setFreelanceSessions]);

    const closeDesktopMenus = React.useCallback(() => {
        setWaMenuBookingId(null);
        setCopyMenuBookingId(null);
        setWaMenuAnchorEl(null);
        setCopyMenuAnchorEl(null);
    }, []);
    const closeMobileHeaderActionMenu = React.useCallback(() => {
        setMobileHeaderActionMenuOpen(false);
        setMobileHeaderActionMenuAnchorEl(null);
    }, []);
    const closeAllActionMenus = React.useCallback(() => {
        closeDesktopMenus();
        closeMobileHeaderActionMenu();
    }, [closeDesktopMenus, closeMobileHeaderActionMenu]);
    const closeManageMode = React.useCallback(() => {
        setIsManageMode(false);
        setSelectedBookingIds([]);
        setBulkActionDialog({ open: false, action: null });
    }, []);
    const openBulkActionDialog = React.useCallback((action: BulkActionKind) => {
        setBulkActionDialog({ open: true, action });
    }, []);

    const resetFilters = React.useCallback(() => {
        setStatusFilter([]);
        setPackageFilter([]);
        setFreelanceFilter([]);
        setEventTypeFilter([]);
        setDateFromFilter("");
        setDateToFilter("");
        setDateBasis("booking_date");
        setExtraFieldFilters({});
        setSearchQuery("");
        setDebouncedSearchQuery("");
        setSortOrder("booking_newest");
    }, []);

    React.useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [searchQuery]);

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

        const requestId = latestFetchRequestIdRef.current + 1;
        latestFetchRequestIdRef.current = requestId;
        activeFetchControllerRef.current?.abort();
        const controller = new AbortController();
        activeFetchControllerRef.current = controller;

        if (mode === "initial") {
            setLoading(true);
        } else {
            setRefreshing(true);
        }

        try {
            const singleStatusFilter = statusFilter[0] || "All";
            const singlePackageFilter = packageFilter[0] || "All";
            const singleFreelanceFilter = freelanceFilter[0] || "All";
            const singleEventTypeFilter = eventTypeFilter[0] || "All";
            const metadataEventTypeFilterKey = JSON.stringify({
                archiveMode,
                eventTypeFilter: [...eventTypeFilter].sort(),
            });
            const includeMetadata =
                !bookingMetadataCacheRef.current ||
                bookingMetadataEventTypeFilterKeyRef.current !== metadataEventTypeFilterKey;
            const params = new URLSearchParams({
                page: String(currentPage),
                perPage: String(itemsPerPage),
                search: debouncedSearchQuery,
                status: singleStatusFilter,
                package: singlePackageFilter,
                freelance: singleFreelanceFilter,
                eventType: singleEventTypeFilter,
                statusFilters: JSON.stringify(statusFilter),
                packageFilters: JSON.stringify(packageFilter),
                freelanceFilters: JSON.stringify(freelanceFilter),
                eventTypeFilters: JSON.stringify(eventTypeFilter),
                dateFrom: dateFromFilter,
                dateTo: dateToFilter,
                dateBasis,
                timeZone: browserTimeZone,
                sortOrder,
                extraFilters: JSON.stringify(extraFieldFilters),
                archiveMode,
                includeMetadata: includeMetadata ? "1" : "0",
            });

            const response = await fetchPaginatedJson<Booking, BookingPageMetadata>(
                `/api/internal/bookings?${params.toString()}`,
                { signal: controller.signal },
            );
            if (
                controller.signal.aborted ||
                latestFetchRequestIdRef.current !== requestId
            ) {
                return;
            }
            if (response.metadata) {
                bookingMetadataCacheRef.current = response.metadata;
                bookingMetadataEventTypeFilterKeyRef.current = metadataEventTypeFilterKey;
            }
            const metadata = response.metadata || bookingMetadataCacheRef.current;

            setBookings(response.items);
            setTotalItems(response.totalItems);
            if (metadata) {
                const nextColumnDefaults = lockBoundaryColumns([
                    ...BASE_BOOKING_COLUMNS.slice(0, -1),
                    ...buildBookingMetadataColumns(
                        metadata.metadataRows || [],
                        metadata.formSectionsByEventType || {},
                    ),
                    BASE_BOOKING_COLUMNS[BASE_BOOKING_COLUMNS.length - 1],
                ]);
                setStudioName(metadata.studioName || "");
                setStatusOpts(metadata.statusOptions || DEFAULT_STATUS_OPTS);
                setQueueTriggerStatus(metadata.queueTriggerStatus ?? "Antrian Edit");
                setDpVerifyTriggerStatus(metadata.dpVerifyTriggerStatus || "");
                setDefaultWaTarget(metadata.defaultWaTarget || "client");
                setBookingTableColorEnabled(metadata.bookingTableColorEnabled === true);
                setPackages(metadata.packages || []);
                setFreelancerNames(metadata.freelancerNames || []);
                setAvailableEventTypes(metadata.availableEventTypes || []);
                setFormSectionsByEventType(metadata.formSectionsByEventType || {});
                setMetadataRows(metadata.metadataRows || []);
                setExtraFieldRows(metadata.extraFieldRows || []);
                setColumns((current) => {
                    const nextColumns = applyBookingColumnLabelNormalization(
                        mergeTableColumnPreferences(
                            nextColumnDefaults,
                            metadata.tableColumnPreferences || undefined,
                        ),
                    );
                    return areTableColumnPreferencesEqual(current, nextColumns)
                        ? current
                        : nextColumns;
                });
            }
        } catch (error) {
            if (isAbortError(error)) {
                return;
            }
            console.error("[BookingsPage] Failed to fetch bookings page", error);
        } finally {
            if (
                latestFetchRequestIdRef.current === requestId &&
                activeFetchControllerRef.current === controller
            ) {
                activeFetchControllerRef.current = null;
            }
            if (latestFetchRequestIdRef.current !== requestId) return;
            setLoading(false);
            setRefreshing(false);
        }
    }, [
        currentPage,
        dateFromFilter,
        dateToFilter,
        dateBasis,
        eventTypeFilter,
        extraFieldFilters,
        filtersHydrated,
        freelanceFilter,
        itemsPerPage,
        itemsPerPageHydrated,
        packageFilter,
        debouncedSearchQuery,
        sortOrder,
        statusFilter,
        browserTimeZone,
        archiveMode,
        applyBookingColumnLabelNormalization,
    ]);

    async function saveColumnPreferences(nextColumns: TableColumnPreference[]) {
        const normalizedNextColumns = applyBookingColumnLabelNormalization(
            lockBoundaryColumns(nextColumns),
        );
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
            normalizedNextColumns,
        );
        await supabase
            .from("profiles")
            .update({ table_column_preferences: payload })
            .eq("id", user.id);
        await invalidateProfilePublicCache();
        if (bookingMetadataCacheRef.current) {
            bookingMetadataCacheRef.current = {
                ...bookingMetadataCacheRef.current,
                tableColumnPreferences: normalizedNextColumns,
            };
        }
        setColumns((current) =>
            areTableColumnPreferencesEqual(current, normalizedNextColumns)
                ? current
                : normalizedNextColumns,
        );
        setSavingColumns(false);
        setColumnManagerOpen(false);
    }

    async function handleResetColumnWidths() {
        setResettingColumnWidths(true);
        try {
            await new Promise<void>((resolve) =>
                window.requestAnimationFrame(() => resolve()),
            );
            resetColumnWidths();
            setColumnManagerOpen(false);
        } finally {
            setResettingColumnWidths(false);
        }
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
                setArchiveMode("active");
                resetFilters();
                return;
            }

            const parsed = JSON.parse(raw) as unknown;
            if (!isObjectRecord(parsed)) {
                setArchiveMode("active");
                resetFilters();
                return;
            }

            const readString = (key: keyof BookingFilterStoragePayload, fallback: string) => {
                const value = parsed[key];
                return typeof value === "string" ? value : fallback;
            };

            const hydratedSearchQuery = readString("searchQuery", "");
            setSearchQuery(hydratedSearchQuery);
            setDebouncedSearchQuery(hydratedSearchQuery);
            setArchiveMode(normalizeBookingArchiveMode(parsed.archiveMode));
            setStatusFilter(parseLegacyOrMultiFilterValue(parsed.statusFilter));
            setPackageFilter(parseLegacyOrMultiFilterValue(parsed.packageFilter));
            setFreelanceFilter(parseLegacyOrMultiFilterValue(parsed.freelanceFilter));
            setEventTypeFilter(parseLegacyOrMultiFilterValue(parsed.eventTypeFilter));
            setDateFromFilter(readString("dateFromFilter", ""));
            setDateToFilter(readString("dateToFilter", ""));
            setDateBasis(parseDateBasisValue(parsed.dateBasis));

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

            setSortOrder(parseSortOrderValue(parsed.sortOrder));
        } catch {
            setArchiveMode("active");
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
        return () => {
            activeFetchControllerRef.current?.abort();
            activeFetchControllerRef.current = null;
        };
    }, []);

    React.useEffect(() => {
        if (!waMenuBookingId && !copyMenuBookingId && !mobileHeaderActionMenuOpen) return;
        function handleOutsideClick(event: MouseEvent) {
            const target = event.target as HTMLElement | null;
            if (target?.closest("[data-wa-menu-root='true']")) return;
            if (target?.closest("[data-copy-menu-root='true']")) return;
            if (target?.closest("[data-mobile-header-action-menu-trigger='true']")) return;
            if (target?.closest("[data-table-action-menu-root='true']")) return;
            closeAllActionMenus();
        }
        function handleEscape(event: KeyboardEvent) {
            if (event.key !== "Escape") return;
            closeAllActionMenus();
        }
        document.addEventListener("mousedown", handleOutsideClick);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [closeAllActionMenus, copyMenuBookingId, mobileHeaderActionMenuOpen, waMenuBookingId]);
    React.useEffect(() => {
        if (!isManageMode) return;
        closeAllActionMenus();
    }, [closeAllActionMenus, isManageMode]);

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
            const updateResult = await updateBookingStatusWithQueueTransition({
                supabase,
                bookingId,
                previousStatus,
                nextStatus,
                queueTriggerStatus,
                patch: {
                    ...(cancelPatch || {}),
                    ...(autoDpPatch || {}),
                },
            });
            if (!updateResult.ok) {
                setFeedbackDialog({ open: true, message: updateResult.errorMessage || tb("failedUpdateStatus") });
                return;
            }

            await invalidateBookingPublicCache({
                bookingCode: activeBooking.booking_code,
                trackingUuid: activeBooking.tracking_uuid,
            });

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

    function formatDeleteWarnings(
        warnings: Awaited<ReturnType<typeof deleteBookingWithDependencies>>["warnings"],
    ) {
        return warnings.map((warning) => {
            switch (warning.type) {
                case "googleCalendarDeleteFailed":
                    return tb("googleCalendarDeleteFailed", { reason: warning.reason });
                case "googleCalendarDeletePartial":
                    return tb("googleCalendarDeletePartial", {
                        firstError: warning.firstError ? ` ${warning.firstError}` : "",
                    });
                case "googleCalendarDeleteFailedGeneric":
                    return tb("googleCalendarDeleteFailedGeneric");
                case "fastpikProjectDeleteFailed":
                    return tb("fastpikProjectDeleteFailed", { reason: warning.reason });
                case "fastpikProjectDeleteFailedGeneric":
                    return tb("fastpikProjectDeleteFailedGeneric");
                default:
                    return tb("failedDeleteBooking");
            }
        });
    }

    async function deleteSingleBooking(bookingToDelete: Booking) {
        const result = await deleteBookingWithDependencies({
            supabase,
            booking: bookingToDelete,
            locale,
        });
        const warningDetails = formatDeleteWarnings(result.warnings);

        if (!result.ok) {
            return {
                ok: false,
                warningDetails,
                message: tb("failedDeleteBooking"),
            } as const;
        }

        return {
            ok: true,
            warningDetails,
            message: warningDetails.length > 0
                ? tb("deleteWarningWithDetails", { warnings: warningDetails.join(" ") })
                : "",
        } as const;
    }

    async function confirmDelete() {
        if (!requireBookingWrite()) return;
        if (!deleteModal.booking) return;
        setIsDeleting(true);

        const result = await deleteSingleBooking(deleteModal.booking);
        setIsDeleting(false);

        if (!result.ok) {
            setFeedbackDialog({ open: true, message: result.message });
            return;
        }

        setDeleteModal({ open: false, booking: null });
        void fetchData("refresh");
        if (result.warningDetails.length > 0) {
            setFeedbackDialog({ open: true, message: result.message });
        }
    }

    function openArchiveConfirmation(booking: Booking) {
        const nextArchived = !isArchivedBooking(booking);
        setArchiveDialog({
            open: true,
            booking,
            nextArchived,
        });
    }

    async function archiveSingleBooking(booking: Booking, nextArchived: boolean) {
        const patch = nextArchived
            ? {
                archived_at: new Date().toISOString(),
                archived_by: currentUserId,
            }
            : {
                archived_at: null,
                archived_by: null,
            };

        const { error } = await supabase
            .from("bookings")
            .update(patch)
            .eq("id", booking.id);

        return !error;
    }

    async function confirmArchiveToggle() {
        if (!requireBookingWrite()) return;
        if (!archiveDialog.booking) return;

        const booking = archiveDialog.booking;
        const nextArchived = archiveDialog.nextArchived;
        setArchiveSavingId(booking.id);

        const ok = await archiveSingleBooking(booking, nextArchived);
        setArchiveSavingId(null);

        if (!ok) {
            setFeedbackDialog({
                open: true,
                message: locale === "en"
                    ? "Failed to update archive status."
                    : "Gagal memperbarui status arsip.",
            });
            return;
        }

        setArchiveDialog({ open: false, booking: null, nextArchived: false });
        void fetchData("refresh");
    }

    async function saveSetFreelanceAssignments() {
        if (!requireBookingWrite()) return;
        const booking = setFreelanceDialog.booking;
        if (!booking) return;
        if (setFreelanceLoadError) return;

        const validFreelancerIds = new Set(setFreelanceOptions.map((freelancer) => freelancer.id));
        const sessionKeys = setFreelanceSessions.map((session) => session.key);
        const normalizedAssignments = isSetFreelanceSplitMode
            ? ensureAssignmentsForSessionKeys({
                assignments: setFreelanceAssignments,
                sessionKeys,
                validFreelancerIds,
                maxPerSession: MAX_FREELANCERS_PER_SESSION,
            })
            : {
                primary: normalizeFreelancerIdList(
                    setFreelanceAssignments.primary || [],
                    {
                        validFreelancerIds,
                        maxItems: MAX_FREELANCERS_PER_SESSION,
                    },
                ),
            };
        const nextFreelancerIds = isSetFreelanceSplitMode
            ? buildSessionFreelancerUnion(normalizedAssignments, sessionKeys)
            : normalizedAssignments.primary || [];
        const nextExtraFields = {
            ...((booking.extra_fields && typeof booking.extra_fields === "object" && !Array.isArray(booking.extra_fields))
                ? booking.extra_fields
                : {}),
        } as Record<string, unknown>;

        if (isSetFreelanceSplitMode) {
            nextExtraFields[FREELANCER_ASSIGNMENTS_EXTRA_FIELD_KEY] = normalizedAssignments;
        } else {
            delete nextExtraFields[FREELANCER_ASSIGNMENTS_EXTRA_FIELD_KEY];
        }

        setSetFreelanceSaving(true);
        try {
            const { error: updateError } = await supabase
                .from("bookings")
                .update({
                    freelance_id: nextFreelancerIds[0] || null,
                    extra_fields: nextExtraFields,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", booking.id);

            if (updateError) {
                setFeedbackDialog({ open: true, message: tb("setFreelanceSaveFailed") });
                return;
            }

            const { error: deleteError } = await supabase
                .from("booking_freelance")
                .delete()
                .eq("booking_id", booking.id);
            if (deleteError) {
                setFeedbackDialog({ open: true, message: tb("setFreelanceSaveFailed") });
                return;
            }

            if (nextFreelancerIds.length > 0) {
                const { error: insertError } = await supabase
                    .from("booking_freelance")
                    .insert(
                        nextFreelancerIds.map((freelancerId) => ({
                            booking_id: booking.id,
                            freelance_id: freelancerId,
                        })),
                    );
                if (insertError) {
                    setFeedbackDialog({ open: true, message: tb("setFreelanceSaveFailed") });
                    return;
                }
            }

            await invalidateBookingPublicCache({
                bookingCode: booking.booking_code,
                trackingUuid: booking.tracking_uuid,
            });

            let syncWarning: string | null = null;
            const hasSessionSchedule = resolveBookingCalendarSessions({
                eventType: booking.event_type,
                sessionDate: booking.session_date,
                extraFields: nextExtraFields,
                defaultLocation: booking.location,
            }).length > 0;
            if (hasSessionSchedule) {
                const selectedFreelancers = setFreelanceOptions.filter((freelancer) =>
                    nextFreelancerIds.includes(freelancer.id),
                );
                const attendeeEmails = selectedFreelancers
                    .map((freelancer) => freelancer.google_email)
                    .filter((email): email is string => Boolean(email));
                const missingEmailNames = selectedFreelancers
                    .filter((freelancer) => !freelancer.google_email)
                    .map((freelancer) => freelancer.name);

                try {
                    const response = await fetch("/api/google/calendar-invite", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            bookingId: booking.id,
                            attendeeEmails,
                        }),
                    });
                    const result = ((await response.json().catch(() => null)) as { error?: string } | null) || null;
                    if (!response.ok) {
                        syncWarning = tb("setFreelanceCalendarSyncFailed", {
                            reason: result?.error || tb("setFreelanceCalendarUnknownError"),
                        });
                    } else if (missingEmailNames.length > 0) {
                        syncWarning = tb("setFreelanceMissingEmails", {
                            names: missingEmailNames.join(", "),
                        });
                    }
                } catch {
                    syncWarning = tb("setFreelanceCalendarSyncFailed", {
                        reason: tb("setFreelanceCalendarUnknownError"),
                    });
                }
            }

            closeSetFreelanceDialog();
            showSuccessToast(tb("setFreelanceSaved"));
            void fetchData("refresh");

            if (syncWarning) {
                setFeedbackDialog({ open: true, message: syncWarning });
            }
        } finally {
            setSetFreelanceSaving(false);
        }
    }

    async function confirmBulkAction() {
        if (!requireBookingWrite()) return;
        if (!bulkActionDialog.action || selectedBookingIds.length === 0) return;

        const selectedBookings = filteredBookings.filter((booking) =>
            selectedBookingIdSet.has(booking.id),
        );
        if (selectedBookings.length === 0) return;

        setBulkActionLoading(true);
        let successCount = 0;
        let failedCount = 0;
        const warningMessages: string[] = [];

        if (bulkActionDialog.action === "archive" || bulkActionDialog.action === "restore") {
            const nextArchived = bulkActionDialog.action === "archive";
            for (const booking of selectedBookings) {
                const ok = await archiveSingleBooking(booking, nextArchived);
                if (ok) {
                    successCount += 1;
                } else {
                    failedCount += 1;
                }
            }
        } else {
            for (const booking of selectedBookings) {
                const result = await deleteSingleBooking(booking);
                if (result.ok) {
                    successCount += 1;
                    warningMessages.push(...result.warningDetails);
                } else {
                    failedCount += 1;
                    if (result.warningDetails.length > 0) {
                        warningMessages.push(...result.warningDetails);
                    }
                }
            }
        }

        setBulkActionLoading(false);
        setBulkActionDialog({ open: false, action: null });

        if (successCount > 0) {
            setSelectedBookingIds([]);
            void fetchData("refresh");
        }

        if (failedCount > 0 || warningMessages.length > 0) {
            const detailParts: string[] = [];
            if (failedCount > 0) {
                detailParts.push(
                    locale === "en"
                        ? `${failedCount} booking${failedCount > 1 ? "s" : ""} failed to process.`
                        : `${failedCount} booking gagal diproses.`,
                );
            }
            if (warningMessages.length > 0) {
                detailParts.push(warningMessages.join(" "));
            }
            setFeedbackDialog({
                open: true,
                message: detailParts.join(" "),
            });
        }
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
            showSuccessToast(tb("copyClientTemplateSuccess"));
            setCopiedClientTemplateId(booking.id);
            setTimeout(() => {
                setCopiedClientTemplateId((current) => current === booking.id ? null : current);
            }, 2000);
        } catch {
            setFeedbackDialog({
                open: true,
                message: locale === "en" ? "Failed to copy client template." : tb("failedCopyClientTemplate"),
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
            showSuccessToast(tb("copyFreelanceTemplateSuccess"));
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
                        : tb("failedCopyFreelanceTemplate"),
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

    const formatCurrency = (n: number) =>
        n ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n) : "-";

    const getSessionDisplay = React.useCallback((booking: Booking) => buildBookingSessionDisplay({
        eventType: booking.event_type,
        sessionDate: booking.session_date,
        extraFields: booking.extra_fields,
        bookingServices: booking.booking_services,
        legacyService: booking.services,
        serviceSelections: booking.service_selections,
        locale: locale === "en" ? "en" : "id",
    }), [locale]);

    function renderSessionDisplayValue(value: string) {
        return (
            <div className="flex flex-col gap-1">
                {splitBookingSessionDisplayLines(value).map((line, index) => (
                    <span key={`${line}-${index}`} className="block whitespace-nowrap">
                        {line}
                    </span>
                ))}
            </div>
        );
    }

    function renderDesktopHeaderLabel(column: TableColumnPreference, label: React.ReactNode) {
        const resizeHandleProps = getResizeHandleProps(column.id);
        const resizable = isColumnResizable(column.id);
        const resizing = isColumnBeingResized(column.id);

        return (
            <div className={cn("relative flex items-center", resizable && "pr-3")}>
                <span>{label}</span>
                {resizeHandleProps ? (
                    <button
                        type="button"
                        aria-label={`Resize ${column.label}`}
                        title={locale === "en" ? "Drag to resize column" : "Geser untuk ubah lebar kolom"}
                        className={cn(
                            "absolute -right-3 top-1/2 h-8 w-6 -translate-y-1/2 touch-none select-none cursor-col-resize rounded transition-colors",
                            resizing ? "bg-primary/15" : "hover:bg-muted/80",
                        )}
                        onPointerDown={resizeHandleProps.onPointerDown}
                    >
                        <span
                            className={cn(
                                "absolute left-1/2 top-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2",
                                resizing ? "bg-primary" : "bg-border",
                            )}
                        />
                    </button>
                ) : null}
            </div>
        );
    }

    function renderDesktopHeaderCell(
        column: TableColumnPreference,
        className: string,
        label: React.ReactNode,
    ) {
        return (
            <th
                key={column.id}
                data-column-id={column.id}
                style={getDesktopColumnStyle(column.id, { header: true })}
                className={getDesktopHeaderClassName(column.id, className)}
            >
                {renderDesktopHeaderLabel(column, label)}
            </th>
        );
    }

    function renderDesktopHeader(column: TableColumnPreference) {
        switch (column.id) {
            case "select":
                return renderDesktopHeaderCell(
                    column,
                    "w-12 px-3 py-3 font-semibold text-muted-foreground whitespace-nowrap text-center",
                    (
                        <div className="flex justify-center">
                            <AppCheckbox
                                checked={allVisibleSelected}
                                onCheckedChange={() =>
                                    setSelectedBookingIds((current) =>
                                        toggleSelectAllVisible(current, visibleBookingIds),
                                    )
                                }
                                aria-label={tc("pilihSemua")}
                            />
                        </div>
                    ),
                );
            case "name":
                return renderDesktopHeaderCell(column, "px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap", t("namaKlien"));
            case "row_number":
                return renderDesktopHeaderCell(column, "w-16 px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap", "No.");
            case "invoice":
                return renderDesktopHeaderCell(column, "px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap", tb("invoice"));
            case "package":
                return renderDesktopHeaderCell(column, "px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap", t("paket"));
            case "event_type":
                return renderDesktopHeaderCell(column, "px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap", eventTypeLabel);
            case "booking_date":
                return renderDesktopHeaderCell(column, "px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap", tb("columnBookingDate"));
            case "session_date_display":
                return renderDesktopHeaderCell(column, "px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap", tb("columnSessionDate"));
            case "session_time_display":
                return renderDesktopHeaderCell(column, "px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap", tb("columnSessionTime"));
            case "location":
                return renderDesktopHeaderCell(column, "px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap", tb("location"));
            case "status":
                return renderDesktopHeaderCell(column, "px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap", t("status"));
            case "freelancer":
                return renderDesktopHeaderCell(column, "px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap", t("freelancer"));
            case "price":
                return renderDesktopHeaderCell(column, "px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap", t("harga"));
            case "actions":
                return renderDesktopHeaderCell(column, "min-w-[220px] px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap text-right", t("aksi"));
            default:
                return renderDesktopHeaderCell(column, "px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap", column.label);
        }
    }

    function renderDesktopCell(
        booking: Booking,
        column: TableColumnPreference,
        rowNumber: number,
    ) {
        const sessionDisplay = getSessionDisplay(booking);
        switch (column.id) {
            case "select":
                return (
                    <td
                        key={column.id}
                        style={getDesktopColumnStyle(column.id)}
                        className={getDesktopCellClassName(column.id, "w-12 px-3 py-3 text-center")}
                    >
                        <div className="flex justify-center">
                            <AppCheckbox
                                checked={selectedBookingIdSet.has(booking.id)}
                                onCheckedChange={() =>
                                    setSelectedBookingIds((current) =>
                                        toggleSelection(current, booking.id),
                                    )
                                }
                                aria-label={tc("modeKelola")}
                            />
                        </div>
                    </td>
                );
            case "name":
                return (
                    <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3 max-w-[140px]")}>
                        <div className="font-medium text-foreground truncate">{booking.client_name}</div>
                        {booking.client_whatsapp && (
                            <div className="text-[11px] text-muted-foreground truncate">{booking.client_whatsapp}</div>
                        )}
                    </td>
                );
            case "row_number":
                return (
                    <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3 whitespace-nowrap text-muted-foreground")}>
                        {rowNumber}
                    </td>
                );
            case "invoice":
                return (
                    <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3 whitespace-nowrap")}>
                        <span className="text-[10px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded border border-border/50">
                            {booking.booking_code}
                        </span>
                    </td>
                );
            case "package":
                return <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3 max-w-[150px] truncate text-muted-foreground")} title={booking.service_label || booking.services?.name || "-"}>{booking.service_label || booking.services?.name || "-"}</td>;
            case "event_type":
                return <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3 max-w-[150px] truncate text-muted-foreground")} title={booking.event_type || "-"}>{booking.event_type || "-"}</td>;
            case "booking_date":
                return (
                    <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3 whitespace-nowrap text-muted-foreground font-light")}>
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
            case "session_date_display":
                return <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3 align-top text-muted-foreground font-light leading-5")}>{renderSessionDisplayValue(sessionDisplay.dateDisplay)}</td>;
            case "session_time_display":
                return <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3 align-top text-muted-foreground font-light leading-5")}>{renderSessionDisplayValue(sessionDisplay.timeDisplay)}</td>;
            case "location":
                return (
                    <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3 max-w-[180px]")}>
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
                return <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3 whitespace-nowrap")}><StatusBadge status={booking.status} statusClass={statusColors[booking.status]} /></td>;
            case "freelancer":
                return (
                    <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3 max-w-[130px] truncate text-muted-foreground")} title={booking.booking_freelancers.length > 0 ? booking.booking_freelancers.map(f => f.name).join(", ") : "-"}>
                        {booking.booking_freelancers.length > 0
                            ? booking.booking_freelancers.map(f => f.name).join(", ")
                            : "-"}
                    </td>
                );
            case "price":
                return <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3 whitespace-nowrap font-medium text-foreground")}>{formatCurrency(booking.total_price)}</td>;
            case "actions":
                return (
                    <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "min-w-[220px] px-4 py-3 whitespace-nowrap text-right")}>
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                            {isManageMode ? null : (
                                <>
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
                                tone="cyan"
                                title={!canWriteBookings ? bookingWriteBlockedMessage : tb("setFreelanceBtn")}
                                onClick={() => {
                                    closeAllActionMenus();
                                    openSetFreelanceDialog(booking);
                                }}
                                disabled={!canWriteBookings}
                            >
                                <Users className="w-4 h-4" />
                            </ActionIconButton>
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
                                tone={isArchivedBooking(booking) ? "amber" : "slate"}
                                title={!canWriteBookings
                                    ? bookingWriteBlockedMessage
                                    : isArchivedBooking(booking)
                                        ? tc("kembalikan")
                                        : tc("arsipkan")}
                                onClick={() => openArchiveConfirmation(booking)}
                                disabled={!canWriteBookings || archiveSavingId === booking.id}
                            >
                                {archiveSavingId === booking.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Archive className="w-4 h-4" />
                                )}
                            </ActionIconButton>
                            <ActionIconButton
                                tone="red"
                                title={!canWriteBookings ? bookingWriteBlockedMessage : tb("deleteBtn")}
                                onClick={() => setDeleteModal({ open: true, booking })}
                                disabled={!canWriteBookings}
                            >
                                <Trash2 className="w-4 h-4" />
                            </ActionIconButton>
                                </>
                            )}
                        </div>
                    </td>
                );
            default:
                return (
                    <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3 max-w-[180px] truncate text-muted-foreground")} title={getBookingMetadataValue(booking.extra_fields, column.id, { locale: locale === "en" ? "en" : "id" })}>
                        {getBookingMetadataValue(booking.extra_fields, column.id, { locale: locale === "en" ? "en" : "id" })}
                    </td>
                );
        }
    }

    function renderMobileValue(booking: Booking, column: TableColumnPreference) {
        const sessionDisplay = getSessionDisplay(booking);
        switch (column.id) {
            case "invoice":
                return booking.booking_code;
            case "package":
                return booking.service_label || booking.services?.name || "-";
            case "event_type":
                return booking.event_type || "-";
            case "booking_date":
                return booking.booking_date
                    ? formatSessionDate(booking.booking_date, {
                        locale: locale === "en" ? "en" : "id",
                        withDay: false,
                        withTime: false,
                        dateOnly: true,
                    })
                    : "-";
            case "session_date_display":
                return sessionDisplay.dateDisplay;
            case "session_time_display":
                return sessionDisplay.timeDisplay;
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

    const selectedSingleEventType = eventTypeFilter.length === 1
        ? eventTypeFilter[0]
        : null;

    const activeExtraFilterFields = React.useMemo<BookingFilterField[]>(() => {
        if (!selectedSingleEventType) return [];

        const builtInFields: BookingFilterField[] = getEventExtraFields(selectedSingleEventType).map((field) => ({
            key: field.key,
            label: field.label,
            mode: "contains",
        }));
        const customFields = getGroupedCustomLayoutSections(
            formSectionsByEventType[selectedSingleEventType] || formSectionsByEventType.Umum || [],
            selectedSingleEventType,
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
    }, [extraFieldRows, formSectionsByEventType, selectedSingleEventType]);

    React.useEffect(() => {
        if (!filtersHydrated || loading || refreshing) return;

        const normalizedStatusFilter = normalizeSelectedFilterValues(statusFilter, statusOpts);
        if (!arraysAreEqual(normalizedStatusFilter, statusFilter)) {
            setStatusFilter(normalizedStatusFilter);
        }
        const normalizedPackageFilter = normalizeSelectedFilterValues(packageFilter, packages);
        if (!arraysAreEqual(normalizedPackageFilter, packageFilter)) {
            setPackageFilter(normalizedPackageFilter);
        }
        const normalizedFreelanceFilter = normalizeSelectedFilterValues(freelanceFilter, freelancerNames);
        if (!arraysAreEqual(normalizedFreelanceFilter, freelanceFilter)) {
            setFreelanceFilter(normalizedFreelanceFilter);
        }
        const normalizedEventTypeFilter = normalizeSelectedFilterValues(eventTypeFilter, availableEventTypes);
        if (!arraysAreEqual(normalizedEventTypeFilter, eventTypeFilter)) {
            setEventTypeFilter(normalizedEventTypeFilter);
        }

        setExtraFieldFilters((prev) => {
            if (!selectedSingleEventType) {
                return Object.keys(prev).length > 0 ? {} : prev;
            }
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
        filtersHydrated,
        freelancerNames,
        loading,
        packages,
        refreshing,
        selectedSingleEventType,
        statusFilter,
        statusOpts,
        packageFilter,
        freelanceFilter,
        eventTypeFilter,
    ]);

    React.useEffect(() => {
        if (!filtersHydrated || !currentUserId) return;
        const storageKey = `${BOOKING_FILTER_STORAGE_PREFIX}:${currentUserId}`;
        const payload: BookingFilterStoragePayload = {
            searchQuery,
            archiveMode,
            statusFilter,
            packageFilter,
            freelanceFilter,
            eventTypeFilter,
            dateFromFilter,
            dateToFilter,
            dateBasis,
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
        dateBasis,
        eventTypeFilter,
        extraFieldFilters,
        filtersHydrated,
        freelanceFilter,
        archiveMode,
        packageFilter,
        searchQuery,
        sortOrder,
        statusFilter,
    ]);

    React.useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchQuery, statusFilter, packageFilter, freelanceFilter, eventTypeFilter, dateFromFilter, dateToFilter, dateBasis, extraFieldFilters, sortOrder, itemsPerPage, archiveMode]);

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
    const tableVisibleColumns = React.useMemo(
        () =>
            isManageMode
                ? [BOOKING_MANAGE_SELECT_COLUMN, ...orderedVisibleColumns]
                : orderedVisibleColumns,
        [isManageMode, orderedVisibleColumns],
    );
    const {
        getColumnWidthStyle,
        getResizeHandleProps,
        isColumnResizable,
        isColumnBeingResized,
        isResizing,
        cancelActiveResize,
        resetColumnWidths,
    } = useResizableTableColumns({
        enabled: !columnManagerOpen,
        menuKey: "bookings",
        userId: currentUserId,
        columns: tableVisibleColumns,
        nonResizableColumnIds: BOOKING_NON_RESIZABLE_COLUMN_IDS,
        minWidthByColumnId: BOOKING_COLUMN_MIN_WIDTHS,
    });
    const {
        tableRef,
        getStickyColumnStyle,
        getStickyColumnClassName,
    } = useStickyTableColumns(tableVisibleColumns, {
        enabled: !columnManagerOpen,
        isResizing,
    });
    const getDesktopHeaderClassName = React.useCallback(
        (columnId: string, className: string) =>
            cn(className, getStickyColumnClassName(columnId, { header: true })),
        [getStickyColumnClassName],
    );
    const getDesktopCellClassName = React.useCallback(
        (columnId: string, className: string) =>
            cn(className, getStickyColumnClassName(columnId)),
        [getStickyColumnClassName],
    );
    const getDesktopColumnStyle = React.useCallback(
        (columnId: string, options?: { header?: boolean }) => {
            const stickyStyle = getStickyColumnStyle(columnId, options);
            const widthStyle = getColumnWidthStyle(columnId);

            if (stickyStyle && widthStyle) {
                return { ...widthStyle, ...stickyStyle };
            }

            return widthStyle || stickyStyle;
        },
        [getColumnWidthStyle, getStickyColumnStyle],
    );
    const handleColumnManagerOpenChange = React.useCallback((nextOpen: boolean) => {
        setColumnManagerOpen(nextOpen);
    }, []);
    React.useEffect(() => {
        if (!columnManagerOpen) return;
        cancelActiveResize();
    }, [cancelActiveResize, columnManagerOpen]);

    React.useEffect(() => {
        const nextDefaults = lockBoundaryColumns([
            ...BASE_BOOKING_COLUMNS.slice(0, -1),
            ...buildBookingMetadataColumns(metadataRows, formSectionsByEventType),
            BASE_BOOKING_COLUMNS[BASE_BOOKING_COLUMNS.length - 1],
        ]);
        setColumns((current) =>
            {
                const nextColumns = applyBookingColumnLabelNormalization(
                    mergeTableColumnPreferences(nextDefaults, current),
                );
                return areTableColumnPreferencesEqual(current, nextColumns)
                    ? current
                    : nextColumns;
            },
        );
    }, [applyBookingColumnLabelNormalization, formSectionsByEventType, metadataRows]);

    const filteredBookings = bookings;
    const visibleBookingIds = React.useMemo(
        () => filteredBookings.map((booking) => booking.id),
        [filteredBookings],
    );
    const allVisibleSelected = React.useMemo(
        () => areAllVisibleSelected(selectedBookingIds, visibleBookingIds),
        [selectedBookingIds, visibleBookingIds],
    );
    const selectedCount = selectedBookingIds.length;
    const selectedBookingIdSet = React.useMemo(
        () => new Set(selectedBookingIds),
        [selectedBookingIds],
    );
    const isArchiveView = archiveMode === "archived";
    const queryState = React.useMemo<PaginatedQueryState>(() => ({
        page: currentPage,
        perPage: itemsPerPage,
        totalItems,
        isLoading: loading,
        isRefreshing: refreshing,
    }), [currentPage, itemsPerPage, totalItems, loading, refreshing]);
    const hasActiveFilters =
        statusFilter.length > 0 ||
        packageFilter.length > 0 ||
        freelanceFilter.length > 0 ||
        eventTypeFilter.length > 0 ||
        Boolean(dateFromFilter) ||
        Boolean(dateToFilter) ||
        dateBasis !== "booking_date" ||
        Object.values(extraFieldFilters).some(Boolean) ||
        Boolean(searchQuery) ||
        sortOrder !== "booking_newest";
    const archiveToggleLabels = React.useMemo(
        () => ({
            active: tc("aktif"),
            archived: tc("arsip"),
        }),
        [tc],
    );
    React.useEffect(() => {
        setSelectedBookingIds((current) => {
            const next = pruneSelection(current, visibleBookingIds);
            return next.length === current.length ? current : next;
        });
    }, [visibleBookingIds]);
    const manageToolbarLabels = React.useMemo(
        () => ({
            ...archiveToggleLabels,
            manage: tc("kelola"),
            selectAll: tc("pilihSemua"),
            archiveSelected: tc("arsipkanTerpilih"),
            restoreSelected: tc("kembalikanTerpilih"),
            deleteSelected: tc("hapusTerpilih"),
            selectedCount: tc("nDipilih", { count: selectedCount }),
            closeManage: locale === "en" ? "Close manage mode" : "Tutup mode kelola",
        }),
        [archiveToggleLabels, locale, selectedCount, tc],
    );

    async function exportBookings() {
        const singleStatusFilter = statusFilter[0] || "All";
        const singlePackageFilter = packageFilter[0] || "All";
        const singleFreelanceFilter = freelanceFilter[0] || "All";
        const singleEventTypeFilter = eventTypeFilter[0] || "All";
        const params = new URLSearchParams({
            page: "1",
            perPage: String(Math.max(totalItems, 1)),
            search: searchQuery,
            status: singleStatusFilter,
            package: singlePackageFilter,
            freelance: singleFreelanceFilter,
            eventType: singleEventTypeFilter,
            statusFilters: JSON.stringify(statusFilter),
            packageFilters: JSON.stringify(packageFilter),
            freelanceFilters: JSON.stringify(freelanceFilter),
            eventTypeFilters: JSON.stringify(eventTypeFilter),
            dateFrom: dateFromFilter,
            dateTo: dateToFilter,
            dateBasis,
            timeZone: browserTimeZone,
            sortOrder,
            extraFilters: JSON.stringify(extraFieldFilters),
            archiveMode,
            export: "1",
        });
        const response = await fetchPaginatedJson<Booking, BookingPageMetadata>(
            `/api/internal/bookings?${params.toString()}`,
        );
        const exportData = response.items.map((booking) => {
            const sessionDisplay = getSessionDisplay(booking);
            return {
            [tb("exportBookingCode")]: booking.booking_code,
            [tb("exportClientName")]: booking.client_name,
            [tb("exportWhatsApp")]: booking.client_whatsapp || "",
            [tb("exportSessionDate")]: sessionDisplay.dateDisplay,
            [tb("exportSessionTime")]: sessionDisplay.timeDisplay,
            [tb("exportLocation")]: booking.location || "",
            [tb("exportPackage")]: booking.service_label || booking.services?.name || "",
            [tb("exportTotalPrice")]: booking.total_price || 0,
            [tb("exportDPPaid")]: booking.dp_paid || 0,
            [tb("exportStatus")]: booking.status,
            };
        });
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Bookings");
        XLSX.writeFile(wb, `bookings_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    const sortOptions = React.useMemo(
        () => [
            { value: "booking_newest", label: tb("sortBookingDateNewest") },
            { value: "booking_oldest", label: tb("sortBookingDateOldest") },
            { value: "session_newest", label: tb("sortSessionDateNearest") },
            { value: "session_oldest", label: tb("sortSessionDateFarthest") },
        ],
        [tb],
    );
    const sortPlaceholder = sortOptions[0]?.label || tb("sortMenuTitle");
    const dateBasisOptions = React.useMemo(
        () => [
            { value: "booking_date", label: tb("dateBasisBookingDate") },
            { value: "session_date", label: tb("dateBasisSessionDate") },
        ],
        [tb],
    );
    const eventTypeFilterOptions = React.useMemo(
        () => availableEventTypes.map((eventType) => ({ value: eventType, label: eventType })),
        [availableEventTypes],
    );
    const statusFilterOptions = React.useMemo(
        () => statusOpts.map((status) => ({ value: status, label: status })),
        [statusOpts],
    );
    const packageFilterOptions = React.useMemo(
        () => packages.map((packageName) => ({ value: packageName, label: packageName })),
        [packages],
    );
    const freelanceFilterOptions = React.useMemo(
        () => freelancerNames.map((freelanceName) => ({ value: freelanceName, label: freelanceName })),
        [freelancerNames],
    );
    const multiCountSuffix = locale === "en" ? "selected" : "dipilih";

    return (
        <div className="space-y-6" data-onboarding-target="bookings-overview-panel">
            {successToastNode}
            <BookingWriteReadonlyBanner />
            {/* Header */}
            <PageHeader
                actionsClassName={PAGE_HEADER_COMPACT_MOBILE_ACTIONS_CLASSNAME}
                actions={(
                    <>
                        <TableColumnManager
                            title={tb("columnManagerTitle")}
                            description={tb("columnManagerDescription")}
                            columns={columns}
                            open={columnManagerOpen}
                            onOpenChange={handleColumnManagerOpenChange}
                            onChange={setColumns}
                            onSave={() => saveColumnPreferences(columns)}
                            onResetWidths={() => handleResetColumnWidths()}
                            saving={savingColumns}
                            resettingWidths={resettingColumnWidths}
                            triggerClassName="w-full lg:order-2 lg:w-auto"
                        />
                        <div className="lg:hidden">
                            <div
                                className="grid grid-cols-[minmax(0,1fr)_2.5rem] overflow-hidden rounded-md border border-foreground bg-foreground text-background shadow-sm"
                                data-mobile-header-action-menu-trigger="true"
                            >
                                {canWriteBookings ? (
                                    <Link
                                        href="/bookings/new"
                                        className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap px-2.5 text-[13px] font-medium"
                                    >
                                        <Plus className="h-4 w-4 shrink-0" /> {tb("addClientShort")}
                                    </Link>
                                ) : (
                                    <button
                                        type="button"
                                        disabled
                                        title={bookingWriteBlockedMessage}
                                        className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap px-2.5 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <Plus className="h-4 w-4 shrink-0" /> {tb("addClientShort")}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    title={tb("moreActions")}
                                    aria-label={tb("moreActions")}
                                    aria-expanded={mobileHeaderActionMenuOpen}
                                    className="inline-flex h-9 items-center justify-center border-l border-background/20 transition-colors hover:bg-foreground/90"
                                    onClick={(event) => {
                                        const anchorEl = event.currentTarget;
                                        const shouldClose = mobileHeaderActionMenuOpen;
                                        closeDesktopMenus();
                                        if (shouldClose) {
                                            closeMobileHeaderActionMenu();
                                            return;
                                        }
                                        setMobileHeaderActionMenuAnchorEl(anchorEl);
                                        setMobileHeaderActionMenuOpen(true);
                                    }}
                                >
                                    <ChevronDown
                                        className={cn(
                                            "w-4 h-4 transition-transform duration-200",
                                            mobileHeaderActionMenuOpen ? "rotate-180" : "rotate-0",
                                        )}
                                    />
                                </button>
                            </div>
                            <TableActionMenuPortal
                                open={mobileHeaderActionMenuOpen}
                                anchorEl={mobileHeaderActionMenuAnchorEl}
                                className="w-52"
                            >
                                <button
                                    type="button"
                                    onClick={() => {
                                        closeMobileHeaderActionMenu();
                                        void exportBookings();
                                    }}
                                    className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs text-foreground transition-colors hover:bg-muted"
                                >
                                    <Download className="w-4 h-4" />
                                    {tb("export")}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        closeMobileHeaderActionMenu();
                                        setBatchImportOpen(true);
                                    }}
                                    className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs text-foreground transition-colors hover:bg-muted"
                                >
                                    <Zap className="w-4 h-4" />
                                    {tBatchImport("triggerLabel")}
                                </button>
                            </TableActionMenuPortal>
                        </div>
                        {canWriteBookings ? (
                            <Button asChild className="hidden w-full bg-foreground text-background hover:bg-foreground/90 lg:order-4 lg:inline-flex lg:w-auto">
                                <Link href="/bookings/new">
                                    <Plus className="w-4 h-4" /> {tb("addClient")}
                                </Link>
                            </Button>
                        ) : (
                            <Button
                                className="hidden w-full bg-foreground text-background hover:bg-foreground/90 lg:order-4 lg:inline-flex lg:w-auto"
                                disabled
                                title={bookingWriteBlockedMessage}
                            >
                                <Plus className="w-4 h-4" /> {tb("addClient")}
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            className="hidden h-9 w-full gap-2 lg:order-1 lg:inline-flex lg:w-auto"
                            onClick={() => { void exportBookings(); }}
                        >
                            <Download className="w-4 h-4" /> {tb("export")}
                        </Button>
                        <BatchImportButton
                            onImported={() => fetchData("refresh")}
                            canCommitBookings={canWriteBookings}
                            bookingWriteBlockedMessage={bookingWriteBlockedMessage}
                            open={batchImportOpen}
                            onOpenChange={setBatchImportOpen}
                            buttonClassName="hidden w-full lg:order-3 lg:inline-flex lg:w-auto"
                        />
                    </>
                )}
            >
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h2>
                    <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
                </div>
            </PageHeader>

            {/* Search + Controls */}
            <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="relative min-w-0 flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={tb("searchPlaceholder")}
                            className="h-9 w-full rounded-md border border-input bg-background/50 pl-9 pr-3 text-sm focus-visible:ring-1 focus-visible:ring-ring outline-none transition-all"
                        />
                    </div>
                    <Button
                        variant="outline"
                        className="h-9 w-9 shrink-0 justify-center px-0 sm:h-9 sm:w-auto sm:gap-2 sm:px-3"
                        onClick={() => setShowFilterPanel(prev => !prev)}
                        aria-label="Filter"
                    >
                        <ListOrdered className="w-4 h-4" />
                        <span className="hidden sm:inline">Filter</span>
                    </Button>
                    <div className="hidden sm:flex sm:flex-wrap sm:items-center sm:gap-3">
                        <FilterSingleSelect
                            value={sortOrder}
                            onChange={(nextValue) => setSortOrder(parseSortOrderValue(nextValue))}
                            options={sortOptions}
                            placeholder={sortPlaceholder}
                            className="w-[300px] md:w-[340px] lg:w-[360px]"
                            mobileTitle={tb("sortMenuTitle")}
                        />
                        {hasActiveFilters && (
                            <button
                                onClick={resetFilters}
                                className="h-9 px-3 rounded-md border border-input bg-background/50 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" /> Reset
                            </button>
                        )}
                    </div>
                </div>
                <ManageActionToolbar
                    variant="archive-capable"
                    archiveMode={archiveMode}
                    isManageMode={isManageMode}
                    labels={manageToolbarLabels}
                    selectedCount={selectedCount}
                    manageDisabled={!canWriteBookings}
                    manageDisabledReason={bookingWriteBlockedMessage}
                    primaryBulkDisabled={selectedCount === 0 || !canWriteBookings}
                    deleteDisabled={selectedCount === 0 || !canWriteBookings}
                    selectAllDisabled={!canWriteBookings}
                    onArchiveModeChange={setArchiveMode}
                    onEnterManage={() => setIsManageMode(true)}
                    onToggleSelectAll={() =>
                        setSelectedBookingIds((current) =>
                            toggleSelectAllVisible(current, visibleBookingIds),
                        )
                    }
                    onPrimaryBulkAction={() =>
                        openBulkActionDialog(isArchiveView ? "restore" : "archive")
                    }
                    onDelete={() => openBulkActionDialog("delete")}
                    onCloseManage={closeManageMode}
                />
                <div className="flex w-full flex-col gap-2 sm:hidden">
                    <FilterSingleSelect
                        value={sortOrder}
                        onChange={(nextValue) => setSortOrder(parseSortOrderValue(nextValue))}
                        options={sortOptions}
                        placeholder={sortPlaceholder}
                        className="w-full"
                        mobileTitle={tb("sortMenuTitle")}
                    />
                    {hasActiveFilters && (
                        <button
                            onClick={resetFilters}
                            className="h-9 w-full px-3 rounded-md border border-input bg-background/50 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" /> Reset
                        </button>
                    )}
                </div>
                {showFilterPanel && (
                    <div className="rounded-xl border bg-card p-5 shadow-sm">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            <div className="space-y-1.5 md:space-y-0 md:flex md:items-center md:gap-4">
                                <label className="text-xs font-medium text-muted-foreground md:w-24 md:shrink-0">{tb("dateRangeLabel")}</label>
                                <BookingDateRangePicker
                                    value={{ from: dateFromFilter, to: dateToFilter }}
                                    onApply={({ from, to }) => {
                                        setDateFromFilter(from);
                                        setDateToFilter(to);
                                    }}
                                    onClear={() => {
                                        setDateFromFilter("");
                                        setDateToFilter("");
                                    }}
                                    locale={locale === "en" ? "en" : "id"}
                                    placeholder={tb("dateRangePlaceholder")}
                                    applyLabel={tb("apply")}
                                    clearLabel={tb("clear")}
                                    startLabel={tb("start")}
                                    endLabel={tb("end")}
                                    mobileTitle={tb("dateRangePickerTitle")}
                                    className="w-full"
                                />
                            </div>
                            <div className="space-y-1.5 md:space-y-0 md:flex md:items-center md:gap-4">
                                <label className="text-xs font-medium text-muted-foreground md:w-24 md:shrink-0">{tb("dateBasisLabel")}</label>
                                <FilterSingleSelect
                                    value={dateBasis}
                                    onChange={(nextValue) => setDateBasis(parseDateBasisValue(nextValue))}
                                    options={dateBasisOptions}
                                    placeholder={dateBasisOptions[0]?.label || tb("dateBasisBookingDate")}
                                    className="w-full"
                                    mobileTitle={tb("dateBasisLabel")}
                                />
                            </div>
                            <div className="space-y-1.5 md:space-y-0 md:flex md:items-center md:gap-4">
                                <label className="text-xs font-medium text-muted-foreground md:w-24 md:shrink-0">{eventTypeLabel}</label>
                                <FilterMultiSelect
                                    values={eventTypeFilter}
                                    onChange={setEventTypeFilter}
                                    options={eventTypeFilterOptions}
                                    placeholder={tb("allEventTypes")}
                                    allLabel={tb("allEventTypes")}
                                    countSuffix={multiCountSuffix}
                                    className="w-full"
                                    mobileTitle={eventTypeLabel}
                                />
                            </div>
                            <div className="space-y-1.5 md:space-y-0 md:flex md:items-center md:gap-4">
                                <label className="text-xs font-medium text-muted-foreground md:w-24 md:shrink-0">Status</label>
                                <FilterMultiSelect
                                    values={statusFilter}
                                    onChange={setStatusFilter}
                                    options={statusFilterOptions}
                                    placeholder={tb("allStatus")}
                                    allLabel={tb("allStatus")}
                                    countSuffix={multiCountSuffix}
                                    className="w-full"
                                    mobileTitle="Status"
                                />
                            </div>
                            <div className="space-y-1.5 md:space-y-0 md:flex md:items-center md:gap-4">
                                <label className="text-xs font-medium text-muted-foreground md:w-24 md:shrink-0">Paket</label>
                                <FilterMultiSelect
                                    values={packageFilter}
                                    onChange={setPackageFilter}
                                    options={packageFilterOptions}
                                    placeholder={tb("allPackages")}
                                    allLabel={tb("allPackages")}
                                    countSuffix={multiCountSuffix}
                                    className="w-full"
                                    mobileTitle="Paket"
                                />
                            </div>
                            <div className="space-y-1.5 md:space-y-0 md:flex md:items-center md:gap-4">
                                <label className="text-xs font-medium text-muted-foreground md:w-24 md:shrink-0">Freelance</label>
                                <FilterMultiSelect
                                    values={freelanceFilter}
                                    onChange={setFreelanceFilter}
                                    options={freelanceFilterOptions}
                                    placeholder={tb("allFreelance")}
                                    allLabel={tb("allFreelance")}
                                    countSuffix={multiCountSuffix}
                                    className="w-full"
                                    mobileTitle="Freelance"
                                />
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
                                            className={`${textFilterClass} w-full`}
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
                    filteredBookings.map((booking) => {
                        const serviceColor = bookingTableColorEnabled
                            ? getPrimaryMainServiceColor(booking.service_selections)
                            : null;
                        const mobileCardStyle = serviceColor
                            ? ({
                                backgroundColor: withAlpha(serviceColor, 0.095),
                                borderColor: withAlpha(serviceColor, 0.34),
                            } as React.CSSProperties)
                            : undefined;
                        return (
                        <div
                            key={booking.id}
                            className={cn(
                                "rounded-xl border bg-card shadow-sm p-4 space-y-3",
                                isManageMode && selectedBookingIdSet.has(booking.id) && "ring-1 ring-foreground/20",
                            )}
                            style={mobileCardStyle}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                    {isManageMode ? (
                                        <AppCheckbox
                                            checked={selectedBookingIdSet.has(booking.id)}
                                            onCheckedChange={() =>
                                                setSelectedBookingIds((current) =>
                                                    toggleSelection(current, booking.id),
                                                )
                                            }
                                            aria-label={tc("modeKelola")}
                                            className="mt-0.5"
                                        />
                                    ) : null}
                                    <div>
                                        <p className="font-semibold">{booking.client_name}</p>
                                        <p className="text-xs text-muted-foreground">{booking.booking_code}</p>
                                    </div>
                                </div>
                                <StatusBadge status={booking.status} statusClass={statusColors[booking.status]} />
                            </div>
                            <div className="border-t pt-2 space-y-1.5 text-sm text-muted-foreground">
                                {orderedVisibleColumns
                                    .filter((column) => !["name", "row_number", "actions"].includes(column.id))
                                    .map((column) => (
                                        <div key={column.id} className="flex items-start justify-between gap-3">
                                            <span className="shrink-0">{column.label}</span>
                                            <span className="max-w-[180px] whitespace-pre-line text-right text-foreground leading-5" title={String(renderMobileValue(booking, column) ?? "-")}>
                                                {renderMobileValue(booking, column)}
                                            </span>
                                        </div>
                                    ))}
                            </div>
                            {!isManageMode ? (
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
                                    tone="cyan"
                                    onClick={() => {
                                        closeAllActionMenus();
                                        openSetFreelanceDialog(booking);
                                    }}
                                    disabled={!canWriteBookings}
                                    title={!canWriteBookings ? bookingWriteBlockedMessage : tb("setFreelanceBtn")}
                                >
                                    <Users className="w-4 h-4" />
                                </ActionIconButton>
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
                                    tone={isArchivedBooking(booking) ? "amber" : "slate"}
                                    onClick={() => openArchiveConfirmation(booking)}
                                    disabled={!canWriteBookings || archiveSavingId === booking.id}
                                    title={!canWriteBookings
                                        ? bookingWriteBlockedMessage
                                        : isArchivedBooking(booking)
                                            ? tc("kembalikan")
                                            : tc("arsipkan")}
                                >
                                    {archiveSavingId === booking.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Archive className="w-4 h-4" />
                                    )}
                                </ActionIconButton>
                                <ActionIconButton
                                    tone="red"
                                    onClick={() => setDeleteModal({ open: true, booking })}
                                    disabled={!canWriteBookings}
                                    title={!canWriteBookings ? bookingWriteBlockedMessage : undefined}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </ActionIconButton>
                            </div>
                            ) : null}
                        </div>
                        );
                    })
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
                    <table ref={tableRef} className="min-w-full w-max border-separate border-spacing-0 text-left text-sm">
                        <thead className="text-[11px] uppercase bg-card border-b">
                            <tr>
                                {tableVisibleColumns.map((column) => renderDesktopHeader(column))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/70 dark:divide-white/20">
                            {queryState.isLoading || queryState.isRefreshing ? (
                                <TableRowsSkeleton
                                    rows={Math.min(queryState.perPage, 6)}
                                    columns={tableVisibleColumns.length}
                                />
                            ) : queryState.totalItems === 0 ? (
                                <tr><td colSpan={tableVisibleColumns.length} className="px-6 py-12 text-center text-muted-foreground text-xs italic">{tb("noDataFound")}</td></tr>
                            ) : (
                                filteredBookings.map((booking, rowIndex) => {
                                    const rowNumber =
                                        (currentPage - 1) * itemsPerPage + rowIndex + 1;
                                    const serviceColor = bookingTableColorEnabled
                                        ? getPrimaryMainServiceColor(booking.service_selections)
                                        : null;
                                    return (
                                        <tr
                                            key={booking.id}
                                            data-row-tone={serviceColor ? "service" : undefined}
                                            className={
                                                serviceColor
                                                    ? "transition-colors group"
                                                    : "hover:bg-muted/55 dark:hover:bg-white/12 transition-colors group"
                                            }
                                            style={
                                                serviceColor
                                                    ? ({
                                                        "--table-row-accent": serviceColor,
                                                    } as React.CSSProperties)
                                                    : undefined
                                            }
                                        >
                                            {tableVisibleColumns.map((column) =>
                                                renderDesktopCell(booking, column, rowNumber),
                                            )}
                                        </tr>
                                    );
                                })
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

            <Dialog
                open={setFreelanceDialog.open}
                onOpenChange={(open) => {
                    if (!open) {
                        closeSetFreelanceDialog();
                    }
                }}
            >
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{tb("setFreelanceTitle")}</DialogTitle>
                        <DialogDescription>
                            {tb("setFreelanceDesc", {
                                name: setFreelanceDialog.booking?.client_name || "-",
                            })}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {isSetFreelanceSplitMode ? (
                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-xs font-medium text-muted-foreground">
                                        {tb("setFreelancePerSessionLabel", {
                                            max: MAX_FREELANCERS_PER_SESSION,
                                        })}
                                    </p>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={applySetFreelanceSelectionToAllSessions}
                                    >
                                        {tb("setFreelanceApplyAllSessions")}
                                    </Button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {setFreelanceSessions.map((session) => {
                                        const active = setFreelanceActiveSessionKey === session.key;
                                        const selectedCount = setFreelanceAssignments[session.key]?.length || 0;
                                        return (
                                            <button
                                                key={session.key}
                                                type="button"
                                                onClick={() => setSetFreelanceActiveSessionKey(session.key)}
                                                className={cn(
                                                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                                                    active
                                                        ? "border-foreground bg-foreground/5 text-foreground"
                                                        : "border-input text-muted-foreground hover:bg-muted/50",
                                                )}
                                            >
                                                <span>{session.label}</span>
                                                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-foreground">
                                                    {selectedCount}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : null}

                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                value={setFreelanceSearchQuery}
                                onChange={(event) => setSetFreelanceSearchQuery(event.target.value)}
                                placeholder={tb("setFreelanceSearchPlaceholder")}
                                className="placeholder:text-muted-foreground dark:bg-input/30 border-input h-10 w-full min-w-0 rounded-md border bg-transparent pl-9 pr-3 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                            />
                        </div>

                        <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                            {setFreelanceLoading ? (
                                <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>{tb("setFreelanceLoading")}</span>
                                </div>
                            ) : setFreelanceLoadError ? (
                                <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
                                    {setFreelanceLoadError}
                                </div>
                            ) : setFreelanceOptions.length === 0 ? (
                                <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
                                    {tb("setFreelanceEmptyState")}
                                </div>
                            ) : filteredSetFreelanceOptions.length === 0 ? (
                                <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
                                    {tb("setFreelanceNoResults")}
                                </div>
                            ) : (
                                filteredSetFreelanceOptions.map((freelancer) => {
                                    const selected = setFreelanceSelectedIdsSet.has(freelancer.id);
                                    const limitReached =
                                        !selected &&
                                        setFreelanceSelectedIds.length >= MAX_FREELANCERS_PER_SESSION;
                                    return (
                                        <button
                                            key={freelancer.id}
                                            type="button"
                                            onClick={() => toggleSetFreelanceSelection(freelancer.id)}
                                            disabled={limitReached}
                                            className={cn(
                                                "flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-all",
                                                selected
                                                    ? "border-foreground bg-foreground/5 text-foreground shadow-sm"
                                                    : "border-input text-foreground hover:bg-muted/40",
                                                limitReached ? "cursor-not-allowed opacity-60" : "cursor-pointer",
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
                                                    <p className="text-sm font-medium">{freelancer.name}</p>
                                                    <div className="mt-1 flex flex-wrap items-center gap-1">
                                                        {freelancer.role ? (
                                                            <span className="rounded-full border border-transparent bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                                                {freelancer.role}
                                                            </span>
                                                        ) : null}
                                                        {freelancer.tags.slice(0, 3).map((tag) => (
                                                            <span
                                                                key={`${freelancer.id}-${tag}`}
                                                                className="rounded-full border border-transparent bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                                                            >
                                                                {tag}
                                                            </span>
                                                        ))}
                                                        {freelancer.tags.length > 3 ? (
                                                            <span className="text-[10px] text-muted-foreground">
                                                                +{freelancer.tags.length - 3}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    {freelancer.google_email ? (
                                                        <p className="mt-1 text-[11px] text-muted-foreground">
                                                            {freelancer.google_email}
                                                        </p>
                                                    ) : (
                                                        <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                                                            {tb("setFreelanceNoGoogleEmail")}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                    <DialogFooter className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-xs text-muted-foreground">
                            <div>
                                {tb("setFreelanceSelectedCount", {
                                    count: setFreelanceSelectedIds.length,
                                    max: MAX_FREELANCERS_PER_SESSION,
                                })}
                            </div>
                            {isSetFreelanceSplitMode ? (
                                <div>
                                    {tb("setFreelanceUnionCount", {
                                        count: setFreelanceUnionIds.length,
                                    })}
                                </div>
                            ) : null}
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={closeSetFreelanceDialog}
                                disabled={setFreelanceSaving}
                            >
                                {tb("cancel")}
                            </Button>
                            <Button
                                type="button"
                                onClick={() => { void saveSetFreelanceAssignments(); }}
                                disabled={setFreelanceSaving || setFreelanceLoading || Boolean(setFreelanceLoadError) || !canWriteBookings}
                                className="gap-2"
                            >
                                {setFreelanceSaving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Users className="h-4 w-4" />
                                )}
                                {setFreelanceSaving ? tb("setFreelanceSaving") : tb("save")}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ActionConfirmDialog
                open={archiveDialog.open}
                onOpenChange={(open) =>
                    setArchiveDialog((prev) => ({
                        open,
                        booking: open ? prev.booking : null,
                        nextArchived: open ? prev.nextArchived : false,
                    }))
                }
                title={archiveDialog.nextArchived
                    ? (locale === "en" ? "Archive this booking?" : "Arsipkan booking ini?")
                    : (locale === "en" ? "Restore this booking?" : "Kembalikan booking ini?")}
                message={archiveDialog.nextArchived
                    ? (locale === "en"
                        ? "This booking will be removed from the active Booking, Booking Status, and Invoice & Settlement lists. Public tracking, invoice, and settlement links will stay active."
                        : "Booking ini akan hilang dari daftar aktif Booking, Status Booking, dan Invoice & Pelunasan. Link tracking, invoice, dan pelunasan tetap aktif.")
                    : (locale === "en"
                        ? "This booking will appear again in the active Booking, Booking Status, and Invoice & Settlement lists."
                        : "Booking ini akan muncul lagi di daftar aktif Booking, Status Booking, dan Invoice & Pelunasan.")}
                cancelLabel={tc("batal")}
                confirmLabel={archiveSavingId
                    ? (locale === "en" ? "Saving..." : "Menyimpan...")
                    : archiveDialog.nextArchived
                        ? tc("arsipkan")
                        : tc("kembalikan")}
                onConfirm={() => { void confirmArchiveToggle(); }}
                loading={archiveSavingId !== null}
            />

            <ActionConfirmDialog
                open={bulkActionDialog.open}
                onOpenChange={(open) =>
                    setBulkActionDialog({
                        open,
                        action: open ? bulkActionDialog.action : null,
                    })
                }
                title={
                    bulkActionDialog.action === "delete"
                        ? (locale === "en" ? "Delete selected bookings?" : "Hapus booking terpilih?")
                        : bulkActionDialog.action === "restore"
                            ? (locale === "en" ? "Restore selected bookings?" : "Kembalikan booking terpilih?")
                            : (locale === "en" ? "Archive selected bookings?" : "Arsipkan booking terpilih?")
                }
                message={
                    bulkActionDialog.action === "delete"
                        ? (locale === "en"
                            ? `${selectedCount} booking(s) will be permanently deleted.`
                            : `${selectedCount} booking akan dihapus permanen.`)
                        : bulkActionDialog.action === "restore"
                            ? (locale === "en"
                                ? `${selectedCount} booking(s) will return to the active lists.`
                                : `${selectedCount} booking akan kembali ke daftar aktif.`)
                            : (locale === "en"
                                ? `${selectedCount} booking(s) will be moved to the archive lists.`
                                : `${selectedCount} booking akan dipindahkan ke daftar arsip.`)
                }
                cancelLabel={tc("batal")}
                confirmLabel={
                    bulkActionLoading
                        ? (locale === "en" ? "Processing..." : "Memproses...")
                        : bulkActionDialog.action === "delete"
                            ? tc("hapusTerpilih")
                            : bulkActionDialog.action === "restore"
                                ? tc("kembalikanTerpilih")
                                : tc("arsipkanTerpilih")
                }
                confirmVariant={bulkActionDialog.action === "delete" ? "destructive" : "default"}
                onConfirm={() => { void confirmBulkAction(); }}
                loading={bulkActionLoading}
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
                            const { error } = await supabase
                                .from("bookings")
                                .update({ drive_folder_url: driveLinkInput })
                                .eq("id", driveLinkPopup.booking.id);
                            if (!error) {
                                await invalidateBookingPublicCache({
                                    bookingCode: driveLinkPopup.booking.booking_code,
                                    trackingUuid: driveLinkPopup.booking.tracking_uuid,
                                });
                            }
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
