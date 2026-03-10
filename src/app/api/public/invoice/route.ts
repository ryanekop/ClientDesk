import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfPrinter = require("pdfmake");

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function formatCurrency(n: number) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

const fonts = {
    Helvetica: {
        normal: "Helvetica",
        bold: "Helvetica-Bold",
        italics: "Helvetica-Oblique",
        bolditalics: "Helvetica-BoldOblique",
    },
};

export async function GET(request: NextRequest) {
    const code = request.nextUrl.searchParams.get("code");
    if (!code) {
        return NextResponse.json({ error: "Booking code required" }, { status: 400 });
    }

    // Fetch booking
    const { data: booking, error } = await supabaseAdmin
        .from("bookings")
        .select("id, booking_code, client_name, client_whatsapp, session_date, total_price, dp_paid, is_fully_paid, status, user_id, services(name)")
        .eq("booking_code", code)
        .single();

    if (!booking || error) {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Fetch vendor info
    const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("studio_name, invoice_logo_url")
        .eq("id", booking.user_id)
        .single();

    const studioName = profile?.studio_name || "Studio";
    const remaining = booking.total_price - booking.dp_paid;
    const date = booking.session_date
        ? new Date(booking.session_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
        : "-";
    const now = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const serviceName = (booking.services as any)?.name || "Layanan";
    const paymentStatus = booking.is_fully_paid ? "Lunas" : "Belum Lunas";

    const docDefinition: TDocumentDefinitions = {
        defaultStyle: { font: "Helvetica", fontSize: 10 },
        pageSize: "A4",
        pageMargins: [40, 40, 40, 40],
        content: [
            // Header
            {
                columns: [
                    {
                        stack: [
                            { text: studioName, fontSize: 18, bold: true, margin: [0, 0, 0, 2] } as Content,
                            { text: "Studio Management", fontSize: 9, color: "#6b7280" } as Content,
                        ],
                        width: "*",
                    },
                    {
                        stack: [
                            { text: "INVOICE", fontSize: 22, bold: true, alignment: "right", margin: [0, 0, 0, 2] } as Content,
                            { text: booking.booking_code, fontSize: 10, color: "#6b7280", alignment: "right" } as Content,
                            { text: now, fontSize: 9, color: "#6b7280", alignment: "right" } as Content,
                        ],
                        width: "auto",
                    },
                ],
                margin: [0, 0, 0, 20],
            } as Content,

            // Divider
            { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: "#e5e7eb" }], margin: [0, 0, 0, 20] } as Content,

            // Client Info
            { text: "DETAIL KLIEN", fontSize: 8, bold: true, color: "#9ca3af", letterSpacing: 1, margin: [0, 0, 0, 6] } as Content,
            { text: booking.client_name, fontSize: 12, bold: true, margin: [0, 0, 0, 2] } as Content,
            { text: booking.client_whatsapp || "-", fontSize: 10, color: "#6b7280", margin: [0, 0, 0, 20] } as Content,

            // Table
            {
                table: {
                    headerRows: 1,
                    widths: ["*", "auto", "auto", "auto"],
                    body: [
                        [
                            { text: "Layanan", bold: true, fontSize: 8, color: "#6b7280", fillColor: "#f9fafb", margin: [0, 6, 0, 6] },
                            { text: "Jadwal", bold: true, fontSize: 8, color: "#6b7280", fillColor: "#f9fafb", margin: [0, 6, 0, 6] },
                            { text: "Status", bold: true, fontSize: 8, color: "#6b7280", fillColor: "#f9fafb", margin: [0, 6, 0, 6] },
                            { text: "Total", bold: true, fontSize: 8, color: "#6b7280", fillColor: "#f9fafb", alignment: "right", margin: [0, 6, 0, 6] },
                        ],
                        [
                            { text: serviceName, fontSize: 10, margin: [0, 8, 0, 8] },
                            { text: date, fontSize: 10, margin: [0, 8, 0, 8] },
                            { text: paymentStatus, fontSize: 10, color: booking.is_fully_paid ? "#16a34a" : "#d97706", bold: true, margin: [0, 8, 0, 8] },
                            { text: formatCurrency(booking.total_price), fontSize: 10, alignment: "right", margin: [0, 8, 0, 8] },
                        ],
                    ],
                },
                layout: {
                    hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length) ? 0 : 0.5,
                    vLineWidth: () => 0,
                    hLineColor: () => "#e5e7eb",
                    paddingLeft: () => 8,
                    paddingRight: () => 8,
                },
                margin: [0, 0, 0, 20],
            } as Content,

            // Summary
            {
                columns: [
                    { width: "*", text: "" },
                    {
                        width: 220,
                        table: {
                            widths: ["*", "auto"],
                            body: [
                                [
                                    { text: "Sub Total", fontSize: 10, border: [false, false, false, false], margin: [0, 4, 0, 4] },
                                    { text: formatCurrency(booking.total_price), fontSize: 10, alignment: "right", border: [false, false, false, false], margin: [0, 4, 0, 4] },
                                ],
                                [
                                    { text: "DP Dibayar", fontSize: 10, border: [false, false, false, false], margin: [0, 4, 0, 4] },
                                    { text: `- ${formatCurrency(booking.dp_paid)}`, fontSize: 10, alignment: "right", border: [false, false, false, false], margin: [0, 4, 0, 4] },
                                ],
                                [
                                    { text: "Sisa Pembayaran", fontSize: 13, bold: true, border: [false, true, false, false], margin: [0, 8, 0, 4] },
                                    { text: formatCurrency(remaining), fontSize: 13, bold: true, alignment: "right", border: [false, true, false, false], margin: [0, 8, 0, 4] },
                                ],
                            ],
                        },
                        layout: {
                            hLineWidth: (i: number) => i === 2 ? 1.5 : 0,
                            vLineWidth: () => 0,
                            hLineColor: () => "#111",
                        },
                    },
                ],
                margin: [0, 0, 0, 40],
            } as Content,

            // Footer
            { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: "#e5e7eb" }], margin: [0, 0, 0, 12] } as Content,
            { text: `Terima kasih atas kepercayaan Anda. Invoice ini digenerate otomatis oleh ${studioName}.`, alignment: "center", fontSize: 9, color: "#9ca3af" } as Content,
        ],
    };

    const printer = new PdfPrinter(fonts);
    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    // Collect PDF into buffer
    const chunks: Buffer[] = [];
    return new Promise<NextResponse>((resolve) => {
        pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
        pdfDoc.on("end", () => {
            const pdfBuffer = Buffer.concat(chunks);
            resolve(
                new NextResponse(pdfBuffer, {
                    headers: {
                        "Content-Type": "application/pdf",
                        "Content-Disposition": `inline; filename="Invoice-${booking.booking_code}.pdf"`,
                    },
                })
            );
        });
        pdfDoc.end();
    });
}
