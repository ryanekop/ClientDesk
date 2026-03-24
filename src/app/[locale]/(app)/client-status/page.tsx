"use client";

import * as React from "react";
import { createClient } from "@/utils/supabase/client";
import { Activity, Copy, ClipboardCheck, Loader2, ExternalLink, Search } from "lucide-react";
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
import { TablePagination, paginateArray } from "@/components/ui/table-pagination";
import { useTranslations, useLocale } from "next-intl";
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
import {
    normalizeBookingServiceSelections,
    getBookingServiceLabel,
    normalizeLegacyServiceRecord,
    type BookingServiceSelection,
} from "@/lib/booking-services";
import type { FormLayoutItem } from "@/components/form-builder/booking-form-layout";
import {
    CANCELLED_BOOKING_STATUS,
    DEFAULT_CLIENT_STATUSES,
    getBookingStatusOptions,
    resolveUnifiedBookingStatus,
} from "@/lib/client-status";
import {
    isTransitionToCancelled,
    syncGoogleCalendarForStatusTransition,
} from "@/utils/google-calendar-status-sync";
import { buildCancelPaymentPatch, type CancelPaymentPolicy } from "@/lib/cancel-payment";
import { buildAutoDpVerificationPatch } from "@/lib/final-settlement";

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
    { id: "name", label: "Nama", visible: true, locked: true },
    { id: "package", label: "Paket", visible: true },
    { id: "status", label: "Status", visible: true },
    { id: "queue", label: "Antrian", visible: true },
    { id: "actions", label: "Aksi", visible: true, locked: true },
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

    const showFeedback = React.useCallback((message: string, title?: string) => {
        setFeedbackDialog({
            open: true,
            title: title || (locale === "en" ? "Information" : "Informasi"),
            message,
        });
    }, [locale]);

    const statusColors = React.useMemo(() => {
        const map: Record<string, string> = {};
        clientStatuses.forEach((s, i) => { map[s] = STATUS_COLOR_PALETTE[i % STATUS_COLOR_PALETTE.length]; });
        map[CANCELLED_BOOKING_STATUS] = "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400";
        return map;
    }, [clientStatuses]);
    React.useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setCurrentUserId(user.id);

            // Load custom client statuses from profile
            const { data: profile } = await supabase.from("profiles").select("custom_client_statuses, queue_trigger_status, dp_verify_trigger_status, table_column_preferences, form_sections").eq("id", user.id).single();
            const profileData = profile as {
                custom_client_statuses?: string[] | null;
                queue_trigger_status?: string | null;
                dp_verify_trigger_status?: string | null;
                table_column_preferences?: { client_status?: TableColumnPreference[] } | null;
                form_sections?: Record<string, FormLayoutItem[]> | null;
            } | null;
            const normalizedStatusOptions = getBookingStatusOptions(
                profileData?.custom_client_statuses as string[] | null | undefined,
            );
            setClientStatuses(normalizedStatusOptions);
            if (profileData?.queue_trigger_status) {
                setQueueTriggerStatus(profileData.queue_trigger_status);
            }
            setDpVerifyTriggerStatus(profileData?.dp_verify_trigger_status ?? "");
            const resolvedSections = profileData?.form_sections || {};
            setFormSectionsByEventType(resolvedSections);

            const { data } = await supabase
                .from("bookings")
                .select("id, booking_code, client_name, client_whatsapp, session_date, status, client_status, queue_position, dp_paid, dp_verified_amount, dp_verified_at, dp_refund_amount, dp_refunded_at, tracking_uuid, event_type, extra_fields, services(id, name, price, is_addon), booking_services(id, kind, sort_order, service:services(id, name, price, is_addon))")
                .eq("user_id", user.id)
                .neq("status", "Batal")
                .order("created_at", { ascending: false });

            const statusSyncUpdates: Array<{ id: string; status: string }> = [];
            const normalizedBookings = ((data || []) as unknown as BookingStatus[]).map((booking) => {
                    const legacyService = normalizeLegacyServiceRecord(booking.services);
                    const serviceSelections = normalizeBookingServiceSelections(
                        booking.booking_services,
                        booking.services,
                    );
                    const syncedStatus = resolveUnifiedBookingStatus({
                        status: booking.status,
                        clientStatus: booking.client_status,
                        statuses: normalizedStatusOptions,
                    });
                    if (booking.status !== syncedStatus || booking.client_status !== syncedStatus) {
                        statusSyncUpdates.push({ id: booking.id, status: syncedStatus });
                    }
                    return {
                        ...booking,
                        status: syncedStatus,
                        client_status: syncedStatus,
                        service_selections: serviceSelections,
                        service_label: getBookingServiceLabel(serviceSelections, {
                            kind: "main",
                            fallback: legacyService?.name || "-",
                        }),
                    };
                });
            const nextColumnDefaults = lockBoundaryColumns([
                ...BASE_CLIENT_STATUS_COLUMNS.slice(0, -1),
                ...buildBookingMetadataColumns(normalizedBookings, resolvedSections),
                BASE_CLIENT_STATUS_COLUMNS[BASE_CLIENT_STATUS_COLUMNS.length - 1],
            ]);
            setColumns(
                mergeTableColumnPreferences(
                    nextColumnDefaults,
                    profileData?.table_column_preferences?.client_status,
                ),
            );
            setBookings(normalizedBookings);
            setLoading(false);
            if (canWriteBookings && statusSyncUpdates.length > 0) {
                void Promise.allSettled(
                    statusSyncUpdates.map((item) =>
                        supabase
                            .from("bookings")
                            .update({
                                status: item.status,
                                client_status: item.status,
                            })
                            .eq("id", item.id),
                    ),
                );
            }
        }
        load();
    }, [canWriteBookings, supabase]);

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
            ...buildBookingMetadataColumns(bookings, formSectionsByEventType),
            BASE_CLIENT_STATUS_COLUMNS[BASE_CLIENT_STATUS_COLUMNS.length - 1],
        ]);
        setColumns((current) => mergeTableColumnPreferences(nextDefaults, current));
    }, [bookings, formSectionsByEventType]);

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

        try {
            if (isQueue && !wasQueue) {
                // Auto-assign: get max queue_position for current queue bookings
                const maxPos = bookings
                    .filter((booking) => booking.client_status === queueTriggerStatus && booking.queue_position != null)
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
                    showFeedback(locale === "en" ? "Failed to update status." : "Gagal update status.");
                    return;
                }
                setBookings((prev) =>
                    prev.map((booking) =>
                        booking.id === id
                            ? { ...booking, status: nextStatus || booking.status, client_status: nextStatus, queue_position: newPos, ...(cancelPatch || {}), ...(autoDpPatch || {}) }
                            : booking,
                    ),
                );
            } else if (wasQueue && !isQueue) {
                // Auto-clear: remove position and re-number remaining
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
                    showFeedback(locale === "en" ? "Failed to update status." : "Gagal update status.");
                    return;
                }

                const remaining = bookings
                    .filter((booking) => booking.client_status === queueTriggerStatus && booking.id !== id && booking.queue_position != null)
                    .sort((a, b) => (a.queue_position || 0) - (b.queue_position || 0));
                for (let i = 0; i < remaining.length; i += 1) {
                    await supabase.from("bookings").update({ queue_position: i + 1 }).eq("id", remaining[i].id);
                }
                setBookings((prev) => {
                    let updated = prev.map((booking) =>
                        booking.id === id
                            ? { ...booking, status: nextStatus || booking.status, client_status: nextStatus, queue_position: null, ...(cancelPatch || {}), ...(autoDpPatch || {}) }
                            : booking,
                    );
                    remaining.forEach((queueBooking, index) => {
                        updated = updated.map((booking) =>
                            booking.id === queueBooking.id
                                ? { ...booking, queue_position: index + 1 }
                                : booking,
                        );
                    });
                    return updated;
                });
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
                    showFeedback(locale === "en" ? "Failed to update status." : "Gagal update status.");
                    return;
                }
                setBookings((prev) =>
                    prev.map((booking) =>
                        booking.id === id
                            ? { ...booking, status: nextStatus || booking.status, client_status: nextStatus, ...(cancelPatch || {}), ...(autoDpPatch || {}) }
                            : booking,
                    ),
                );
            }

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
        } finally {
            setSavingId(null);
        }
    }

    async function updateQueue(id: string, pos: number | null) {
        if (!requireBookingWrite()) return;
        await supabase.from("bookings").update({ queue_position: pos }).eq("id", id);
        setBookings(prev => prev.map(b => b.id === id ? { ...b, queue_position: pos } : b));
    }

    async function copyTrackLink(uuid: string, id: string) {
        const url = `${window.location.origin}/${locale}/track/${uuid}`;
        try {
            await navigator.clipboard.writeText(url);
            showSuccessToast("Link tracking berhasil disalin.");
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch {
            showFeedback(
                locale === "en"
                    ? "Failed to copy tracking link."
                    : "Gagal menyalin link tracking.",
                locale === "en" ? "Warning" : "Peringatan",
            );
        }
    }

    const filtered = bookings.filter(b => {
        if (filter && b.client_status !== filter) return false;
        if (search && !b.client_name.toLowerCase().includes(search.toLowerCase()) && !b.booking_code.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    React.useEffect(() => {
        setCurrentPage(1);
    }, [filter, search, itemsPerPage]);

    const orderedVisibleColumns = React.useMemo(
        () => columns.filter((column) => column.visible),
        [columns],
    );

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
                return <th key={column.id} className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{locale === "en" ? "Client" : "Klien"}</th>;
            case "package":
                return <th key={column.id} className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap hidden sm:table-cell">{locale === "en" ? "Package" : "Paket"}</th>;
            case "status":
                return <th key={column.id} className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{locale === "en" ? "Status" : "Status"}</th>;
            case "queue":
                return <th key={column.id} className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap text-center hidden sm:table-cell">{t("antrian")}</th>;
            case "actions":
                return <th key={column.id} className="min-w-[96px] px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap text-right">{t("aksi")}</th>;
            default:
                return <th key={column.id} className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{column.label}</th>;
        }
    }

    function renderDesktopCell(booking: BookingStatus, column: TableColumnPreference) {
        switch (column.id) {
            case "name":
                return (
                    <td key={column.id} className="px-4 py-3">
                        <Link href={`/bookings/${booking.id}`} className="hover:underline">
                            <p className="text-sm font-medium leading-tight">{booking.client_name}</p>
                            <p className="text-[11px] text-muted-foreground">{booking.booking_code}</p>
                        </Link>
                    </td>
                );
            case "package":
                return <td key={column.id} className="px-4 py-3 text-sm hidden sm:table-cell text-muted-foreground">{booking.service_label || booking.services?.name || "-"}</td>;
            case "status":
                return (
                    <td key={column.id} className="px-4 py-3">
                        <select
                            value={booking.client_status || ""}
                            onChange={e => updateStatus(booking.id, e.target.value)}
                            disabled={savingId === booking.id || !canWriteBookings}
                            title={!canWriteBookings ? bookingWriteBlockedMessage : undefined}
                            className={selectClass}
                        >
                            <option value="">{t("belumDiset")}</option>
                            {getBookingStatusOptions(clientStatuses).map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                        {booking.client_status && (
                            <span className={`ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColors[booking.client_status] || "bg-muted text-muted-foreground"}`}>
                                {booking.client_status}
                            </span>
                        )}
                    </td>
                );
            case "queue":
                return (
                    <td key={column.id} className="px-4 py-3 text-center hidden sm:table-cell">
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
                    <td key={column.id} className="min-w-[96px] px-4 py-3 text-right">
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
                    <td key={column.id} className="px-4 py-3 max-w-[180px] truncate text-muted-foreground" title={getBookingMetadataValue(booking.extra_fields, column.id, { locale: locale === "en" ? "en" : "id" })}>
                        {getBookingMetadataValue(booking.extra_fields, column.id, { locale: locale === "en" ? "en" : "id" })}
                    </td>
                );
        }
    }

    function renderMobileValue(booking: BookingStatus, column: TableColumnPreference) {
        switch (column.id) {
            case "package":
                return booking.service_label || booking.services?.name || "-";
            case "status":
                return booking.client_status || t("belumDiset");
            case "queue":
                return booking.queue_position ?? "-";
            default:
                return getBookingMetadataValue(booking.extra_fields, column.id, { locale: locale === "en" ? "en" : "id" });
        }
    }

    const selectClass = "h-8 rounded-md border border-input bg-background px-2 py-1 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] cursor-pointer";
    const inputClass = "h-8 rounded-md border border-input bg-background px-2 py-1 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] w-16 text-center";

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {successToastNode}
            <BookingWriteReadonlyBanner />
            <div>
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Activity className="w-6 h-6" /> {t("title")}
                </h2>
                <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
            </div>

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
                <select
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    className="h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring cursor-pointer"
                >
                    <option value="">Semua</option>
                    {getBookingStatusOptions(clientStatuses).map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
                <TableColumnManager
                    title="Kelola Kolom Status Booking"
                    description="Atur kolom yang tampil di tabel status booking. Kolom Nama dan Aksi selalu terkunci."
                    columns={columns}
                    open={columnManagerOpen}
                    onOpenChange={setColumnManagerOpen}
                    onChange={setColumns}
                    onSave={() => saveColumnPreferences(columns)}
                    saving={savingColumns}
                />
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
                {filtered.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">{bookings.length === 0 ? t("belumAdaBooking") : t("tidakAdaHasil")}</div>
                ) : paginateArray(filtered, currentPage, itemsPerPage).map(b => (
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
                                <select value={b.client_status || ""} onChange={e => updateStatus(b.id, e.target.value)} disabled={savingId === b.id || !canWriteBookings} title={!canWriteBookings ? bookingWriteBlockedMessage : undefined} className={`${selectClass} flex-1`}>
                                    <option value="">{t("belumDiset")}</option>
                                    {getBookingStatusOptions(clientStatuses).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
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
            {filtered.length > 0 ? (
                <div className="md:hidden">
                    <TablePagination
                        totalItems={filtered.length}
                        currentPage={currentPage}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                        perPageOptions={[...CLIENT_STATUS_PER_PAGE_OPTIONS]}
                    />
                </div>
            ) : null}

            {/* Desktop Table */}
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden hidden md:block">
                <div className="relative overflow-x-auto">
                    <table className="min-w-[900px] w-full text-sm text-left border-collapse">
                        <thead className="text-[11px] uppercase bg-card border-b">
                            <tr>
                                {orderedVisibleColumns.map((column) => renderDesktopHeader(column))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.filter((column) => column.visible).length} className="text-center py-12 text-sm text-muted-foreground">
                                        {bookings.length === 0 ? t("belumAdaBooking") : t("tidakAdaHasil")}
                                    </td>
                                </tr>
                            ) : (
                                paginateArray(filtered, currentPage, itemsPerPage).map(b => (
                                    <tr key={b.id} className="group hover:bg-muted/30 transition-colors">
                                        {orderedVisibleColumns.map((column) => renderDesktopCell(b, column))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <TablePagination totalItems={filtered.length} currentPage={currentPage} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} perPageOptions={[...CLIENT_STATUS_PER_PAGE_OPTIONS]} />
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
