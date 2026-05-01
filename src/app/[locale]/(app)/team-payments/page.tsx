"use client";

import * as React from "react";
import {
    ChevronDown,
    ChevronRight,
    CheckCircle2,
    Edit2,
    ExternalLink,
    HandCoins,
    ListOrdered,
    Loader2,
    Search,
    X,
    XCircle,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { AppCheckbox } from "@/components/ui/app-checkbox";
import { Button } from "@/components/ui/button";
import { CardListSkeleton, TableRowsSkeleton } from "@/components/ui/data-skeletons";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { FilterSingleSelect } from "@/components/ui/filter-single-select";
import { BookingDateRangePicker } from "@/components/ui/booking-date-range-picker";
import { ManageActionToolbar } from "@/components/ui/manage-action-toolbar";
import { PageHeader } from "@/components/ui/page-header";
import { TablePagination } from "@/components/ui/table-pagination";
import { fetchPaginatedJson } from "@/lib/pagination/http";
import type { PaginatedQueryState } from "@/lib/pagination/types";
import {
    areAllVisibleSelected,
    pruneSelection,
    toggleSelectAllVisible,
    toggleSelection,
} from "@/lib/manage-selection";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";

type PaymentEntryStatus = "unpaid" | "paid";
type PaymentStatusFilter = "all" | PaymentEntryStatus;
type SortOrder = "booking_newest" | "booking_oldest" | "session_newest" | "session_oldest";
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
const EMPTY_METADATA: PaymentMetadata = {
    roles: [],
    bookingStatuses: [],
    eventTypes: [],
    summary: {
        totalGroups: 0,
        totalJobs: 0,
        paidCount: 0,
        unpaidCount: 0,
        unpaidTotal: 0,
    },
};

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
    const [groups, setGroups] = React.useState<PaymentGroup[]>([]);
    const [metadata, setMetadata] = React.useState<PaymentMetadata>(EMPTY_METADATA);
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

    React.useEffect(() => {
        const timeout = window.setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timeout);
    }, [searchQuery]);

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

    const fetchPayments = React.useCallback(async (mode: "loading" | "refreshing" = "refreshing") => {
        if (!filtersHydrated) return;
        setQueryState((current) => ({
            ...current,
            isLoading: mode === "loading",
            isRefreshing: mode === "refreshing",
        }));

        const params = new URLSearchParams({
            page: String(queryState.page),
            perPage: String(queryState.perPage),
            search: debouncedSearchQuery,
            paymentStatus,
            roleFilters: JSON.stringify(roleFilters),
            bookingStatusFilters: JSON.stringify(bookingStatusFilters),
            eventTypeFilters: JSON.stringify(eventTypeFilters),
            dateFrom: dateFromFilter,
            dateTo: dateToFilter,
            dateBasis,
            sort: sortOrder,
        });

        try {
            const response = await fetchPaginatedJson<PaymentGroup, PaymentMetadata>(
                `/api/internal/freelance-payments?${params.toString()}`,
            );
            setGroups(response.items);
            setMetadata(response.metadata || EMPTY_METADATA);
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
        bookingStatusFilters,
        dateBasis,
        dateFromFilter,
        dateToFilter,
        debouncedSearchQuery,
        eventTypeFilters,
        filtersHydrated,
        paymentStatus,
        queryState.page,
        queryState.perPage,
        roleFilters,
        sortOrder,
        t,
    ]);

    React.useEffect(() => {
        void fetchPayments(queryState.totalItems === 0 ? "loading" : "refreshing");
    }, [fetchPayments, queryState.totalItems]);

    const visibleEntryIds = React.useMemo(
        () => groups.flatMap((group) => group.details.map((detail) => detail.id)),
        [groups],
    );

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
    ];
    const roleOptions = metadata.roles.map((role) => ({ value: role, label: role }));
    const bookingStatusOptions = metadata.bookingStatuses.map((status) => ({ value: status, label: status }));
    const eventTypeOptions = metadata.eventTypes.map((eventType) => ({ value: eventType, label: eventType }));

    const renderStatusBadge = (status: PaymentEntryStatus) => (
        <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", statusBadgeClassName(status))}>
            {status === "paid" ? t("paid") : t("unpaid")}
        </span>
    );

    const renderDetailActions = (detail: PaymentDetail) => {
        const isUpdating = updatingIds.includes(detail.id);
        return (
            <div className="flex items-center justify-end gap-1.5">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 px-2"
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
                    className="h-8 w-8"
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
                <Button asChild type="button" variant="ghost" size="icon" className="h-8 w-8">
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
        return (
            <tr key={detail.id} className="border-b bg-muted/20 last:border-b-0">
                <td className="px-3 py-3">
                    {isManageMode ? (
                        <AppCheckbox
                            checked={isSelected}
                            onCheckedChange={() =>
                                setSelectedEntryIds((current) => toggleSelection(current, detail.id))
                            }
                            aria-label={t("selectDetail")}
                        />
                    ) : null}
                </td>
                <td className="px-4 py-3 text-sm">
                    <div className="font-medium">{detail.bookingCode}</div>
                    <div className="text-xs text-muted-foreground">{detail.clientName}</div>
                </td>
                <td className="px-4 py-3 text-sm">{detail.eventType}</td>
                <td className="px-4 py-3 text-sm">{formatDate(detail.sessionDate, locale)}</td>
                <td className="px-4 py-3 text-sm">{detail.serviceLabel}</td>
                <td className="px-4 py-3 text-sm font-medium">{formatCurrency(detail.amount)}</td>
                <td className="px-4 py-3 text-sm">{renderStatusBadge(detail.status)}</td>
                <td className="px-4 py-3 text-sm">{formatDate(detail.paidAt, locale)}</td>
                <td className="px-4 py-3 text-right">{renderDetailActions(detail)}</td>
            </tr>
        );
    };

    return (
        <div className="space-y-6">
            <PageHeader>
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <HandCoins className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="truncate text-2xl font-semibold tracking-tight">{t("title")}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
                    </div>
                </div>
            </PageHeader>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border bg-card p-4">
                    <p className="text-xs font-medium text-muted-foreground">{t("summaryFreelancers")}</p>
                    <p className="mt-1 text-2xl font-semibold">{metadata.summary.totalGroups}</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                    <p className="text-xs font-medium text-muted-foreground">{t("summaryJobs")}</p>
                    <p className="mt-1 text-2xl font-semibold">{metadata.summary.totalJobs}</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                    <p className="text-xs font-medium text-muted-foreground">{t("summaryUnpaid")}</p>
                    <p className="mt-1 text-2xl font-semibold text-amber-700 dark:text-amber-300">{metadata.summary.unpaidCount}</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                    <p className="text-xs font-medium text-muted-foreground">{t("summaryUnpaidTotal")}</p>
                    <p className="mt-1 text-2xl font-semibold">{formatCurrency(metadata.summary.unpaidTotal)}</p>
                </div>
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
                    const checkedState = selectedInGroup.length === 0
                        ? false
                        : selectedInGroup.length === groupEntryIds.length
                            ? true
                            : "indeterminate";
                    return (
                        <div key={group.freelanceId} className="overflow-hidden rounded-lg border bg-card">
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
                                    <div className="flex items-center gap-2">
                                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold">{group.freelanceName}</p>
                                            <p className="text-xs text-muted-foreground">{group.role || "-"}</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                        <span>{t("jobsCount", { count: group.totalJobs })}</span>
                                        <span>{t("unpaidCount", { count: group.unpaidCount })}</span>
                                        <span>{t("paidCount", { count: group.paidCount })}</span>
                                        <span className="font-semibold">{formatCurrency(group.unpaidTotal)}</span>
                                    </div>
                                </button>
                            </div>
                            {isExpanded ? (
                                <div className="border-t">
                                    {group.details.map((detail) => (
                                        <div key={detail.id} className="space-y-3 border-b p-4 last:border-b-0">
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
                                                    <p className="text-sm font-semibold">{detail.bookingCode}</p>
                                                    <p className="text-xs text-muted-foreground">{detail.clientName}</p>
                                                </div>
                                                {renderStatusBadge(detail.status)}
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                                <span>{detail.eventType}</span>
                                                <span>{formatDate(detail.sessionDate, locale)}</span>
                                                <span className="col-span-2">{detail.serviceLabel}</span>
                                                <span className="font-semibold text-foreground">{formatCurrency(detail.amount)}</span>
                                                <span>{formatDate(detail.paidAt, locale)}</span>
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
                    <table className="w-full min-w-[1120px] text-left text-sm">
                        <thead className="border-b bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <tr>
                                <th className="w-12 px-3 py-3" />
                                <th className="px-4 py-3">{t("freelance")}</th>
                                <th className="px-4 py-3">{t("jobs")}</th>
                                <th className="px-4 py-3">{t("paid")}</th>
                                <th className="px-4 py-3">{t("unpaid")}</th>
                                <th className="px-4 py-3">{t("unpaidTotal")}</th>
                                <th className="px-4 py-3 text-right">{t("actions")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {queryState.isLoading ? (
                                <TableRowsSkeleton rows={Math.min(queryState.perPage, 8)} columns={7} />
                            ) : groups.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                                        {t("empty")}
                                    </td>
                                </tr>
                            ) : groups.map((group) => {
                                const isExpanded = expandedGroupIds.includes(group.freelanceId);
                                const groupEntryIds = group.details.map((detail) => detail.id);
                                const selectedInGroup = groupEntryIds.filter((id) => selectedEntryIds.includes(id));
                                const checkedState = selectedInGroup.length === 0
                                    ? false
                                    : selectedInGroup.length === groupEntryIds.length
                                        ? true
                                        : "indeterminate";
                                return (
                                    <React.Fragment key={group.freelanceId}>
                                        <tr className="border-b hover:bg-muted/30">
                                            <td className="px-3 py-4">
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
                                                    />
                                                ) : null}
                                            </td>
                                            <td className="px-4 py-4">
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
                                            <td className="px-4 py-4">{group.totalJobs}</td>
                                            <td className="px-4 py-4">{group.paidCount}</td>
                                            <td className="px-4 py-4">{group.unpaidCount}</td>
                                            <td className="px-4 py-4 font-semibold">{formatCurrency(group.unpaidTotal)}</td>
                                            <td className="px-4 py-4 text-right">
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
                                        </tr>
                                        {isExpanded ? (
                                            <tr>
                                                <td colSpan={7} className="p-0">
                                                    <table className="w-full text-left">
                                                        <thead className="border-b bg-muted/20 text-xs text-muted-foreground">
                                                            <tr>
                                                                <th className="w-12 px-3 py-2" />
                                                                <th className="px-4 py-2">{t("booking")}</th>
                                                                <th className="px-4 py-2">{t("eventType")}</th>
                                                                <th className="px-4 py-2">{t("sessionDate")}</th>
                                                                <th className="px-4 py-2">{t("service")}</th>
                                                                <th className="px-4 py-2">{t("amount")}</th>
                                                                <th className="px-4 py-2">{t("paymentStatus")}</th>
                                                                <th className="px-4 py-2">{t("paidAt")}</th>
                                                                <th className="px-4 py-2 text-right">{t("actions")}</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>{group.details.map(renderDetailRow)}</tbody>
                                                    </table>
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
