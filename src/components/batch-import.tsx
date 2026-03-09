"use client";

import * as React from "react";
import { Upload, Download, Loader2, X, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import * as XLSX from "xlsx";

function generateBookingCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

export function BatchImportButton({ onImported }: { onImported: () => void }) {
    const supabase = createClient();
    const [open, setOpen] = React.useState(false);
    const [file, setFile] = React.useState<File | null>(null);
    const [preview, setPreview] = React.useState<Record<string, string>[]>([]);
    const [importing, setImporting] = React.useState(false);
    const [result, setResult] = React.useState<{ success: number; errors: string[] } | null>(null);

    function downloadTemplate() {
        const ws = XLSX.utils.aoa_to_sheet([
            ["Nama Klien *", "WhatsApp", "Tanggal Sesi (YYYY-MM-DD)", "Lokasi", "Harga Total", "DP Dibayar", "Status", "Catatan"],
            ["Contoh: Tiara", "08123456789", "2026-04-01", "Jakarta", "5000000", "1000000", "Pending", "Info tambahan"],
        ]);

        ws["!cols"] = [
            { wch: 20 }, { wch: 18 }, { wch: 24 }, { wch: 25 },
            { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 25 },
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Booking Template");
        XLSX.writeFile(wb, "template_batch_booking.xlsx");
    }

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0];
        if (!f) return;
        setFile(f);
        setResult(null);

        const reader = new FileReader();
        reader.onload = (ev) => {
            const data = new Uint8Array(ev.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
            // Skip header-like rows
            const rows = json.filter(row => {
                const name = String(row["Nama Klien *"] || "").trim();
                return name && !name.startsWith("Contoh:");
            });
            setPreview(rows);
        };
        reader.readAsArrayBuffer(f);
    }

    async function handleImport() {
        if (preview.length === 0) return;
        setImporting(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setImporting(false); return; }

        let success = 0;
        const errors: string[] = [];

        for (let i = 0; i < preview.length; i++) {
            const row = preview[i];
            const clientName = String(row["Nama Klien *"] || "").trim();
            if (!clientName) { errors.push(`Baris ${i + 1}: Nama klien kosong`); continue; }

            const bookingCode = `INV-${generateBookingCode()}`;
            const whatsapp = String(row["WhatsApp"] || "").trim() || null;
            const sessionDate = String(row["Tanggal Sesi (YYYY-MM-DD)"] || "").trim() || null;
            const location = String(row["Lokasi"] || "").trim() || null;
            const totalPrice = parseFloat(String(row["Harga Total"] || "0").replace(/[^0-9.]/g, "")) || 0;
            const dpPaid = parseFloat(String(row["DP Dibayar"] || "0").replace(/[^0-9.]/g, "")) || 0;
            const status = String(row["Status"] || "Pending").trim();
            const notes = String(row["Catatan"] || "").trim() || null;

            const { error } = await supabase.from("bookings").insert({
                user_id: user.id,
                booking_code: bookingCode,
                client_name: clientName,
                client_whatsapp: whatsapp,
                session_date: sessionDate,
                location: location,
                total_price: totalPrice,
                dp_paid: dpPaid,
                is_fully_paid: dpPaid >= totalPrice && totalPrice > 0,
                status: ["Pending", "DP", "Terjadwal", "Selesai", "Edit", "Batal"].includes(status) ? status : "Pending",
                notes: notes,
            });

            if (error) { errors.push(`Baris ${i + 1} (${clientName}): ${error.message}`); }
            else { success++; }
        }

        setResult({ success, errors });
        setImporting(false);
        if (success > 0) onImported();
    }

    function handleClose() {
        setOpen(false);
        setFile(null);
        setPreview([]);
        setResult(null);
    }

    return (
        <>
            <Button variant="outline" className="gap-2 h-9" onClick={() => setOpen(true)}>
                <Upload className="w-4 h-4" /> Batch Import
            </Button>

            <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Batch Import Booking</DialogTitle>
                        <DialogDescription>Import banyak booking sekaligus menggunakan file Excel (.xlsx/.xls)</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Step 1: Download Template */}
                        <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/10">
                                <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium">1. Download Template</p>
                                <p className="text-xs text-muted-foreground">Download template Excel lalu isi data booking</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={downloadTemplate}>
                                <Download className="w-3.5 h-3.5 mr-1.5" /> Download
                            </Button>
                        </div>

                        {/* Step 2: Upload */}
                        <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-500/10">
                                <Upload className="w-4 h-4 text-green-600 dark:text-green-400" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium">2. Upload File</p>
                                <p className="text-xs text-muted-foreground">
                                    {file ? (
                                        <span className="flex items-center gap-1.5">
                                            <FileSpreadsheet className="w-3.5 h-3.5" />
                                            {file.name} ({preview.length} data)
                                        </span>
                                    ) : "Pilih file Excel yang sudah diisi"}
                                </p>
                            </div>
                            <label className="cursor-pointer">
                                <input type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
                                <Button variant="outline" size="sm" asChild>
                                    <span><Upload className="w-3.5 h-3.5 mr-1.5" /> Pilih File</span>
                                </Button>
                            </label>
                        </div>

                        {/* Preview */}
                        {preview.length > 0 && (
                            <div className="rounded-lg border overflow-hidden">
                                <div className="overflow-x-auto max-h-[200px]">
                                    <table className="w-full text-xs">
                                        <thead className="bg-muted/50 sticky top-0">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
                                                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Nama</th>
                                                <th className="px-3 py-2 text-left font-medium text-muted-foreground">WA</th>
                                                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Jadwal</th>
                                                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Harga</th>
                                                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/50">
                                            {preview.map((row, i) => (
                                                <tr key={i} className="hover:bg-muted/30">
                                                    <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                                                    <td className="px-3 py-1.5 font-medium">{row["Nama Klien *"]}</td>
                                                    <td className="px-3 py-1.5">{row["WhatsApp"] || "-"}</td>
                                                    <td className="px-3 py-1.5">{row["Tanggal Sesi (YYYY-MM-DD)"] || "-"}</td>
                                                    <td className="px-3 py-1.5">{row["Harga Total"] || "0"}</td>
                                                    <td className="px-3 py-1.5">{row["Status"] || "Pending"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Result */}
                        {result && (
                            <div className={`p-3 rounded-lg border text-sm ${result.errors.length === 0 ? "bg-green-50 dark:bg-green-500/5 border-green-200 dark:border-green-500/20" : "bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20"}`}>
                                <div className="flex items-center gap-2 font-medium">
                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                    {result.success} booking berhasil diimport
                                </div>
                                {result.errors.length > 0 && (
                                    <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                                        {result.errors.map((err, i) => <p key={i}>{err}</p>)}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={handleClose}>Tutup</Button>
                        <Button
                            disabled={preview.length === 0 || importing || !!result}
                            onClick={handleImport}
                            className="gap-2"
                        >
                            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            Import {preview.length} Booking
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
