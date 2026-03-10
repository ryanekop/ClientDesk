"use client";

import * as React from "react";
import { TrendingUp, Clock, CheckCircle2, FileText, Loader2, Download, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import { TablePagination, paginateArray } from "@/components/ui/table-pagination";
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
    tracking_uuid: string | null;
    services: { name: string } | null;
};

export default function FinancePage() {
    const supabase = createClient();
    const t = useTranslations("Finance");
    const [bookings, setBookings] = React.useState<BookingFinance[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [filter, setFilter] = React.useState<"all" | "pending" | "paid">("all");
    const [studioName, setStudioName] = React.useState("Client Desk");
    const [invoiceLogoUrl, setInvoiceLogoUrl] = React.useState<string | null>(null);
    const [currentPage, setCurrentPage] = React.useState(1);
    const [itemsPerPage, setItemsPerPage] = React.useState(10);

    React.useEffect(() => { fetchBookings(); }, []);

    async function fetchBookings() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Load profile for invoice branding
        const { data: profile } = await supabase
            .from("profiles")
            .select("studio_name, invoice_logo_url")
            .eq("id", user.id)
            .single();
        if (profile) {
            if (profile.studio_name) setStudioName(profile.studio_name);
            if (profile.invoice_logo_url) setInvoiceLogoUrl(profile.invoice_logo_url);
        }

        const { data } = await supabase
            .from("bookings")
            .select("id, booking_code, client_name, client_whatsapp, total_price, dp_paid, is_fully_paid, status, session_date, tracking_uuid, services(name)")
            .eq("user_id", user.id)
            .neq("status", "Batal")
            .order("created_at", { ascending: false });

        setBookings((data || []) as unknown as BookingFinance[]);
        setLoading(false);
    }

    async function handleUpdatePayment(id: string, field: "dp_paid" | "total_price", value: number) {
        await supabase.from("bookings").update({ [field]: value }).eq("id", id);
        fetchBookings();
    }

    async function handleMarkPaid(id: string) {
        await supabase.from("bookings").update({ is_fully_paid: true }).eq("id", id);
        fetchBookings();
    }

    async function handleMarkUnpaid(id: string) {
        await supabase.from("bookings").update({ is_fully_paid: false }).eq("id", id);
        fetchBookings();
    }

    function generateInvoice(booking: BookingFinance) {
        window.open(`/api/public/invoice?code=${encodeURIComponent(booking.booking_code)}`, "_blank");
    }

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

    function sendInvoiceWhatsApp(b: BookingFinance) {
        if (!b.client_whatsapp) { alert("Nomor WhatsApp klien tidak tersedia."); return; }
        const remaining = b.total_price - b.dp_paid;
        const date = b.session_date ? new Date(b.session_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-";
        const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
        const trackLink = b.tracking_uuid ? `${siteUrl}/id/track/${b.tracking_uuid}` : "";
        const invoiceLink = `${siteUrl}/api/public/invoice?code=${encodeURIComponent(b.booking_code)}`;
        const msg = `📄 *INVOICE - ${b.booking_code}*\n\nHalo ${b.client_name},\nBerikut detail invoice Anda:\n\n📦 Paket: ${b.services?.name || "-"}\n📅 Jadwal: ${date}\n💰 Total: ${formatCurrency(b.total_price)}\n✅ DP Dibayar: ${formatCurrency(b.dp_paid)}\n📌 Sisa: ${formatCurrency(remaining)}\n\nStatus: ${b.is_fully_paid ? "✅ LUNAS" : "⏳ Belum Lunas"}\n\n📎 Download Invoice: ${invoiceLink}${trackLink ? `\n🔗 Lihat Status: ${trackLink}` : ""}\n\nTerima kasih! 🙏`;
        const cleaned = b.client_whatsapp.replace(/^0/, "62").replace(/[^0-9]/g, "");
        window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${encodeURIComponent(msg)}`, "_blank");
    }

    const totalRevenue = bookings.filter(b => b.is_fully_paid).reduce((s, b) => s + b.total_price, 0);
    const totalPending = bookings.filter(b => !b.is_fully_paid).reduce((s, b) => s + (b.total_price - b.dp_paid), 0);
    const totalDP = bookings.reduce((s, b) => s + b.dp_paid, 0);

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
            <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-green-100 dark:bg-green-500/10">
                            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("totalPemasukan")}</span>
                    </div>
                    <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                    <p className="text-xs text-muted-foreground mt-1">{t("dariBookingLunas", { count: bookings.filter(b => b.is_fully_paid).length })}</p>
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
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/10">
                            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("totalDPDiterima")}</span>
                    </div>
                    <div className="text-2xl font-bold">{formatCurrency(totalDP)}</div>
                    <p className="text-xs text-muted-foreground mt-1">{t("dariSeluruhBooking")}</p>
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
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
                {loading ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">{t("tidakAdaData")}</div>
                ) : paginateArray(filtered, currentPage, itemsPerPage).map((b) => {
                    const remaining = b.total_price - b.dp_paid;
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
                                <div className="flex justify-between"><span className="text-muted-foreground">{t("hargaTotal")}</span><span className="font-medium">{formatCurrency(b.total_price)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">{t("dpDibayar")}</span><span>{formatCurrency(b.dp_paid)}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">{t("sisa")}</span><span className={remaining > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : "text-green-600 dark:text-green-400"}>{formatCurrency(remaining)}</span></div>
                            </div>
                            <div className="flex items-center gap-1 pt-1 border-t">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500" title="Kirim Invoice via WA" disabled={!b.client_whatsapp} onClick={() => sendInvoiceWhatsApp(b)}>
                                    <MessageCircle className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" title="Invoice" onClick={() => generateInvoice(b)}>
                                    <FileText className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Desktop Table */}
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden hidden md:block">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase bg-muted/50 border-b">
                            <tr>
                                <th className="px-6 py-4 font-medium text-muted-foreground">{t("klien")}</th>
                                <th className="px-6 py-4 font-medium text-muted-foreground">{t("hargaTotal")}</th>
                                <th className="px-6 py-4 font-medium text-muted-foreground">{t("dpDibayar")}</th>
                                <th className="px-6 py-4 font-medium text-muted-foreground">{t("sisa")}</th>
                                <th className="px-6 py-4 font-medium text-muted-foreground">{t("status")}</th>
                                <th className="px-6 py-4 font-medium text-muted-foreground text-right">{t("aksi")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                </td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                    {t("tidakAdaData")}
                                </td></tr>
                            ) : paginateArray(filtered, currentPage, itemsPerPage).map((b) => {
                                const remaining = b.total_price - b.dp_paid;
                                return (
                                    <tr key={b.id} className="hover:bg-muted/50 transition-colors">
                                        <td className="px-4 py-3 max-w-[180px]">
                                            <div className="font-medium truncate">{b.client_name}</div>
                                            <div className="text-xs text-muted-foreground truncate">{b.booking_code} · {b.services?.name || "-"}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap font-medium">{formatCurrency(b.total_price)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <EditableAmount value={b.dp_paid} onSave={(v) => handleUpdatePayment(b.id, "dp_paid", v)} />
                                        </td>
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
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500 hover:text-green-600" title="Kirim Invoice via WA"
                                                    disabled={!b.client_whatsapp}
                                                    onClick={() => sendInvoiceWhatsApp(b)}>
                                                    <MessageCircle className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-700" title="Invoice"
                                                    onClick={() => generateInvoice(b)}>
                                                    <FileText className="w-4 h-4" />
                                                </Button>
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

/** Inline editable amount component */
function EditableAmount({ value, onSave }: { value: number; onSave: (v: number) => void }) {
    const [editing, setEditing] = React.useState(false);
    const [val, setVal] = React.useState(String(value));
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => { setVal(String(value)); }, [value]);
    React.useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

    if (!editing) {
        return (
            <button
                onClick={() => setEditing(true)}
                className="text-sm font-medium hover:underline cursor-pointer text-blue-600 dark:text-blue-400"
                title="Klik untuk edit jumlah DP"
            >
                {formatCurrency(value)}
            </button>
        );
    }

    return (
        <input
            ref={inputRef}
            type="number"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={() => { onSave(parseFloat(val) || 0); setEditing(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { onSave(parseFloat(val) || 0); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
            className="w-28 h-8 rounded-md border border-input px-2 text-sm bg-transparent shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        />
    );
}
