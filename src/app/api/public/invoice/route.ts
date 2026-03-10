import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function formatCurrency(n: number) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

export async function GET(request: NextRequest) {
    const code = request.nextUrl.searchParams.get("code");
    if (!code) {
        return new NextResponse("Booking code required", { status: 400 });
    }

    // Fetch booking
    const { data: booking, error } = await supabaseAdmin
        .from("bookings")
        .select("id, booking_code, client_name, client_whatsapp, session_date, total_price, dp_paid, is_fully_paid, status, user_id, services(name)")
        .eq("booking_code", code)
        .single();

    if (!booking || error) {
        return new NextResponse("Booking not found", { status: 404 });
    }

    // Fetch vendor info
    const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("studio_name, invoice_logo_url")
        .eq("id", booking.user_id)
        .single();

    const studioName = profile?.studio_name || "Studio";
    const invoiceLogoUrl = profile?.invoice_logo_url || null;
    const remaining = booking.total_price - booking.dp_paid;
    const date = booking.session_date ? new Date(booking.session_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-";
    const now = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

    const html = `<!DOCTYPE html>
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
@media print { body { padding: 20px; } .no-print { display: none; } }
.print-btn { display: block; margin: 0 auto 24px; padding: 10px 32px; background: #111; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
.print-btn:hover { background: #333; }
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">🖨️ Cetak / Download PDF</button>
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
        <td>${(booking.services as any)?.name || "Layanan"}</td>
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

    return new NextResponse(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
    });
}
