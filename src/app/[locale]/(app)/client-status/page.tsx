"use client";

import * as React from "react";
import { createClient } from "@/utils/supabase/client";
import { Activity, Copy, ClipboardCheck, ExternalLink, Search, ListOrdered, X, Archive, Loader2 } from "lucide-react";
import { AppCheckbox } from "@/components/ui/app-checkbox";
import { ActionIconButton } from "@/components/ui/action-icon-button";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { ActionFeedbackDialog } from "@/components/ui/action-feedback-dialog";
import { CancelStatusPaymentDialog } from "@/components/cancel-status-payment-dialog";
import { useSuccessToast } from "@/components/ui/success-toast";
import { Link } from "@/i18n/routing";
import {
    BookingWriteReadonlyBanner,
    useBookingWriteAccess,
    useBookingWriteGuard,
} from "@/lib/booking-write-access-context";
import { getBookingWriteBlockedMessage } from "@/lib/booking-write-access";
import { TablePagination } from "@/components/ui/table-pagination";
import { useStickyTableColumns } from "@/components/ui/use-sticky-table-columns";
import { useResizableTableColumns } from "@/components/ui/use-resizable-table-columns";
import { useTranslations, useLocale } from "next-intl";
import { TableColumnManager } from "@/components/ui/table-column-manager";
import { PageHeader } from "@/components/ui/page-header";
import { ManageActionToolbar } from "@/components/ui/manage-action-toolbar";
import { FilterSingleSelect } from "@/components/ui/filter-single-select";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { BookingDateRangePicker } from "@/components/ui/booking-date-range-picker";
import { ProjectDeadlineDatePicker } from "@/components/ui/project-deadline-date-picker";
import {
    areTableColumnPreferencesEqual,
    lockBoundaryColumns,
    mergeTableColumnPreferences,
    updateTableColumnPreferenceMap,
    type TableColumnPreference,
} from "@/lib/table-column-prefs";
import { cn } from "@/lib/utils";
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
    type BookingServiceSelection,
} from "@/lib/booking-services";
import type { FormLayoutItem } from "@/components/form-builder/booking-form-layout";
import {
    CANCELLED_BOOKING_STATUS,
    DEFAULT_CLIENT_STATUSES,
    getBookingStatusOptions,
} from "@/lib/client-status";
import {
    getProjectDeadlineCountdownLabel,
    getProjectDeadlineTone,
    normalizeClientStatusDeadlineDefaultDays,
    normalizeClientStatusDeadlineTriggerStatus,
    normalizeProjectDeadlineDate,
} from "@/lib/booking-deadline";
import {
    isTransitionToCancelled,
    syncGoogleCalendarForStatusTransition,
} from "@/utils/google-calendar-status-sync";
import { buildCancelPaymentPatch, type CancelPaymentPolicy } from "@/lib/cancel-payment";
import { buildAutoDpVerificationPatch } from "@/lib/final-settlement";
import { updateBookingStatusWithQueueTransition } from "@/lib/booking-status-queue";
import { CardListSkeleton, TableRowsSkeleton } from "@/components/ui/data-skeletons";
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

type BookingStatus = {
    id: string;
    booking_code: string;
    client_name: string;
    client_whatsapp: string | null;
    session_date: string | null;
    status: string;
    client_status: string | null;
    queue_position: number | null;
    project_deadline_date: string | null;
    dp_paid?: number | null;
    dp_verified_amount?: number | null;
    dp_verified_at?: string | null;
    dp_refund_amount?: number | null;
    dp_refunded_at?: string | null;
    tracking_uuid: string | null;
    archived_at?: string | null;
    archived_by?: string | null;
    services: { id?: string; name: string; price?: number; is_addon?: boolean | null } | null;
    booking_services?: unknown[];
    service_selections?: BookingServiceSelection[];
    service_label?: string;
    event_type?: string | null;
    extra_fields?: Record<string, unknown> | null;
};

type ClientStatusPageMetadata = {
    clientStatuses: string[];
    queueTriggerStatus: string;
    dpVerifyTriggerStatus: string;
    clientStatusDeadlineTriggerStatus: string | null;
    clientStatusDeadlineDefaultDays: number;
    packages: string[];
    availableEventTypes: string[];
    tableColumnPreferences: TableColumnPreference[] | null;
    formSectionsByEventType: Record<string, FormLayoutItem[]>;
    metadataRows: Array<{
        event_type?: string | null;
        extra_fields?: Record<string, unknown> | null;
    }>;
};

const STATUS_COLOR_PALETTE = [
    "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
    "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400",
    "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
    "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
    "bg-pink-100 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400",
    "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400",
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400",
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400",
    "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
];

function getAdminDeadlineBadgeClassName(deadlineDate: string | null | undefined) {
    const tone = getProjectDeadlineTone(deadlineDate);
    if (tone === "overdue" || tone === "today") {
        return "inline-flex self-start rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium leading-none text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300";
    }
    if (tone === "soon") {
        return "inline-flex self-start rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium leading-none text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300";
    }
    if (tone === "safe") {
        return "inline-flex self-start rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium leading-none text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300";
    }
    return "inline-flex self-start rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium leading-none text-muted-foreground";
}

const BASE_CLIENT_STATUS_COLUMNS: TableColumnPreference[] = [
    { id: "row_number", label: "No.", visible: true, locked: true },
    { id: "name", label: "Nama", visible: true },
    { id: "package", label: "Paket", visible: true },
    { id: "event_type", label: "Tipe Acara", visible: false },
    { id: "status", label: "Status", visible: true },
    { id: "queue", label: "Antrian", visible: true },
    { id: "deadline", label: "Deadline", visible: true },
    { id: "actions", label: "Aksi", visible: true, locked: true, pin: "right" },
];
const CLIENT_STATUS_NON_RESIZABLE_COLUMN_IDS = ["select", "row_number", "actions"];
const CLIENT_STATUS_COLUMN_MIN_WIDTHS: Record<string, number> = {
    select: 52,
    name: 150,
    package: 140,
    event_type: 140,
    status: 232,
    queue: 104,
    deadline: 196,
};
const CLIENT_STATUS_MANAGE_SELECT_COLUMN: TableColumnPreference = {
    id: "select",
    label: "Select",
    visible: true,
    locked: true,
    pin: "left",
};
const CLIENT_STATUS_ITEMS_PER_PAGE_STORAGE_PREFIX = "clientdesk:client_status:items_per_page";
const CLIENT_STATUS_FILTER_STORAGE_PREFIX = "clientdesk:client_status:filters";
const CLIENT_STATUS_PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;
const CLIENT_STATUS_DEFAULT_ITEMS_PER_PAGE = 10;
const SEARCH_DEBOUNCE_MS = 400;
const CLIENT_STATUS_SORT_ORDERS = [
    "booking_newest",
    "booking_oldest",
    "session_newest",
    "session_oldest",
] as const;
type ClientStatusSortOrder = (typeof CLIENT_STATUS_SORT_ORDERS)[number];
type ClientStatusDateBasis = "booking_date" | "session_date";

type ClientStatusFilterStoragePayload = {
    searchQuery: string;
    archiveMode?: BookingArchiveMode | string;
    statusFilter: string[] | string;
    packageFilter: string[] | string;
    eventTypeFilter: string[] | string;
    dateFromFilter: string;
    dateToFilter: string;
    dateBasis?: ClientStatusDateBasis;
    sortOrder: ClientStatusSortOrder;
};

function normalizeClientStatusItemsPerPage(value: unknown) {
    const parsed = typeof value === "number" ? value : Number(value);
    return CLIENT_STATUS_PER_PAGE_OPTIONS.includes(
        parsed as (typeof CLIENT_STATUS_PER_PAGE_OPTIONS)[number],
    )
        ? parsed
        : CLIENT_STATUS_DEFAULT_ITEMS_PER_PAGE;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseSortOrderValue(value: unknown): ClientStatusSortOrder {
    return typeof value === "string" && CLIENT_STATUS_SORT_ORDERS.includes(value as ClientStatusSortOrder)
        ? (value as ClientStatusSortOrder)
        : "booking_newest";
}

function parseDateBasisValue(value: unknown): ClientStatusDateBasis {
    return value === "session_date" ? "session_date" : "booking_date";
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

function normalizeSelectedFilterValues(values: string[], options: string[]) {
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

function arraysAreEqual(a: string[], b: string[]) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => item === b[index]);
}

function isAbortError(error: unknown) {
    return error instanceof Error && error.name === "AbortError";
}

function normalizeQueueTriggerStatus(value: string | null | undefined) {
    if (typeof value !== "string") return "Antrian Edit";
    return value.trim();
}

export default function ClientStatusPage() {
    const supabase = createClient();
    const t = useTranslations("ClientStatus");
    const tb = useTranslations("BookingsPage");
    const tc = useTranslations("Common");
    const locale = useLocale();
    const [bookings, setBookings] = React.useState<BookingStatus[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState("");
    const [showFilterPanel, setShowFilterPanel] = React.useState(false);
    const [archiveMode, setArchiveMode] = React.useState<BookingArchiveMode>("active");
    const [statusFilter, setStatusFilter] = React.useState<string[]>([]);
    const [packageFilter, setPackageFilter] = React.useState<string[]>([]);
    const [eventTypeFilter, setEventTypeFilter] = React.useState<string[]>([]);
    const [dateFromFilter, setDateFromFilter] = React.useState("");
    const [dateToFilter, setDateToFilter] = React.useState("");
    const [dateBasis, setDateBasis] = React.useState<ClientStatusDateBasis>("booking_date");
    const [sortOrder, setSortOrder] = React.useState<ClientStatusSortOrder>("booking_newest");
    const [copiedId, setCopiedId] = React.useState<string | null>(null);
    const [savingId, setSavingId] = React.useState<string | null>(null);
    const [currentPage, setCurrentPage] = React.useState(1);
    const [itemsPerPage, setItemsPerPage] = React.useState(10);
    const [itemsPerPageHydrated, setItemsPerPageHydrated] = React.useState(false);
    const [filtersHydrated, setFiltersHydrated] = React.useState(false);
    const [browserTimeZone, setBrowserTimeZone] = React.useState("UTC");
    const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
    const [clientStatuses, setClientStatuses] = React.useState<string[]>(DEFAULT_CLIENT_STATUSES);
    const [packages, setPackages] = React.useState<string[]>([]);
    const [availableEventTypes, setAvailableEventTypes] = React.useState<string[]>([]);
    const [queueTriggerStatus, setQueueTriggerStatus] = React.useState("Antrian Edit");
    const [dpVerifyTriggerStatus, setDpVerifyTriggerStatus] = React.useState("");
    const [clientStatusDeadlineTriggerStatus, setClientStatusDeadlineTriggerStatus] =
        React.useState<string | null>(null);
    const [clientStatusDeadlineDefaultDays, setClientStatusDeadlineDefaultDays] =
        React.useState<number>(7);
    const [columns, setColumns] = React.useState<TableColumnPreference[]>(lockBoundaryColumns(BASE_CLIENT_STATUS_COLUMNS));
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
    const [formSectionsByEventType, setFormSectionsByEventType] = React.useState<Record<string, FormLayoutItem[]>>({});
    const [metadataRows, setMetadataRows] = React.useState<Array<{ event_type?: string | null; extra_fields?: Record<string, unknown> | null }>>([]);
    const [totalItems, setTotalItems] = React.useState(0);
    const [cancelStatusConfirm, setCancelStatusConfirm] = React.useState<{
        open: boolean;
        booking: BookingStatus | null;
        nextStatus: string;
    }>({ open: false, booking: null, nextStatus: "" });
    const [archiveDialog, setArchiveDialog] = React.useState<{
        open: boolean;
        booking: BookingStatus | null;
        nextArchived: boolean;
    }>({ open: false, booking: null, nextArchived: false });
    const [archiveSavingId, setArchiveSavingId] = React.useState<string | null>(null);
    const [feedbackDialog, setFeedbackDialog] = React.useState<{
        open: boolean;
        title: string;
        message: string;
    }>({ open: false, title: "", message: "" });
    const { showSuccessToast, successToastNode } = useSuccessToast();
    const { canWriteBookings } = useBookingWriteAccess();
    const bookingWriteBlockedMessage = React.useMemo(
        () => getBookingWriteBlockedMessage(locale),
        [locale],
    );
    const requireBookingWrite = useBookingWriteGuard(({ message, title }) => {
        setFeedbackDialog({
            open: true,
            title,
            message,
        });
    });
    const hasLoadedBookingsRef = React.useRef(false);
    const clientStatusMetadataCacheRef = React.useRef<ClientStatusPageMetadata | null>(null);
    const clientStatusMetadataEventTypeFilterKeyRef = React.useRef("");
    const activeFetchControllerRef = React.useRef<AbortController | null>(null);

    React.useEffect(() => {
        const syncClientStatusOnboarding = () => {
            if (getOnboardingActiveStep() === "clientStatus") {
                markOnboardingStepCompleted("clientStatus");
            }
        };

        syncClientStatusOnboarding();
        window.addEventListener("storage", syncClientStatusOnboarding);
        window.addEventListener(
            ONBOARDING_ACTIVE_STEP_EVENT,
            syncClientStatusOnboarding as EventListener,
        );

        return () => {
            window.removeEventListener("storage", syncClientStatusOnboarding);
            window.removeEventListener(
                ONBOARDING_ACTIVE_STEP_EVENT,
                syncClientStatusOnboarding as EventListener,
            );
        };
    }, []);
    const latestFetchRequestIdRef = React.useRef(0);

    const showFeedback = React.useCallback((message: string, title?: string) => {
        setFeedbackDialog({
            open: true,
            title: title || (locale === "en" ? "Information" : "Informasi"),
            message,
        });
    }, [locale]);
    const closeManageMode = React.useCallback(() => {
        setIsManageMode(false);
        setSelectedBookingIds([]);
        setBulkActionDialog({ open: false, action: null });
    }, []);
    const openBulkActionDialog = React.useCallback((action: BulkActionKind) => {
        setBulkActionDialog({ open: true, action });
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
    const resetFilters = React.useCallback(() => {
        setSearchQuery("");
        setDebouncedSearchQuery("");
        setStatusFilter([]);
        setPackageFilter([]);
        setEventTypeFilter([]);
        setDateFromFilter("");
        setDateToFilter("");
        setDateBasis("booking_date");
        setSortOrder("booking_newest");
    }, []);

    React.useEffect(() => {
        if (typeof window === "undefined") return;
        const nextTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (nextTimeZone && nextTimeZone.trim()) {
            setBrowserTimeZone(nextTimeZone);
        }
    }, []);

    const statusColors = React.useMemo(() => {
        const map: Record<string, string> = {};
        clientStatuses.forEach((s, i) => { map[s] = STATUS_COLOR_PALETTE[i % STATUS_COLOR_PALETTE.length]; });
        map[CANCELLED_BOOKING_STATUS] = "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400";
        return map;
    }, [clientStatuses]);

    React.useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [searchQuery]);

    const fetchBookingsPage = React.useCallback(async (mode: "initial" | "refresh" = "refresh") => {
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
            const singleEventTypeFilter = eventTypeFilter[0] || "All";
            const metadataEventTypeFilterKey = JSON.stringify({
                archiveMode,
                eventTypeFilter: [...eventTypeFilter].sort(),
            });
            const includeMetadata =
                !clientStatusMetadataCacheRef.current ||
                clientStatusMetadataEventTypeFilterKeyRef.current !== metadataEventTypeFilterKey;
            const params = new URLSearchParams({
                page: String(currentPage),
                perPage: String(itemsPerPage),
                search: debouncedSearchQuery,
                status: singleStatusFilter,
                package: singlePackageFilter,
                eventType: singleEventTypeFilter,
                statusFilters: JSON.stringify(statusFilter),
                packageFilters: JSON.stringify(packageFilter),
                eventTypeFilters: JSON.stringify(eventTypeFilter),
                dateFrom: dateFromFilter,
                dateTo: dateToFilter,
                dateBasis,
                sortOrder,
                timeZone: browserTimeZone,
                archiveMode,
                includeMetadata: includeMetadata ? "1" : "0",
            });

            const response = await fetchPaginatedJson<BookingStatus, ClientStatusPageMetadata>(
                `/api/internal/client-status?${params.toString()}`,
                { signal: controller.signal },
            );
            if (
                controller.signal.aborted ||
                latestFetchRequestIdRef.current !== requestId
            ) {
                return;
            }
            if (response.metadata) {
                clientStatusMetadataCacheRef.current = response.metadata;
                clientStatusMetadataEventTypeFilterKeyRef.current = metadataEventTypeFilterKey;
            }
            const metadata = response.metadata || clientStatusMetadataCacheRef.current;

            setBookings(response.items);
            setTotalItems(response.totalItems);
            if (metadata) {
                setClientStatuses(metadata.clientStatuses || DEFAULT_CLIENT_STATUSES);
                setQueueTriggerStatus(
                    normalizeQueueTriggerStatus(metadata.queueTriggerStatus),
                );
                setDpVerifyTriggerStatus(metadata.dpVerifyTriggerStatus || "");
                setClientStatusDeadlineTriggerStatus(
                    normalizeClientStatusDeadlineTriggerStatus(
                        metadata.clientStatusDeadlineTriggerStatus,
                        metadata.clientStatuses,
                    ),
                );
                setClientStatusDeadlineDefaultDays(
                    normalizeClientStatusDeadlineDefaultDays(
                        metadata.clientStatusDeadlineDefaultDays,
                    ),
                );
                setPackages(metadata.packages || []);
                setAvailableEventTypes(metadata.availableEventTypes || []);
                setFormSectionsByEventType(metadata.formSectionsByEventType || {});
                setMetadataRows(metadata.metadataRows || []);

                const nextColumnDefaults = lockBoundaryColumns([
                    ...BASE_CLIENT_STATUS_COLUMNS.slice(0, -1),
                    ...buildBookingMetadataColumns(
                        metadata.metadataRows || [],
                        metadata.formSectionsByEventType || {},
                    ),
                    BASE_CLIENT_STATUS_COLUMNS[BASE_CLIENT_STATUS_COLUMNS.length - 1],
                ]);
                setColumns((current) => {
                    const nextColumns = mergeTableColumnPreferences(
                        nextColumnDefaults,
                        metadata.tableColumnPreferences || undefined,
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
            console.error("[ClientStatusPage] Failed to fetch bookings page", error);
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
        browserTimeZone,
        currentPage,
        dateBasis,
        dateFromFilter,
        dateToFilter,
        debouncedSearchQuery,
        eventTypeFilter,
        archiveMode,
        filtersHydrated,
        itemsPerPage,
        itemsPerPageHydrated,
        packageFilter,
        sortOrder,
        statusFilter,
    ]);

    React.useEffect(() => {
        async function hydrateCurrentUser() {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUserId(user?.id || null);
        }

        void hydrateCurrentUser();
    }, [supabase]);

    React.useEffect(() => {
        if (!itemsPerPageHydrated || !filtersHydrated) return;
        const mode = hasLoadedBookingsRef.current ? "refresh" : "initial";
        hasLoadedBookingsRef.current = true;
        void fetchBookingsPage(mode);
    }, [fetchBookingsPage, filtersHydrated, itemsPerPageHydrated]);

    React.useEffect(() => {
        return () => {
            activeFetchControllerRef.current?.abort();
            activeFetchControllerRef.current = null;
        };
    }, []);

    React.useEffect(() => {
        if (!currentUserId) {
            setItemsPerPageHydrated(false);
            return;
        }
        const storageKey = `${CLIENT_STATUS_ITEMS_PER_PAGE_STORAGE_PREFIX}:${currentUserId}`;
        try {
            const raw = window.localStorage.getItem(storageKey);
            setItemsPerPage(normalizeClientStatusItemsPerPage(raw));
        } catch {
            setItemsPerPage(CLIENT_STATUS_DEFAULT_ITEMS_PER_PAGE);
        } finally {
            setItemsPerPageHydrated(true);
        }
    }, [currentUserId]);

    React.useEffect(() => {
        if (!currentUserId) {
            setFiltersHydrated(false);
            return;
        }

        setFiltersHydrated(false);
        const storageKey = `${CLIENT_STATUS_FILTER_STORAGE_PREFIX}:${currentUserId}`;
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

            const readString = (key: string, fallback = "") => {
                const value = parsed[key];
                return typeof value === "string" ? value : fallback;
            };

            setSearchQuery(readString("searchQuery", ""));
            setDebouncedSearchQuery(readString("searchQuery", ""));
            setArchiveMode(normalizeBookingArchiveMode(parsed.archiveMode));
            setStatusFilter(parseLegacyOrMultiFilterValue(parsed.statusFilter));
            setPackageFilter(parseLegacyOrMultiFilterValue(parsed.packageFilter));
            setEventTypeFilter(parseLegacyOrMultiFilterValue(parsed.eventTypeFilter));
            setDateFromFilter(readString("dateFromFilter", ""));
            setDateToFilter(readString("dateToFilter", ""));
            setDateBasis(parseDateBasisValue(parsed.dateBasis));
            setSortOrder(parseSortOrderValue(parsed.sortOrder));
        } catch {
            setArchiveMode("active");
            resetFilters();
        } finally {
            setFiltersHydrated(true);
        }
    }, [currentUserId, resetFilters]);

    React.useEffect(() => {
        if (!currentUserId || !itemsPerPageHydrated) return;
        const storageKey = `${CLIENT_STATUS_ITEMS_PER_PAGE_STORAGE_PREFIX}:${currentUserId}`;
        try {
            window.localStorage.setItem(storageKey, String(normalizeClientStatusItemsPerPage(itemsPerPage)));
        } catch {
            // Ignore storage write failures.
        }
    }, [currentUserId, itemsPerPage, itemsPerPageHydrated]);

    React.useEffect(() => {
        if (!currentUserId || !filtersHydrated) return;
        const storageKey = `${CLIENT_STATUS_FILTER_STORAGE_PREFIX}:${currentUserId}`;
        const payload: ClientStatusFilterStoragePayload = {
            searchQuery,
            archiveMode,
            statusFilter,
            packageFilter,
            eventTypeFilter,
            dateFromFilter,
            dateToFilter,
            dateBasis,
            sortOrder,
        };
        try {
            window.localStorage.setItem(storageKey, JSON.stringify(payload));
        } catch {
            // Ignore storage write failures.
        }
    }, [
        currentUserId,
        dateBasis,
        dateFromFilter,
        dateToFilter,
        eventTypeFilter,
        archiveMode,
        filtersHydrated,
        packageFilter,
        searchQuery,
        sortOrder,
        statusFilter,
    ]);

    React.useEffect(() => {
        if (!currentUserId) return;
        const storageKey = `${CLIENT_STATUS_ITEMS_PER_PAGE_STORAGE_PREFIX}:${currentUserId}`;
        function handleStorage(event: StorageEvent) {
            if (event.storageArea !== window.localStorage) return;
            if (event.key !== storageKey) return;
            setItemsPerPage(normalizeClientStatusItemsPerPage(event.newValue));
        }
        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, [currentUserId]);

    React.useEffect(() => {
        if (!currentUserId) return;
        const storageKey = `${CLIENT_STATUS_FILTER_STORAGE_PREFIX}:${currentUserId}`;
        function handleStorage(event: StorageEvent) {
            if (event.storageArea !== window.localStorage) return;
            if (event.key !== storageKey) return;
            if (!event.newValue) {
                resetFilters();
                return;
            }

            try {
                const parsed = JSON.parse(event.newValue) as unknown;
                if (!isObjectRecord(parsed)) return;
                const readString = (key: string, fallback = "") => {
                    const value = parsed[key];
                    return typeof value === "string" ? value : fallback;
                };
                setSearchQuery(readString("searchQuery", ""));
                setDebouncedSearchQuery(readString("searchQuery", ""));
                setStatusFilter(parseLegacyOrMultiFilterValue(parsed.statusFilter));
                setPackageFilter(parseLegacyOrMultiFilterValue(parsed.packageFilter));
                setEventTypeFilter(parseLegacyOrMultiFilterValue(parsed.eventTypeFilter));
                setDateFromFilter(readString("dateFromFilter", ""));
                setDateToFilter(readString("dateToFilter", ""));
                setDateBasis(parseDateBasisValue(parsed.dateBasis));
                setSortOrder(parseSortOrderValue(parsed.sortOrder));
            } catch {
                // Ignore malformed payload.
            }
        }
        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, [currentUserId, resetFilters]);

    React.useEffect(() => {
        const nextDefaults = lockBoundaryColumns([
            ...BASE_CLIENT_STATUS_COLUMNS.slice(0, -1),
            ...buildBookingMetadataColumns(metadataRows, formSectionsByEventType),
            BASE_CLIENT_STATUS_COLUMNS[BASE_CLIENT_STATUS_COLUMNS.length - 1],
        ]);
        setColumns((current) => {
            const nextColumns = mergeTableColumnPreferences(nextDefaults, current);
            return areTableColumnPreferencesEqual(current, nextColumns)
                ? current
                : nextColumns;
        });
    }, [formSectionsByEventType, metadataRows]);

    React.useEffect(() => {
        if (loading) return;

        const normalizedStatusFilter = normalizeSelectedFilterValues(
            statusFilter,
            clientStatuses,
        );
        if (!arraysAreEqual(normalizedStatusFilter, statusFilter)) {
            setStatusFilter(normalizedStatusFilter);
        }

        const normalizedPackageFilter = normalizeSelectedFilterValues(
            packageFilter,
            packages,
        );
        if (!arraysAreEqual(normalizedPackageFilter, packageFilter)) {
            setPackageFilter(normalizedPackageFilter);
        }

        const normalizedEventTypeFilter = normalizeSelectedFilterValues(
            eventTypeFilter,
            availableEventTypes,
        );
        if (!arraysAreEqual(normalizedEventTypeFilter, eventTypeFilter)) {
            setEventTypeFilter(normalizedEventTypeFilter);
        }
    }, [
        availableEventTypes,
        clientStatuses,
        eventTypeFilter,
        loading,
        packageFilter,
        packages,
        statusFilter,
    ]);

    async function updateStatus(
        id: string,
        clientStatus: string,
        options?: {
            skipCancelConfirmation?: boolean;
            cancelPayment?: { policy: CancelPaymentPolicy; refundAmount: number };
        },
    ) {
        if (!requireBookingWrite()) return;
        const oldBooking = bookings.find((booking) => booking.id === id);
        if (!oldBooking) return;

        const previousStatus = oldBooking.client_status || oldBooking.status || null;
        const nextStatus = clientStatus || null;
        if (
            isTransitionToCancelled(previousStatus, nextStatus) &&
            !options?.skipCancelConfirmation
        ) {
            setCancelStatusConfirm({
                open: true,
                booking: oldBooking,
                nextStatus: clientStatus,
            });
            return;
        }

        setSavingId(id);
        const isCancelling = isTransitionToCancelled(previousStatus, nextStatus);
        const cancelPatch = isCancelling
            ? buildCancelPaymentPatch({
                policy: options?.cancelPayment?.policy || "forfeit",
                refundAmount: options?.cancelPayment?.refundAmount || 0,
                verifiedAmount: oldBooking.dp_verified_amount || 0,
            })
            : null;
        const autoDpPatch = buildAutoDpVerificationPatch({
            previousStatus,
            nextStatus,
            triggerStatus: dpVerifyTriggerStatus,
            dpPaid: oldBooking.dp_paid,
            dpVerifiedAt: oldBooking.dp_verified_at,
        });
        const invalidationTargets = new Map<string, { bookingCode?: string | null; trackingUuid?: string | null }>();
        const pushInvalidationTarget = (target: { bookingCode?: string | null; trackingUuid?: string | null }) => {
            const bookingCode = target.bookingCode?.trim() || "";
            const trackingUuid = target.trackingUuid?.trim() || "";
            if (!bookingCode && !trackingUuid) return;
            invalidationTargets.set(`${bookingCode}::${trackingUuid}`, {
                bookingCode: bookingCode || null,
                trackingUuid: trackingUuid || null,
            });
        };
        pushInvalidationTarget({
            bookingCode: oldBooking.booking_code,
            trackingUuid: oldBooking.tracking_uuid,
        });

        try {
            const normalizedQueueTriggerStatus = normalizeQueueTriggerStatus(
                queueTriggerStatus,
            );
            const updateResult = await updateBookingStatusWithQueueTransition({
                supabase,
                bookingId: id,
                previousStatus,
                nextStatus,
                queueTriggerStatus: normalizedQueueTriggerStatus,
                currentDeadlineDate: oldBooking.project_deadline_date,
                deadlineTriggerStatus: clientStatusDeadlineTriggerStatus,
                deadlineDefaultDays: clientStatusDeadlineDefaultDays,
                patch: {
                    ...(cancelPatch || {}),
                    ...(autoDpPatch || {}),
                },
            });
            if (!updateResult.ok) {
                console.error("[ClientStatusPage] Failed to update booking status", {
                    bookingId: id,
                    previousStatus,
                    nextStatus,
                    queueTriggerStatus: normalizedQueueTriggerStatus,
                    errorMessage: updateResult.errorMessage,
                });
                showFeedback(updateResult.errorMessage || t("failedUpdateStatus"));
                return;
            }

            if (
                updateResult.transition === "left" &&
                normalizedQueueTriggerStatus
            ) {
                const { data: remainingRows, error: remainingRowsError } = await supabase
                    .from("bookings")
                    .select("booking_code, tracking_uuid")
                    .eq("client_status", normalizedQueueTriggerStatus)
                    .not("queue_position", "is", null);

                if (remainingRowsError) {
                    console.error(
                        "[ClientStatusPage] Failed to read remaining queue rows for cache invalidation",
                        remainingRowsError,
                    );
                } else {
                    ((remainingRows || []) as Array<{
                        booking_code?: string | null;
                        tracking_uuid?: string | null;
                    }>).forEach((booking) => {
                        pushInvalidationTarget({
                            bookingCode: booking.booking_code || null,
                            trackingUuid: booking.tracking_uuid || null,
                        });
                    });
                }
            }

            setBookings((prev) =>
                prev.map((booking) =>
                    booking.id === id
                        ? {
                            ...booking,
                            status: nextStatus || booking.status,
                            client_status: nextStatus,
                            queue_position:
                                updateResult.transition === "entered"
                                    ? (updateResult.queuePosition ?? booking.queue_position)
                                    : updateResult.transition === "left"
                                        ? null
                                        : booking.queue_position,
                            project_deadline_date:
                                updateResult.projectDeadlineDate ?? booking.project_deadline_date,
                            ...(cancelPatch || {}),
                            ...(autoDpPatch || {}),
                        }
                        : booking,
                ),
            );

            await Promise.allSettled(
                Array.from(invalidationTargets.values()).map((target) =>
                    invalidateBookingPublicCache(target),
                ),
            );

            setCancelStatusConfirm({ open: false, booking: null, nextStatus: "" });
            const calendarWarning = await syncGoogleCalendarForStatusTransition({
                bookingId: id,
                previousStatus,
                nextStatus,
                locale,
            });
            if (calendarWarning) {
                showFeedback(
                    calendarWarning,
                    locale === "en" ? "Warning" : "Peringatan",
                );
            }
            void fetchBookingsPage("refresh");
        } finally {
            setSavingId(null);
        }
    }

    async function updateQueue(id: string, pos: number | null) {
        if (!requireBookingWrite()) return;
        await supabase.from("bookings").update({ queue_position: pos }).eq("id", id);
        setBookings(prev => prev.map(b => b.id === id ? { ...b, queue_position: pos } : b));
        const booking = bookings.find((item) => item.id === id);
        if (!booking) return;
        await invalidateBookingPublicCache({
            bookingCode: booking.booking_code,
            trackingUuid: booking.tracking_uuid,
        });
    }

    async function updateProjectDeadline(id: string, value: string) {
        if (!requireBookingWrite()) return;
        const currentBooking = bookings.find((booking) => booking.id === id);
        if (!currentBooking) return;

        const normalizedProjectDeadline = normalizeProjectDeadlineDate(value);
        if (
            normalizeProjectDeadlineDate(currentBooking.project_deadline_date) ===
            normalizedProjectDeadline
        ) {
            return;
        }

        setSavingId(id);
        try {
            const { error } = await supabase
                .from("bookings")
                .update({ project_deadline_date: normalizedProjectDeadline })
                .eq("id", id);

            if (error) {
                showFeedback(
                    locale === "en"
                        ? "Failed to save project deadline."
                        : "Gagal menyimpan deadline project.",
                    locale === "en" ? "Warning" : t("warningTitle"),
                );
                return;
            }

            setBookings((prev) =>
                prev.map((booking) =>
                    booking.id === id
                        ? { ...booking, project_deadline_date: normalizedProjectDeadline }
                        : booking,
                ),
            );
            await invalidateBookingPublicCache({
                bookingCode: currentBooking.booking_code,
                trackingUuid: currentBooking.tracking_uuid,
            });
        } finally {
            setSavingId(null);
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

    async function deleteSingleBooking(booking: BookingStatus) {
        const result = await deleteBookingWithDependencies({
            supabase,
            booking,
            locale,
        });
        return {
            ok: result.ok,
            warningDetails: formatDeleteWarnings(result.warnings),
        } as const;
    }

    function openArchiveConfirmation(booking: BookingStatus) {
        setArchiveDialog({
            open: true,
            booking,
            nextArchived: !isArchivedBooking(booking),
        });
    }

    async function archiveSingleBooking(booking: BookingStatus, nextArchived: boolean) {
        const { error } = await supabase
            .from("bookings")
            .update(
                nextArchived
                    ? {
                        archived_at: new Date().toISOString(),
                        archived_by: currentUserId,
                    }
                    : {
                        archived_at: null,
                        archived_by: null,
                    },
            )
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
            showFeedback(
                locale === "en"
                    ? "Failed to update archive status."
                    : "Gagal memperbarui status arsip.",
                locale === "en" ? "Warning" : t("warningTitle"),
            );
            return;
        }

        setArchiveDialog({ open: false, booking: null, nextArchived: false });
        void fetchBookingsPage("refresh");
    }

    async function confirmBulkAction() {
        if (!requireBookingWrite()) return;
        if (!bulkActionDialog.action || selectedBookingIds.length === 0) return;

        const selectedBookings = bookings.filter((booking) =>
            selectedBookingIdSet.has(booking.id),
        );
        if (selectedBookings.length === 0) return;

        setBulkActionLoading(true);
        let failedCount = 0;
        const warningMessages: string[] = [];

        if (bulkActionDialog.action === "archive" || bulkActionDialog.action === "restore") {
            const nextArchived = bulkActionDialog.action === "archive";
            for (const booking of selectedBookings) {
                const ok = await archiveSingleBooking(booking, nextArchived);
                if (!ok) {
                    failedCount += 1;
                }
            }
        } else {
            for (const booking of selectedBookings) {
                const result = await deleteSingleBooking(booking);
                if (!result.ok) {
                    failedCount += 1;
                }
                warningMessages.push(...result.warningDetails);
            }
        }

        setBulkActionLoading(false);
        setBulkActionDialog({ open: false, action: null });

        if (failedCount > 0 || warningMessages.length > 0) {
            const details: string[] = [];
            if (failedCount > 0) {
                details.push(
                    locale === "en"
                        ? `${failedCount} booking${failedCount > 1 ? "s" : ""} failed to process.`
                        : `${failedCount} booking gagal diproses.`,
                );
            }
            if (warningMessages.length > 0) {
                details.push(warningMessages.join(" "));
            }
            showFeedback(
                details.join(" "),
                locale === "en" ? "Warning" : t("warningTitle"),
            );
        }

        setSelectedBookingIds([]);
        void fetchBookingsPage("refresh");
    }

    async function copyTrackLink(uuid: string, id: string) {
        const url = `${window.location.origin}/${locale}/track/${uuid}`;
        try {
            await navigator.clipboard.writeText(url);
            showSuccessToast(t("trackingLinkCopied"));
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch {
            showFeedback(
                locale === "en"
                    ? "Failed to copy tracking link."
                    : t("trackingLinkCopyFailed"),
                locale === "en" ? "Warning" : t("warningTitle"),
            );
        }
    }

    React.useEffect(() => {
        setCurrentPage(1);
    }, [
        dateBasis,
        dateFromFilter,
        dateToFilter,
        debouncedSearchQuery,
        eventTypeFilter,
        itemsPerPage,
        archiveMode,
        packageFilter,
        sortOrder,
        statusFilter,
    ]);

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
                ? [CLIENT_STATUS_MANAGE_SELECT_COLUMN, ...orderedVisibleColumns]
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
        menuKey: "client_status",
        userId: currentUserId,
        columns: tableVisibleColumns,
        nonResizableColumnIds: CLIENT_STATUS_NON_RESIZABLE_COLUMN_IDS,
        minWidthByColumnId: CLIENT_STATUS_COLUMN_MIN_WIDTHS,
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
    const statusOptions = React.useMemo(
        () => getBookingStatusOptions(clientStatuses),
        [clientStatuses],
    );
    const deadlineLocale = locale === "en" ? "en" : "id";
    const statusSelectOptions = React.useMemo(
        () => [{ value: "", label: t("belumDiset") }, ...statusOptions.map((status) => ({ value: status, label: status }))],
        [statusOptions, t],
    );
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
    const statusFilterOptions = React.useMemo(
        () => clientStatuses.map((status) => ({ value: status, label: status })),
        [clientStatuses],
    );
    const packageFilterOptions = React.useMemo(
        () => packages.map((packageName) => ({ value: packageName, label: packageName })),
        [packages],
    );
    const eventTypeFilterOptions = React.useMemo(
        () => availableEventTypes.map((eventType) => ({ value: eventType, label: eventType })),
        [availableEventTypes],
    );
    const multiCountSuffix = locale === "en" ? "selected" : "dipilih";
    const isArchiveView = archiveMode === "archived";
    const hasActiveFilters =
        statusFilter.length > 0 ||
        packageFilter.length > 0 ||
        eventTypeFilter.length > 0 ||
        Boolean(dateFromFilter) ||
        Boolean(dateToFilter) ||
        dateBasis !== "booking_date" ||
        Boolean(searchQuery) ||
        sortOrder !== "booking_newest";
    const archiveToggleLabels = React.useMemo(
        () => ({
            active: tc("aktif"),
            archived: tc("arsip"),
        }),
        [tc],
    );
    const queryState = React.useMemo<PaginatedQueryState>(() => ({
        page: currentPage,
        perPage: itemsPerPage,
        totalItems,
        isLoading: loading,
        isRefreshing: refreshing,
    }), [currentPage, itemsPerPage, totalItems, loading, refreshing]);
    const visibleBookingIds = React.useMemo(
        () => bookings.map((booking) => booking.id),
        [bookings],
    );
    const allVisibleSelected = React.useMemo(
        () => areAllVisibleSelected(selectedBookingIds, visibleBookingIds),
        [selectedBookingIds, visibleBookingIds],
    );
    const selectedCount = selectedBookingIds.length;
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
    const selectedBookingIdSet = React.useMemo(
        () => new Set(selectedBookingIds),
        [selectedBookingIds],
    );
    React.useEffect(() => {
        setSelectedBookingIds((current) => {
            const next = pruneSelection(current, visibleBookingIds);
            return next.length === current.length ? current : next;
        });
    }, [visibleBookingIds]);
    const handleColumnManagerOpenChange = React.useCallback((nextOpen: boolean) => {
        setColumnManagerOpen(nextOpen);
    }, []);
    React.useEffect(() => {
        if (!columnManagerOpen) return;
        cancelActiveResize();
    }, [cancelActiveResize, columnManagerOpen]);

    async function saveColumnPreferences(nextColumns: TableColumnPreference[]) {
        const normalizedNextColumns = lockBoundaryColumns(nextColumns);
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
            "client_status",
            normalizedNextColumns,
        );
        await supabase
            .from("profiles")
            .update({ table_column_preferences: payload })
            .eq("id", user.id);
        await invalidateProfilePublicCache();
        if (clientStatusMetadataCacheRef.current) {
            clientStatusMetadataCacheRef.current = {
                ...clientStatusMetadataCacheRef.current,
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
                return renderDesktopHeaderCell(column, "px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap", locale === "en" ? "Client" : "Klien");
            case "row_number":
                return renderDesktopHeaderCell(column, "w-16 px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap text-center", "No.");
            case "package":
                return renderDesktopHeaderCell(column, "px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap hidden sm:table-cell", locale === "en" ? "Package" : "Paket");
            case "event_type":
                return renderDesktopHeaderCell(column, "px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap hidden sm:table-cell", locale === "en" ? "Event Type" : "Tipe Acara");
            case "status":
                return renderDesktopHeaderCell(column, "px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap", locale === "en" ? "Status" : "Status");
            case "queue":
                return renderDesktopHeaderCell(column, "px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap text-center hidden sm:table-cell", t("antrian"));
            case "deadline":
                return renderDesktopHeaderCell(column, "px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap", locale === "en" ? "Deadline" : "Deadline");
            case "actions":
                return renderDesktopHeaderCell(column, "min-w-[96px] px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap text-right", t("aksi"));
            default:
                return renderDesktopHeaderCell(column, "px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap", column.label);
        }
    }

    function renderDesktopCell(
        booking: BookingStatus,
        column: TableColumnPreference,
        rowNumber: number,
    ) {
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
                    <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3")}>
                        <Link href={`/bookings/${booking.id}`} className="hover:underline">
                            <p className="text-sm font-medium leading-tight">{booking.client_name}</p>
                            <p className="text-[11px] text-muted-foreground">{booking.booking_code}</p>
                        </Link>
                    </td>
                );
            case "row_number":
                return (
                    <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3 text-center text-sm text-muted-foreground")}>
                        {rowNumber}
                    </td>
                );
            case "package":
                return <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3 text-sm hidden sm:table-cell text-muted-foreground")}>{booking.service_label || booking.services?.name || "-"}</td>;
            case "event_type":
                return <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3 text-sm hidden sm:table-cell text-muted-foreground max-w-[180px] truncate")} title={booking.event_type || "-"}>{booking.event_type || "-"}</td>;
            case "status":
                return (
                    <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3")}>
                        <FilterSingleSelect
                            value={booking.client_status || ""}
                            onChange={(nextValue) => void updateStatus(booking.id, nextValue)}
                            options={statusSelectOptions}
                            placeholder={t("belumDiset")}
                            disabled={savingId === booking.id || !canWriteBookings || isManageMode}
                            title={!canWriteBookings ? bookingWriteBlockedMessage : undefined}
                            className="inline-block w-[172px] align-middle"
                            triggerClassName={inlineStatusTriggerClass}
                            mobileTitle="Status"
                            usePortalDesktopMenu
                        />
                        {booking.client_status && (
                            <span className={`ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColors[booking.client_status] || "bg-muted text-muted-foreground"}`}>
                                {booking.client_status}
                            </span>
                        )}
                    </td>
                );
            case "queue":
                return (
                    <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3 text-center hidden sm:table-cell")}>
                        <input
                            type="number"
                            min={0}
                            value={booking.queue_position ?? ""}
                            onChange={e => {
                                const val = e.target.value === "" ? null : parseInt(e.target.value, 10);
                                updateQueue(booking.id, val);
                            }}
                            placeholder="-"
                            disabled={!canWriteBookings || isManageMode}
                            title={!canWriteBookings ? bookingWriteBlockedMessage : undefined}
                            className={inputClass}
                        />
                    </td>
                );
            case "deadline": {
                const deadlineCountdown = getProjectDeadlineCountdownLabel(
                    booking.project_deadline_date,
                    deadlineLocale,
                );
                return (
                    <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3")}>
                        <div className="space-y-1.5">
                            <ProjectDeadlineDatePicker
                                value={booking.project_deadline_date}
                                onChange={(nextValue) => void updateProjectDeadline(booking.id, nextValue ?? "")}
                                disabled={!canWriteBookings || isManageMode || savingId === booking.id}
                                locale={deadlineLocale}
                                placeholder={locale === "en" ? "Pick deadline" : "Pilih deadline"}
                                clearLabel={locale === "en" ? "Clear deadline" : "Hapus deadline"}
                                title={!canWriteBookings ? bookingWriteBlockedMessage : undefined}
                            />
                            {deadlineCountdown ? (
                                <span className={getAdminDeadlineBadgeClassName(booking.project_deadline_date)}>
                                    {deadlineCountdown}
                                </span>
                            ) : null}
                        </div>
                    </td>
                );
            }
            case "actions":
                return (
                    <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "min-w-[96px] px-4 py-3 text-right")}>
                        <div className="flex items-center justify-end gap-1.5">
                            {isManageMode ? null : (
                                <>
                            {booking.tracking_uuid && (
                                <>
                                    <ActionIconButton
                                        tone={copiedId === booking.id ? "green" : "violet"}
                                        title={t("salinLinkTracking")}
                                        onClick={() => void copyTrackLink(booking.tracking_uuid!, booking.id)}
                                    >
                                        {copiedId === booking.id ? <ClipboardCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    </ActionIconButton>
                                    <ActionIconButton
                                        tone="blue"
                                        title={t("bukaTracking")}
                                        onClick={() => window.open(`/${locale}/track/${booking.tracking_uuid}`, "_blank")}
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </ActionIconButton>
                                </>
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

    function renderMobileValue(booking: BookingStatus, column: TableColumnPreference) {
        switch (column.id) {
            case "package":
                return booking.service_label || booking.services?.name || "-";
            case "event_type":
                return booking.event_type || "-";
            case "status":
                return booking.client_status || t("belumDiset");
            case "queue":
                return booking.queue_position ?? "-";
            case "deadline": {
                const deadlineCountdown = getProjectDeadlineCountdownLabel(
                    booking.project_deadline_date,
                    deadlineLocale,
                );
                return deadlineCountdown ? (
                    <span className={getAdminDeadlineBadgeClassName(booking.project_deadline_date)}>
                        {deadlineCountdown}
                    </span>
                ) : "-";
            }
            default:
                return getBookingMetadataValue(booking.extra_fields, column.id, { locale: locale === "en" ? "en" : "id" });
        }
    }

    const inlineStatusTriggerClass = "h-8 rounded-md bg-background px-2 py-1 text-xs shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
    const inputClass = "h-8 rounded-md border border-input bg-background px-2 py-1 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] w-16 text-center";

    return (
        <div className="space-y-6">
            {successToastNode}
            <BookingWriteReadonlyBanner />
            <PageHeader
                actions={(
                    <TableColumnManager
                        title="Kelola Kolom Status Booking"
                        description="Atur kolom yang tampil di tabel status booking. Kolom Nama dan Aksi selalu tampil, serta lock-nya bisa diaktifkan atau dimatikan."
                        columns={columns}
                        open={columnManagerOpen}
                        onOpenChange={handleColumnManagerOpenChange}
                        onChange={setColumns}
                        onSave={() => saveColumnPreferences(columns)}
                        onResetWidths={() => handleResetColumnWidths()}
                        saving={savingColumns}
                        resettingWidths={resettingColumnWidths}
                        triggerClassName="w-full lg:w-auto"
                    />
                )}
            >
                <div>
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Activity className="w-6 h-6" /> {t("title")}
                    </h2>
                    <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
                </div>
            </PageHeader>

            {/* Filters */}
            <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="relative min-w-0 flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={t("cariPlaceholder")}
                            className="h-9 w-full rounded-md border border-input bg-background/50 pl-9 pr-3 text-sm shadow-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                    </div>
                    <button
                        type="button"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-background/50 px-0 text-sm hover:bg-muted/30 sm:w-auto sm:gap-2 sm:px-3"
                        onClick={() => setShowFilterPanel((prev) => !prev)}
                        aria-label="Filter"
                    >
                        <ListOrdered className="w-4 h-4" />
                        <span className="hidden sm:inline">Filter</span>
                    </button>
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
                                type="button"
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
                            type="button"
                            onClick={resetFilters}
                            className="h-9 w-full px-3 rounded-md border border-input bg-background/50 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" /> Reset
                        </button>
                    )}
                </div>
                {showFilterPanel && (
                    <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
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
                                <label className="text-xs font-medium text-muted-foreground md:w-24 md:shrink-0">{tb("eventTypeLabel")}</label>
                                <FilterMultiSelect
                                    values={eventTypeFilter}
                                    onChange={setEventTypeFilter}
                                    options={eventTypeFilterOptions}
                                    placeholder={tb("allEventTypes")}
                                    allLabel={tb("allEventTypes")}
                                    countSuffix={multiCountSuffix}
                                    className="w-full"
                                    mobileTitle={tb("eventTypeLabel")}
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
                        </div>
                    </div>
                )}
            </div>

            <div data-onboarding-target="client-status-table">
                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                    {queryState.isLoading || queryState.isRefreshing ? (
                        <CardListSkeleton count={Math.min(queryState.perPage, 4)} />
                    ) : queryState.totalItems === 0 ? (
                        <div className="text-center py-12 text-muted-foreground text-sm">{hasActiveFilters ? t("tidakAdaHasil") : t("belumAdaBooking")}</div>
                    ) : bookings.map(b => (
                        <div
                            key={b.id}
                            className={cn(
                                "rounded-xl border bg-card shadow-sm p-4 space-y-3",
                                isManageMode && selectedBookingIdSet.has(b.id) && "ring-1 ring-foreground/20",
                            )}
                        >
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                                {isManageMode ? (
                                    <AppCheckbox
                                        checked={selectedBookingIdSet.has(b.id)}
                                        onCheckedChange={() =>
                                            setSelectedBookingIds((current) =>
                                                toggleSelection(current, b.id),
                                            )
                                        }
                                        aria-label={tc("modeKelola")}
                                        className="mt-0.5"
                                    />
                                ) : null}
                                <Link href={`/bookings/${b.id}`} className="hover:underline">
                                    <p className="font-semibold">{b.client_name}</p>
                                    <p className="text-xs text-muted-foreground">{b.booking_code}</p>
                                </Link>
                            </div>
                            {b.client_status && (
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColors[b.client_status] || "bg-muted text-muted-foreground"}`}>
                                    {b.client_status}
                                </span>
                            )}
                        </div>
                        <div className="border-t pt-2 space-y-2">
                            {orderedVisibleColumns
                                .filter((column) => !["name", "row_number", "status", "queue", "deadline", "actions"].includes(column.id))
                                .map((column) => (
                                    <div key={column.id} className="flex items-start justify-between gap-3 text-sm">
                                        <span className="text-muted-foreground">{column.label}</span>
                                        <span className="max-w-[180px] truncate text-right text-foreground" title={String(renderMobileValue(b, column) ?? "-")}>
                                            {renderMobileValue(b, column)}
                                        </span>
                                    </div>
                                ))}
                            <div className="flex items-center gap-3">
                                <label className="text-xs text-muted-foreground shrink-0 w-14">Status</label>
                                <FilterSingleSelect
                                    value={b.client_status || ""}
                                    onChange={(nextValue) => void updateStatus(b.id, nextValue)}
                                    options={statusSelectOptions}
                                    placeholder={t("belumDiset")}
                                    disabled={savingId === b.id || !canWriteBookings || isManageMode}
                                    title={!canWriteBookings ? bookingWriteBlockedMessage : undefined}
                                    className="flex-1"
                                    triggerClassName={inlineStatusTriggerClass}
                                    mobileTitle="Status"
                                    usePortalDesktopMenu
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="text-xs text-muted-foreground shrink-0 w-14">{t("antrian")}</label>
                                <input type="number" min={0} value={b.queue_position ?? ""} onChange={e => updateQueue(b.id, e.target.value === "" ? null : parseInt(e.target.value, 10))} placeholder="-" disabled={!canWriteBookings || isManageMode} title={!canWriteBookings ? bookingWriteBlockedMessage : undefined} className={`${inputClass} flex-1`} />
                            </div>
                            <div className="flex items-start gap-3">
                                <label className="text-xs text-muted-foreground shrink-0 w-14 pt-2">Deadline</label>
                                <div className="flex-1 space-y-1.5">
                                    <ProjectDeadlineDatePicker
                                        value={b.project_deadline_date}
                                        onChange={(nextValue) => void updateProjectDeadline(b.id, nextValue ?? "")}
                                        disabled={!canWriteBookings || isManageMode || savingId === b.id}
                                        locale={deadlineLocale}
                                        placeholder={locale === "en" ? "Pick deadline" : "Pilih deadline"}
                                        clearLabel={locale === "en" ? "Clear deadline" : "Hapus deadline"}
                                        title={!canWriteBookings ? bookingWriteBlockedMessage : undefined}
                                        triggerClassName="w-full"
                                        className="w-full"
                                    />
                                    {b.project_deadline_date ? (
                                        <div className="pt-0.5 text-[11px]">
                                            {renderMobileValue(b, { id: "deadline", label: "Deadline", visible: true })}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                        {!isManageMode ? (
                        <div className="flex items-center gap-1 pt-1 border-t">
                            {b.tracking_uuid && (
                                <>
                                    <ActionIconButton tone="blue" title={t("bukaLink")} onClick={() => window.open(`${window.location.origin}/${locale}/track/${b.tracking_uuid}`, "_blank")}>
                                        <ExternalLink className="w-4 h-4" />
                                    </ActionIconButton>
                                    <ActionIconButton tone={copiedId === b.id ? "green" : "violet"} title={t("salinLink")} onClick={() => void copyTrackLink(b.tracking_uuid!, b.id)}>
                                        {copiedId === b.id ? <ClipboardCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    </ActionIconButton>
                                </>
                            )}
                            <ActionIconButton
                                tone={isArchivedBooking(b) ? "amber" : "slate"}
                                title={!canWriteBookings
                                    ? bookingWriteBlockedMessage
                                    : isArchivedBooking(b)
                                        ? tc("kembalikan")
                                        : tc("arsipkan")}
                                onClick={() => openArchiveConfirmation(b)}
                                disabled={!canWriteBookings || archiveSavingId === b.id}
                            >
                                {archiveSavingId === b.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Archive className="w-4 h-4" />
                                )}
                            </ActionIconButton>
                        </div>
                        ) : null}
                        </div>
                    ))}
                </div>
                {!queryState.isLoading && !queryState.isRefreshing && queryState.totalItems > 0 ? (
                    <div className="md:hidden">
                        <TablePagination
                            totalItems={queryState.totalItems}
                            currentPage={queryState.page}
                            itemsPerPage={queryState.perPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                            perPageOptions={[...CLIENT_STATUS_PER_PAGE_OPTIONS]}
                        />
                    </div>
                ) : null}

                {/* Desktop Table */}
                <div className="rounded-xl border bg-card shadow-sm overflow-hidden hidden md:block">
                    <div className="relative overflow-x-auto">
                        <table ref={tableRef} className="min-w-full w-max border-separate border-spacing-0 text-left text-sm">
                            <thead className="text-[11px] uppercase bg-card border-b">
                                <tr>
                                    {tableVisibleColumns.map((column) => renderDesktopHeader(column))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {queryState.isLoading || queryState.isRefreshing ? (
                                    <TableRowsSkeleton
                                        rows={Math.min(queryState.perPage, 6)}
                                        columns={tableVisibleColumns.length}
                                    />
                                ) : queryState.totalItems === 0 ? (
                                    <tr>
                                        <td colSpan={tableVisibleColumns.length} className="text-center py-12 text-sm text-muted-foreground">
                                            {hasActiveFilters ? t("tidakAdaHasil") : t("belumAdaBooking")}
                                        </td>
                                    </tr>
                                ) : (
                                    bookings.map((b, rowIndex) => {
                                        const rowNumber =
                                            (currentPage - 1) * itemsPerPage + rowIndex + 1;
                                        return (
                                            <tr key={b.id} className="group hover:bg-muted/30 transition-colors">
                                                {tableVisibleColumns.map((column) =>
                                                    renderDesktopCell(b, column, rowNumber),
                                                )}
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    <TablePagination totalItems={queryState.totalItems} currentPage={queryState.page} itemsPerPage={queryState.perPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} perPageOptions={[...CLIENT_STATUS_PER_PAGE_OPTIONS]} />
                </div>
            </div>

            <CancelStatusPaymentDialog
                open={cancelStatusConfirm.open}
                onOpenChange={(open) =>
                    setCancelStatusConfirm((prev) =>
                        open ? prev : { open: false, booking: null, nextStatus: "" },
                    )
                }
                bookingName={cancelStatusConfirm.booking?.client_name || ""}
                maxRefundAmount={Math.max(cancelStatusConfirm.booking?.dp_verified_amount || 0, 0)}
                loading={savingId === cancelStatusConfirm.booking?.id}
                onConfirm={({ policy, refundAmount }) => {
                    if (!cancelStatusConfirm.booking) return;
                    void updateStatus(cancelStatusConfirm.booking.id, cancelStatusConfirm.nextStatus, {
                        skipCancelConfirmation: true,
                        cancelPayment: { policy, refundAmount },
                    });
                }}
            />

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
                title={feedbackDialog.title}
                message={feedbackDialog.message}
                confirmLabel={locale === "en" ? "OK" : "OK"}
            />
        </div>
    );
}
