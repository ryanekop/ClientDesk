"use client";

import * as React from "react";
import {
    ChevronDown,
    ChevronRight,
    CheckCircle2,
    Edit2,
    ExternalLink,
    Clock,
    Briefcase,
    Download,
    HandCoins,
    ListOrdered,
    Loader2,
    Search,
    Settings2,
    Users,
    Wallet,
    X,
    XCircle,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as XLSX from "xlsx";

import { AppCheckbox } from "@/components/ui/app-checkbox";
import { Button } from "@/components/ui/button";
import { CardListSkeleton, TableRowsSkeleton } from "@/components/ui/data-skeletons";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { FilterSingleSelect } from "@/components/ui/filter-single-select";
import { BookingDateRangePicker } from "@/components/ui/booking-date-range-picker";
import { ManageActionToolbar } from "@/components/ui/manage-action-toolbar";
import { MoneyVisibilityToggle } from "@/components/ui/money-visibility";
import { PageHeader } from "@/components/ui/page-header";
import { TableColumnManager } from "@/components/ui/table-column-manager";
import { TablePagination } from "@/components/ui/table-pagination";
import { useResizableTableColumns } from "@/components/ui/use-resizable-table-columns";
import { fetchPaginatedJson } from "@/lib/pagination/http";
import type { PaginatedQueryState } from "@/lib/pagination/types";
import { useMoneyVisibility } from "@/hooks/use-money-visibility";
import {
    areAllVisibleSelected,
    pruneSelection,
    toggleSelectAllVisible,
    toggleSelection,
} from "@/lib/manage-selection";
import {
    areTableColumnPreferencesEqual,
    lockBoundaryColumns,
    mergeTableColumnPreferences,
    updateTableColumnPreferenceMap,
    type TableColumnPreference,
} from "@/lib/table-column-prefs";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";

type PaymentEntryStatus = "unpaid" | "paid";
type PaymentStatusFilter = "all" | PaymentEntryStatus;
type SortOrder = "booking_newest" | "booking_oldest" | "session_newest" | "session_oldest" | "payment_unpaid_first" | "payment_paid_first";
type DateBasis = "booking_date" | "session_date";

type PaymentDetail = {
    id: string;
    bookingId: string;
    freelanceId: string;
    bookingCode: string;
    clientName: string;
    bookingDate: string | null;
    sessionDate: string | null;
    eventType: string;
    bookingStatus: string;
    serviceLabel: string;
    amount: number;
    status: PaymentEntryStatus;
    paidAt: string | null;
    notes: string;
};

type PaymentGroup = {
    freelanceId: string;
    freelanceName: string;
    role: string;
    status: string;
    pricelist: unknown;
    totalJobs: number;
    paidCount: number;
    unpaidCount: number;
    unpaidTotal: number;
    details: PaymentDetail[];
};

type PaymentMetadata = {
    roles: string[];
    bookingStatuses: string[];
    eventTypes: string[];
    tableColumnPreferences?: TableColumnPreference[] | null;
    summary: {
        totalGroups: number;
        totalJobs: number;
        paidCount: number;
        unpaidCount: number;
        unpaidTotal: number;
    };
};

type EditDraft = {
    id: string;
    title: string;
    amount: string;
    notes: string;
};

const PAYMENT_PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;
const DEFAULT_PER_PAGE = 10;
const SEARCH_DEBOUNCE_MS = 400;
const FILTER_STORAGE_PREFIX = "clientdesk:team-payments:filters";
const ITEMS_PER_PAGE_STORAGE_PREFIX = "clientdesk:team-payments:items_per_page";
const GROUP_COLUMN_IDS = ["name", "jobs", "paid_count", "unpaid_count", "unpaid_total", "actions"] as const;
const DETAIL_COLUMN_IDS = ["booking", "event_type", "session_date", "service", "amount", "payment_status", "paid_at", "actions"] as const;
const TEAM_PAYMENT_NON_RESIZABLE_COLUMN_IDS = ["select", "actions"];
const TEAM_PAYMENT_COLUMN_MIN_WIDTHS: Record<string, number> = {
    name: 220,
    jobs: 96,
    paid_count: 96,
    unpaid_count: 120,
    unpaid_total: 180,
    booking: 220,
    event_type: 140,
    session_date: 150,
    service: 220,
    amount: 140,
    payment_status: 150,
    paid_at: 150,
    actions: 220,
};
const EMPTY_METADATA: PaymentMetadata = {
    roles: [],
    bookingStatuses: [],
    eventTypes: [],
    tableColumnPreferences: null,
    summary: {
        totalGroups: 0,
        totalJobs: 0,
        paidCount: 0,
        unpaidCount: 0,
        unpaidTotal: 0,
    },
};

function createTeamPaymentColumns(t: ReturnType<typeof useTranslations<"TeamPayments">>): TableColumnPreference[] {
    return lockBoundaryColumns([
        { id: "name", label: t("freelance"), visible: true },
        { id: "jobs", label: t("jobs"), visible: true },
        { id: "paid_count", label: t("paid"), visible: true },
        { id: "unpaid_count", label: t("unpaid"), visible: true },
        { id: "unpaid_total", label: t("unpaidTotal"), visible: true },
        { id: "booking", label: t("booking"), visible: true },
        { id: "event_type", label: t("eventType"), visible: true },
        { id: "session_date", label: t("sessionDate"), visible: true },
        { id: "service", label: t("service"), visible: true },
        { id: "amount", label: t("amount"), visible: true },
        { id: "payment_status", label: t("paymentStatus"), visible: true },
        { id: "paid_at", label: t("paidAt"), visible: true },
        { id: "actions", label: t("actions"), visible: true },
    ]);
}

function normalizeItemsPerPage(value: unknown) {
    const parsed = typeof value === "number" ? value : Number(value);
    return PAYMENT_PER_PAGE_OPTIONS.includes(parsed as (typeof PAYMENT_PER_PAGE_OPTIONS)[number])
        ? parsed
        : DEFAULT_PER_PAGE;
}

function normalizePaymentStatus(value: unknown): PaymentStatusFilter {
    return value === "paid" || value === "unpaid" ? value : "all";
}

function normalizeSortOrder(value: unknown): SortOrder {
    return (
        value === "booking_oldest" ||
        value === "session_newest" ||
        value === "session_oldest" ||
        value === "payment_unpaid_first" ||
        value === "payment_paid_first" ||
        value === "booking_newest"
    )
        ? value
        : "booking_newest";
}

function normalizeDateBasis(value: unknown): DateBasis {
    return value === "session_date" ? "session_date" : "booking_date";
}

function parseStoredList(value: unknown) {
    if (!Array.isArray(value)) return [] as string[];
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(Math.max(Number(value) || 0, 0));
}

function formatDate(value: string | null, locale: string) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(date);
}

function formatRupiahInput(value: number) {
    return new Intl.NumberFormat("id-ID").format(Math.max(Math.floor(value), 0));
}

function parseRupiahInput(value: string) {
    const digitsOnly = value.replace(/\D+/g, "");
    return digitsOnly ? Number(digitsOnly) : 0;
}

function statusBadgeClassName(status: PaymentEntryStatus) {
    return status === "paid"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
        : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300";
}

export default function TeamPaymentsPage() {
    const locale = useLocale();
    const t = useTranslations("TeamPayments");
    const supabase = React.useMemo(() => createClient(), []);
    const { isMoneyVisible } = useMoneyVisibility();
    const defaultColumns = React.useMemo(() => createTeamPaymentColumns(t), [t]);
    const [groups, setGroups] = React.useState<PaymentGroup[]>([]);
    const [metadata, setMetadata] = React.useState<PaymentMetadata>(EMPTY_METADATA);
    const [columns, setColumns] = React.useState<TableColumnPreference[]>(defaultColumns);
    const [columnManagerOpen, setColumnManagerOpen] = React.useState(false);
    const [savingColumns, setSavingColumns] = React.useState(false);
    const [queryState, setQueryState] = React.useState<PaginatedQueryState>({
        page: 1,
        perPage: DEFAULT_PER_PAGE,
        totalItems: 0,
        isLoading: true,
        isRefreshing: false,
    });
    const [searchQuery, setSearchQuery] = React.useState("");
    const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState("");
    const [paymentStatus, setPaymentStatus] = React.useState<PaymentStatusFilter>("all");
    const [roleFilters, setRoleFilters] = React.useState<string[]>([]);
    const [bookingStatusFilters, setBookingStatusFilters] = React.useState<string[]>([]);
    const [eventTypeFilters, setEventTypeFilters] = React.useState<string[]>([]);
    const [dateFromFilter, setDateFromFilter] = React.useState("");
    const [dateToFilter, setDateToFilter] = React.useState("");
    const [dateBasis, setDateBasis] = React.useState<DateBasis>("booking_date");
    const [sortOrder, setSortOrder] = React.useState<SortOrder>("booking_newest");
    const [showFilterPanel, setShowFilterPanel] = React.useState(false);
    const [filtersHydrated, setFiltersHydrated] = React.useState(false);
    const [isManageMode, setIsManageMode] = React.useState(false);
    const [selectedEntryIds, setSelectedEntryIds] = React.useState<string[]>([]);
    const [expandedGroupIds, setExpandedGroupIds] = React.useState<string[]>([]);
    const [editDraft, setEditDraft] = React.useState<EditDraft | null>(null);
    const [feedback, setFeedback] = React.useState("");
    const [updatingIds, setUpdatingIds] = React.useState<string[]>([]);
    const [exporting, setExporting] = React.useState(false);
    const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
    const [resettingColumnWidths, setResettingColumnWidths] = React.useState(false);

    const formatSensitiveCurrency = React.useCallback(
        (amount: number) => isMoneyVisible ? formatCurrency(amount) : "Rp •••••••",
        [isMoneyVisible],
    );

    React.useEffect(() => {
        const timeout = window.setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timeout);
    }, [searchQuery]);

    React.useEffect(() => {
        let active = true;
        void (async () => {
            const result = await supabase.auth.getUser();
            if (!active) return;
            setCurrentUserId(result.data.user?.id || null);
        })();
        return () => {
            active = false;
        };
    }, [supabase]);

    React.useEffect(() => {
        setColumns((current) => {
            const nextColumns = mergeTableColumnPreferences(defaultColumns, current);
            return areTableColumnPreferencesEqual(current, nextColumns) ? current : nextColumns;
        });
    }, [defaultColumns]);

    React.useEffect(() => {
        try {
            const storedPerPage = window.localStorage.getItem(ITEMS_PER_PAGE_STORAGE_PREFIX);
            setQueryState((current) => ({
                ...current,
                perPage: normalizeItemsPerPage(storedPerPage),
            }));
        } catch {
            // Ignore storage failures.
        }

        try {
            const stored = window.localStorage.getItem(FILTER_STORAGE_PREFIX);
            if (stored) {
                const parsed = JSON.parse(stored) as Record<string, unknown>;
                const storedSearch = typeof parsed.searchQuery === "string" ? parsed.searchQuery : "";
                setSearchQuery(storedSearch);
                setDebouncedSearchQuery(storedSearch);
                setPaymentStatus(normalizePaymentStatus(parsed.paymentStatus));
                setRoleFilters(parseStoredList(parsed.roleFilters));
                setBookingStatusFilters(parseStoredList(parsed.bookingStatusFilters));
                setEventTypeFilters(parseStoredList(parsed.eventTypeFilters));
                setDateFromFilter(typeof parsed.dateFromFilter === "string" ? parsed.dateFromFilter : "");
                setDateToFilter(typeof parsed.dateToFilter === "string" ? parsed.dateToFilter : "");
                setDateBasis(normalizeDateBasis(parsed.dateBasis));
                setSortOrder(normalizeSortOrder(parsed.sortOrder));
            }
        } catch {
            // Ignore invalid saved filters.
        }
        setFiltersHydrated(true);
    }, []);

    React.useEffect(() => {
        if (!filtersHydrated) return;
        try {
            window.localStorage.setItem(
                FILTER_STORAGE_PREFIX,
                JSON.stringify({
                    searchQuery,
                    paymentStatus,
                    roleFilters,
                    bookingStatusFilters,
                    eventTypeFilters,
                    dateFromFilter,
                    dateToFilter,
                    dateBasis,
                    sortOrder,
                }),
            );
        } catch {
            // Ignore storage failures.
        }
    }, [
        bookingStatusFilters,
        dateBasis,
        dateFromFilter,
        dateToFilter,
        eventTypeFilters,
        filtersHydrated,
        paymentStatus,
        roleFilters,
        searchQuery,
        sortOrder,
    ]);

    const buildPaymentParams = React.useCallback((overrides?: Partial<{
        page: number;
        perPage: number;
        search: string;
    }>) => new URLSearchParams({
        page: String(overrides?.page ?? queryState.page),
        perPage: String(overrides?.perPage ?? queryState.perPage),
        search: overrides?.search ?? debouncedSearchQuery,
        paymentStatus,
        roleFilters: JSON.stringify(roleFilters),
        bookingStatusFilters: JSON.stringify(bookingStatusFilters),
        eventTypeFilters: JSON.stringify(eventTypeFilters),
        dateFrom: dateFromFilter,
        dateTo: dateToFilter,
        dateBasis,
        sort: sortOrder,
    }), [
        bookingStatusFilters,
        dateBasis,
        dateFromFilter,
        dateToFilter,
        debouncedSearchQuery,
        eventTypeFilters,
        paymentStatus,
        queryState.page,
        queryState.perPage,
        roleFilters,
        sortOrder,
    ]);

    const fetchPayments = React.useCallback(async (mode: "loading" | "refreshing" = "refreshing") => {
        if (!filtersHydrated) return;
        setQueryState((current) => ({
            ...current,
            isLoading: mode === "loading",
            isRefreshing: mode === "refreshing",
        }));

        const params = buildPaymentParams();

        try {
            const response = await fetchPaginatedJson<PaymentGroup, PaymentMetadata>(
                `/api/internal/freelance-payments?${params.toString()}`,
            );
            setGroups(response.items);
            setMetadata(response.metadata || EMPTY_METADATA);
            if (response.metadata?.tableColumnPreferences) {
                setColumns((current) => {
                    const nextColumns = mergeTableColumnPreferences(defaultColumns, response.metadata?.tableColumnPreferences || undefined);
                    return areTableColumnPreferencesEqual(current, nextColumns) ? current : nextColumns;
                });
            }
            setQueryState((current) => ({
                ...current,
                totalItems: response.totalItems,
                isLoading: false,
                isRefreshing: false,
            }));
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : t("loadFailed"));
            setQueryState((current) => ({
                ...current,
                isLoading: false,
                isRefreshing: false,
            }));
        }
    }, [
        buildPaymentParams,
        defaultColumns,
        filtersHydrated,
        t,
    ]);

    React.useEffect(() => {
        void fetchPayments(queryState.totalItems === 0 ? "loading" : "refreshing");
    }, [fetchPayments, queryState.totalItems]);

    const visibleEntryIds = React.useMemo(
        () => groups.flatMap((group) => group.details.map((detail) => detail.id)),
        [groups],
    );
    const visibleColumns = React.useMemo(
        () => columns.filter((column) => column.visible),
        [columns],
    );
    const groupVisibleColumns = React.useMemo(
        () => visibleColumns.filter((column) => GROUP_COLUMN_IDS.includes(column.id as (typeof GROUP_COLUMN_IDS)[number])),
        [visibleColumns],
    );
    const detailVisibleColumns = React.useMemo(
        () => visibleColumns.filter((column) => DETAIL_COLUMN_IDS.includes(column.id as (typeof DETAIL_COLUMN_IDS)[number])),
        [visibleColumns],
    );
    const tableColSpan = groupVisibleColumns.length + (isManageMode ? 1 : 0);
    const {
        getColumnWidthStyle,
        getResizeHandleProps,
        isColumnResizable,
        isColumnBeingResized,
        cancelActiveResize,
        resetColumnWidths,
    } = useResizableTableColumns({
        enabled: !columnManagerOpen,
        menuKey: "team_payments",
        userId: currentUserId,
        columns: visibleColumns,
        nonResizableColumnIds: TEAM_PAYMENT_NON_RESIZABLE_COLUMN_IDS,
        minWidthByColumnId: TEAM_PAYMENT_COLUMN_MIN_WIDTHS,
    });

    React.useEffect(() => {
        if (columnManagerOpen) {
            cancelActiveResize();
        }
    }, [cancelActiveResize, columnManagerOpen]);

    React.useEffect(() => {
        setSelectedEntryIds((current) => pruneSelection(current, visibleEntryIds));
    }, [visibleEntryIds]);

    const selectedCount = selectedEntryIds.length;
    const allVisibleSelected = areAllVisibleSelected(selectedEntryIds, visibleEntryIds);

    const setCurrentPage = (page: number) => {
        setQueryState((current) => ({ ...current, page }));
    };

    const setItemsPerPage = (perPage: number) => {
        const nextPerPage = normalizeItemsPerPage(perPage);
        try {
            window.localStorage.setItem(ITEMS_PER_PAGE_STORAGE_PREFIX, String(nextPerPage));
        } catch {
            // Ignore storage failures.
        }
        setQueryState((current) => ({ ...current, page: 1, perPage: nextPerPage }));
    };

    const resetFilters = () => {
        setSearchQuery("");
        setDebouncedSearchQuery("");
        setPaymentStatus("all");
        setRoleFilters([]);
        setBookingStatusFilters([]);
        setEventTypeFilters([]);
        setDateFromFilter("");
        setDateToFilter("");
        setDateBasis("booking_date");
        setSortOrder("booking_newest");
        setQueryState((current) => ({ ...current, page: 1 }));
    };

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

    const handleColumnManagerOpenChange = React.useCallback((nextOpen: boolean) => {
        setColumnManagerOpen(nextOpen);
    }, []);

    async function handleResetColumnWidths() {
        setResettingColumnWidths(true);
        try {
            await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
            resetColumnWidths();
            setColumnManagerOpen(false);
        } finally {
            setResettingColumnWidths(false);
        }
    }

    async function saveColumnPreferences(nextColumns: TableColumnPreference[]) {
        const normalizedColumns = lockBoundaryColumns(nextColumns);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setSavingColumns(true);
        try {
            const { data: profile } = await supabase
                .from("profiles")
                .select("table_column_preferences")
                .eq("id", user.id)
                .single();
            const payload = updateTableColumnPreferenceMap(
                profile?.table_column_preferences,
                "team_payments",
                normalizedColumns,
            );
            await supabase
                .from("profiles")
                .update({ table_column_preferences: payload })
                .eq("id", user.id);
            await invalidateProfilePublicCache();
            setColumns((current) =>
                areTableColumnPreferencesEqual(current, normalizedColumns)
                    ? current
                    : normalizedColumns,
            );
            setColumnManagerOpen(false);
        } finally {
            setSavingColumns(false);
        }
    }

    async function exportTeamPayments() {
        setExporting(true);
        try {
            const allGroups: PaymentGroup[] = [];
            let page = 1;
            let totalItems = 0;

            do {
                const params = buildPaymentParams({ page, perPage: 100 });
                const response = await fetchPaginatedJson<PaymentGroup, PaymentMetadata>(
                    `/api/internal/freelance-payments?${params.toString()}`,
                );
                allGroups.push(...response.items);
                totalItems = response.totalItems;
                page += 1;
            } while (allGroups.length < totalItems && page < 100);

            const details = allGroups.flatMap((group) =>
                group.details.map((detail) => ({
                    group,
                    detail,
                })),
            );
            const wb = XLSX.utils.book_new();
            const summaryData: Array<Array<string | number>> = [
                [t("title"), "", ""],
                ["", "", ""],
                [t("summaryFreelancers"), allGroups.length, ""],
                [t("summaryJobs"), details.length, ""],
                [t("summaryUnpaid"), details.filter(({ detail }) => detail.status === "unpaid").length, ""],
                [t("paid"), details.filter(({ detail }) => detail.status === "paid").length, ""],
                [t("summaryUnpaidTotal"), details.filter(({ detail }) => detail.status === "unpaid").reduce((sum, { detail }) => sum + detail.amount, 0), ""],
            ];
            const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
            wsSummary["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 18 }];
            XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan");

            const detailData = details.map(({ group, detail }) => ({
                [t("freelance")]: group.freelanceName,
                [t("role")]: group.role || "-",
                [t("booking")]: detail.bookingCode,
                "Klien": detail.clientName,
                [t("eventType")]: detail.eventType,
                [t("bookingDate")]: formatDate(detail.bookingDate, locale),
                [t("sessionDate")]: formatDate(detail.sessionDate, locale),
                [t("service")]: detail.serviceLabel,
                [t("amount")]: detail.amount,
                [t("paymentStatus")]: detail.status === "paid" ? t("paid") : t("unpaid"),
                [t("paidAt")]: formatDate(detail.paidAt, locale),
                [t("notes")]: detail.notes || "",
            }));
            const wsDetail = XLSX.utils.json_to_sheet(detailData);
            wsDetail["!cols"] = [
                { wch: 24 },
                { wch: 16 },
                { wch: 20 },
                { wch: 24 },
                { wch: 16 },
                { wch: 16 },
                { wch: 16 },
                { wch: 24 },
                { wch: 14 },
                { wch: 16 },
                { wch: 16 },
                { wch: 28 },
            ];
            XLSX.utils.book_append_sheet(wb, wsDetail, "Detail Pembayaran Tim");
            XLSX.writeFile(wb, `pembayaran_tim_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : t("exportFailed"));
        } finally {
            setExporting(false);
        }
    }

    const hasActiveFilters =
        searchQuery.trim().length > 0 ||
        paymentStatus !== "all" ||
        roleFilters.length > 0 ||
        bookingStatusFilters.length > 0 ||
        eventTypeFilters.length > 0 ||
        Boolean(dateFromFilter) ||
        Boolean(dateToFilter) ||
        dateBasis !== "booking_date" ||
        sortOrder !== "booking_newest";

    const toggleExpanded = (freelanceId: string) => {
        setExpandedGroupIds((current) =>
            current.includes(freelanceId)
                ? current.filter((item) => item !== freelanceId)
                : [...current, freelanceId],
        );
    };

    const setPaymentStatusForIds = async (ids: string[], status: PaymentEntryStatus) => {
        if (ids.length === 0) return;
        setUpdatingIds(ids);
        try {
            const response = await fetch("/api/internal/freelance-payments", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids, status }),
            });
            if (!response.ok) {
                const message = await response.text().catch(() => "");
                throw new Error(message || t("updateFailed"));
            }
            setSelectedEntryIds([]);
            await fetchPayments("refreshing");
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : t("updateFailed"));
        } finally {
            setUpdatingIds([]);
        }
    };

    const saveEditDraft = async () => {
        if (!editDraft) return;
        setUpdatingIds([editDraft.id]);
        try {
            const response = await fetch("/api/internal/freelance-payments", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: editDraft.id,
                    amount: parseRupiahInput(editDraft.amount),
                    notes: editDraft.notes,
                }),
            });
            if (!response.ok) {
                const message = await response.text().catch(() => "");
                throw new Error(message || t("updateFailed"));
            }
            setEditDraft(null);
            await fetchPayments("refreshing");
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : t("updateFailed"));
        } finally {
            setUpdatingIds([]);
        }
    };

    const paymentStatusOptions = [
        { value: "all", label: t("allPaymentStatuses") },
        { value: "unpaid", label: t("unpaid") },
        { value: "paid", label: t("paid") },
    ];
    const dateBasisOptions = [
        { value: "booking_date", label: t("bookingDate") },
        { value: "session_date", label: t("sessionDate") },
    ];
    const sortOptions = [
        { value: "booking_newest", label: t("bookingNewest") },
        { value: "booking_oldest", label: t("bookingOldest") },
        { value: "session_newest", label: t("sessionNewest") },
        { value: "session_oldest", label: t("sessionOldest") },
        { value: "payment_unpaid_first", label: t("paymentUnpaidFirst") },
        { value: "payment_paid_first", label: t("paymentPaidFirst") },
    ];
    const roleOptions = metadata.roles.map((role) => ({ value: role, label: role }));
    const bookingStatusOptions = metadata.bookingStatuses.map((status) => ({ value: status, label: status }));
    const eventTypeOptions = metadata.eventTypes.map((eventType) => ({ value: eventType, label: eventType }));

    const renderStatusBadge = (status: PaymentEntryStatus) => (
        <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", statusBadgeClassName(status))}>
            {status === "paid" ? t("paid") : t("unpaid")}
        </span>
    );

    const renderDesktopHeaderLabel = (column: TableColumnPreference, label: React.ReactNode) => {
        const resizeHandleProps = getResizeHandleProps(column.id);

        return (
            <div className={cn("relative flex min-w-0 items-center gap-2", column.id === "actions" && "justify-end")}>
                <span className="truncate">{label}</span>
                {isColumnResizable(column.id) && resizeHandleProps ? (
                    <button
                        type="button"
                        aria-label={`Resize ${column.label}`}
                        className={cn(
                            "absolute -right-3 top-1/2 h-8 w-6 -translate-y-1/2 touch-none select-none cursor-col-resize rounded transition-colors",
                            isColumnBeingResized(column.id)
                                ? "bg-primary/10"
                                : "hover:bg-muted-foreground/10",
                        )}
                        {...resizeHandleProps}
                    >
                        <span
                            className={cn(
                                "absolute left-1/2 top-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2 rounded-full",
                                isColumnBeingResized(column.id)
                                    ? "bg-primary"
                                    : "bg-border",
                            )}
                        />
                    </button>
                ) : null}
            </div>
        );
    };

    const renderDetailActions = (detail: PaymentDetail) => {
        const isUpdating = updatingIds.includes(detail.id);
        return (
            <div className="mt-4 flex items-center justify-start gap-2 border-t pt-3 md:mt-0 md:justify-end md:border-t-0 md:pt-0">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                        "h-9 w-9 gap-1.5 rounded-lg px-0 md:h-8 md:w-auto md:px-2",
                        detail.status === "paid"
                            ? "text-red-700 hover:text-red-700 dark:text-red-300"
                            : "text-emerald-700 hover:text-emerald-700 dark:text-emerald-300",
                    )}
                    disabled={isUpdating}
                    onClick={() => void setPaymentStatusForIds([detail.id], detail.status === "paid" ? "unpaid" : "paid")}
                >
                    {isUpdating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : detail.status === "paid" ? (
                        <XCircle className="h-3.5 w-3.5" />
                    ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden xl:inline">
                        {detail.status === "paid" ? t("markUnpaid") : t("markPaid")}
                    </span>
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 md:h-8 md:w-8 md:border-transparent md:bg-transparent md:text-foreground md:hover:bg-muted"
                    onClick={() =>
                        setEditDraft({
                            id: detail.id,
                            title: `${detail.bookingCode} - ${detail.clientName}`,
                            amount: formatRupiahInput(detail.amount),
                            notes: detail.notes,
                        })
                    }
                >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span className="sr-only">{t("edit")}</span>
                </Button>
                <Button asChild type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-lg border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300 md:h-8 md:w-8 md:border-transparent md:bg-transparent md:text-foreground md:hover:bg-muted">
                    <Link href={`/bookings/${detail.bookingId}`}>
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span className="sr-only">{t("openBooking")}</span>
                    </Link>
                </Button>
            </div>
        );
    };

    const renderDetailRow = (detail: PaymentDetail) => {
        const isSelected = selectedEntryIds.includes(detail.id);
        const detailCellClassName = "px-4 py-3 text-sm";
        const renderDetailCell = (column: TableColumnPreference) => {
            switch (column.id) {
                case "booking":
                    return (
                        <td
                            key={column.id}
                            data-column-id={column.id}
                            style={getColumnWidthStyle(column.id)}
                            className={detailCellClassName}
                        >
                            <div className="font-medium">{detail.bookingCode}</div>
                            <div className="text-xs text-muted-foreground">{detail.clientName}</div>
                        </td>
                    );
                case "event_type":
                    return <td key={column.id} data-column-id={column.id} style={getColumnWidthStyle(column.id)} className={detailCellClassName}>{detail.eventType}</td>;
                case "session_date":
                    return <td key={column.id} data-column-id={column.id} style={getColumnWidthStyle(column.id)} className={detailCellClassName}>{formatDate(detail.sessionDate, locale)}</td>;
                case "service":
                    return <td key={column.id} data-column-id={column.id} style={getColumnWidthStyle(column.id)} className={detailCellClassName}>{detail.serviceLabel}</td>;
                case "amount":
                    return <td key={column.id} data-column-id={column.id} style={getColumnWidthStyle(column.id)} className={cn(detailCellClassName, "font-medium")}>{formatSensitiveCurrency(detail.amount)}</td>;
                case "payment_status":
                    return <td key={column.id} data-column-id={column.id} style={getColumnWidthStyle(column.id)} className={detailCellClassName}>{renderStatusBadge(detail.status)}</td>;
                case "paid_at":
                    return <td key={column.id} data-column-id={column.id} style={getColumnWidthStyle(column.id)} className={detailCellClassName}>{formatDate(detail.paidAt, locale)}</td>;
                case "actions":
                    return <td key={column.id} data-column-id={column.id} style={getColumnWidthStyle(column.id)} className="px-4 py-3 text-right">{renderDetailActions(detail)}</td>;
                default:
                    return null;
            }
        };

        return (
            <tr
                key={detail.id}
                className={cn(
                    "border-b last:border-b-0",
                    isSelected
                        ? "border-l-4 border-l-amber-400 bg-amber-100/70 dark:border-l-amber-500 dark:bg-amber-500/15"
                        : "bg-transparent",
                )}
            >
                {isManageMode ? (
                    <td className="px-3 py-3">
                        <AppCheckbox
                            checked={isSelected}
                            onCheckedChange={() =>
                                setSelectedEntryIds((current) => toggleSelection(current, detail.id))
                            }
                            aria-label={t("selectDetail")}
                        />
                    </td>
                ) : null}
                {detailVisibleColumns.map(renderDetailCell)}
            </tr>
        );
    };

    return (
        <div className="space-y-6">
            <PageHeader
                actions={(
                    <>
                        <MoneyVisibilityToggle className="hidden w-full md:inline-flex md:w-auto" />
                        <Button
                            type="button"
                            className="hidden w-full gap-2 md:inline-flex md:w-auto"
                            disabled={queryState.isLoading || exporting}
                            onClick={() => { void exportTeamPayments(); }}
                        >
                            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            Export Excel
                        </Button>
                        <TableColumnManager
                            title={t("columnManagerTitle")}
                            description={t("columnManagerDescription")}
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
                    <p className="text-muted-foreground">{t("description")}</p>
                </div>
            </PageHeader>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-500/10">
                            <Users className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("summaryFreelancers")}</span>
                    </div>
                    <div className="text-2xl font-bold">{metadata.summary.totalGroups}</div>
                </div>
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-500/10">
                            <Briefcase className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("summaryJobs")}</span>
                    </div>
                    <div className="text-2xl font-bold">{metadata.summary.totalJobs}</div>
                </div>
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-500/10">
                            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("summaryUnpaid")}</span>
                    </div>
                    <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{metadata.summary.unpaidCount}</div>
                </div>
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-green-100 dark:bg-green-500/10">
                            <Wallet className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("summaryUnpaidTotal")}</span>
                    </div>
                    <div className="text-2xl font-bold">{formatSensitiveCurrency(metadata.summary.unpaidTotal)}</div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 max-[360px]:grid-cols-1 md:hidden">
                <MoneyVisibilityToggle className="w-full" />
                <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => handleColumnManagerOpenChange(true)}
                >
                    <Settings2 className="h-4 w-4" />
                    {t("manageColumns")}
                </Button>
                <Button
                    type="button"
                    className="col-span-2 w-full gap-2 max-[360px]:col-span-1"
                    disabled={queryState.isLoading || exporting}
                    onClick={() => { void exportTeamPayments(); }}
                >
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Export Excel
                </Button>
            </div>

            <div className="space-y-3">
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="relative min-w-0 flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            value={searchQuery}
                            onChange={(event) => {
                                setSearchQuery(event.target.value);
                                setQueryState((current) => ({ ...current, page: 1 }));
                            }}
                            placeholder={t("searchPlaceholder")}
                            className="h-9 w-full rounded-md border border-input bg-background/50 pl-9 pr-3 text-sm outline-none transition-all focus-visible:ring-1 focus-visible:ring-ring"
                        />
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        className="h-9 w-9 shrink-0 justify-center px-0 sm:w-auto sm:gap-2 sm:px-3"
                        onClick={() => setShowFilterPanel((current) => !current)}
                        aria-label={t("filterButton")}
                    >
                        <ListOrdered className="h-4 w-4" />
                        <span className="hidden sm:inline">{t("filterButton")}</span>
                    </Button>
                    <div className="hidden sm:flex sm:items-center sm:gap-2">
                        <FilterSingleSelect
                            value={sortOrder}
                            onChange={(nextValue) => {
                                setSortOrder(normalizeSortOrder(nextValue));
                                setQueryState((current) => ({ ...current, page: 1 }));
                            }}
                            options={sortOptions}
                            placeholder={t("sort")}
                            className="w-[260px]"
                            mobileTitle={t("sort")}
                        />
                        {hasActiveFilters ? (
                            <button
                                type="button"
                                onClick={resetFilters}
                                className="flex h-9 items-center justify-center gap-1.5 rounded-md border border-input bg-background/50 px-3 text-sm text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                            >
                                <X className="h-3.5 w-3.5" />
                                {t("resetFilters")}
                            </button>
                        ) : null}
                        <ManageActionToolbar
                            variant="payment-status"
                            isManageMode={isManageMode}
                            labels={{
                                manage: t("manage"),
                                selectAll: allVisibleSelected ? t("clearSelection") : t("selectAll"),
                                deleteSelected: "",
                                selectedCount: t("selectedCount", { count: selectedCount }),
                                closeManage: t("closeManage"),
                                markPaid: t("markPaid"),
                                markUnpaid: t("markUnpaid"),
                            }}
                            selectedCount={selectedCount}
                            onEnterManage={() => setIsManageMode(true)}
                            onToggleSelectAll={() =>
                                setSelectedEntryIds((current) => toggleSelectAllVisible(current, visibleEntryIds))
                            }
                            onMarkPaid={() => void setPaymentStatusForIds(selectedEntryIds, "paid")}
                            onMarkUnpaid={() => void setPaymentStatusForIds(selectedEntryIds, "unpaid")}
                            onCloseManage={() => {
                                setIsManageMode(false);
                                setSelectedEntryIds([]);
                            }}
                            selectAllDisabled={visibleEntryIds.length === 0}
                            markPaidDisabled={selectedCount === 0}
                            markUnpaidDisabled={selectedCount === 0}
                            className="hidden md:flex"
                        />
                    </div>
                </div>

                <ManageActionToolbar
                    variant="payment-status"
                    isManageMode={isManageMode}
                    labels={{
                        manage: t("manage"),
                        selectAll: allVisibleSelected ? t("clearSelection") : t("selectAll"),
                        deleteSelected: "",
                        selectedCount: t("selectedCount", { count: selectedCount }),
                        closeManage: t("closeManage"),
                        markPaid: t("markPaid"),
                        markUnpaid: t("markUnpaid"),
                    }}
                    selectedCount={selectedCount}
                    onEnterManage={() => setIsManageMode(true)}
                    onToggleSelectAll={() =>
                        setSelectedEntryIds((current) => toggleSelectAllVisible(current, visibleEntryIds))
                    }
                    onMarkPaid={() => void setPaymentStatusForIds(selectedEntryIds, "paid")}
                    onMarkUnpaid={() => void setPaymentStatusForIds(selectedEntryIds, "unpaid")}
                    onCloseManage={() => {
                        setIsManageMode(false);
                        setSelectedEntryIds([]);
                    }}
                    selectAllDisabled={visibleEntryIds.length === 0}
                    markPaidDisabled={selectedCount === 0}
                    markUnpaidDisabled={selectedCount === 0}
                    className="md:hidden"
                />

                <div className="flex w-full flex-col gap-2 sm:hidden">
                    <FilterSingleSelect
                        value={sortOrder}
                        onChange={(nextValue) => {
                            setSortOrder(normalizeSortOrder(nextValue));
                            setQueryState((current) => ({ ...current, page: 1 }));
                        }}
                        options={sortOptions}
                        placeholder={t("sort")}
                        className="w-full"
                        mobileTitle={t("sort")}
                    />
                    {hasActiveFilters ? (
                        <button
                            type="button"
                            onClick={resetFilters}
                            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-input bg-background/50 px-3 text-sm text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        >
                            <X className="h-3.5 w-3.5" />
                            {t("resetFilters")}
                        </button>
                    ) : null}
                </div>

                {showFilterPanel ? (
                    <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">{t("dateRange")}</label>
                                <BookingDateRangePicker
                                    value={{ from: dateFromFilter, to: dateToFilter }}
                                    onApply={({ from, to }) => {
                                        setDateFromFilter(from);
                                        setDateToFilter(to);
                                        setQueryState((current) => ({ ...current, page: 1 }));
                                    }}
                                    onClear={() => {
                                        setDateFromFilter("");
                                        setDateToFilter("");
                                        setQueryState((current) => ({ ...current, page: 1 }));
                                    }}
                                    locale={locale === "en" ? "en" : "id"}
                                    placeholder={t("dateRangePlaceholder")}
                                    applyLabel={t("apply")}
                                    clearLabel={t("clear")}
                                    startLabel={t("start")}
                                    endLabel={t("end")}
                                    mobileTitle={t("dateRange")}
                                    className="w-full"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">{t("dateBasis")}</label>
                                <FilterSingleSelect
                                    value={dateBasis}
                                    onChange={(nextValue) => {
                                        setDateBasis(normalizeDateBasis(nextValue));
                                        setQueryState((current) => ({ ...current, page: 1 }));
                                    }}
                                    options={dateBasisOptions}
                                    placeholder={t("dateBasis")}
                                    className="w-full"
                                    mobileTitle={t("dateBasis")}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">{t("paymentStatus")}</label>
                                <FilterSingleSelect
                                    value={paymentStatus}
                                    onChange={(nextValue) => {
                                        setPaymentStatus(normalizePaymentStatus(nextValue));
                                        setQueryState((current) => ({ ...current, page: 1 }));
                                    }}
                                    options={paymentStatusOptions}
                                    placeholder={t("paymentStatus")}
                                    className="w-full"
                                    mobileTitle={t("paymentStatus")}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">{t("role")}</label>
                                <FilterMultiSelect
                                    values={roleFilters}
                                    onChange={(values) => {
                                        setRoleFilters(values);
                                        setQueryState((current) => ({ ...current, page: 1 }));
                                    }}
                                    options={roleOptions}
                                    placeholder={t("allRoles")}
                                    allLabel={t("allRoles")}
                                    countSuffix={t("selectedSuffix")}
                                    className="w-full"
                                    mobileTitle={t("role")}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">{t("eventType")}</label>
                                <FilterMultiSelect
                                    values={eventTypeFilters}
                                    onChange={(values) => {
                                        setEventTypeFilters(values);
                                        setQueryState((current) => ({ ...current, page: 1 }));
                                    }}
                                    options={eventTypeOptions}
                                    placeholder={t("allEventTypes")}
                                    allLabel={t("allEventTypes")}
                                    countSuffix={t("selectedSuffix")}
                                    className="w-full"
                                    mobileTitle={t("eventType")}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">{t("bookingStatus")}</label>
                                <FilterMultiSelect
                                    values={bookingStatusFilters}
                                    onChange={(values) => {
                                        setBookingStatusFilters(values);
                                        setQueryState((current) => ({ ...current, page: 1 }));
                                    }}
                                    options={bookingStatusOptions}
                                    placeholder={t("allBookingStatuses")}
                                    allLabel={t("allBookingStatuses")}
                                    countSuffix={t("selectedSuffix")}
                                    className="w-full"
                                    mobileTitle={t("bookingStatus")}
                                />
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>

            <div className="md:hidden space-y-3">
                {queryState.isLoading ? (
                    <CardListSkeleton count={Math.min(queryState.perPage, 4)} />
                ) : groups.length === 0 ? (
                    <div className="rounded-lg border py-12 text-center text-sm text-muted-foreground">{t("empty")}</div>
                ) : groups.map((group) => {
                    const isExpanded = expandedGroupIds.includes(group.freelanceId);
                    const groupEntryIds = group.details.map((detail) => detail.id);
                    const selectedInGroup = groupEntryIds.filter((id) => selectedEntryIds.includes(id));
                    const isGroupHighlighted = isExpanded || selectedInGroup.length > 0;
                    const checkedState = selectedInGroup.length === 0
                        ? false
                        : selectedInGroup.length === groupEntryIds.length
                            ? true
                            : "indeterminate";
                    return (
                        <div
                            key={group.freelanceId}
                            className={cn(
                                "overflow-hidden rounded-xl border bg-card shadow-sm",
                                isGroupHighlighted && "border-amber-200 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-500/10",
                            )}
                        >
                            <div className="flex items-start gap-3 p-4">
                                {isManageMode ? (
                                    <AppCheckbox
                                        checked={checkedState}
                                        onCheckedChange={() =>
                                            setSelectedEntryIds((current) => {
                                                const allSelected = groupEntryIds.every((id) => current.includes(id));
                                                return allSelected
                                                    ? current.filter((id) => !groupEntryIds.includes(id))
                                                    : Array.from(new Set([...current, ...groupEntryIds]));
                                            })
                                        }
                                        aria-label={t("selectGroup")}
                                        className="mt-1"
                                    />
                                ) : null}
                                <button
                                    type="button"
                                    className="min-w-0 flex-1 text-left"
                                    onClick={() => toggleExpanded(group.freelanceId)}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex min-w-0 items-start gap-2">
                                            {isExpanded ? <ChevronDown className="mt-1 h-4 w-4" /> : <ChevronRight className="mt-1 h-4 w-4" />}
                                            <div className="min-w-0">
                                                <p className="truncate text-base font-semibold">{group.freelanceName}</p>
                                                <p className="text-sm text-muted-foreground">{group.role || "-"}</p>
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <p className="text-xs text-muted-foreground">{t("summaryUnpaidTotal")}</p>
                                            <p className="text-sm font-bold">{formatSensitiveCurrency(group.unpaidTotal)}</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-3 text-sm">
                                        <div>
                                            <p className="text-muted-foreground">{t("jobs")}</p>
                                            <p className="font-semibold">{group.totalJobs}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">{t("unpaid")}</p>
                                            <p className="font-semibold text-amber-700 dark:text-amber-300">{group.unpaidCount}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">{t("paid")}</p>
                                            <p className="font-semibold text-emerald-700 dark:text-emerald-300">{group.paidCount}</p>
                                        </div>
                                    </div>
                                </button>
                            </div>
                            {isExpanded ? (
                                <div className="space-y-3 border-t p-3">
                                    {group.details.map((detail) => (
                                        <div
                                            key={detail.id}
                                            className={cn(
                                                "rounded-xl border bg-background p-4 shadow-sm",
                                                selectedEntryIds.includes(detail.id) && "border-l-4 border-l-amber-400 bg-amber-50/80 dark:border-l-amber-500 dark:bg-amber-500/10",
                                            )}
                                        >
                                            <div className="flex items-start gap-3">
                                                {isManageMode ? (
                                                    <AppCheckbox
                                                        checked={selectedEntryIds.includes(detail.id)}
                                                        onCheckedChange={() =>
                                                            setSelectedEntryIds((current) => toggleSelection(current, detail.id))
                                                        }
                                                        aria-label={t("selectDetail")}
                                                        className="mt-1"
                                                    />
                                                ) : null}
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-base font-semibold">{detail.bookingCode}</p>
                                                    <p className="text-sm text-muted-foreground">{detail.clientName}</p>
                                                </div>
                                                {renderStatusBadge(detail.status)}
                                            </div>
                                            <div className="mt-4 space-y-2 border-t pt-3 text-sm">
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-muted-foreground">{t("eventType")}</span>
                                                    <span className="text-right font-medium">{detail.eventType}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-muted-foreground">{t("sessionDate")}</span>
                                                    <span className="text-right font-medium">{formatDate(detail.sessionDate, locale)}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-muted-foreground">{t("service")}</span>
                                                    <span className="text-right font-medium">{detail.serviceLabel}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-muted-foreground">{t("amount")}</span>
                                                    <span className="text-right font-bold">{formatSensitiveCurrency(detail.amount)}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-muted-foreground">{t("paidAt")}</span>
                                                    <span className="text-right font-medium">{formatDate(detail.paidAt, locale)}</span>
                                                </div>
                                            </div>
                                            {renderDetailActions(detail)}
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>

            <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
                <div className="overflow-x-auto">
                    <table className="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
                        <thead className="border-b bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <tr>
                                {isManageMode ? <th className="w-12 px-3 py-3" /> : null}
                                {groupVisibleColumns.map((column) => (
                                    <th
                                        key={column.id}
                                        data-column-id={column.id}
                                        style={getColumnWidthStyle(column.id)}
                                        className={cn(
                                            "px-4 py-3",
                                            column.id === "actions" && "text-right",
                                        )}
                                    >
                                        {renderDesktopHeaderLabel(column, column.label)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {queryState.isLoading ? (
                                <TableRowsSkeleton rows={Math.min(queryState.perPage, 8)} columns={Math.max(tableColSpan, 1)} />
                            ) : groups.length === 0 ? (
                                <tr>
                                    <td colSpan={Math.max(tableColSpan, 1)} className="px-4 py-12 text-center text-muted-foreground">
                                        {t("empty")}
                                    </td>
                                </tr>
                            ) : groups.map((group) => {
                                const isExpanded = expandedGroupIds.includes(group.freelanceId);
                                const groupEntryIds = group.details.map((detail) => detail.id);
                                const selectedInGroup = groupEntryIds.filter((id) => selectedEntryIds.includes(id));
                                const isGroupHighlighted = isExpanded || selectedInGroup.length > 0;
                                const checkedState = selectedInGroup.length === 0
                                    ? false
                                    : selectedInGroup.length === groupEntryIds.length
                                        ? true
                                        : "indeterminate";
                                const renderGroupCell = (column: TableColumnPreference) => {
                                    switch (column.id) {
                                        case "name":
                                            return (
                                                <td
                                                    key={column.id}
                                                    data-column-id={column.id}
                                                    style={getColumnWidthStyle(column.id)}
                                                    className="px-4 py-4"
                                                >
                                                    <button
                                                        type="button"
                                                        className="flex min-w-0 items-center gap-2 text-left"
                                                        onClick={() => toggleExpanded(group.freelanceId)}
                                                    >
                                                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                        <span>
                                                            <span className="block font-semibold">{group.freelanceName}</span>
                                                            <span className="block text-xs text-muted-foreground">{group.role || "-"}</span>
                                                        </span>
                                                    </button>
                                                </td>
                                            );
                                        case "jobs":
                                            return <td key={column.id} data-column-id={column.id} style={getColumnWidthStyle(column.id)} className="px-4 py-4">{group.totalJobs}</td>;
                                        case "paid_count":
                                            return <td key={column.id} data-column-id={column.id} style={getColumnWidthStyle(column.id)} className="px-4 py-4">{group.paidCount}</td>;
                                        case "unpaid_count":
                                            return <td key={column.id} data-column-id={column.id} style={getColumnWidthStyle(column.id)} className="px-4 py-4">{group.unpaidCount}</td>;
                                        case "unpaid_total":
                                            return <td key={column.id} data-column-id={column.id} style={getColumnWidthStyle(column.id)} className="px-4 py-4 font-semibold">{formatSensitiveCurrency(group.unpaidTotal)}</td>;
                                        case "actions":
                                            return (
                                                <td key={column.id} data-column-id={column.id} style={getColumnWidthStyle(column.id)} className="px-4 py-4 text-right">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="gap-1.5"
                                                        onClick={() => toggleExpanded(group.freelanceId)}
                                                    >
                                                        {isExpanded ? t("hideDetails") : t("showDetails")}
                                                    </Button>
                                                </td>
                                            );
                                        default:
                                            return null;
                                    }
                                };
                                return (
                                    <React.Fragment key={group.freelanceId}>
                                        <tr
                                            className={cn(
                                                "border-b",
                                                isGroupHighlighted
                                                    ? "bg-amber-50/80 dark:bg-amber-500/10"
                                                    : "hover:bg-muted/30",
                                            )}
                                        >
                                            {isManageMode ? (
                                                <td className="px-3 py-4">
                                                    <AppCheckbox
                                                        checked={checkedState}
                                                        onCheckedChange={() =>
                                                            setSelectedEntryIds((current) => {
                                                                const allSelected = groupEntryIds.every((id) => current.includes(id));
                                                                return allSelected
                                                                    ? current.filter((id) => !groupEntryIds.includes(id))
                                                                    : Array.from(new Set([...current, ...groupEntryIds]));
                                                            })
                                                        }
                                                        aria-label={t("selectGroup")}
                                                    />
                                                </td>
                                            ) : null}
                                            {groupVisibleColumns.map(renderGroupCell)}
                                        </tr>
                                        {isExpanded ? (
                                            <tr>
                                                <td
                                                    colSpan={Math.max(tableColSpan, 1)}
                                                    className="bg-amber-50/80 p-0 dark:bg-amber-500/10"
                                                >
                                                    <div className="ml-10 border-l border-amber-200/80 dark:border-amber-500/20">
                                                        <table className="w-max min-w-full border-separate border-spacing-0 text-left">
                                                            <thead className="border-b border-amber-100/80 bg-transparent text-xs text-muted-foreground dark:border-amber-500/20">
                                                                <tr>
                                                                    {isManageMode ? <th className="w-12 px-3 py-2" /> : null}
                                                                    {detailVisibleColumns.map((column) => (
                                                                        <th
                                                                            key={column.id}
                                                                            data-column-id={column.id}
                                                                            style={getColumnWidthStyle(column.id)}
                                                                            className={cn(
                                                                                "px-4 py-2",
                                                                                column.id === "actions" && "text-right",
                                                                            )}
                                                                        >
                                                                            {renderDesktopHeaderLabel(column, column.label)}
                                                                        </th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>{group.details.map(renderDetailRow)}</tbody>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : null}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <TablePagination
                totalItems={queryState.totalItems}
                currentPage={queryState.page}
                itemsPerPage={queryState.perPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                perPageOptions={[...PAYMENT_PER_PAGE_OPTIONS]}
            />

            <Dialog open={Boolean(editDraft)} onOpenChange={(open) => !open && setEditDraft(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t("editPayment")}</DialogTitle>
                    </DialogHeader>
                    {editDraft ? (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">{editDraft.title}</p>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">{t("amount")}</label>
                                <input
                                    value={editDraft.amount}
                                    onChange={(event) =>
                                        setEditDraft((current) =>
                                            current
                                                ? {
                                                    ...current,
                                                    amount: formatRupiahInput(parseRupiahInput(event.target.value)),
                                                }
                                                : current,
                                        )
                                    }
                                    inputMode="numeric"
                                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">{t("notes")}</label>
                                <textarea
                                    value={editDraft.notes}
                                    onChange={(event) =>
                                        setEditDraft((current) => current ? { ...current, notes: event.target.value } : current)
                                    }
                                    rows={3}
                                    className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                            </div>
                        </div>
                    ) : null}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setEditDraft(null)}>
                            {t("cancel")}
                        </Button>
                        <Button type="button" onClick={() => void saveEditDraft()} disabled={updatingIds.length > 0}>
                            {updatingIds.length > 0 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {t("save")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(feedback)} onOpenChange={(open) => !open && setFeedback("")}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t("notice")}</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">{feedback}</p>
                    <DialogFooter>
                        <Button type="button" onClick={() => setFeedback("")}>{t("close")}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
