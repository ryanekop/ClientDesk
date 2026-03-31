"use client";

import * as React from "react";
import { createClient } from "@/utils/supabase/client";
import { Activity, Copy, ClipboardCheck, ExternalLink, Search } from "lucide-react";
import { ActionIconButton } from "@/components/ui/action-icon-button";
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
import { useTranslations, useLocale } from "next-intl";
import { TableColumnManager } from "@/components/ui/table-column-manager";
import { PageHeader } from "@/components/ui/page-header";
import { FilterSingleSelect } from "@/components/ui/filter-single-select";
import {
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
    type BookingServiceSelection,
} from "@/lib/booking-services";
import type { FormLayoutItem } from "@/components/form-builder/booking-form-layout";
import {
    CANCELLED_BOOKING_STATUS,
    DEFAULT_CLIENT_STATUSES,
    getBookingStatusOptions,
} from "@/lib/client-status";
import {
    isTransitionToCancelled,
    syncGoogleCalendarForStatusTransition,
} from "@/utils/google-calendar-status-sync";
import { buildCancelPaymentPatch, type CancelPaymentPolicy } from "@/lib/cancel-payment";
import { buildAutoDpVerificationPatch } from "@/lib/final-settlement";
import { CardListSkeleton, TableRowsSkeleton } from "@/components/ui/data-skeletons";
import { fetchPaginatedJson } from "@/lib/pagination/http";
import type { PaginatedQueryState } from "@/lib/pagination/types";

type BookingStatus = {
    id: string;
    booking_code: string;
    client_name: string;
    client_whatsapp: string | null;
    session_date: string | null;
    status: string;
    client_status: string | null;
    queue_position: number | null;
    dp_paid?: number | null;
    dp_verified_amount?: number | null;
    dp_verified_at?: string | null;
    dp_refund_amount?: number | null;
    dp_refunded_at?: string | null;
    tracking_uuid: string | null;
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

const BASE_CLIENT_STATUS_COLUMNS: TableColumnPreference[] = [
    { id: "name", label: "Nama", visible: true, locked: true, pin: "left" },
    { id: "package", label: "Paket", visible: true },
    { id: "event_type", label: "Jenis Acara", visible: false },
    { id: "status", label: "Status", visible: true },
    { id: "queue", label: "Antrian", visible: true },
    { id: "actions", label: "Aksi", visible: true, locked: true, pin: "right" },
];
const CLIENT_STATUS_ITEMS_PER_PAGE_STORAGE_PREFIX = "clientdesk:client_status:items_per_page";
const CLIENT_STATUS_PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;
const CLIENT_STATUS_DEFAULT_ITEMS_PER_PAGE = 10;

function normalizeClientStatusItemsPerPage(value: unknown) {
    const parsed = typeof value === "number" ? value : Number(value);
    return CLIENT_STATUS_PER_PAGE_OPTIONS.includes(
        parsed as (typeof CLIENT_STATUS_PER_PAGE_OPTIONS)[number],
    )
        ? parsed
        : CLIENT_STATUS_DEFAULT_ITEMS_PER_PAGE;
}

export default function ClientStatusPage() {
    const supabase = createClient();
    const t = useTranslations("ClientStatus");
    const locale = useLocale(); const [bookings, setBookings] = React.useState<BookingStatus[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [filter, setFilter] = React.useState("");
    const [search, setSearch] = React.useState("");
    const [copiedId, setCopiedId] = React.useState<string | null>(null);
    const [savingId, setSavingId] = React.useState<string | null>(null);
    const [currentPage, setCurrentPage] = React.useState(1);
    const [itemsPerPage, setItemsPerPage] = React.useState(10);
    const [itemsPerPageHydrated, setItemsPerPageHydrated] = React.useState(false);
    const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
    const [clientStatuses, setClientStatuses] = React.useState<string[]>(DEFAULT_CLIENT_STATUSES);
    const [queueTriggerStatus, setQueueTriggerStatus] = React.useState("Antrian Edit");
    const [dpVerifyTriggerStatus, setDpVerifyTriggerStatus] = React.useState("");
    const [columns, setColumns] = React.useState<TableColumnPreference[]>(lockBoundaryColumns(BASE_CLIENT_STATUS_COLUMNS));
    const [columnManagerOpen, setColumnManagerOpen] = React.useState(false);
    const [savingColumns, setSavingColumns] = React.useState(false);
    const [formSectionsByEventType, setFormSectionsByEventType] = React.useState<Record<string, FormLayoutItem[]>>({});
    const [metadataRows, setMetadataRows] = React.useState<Array<{ event_type?: string | null; extra_fields?: Record<string, unknown> | null }>>([]);
    const [totalItems, setTotalItems] = React.useState(0);
    const [cancelStatusConfirm, setCancelStatusConfirm] = React.useState<{
        open: boolean;
        booking: BookingStatus | null;
        nextStatus: string;
    }>({ open: false, booking: null, nextStatus: "" });
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

    const showFeedback = React.useCallback((message: string, title?: string) => {
        setFeedbackDialog({
            open: true,
            title: title || (locale === "en" ? "Information" : "Informasi"),
            message,
        });
    }, [locale]);

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

    const statusColors = React.useMemo(() => {
        const map: Record<string, string> = {};
        clientStatuses.forEach((s, i) => { map[s] = STATUS_COLOR_PALETTE[i % STATUS_COLOR_PALETTE.length]; });
        map[CANCELLED_BOOKING_STATUS] = "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400";
        return map;
    }, [clientStatuses]);
    const fetchBookingsPage = React.useCallback(async (mode: "initial" | "refresh" = "refresh") => {
        if (!itemsPerPageHydrated) return;

        if (mode === "initial") {
            setLoading(true);
        } else {
            setRefreshing(true);
        }

        try {
            const params = new URLSearchParams({
                page: String(currentPage),
                perPage: String(itemsPerPage),
            });

            if (search.trim()) {
                params.set("search", search.trim());
            }

            if (filter) {
                params.set("status", filter);
            }

            const response = await fetchPaginatedJson<BookingStatus, ClientStatusPageMetadata>(
                `/api/internal/client-status?${params.toString()}`,
            );
            setBookings(response.items);
            setTotalItems(response.totalItems);
            setClientStatuses(response.metadata?.clientStatuses || DEFAULT_CLIENT_STATUSES);
            setQueueTriggerStatus(response.metadata?.queueTriggerStatus || "Antrian Edit");
            setDpVerifyTriggerStatus(response.metadata?.dpVerifyTriggerStatus || "");
            setFormSectionsByEventType(response.metadata?.formSectionsByEventType || {});
            setMetadataRows(response.metadata?.metadataRows || []);

            const nextColumnDefaults = lockBoundaryColumns([
                ...BASE_CLIENT_STATUS_COLUMNS.slice(0, -1),
                ...buildBookingMetadataColumns(
                    response.metadata?.metadataRows || [],
                    response.metadata?.formSectionsByEventType || {},
                ),
                BASE_CLIENT_STATUS_COLUMNS[BASE_CLIENT_STATUS_COLUMNS.length - 1],
            ]);
            setColumns(
                mergeTableColumnPreferences(
                    nextColumnDefaults,
                    response.metadata?.tableColumnPreferences || undefined,
                ),
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [currentPage, filter, itemsPerPage, itemsPerPageHydrated, search]);

    React.useEffect(() => {
        async function hydrateCurrentUser() {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUserId(user?.id || null);
        }

        void hydrateCurrentUser();
    }, [supabase]);

    React.useEffect(() => {
        if (!itemsPerPageHydrated) return;
        const mode = hasLoadedBookingsRef.current ? "refresh" : "initial";
        hasLoadedBookingsRef.current = true;
        void fetchBookingsPage(mode);
    }, [fetchBookingsPage, itemsPerPageHydrated]);

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
        if (!currentUserId || !itemsPerPageHydrated) return;
        const storageKey = `${CLIENT_STATUS_ITEMS_PER_PAGE_STORAGE_PREFIX}:${currentUserId}`;
        try {
            window.localStorage.setItem(storageKey, String(normalizeClientStatusItemsPerPage(itemsPerPage)));
        } catch {
            // Ignore storage write failures.
        }
    }, [currentUserId, itemsPerPage, itemsPerPageHydrated]);

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
        const nextDefaults = lockBoundaryColumns([
            ...BASE_CLIENT_STATUS_COLUMNS.slice(0, -1),
            ...buildBookingMetadataColumns(metadataRows, formSectionsByEventType),
            BASE_CLIENT_STATUS_COLUMNS[BASE_CLIENT_STATUS_COLUMNS.length - 1],
        ]);
        setColumns((current) => mergeTableColumnPreferences(nextDefaults, current));
    }, [formSectionsByEventType, metadataRows]);

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
        const wasQueue = queueTriggerStatus && oldBooking.client_status === queueTriggerStatus;
        const isQueue = queueTriggerStatus && clientStatus === queueTriggerStatus;
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
            if (isQueue && !wasQueue) {
                const { data: queueRows } = await supabase
                    .from("bookings")
                    .select("queue_position")
                    .eq("client_status", queueTriggerStatus)
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
                    .eq("id", id);
                if (error) {
                    showFeedback(t("failedUpdateStatus"));
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
                    .eq("id", id);
                if (error) {
                    showFeedback(t("failedUpdateStatus"));
                    return;
                }

                const { data: remainingRows } = await supabase
                    .from("bookings")
                    .select("id, queue_position, booking_code, tracking_uuid")
                    .eq("client_status", queueTriggerStatus)
                    .neq("id", id)
                    .not("queue_position", "is", null)
                    .order("queue_position", { ascending: true });
                const remaining = ((remainingRows || []) as Array<{
                    id: string;
                    queue_position?: number | null;
                    booking_code?: string | null;
                    tracking_uuid?: string | null;
                }>);
                for (let i = 0; i < remaining.length; i += 1) {
                    await supabase.from("bookings").update({ queue_position: i + 1 }).eq("id", remaining[i].id);
                    pushInvalidationTarget({
                        bookingCode: remaining[i].booking_code || null,
                        trackingUuid: remaining[i].tracking_uuid || null,
                    });
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
                    .eq("id", id);
                if (error) {
                    showFeedback(t("failedUpdateStatus"));
                    return;
                }
            }

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
    }, [filter, search, itemsPerPage]);

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
    const {
        tableRef,
        getStickyColumnStyle,
        getStickyColumnClassName,
    } = useStickyTableColumns(orderedVisibleColumns);
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
    const statusOptions = React.useMemo(
        () => getBookingStatusOptions(clientStatuses),
        [clientStatuses],
    );
    const topStatusFilterOptions = React.useMemo(
        () => [{ value: "", label: "Semua" }, ...statusOptions.map((status) => ({ value: status, label: status }))],
        [statusOptions],
    );
    const statusSelectOptions = React.useMemo(
        () => [{ value: "", label: t("belumDiset") }, ...statusOptions.map((status) => ({ value: status, label: status }))],
        [statusOptions, t],
    );
    const hasActiveFilters = Boolean(filter) || search.trim().length > 0;
    const queryState = React.useMemo<PaginatedQueryState>(() => ({
        page: currentPage,
        perPage: itemsPerPage,
        totalItems,
        isLoading: loading,
        isRefreshing: refreshing,
    }), [currentPage, itemsPerPage, totalItems, loading, refreshing]);

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
            "client_status",
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

    function renderDesktopHeader(column: TableColumnPreference) {
        switch (column.id) {
            case "name":
                return <th key={column.id} data-column-id={column.id} style={getStickyColumnStyle(column.id, { header: true })} className={getDesktopHeaderClassName(column.id, "px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap")}>{locale === "en" ? "Client" : "Klien"}</th>;
            case "package":
                return <th key={column.id} data-column-id={column.id} style={getStickyColumnStyle(column.id, { header: true })} className={getDesktopHeaderClassName(column.id, "px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap hidden sm:table-cell")}>{locale === "en" ? "Package" : "Paket"}</th>;
            case "event_type":
                return <th key={column.id} data-column-id={column.id} style={getStickyColumnStyle(column.id, { header: true })} className={getDesktopHeaderClassName(column.id, "px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap hidden sm:table-cell")}>{locale === "en" ? "Event Type" : "Jenis Acara"}</th>;
            case "status":
                return <th key={column.id} data-column-id={column.id} style={getStickyColumnStyle(column.id, { header: true })} className={getDesktopHeaderClassName(column.id, "px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap")}>{locale === "en" ? "Status" : "Status"}</th>;
            case "queue":
                return <th key={column.id} data-column-id={column.id} style={getStickyColumnStyle(column.id, { header: true })} className={getDesktopHeaderClassName(column.id, "px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap text-center hidden sm:table-cell")}>{t("antrian")}</th>;
            case "actions":
                return <th key={column.id} data-column-id={column.id} style={getStickyColumnStyle(column.id, { header: true })} className={getDesktopHeaderClassName(column.id, "min-w-[96px] px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap text-right")}>{t("aksi")}</th>;
            default:
                return <th key={column.id} data-column-id={column.id} style={getStickyColumnStyle(column.id, { header: true })} className={getDesktopHeaderClassName(column.id, "px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap")}>{column.label}</th>;
        }
    }

    function renderDesktopCell(booking: BookingStatus, column: TableColumnPreference) {
        switch (column.id) {
            case "name":
                return (
                    <td key={column.id} style={getStickyColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3")}>
                        <Link href={`/bookings/${booking.id}`} className="hover:underline">
                            <p className="text-sm font-medium leading-tight">{booking.client_name}</p>
                            <p className="text-[11px] text-muted-foreground">{booking.booking_code}</p>
                        </Link>
                    </td>
                );
            case "package":
                return <td key={column.id} style={getStickyColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3 text-sm hidden sm:table-cell text-muted-foreground")}>{booking.service_label || booking.services?.name || "-"}</td>;
            case "event_type":
                return <td key={column.id} style={getStickyColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3 text-sm hidden sm:table-cell text-muted-foreground max-w-[180px] truncate")} title={booking.event_type || "-"}>{booking.event_type || "-"}</td>;
            case "status":
                return (
                    <td key={column.id} style={getStickyColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3")}>
                        <FilterSingleSelect
                            value={booking.client_status || ""}
                            onChange={(nextValue) => void updateStatus(booking.id, nextValue)}
                            options={statusSelectOptions}
                            placeholder={t("belumDiset")}
                            disabled={savingId === booking.id || !canWriteBookings}
                            title={!canWriteBookings ? bookingWriteBlockedMessage : undefined}
                            className="inline-block w-[172px] align-middle"
                            triggerClassName={inlineStatusTriggerClass}
                            mobileTitle="Status"
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
                    <td key={column.id} style={getStickyColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3 text-center hidden sm:table-cell")}>
                        <input
                            type="number"
                            min={0}
                            value={booking.queue_position ?? ""}
                            onChange={e => {
                                const val = e.target.value === "" ? null : parseInt(e.target.value, 10);
                                updateQueue(booking.id, val);
                            }}
                            placeholder="-"
                            disabled={!canWriteBookings}
                            title={!canWriteBookings ? bookingWriteBlockedMessage : undefined}
                            className={inputClass}
                        />
                    </td>
                );
            case "actions":
                return (
                    <td key={column.id} style={getStickyColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "min-w-[96px] px-4 py-3 text-right")}>
                        <div className="flex items-center justify-end gap-1.5">
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
                        </div>
                    </td>
                );
            default:
                return (
                    <td key={column.id} style={getStickyColumnStyle(column.id)} className={getDesktopCellClassName(column.id, "px-4 py-3 max-w-[180px] truncate text-muted-foreground")} title={getBookingMetadataValue(booking.extra_fields, column.id, { locale: locale === "en" ? "en" : "id" })}>
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
            default:
                return getBookingMetadataValue(booking.extra_fields, column.id, { locale: locale === "en" ? "en" : "id" });
        }
    }

    const topFilterTriggerClass = "h-10 rounded-lg bg-background px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
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
                        onOpenChange={setColumnManagerOpen}
                        onChange={setColumns}
                        onSave={() => saveColumnPreferences(columns)}
                        saving={savingColumns}
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
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={t("cariPlaceholder")}
                        className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    />
                </div>
                <FilterSingleSelect
                    value={filter}
                    onChange={setFilter}
                    options={topStatusFilterOptions}
                    placeholder="Semua"
                    className="w-full sm:w-[220px]"
                    triggerClassName={topFilterTriggerClass}
                    mobileTitle="Status"
                />
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
                {queryState.isLoading || queryState.isRefreshing ? (
                    <CardListSkeleton count={Math.min(queryState.perPage, 4)} />
                ) : queryState.totalItems === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">{hasActiveFilters ? t("tidakAdaHasil") : t("belumAdaBooking")}</div>
                ) : bookings.map(b => (
                    <div key={b.id} className="rounded-xl border bg-card shadow-sm p-4 space-y-3">
                        <div className="flex items-start justify-between">
                            <Link href={`/bookings/${b.id}`} className="hover:underline">
                                <p className="font-semibold">{b.client_name}</p>
                                <p className="text-xs text-muted-foreground">{b.booking_code}</p>
                            </Link>
                            {b.client_status && (
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColors[b.client_status] || "bg-muted text-muted-foreground"}`}>
                                    {b.client_status}
                                </span>
                            )}
                        </div>
                        <div className="border-t pt-2 space-y-2">
                            {orderedVisibleColumns
                                .filter((column) => !["name", "status", "queue", "actions"].includes(column.id))
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
                                    disabled={savingId === b.id || !canWriteBookings}
                                    title={!canWriteBookings ? bookingWriteBlockedMessage : undefined}
                                    className="flex-1"
                                    triggerClassName={inlineStatusTriggerClass}
                                    mobileTitle="Status"
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="text-xs text-muted-foreground shrink-0 w-14">{t("antrian")}</label>
                                <input type="number" min={0} value={b.queue_position ?? ""} onChange={e => updateQueue(b.id, e.target.value === "" ? null : parseInt(e.target.value, 10))} placeholder="-" disabled={!canWriteBookings} title={!canWriteBookings ? bookingWriteBlockedMessage : undefined} className={`${inputClass} flex-1`} />
                            </div>
                        </div>
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
                        </div>
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
                    <table ref={tableRef} className="min-w-[900px] w-full border-separate border-spacing-0 text-left text-sm">
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
                                <tr>
                                    <td colSpan={columns.filter((column) => column.visible).length} className="text-center py-12 text-sm text-muted-foreground">
                                        {hasActiveFilters ? t("tidakAdaHasil") : t("belumAdaBooking")}
                                    </td>
                                </tr>
                            ) : (
                                bookings.map(b => (
                                    <tr key={b.id} className="group hover:bg-muted/30 transition-colors">
                                        {orderedVisibleColumns.map((column) => renderDesktopCell(b, column))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <TablePagination totalItems={queryState.totalItems} currentPage={queryState.page} itemsPerPage={queryState.perPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} perPageOptions={[...CLIENT_STATUS_PER_PAGE_OPTIONS]} />
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
