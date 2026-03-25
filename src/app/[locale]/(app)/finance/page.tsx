"use client";

import * as React from "react";
import { Clock, CheckCircle2, FileText, Download, MessageCircle, ExternalLink, Receipt, Info, ChevronDown, Copy, ClipboardCheck, Search, ListOrdered, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionIconButton } from "@/components/ui/action-icon-button";
import { ActionFeedbackDialog } from "@/components/ui/action-feedback-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    PageHeader,
    PAGE_HEADER_COMPACT_MOBILE_ACTIONS_CLASSNAME,
} from "@/components/ui/page-header";
import { TableActionMenuPortal } from "@/components/ui/table-action-menu-portal";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { formatSessionDate } from "@/utils/format-date";
import { TablePagination } from "@/components/ui/table-pagination";
import { Link } from "@/i18n/routing";
import {
    BookingWriteReadonlyBanner,
    useBookingWriteAccess,
    useBookingWriteGuard,
} from "@/lib/booking-write-access-context";
import { getBookingWriteBlockedMessage } from "@/lib/booking-write-access";
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
    buildCustomFieldTemplateVars,
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
} from "@/lib/whatsapp-template";
import { getInitialBookingPriceBreakdown } from "@/lib/booking-special-offer";
import {
    buildExtraFieldTemplateVars,
    buildMultiSessionTemplateVars,
} from "@/utils/form-extra-fields";
import { buildGoogleMapsUrlOrFallback } from "@/utils/location";
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
import { fetchPaginatedJson } from "@/lib/pagination/http";
import type { PaginatedQueryState } from "@/lib/pagination/types";

type BookingFinance = {
    id: string;
    booking_code: string;
    client_name: string;
    client_whatsapp: string | null;
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
    packageFilter: string;
    bookingStatusFilter: string;
};

const BASE_FINANCE_COLUMNS: TableColumnPreference[] = [
    { id: "name", label: "Nama", visible: true, locked: true },
    { id: "total_price", label: "Harga Total", visible: true },
    { id: "package_price", label: "Harga Paket", visible: true },
    { id: "addon", label: "Add-on", visible: true },
    { id: "discount", label: "Diskon", visible: true },
    { id: "dp_paid", label: "DP Dibayar", visible: true },
    { id: "remaining", label: "Sisa", visible: true },
    { id: "status", label: "Status", visible: true },
    { id: "actions", label: "Aksi", visible: true, locked: true },
];
const FINANCE_FILTER_VALUES = ["all", "pending", "paid"] as const;
const FINANCE_FILTER_STORAGE_PREFIX = "clientdesk:finance:filters";
const FINANCE_ITEMS_PER_PAGE_STORAGE_PREFIX = "clientdesk:finance:items_per_page";
const FINANCE_PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;
const FINANCE_DEFAULT_ITEMS_PER_PAGE = 10;
const selectFilterClass = "h-9 rounded-md border border-input bg-background/50 px-3 pr-8 text-sm outline-none cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23999%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

type FinancePageMetadata = {
    studioName: string;
    bookingStatusOptions: string[];
    packageOptions: string[];
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

export default function FinancePage() {
    const supabase = createClient();
    const t = useTranslations("Finance");
    const tf = useTranslations("FinancePage");
    const locale = useLocale();
    const [bookings, setBookings] = React.useState<BookingFinance[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [filter, setFilter] = React.useState<FinanceFilterValue>("all");
    const [searchQuery, setSearchQuery] = React.useState("");
    const [packageFilter, setPackageFilter] = React.useState("All");
    const [bookingStatusFilter, setBookingStatusFilter] = React.useState("All");
    const [bookingStatusOptions, setBookingStatusOptions] = React.useState<string[]>(
        getBookingStatusOptions(DEFAULT_CLIENT_STATUSES),
    );
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
    const [formSectionsByEventType, setFormSectionsByEventType] = React.useState<Record<string, FormLayoutItem[]>>({});
    const [metadataRows, setMetadataRows] = React.useState<Array<{ event_type?: string | null; extra_fields?: Record<string, unknown> | null }>>([]);
    const [packageOptions, setPackageOptions] = React.useState<string[]>([]);
    const [totalItems, setTotalItems] = React.useState(0);
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
    const { showSuccessToast, successToastNode } = useSuccessToast();
    const { canWriteBookings } = useBookingWriteAccess();
    const bookingWriteBlockedMessage = React.useMemo(
        () => getBookingWriteBlockedMessage(locale),
        [locale],
    );
    const requireBookingWrite = useBookingWriteGuard(({ message }) => {
        setFeedbackDialog({ open: true, message });
    });
    const hasLoadedFinanceRef = React.useRef(false);

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
        setPackageFilter("All");
        setBookingStatusFilter("All");
    }, []);

    const fetchTemplates = React.useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
            .from("templates")
            .select("id, type, name, content, content_en, event_type")
            .eq("user_id", user.id);
        setSavedTemplates((data || []) as { id: string; type: string; name?: string | null; content: string; content_en: string; event_type: string | null }[]);
    }, [supabase]);

    const fetchFinancePage = React.useCallback(async (mode: "initial" | "refresh" = "refresh") => {
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
                filter,
                search: searchQuery,
                package: packageFilter,
                bookingStatus: bookingStatusFilter,
            });
            const response = await fetchPaginatedJson<BookingFinance, FinancePageMetadata>(
                `/api/internal/finance?${params.toString()}`,
            );
            const metadata = response.metadata;
            const nextColumnDefaults = lockBoundaryColumns([
                ...BASE_FINANCE_COLUMNS.slice(0, -1),
                ...buildBookingMetadataColumns(
                    metadata?.metadataRows || [],
                    metadata?.formSectionsByEventType || {},
                ),
                BASE_FINANCE_COLUMNS[BASE_FINANCE_COLUMNS.length - 1],
            ]);

            setBookings(response.items);
            setTotalItems(response.totalItems);
            setBookingStatusOptions(metadata?.bookingStatusOptions || getBookingStatusOptions(DEFAULT_CLIENT_STATUSES));
            setPackageOptions(metadata?.packageOptions || []);
            setStudioName(metadata?.studioName || "");
            setFormSectionsByEventType(metadata?.formSectionsByEventType || {});
            setMetadataRows(metadata?.metadataRows || []);
            setSummary(metadata?.summary || {
                totalRevenue: 0,
                totalPending: 0,
                totalDP: 0,
                totalBookings: 0,
                paidCount: 0,
                unpaidCount: 0,
                monthlyRevenueTotal: 0,
            });
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
    }, [bookingStatusFilter, currentPage, filter, filtersHydrated, itemsPerPage, itemsPerPageHydrated, packageFilter, searchQuery]);

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

            setSearchQuery(readString("searchQuery", ""));
            setFilter(normalizeFinanceFilterValue(parsed.filter));
            setPackageFilter(readString("packageFilter", "All") || "All");
            setBookingStatusFilter(readString("bookingStatusFilter", "All") || "All");
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
        };

        try {
            window.localStorage.setItem(storageKey, JSON.stringify(payload));
        } catch {
            // Ignore storage write failures.
        }
    }, [bookingStatusFilter, currentUserId, filter, filtersHydrated, packageFilter, searchQuery]);

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

    React.useEffect(() => {
        const nextDefaults = lockBoundaryColumns([
            ...BASE_FINANCE_COLUMNS.slice(0, -1),
            ...buildBookingMetadataColumns(metadataRows, formSectionsByEventType),
            BASE_FINANCE_COLUMNS[BASE_FINANCE_COLUMNS.length - 1],
        ]);
        setColumns((current) => mergeTableColumnPreferences(nextDefaults, current));
    }, [formSectionsByEventType, metadataRows]);

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
            "finance",
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
        void fetchFinancePage("refresh");
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
        void fetchFinancePage("refresh");
    }

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
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
        const templateContent = getWhatsAppTemplateContent(
            savedTemplates,
            "whatsapp_client",
            locale,
            booking.event_type,
        );

        if (templateContent.trim()) {
            return fillWhatsAppTemplate(templateContent, {
                client_name: booking.client_name,
                client_whatsapp: booking.client_whatsapp || "-",
                booking_code: booking.booking_code,
                session_date: date,
                service_name: booking.service_label || booking.services?.name || "-",
                total_price: formatCurrency(booking.total_price),
                dp_paid: formatCurrency(booking.dp_paid),
                studio_name: studioName || "",
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
                detail_location: "-",
                notes: "-",
                tracking_link: trackingLink || "-",
                invoice_url: invoiceLink,
                ...buildExtraFieldTemplateVars(booking.extra_fields),
                ...buildMultiSessionTemplateVars(booking.extra_fields, {
                    locale: locale === "en" ? "en" : "id",
                }),
                ...buildCustomFieldTemplateVars(booking.extra_fields),
            });
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
        const templateContent = getWhatsAppTemplateContent(
            savedTemplates,
            "whatsapp_settlement_client",
            locale,
            booking.event_type,
        );

        if (templateContent.trim()) {
            return fillWhatsAppTemplate(templateContent, {
                client_name: booking.client_name,
                client_whatsapp: booking.client_whatsapp || "-",
                booking_code: booking.booking_code,
                session_date: date,
                service_name: booking.service_label || booking.services?.name || "-",
                total_price: formatCurrency(booking.total_price),
                dp_paid: formatCurrency(booking.dp_paid),
                final_total: formatCurrency(finalTotal),
                adjustments_total: formatCurrency(finalTotal - booking.total_price),
                remaining_payment: formatCurrency(remaining),
                studio_name: studioName || "",
                event_type: booking.event_type || "-",
                location: booking.location || "-",
                tracking_link: trackingLink || "-",
                invoice_url: invoiceLink,
                settlement_link: settlementLink || "-",
                ...buildExtraFieldTemplateVars(booking.extra_fields),
                ...buildMultiSessionTemplateVars(booking.extra_fields, {
                    locale: locale === "en" ? "en" : "id",
                }),
                ...buildCustomFieldTemplateVars(booking.extra_fields),
            });
        }

        return `Halo ${booking.client_name}, invoice final untuk booking ${booking.booking_code} sudah kami siapkan.\n\nPaket: ${booking.service_label || booking.services?.name || "-"}\nTotal awal: ${formatCurrency(booking.total_price)}\nAdd-on akhir: ${formatCurrency(finalTotal - booking.total_price)}\nTotal final: ${formatCurrency(finalTotal)}\nDP terbayar: ${formatCurrency(booking.dp_paid)}\nSisa pelunasan: ${formatCurrency(remaining)}\n\nInvoice final: ${invoiceLink}\nForm pelunasan: ${settlementLink || "-"}${trackingLink ? `\nTracking: ${trackingLink}` : ""}\n\nSilakan lakukan pelunasan dan upload bukti bayar melalui link di atas. Terima kasih.`;
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
            showSuccessToast("Template invoice berhasil disalin.");
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
                message: locale === "en" ? "Failed to copy template." : "Gagal menyalin template.",
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

    function renderDesktopHeader(column: TableColumnPreference) {
        switch (column.id) {
            case "name":
                return <th key={column.id} className="px-6 py-4 font-medium text-muted-foreground">{t("klien")}</th>;
            case "total_price":
                return <th key={column.id} className="px-6 py-4 font-medium text-muted-foreground">{t("hargaTotal")}</th>;
            case "package_price":
                return <th key={column.id} className="px-6 py-4 font-medium text-muted-foreground">{t("hargaPaket")}</th>;
            case "addon":
                return <th key={column.id} className="px-6 py-4 font-medium text-muted-foreground">{t("addOn")}</th>;
            case "dp_paid":
                return <th key={column.id} className="px-6 py-4 font-medium text-muted-foreground">{t("dpDibayar")}</th>;
            case "discount":
                return <th key={column.id} className="px-6 py-4 font-medium text-muted-foreground">{t("diskon")}</th>;
            case "remaining":
                return <th key={column.id} className="px-6 py-4 font-medium text-muted-foreground">{t("sisa")}</th>;
            case "status":
                return <th key={column.id} className="px-6 py-4 font-medium text-muted-foreground">{t("status")}</th>;
            case "actions":
                return <th key={column.id} className="min-w-[420px] px-4 py-4 font-medium text-muted-foreground text-right">{t("aksi")}</th>;
            default:
                return <th key={column.id} className="px-6 py-4 font-medium text-muted-foreground">{column.label}</th>;
        }
    }

    function renderDesktopCell(
        booking: BookingFinance,
        column: TableColumnPreference,
        remaining: number,
        finalTotal: number,
        addonTotal: number,
        packagePrice: number,
        discountAmount: number,
    ) {
        switch (column.id) {
            case "name":
                return (
                    <td key={column.id} className="px-4 py-3 max-w-[180px]">
                        <div className="font-medium truncate">{booking.client_name}</div>
                        <div className="text-xs text-muted-foreground truncate">{booking.booking_code} · {booking.service_label || booking.services?.name || "-"}</div>
                    </td>
                );
            case "total_price":
                return <td key={column.id} className="px-6 py-4 whitespace-nowrap font-medium">{formatCurrency(finalTotal)}</td>;
            case "package_price":
                return <td key={column.id} className="px-6 py-4 whitespace-nowrap">{formatCurrency(packagePrice)}</td>;
            case "addon":
                return <td key={column.id} className="px-6 py-4 whitespace-nowrap">{formatCurrency(addonTotal)}</td>;
            case "dp_paid":
                return <td key={column.id} className="px-6 py-4 whitespace-nowrap font-medium">{formatCurrency(booking.dp_paid)}</td>;
            case "discount":
                return (
                    <td key={column.id} className="px-6 py-4 whitespace-nowrap">
                        {discountAmount > 0 ? `- ${formatCurrency(discountAmount)}` : formatCurrency(0)}
                    </td>
                );
            case "remaining":
                return (
                    <td key={column.id} className="px-6 py-4 whitespace-nowrap font-medium">
                        <span className={remaining > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}>
                            {formatCurrency(remaining)}
                        </span>
                    </td>
                );
            case "status":
                if (isCancelledBooking(booking)) {
                    return (
                        <td key={column.id} className="px-6 py-4 whitespace-nowrap">
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
                    <td key={column.id} className="px-6 py-4 whitespace-nowrap">
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
                    <td key={column.id} className="min-w-[420px] px-4 py-4 text-right">
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
                            {booking.payment_proof_url ? (
                                <ActionIconButton tone="amber" title={tf("openInitialProof")} onClick={() => openProof(booking.payment_proof_url)}>
                                    <Receipt className="w-4 h-4" />
                                </ActionIconButton>
                            ) : <span className="h-8 w-8" />}
                            {booking.final_payment_proof_url ? (
                                <ActionIconButton tone="cyan" title={tf("openFinalProof")} onClick={() => openProof(booking.final_payment_proof_url)}>
                                    <Receipt className="w-4 h-4" />
                                </ActionIconButton>
                            ) : <span className="h-8 w-8" />}
                        </div>
                    </td>
                );
            default:
                return (
                    <td key={column.id} className="px-6 py-4 max-w-[180px] truncate text-muted-foreground" title={getBookingMetadataValue(booking.extra_fields, column.id, { locale: locale === "en" ? "en" : "id" })}>
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
            case "total_price":
                return formatCurrency(finalTotal);
            case "package_price":
                return formatCurrency(packagePrice);
            case "addon":
                return formatCurrency(addonTotal);
            case "dp_paid":
                return formatCurrency(booking.dp_paid);
            case "discount":
                return discountAmount > 0 ? `- ${formatCurrency(discountAmount)}` : formatCurrency(0);
            case "remaining":
                return formatCurrency(remaining);
            case "status":
                return getFinanceStatusLabel(booking);
            default:
                return getBookingMetadataValue(booking.extra_fields, column.id, { locale: locale === "en" ? "en" : "id" });
        }
    }

    const hasActiveFilters =
        searchQuery.trim().length > 0 ||
        filter !== "all" ||
        packageFilter !== "All" ||
        bookingStatusFilter !== "All";

    const monthlyRevenueLabel = React.useMemo(
        () =>
            new Intl.DateTimeFormat(locale, {
                month: "long",
                year: "numeric",
            }).format(new Date()),
        [locale],
    );

    const queryState = React.useMemo<PaginatedQueryState>(() => ({
        page: currentPage,
        perPage: itemsPerPage,
        totalItems,
        isLoading: loading,
        isRefreshing: refreshing,
    }), [currentPage, itemsPerPage, totalItems, loading, refreshing]);

    async function exportFinance() {
        const params = new URLSearchParams({
            page: "1",
            perPage: String(Math.max(totalItems, 1)),
            filter,
            search: searchQuery,
            package: packageFilter,
            bookingStatus: bookingStatusFilter,
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
            ["Sisa Tagihan (Belum Lunas)", exportSummary.totalPending, ""],
            ["Total DP Diterima", exportSummary.totalDP, ""],
            ["Jumlah Booking Lunas", exportSummary.paidCount, ""],
            ["Jumlah Booking Belum Lunas", exportSummary.unpaidCount, ""],
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
                "Nama Klien": b.client_name,
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
    }

    function openProof(url: string | null) {
        if (!url) return;
        window.open(url, "_blank");
    }

    React.useEffect(() => {
        if (loading) return;
        if (packageFilter !== "All" && !packageOptions.includes(packageFilter)) {
            setPackageFilter("All");
        }
    }, [loading, packageFilter, packageOptions]);

    React.useEffect(() => {
        if (loading) return;
        if (bookingStatusFilter !== "All" && !bookingStatusOptions.includes(bookingStatusFilter)) {
            setBookingStatusFilter("All");
        }
    }, [bookingStatusFilter, bookingStatusOptions, loading]);

    React.useEffect(() => {
        setCurrentPage(1);
    }, [filter, searchQuery, packageFilter, bookingStatusFilter, itemsPerPage]);

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
                actionsClassName={PAGE_HEADER_COMPACT_MOBILE_ACTIONS_CLASSNAME}
                actions={(
                    <>
                        <Button
                            type="button"
                            className="order-2 w-full lg:order-1 lg:w-auto"
                            onClick={() => { void exportFinance(); }}
                        >
                            <Download className="w-4 h-4" /> Export Excel
                        </Button>
                        <TableColumnManager
                            title="Kelola Kolom Keuangan"
                            description="Atur kolom yang tampil di tabel keuangan. Kolom Nama dan Aksi selalu terkunci."
                            columns={columns}
                            open={columnManagerOpen}
                            onOpenChange={setColumnManagerOpen}
                            onChange={setColumns}
                            onSave={() => saveColumnPreferences(columns)}
                            saving={savingColumns}
                            triggerClassName="order-1 w-full lg:order-2 lg:w-auto"
                        />
                    </>
                )}
            >
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
                    <p className="text-muted-foreground">{t("subtitle")}</p>
                </div>
            </PageHeader>

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-green-100 dark:bg-green-500/10">
                            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("totalPemasukan")}</span>
                    </div>
                    <div className="text-2xl font-bold">{formatCurrency(summary.totalRevenue)}</div>
                    <p className="text-xs text-muted-foreground mt-1">{t("dariSemuaBooking", { count: summary.totalBookings })}</p>
                </div>
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-500/10">
                            <Receipt className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("monthlyRevenue")}</span>
                    </div>
                    <div className="text-2xl font-bold">{formatCurrency(summary.monthlyRevenueTotal)}</div>
                    <p className="text-xs text-muted-foreground mt-1">{t("monthlyRevenueSubtitle", { month: monthlyRevenueLabel })}</p>
                </div>
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-500/10">
                            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("sisaTagihan")}</span>
                    </div>
                    <div className="text-2xl font-bold">{formatCurrency(summary.totalPending)}</div>
                    <p className="text-xs text-muted-foreground mt-1">{t("dariBookingBelumLunas", { count: summary.unpaidCount })}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder={t("searchPlaceholder")}
                            className="h-9 w-full rounded-md border border-input bg-background/50 pl-9 pr-3 text-sm outline-none transition-all focus-visible:ring-1 focus-visible:ring-ring"
                        />
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            className="h-9 w-full gap-2 justify-center sm:w-auto"
                            onClick={() => setShowFilterPanel((previous) => !previous)}
                        >
                            <ListOrdered className="w-4 h-4" />
                            {t("filterButton")}
                        </Button>
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={resetFilters}
                                className="h-9 w-full px-3 rounded-md border border-input bg-background/50 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer sm:w-auto"
                            >
                                <X className="w-3.5 h-3.5" />
                                {t("resetFilters")}
                            </button>
                        )}
                    </div>
                </div>

                {showFilterPanel && (
                    <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            <div className="space-y-1.5 md:space-y-0 md:flex md:items-center md:gap-4">
                                <label className="text-xs font-medium text-muted-foreground md:w-32 md:shrink-0 xl:w-36">{t("financeStatusFilterLabel")}</label>
                                <select
                                    value={filter}
                                    onChange={(event) => setFilter(normalizeFinanceFilterValue(event.target.value))}
                                    className={`${selectFilterClass} w-full`}
                                >
                                    <option value="all">{t("semua")}</option>
                                    <option value="pending">{t("belumLunas")}</option>
                                    <option value="paid">{t("lunas")}</option>
                                </select>
                            </div>

                            <div className="space-y-1.5 md:space-y-0 md:flex md:items-center md:gap-4">
                                <label className="text-xs font-medium text-muted-foreground md:w-32 md:shrink-0 xl:w-36">{t("packageFilterLabel")}</label>
                                <select
                                    value={packageFilter}
                                    onChange={(event) => setPackageFilter(event.target.value)}
                                    className={`${selectFilterClass} w-full`}
                                >
                                    <option value="All">{t("allPackages")}</option>
                                    {packageOptions.map((packageName) => (
                                        <option key={packageName} value={packageName}>
                                            {packageName}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5 md:space-y-0 md:flex md:items-center md:gap-4">
                                <label className="text-xs font-medium text-muted-foreground md:w-32 md:shrink-0 xl:w-36">{t("bookingStatusFilterLabel")}</label>
                                <select
                                    value={bookingStatusFilter}
                                    onChange={(event) => setBookingStatusFilter(event.target.value)}
                                    className={`${selectFilterClass} w-full`}
                                >
                                    <option value="All">{t("allBookingStatuses")}</option>
                                    {bookingStatusOptions.map((statusOption) => (
                                        <option key={statusOption} value={statusOption}>
                                            {statusOption}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
                {queryState.isLoading || queryState.isRefreshing ? (
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
                    return (
                        <div key={b.id} className="rounded-xl border bg-card shadow-sm p-4 space-y-3">
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
                                    .filter((column) => column.id !== "name" && column.id !== "actions")
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
                                {b.payment_proof_url && (
                                    <ActionIconButton tone="amber" title={tf("openInitialProof")} onClick={() => openProof(b.payment_proof_url)}>
                                        <Receipt className="w-4 h-4" />
                                    </ActionIconButton>
                                )}
                                {b.final_payment_proof_url && (
                                    <ActionIconButton tone="cyan" title={tf("openFinalProof")} onClick={() => openProof(b.final_payment_proof_url)}>
                                        <Receipt className="w-4 h-4" />
                                    </ActionIconButton>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            {!queryState.isLoading && !queryState.isRefreshing && queryState.totalItems > 0 ? (
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
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-visible hidden md:block">
                <div className="relative overflow-x-auto overflow-y-visible">
                    <table className="min-w-[1420px] w-full text-sm text-left">
                        <thead className="text-xs uppercase bg-card border-b">
                            <tr>
                                {orderedVisibleColumns.map((column) => renderDesktopHeader(column))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {queryState.isLoading || queryState.isRefreshing ? (
                                <TableRowsSkeleton
                                    rows={Math.min(queryState.perPage, 6)}
                                    columns={orderedVisibleColumns.length}
                                />
                            ) : queryState.totalItems === 0 ? (
                                <tr><td colSpan={columns.filter((column) => column.visible).length} className="px-6 py-12 text-center text-muted-foreground">
                                    {t("tidakAdaData")}
                                </td></tr>
                            ) : bookings.map((b) => {
                                const remaining = getRemainingAmount(b);
                                const finalTotal = getFinalInvoiceTotal(b.total_price, b.final_adjustments);
                                const initialBreakdown = getInitialPriceBreakdown(b);
                                const packagePrice = getPackagePrice(b, initialBreakdown);
                                const addonTotal = getAddonTotal(b, initialBreakdown);
                                const discountAmount = getDiscountAmount(b, initialBreakdown);
                                return (
                                    <tr key={b.id} className="group hover:bg-muted/50 transition-colors">
                                        {orderedVisibleColumns.map((column) =>
                                            renderDesktopCell(
                                                b,
                                                column,
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
        </div>
    );
}
