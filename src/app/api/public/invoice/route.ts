import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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
        return NextResponse.json({ error: "Booking code required" }, { status: 400 });
    }

    const { data: booking, error } = await supabaseAdmin
        .from("bookings")
        .select("id, booking_code, client_name, client_whatsapp, session_date, total_price, dp_paid, is_fully_paid, status, user_id, services(name)")
        .eq("booking_code", code)
        .single();

    if (!booking || error) {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("studio_name")
        .eq("id", booking.user_id)
        .single();

    const studioName = profile?.studio_name || "Studio";
    const remaining = booking.total_price - booking.dp_paid;
    const sessionDate = booking.session_date
        ? new Date(booking.session_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
        : "-";
    const now = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const serviceName = (booking.services as any)?.name || "Layanan";
    const paymentStatus = booking.is_fully_paid ? "Lunas" : "Belum Lunas";

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const black = rgb(0.1, 0.1, 0.1);
    const gray = rgb(0.42, 0.44, 0.47);
    const lightGray = rgb(0.9, 0.91, 0.92);
    const green = rgb(0.086, 0.64, 0.26);
    const amber = rgb(0.85, 0.47, 0.02);

    const w = 595;
    const mx = 40; // margin x
    const contentW = w - mx * 2;
    let y = 802; // start from top

    // --- HEADER ---
    page.drawText(studioName, { x: mx, y, font: helveticaBold, size: 18, color: black });
    page.drawText("INVOICE", { x: w - mx - helveticaBold.widthOfTextAtSize("INVOICE", 22), y, font: helveticaBold, size: 22, color: black });
    y -= 18;
    page.drawText("Studio Management", { x: mx, y, font: helvetica, size: 9, color: gray });
    const codeW = helvetica.widthOfTextAtSize(booking.booking_code, 10);
    page.drawText(booking.booking_code, { x: w - mx - codeW, y, font: helvetica, size: 10, color: gray });
    y -= 14;
    const dateW = helvetica.widthOfTextAtSize(now, 9);
    page.drawText(now, { x: w - mx - dateW, y, font: helvetica, size: 9, color: gray });

    // Divider
    y -= 16;
    page.drawLine({ start: { x: mx, y }, end: { x: w - mx, y }, thickness: 1, color: lightGray });

    // --- CLIENT INFO ---
    y -= 24;
    page.drawText("DETAIL KLIEN", { x: mx, y, font: helveticaBold, size: 8, color: gray });
    y -= 18;
    page.drawText(booking.client_name, { x: mx, y, font: helveticaBold, size: 12, color: black });
    y -= 16;
    page.drawText(booking.client_whatsapp || "-", { x: mx, y, font: helvetica, size: 10, color: gray });

    // --- TABLE ---
    y -= 30;
    const colX = [mx, mx + 200, mx + 320, w - mx];
    const headers = ["Layanan", "Jadwal", "Status", "Total"];

    // Table header bg
    page.drawRectangle({ x: mx, y: y - 4, width: contentW, height: 28, color: rgb(0.976, 0.98, 0.984) });
    headers.forEach((h, i) => {
        const tx = i === 3 ? colX[i] - helveticaBold.widthOfTextAtSize(h, 8) : colX[i] + 8;
        page.drawText(h, { x: tx, y: y + 6, font: helveticaBold, size: 8, color: gray });
    });

    // Table header bottom line
    y -= 6;
    page.drawLine({ start: { x: mx, y }, end: { x: w - mx, y }, thickness: 0.5, color: lightGray });

    // Table row
    y -= 20;
    page.drawText(serviceName, { x: colX[0] + 8, y, font: helvetica, size: 10, color: black });
    page.drawText(sessionDate, { x: colX[1] + 8, y, font: helvetica, size: 10, color: black });
    const statusColor = booking.is_fully_paid ? green : amber;
    page.drawText(paymentStatus, { x: colX[2] + 8, y, font: helveticaBold, size: 10, color: statusColor });
    const totalStr = formatCurrency(booking.total_price);
    page.drawText(totalStr, { x: colX[3] - helvetica.widthOfTextAtSize(totalStr, 10), y, font: helvetica, size: 10, color: black });

    // Table row bottom line
    y -= 14;
    page.drawLine({ start: { x: mx, y }, end: { x: w - mx, y }, thickness: 0.5, color: rgb(0.95, 0.96, 0.96) });

    // --- SUMMARY (right-aligned) ---
    y -= 30;
    const sumX = w - mx - 220;
    const sumValX = w - mx;

    // Sub Total
    page.drawText("Sub Total", { x: sumX, y, font: helvetica, size: 10, color: black });
    const st = formatCurrency(booking.total_price);
    page.drawText(st, { x: sumValX - helvetica.widthOfTextAtSize(st, 10), y, font: helvetica, size: 10, color: black });

    // DP Dibayar
    y -= 22;
    page.drawText("DP Dibayar", { x: sumX, y, font: helvetica, size: 10, color: black });
    const dp = `- ${formatCurrency(booking.dp_paid)}`;
    page.drawText(dp, { x: sumValX - helvetica.widthOfTextAtSize(dp, 10), y, font: helvetica, size: 10, color: black });

    // Total divider
    y -= 14;
    page.drawLine({ start: { x: sumX, y }, end: { x: sumValX, y }, thickness: 1.5, color: black });

    // Sisa Pembayaran
    y -= 20;
    page.drawText("Sisa Pembayaran", { x: sumX, y, font: helveticaBold, size: 13, color: black });
    const rem = formatCurrency(remaining);
    page.drawText(rem, { x: sumValX - helveticaBold.widthOfTextAtSize(rem, 13), y, font: helveticaBold, size: 13, color: black });

    // --- FOOTER ---
    y -= 60;
    page.drawLine({ start: { x: mx, y }, end: { x: w - mx, y }, thickness: 0.5, color: lightGray });
    y -= 16;
    const footerText = `Terima kasih atas kepercayaan Anda. Invoice ini digenerate otomatis oleh ${studioName}.`;
    const ftw = helvetica.widthOfTextAtSize(footerText, 9);
    page.drawText(footerText, { x: (w - ftw) / 2, y, font: helvetica, size: 9, color: gray });

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="Invoice-${booking.booking_code}.pdf"`,
        },
    });
}
