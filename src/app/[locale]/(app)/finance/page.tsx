"use client";

import * as React from "react";
import { TrendingUp, Clock, CheckCircle2, FileText, Loader2, Download, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
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
            .select("id, booking_code, client_name, client_whatsapp, total_price, dp_paid, is_fully_paid, status, session_date, services(name)")
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
        const remaining = booking.total_price - booking.dp_paid;
        const date = booking.session_date ? new Date(booking.session_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-";
        const now = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

        const invoiceHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Invoice ${booking.booking_code}</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 40px; color: #1a1a1a; max-width: 800px; margin: auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
    .brand h1 { font-size: 24px; font-weight: 700; }
    .brand p { color: #6b7280; font-size: 14px; }
    .invoice-info { text-align: right; }
    .invoice-info h2 { font-size: 28px; font-weight: 700; color: #111; margin-bottom: 4px; }
    .invoice-info p { font-size: 13px; color: #6b7280; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 8px; }
    .client-info p { font-size: 14px; line-height: 1.6; }
    .client-info strong { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin: 24px 0; }
    th { background: #f9fafb; text-align: left; padding: 12px 16px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
    td { padding: 14px 16px; font-size: 14px; border-bottom: 1px solid #f3f4f6; }
    .text-right { text-align: right; }
    .summary { margin-top: 16px; display: flex; justify-content: flex-end; }
    .summary-table { width: 280px; }
    .summary-table tr td { padding: 8px 0; font-size: 14px; }
    .summary-table .total td { font-weight: 700; font-size: 18px; padding-top: 12px; border-top: 2px solid #111; }
    .paid-badge { display: inline-block; background: #dcfce7; color: #16a34a; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .unpaid-badge { display: inline-block; background: #fef3c7; color: #d97706; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px; }
    @media print { body { padding: 20px; } }
</style>
</head>
<body>
<div class="header">
    <div class="brand">
        ${invoiceLogoUrl ? `<img src="${invoiceLogoUrl}" alt="Logo" style="max-height:48px;max-width:200px;object-fit:contain;margin-bottom:4px;">` : `<h1>${studioName}</h1>`}
        <p>Studio Management</p>
    </div>
    <div class="invoice-info">
        <h2>INVOICE</h2>
        <p>${booking.booking_code}</p>
        <p>${now}</p>
    </div>
</div>

<div class="section">
    <div class="section-title">Detail Klien</div>
    <div class="client-info">
        <p><strong>${booking.client_name}</strong></p>
        <p>${booking.client_whatsapp || "-"}</p>
    </div>
</div>

<table>
    <thead>
        <tr>
            <th>Layanan</th>
            <th>Jadwal</th>
            <th>Status</th>
            <th class="text-right">Total</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>${booking.services?.name || "Layanan"}</td>
            <td>${date}</td>
            <td><span class="${booking.is_fully_paid ? 'paid-badge' : 'unpaid-badge'}">${booking.is_fully_paid ? 'Lunas' : 'Belum Lunas'}</span></td>
            <td class="text-right">${formatCurrency(booking.total_price)}</td>
        </tr>
    </tbody>
</table>

<div class="summary">
    <table class="summary-table">
        <tr><td>Sub Total</td><td class="text-right">${formatCurrency(booking.total_price)}</td></tr>
        <tr><td>DP Dibayar</td><td class="text-right">- ${formatCurrency(booking.dp_paid)}</td></tr>
        <tr class="total"><td>Sisa Pembayaran</td><td class="text-right">${formatCurrency(remaining)}</td></tr>
    </table>
</div>

<div class="footer">
    <p>Terima kasih atas kepercayaan Anda. Invoice ini digenerate otomatis oleh ${studioName}.</p>
</div>
</body>
</html>`;

        const w = window.open("", "_blank");
        if (w) {
            w.document.write(invoiceHtml);
            w.document.close();
            setTimeout(() => w.print(), 500);
        }
    }

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

    function sendInvoiceWhatsApp(b: BookingFinance) {
        if (!b.client_whatsapp) { alert("Nomor WhatsApp klien tidak tersedia."); return; }
        const remaining = b.total_price - b.dp_paid;
        const date = b.session_date ? new Date(b.session_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-";
        const msg = `📄 *INVOICE - ${b.booking_code}*\n\nHalo ${b.client_name},\nBerikut detail invoice Anda:\n\n📦 Paket: ${b.services?.name || "-"}\n📅 Jadwal: ${date}\n💰 Total: ${formatCurrency(b.total_price)}\n✅ DP Dibayar: ${formatCurrency(b.dp_paid)}\n📌 Sisa: ${formatCurrency(remaining)}\n\nStatus: ${b.is_fully_paid ? "✅ LUNAS" : "⏳ Belum Lunas"}\n\nTerima kasih! 🙏`;
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

            {/* Table */}
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
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
                            ) : filtered.map((b) => {
                                const remaining = b.total_price - b.dp_paid;
                                return (
                                    <tr key={b.id} className="hover:bg-muted/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium">{b.client_name}</div>
                                            <div className="text-xs text-muted-foreground">{b.booking_code} · {b.services?.name || "-"}</div>
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
