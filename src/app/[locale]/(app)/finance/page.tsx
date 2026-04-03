"use client";

import * as React from "react";
import { Clock, CheckCircle2, FileText, Download, MessageCircle, ExternalLink, Receipt, Info, ChevronDown, Copy, ClipboardCheck, Search, ListOrdered, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionIconButton } from "@/components/ui/action-icon-button";
import { ActionFeedbackDialog } from "@/components/ui/action-feedback-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { MoneyVisibilityToggle } from "@/components/ui/money-visibility";
import { TableActionMenuPortal } from "@/components/ui/table-action-menu-portal";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { formatSessionDate } from "@/utils/format-date";
import { TablePagination } from "@/components/ui/table-pagination";
import { useStickyTableColumns } from "@/components/ui/use-sticky-table-columns";
import { useResizableTableColumns } from "@/components/ui/use-resizable-table-columns";
import { Link } from "@/i18n/routing";
import {
    BookingWriteReadonlyBanner,
    useBookingWriteAccess,
    useBookingWriteGuard,
} from "@/lib/booking-write-access-context";
import { getBookingWriteBlockedMessage } from "@/lib/booking-write-access";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { TableColumnManager } from "@/components/ui/table-column-manager";
import { useSuccessToast } from "@/components/ui/success-toast";
import {
    getBookingServiceLabel,
    getBookingServiceNames,
    normalizeLegacyServiceRecord,
    normalizeBookingServiceSelections,
    type BookingServiceSelection,
} from "@/lib/booking-services";
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
    type FormLayoutItem,
} from "@/components/form-builder/booking-form-layout";
import {
    getFinalInvoiceTotal,
    getNetVerifiedRevenueAmount,
    getRemainingFinalPayment,
} from "@/lib/final-settlement";
import {
    fillWhatsAppTemplate,
    getWhatsAppTemplateContent,
    normalizeWhatsAppNumber,
    resolveWhatsAppTemplateMode,
} from "@/lib/whatsapp-template";
import { getInitialBookingPriceBreakdown } from "@/lib/booking-special-offer";
import {
    DEFAULT_CLIENT_STATUSES,
    getBookingStatusOptions,
} from "@/lib/client-status";
import {
    buildWhatsAppUrl,
    closePreopenedWindow,
    openWhatsAppUrl,
    preopenWindowForDeferredNavigation,
} from "@/utils/whatsapp-link";
import { CardListSkeleton, TableRowsSkeleton } from "@/components/ui/data-skeletons";
import { FilterSingleSelect } from "@/components/ui/filter-single-select";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { BookingDateRangePicker } from "@/components/ui/booking-date-range-picker";
import { fetchPaginatedJson } from "@/lib/pagination/http";
import type { PaginatedQueryState } from "@/lib/pagination/types";
import { buildBookingWhatsAppTemplateVars } from "@/lib/booking-whatsapp-template-vars";
import { useMoneyVisibility } from "@/hooks/use-money-visibility";
import { normalizeHexColor, withAlpha } from "@/lib/service-colors";

type BookingFinance = {
    id: string;
    booking_code: string;
    client_name: string;
    client_whatsapp: string | null;
    instagram?: string | null;
    total_price: number;
    dp_paid: number;
    dp_verified_amount: number;
    dp_verified_at: string | null;
    dp_refund_amount: number;
    dp_refunded_at: string | null;
    is_fully_paid: boolean;
    status: string;
    session_date: string | null;
    event_type: string | null;
    location: string | null;
    location_lat: number | null;
    location_lng: number | null;
    tracking_uuid: string | null;
    client_status: string | null;
    settlement_status: string | null;
    final_adjustments: unknown;
    final_payment_amount: number;
    final_paid_at: string | null;
    final_invoice_sent_at: string | null;
    payment_proof_url: string | null;
    payment_proof_drive_file_id: string | null;
    final_payment_proof_url: string | null;
    final_payment_proof_drive_file_id: string | null;
    extra_fields?: Record<string, unknown> | null;
    services: { id?: string; name: string; price: number; is_addon?: boolean | null } | null;
    booking_services?: unknown[];
    service_selections?: BookingServiceSelection[];
    service_label?: string;
};

type FinanceFilterValue = "all" | "pending" | "paid";

type FinanceFilterStoragePayload = {
    searchQuery: string;
    filter: FinanceFilterValue;
    packageFilter: string[] | string;
    bookingStatusFilter: string[] | string;
    eventTypeFilter: string[] | string;
    dateFromFilter: string;
    dateToFilter: string;
    dateBasis: FinanceDateBasis;
    sortOrder: FinanceSortOrder;
};

const BASE_FINANCE_COLUMNS: TableColumnPreference[] = [
    { id: "row_number", label: "No.", visible: true, locked: true },
    { id: "name", label: "Nama", visible: true },
    { id: "event_type", label: "Tipe Acara", visible: false },
    { id: "total_price", label: "Harga Total", visible: true },
    { id: "package_price", label: "Harga Paket", visible: true },
    { id: "addon", label: "Add-on", visible: true },
    { id: "discount", label: "Diskon", visible: true },
    { id: "dp_paid", label: "DP Dibayar", visible: true },
    { id: "remaining", label: "Sisa", visible: true },
    { id: "status", label: "Status", visible: true },
    { id: "actions", label: "Aksi", visible: true, locked: true, pin: "right" },
];
const FINANCE_NON_RESIZABLE_COLUMN_IDS = ["row_number", "actions"];
const FINANCE_COLUMN_MIN_WIDTHS: Record<string, number> = {
    name: 180,
    event_type: 140,
    total_price: 140,
    package_price: 140,
    addon: 124,
    discount: 120,
    dp_paid: 128,
    remaining: 132,
    status: 116,
};
const FINANCE_FILTER_VALUES = ["all", "pending", "paid"] as const;
const FINANCE_SORT_ORDERS = [
    "booking_newest",
    "booking_oldest",
    "session_newest",
    "session_oldest",
] as const;
const FINANCE_FILTER_STORAGE_PREFIX = "clientdesk:finance:filters";
const FINANCE_ITEMS_PER_PAGE_STORAGE_PREFIX = "clientdesk:finance:items_per_page";
const FINANCE_PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;
const FINANCE_DEFAULT_ITEMS_PER_PAGE = 10;
const SEARCH_DEBOUNCE_MS = 400;
type FinanceSortOrder = (typeof FINANCE_SORT_ORDERS)[number];
type FinanceDateBasis = "booking_date" | "session_date";

type FinancePageMetadata = {
    studioName: string;
    bookingStatusOptions: string[];
    packageOptions: string[];
    availableEventTypes: string[];
    bookingTableColorEnabled: boolean;
    financeTableColorEnabled: boolean;
    tableColumnPreferences: TableColumnPreference[] | null;
    formSectionsByEventType: Record<string, FormLayoutItem[]>;
    metadataRows: Array<{
        event_type?: string | null;
        extra_fields?: Record<string, unknown> | null;
    }>;
    summary: {
        totalRevenue: number;
        totalPending: number;
        totalDP: number;
        totalBookings: number;
        paidCount: number;
        unpaidCount: number;
        monthlyRevenueTotal: number;
    };
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeFinanceFilterValue(value: unknown): FinanceFilterValue {
    return typeof value === "string" && FINANCE_FILTER_VALUES.includes(value as FinanceFilterValue)
        ? (value as FinanceFilterValue)
        : "all";
}

function normalizeFinanceItemsPerPage(value: unknown) {
    const parsed = typeof value === "number" ? value : Number(value);
    return FINANCE_PER_PAGE_OPTIONS.includes(
        parsed as (typeof FINANCE_PER_PAGE_OPTIONS)[number],
    )
        ? parsed
        : FINANCE_DEFAULT_ITEMS_PER_PAGE;
}

function parseSortOrderValue(value: unknown): FinanceSortOrder {
    return typeof value === "string" && FINANCE_SORT_ORDERS.includes(value as FinanceSortOrder)
        ? (value as FinanceSortOrder)
        : "booking_newest";
}

function parseDateBasisValue(value: unknown): FinanceDateBasis {
    return value === "session_date" ? "session_date" : "booking_date";
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

function getPrimaryMainServiceColor(
    serviceSelections?: BookingServiceSelection[],
) {
    const mainSelection = (serviceSelections || []).find(
        (selection) => selection.kind === "main",
    );
    return normalizeHexColor(mainSelection?.service?.color);
}

export default function FinancePage() {
    const supabase = createClient();
    const t = useTranslations("Finance");
    const tb = useTranslations("BookingsPage");
    const tf = useTranslations("FinancePage");
    const locale = useLocale();
    const { isMoneyVisible } = useMoneyVisibility();
    const [bookings, setBookings] = React.useState<BookingFinance[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [filter, setFilter] = React.useState<FinanceFilterValue>("all");
    const [searchQuery, setSearchQuery] = React.useState("");
    const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState("");
    const [packageFilter, setPackageFilter] = React.useState<string[]>([]);
    const [bookingStatusFilter, setBookingStatusFilter] = React.useState<string[]>([]);
    const [eventTypeFilter, setEventTypeFilter] = React.useState<string[]>([]);
    const [availableEventTypes, setAvailableEventTypes] = React.useState<string[]>([]);
    const [dateFromFilter, setDateFromFilter] = React.useState("");
    const [dateToFilter, setDateToFilter] = React.useState("");
    const [dateBasis, setDateBasis] = React.useState<FinanceDateBasis>("booking_date");
    const [sortOrder, setSortOrder] = React.useState<FinanceSortOrder>("booking_newest");
    const [bookingStatusOptions, setBookingStatusOptions] = React.useState<string[]>(
        getBookingStatusOptions(DEFAULT_CLIENT_STATUSES),
    );
    const [financeTableColorEnabled, setFinanceTableColorEnabled] = React.useState(false);
    const [currentPage, setCurrentPage] = React.useState(1);
    const [itemsPerPage, setItemsPerPage] = React.useState(10);
    const [itemsPerPageHydrated, setItemsPerPageHydrated] = React.useState(false);
    const [filtersHydrated, setFiltersHydrated] = React.useState(false);
    const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
    const [studioName, setStudioName] = React.useState("");
    const [savedTemplates, setSavedTemplates] = React.useState<
        { id: string; type: string; name?: string | null; content: string; content_en: string; event_type: string | null }[]
    >([]);
    const [columns, setColumns] = React.useState<TableColumnPreference[]>(lockBoundaryColumns(BASE_FINANCE_COLUMNS));
    const [columnManagerOpen, setColumnManagerOpen] = React.useState(false);
    const [savingColumns, setSavingColumns] = React.useState(false);
    const [resettingColumnWidths, setResettingColumnWidths] = React.useState(false);
    const [formSectionsByEventType, setFormSectionsByEventType] = React.useState<Record<string, FormLayoutItem[]>>({});
    const [metadataRows, setMetadataRows] = React.useState<Array<{ event_type?: string | null; extra_fields?: Record<string, unknown> | null }>>([]);
    const [packageOptions, setPackageOptions] = React.useState<string[]>([]);
    const [totalItems, setTotalItems] = React.useState(0);
    const [financeLoadError, setFinanceLoadError] = React.useState<string | null>(null);
    const [hasLoadedFinanceSuccessfully, setHasLoadedFinanceSuccessfully] = React.useState(false);
    const [summary, setSummary] = React.useState<FinancePageMetadata["summary"]>({
        totalRevenue: 0,
        totalPending: 0,
        totalDP: 0,
        totalBookings: 0,
        paidCount: 0,
        unpaidCount: 0,
        monthlyRevenueTotal: 0,
    });
    const [invoiceMenuBookingId, setInvoiceMenuBookingId] = React.useState<string | null>(null);
    const [copyMenuBookingId, setCopyMenuBookingId] = React.useState<string | null>(null);
    const [waMenuBookingId, setWaMenuBookingId] = React.useState<string | null>(null);
    const [invoiceMenuAnchorEl, setInvoiceMenuAnchorEl] = React.useState<HTMLElement | null>(null);
    const [copyMenuAnchorEl, setCopyMenuAnchorEl] = React.useState<HTMLElement | null>(null);
    const [waMenuAnchorEl, setWaMenuAnchorEl] = React.useState<HTMLElement | null>(null);
    const [copiedInitialTemplateId, setCopiedInitialTemplateId] = React.useState<string | null>(null);
    const [copiedFinalTemplateId, setCopiedFinalTemplateId] = React.useState<string | null>(null);
    const [showFilterPanel, setShowFilterPanel] = React.useState(false);
    const [mobileActionPicker, setMobileActionPicker] = React.useState<{
        open: boolean;
        booking: BookingFinance | null;
        kind: "invoice" | "copy" | "wa" | null;
    }>({ open: false, booking: null, kind: null });
    const [feedbackDialog, setFeedbackDialog] = React.useState<{ open: boolean; message: string }>({ open: false, message: "" });
    const browserTimeZone = React.useMemo(
        () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        [],
    );
    const { showSuccessToast, successToastNode } = useSuccessToast();
    const { canWriteBookings } = useBookingWriteAccess();
    const bookingWriteBlockedMessage = React.useMemo(
        () => getBookingWriteBlockedMessage(locale),
        [locale],
    );
    const requireBookingWrite = useBookingWriteGuard(({ message }) => {
        setFeedbackDialog({ open: true, message });
    });
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
    const hasLoadedFinanceRef = React.useRef(false);
    const financeMetadataCacheRef = React.useRef<FinancePageMetadata | null>(null);
    const financeMetadataEventTypeFilterKeyRef = React.useRef("");
    const activeFetchControllerRef = React.useRef<AbortController | null>(null);
    const latestFetchRequestIdRef = React.useRef(0);

    const closeDesktopMenus = React.useCallback(() => {
        setInvoiceMenuBookingId(null);
        setCopyMenuBookingId(null);
        setWaMenuBookingId(null);
        setInvoiceMenuAnchorEl(null);
        setCopyMenuAnchorEl(null);
        setWaMenuAnchorEl(null);
    }, []);

    const resetFilters = React.useCallback(() => {
        setFilter("all");
        setSearchQuery("");
        setDebouncedSearchQuery("");
        setPackageFilter([]);
        setBookingStatusFilter([]);
        setEventTypeFilter([]);
        setDateFromFilter("");
        setDateToFilter("");
        setDateBasis("booking_date");
        setSortOrder("booking_newest");
    }, []);

    React.useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [searchQuery]);

    const fetchTemplates = React.useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
            .from("templates")
            .select("id, type, name, content, content_en, event_type")
            .eq("user_id", user.id);
        setSavedTemplates((data || []) as { id: string; type: string; name?: string | null; content: string; content_en: string; event_type: string | null }[]);
    }, [supabase]);

    const fetchFinancePage = React.useCallback(async (
        mode: "initial" | "refresh" = "refresh",
        options?: { forceIncludeMetadata?: boolean },
    ) => {
        if (!itemsPerPageHydrated || !filtersHydrated) return;

        const requestId = latestFetchRequestIdRef.current + 1;
        latestFetchRequestIdRef.current = requestId;
        activeFetchControllerRef.current?.abort();
        const controller = new AbortController();
        activeFetchControllerRef.current = controller;

        setFinanceLoadError(null);
        if (mode === "initial") {
            setLoading(true);
        } else {
            setRefreshing(true);
        }

        try {
            const singlePackageFilter = packageFilter[0] || "All";
            const singleBookingStatusFilter = bookingStatusFilter[0] || "All";
            const singleEventTypeFilter = eventTypeFilter[0] || "All";
            const metadataEventTypeFilterKey = JSON.stringify([...eventTypeFilter].sort());
            const includeMetadata =
                options?.forceIncludeMetadata === true ||
                !financeMetadataCacheRef.current ||
                financeMetadataEventTypeFilterKeyRef.current !== metadataEventTypeFilterKey;
            const params = new URLSearchParams({
                page: String(currentPage),
                perPage: String(itemsPerPage),
                filter,
                search: debouncedSearchQuery,
                package: singlePackageFilter,
                bookingStatus: singleBookingStatusFilter,
                packageFilters: JSON.stringify(packageFilter),
                bookingStatusFilters: JSON.stringify(bookingStatusFilter),
                eventType: singleEventTypeFilter,
                eventTypeFilters: JSON.stringify(eventTypeFilter),
                dateFrom: dateFromFilter,
                dateTo: dateToFilter,
                dateBasis,
                sortOrder,
                timeZone: browserTimeZone,
                includeMetadata: includeMetadata ? "1" : "0",
            });
            const response = await fetchPaginatedJson<BookingFinance, FinancePageMetadata>(
                `/api/internal/finance?${params.toString()}`,
                { signal: controller.signal },
            );
            if (
                controller.signal.aborted ||
                latestFetchRequestIdRef.current !== requestId
            ) {
                return;
            }
            if (response.metadata) {
                financeMetadataCacheRef.current = response.metadata;
                financeMetadataEventTypeFilterKeyRef.current = metadataEventTypeFilterKey;
            }
            const metadata = response.metadata || financeMetadataCacheRef.current;

            setBookings(response.items);
            setTotalItems(response.totalItems);
            if (metadata) {
                const nextColumnDefaults = lockBoundaryColumns([
                    ...BASE_FINANCE_COLUMNS.slice(0, -1),
                    ...buildBookingMetadataColumns(
                        metadata.metadataRows || [],
                        metadata.formSectionsByEventType || {},
                    ),
                    BASE_FINANCE_COLUMNS[BASE_FINANCE_COLUMNS.length - 1],
                ]);
                setBookingStatusOptions(metadata.bookingStatusOptions || getBookingStatusOptions(DEFAULT_CLIENT_STATUSES));
                setPackageOptions(metadata.packageOptions || []);
                setAvailableEventTypes(metadata.availableEventTypes || []);
                setFinanceTableColorEnabled(metadata.financeTableColorEnabled === true);
                setStudioName(metadata.studioName || "");
                setFormSectionsByEventType(metadata.formSectionsByEventType || {});
                setMetadataRows(metadata.metadataRows || []);
                setSummary(metadata.summary || {
                    totalRevenue: 0,
                    totalPending: 0,
                    totalDP: 0,
                    totalBookings: 0,
                    paidCount: 0,
                    unpaidCount: 0,
                    monthlyRevenueTotal: 0,
                });
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
            setHasLoadedFinanceSuccessfully(true);
        } catch (error) {
            if (isAbortError(error)) {
                return;
            }
            if (latestFetchRequestIdRef.current !== requestId) {
                return;
            }
            console.error("[FinancePage] Failed to fetch finance page", error);
            setFinanceLoadError(tf("failedLoadFinance"));
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
        bookingStatusFilter,
        browserTimeZone,
        currentPage,
        dateBasis,
        dateFromFilter,
        dateToFilter,
        eventTypeFilter,
        filter,
        filtersHydrated,
        itemsPerPage,
        itemsPerPageHydrated,
        packageFilter,
        debouncedSearchQuery,
        sortOrder,
        tf,
    ]);

    React.useEffect(() => {
        async function hydrateCurrentUser() {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUserId(user?.id || null);
        }

        void hydrateCurrentUser();
        void fetchTemplates();
    }, [fetchTemplates, supabase]);

    React.useEffect(() => {
        if (!currentUserId) {
            setFiltersHydrated(false);
            return;
        }
        setFiltersHydrated(false);
        const storageKey = `${FINANCE_FILTER_STORAGE_PREFIX}:${currentUserId}`;

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

            const readString = (key: keyof FinanceFilterStoragePayload, fallback: string) => {
                const value = parsed[key];
                return typeof value === "string" ? value : fallback;
            };

            const hydratedSearchQuery = readString("searchQuery", "");
            setSearchQuery(hydratedSearchQuery);
            setDebouncedSearchQuery(hydratedSearchQuery);
            setFilter(normalizeFinanceFilterValue(parsed.filter));
            setPackageFilter(parseLegacyOrMultiFilterValue(parsed.packageFilter));
            setBookingStatusFilter(parseLegacyOrMultiFilterValue(parsed.bookingStatusFilter));
            setEventTypeFilter(parseLegacyOrMultiFilterValue(parsed.eventTypeFilter));
            setDateFromFilter(readString("dateFromFilter", ""));
            setDateToFilter(readString("dateToFilter", ""));
            setDateBasis(parseDateBasisValue(readString("dateBasis", "booking_date")));
            setSortOrder(parseSortOrderValue(readString("sortOrder", "booking_newest")));
        } catch {
            resetFilters();
        } finally {
            setFiltersHydrated(true);
        }
    }, [currentUserId, resetFilters]);

    React.useEffect(() => {
        if (!filtersHydrated || !currentUserId) return;
        const storageKey = `${FINANCE_FILTER_STORAGE_PREFIX}:${currentUserId}`;
        const payload: FinanceFilterStoragePayload = {
            searchQuery,
            filter,
            packageFilter,
            bookingStatusFilter,
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
        bookingStatusFilter,
        currentUserId,
        dateBasis,
        dateFromFilter,
        dateToFilter,
        eventTypeFilter,
        filter,
        filtersHydrated,
        packageFilter,
        searchQuery,
        sortOrder,
    ]);

    React.useEffect(() => {
        if (!currentUserId) {
            setItemsPerPageHydrated(false);
            return;
        }
        const storageKey = `${FINANCE_ITEMS_PER_PAGE_STORAGE_PREFIX}:${currentUserId}`;
        try {
            const raw = window.localStorage.getItem(storageKey);
            setItemsPerPage(normalizeFinanceItemsPerPage(raw));
        } catch {
            setItemsPerPage(FINANCE_DEFAULT_ITEMS_PER_PAGE);
        } finally {
            setItemsPerPageHydrated(true);
        }
    }, [currentUserId]);

    React.useEffect(() => {
        if (!currentUserId || !itemsPerPageHydrated) return;
        const storageKey = `${FINANCE_ITEMS_PER_PAGE_STORAGE_PREFIX}:${currentUserId}`;
        try {
            window.localStorage.setItem(storageKey, String(normalizeFinanceItemsPerPage(itemsPerPage)));
        } catch {
            // Ignore storage write failures.
        }
    }, [currentUserId, itemsPerPage, itemsPerPageHydrated]);

    React.useEffect(() => {
        if (!currentUserId) return;
        const storageKey = `${FINANCE_ITEMS_PER_PAGE_STORAGE_PREFIX}:${currentUserId}`;
        function handleStorage(event: StorageEvent) {
            if (event.storageArea !== window.localStorage) return;
            if (event.key !== storageKey) return;
            setItemsPerPage(normalizeFinanceItemsPerPage(event.newValue));
        }
        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, [currentUserId]);

    React.useEffect(() => {
        if (!itemsPerPageHydrated || !filtersHydrated) return;
        const mode = hasLoadedFinanceRef.current ? "refresh" : "initial";
        hasLoadedFinanceRef.current = true;
        void fetchFinancePage(mode);
    }, [fetchFinancePage, filtersHydrated, itemsPerPageHydrated]);

    React.useEffect(() => {
        return () => {
            activeFetchControllerRef.current?.abort();
            activeFetchControllerRef.current = null;
        };
    }, []);

    React.useEffect(() => {
        if (!invoiceMenuBookingId && !copyMenuBookingId && !waMenuBookingId) return;
        function handleOutsideClick(event: MouseEvent) {
            const target = event.target as HTMLElement | null;
            if (target?.closest("[data-finance-menu-root='true']")) return;
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
    }, [closeDesktopMenus, copyMenuBookingId, invoiceMenuBookingId, waMenuBookingId]);

    const orderedVisibleColumns = React.useMemo(
        () => columns.filter((column) => column.visible),
        [columns],
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
        menuKey: "finance",
        userId: currentUserId,
        columns: orderedVisibleColumns,
        nonResizableColumnIds: FINANCE_NON_RESIZABLE_COLUMN_IDS,
        minWidthByColumnId: FINANCE_COLUMN_MIN_WIDTHS,
    });
    const {
        tableRef,
        getStickyColumnStyle,
        getStickyColumnClassName,
    } = useStickyTableColumns(orderedVisibleColumns, {
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
            ...BASE_FINANCE_COLUMNS.slice(0, -1),
            ...buildBookingMetadataColumns(metadataRows, formSectionsByEventType),
            BASE_FINANCE_COLUMNS[BASE_FINANCE_COLUMNS.length - 1],
        ]);
        setColumns((current) => {
            const nextColumns = mergeTableColumnPreferences(nextDefaults, current);
            return areTableColumnPreferencesEqual(current, nextColumns)
                ? current
                : nextColumns;
        });
    }, [formSectionsByEventType, metadataRows]);

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
            "finance",
            normalizedNextColumns,
        );
        await supabase
            .from("profiles")
            .update({ table_column_preferences: payload })
            .eq("id", user.id);
        await invalidateProfilePublicCache();
        if (financeMetadataCacheRef.current) {
            financeMetadataCacheRef.current = {
                ...financeMetadataCacheRef.current,
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

    async function handleMarkPaid(id: string) {
        if (!requireBookingWrite()) return;
        const booking = bookings.find((item) => item.id === id);
        if (!booking) return;
        const remaining = getRemainingFinalPayment({
            total_price: booking.total_price,
            dp_paid: booking.dp_paid,
            final_adjustments: booking.final_adjustments,
            final_payment_amount: booking.final_payment_amount,
            final_paid_at: booking.final_paid_at,
            settlement_status: booking.settlement_status,
            is_fully_paid: booking.is_fully_paid,
        });
        await supabase.from("bookings").update({
            is_fully_paid: true,
            settlement_status: "paid",
            final_payment_amount: remaining,
            final_paid_at: new Date().toISOString(),
        }).eq("id", id);
        await invalidateBookingPublicCache({
            bookingCode: booking.booking_code,
            trackingUuid: booking.tracking_uuid,
        });
        void fetchFinancePage("refresh", { forceIncludeMetadata: true });
    }

    async function handleMarkUnpaid(id: string) {
        if (!requireBookingWrite()) return;
        const booking = bookings.find((item) => item.id === id);
        await supabase.from("bookings").update({
            is_fully_paid: false,
            settlement_status: booking?.final_invoice_sent_at ? "sent" : "draft",
            final_payment_amount: 0,
            final_paid_at: null,
        }).eq("id", id);
        if (booking) {
            await invalidateBookingPublicCache({
                bookingCode: booking.booking_code,
                trackingUuid: booking.tracking_uuid,
            });
        }
        void fetchFinancePage("refresh", { forceIncludeMetadata: true });
    }

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
    const maskedCurrencyText = locale === "en" ? "IDR •••••••" : "Rp •••••••";
    const formatSensitiveCurrency = (amount: number) =>
        isMoneyVisible ? formatCurrency(amount) : maskedCurrencyText;
    function getSiteUrl() {
        return typeof window !== "undefined" ? window.location.origin : "";
    }

    function getInitialInvoiceLink(booking: BookingFinance) {
        return `${getSiteUrl()}/api/public/invoice?code=${encodeURIComponent(booking.booking_code)}&lang=${locale}&stage=initial`;
    }

    function getFinalInvoiceLink(booking: BookingFinance) {
        return `${getSiteUrl()}/api/public/invoice?code=${encodeURIComponent(booking.booking_code)}&lang=${locale}&stage=final`;
    }

    function getSettlementLink(booking: BookingFinance) {
        return booking.tracking_uuid ? `${getSiteUrl()}/${locale}/settlement/${booking.tracking_uuid}` : "";
    }

    function getTrackingLink(booking: BookingFinance) {
        return booking.tracking_uuid ? `${getSiteUrl()}/${locale}/track/${booking.tracking_uuid}` : "";
    }

    function isCancelledBooking(booking: BookingFinance) {
        return (booking.status || booking.client_status || "").trim().toLowerCase() === "batal";
    }

    function getNetVerifiedRevenue(booking: BookingFinance) {
        return getNetVerifiedRevenueAmount({
            total_price: booking.total_price,
            dp_paid: booking.dp_paid,
            dp_verified_amount: booking.dp_verified_amount,
            dp_verified_at: booking.dp_verified_at,
            dp_refund_amount: booking.dp_refund_amount,
            dp_refunded_at: booking.dp_refunded_at,
            final_adjustments: booking.final_adjustments,
            final_payment_amount: booking.final_payment_amount,
            final_paid_at: booking.final_paid_at,
            settlement_status: booking.settlement_status,
            is_fully_paid: booking.is_fully_paid,
        });
    }

    function getFinanceStatusLabel(booking: BookingFinance) {
        if (isCancelledBooking(booking)) {
            return booking.dp_refund_amount > 0 ? t("batalRefund") : t("batalHangus");
        }
        return booking.is_fully_paid ? `✓ ${t("lunas")}` : t("belumLunas");
    }

    function getRemainingAmount(booking: BookingFinance) {
        if (isCancelledBooking(booking)) return 0;
        return getRemainingFinalPayment({
            total_price: booking.total_price,
            dp_paid: booking.dp_paid,
            final_adjustments: booking.final_adjustments,
            final_payment_amount: booking.final_payment_amount,
            final_paid_at: booking.final_paid_at,
            settlement_status: booking.settlement_status,
            is_fully_paid: booking.is_fully_paid,
        });
    }

    function getFinalTotalAmount(booking: BookingFinance) {
        return getFinalInvoiceTotal(booking.total_price, booking.final_adjustments);
    }

    function getInitialPriceBreakdown(booking: BookingFinance) {
        return getInitialBookingPriceBreakdown({
            totalPrice: booking.total_price,
            serviceSelections: booking.service_selections,
            legacyServicePrice: booking.services?.price ?? booking.total_price,
            extraFields: booking.extra_fields,
        });
    }

    function getPackagePrice(
        booking: BookingFinance,
        initialBreakdown = getInitialPriceBreakdown(booking),
    ) {
        return initialBreakdown.packageTotal;
    }

    function getDiscountAmount(
        booking: BookingFinance,
        initialBreakdown = getInitialPriceBreakdown(booking),
    ) {
        return initialBreakdown.discountAmount;
    }

    function getAddonTotal(
        booking: BookingFinance,
        initialBreakdown = getInitialPriceBreakdown(booking),
    ) {
        const finalAddonTotal = Math.max(getFinalInvoiceTotal(booking.total_price, booking.final_adjustments) - booking.total_price, 0);
        return initialBreakdown.addonTotal + finalAddonTotal;
    }

    function openInvoice(booking: BookingFinance, stage: "initial" | "final") {
        const href = stage === "initial" ? getInitialInvoiceLink(booking) : getFinalInvoiceLink(booking);
        window.open(href, "_blank");
    }

    async function ensureSettlementOpened(booking: BookingFinance) {
        if (!requireBookingWrite()) return null;
        if (!booking.tracking_uuid) {
            setFeedbackDialog({ open: true, message: tf("settlementLinkNotAvailable") });
            return null;
        }

        if (booking.settlement_status && booking.settlement_status !== "draft" && booking.final_invoice_sent_at) {
            return booking;
        }

        const sentAt = new Date().toISOString();
        const { error } = await supabase
            .from("bookings")
            .update({
                settlement_status: "sent",
                final_invoice_sent_at: sentAt,
                final_payment_amount: 0,
                final_payment_method: null,
                final_payment_source: null,
                final_payment_proof_url: null,
                final_payment_proof_drive_file_id: null,
                final_paid_at: null,
                is_fully_paid: false,
            })
            .eq("id", booking.id);

        if (error) {
            setFeedbackDialog({ open: true, message: tf("failedOpenSettlement") });
            return null;
        }
        await invalidateBookingPublicCache({
            bookingCode: booking.booking_code,
            trackingUuid: booking.tracking_uuid,
        });

        const nextBooking: BookingFinance = {
            ...booking,
            settlement_status: "sent",
            final_invoice_sent_at: sentAt,
            final_payment_amount: 0,
            final_paid_at: null,
            final_payment_proof_url: null,
            final_payment_proof_drive_file_id: null,
            is_fully_paid: false,
        };

        setBookings((prev) => prev.map((item) => item.id === booking.id ? nextBooking : item));
        return nextBooking;
    }

    function buildInitialInvoiceMessage(booking: BookingFinance) {
        const date = booking.session_date ? formatSessionDate(booking.session_date, { locale: locale === "en" ? "en" : "id", dateOnly: true }) : "-";
        const remaining = Math.max((booking.total_price || 0) - (booking.dp_paid || 0), 0);
        const invoiceLink = getInitialInvoiceLink(booking);
        const trackingLink = getTrackingLink(booking);
        const templateMode = resolveWhatsAppTemplateMode({
            eventType: booking.event_type,
            extraFields: booking.extra_fields,
        });
        const templateContent = getWhatsAppTemplateContent(
            savedTemplates,
            "whatsapp_client",
            locale,
            booking.event_type,
            templateMode,
        );

        if (templateContent.trim()) {
            const vars = buildBookingWhatsAppTemplateVars({
                booking: {
                    client_name: booking.client_name,
                    client_whatsapp: booking.client_whatsapp || "-",
                    instagram: booking.instagram || null,
                    booking_code: booking.booking_code,
                    session_date: booking.session_date,
                    total_price: booking.total_price,
                    dp_paid: booking.dp_paid,
                    event_type: booking.event_type,
                    location: booking.location,
                    location_lat: booking.location_lat,
                    location_lng: booking.location_lng,
                    extra_fields: booking.extra_fields,
                    service_label: booking.service_label || booking.services?.name || "-",
                    services: booking.services,
                    booking_services: booking.booking_services,
                    service_selections: booking.service_selections,
                },
                locale,
                studioName,
                trackingLink,
                invoiceUrl: invoiceLink,
            });
            return fillWhatsAppTemplate(templateContent, vars);
        }

        return `📄 *${tf("waInvoiceTitle")} - ${booking.booking_code}*\n\n${tf("waInvoiceHello", { name: booking.client_name })}\n${tf("waInvoiceDetail")}\n\n📦 ${tf("waInvoicePackage")}: ${booking.service_label || booking.services?.name || "-"}\n📅 ${tf("waInvoiceSchedule")}: ${date}\n💰 ${tf("waInvoiceTotal")}: ${formatCurrency(booking.total_price)}\n✅ ${tf("waInvoiceDPPaid")}: ${formatCurrency(booking.dp_paid)}\n📌 ${tf("waInvoiceRemaining")}: ${formatCurrency(remaining)}\n\nStatus: ${booking.is_fully_paid ? `✅ ${tf("waInvoicePaid")}` : `⏳ ${tf("waInvoiceUnpaid")}`}\n\n📎 ${tf("waInvoiceDownload")}: ${invoiceLink}${trackingLink ? `\n🔗 ${tf("waInvoiceViewStatus")}: ${trackingLink}` : ""}\n\n${tf("waInvoiceThankYou")} 🙏`;
    }

    function buildFinalInvoiceMessage(booking: BookingFinance) {
        const remaining = getRemainingAmount(booking);
        const finalTotal = getFinalTotalAmount(booking);
        const date = booking.session_date ? formatSessionDate(booking.session_date, { locale: locale === "en" ? "en" : "id", dateOnly: true }) : "-";
        const trackingLink = getTrackingLink(booking);
        const settlementLink = getSettlementLink(booking);
        const invoiceLink = getFinalInvoiceLink(booking);
        const templateMode = resolveWhatsAppTemplateMode({
            eventType: booking.event_type,
            extraFields: booking.extra_fields,
        });
        const templateContent = getWhatsAppTemplateContent(
            savedTemplates,
            "whatsapp_settlement_client",
            locale,
            booking.event_type,
            templateMode,
        );

        if (templateContent.trim()) {
            const baseVars = buildBookingWhatsAppTemplateVars({
                booking: {
                    client_name: booking.client_name,
                    client_whatsapp: booking.client_whatsapp || "-",
                    instagram: booking.instagram || null,
                    booking_code: booking.booking_code,
                    session_date: booking.session_date,
                    total_price: booking.total_price,
                    dp_paid: booking.dp_paid,
                    event_type: booking.event_type,
                    location: booking.location,
                    location_lat: booking.location_lat,
                    location_lng: booking.location_lng,
                    extra_fields: booking.extra_fields,
                    service_label: booking.service_label || booking.services?.name || "-",
                    services: booking.services,
                    booking_services: booking.booking_services,
                    service_selections: booking.service_selections,
                },
                locale,
                studioName,
                trackingLink,
                invoiceUrl: invoiceLink,
            });
            return fillWhatsAppTemplate(templateContent, {
                ...baseVars,
                final_total: formatCurrency(finalTotal),
                adjustments_total: formatCurrency(finalTotal - booking.total_price),
                remaining_payment: formatCurrency(remaining),
                settlement_link: settlementLink || "-",
            });
        }

        return tf("finalInvoiceFallbackMessage", {
            clientName: booking.client_name,
            bookingCode: booking.booking_code,
            packageName: booking.service_label || booking.services?.name || "-",
            initialTotal: formatCurrency(booking.total_price),
            addonTotal: formatCurrency(finalTotal - booking.total_price),
            finalTotal: formatCurrency(finalTotal),
            dpPaid: formatCurrency(booking.dp_paid),
            remaining: formatCurrency(remaining),
            invoiceLink,
            settlementLink: settlementLink || "-",
            trackingLine: trackingLink ? `\n${tf("trackingLabel")}: ${trackingLink}` : "",
        });
    }

    function sendInitialInvoiceWhatsApp(booking: BookingFinance) {
        if (!booking.client_whatsapp) {
            setFeedbackDialog({ open: true, message: tf("waNotAvailable") });
            return;
        }
        const cleaned = normalizeWhatsAppNumber(booking.client_whatsapp);
        const message = buildInitialInvoiceMessage(booking);
        openWhatsAppUrl(buildWhatsAppUrl(cleaned, message));
    }

    async function sendFinalInvoiceWhatsApp(booking: BookingFinance) {
        if (!booking.client_whatsapp) {
            setFeedbackDialog({ open: true, message: tf("waNotAvailable") });
            return;
        }

        const preOpenedWindow = preopenWindowForDeferredNavigation();
        const openedBooking = await ensureSettlementOpened(booking);
        if (!openedBooking) {
            closePreopenedWindow(preOpenedWindow);
            return;
        }

        const cleaned = normalizeWhatsAppNumber(openedBooking.client_whatsapp);
        const message = buildFinalInvoiceMessage(openedBooking);
        openWhatsAppUrl(buildWhatsAppUrl(cleaned, message), {
            preOpenedWindow,
        });
    }

    function resolveInvoiceStageFromContext(booking: BookingFinance): "initial" | "final" {
        const hasFinalSignal = Boolean(
            booking.final_invoice_sent_at ||
            booking.final_paid_at ||
            booking.is_fully_paid ||
            booking.final_payment_amount > 0 ||
            booking.settlement_status === "sent" ||
            booking.settlement_status === "paid",
        );
        return hasFinalSignal ? "final" : "initial";
    }

    function resolveWaInvoiceStageFromContext(booking: BookingFinance): "initial" | "final" {
        const stage = resolveInvoiceStageFromContext(booking);
        if (stage === "final" && !booking.tracking_uuid) {
            return "initial";
        }
        return stage;
    }

    function handleOpenInvoiceStage(booking: BookingFinance, stage: "initial" | "final") {
        openInvoice(booking, stage);
    }

    async function handleSendInvoiceWaStage(booking: BookingFinance, stage: "initial" | "final") {
        if (stage === "initial") {
            sendInitialInvoiceWhatsApp(booking);
            return;
        }
        await sendFinalInvoiceWhatsApp(booking);
    }

    async function handleCopyInvoiceTemplateStage(
        booking: BookingFinance,
        stage: "initial" | "final",
    ) {
        const message =
            stage === "initial"
                ? buildInitialInvoiceMessage(booking)
                : buildFinalInvoiceMessage(booking);
        try {
            await navigator.clipboard.writeText(message);
            showSuccessToast(tf("invoiceTemplateCopied"));
            if (stage === "initial") {
                setCopiedInitialTemplateId(booking.id);
                setTimeout(() => {
                    setCopiedInitialTemplateId((current) =>
                        current === booking.id ? null : current,
                    );
                }, 2000);
                return;
            }
            setCopiedFinalTemplateId(booking.id);
            setTimeout(() => {
                setCopiedFinalTemplateId((current) =>
                    current === booking.id ? null : current,
                );
            }, 2000);
        } catch {
            setFeedbackDialog({
                open: true,
                message: tf("failedCopyTemplate"),
            });
        }
    }

    function handleCopyPrimaryInvoiceTemplate(booking: BookingFinance) {
        void handleCopyInvoiceTemplateStage(
            booking,
            resolveInvoiceStageFromContext(booking),
        );
    }

    function handleOpenPrimaryInvoice(booking: BookingFinance) {
        handleOpenInvoiceStage(booking, resolveInvoiceStageFromContext(booking));
    }

    async function handleSendPrimaryInvoiceWa(booking: BookingFinance) {
        await handleSendInvoiceWaStage(booking, resolveWaInvoiceStageFromContext(booking));
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
            case "name":
                return renderDesktopHeaderCell(column, "px-6 py-4 font-medium text-muted-foreground", t("klien"));
            case "row_number":
                return renderDesktopHeaderCell(column, "w-16 px-4 py-4 font-medium text-muted-foreground text-center", "No.");
            case "event_type":
                return renderDesktopHeaderCell(column, "px-6 py-4 font-medium text-muted-foreground", tb("eventTypeLabel"));
            case "total_price":
                return renderDesktopHeaderCell(column, "px-6 py-4 font-medium text-muted-foreground", t("hargaTotal"));
            case "package_price":
                return renderDesktopHeaderCell(column, "px-6 py-4 font-medium text-muted-foreground", t("hargaPaket"));
            case "addon":
                return renderDesktopHeaderCell(column, "px-6 py-4 font-medium text-muted-foreground", t("addOn"));
            case "dp_paid":
                return renderDesktopHeaderCell(column, "px-6 py-4 font-medium text-muted-foreground", t("dpDibayar"));
            case "discount":
                return renderDesktopHeaderCell(column, "px-6 py-4 font-medium text-muted-foreground", t("diskon"));
            case "remaining":
                return renderDesktopHeaderCell(column, "px-6 py-4 font-medium text-muted-foreground", t("sisa"));
            case "status":
                return renderDesktopHeaderCell(column, "px-6 py-4 font-medium text-muted-foreground", t("status"));
            case "actions":
                return renderDesktopHeaderCell(column, "min-w-[420px] px-4 py-4 font-medium text-muted-foreground text-right", t("aksi"));
            default:
                return renderDesktopHeaderCell(column, "px-6 py-4 font-medium text-muted-foreground", column.label);
        }
    }

    function renderDesktopCell(
        booking: BookingFinance,
        column: TableColumnPreference,
        rowNumber: number,
        remaining: number,
        finalTotal: number,
        addonTotal: number,
        packagePrice: number,
        discountAmount: number,
    ) {
        switch (column.id) {
            case "name":
                return (
                    <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3 max-w-[180px]")}>
                        <div className="font-medium truncate">{booking.client_name}</div>
                        <div className="text-xs text-muted-foreground truncate">{booking.booking_code} · {booking.service_label || booking.services?.name || "-"}</div>
                    </td>
                );
            case "row_number":
                return (
                    <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-4 text-center text-sm text-muted-foreground")}>
                        {rowNumber}
                    </td>
                );
            case "event_type":
                return <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-6 py-4 max-w-[180px] truncate text-muted-foreground")} title={booking.event_type || "-"}>{booking.event_type || "-"}</td>;
            case "total_price":
                return <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-6 py-4 whitespace-nowrap font-medium")}>{formatSensitiveCurrency(finalTotal)}</td>;
            case "package_price":
                return <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-6 py-4 whitespace-nowrap")}>{formatSensitiveCurrency(packagePrice)}</td>;
            case "addon":
                return <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-6 py-4 whitespace-nowrap")}>{formatSensitiveCurrency(addonTotal)}</td>;
            case "dp_paid":
                return <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-6 py-4 whitespace-nowrap font-medium")}>{formatSensitiveCurrency(booking.dp_paid)}</td>;
            case "discount":
                return (
                    <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-6 py-4 whitespace-nowrap")}>
                        {discountAmount > 0 ? `- ${formatSensitiveCurrency(discountAmount)}` : formatSensitiveCurrency(0)}
                    </td>
                );
            case "remaining":
                return (
                    <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-6 py-4 whitespace-nowrap font-medium")}>
                        <span className={remaining > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}>
                            {formatSensitiveCurrency(remaining)}
                        </span>
                    </td>
                );
            case "status":
                if (isCancelledBooking(booking)) {
                    return (
                        <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-6 py-4 whitespace-nowrap")}>
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${booking.dp_refund_amount > 0
                                ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                                : "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400"
                                }`}>
                                {getFinanceStatusLabel(booking)}
                            </span>
                        </td>
                    );
                }
                return (
                    <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-6 py-4 whitespace-nowrap")}>
                        <button
                            onClick={() => booking.is_fully_paid ? handleMarkUnpaid(booking.id) : handleMarkPaid(booking.id)}
                            disabled={!canWriteBookings}
                            title={!canWriteBookings ? bookingWriteBlockedMessage : undefined}
                            className={`text-xs font-medium px-2.5 py-1 rounded-full cursor-pointer transition-colors ${booking.is_fully_paid
                                ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400 hover:bg-green-200"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 hover:bg-amber-200"
                                }`}
                        >
                            {getFinanceStatusLabel(booking)}
                        </button>
                    </td>
                );
            case "actions":
                return (
                    <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "min-w-[420px] px-4 py-4 text-right")}>
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap pr-1">
                            <Link href={`/bookings/${booking.id}`}>
                                <ActionIconButton tone="slate" title={tf("detailBooking")}>
                                    <Info className="w-4 h-4" />
                                </ActionIconButton>
                            </Link>
                            <div className="relative" data-finance-menu-root="true">
                                <div className="flex items-stretch overflow-hidden rounded-md border border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                    <button
                                        type="button"
                                        title={tf("openInvoiceByContext")}
                                        onClick={() => {
                                            closeDesktopMenus();
                                            handleOpenPrimaryInvoice(booking);
                                        }}
                                        className="inline-flex h-8 w-8 items-center justify-center transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-800/60"
                                    >
                                        <FileText className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        title={tf("openInvoiceOptions")}
                                        onClick={(event) => {
                                            const anchorEl = event.currentTarget;
                                            const shouldClose = invoiceMenuBookingId === booking.id;
                                            setCopyMenuBookingId(null);
                                            setWaMenuBookingId(null);
                                            setCopyMenuAnchorEl(null);
                                            setWaMenuAnchorEl(null);
                                            setInvoiceMenuBookingId(shouldClose ? null : booking.id);
                                            setInvoiceMenuAnchorEl(shouldClose ? null : anchorEl);
                                        }}
                                        className="inline-flex h-8 w-6 items-center justify-center border-l border-indigo-200 transition-colors hover:bg-indigo-100 dark:border-indigo-700 dark:hover:bg-indigo-800/60"
                                    >
                                        <ChevronDown className="w-3 h-3" />
                                    </button>
                                </div>
                                <TableActionMenuPortal
                                    open={invoiceMenuBookingId === booking.id}
                                    anchorEl={invoiceMenuAnchorEl}
                                    className="w-48"
                                >
                                        <button
                                            type="button"
                                            className="flex w-full items-center rounded px-2.5 py-2 text-left text-xs text-foreground transition-colors hover:bg-muted"
                                            onClick={() => {
                                                closeDesktopMenus();
                                                handleOpenInvoiceStage(booking, "initial");
                                            }}
                                        >
                                            {tf("openInitialInvoice")}
                                        </button>
                                        <button
                                            type="button"
                                            className="flex w-full items-center rounded px-2.5 py-2 text-left text-xs text-foreground transition-colors hover:bg-muted"
                                            onClick={() => {
                                                closeDesktopMenus();
                                                handleOpenInvoiceStage(booking, "final");
                                            }}
                                        >
                                            {tf("openFinalInvoice")}
                                        </button>
                                </TableActionMenuPortal>
                            </div>
                            <div className="relative" data-finance-menu-root="true">
                                <div className="flex items-stretch overflow-hidden rounded-md border border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                                    <button
                                        type="button"
                                        title={tf("copyInvoiceTemplateByContext")}
                                        onClick={() => {
                                            closeDesktopMenus();
                                            handleCopyPrimaryInvoiceTemplate(booking);
                                        }}
                                        className="inline-flex h-8 w-8 items-center justify-center transition-colors hover:bg-violet-100 dark:hover:bg-violet-800/60"
                                    >
                                        {(resolveInvoiceStageFromContext(booking) === "initial"
                                            ? copiedInitialTemplateId
                                            : copiedFinalTemplateId) === booking.id ? (
                                            <ClipboardCheck className="w-4 h-4" />
                                        ) : (
                                            <Copy className="w-4 h-4" />
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        title={tf("copyInvoiceTemplateOptions")}
                                        onClick={(event) => {
                                            const anchorEl = event.currentTarget;
                                            const shouldClose = copyMenuBookingId === booking.id;
                                            setInvoiceMenuBookingId(null);
                                            setWaMenuBookingId(null);
                                            setInvoiceMenuAnchorEl(null);
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
                                    className="w-56"
                                >
                                        <button
                                            type="button"
                                            className="flex w-full items-center rounded px-2.5 py-2 text-left text-xs text-foreground transition-colors hover:bg-muted"
                                            onClick={() => {
                                                closeDesktopMenus();
                                                void handleCopyInvoiceTemplateStage(booking, "initial");
                                            }}
                                        >
                                            {tf("copyInitialInvoiceTemplate")}
                                        </button>
                                        <button
                                            type="button"
                                            className="flex w-full items-center rounded px-2.5 py-2 text-left text-xs text-foreground transition-colors hover:bg-muted"
                                            onClick={() => {
                                                closeDesktopMenus();
                                                void handleCopyInvoiceTemplateStage(booking, "final");
                                            }}
                                        >
                                            {tf("copyFinalInvoiceTemplate")}
                                        </button>
                                </TableActionMenuPortal>
                            </div>
                            <div className="relative" data-finance-menu-root="true">
                                <div className="flex items-stretch overflow-hidden rounded-md border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                    <button
                                        type="button"
                                        title={tf("sendInvoiceWAByContext")}
                                        disabled={!booking.client_whatsapp}
                                        onClick={() => {
                                            closeDesktopMenus();
                                            void handleSendPrimaryInvoiceWa(booking);
                                        }}
                                        className="inline-flex h-8 w-8 items-center justify-center transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-emerald-800/60"
                                    >
                                        <MessageCircle className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        title={tf("sendInvoiceWAOptions")}
                                        disabled={!booking.client_whatsapp}
                                        onClick={(event) => {
                                            const anchorEl = event.currentTarget;
                                            const shouldClose = waMenuBookingId === booking.id;
                                            setInvoiceMenuBookingId(null);
                                            setCopyMenuBookingId(null);
                                            setInvoiceMenuAnchorEl(null);
                                            setCopyMenuAnchorEl(null);
                                            setWaMenuBookingId(shouldClose ? null : booking.id);
                                            setWaMenuAnchorEl(shouldClose ? null : anchorEl);
                                        }}
                                        className="inline-flex h-8 w-6 items-center justify-center border-l border-emerald-200 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-700 dark:hover:bg-emerald-800/60"
                                    >
                                        <ChevronDown className="w-3 h-3" />
                                    </button>
                                </div>
                                <TableActionMenuPortal
                                    open={waMenuBookingId === booking.id}
                                    anchorEl={waMenuAnchorEl}
                                    className="w-52"
                                >
                                        <button
                                            type="button"
                                            className="flex w-full items-center rounded px-2.5 py-2 text-left text-xs text-foreground transition-colors hover:bg-muted"
                                            onClick={() => {
                                                closeDesktopMenus();
                                                void handleSendInvoiceWaStage(booking, "initial");
                                            }}
                                        >
                                            {tf("sendInitialInvoiceWA")}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={!booking.tracking_uuid}
                                            className="flex w-full items-center rounded px-2.5 py-2 text-left text-xs text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                                            onClick={() => {
                                                closeDesktopMenus();
                                                void handleSendInvoiceWaStage(booking, "final");
                                            }}
                                        >
                                            {tf("sendFinalInvoiceWA")}
                                        </button>
                                </TableActionMenuPortal>
                            </div>
                            <ActionIconButton tone="sky" title={tf("openSettlementLink")}
                                disabled={!booking.tracking_uuid}
                                onClick={() => window.open(getSettlementLink(booking), "_blank")}>
                                <ExternalLink className="w-4 h-4" />
                            </ActionIconButton>
                            <ActionIconButton
                                tone="amber"
                                title={booking.payment_proof_url ? tf("openInitialProof") : tf("initialProofUnavailable")}
                                disabled={!booking.payment_proof_url}
                                onClick={() => openProof(booking.payment_proof_url)}
                            >
                                <Receipt className="w-4 h-4" />
                            </ActionIconButton>
                            <ActionIconButton
                                tone="cyan"
                                title={booking.final_payment_proof_url ? tf("openFinalProof") : tf("finalProofUnavailable")}
                                disabled={!booking.final_payment_proof_url}
                                onClick={() => openProof(booking.final_payment_proof_url)}
                            >
                                <Receipt className="w-4 h-4" />
                            </ActionIconButton>
                        </div>
                    </td>
                );
            default:
                return (
                    <td key={column.id} style={getDesktopColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-6 py-4 max-w-[180px] truncate text-muted-foreground")} title={getBookingMetadataValue(booking.extra_fields, column.id, { locale: locale === "en" ? "en" : "id" })}>
                        {getBookingMetadataValue(booking.extra_fields, column.id, { locale: locale === "en" ? "en" : "id" })}
                    </td>
                );
        }
    }

    function renderMobileValue(
        booking: BookingFinance,
        column: TableColumnPreference,
        remaining: number,
        finalTotal: number,
        addonTotal: number,
        packagePrice: number,
        discountAmount: number,
    ) {
        switch (column.id) {
            case "event_type":
                return booking.event_type || "-";
            case "total_price":
                return formatSensitiveCurrency(finalTotal);
            case "package_price":
                return formatSensitiveCurrency(packagePrice);
            case "addon":
                return formatSensitiveCurrency(addonTotal);
            case "dp_paid":
                return formatSensitiveCurrency(booking.dp_paid);
            case "discount":
                return discountAmount > 0 ? `- ${formatSensitiveCurrency(discountAmount)}` : formatSensitiveCurrency(0);
            case "remaining":
                return formatSensitiveCurrency(remaining);
            case "status":
                return getFinanceStatusLabel(booking);
            default:
                return getBookingMetadataValue(booking.extra_fields, column.id, { locale: locale === "en" ? "en" : "id" });
        }
    }

    const hasActiveFilters =
        searchQuery.trim().length > 0 ||
        filter !== "all" ||
        packageFilter.length > 0 ||
        bookingStatusFilter.length > 0 ||
        eventTypeFilter.length > 0 ||
        Boolean(dateFromFilter) ||
        Boolean(dateToFilter) ||
        dateBasis !== "booking_date" ||
        sortOrder !== "booking_newest";
    const financeStatusOptions = React.useMemo(
        () => [
            { value: "all", label: t("semua") },
            { value: "pending", label: t("belumLunas") },
            { value: "paid", label: t("lunas") },
        ],
        [t],
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
    const packageFilterOptions = React.useMemo(
        () => packageOptions.map((packageName) => ({ value: packageName, label: packageName })),
        [packageOptions, t],
    );
    const bookingStatusFilterOptions = React.useMemo(
        () => bookingStatusOptions.map((statusOption) => ({ value: statusOption, label: statusOption })),
        [bookingStatusOptions, t],
    );
    const eventTypeFilterOptions = React.useMemo(
        () => availableEventTypes.map((eventType) => ({ value: eventType, label: eventType })),
        [availableEventTypes],
    );
    const multiCountSuffix = locale === "en" ? "selected" : "dipilih";

    const monthlyRevenueLabel = React.useMemo(
        () =>
            new Intl.DateTimeFormat(locale, {
                month: "long",
                year: "numeric",
            }).format(new Date()),
        [locale],
    );
    const showInitialFinanceSkeleton = loading && !hasLoadedFinanceSuccessfully;
    const showFinanceLoadError = Boolean(financeLoadError);
    const showFinanceContent = hasLoadedFinanceSuccessfully || showInitialFinanceSkeleton;
    const financeLoadErrorDescription = hasLoadedFinanceSuccessfully
        ? tf("failedLoadFinanceWithLastData")
        : tf("failedLoadFinanceEmptyState");
    const handleRetryFinanceLoad = React.useCallback(() => {
        void fetchFinancePage(hasLoadedFinanceSuccessfully ? "refresh" : "initial");
    }, [fetchFinancePage, hasLoadedFinanceSuccessfully]);

    const queryState = React.useMemo<PaginatedQueryState>(() => ({
        page: currentPage,
        perPage: itemsPerPage,
        totalItems,
        isLoading: loading,
        isRefreshing: refreshing,
    }), [currentPage, itemsPerPage, totalItems, loading, refreshing]);

    async function exportFinance() {
        try {
            const singlePackageFilter = packageFilter[0] || "All";
            const singleBookingStatusFilter = bookingStatusFilter[0] || "All";
            const singleEventTypeFilter = eventTypeFilter[0] || "All";
            const params = new URLSearchParams({
                page: "1",
                perPage: String(Math.max(totalItems, 1)),
                filter,
                search: searchQuery,
                package: singlePackageFilter,
                bookingStatus: singleBookingStatusFilter,
                packageFilters: JSON.stringify(packageFilter),
                bookingStatusFilters: JSON.stringify(bookingStatusFilter),
                eventType: singleEventTypeFilter,
                eventTypeFilters: JSON.stringify(eventTypeFilter),
                dateFrom: dateFromFilter,
                dateTo: dateToFilter,
                dateBasis,
                sortOrder,
                timeZone: browserTimeZone,
                export: "1",
            });
            const response = await fetchPaginatedJson<BookingFinance, FinancePageMetadata>(
                `/api/internal/finance?${params.toString()}`,
            );
            const exportBookings = response.items;
            const exportSummary = response.metadata?.summary || summary;
            const wb = XLSX.utils.book_new();

            // Sheet 1: Summary
            const summaryData: Array<Array<string | number>> = [
                ["Ringkasan Keuangan", "", ""],
                ["", "", ""],
                ["Total Pemasukan", exportSummary.totalRevenue, ""],
                [tf("exportOutstandingUnpaidLabel"), exportSummary.totalPending, ""],
                ["Total DP Diterima", exportSummary.totalDP, ""],
                ["Jumlah Booking Lunas", exportSummary.paidCount, ""],
                [tf("exportUnpaidBookingCountLabel"), exportSummary.unpaidCount, ""],
                ["", "", ""],
                ["Ringkasan per Bulan", "", ""],
                ["Bulan", "Total Harga", "Pemasukan Bersih"],
            ];
            // Group by month
            const monthMap: Record<string, { total: number; dp: number }> = {};
            exportBookings.forEach((b) => {
                const d = b.session_date ? new Date(b.session_date) : new Date();
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                if (!monthMap[key]) monthMap[key] = { total: 0, dp: 0 };
                monthMap[key].total += getFinalInvoiceTotal(b.total_price, b.final_adjustments);
                monthMap[key].dp += getNetVerifiedRevenue(b);
            });
            Object.keys(monthMap).sort().reverse().forEach((key) => {
                const [y, m] = key.split("-");
                const label = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
                summaryData.push([label, monthMap[key].total, monthMap[key].dp]);
            });
            const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
            wsSummary["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 20 }];
            XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan");

            // Sheet 2: Detail
            const detailData = exportBookings.map((b) => {
                const initialBreakdown = getInitialPriceBreakdown(b);
                return {
                    "Kode Booking": b.booking_code,
                    [tf("exportClientNameLabel")]: b.client_name,
                    "Paket": b.service_label || b.services?.name || "-",
                    "Jadwal": b.session_date ? formatSessionDate(b.session_date, { dateOnly: true }) : "-",
                    "Total Harga": getFinalInvoiceTotal(b.total_price, b.final_adjustments),
                    "Harga Paket": getPackagePrice(b, initialBreakdown),
                    "Total Add-on": getAddonTotal(b, initialBreakdown),
                    "DP Dibayar": b.dp_paid,
                    "Diskon": -getDiscountAmount(b, initialBreakdown),
                    "DP Terverifikasi": b.dp_verified_amount || 0,
                    "Refund DP": b.dp_refund_amount || 0,
                    "Pemasukan Bersih": getNetVerifiedRevenue(b),
                    "Sisa": isCancelledBooking(b) ? 0 : getRemainingFinalPayment({
                        total_price: b.total_price,
                        dp_paid: b.dp_paid,
                        final_adjustments: b.final_adjustments,
                        final_payment_amount: b.final_payment_amount,
                        final_paid_at: b.final_paid_at,
                        settlement_status: b.settlement_status,
                        is_fully_paid: b.is_fully_paid,
                    }),
                    "Status": getFinanceStatusLabel(b),
                };
            });
            const wsDetail = XLSX.utils.json_to_sheet(detailData);
            wsDetail["!cols"] = [{ wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
            XLSX.utils.book_append_sheet(wb, wsDetail, "Detail Booking");

            XLSX.writeFile(wb, `keuangan_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (error) {
            console.error("[FinancePage] Failed to export finance data", error);
            setFeedbackDialog({ open: true, message: tf("failedLoadFinance") });
        }
    }

    function openProof(url: string | null) {
        if (!url) return;
        window.open(url, "_blank");
    }

    React.useEffect(() => {
        if (loading) return;

        const normalizedPackageFilter = normalizeSelectedFilterValues(packageFilter, packageOptions);
        if (!arraysAreEqual(normalizedPackageFilter, packageFilter)) {
            setPackageFilter(normalizedPackageFilter);
        }

        const normalizedBookingStatusFilter = normalizeSelectedFilterValues(bookingStatusFilter, bookingStatusOptions);
        if (!arraysAreEqual(normalizedBookingStatusFilter, bookingStatusFilter)) {
            setBookingStatusFilter(normalizedBookingStatusFilter);
        }
        const normalizedEventTypeFilter = normalizeSelectedFilterValues(eventTypeFilter, availableEventTypes);
        if (!arraysAreEqual(normalizedEventTypeFilter, eventTypeFilter)) {
            setEventTypeFilter(normalizedEventTypeFilter);
        }
    }, [
        availableEventTypes,
        bookingStatusFilter,
        bookingStatusOptions,
        eventTypeFilter,
        loading,
        packageFilter,
        packageOptions,
    ]);

    React.useEffect(() => {
        setCurrentPage(1);
    }, [
        bookingStatusFilter,
        dateBasis,
        dateFromFilter,
        dateToFilter,
        eventTypeFilter,
        filter,
        itemsPerPage,
        packageFilter,
        debouncedSearchQuery,
        sortOrder,
    ]);

    React.useEffect(() => {
        const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, itemsPerPage, totalItems]);

    return (
        <div className="space-y-6">
            {successToastNode}
            <BookingWriteReadonlyBanner />
            <PageHeader
                actions={(
                    <>
                        <MoneyVisibilityToggle
                            className="hidden w-full md:inline-flex md:w-auto"
                        />
                        <Button
                            type="button"
                            className="hidden w-full gap-2 md:inline-flex md:w-auto"
                            disabled={loading || refreshing || (!hasLoadedFinanceSuccessfully && showFinanceLoadError)}
                            onClick={() => { void exportFinance(); }}
                        >
                            <Download className="w-4 h-4" /> Export Excel
                        </Button>
                        <TableColumnManager
                            title="Kelola Kolom Keuangan"
                            description="Atur kolom yang tampil di tabel keuangan. Kolom Nama dan Aksi selalu tampil, serta lock-nya bisa diaktifkan atau dimatikan."
                            columns={columns}
                            open={columnManagerOpen}
                            onOpenChange={handleColumnManagerOpenChange}
                            onChange={setColumns}
                            onSave={() => saveColumnPreferences(columns)}
                            onResetWidths={() => handleResetColumnWidths()}
                            saving={savingColumns}
                            resettingWidths={resettingColumnWidths}
                            triggerClassName="hidden w-full md:inline-flex md:w-auto"
                        />
                    </>
                )}
            >
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
                    <p className="text-muted-foreground">{t("subtitle")}</p>
                </div>
            </PageHeader>

            {showFinanceLoadError ? (
                <div className={`rounded-xl border px-4 py-4 shadow-sm ${hasLoadedFinanceSuccessfully ? "border-amber-200 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-500/10" : "border-red-200 bg-red-50/80 dark:border-red-500/30 dark:bg-red-500/10"}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground">{financeLoadError}</p>
                            <p className="text-sm text-muted-foreground">{financeLoadErrorDescription}</p>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={handleRetryFinanceLoad}
                            disabled={loading || refreshing}
                        >
                            {tf("retryLoadFinance")}
                        </Button>
                    </div>
                </div>
            ) : null}

            {showInitialFinanceSkeleton ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
                            <div className="mb-4 flex items-center gap-3">
                                <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
                                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                            </div>
                            <div className="h-8 w-28 animate-pulse rounded bg-muted" />
                            <div className="mt-3 h-3 w-40 animate-pulse rounded bg-muted" />
                        </div>
                    ))}
                </div>
            ) : showFinanceContent ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-500/10">
                                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                            </div>
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("totalPemasukan")}</span>
                        </div>
                        <div className="text-2xl font-bold">{formatSensitiveCurrency(summary.totalRevenue)}</div>
                        <p className="text-xs text-muted-foreground mt-1">{t("dariSemuaBooking", { count: summary.totalBookings })}</p>
                    </div>
                    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-500/10">
                                <Receipt className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                            </div>
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("monthlyRevenue")}</span>
                        </div>
                        <div className="text-2xl font-bold">{formatSensitiveCurrency(summary.monthlyRevenueTotal)}</div>
                        <p className="text-xs text-muted-foreground mt-1">{t("monthlyRevenueSubtitle", { month: monthlyRevenueLabel })}</p>
                    </div>
                    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-500/10">
                                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("sisaTagihan")}</span>
                        </div>
                        <div className="text-2xl font-bold">{formatSensitiveCurrency(summary.totalPending)}</div>
                        <p className="text-xs text-muted-foreground mt-1">{t("dariBookingBelumLunas", { count: summary.unpaidCount })}</p>
                    </div>
                </div>
            ) : null}

            {showFinanceContent ? (
                <div className="grid grid-cols-2 gap-2 max-[360px]:grid-cols-1 md:hidden">
                    <MoneyVisibilityToggle className="w-full" />
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => handleColumnManagerOpenChange(true)}
                    >
                        <Settings2 className="w-4 h-4" />
                        Kelola Kolom
                    </Button>
                    <Button
                        type="button"
                        className="w-full gap-2"
                        disabled={loading || refreshing || (!hasLoadedFinanceSuccessfully && showFinanceLoadError)}
                        onClick={() => { void exportFinance(); }}
                    >
                        <Download className="w-4 h-4" />
                        Export Excel
                    </Button>
                </div>
            ) : null}

            {/* Filters */}
            <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="relative min-w-0 flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder={t("searchPlaceholder")}
                            className="h-9 w-full rounded-md border border-input bg-background/50 pl-9 pr-3 text-sm outline-none transition-all focus-visible:ring-1 focus-visible:ring-ring"
                        />
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        className="h-9 w-9 shrink-0 justify-center px-0 sm:h-9 sm:w-auto sm:gap-2 sm:px-3"
                        onClick={() => setShowFilterPanel((previous) => !previous)}
                        aria-label={t("filterButton")}
                    >
                        <ListOrdered className="w-4 h-4" />
                        <span className="hidden sm:inline">{t("filterButton")}</span>
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
                                type="button"
                                onClick={resetFilters}
                                className="h-9 px-3 rounded-md border border-input bg-background/50 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                                {t("resetFilters")}
                            </button>
                        )}
                    </div>
                </div>
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
                            <X className="w-3.5 h-3.5" />
                            {t("resetFilters")}
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
                                <label className="text-xs font-medium text-muted-foreground md:w-24 md:shrink-0">{t("financeStatusFilterLabel")}</label>
                                <FilterSingleSelect
                                    value={filter}
                                    onChange={(nextValue) => setFilter(normalizeFinanceFilterValue(nextValue))}
                                    options={financeStatusOptions}
                                    placeholder={t("financeStatusFilterLabel")}
                                    className="w-full"
                                    mobileTitle={t("financeStatusFilterLabel")}
                                />
                            </div>
                            <div className="space-y-1.5 md:space-y-0 md:flex md:items-center md:gap-4">
                                <label className="text-xs font-medium text-muted-foreground md:w-24 md:shrink-0">{t("packageFilterLabel")}</label>
                                <FilterMultiSelect
                                    values={packageFilter}
                                    onChange={setPackageFilter}
                                    options={packageFilterOptions}
                                    placeholder={t("packageFilterLabel")}
                                    allLabel={t("allPackages")}
                                    countSuffix={multiCountSuffix}
                                    className="w-full"
                                    mobileTitle={t("packageFilterLabel")}
                                />
                            </div>
                            <div className="space-y-1.5 md:space-y-0 md:flex md:items-center md:gap-4">
                                <label className="text-xs font-medium text-muted-foreground md:w-24 md:shrink-0">{t("bookingStatusFilterLabel")}</label>
                                <FilterMultiSelect
                                    values={bookingStatusFilter}
                                    onChange={setBookingStatusFilter}
                                    options={bookingStatusFilterOptions}
                                    placeholder={t("bookingStatusFilterLabel")}
                                    allLabel={t("allBookingStatuses")}
                                    countSuffix={multiCountSuffix}
                                    className="w-full"
                                    mobileTitle={t("bookingStatusFilterLabel")}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
                {!showFinanceContent ? null : queryState.isLoading || queryState.isRefreshing ? (
                    <CardListSkeleton count={Math.min(queryState.perPage, 4)} />
                ) : queryState.totalItems === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">{t("tidakAdaData")}</div>
                ) : bookings.map((b) => {
                    const remaining = getRemainingAmount(b);
                    const finalTotal = getFinalInvoiceTotal(b.total_price, b.final_adjustments);
                    const initialBreakdown = getInitialPriceBreakdown(b);
                    const packagePrice = getPackagePrice(b, initialBreakdown);
                    const addonTotal = getAddonTotal(b, initialBreakdown);
                    const discountAmount = getDiscountAmount(b, initialBreakdown);
                    const serviceColor = financeTableColorEnabled
                        ? getPrimaryMainServiceColor(b.service_selections)
                        : null;
                    const mobileCardStyle = serviceColor
                        ? ({
                            backgroundColor: withAlpha(serviceColor, 0.095),
                            borderColor: withAlpha(serviceColor, 0.34),
                        } as React.CSSProperties)
                        : undefined;
                    return (
                        <div
                            key={b.id}
                            className="rounded-xl border bg-card shadow-sm p-4 space-y-3"
                            style={mobileCardStyle}
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="font-semibold">{b.client_name}</p>
                                    <p className="text-xs text-muted-foreground">{b.booking_code} · {b.service_label || b.services?.name || "-"}</p>
                                </div>
                                {isCancelledBooking(b) ? (
                                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${b.dp_refund_amount > 0
                                        ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                                        : "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400"}`}>
                                        {getFinanceStatusLabel(b)}
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => b.is_fully_paid ? handleMarkUnpaid(b.id) : handleMarkPaid(b.id)}
                                        disabled={!canWriteBookings}
                                        title={!canWriteBookings ? bookingWriteBlockedMessage : undefined}
                                        className={`text-xs font-medium px-2.5 py-1 rounded-full cursor-pointer ${b.is_fully_paid
                                            ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                                            : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"}`}
                                    >
                                        {getFinanceStatusLabel(b)}
                                    </button>
                                )}
                            </div>
                            <div className="border-t pt-2 space-y-1.5 text-sm">
                                {orderedVisibleColumns
                                    .filter((column) => !["name", "row_number", "actions"].includes(column.id))
                                    .map((column) => {
                                        const renderedValue = renderMobileValue(
                                            b,
                                            column,
                                            remaining,
                                            finalTotal,
                                            addonTotal,
                                            packagePrice,
                                            discountAmount,
                                        );
                                        return (
                                            <div key={column.id} className="flex items-start justify-between gap-3">
                                                <span className="text-muted-foreground">{column.label}</span>
                                                <span className="max-w-[180px] truncate text-right font-medium text-foreground" title={String(renderedValue ?? "-")}>
                                                    {renderedValue}
                                                </span>
                                            </div>
                                        );
                                    })}
                            </div>
                            <div className="flex flex-wrap items-center gap-1 pt-1 border-t">
                                <Link href={`/bookings/${b.id}`}>
                                    <ActionIconButton tone="slate" title={tf("detailBooking")}>
                                        <Info className="w-4 h-4" />
                                    </ActionIconButton>
                                </Link>
                                <ActionIconButton tone="indigo" title={tf("openInvoiceOptions")} onClick={() => setMobileActionPicker({ open: true, booking: b, kind: "invoice" })}>
                                    <FileText className="w-4 h-4" />
                                </ActionIconButton>
                                <ActionIconButton tone="violet" title={tf("copyInvoiceTemplateOptions")} onClick={() => setMobileActionPicker({ open: true, booking: b, kind: "copy" })}>
                                    {(copiedInitialTemplateId === b.id || copiedFinalTemplateId === b.id) ? (
                                        <ClipboardCheck className="w-4 h-4" />
                                    ) : (
                                        <Copy className="w-4 h-4" />
                                    )}
                                </ActionIconButton>
                                <ActionIconButton tone="emerald" title={tf("sendInvoiceWAOptions")} disabled={!b.client_whatsapp} onClick={() => setMobileActionPicker({ open: true, booking: b, kind: "wa" })}>
                                    <MessageCircle className="w-4 h-4" />
                                </ActionIconButton>
                                <ActionIconButton tone="sky" title={tf("openSettlementLink")} disabled={!b.tracking_uuid} onClick={() => window.open(getSettlementLink(b), "_blank")}>
                                    <ExternalLink className="w-4 h-4" />
                                </ActionIconButton>
                                <ActionIconButton
                                    tone="amber"
                                    title={b.payment_proof_url ? tf("openInitialProof") : tf("initialProofUnavailable")}
                                    disabled={!b.payment_proof_url}
                                    onClick={() => openProof(b.payment_proof_url)}
                                >
                                    <Receipt className="w-4 h-4" />
                                </ActionIconButton>
                                <ActionIconButton
                                    tone="cyan"
                                    title={b.final_payment_proof_url ? tf("openFinalProof") : tf("finalProofUnavailable")}
                                    disabled={!b.final_payment_proof_url}
                                    onClick={() => openProof(b.final_payment_proof_url)}
                                >
                                    <Receipt className="w-4 h-4" />
                                </ActionIconButton>
                            </div>
                        </div>
                    );
                })}
            </div>
            {showFinanceContent && !queryState.isLoading && !queryState.isRefreshing && queryState.totalItems > 0 ? (
                <div className="md:hidden">
                    <TablePagination
                        totalItems={queryState.totalItems}
                        currentPage={queryState.page}
                        itemsPerPage={queryState.perPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                        perPageOptions={[...FINANCE_PER_PAGE_OPTIONS]}
                    />
                </div>
            ) : null}

            <Dialog open={mobileActionPicker.open} onOpenChange={(open) => !open && setMobileActionPicker({ open: false, booking: null, kind: null })}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>
                            {mobileActionPicker.kind === "wa"
                                ? tf("sendInvoiceWAOptions")
                                : mobileActionPicker.kind === "copy"
                                    ? tf("copyInvoiceTemplateOptions")
                                    : tf("openInvoiceOptions")}
                        </DialogTitle>
                        <DialogDescription>
                            {mobileActionPicker.kind === "wa"
                                ? tf("chooseWAInvoiceType")
                                : mobileActionPicker.kind === "copy"
                                    ? tf("chooseCopyInvoiceType")
                                    : tf("chooseInvoiceType")}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2 py-2">
                        <button
                            type="button"
                            className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                            onClick={() => {
                                const booking = mobileActionPicker.booking;
                                const kind = mobileActionPicker.kind;
                                setMobileActionPicker({ open: false, booking: null, kind: null });
                                if (!booking) return;
                                if (kind === "wa") {
                                    void handleSendInvoiceWaStage(booking, "initial");
                                    return;
                                }
                                if (kind === "copy") {
                                    void handleCopyInvoiceTemplateStage(booking, "initial");
                                    return;
                                }
                                handleOpenInvoiceStage(booking, "initial");
                            }}
                        >
                            <span>{mobileActionPicker.kind === "wa" ? tf("sendInitialInvoiceWA") : mobileActionPicker.kind === "copy" ? tf("copyInitialInvoiceTemplate") : tf("openInitialInvoice")}</span>
                            {mobileActionPicker.kind === "wa"
                                ? <MessageCircle className="w-4 h-4 text-emerald-600" />
                                : mobileActionPicker.kind === "copy"
                                    ? <Copy className="w-4 h-4 text-violet-600" />
                                    : <FileText className="w-4 h-4 text-indigo-600" />}
                        </button>
                        <button
                            type="button"
                            disabled={mobileActionPicker.kind === "wa" && !mobileActionPicker.booking?.tracking_uuid}
                            className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => {
                                const booking = mobileActionPicker.booking;
                                const kind = mobileActionPicker.kind;
                                setMobileActionPicker({ open: false, booking: null, kind: null });
                                if (!booking) return;
                                if (kind === "wa") {
                                    void handleSendInvoiceWaStage(booking, "final");
                                    return;
                                }
                                if (kind === "copy") {
                                    void handleCopyInvoiceTemplateStage(booking, "final");
                                    return;
                                }
                                handleOpenInvoiceStage(booking, "final");
                            }}
                        >
                            <span>{mobileActionPicker.kind === "wa" ? tf("sendFinalInvoiceWA") : mobileActionPicker.kind === "copy" ? tf("copyFinalInvoiceTemplate") : tf("openFinalInvoice")}</span>
                            {mobileActionPicker.kind === "wa"
                                ? <MessageCircle className="w-4 h-4 text-orange-600" />
                                : mobileActionPicker.kind === "copy"
                                    ? <Copy className="w-4 h-4 text-violet-600" />
                                    : <Download className="w-4 h-4 text-indigo-600" />}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            <ActionFeedbackDialog
                open={feedbackDialog.open}
                onOpenChange={(open) => setFeedbackDialog((prev) => ({ ...prev, open }))}
                title={tf("feedbackTitle")}
                message={feedbackDialog.message}
                confirmLabel={tf("feedbackOk")}
            />

            {/* Desktop Table */}
            {showFinanceContent ? (
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-visible hidden md:block">
                    <div className="relative overflow-x-auto overflow-y-visible">
                        <table ref={tableRef} className="min-w-full w-max border-separate border-spacing-0 text-left text-sm">
                            <thead className="text-xs uppercase bg-card border-b">
                                <tr>
                                    {orderedVisibleColumns.map((column) => renderDesktopHeader(column))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/70 dark:divide-white/20">
                                {queryState.isLoading || queryState.isRefreshing ? (
                                    <TableRowsSkeleton
                                        rows={Math.min(queryState.perPage, 6)}
                                        columns={orderedVisibleColumns.length}
                                    />
                                ) : queryState.totalItems === 0 ? (
                                    <tr><td colSpan={columns.filter((column) => column.visible).length} className="px-6 py-12 text-center text-muted-foreground">
                                        {t("tidakAdaData")}
                                    </td></tr>
                                ) : bookings.map((b, rowIndex) => {
                                    const remaining = getRemainingAmount(b);
                                    const finalTotal = getFinalInvoiceTotal(b.total_price, b.final_adjustments);
                                    const initialBreakdown = getInitialPriceBreakdown(b);
                                    const packagePrice = getPackagePrice(b, initialBreakdown);
                                    const addonTotal = getAddonTotal(b, initialBreakdown);
                                    const discountAmount = getDiscountAmount(b, initialBreakdown);
                                    const serviceColor = financeTableColorEnabled
                                        ? getPrimaryMainServiceColor(b.service_selections)
                                        : null;
                                    const rowNumber =
                                        (currentPage - 1) * itemsPerPage + rowIndex + 1;
                                    return (
                                        <tr
                                            key={b.id}
                                            className={
                                                serviceColor
                                                    ? "group transition-colors"
                                                    : "group hover:bg-muted/60 dark:hover:bg-white/12 transition-colors"
                                            }
                                            style={
                                                serviceColor
                                                    ? ({
                                                        backgroundColor: withAlpha(serviceColor, 0.075),
                                                    } as React.CSSProperties)
                                                    : undefined
                                            }
                                        >
                                            {orderedVisibleColumns.map((column) =>
                                                renderDesktopCell(
                                                    b,
                                                    column,
                                                    rowNumber,
                                                    remaining,
                                                    finalTotal,
                                                    addonTotal,
                                                    packagePrice,
                                                    discountAmount,
                                                ),
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <TablePagination totalItems={queryState.totalItems} currentPage={queryState.page} itemsPerPage={queryState.perPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} perPageOptions={[...FINANCE_PER_PAGE_OPTIONS]} />
                </div>
            ) : null}
        </div>
    );
}
