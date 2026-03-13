"use client";

import * as React from "react";
import { Clock, CheckCircle2, FileText, Loader2, Download, MessageCircle, ExternalLink, Receipt, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { formatSessionDate } from "@/utils/format-date";
import { TablePagination, paginateArray } from "@/components/ui/table-pagination";
import { Link } from "@/i18n/routing";
import * as XLSX from "xlsx";
import {
    getFinalInvoiceTotal,
    getRemainingFinalPayment,
    getTotalPaidAmount,
} from "@/lib/final-settlement";
import {
    fillWhatsAppTemplate,
    getWhatsAppTemplateContent,
    normalizeWhatsAppNumber,
} from "@/lib/whatsapp-template";
type BookingFinance = {
    id: string;
    booking_code: string;
    client_name: string;
    client_whatsapp: string | null;
    total_price: number;
    dp_paid: number;
    is_fully_paid: boolean;
    status: string;
    session_date: string | null;
    event_type: string | null;
    location: string | null;
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
    services: { name: string; price: number } | null;
};

export default function FinancePage() {
    const supabase = createClient();
    const t = useTranslations("Finance");
    const tf = useTranslations("FinancePage");
    const locale = useLocale();
    const [bookings, setBookings] = React.useState<BookingFinance[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [filter, setFilter] = React.useState<"all" | "pending" | "paid">("all");
    const [currentPage, setCurrentPage] = React.useState(1);
    const [itemsPerPage, setItemsPerPage] = React.useState(10);
    const [studioName, setStudioName] = React.useState("");
    const [savedTemplates, setSavedTemplates] = React.useState<
        { id: string; type: string; content: string; content_en: string; event_type: string | null }[]
    >([]);

    const fetchBookings = React.useCallback(async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [{ data }, { data: templates }, { data: profile }] = await Promise.all([
            supabase
                .from("bookings")
                .select("id, booking_code, client_name, client_whatsapp, total_price, dp_paid, is_fully_paid, status, session_date, event_type, location, tracking_uuid, client_status, settlement_status, final_adjustments, final_payment_amount, final_paid_at, final_invoice_sent_at, payment_proof_url, payment_proof_drive_file_id, final_payment_proof_url, final_payment_proof_drive_file_id, services(name, price)")
                .eq("user_id", user.id)
                .neq("status", "Batal")
                .order("created_at", { ascending: false }),
            supabase
                .from("templates")
                .select("id, type, content, content_en, event_type")
                .eq("user_id", user.id),
            supabase.from("profiles").select("studio_name").eq("id", user.id).single(),
        ]);

        setBookings((data || []) as unknown as BookingFinance[]);
        setSavedTemplates((templates || []) as { id: string; type: string; content: string; content_en: string; event_type: string | null }[]);
        setStudioName(profile?.studio_name || "");
        setLoading(false);
    }, [supabase]);

    React.useEffect(() => {
        void fetchBookings();
    }, [fetchBookings]);

    async function handleMarkPaid(id: string) {
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
        fetchBookings();
    }

    async function handleMarkUnpaid(id: string) {
        const booking = bookings.find((item) => item.id === id);
        await supabase.from("bookings").update({
            is_fully_paid: false,
            settlement_status: booking?.final_invoice_sent_at ? "sent" : "draft",
            final_payment_amount: 0,
            final_paid_at: null,
        }).eq("id", id);
        fetchBookings();
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

    function getRemainingAmount(booking: BookingFinance) {
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

    function getAddonTotal(booking: BookingFinance) {
        const baseServicePrice = booking.services?.price ?? booking.total_price;
        const publicAddonTotal = Math.max(booking.total_price - baseServicePrice, 0);
        const finalAddonTotal = Math.max(getFinalInvoiceTotal(booking.total_price, booking.final_adjustments) - booking.total_price, 0);
        return publicAddonTotal + finalAddonTotal;
    }

    function openInvoice(booking: BookingFinance, stage: "initial" | "final") {
        const href = stage === "initial" ? getInitialInvoiceLink(booking) : getFinalInvoiceLink(booking);
        window.open(href, "_blank");
    }

    async function ensureSettlementOpened(booking: BookingFinance) {
        if (!booking.tracking_uuid) {
            alert(locale === "en" ? "Settlement link is not available yet." : "Link pelunasan belum tersedia.");
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
            alert(locale === "en" ? "Failed to open settlement." : "Gagal membuka pelunasan.");
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
        const templateContent = getWhatsAppTemplateContent(savedTemplates, "whatsapp_client", locale);

        if (templateContent.trim()) {
            return fillWhatsAppTemplate(templateContent, {
                client_name: booking.client_name,
                booking_code: booking.booking_code,
                session_date: date,
                service_name: booking.services?.name || "-",
                total_price: formatCurrency(booking.total_price),
                dp_paid: formatCurrency(booking.dp_paid),
                studio_name: studioName || "",
                event_type: booking.event_type || "-",
                location: booking.location || "-",
                location_maps_url: booking.location ? `https://maps.google.com/maps?q=${encodeURIComponent(booking.location)}` : "-",
                detail_location: "-",
                notes: "-",
                tracking_link: trackingLink || "-",
                invoice_url: invoiceLink,
            });
        }

        return `📄 *${tf("waInvoiceTitle")} - ${booking.booking_code}*\n\n${tf("waInvoiceHello", { name: booking.client_name })}\n${tf("waInvoiceDetail")}\n\n📦 ${tf("waInvoicePackage")}: ${booking.services?.name || "-"}\n📅 ${tf("waInvoiceSchedule")}: ${date}\n💰 ${tf("waInvoiceTotal")}: ${formatCurrency(booking.total_price)}\n✅ ${tf("waInvoiceDPPaid")}: ${formatCurrency(booking.dp_paid)}\n📌 ${tf("waInvoiceRemaining")}: ${formatCurrency(remaining)}\n\nStatus: ${booking.is_fully_paid ? `✅ ${tf("waInvoicePaid")}` : `⏳ ${tf("waInvoiceUnpaid")}`}\n\n📎 ${tf("waInvoiceDownload")}: ${invoiceLink}${trackingLink ? `\n🔗 ${tf("waInvoiceViewStatus")}: ${trackingLink}` : ""}\n\n${tf("waInvoiceThankYou")} 🙏`;
    }

    function buildFinalInvoiceMessage(booking: BookingFinance) {
        const remaining = getRemainingAmount(booking);
        const finalTotal = getFinalTotalAmount(booking);
        const date = booking.session_date ? formatSessionDate(booking.session_date, { locale: locale === "en" ? "en" : "id", dateOnly: true }) : "-";
        const trackingLink = getTrackingLink(booking);
        const settlementLink = getSettlementLink(booking);
        const invoiceLink = getFinalInvoiceLink(booking);
        const templateContent = getWhatsAppTemplateContent(savedTemplates, "whatsapp_settlement_client", locale);

        if (templateContent.trim()) {
            return fillWhatsAppTemplate(templateContent, {
                client_name: booking.client_name,
                booking_code: booking.booking_code,
                session_date: date,
                service_name: booking.services?.name || "-",
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
            });
        }

        return `Halo ${booking.client_name}, invoice final untuk booking ${booking.booking_code} sudah kami siapkan.\n\nPaket: ${booking.services?.name || "-"}\nTotal awal: ${formatCurrency(booking.total_price)}\nAdd-on akhir: ${formatCurrency(finalTotal - booking.total_price)}\nTotal final: ${formatCurrency(finalTotal)}\nDP terbayar: ${formatCurrency(booking.dp_paid)}\nSisa pelunasan: ${formatCurrency(remaining)}\n\nInvoice final: ${invoiceLink}\nForm pelunasan: ${settlementLink || "-"}${trackingLink ? `\nTracking: ${trackingLink}` : ""}\n\nSilakan lakukan pelunasan dan upload bukti bayar melalui link di atas. Terima kasih.`;
    }

    function sendInitialInvoiceWhatsApp(booking: BookingFinance) {
        if (!booking.client_whatsapp) {
            alert(tf("waNotAvailable"));
            return;
        }
        const cleaned = normalizeWhatsAppNumber(booking.client_whatsapp);
        const message = buildInitialInvoiceMessage(booking);
        window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${encodeURIComponent(message)}`, "_blank");
    }

    async function sendFinalInvoiceWhatsApp(booking: BookingFinance) {
        if (!booking.client_whatsapp) {
            alert(tf("waNotAvailable"));
            return;
        }

        const openedBooking = await ensureSettlementOpened(booking);
        if (!openedBooking) return;

        const cleaned = normalizeWhatsAppNumber(openedBooking.client_whatsapp);
        const message = buildFinalInvoiceMessage(openedBooking);
        window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${encodeURIComponent(message)}`, "_blank");
    }

    const totalRevenue = bookings.reduce((sum, booking) => sum + getTotalPaidAmount({
        total_price: booking.total_price,
        dp_paid: booking.dp_paid,
        final_adjustments: booking.final_adjustments,
        final_payment_amount: booking.final_payment_amount,
        final_paid_at: booking.final_paid_at,
        settlement_status: booking.settlement_status,
        is_fully_paid: booking.is_fully_paid,
    }), 0);
    const totalPending = bookings.filter(b => !b.is_fully_paid).reduce((sum, booking) => sum + getRemainingFinalPayment({
        total_price: booking.total_price,
        dp_paid: booking.dp_paid,
        final_adjustments: booking.final_adjustments,
        final_payment_amount: booking.final_payment_amount,
        final_paid_at: booking.final_paid_at,
        settlement_status: booking.settlement_status,
        is_fully_paid: booking.is_fully_paid,
    }), 0);
    const totalDP = bookings.reduce((s, b) => s + b.dp_paid, 0);

    function exportFinance() {
        const wb = XLSX.utils.book_new();

        // Sheet 1: Summary
        const summaryData: Array<Array<string | number>> = [
            ["Ringkasan Keuangan", "", ""],
            ["", "", ""],
            ["Total Pemasukan", totalRevenue, ""],
            ["Sisa Tagihan (Belum Lunas)", totalPending, ""],
            ["Total DP Diterima", totalDP, ""],
            ["Jumlah Booking Lunas", bookings.filter(b => b.is_fully_paid).length, ""],
            ["Jumlah Booking Belum Lunas", bookings.filter(b => !b.is_fully_paid).length, ""],
            ["", "", ""],
            ["Ringkasan per Bulan", "", ""],
            ["Bulan", "Total Harga", "DP Diterima"],
        ];
        // Group by month
        const monthMap: Record<string, { total: number; dp: number }> = {};
        bookings.forEach(b => {
            const d = b.session_date ? new Date(b.session_date) : new Date();
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            if (!monthMap[key]) monthMap[key] = { total: 0, dp: 0 };
            monthMap[key].total += getFinalInvoiceTotal(b.total_price, b.final_adjustments);
            monthMap[key].dp += getTotalPaidAmount({
                total_price: b.total_price,
                dp_paid: b.dp_paid,
                final_adjustments: b.final_adjustments,
                final_payment_amount: b.final_payment_amount,
                final_paid_at: b.final_paid_at,
                settlement_status: b.settlement_status,
                is_fully_paid: b.is_fully_paid,
            });
        });
        Object.keys(monthMap).sort().reverse().forEach(key => {
            const [y, m] = key.split("-");
            const label = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
            summaryData.push([label, monthMap[key].total, monthMap[key].dp]);
        });
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        wsSummary["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan");

        // Sheet 2: Detail
        const detailData = bookings.map(b => ({
            "Kode Booking": b.booking_code,
            "Nama Klien": b.client_name,
            "Paket": b.services?.name || "-",
            "Jadwal": b.session_date ? formatSessionDate(b.session_date, { dateOnly: true }) : "-",
            "Total Harga": getFinalInvoiceTotal(b.total_price, b.final_adjustments),
            "Total Add-on": getAddonTotal(b),
            "DP Dibayar": b.dp_paid,
            "Sisa": getRemainingFinalPayment({
                total_price: b.total_price,
                dp_paid: b.dp_paid,
                final_adjustments: b.final_adjustments,
                final_payment_amount: b.final_payment_amount,
                final_paid_at: b.final_paid_at,
                settlement_status: b.settlement_status,
                is_fully_paid: b.is_fully_paid,
            }),
            "Status": b.is_fully_paid ? "Lunas" : "Belum Lunas",
        }));
        const wsDetail = XLSX.utils.json_to_sheet(detailData);
        wsDetail["!cols"] = [{ wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, wsDetail, "Detail Booking");

        XLSX.writeFile(wb, `keuangan_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    function openProof(url: string | null) {
        if (!url) return;
        window.open(url, "_blank");
    }

    const filtered = filter === "all" ? bookings
        : filter === "paid" ? bookings.filter(b => b.is_fully_paid)
            : bookings.filter(b => !b.is_fully_paid);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
                <p className="text-muted-foreground">{t("subtitle")}</p>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-green-100 dark:bg-green-500/10">
                            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("totalPemasukan")}</span>
                    </div>
                    <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                    <p className="text-xs text-muted-foreground mt-1">{t("dariSemuaBooking", { count: bookings.length })}</p>
                </div>
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-500/10">
                            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("sisaTagihan")}</span>
                    </div>
                    <div className="text-2xl font-bold">{formatCurrency(totalPending)}</div>
                    <p className="text-xs text-muted-foreground mt-1">{t("dariBookingBelumLunas", { count: bookings.filter(b => !b.is_fully_paid).length })}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                {(["all", "pending", "paid"] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    >
                        {f === "all" ? t("semua") : f === "paid" ? t("lunas") : t("belumLunas")}
                    </button>
                ))}
                <div className="flex-1" />
                <button
                    onClick={exportFinance}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                >
                    <Download className="w-4 h-4" /> Export Excel
                </button>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
                {loading ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">{t("tidakAdaData")}</div>
                ) : paginateArray(filtered, currentPage, itemsPerPage).map((b) => {
                    const remaining = getRemainingFinalPayment({
                        total_price: b.total_price,
                        dp_paid: b.dp_paid,
                        final_adjustments: b.final_adjustments,
                        final_payment_amount: b.final_payment_amount,
                        final_paid_at: b.final_paid_at,
                        settlement_status: b.settlement_status,
                        is_fully_paid: b.is_fully_paid,
                    });
                    const finalTotal = getFinalInvoiceTotal(b.total_price, b.final_adjustments);
                    const addonTotal = getAddonTotal(b);
                    return (
                        <div key={b.id} className="rounded-xl border bg-card shadow-sm p-4 space-y-3">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="font-semibold">{b.client_name}</p>
                                    <p className="text-xs text-muted-foreground">{b.booking_code} · {b.services?.name || "-"}</p>
                                </div>
                                <button
                                    onClick={() => b.is_fully_paid ? handleMarkUnpaid(b.id) : handleMarkPaid(b.id)}
                                    className={`text-xs font-medium px-2.5 py-1 rounded-full cursor-pointer ${b.is_fully_paid
                                        ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                                        : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"}`}
                                >
                                    {b.is_fully_paid ? "✓ " + t("lunas") : t("belumLunas")}
                                </button>
                            </div>
                            <div className="border-t pt-2 space-y-1 text-sm">
                                <div className="flex justify-between"><span className="text-muted-foreground">{t("hargaTotal")}</span><span className="font-medium">{formatCurrency(finalTotal)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">{t("addOn")}</span><span>{formatCurrency(addonTotal)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">{t("dpDibayar")}</span><span>{formatCurrency(b.dp_paid)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">{t("sisa")}</span><span className={remaining > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : "text-green-600 dark:text-green-400"}>{formatCurrency(remaining)}</span></div>
                            </div>
                            <div className="flex flex-wrap items-center gap-1 pt-1 border-t">
                                <Link href={`/bookings/${b.id}`}>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" title={tf("detailBooking")}>
                                        <Info className="w-4 h-4" />
                                    </Button>
                                </Link>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" title={tf("openInitialInvoice")} onClick={() => openInvoice(b, "initial")}>
                                    <FileText className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-500" title={tf("openFinalInvoice")} onClick={() => openInvoice(b, "final")}>
                                    <Download className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300" title={tf("sendInitialInvoiceWA")} disabled={!b.client_whatsapp} onClick={() => sendInitialInvoiceWhatsApp(b)}>
                                    <MessageCircle className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300" title={tf("sendFinalInvoiceWA")} disabled={!b.client_whatsapp || !b.tracking_uuid} onClick={() => { void sendFinalInvoiceWhatsApp(b); }}>
                                    <MessageCircle className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-sky-500" title={tf("openSettlementLink")} disabled={!b.tracking_uuid} onClick={() => window.open(getSettlementLink(b), "_blank")}>
                                    <ExternalLink className="w-4 h-4" />
                                </Button>
                                {b.payment_proof_url && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500" title={tf("openInitialProof")} onClick={() => openProof(b.payment_proof_url)}>
                                        <Receipt className="w-4 h-4" />
                                    </Button>
                                )}
                                {b.final_payment_proof_url && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-cyan-500" title={tf("openFinalProof")} onClick={() => openProof(b.final_payment_proof_url)}>
                                        <Receipt className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Desktop Table */}
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden hidden md:block">
                <div className="relative overflow-x-auto">
                    <table className="min-w-[1180px] w-full text-sm text-left">
                        <thead className="text-xs uppercase bg-card border-b">
                            <tr>
                                <th className="px-6 py-4 font-medium text-muted-foreground">{t("klien")}</th>
                                <th className="px-6 py-4 font-medium text-muted-foreground">{t("hargaTotal")}</th>
                                <th className="px-6 py-4 font-medium text-muted-foreground">{t("addOn")}</th>
                                <th className="px-6 py-4 font-medium text-muted-foreground">{t("dpDibayar")}</th>
                                <th className="px-6 py-4 font-medium text-muted-foreground">{t("sisa")}</th>
                                <th className="px-6 py-4 font-medium text-muted-foreground">{t("status")}</th>
                                <th className="min-w-[300px] px-6 py-4 font-medium text-muted-foreground text-right">{t("aksi")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                </td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                                    {t("tidakAdaData")}
                                </td></tr>
                            ) : paginateArray(filtered, currentPage, itemsPerPage).map((b) => {
                                const remaining = getRemainingFinalPayment({
                                    total_price: b.total_price,
                                    dp_paid: b.dp_paid,
                                    final_adjustments: b.final_adjustments,
                                    final_payment_amount: b.final_payment_amount,
                                    final_paid_at: b.final_paid_at,
                                    settlement_status: b.settlement_status,
                                    is_fully_paid: b.is_fully_paid,
                                });
                                const finalTotal = getFinalInvoiceTotal(b.total_price, b.final_adjustments);
                                const addonTotal = getAddonTotal(b);
                                return (
                                    <tr key={b.id} className="group hover:bg-muted/50 transition-colors">
                                        <td className="px-4 py-3 max-w-[180px]">
                                            <div className="font-medium truncate">{b.client_name}</div>
                                            <div className="text-xs text-muted-foreground truncate">{b.booking_code} · {b.services?.name || "-"}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap font-medium">{formatCurrency(finalTotal)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(addonTotal)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap font-medium">{formatCurrency(b.dp_paid)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap font-medium">
                                            <span className={remaining > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}>
                                                {formatCurrency(remaining)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <button
                                                onClick={() => b.is_fully_paid ? handleMarkUnpaid(b.id) : handleMarkPaid(b.id)}
                                                className={`text-xs font-medium px-2.5 py-1 rounded-full cursor-pointer transition-colors ${b.is_fully_paid
                                                    ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400 hover:bg-green-200"
                                                    : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 hover:bg-amber-200"
                                                    }`}
                                            >
                                                {b.is_fully_paid ? "✓ " + t("lunas") : t("belumLunas")}
                                            </button>
                                        </td>
                                        <td className="min-w-[300px] px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                                                <Link href={`/bookings/${b.id}`}>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-slate-500 hover:bg-transparent hover:text-slate-700" title={tf("detailBooking")}>
                                                        <Info className="w-4 h-4" />
                                                    </Button>
                                                </Link>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-slate-500 hover:bg-transparent hover:text-slate-700" title={tf("openInitialInvoice")} onClick={() => openInvoice(b, "initial")}>
                                                    <FileText className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-indigo-500 hover:bg-transparent hover:text-indigo-600" title={tf("openFinalInvoice")} onClick={() => openInvoice(b, "final")}>
                                                    <Download className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-emerald-600 hover:bg-transparent hover:text-emerald-700 dark:text-emerald-400" title={tf("sendInitialInvoiceWA")}
                                                    disabled={!b.client_whatsapp}
                                                    onClick={() => sendInitialInvoiceWhatsApp(b)}>
                                                    <MessageCircle className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-orange-500 hover:bg-transparent hover:text-orange-600 dark:text-orange-400" title={tf("sendFinalInvoiceWA")}
                                                    disabled={!b.client_whatsapp || !b.tracking_uuid}
                                                    onClick={() => { void sendFinalInvoiceWhatsApp(b); }}>
                                                    <MessageCircle className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-sky-500 hover:bg-transparent hover:text-sky-600" title={tf("openSettlementLink")}
                                                    disabled={!b.tracking_uuid}
                                                    onClick={() => window.open(getSettlementLink(b), "_blank")}>
                                                    <ExternalLink className="w-4 h-4" />
                                                </Button>
                                                {b.payment_proof_url ? (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-amber-500 hover:bg-transparent hover:text-amber-600" title={tf("openInitialProof")} onClick={() => openProof(b.payment_proof_url)}>
                                                        <Receipt className="w-4 h-4" />
                                                    </Button>
                                                ) : <span className="h-8 w-8" />}
                                                {b.final_payment_proof_url ? (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-cyan-500 hover:bg-transparent hover:text-cyan-600" title={tf("openFinalProof")} onClick={() => openProof(b.final_payment_proof_url)}>
                                                        <Receipt className="w-4 h-4" />
                                                    </Button>
                                                ) : <span className="h-8 w-8" />}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <TablePagination totalItems={filtered.length} currentPage={currentPage} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} />
            </div>
        </div>
    );
}
