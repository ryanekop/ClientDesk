"use client";

import * as React from "react";
import { Zap, Download, Upload, Loader2, FileSpreadsheet, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import {
    DEFAULT_CLIENT_STATUSES,
    getBookingStatusOptions,
    getInitialBookingStatus,
} from "@/lib/client-status";
import { createBookingCode, isDuplicateBookingCodeError } from "@/lib/booking-code";
import * as XLSX from "xlsx";

type Step = "upload" | "preview" | "confirm";

export function BatchImportButton({ onImported }: { onImported: () => void }) {
    const supabase = createClient();
    const [open, setOpen] = React.useState(false);
    const [step, setStep] = React.useState<Step>("upload");
    const [file, setFile] = React.useState<File | null>(null);
    const [preview, setPreview] = React.useState<Record<string, string>[]>([]);
    const [importing, setImporting] = React.useState(false);
    const [result, setResult] = React.useState<{ success: number; errors: string[] } | null>(null);

    function downloadTemplate() {
        const ws = XLSX.utils.aoa_to_sheet([
            ["Nama Klien *", "WhatsApp", "Tanggal Sesi (YYYY-MM-DD)", "Lokasi", "Harga Total", "DP Dibayar", "Status", "Catatan"],
            ["Contoh: Tiara", "08123456789", "2026-04-01", "Jakarta", "5000000", "1000000", "Booking Confirmed", "Info tambahan"],
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
            const rows = json.filter(row => {
                const name = String(row["Nama Klien *"] || "").trim();
                return name && !name.startsWith("Contoh:");
            });
            setPreview(rows);
            if (rows.length > 0) setStep("preview");
        };
        reader.readAsArrayBuffer(f);
    }

    async function handleImport() {
        if (preview.length === 0) return;
        setImporting(true);
        setStep("confirm");
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setImporting(false); return; }
        const { data: profile } = await supabase
            .from("profiles")
            .select("custom_client_statuses")
            .eq("id", user.id)
            .single();
        const statusOptions = getBookingStatusOptions((profile as { custom_client_statuses?: string[] | null } | null)?.custom_client_statuses || DEFAULT_CLIENT_STATUSES);
        const initialStatus = getInitialBookingStatus(statusOptions);

        let success = 0;
        const errors: string[] = [];
        const insertedBookingIds: string[] = [];

        for (let i = 0; i < preview.length; i++) {
            const row = preview[i];
            const clientName = String(row["Nama Klien *"] || "").trim();
            if (!clientName) { errors.push(`Baris ${i + 1}: Nama klien kosong`); continue; }

            const whatsapp = String(row["WhatsApp"] || "").trim() || null;
            const sessionDate = String(row["Tanggal Sesi (YYYY-MM-DD)"] || "").trim() || null;
            const location = String(row["Lokasi"] || "").trim() || null;
            const totalPrice = parseFloat(String(row["Harga Total"] || "0").replace(/[^0-9.]/g, "")) || 0;
            const dpPaid = parseFloat(String(row["DP Dibayar"] || "0").replace(/[^0-9.]/g, "")) || 0;
            const requestedStatus = String(row["Status"] || "").trim();
            const status = statusOptions.includes(requestedStatus) ? requestedStatus : initialStatus;
            const notes = String(row["Catatan"] || "").trim() || null;
            const bookingPayload = {
                user_id: user.id,
                client_name: clientName,
                client_whatsapp: whatsapp,
                session_date: sessionDate,
                location: location,
                total_price: totalPrice,
                dp_paid: dpPaid,
                is_fully_paid: dpPaid >= totalPrice && totalPrice > 0,
                status,
                client_status: status,
                notes: notes,
            };

            let insertError: { code?: string | null; message?: string | null } | null = null;
            let inserted = false;

            for (let attempt = 0; attempt < 5; attempt++) {
                const { data, error } = await supabase
                    .from("bookings")
                    .insert({
                        ...bookingPayload,
                        booking_code: createBookingCode(),
                    })
                    .select("id")
                    .single();

                if (!error && data?.id) {
                    inserted = true;
                    insertError = null;
                    insertedBookingIds.push(data.id);
                    break;
                }

                insertError = error;
                if (isDuplicateBookingCodeError(error)) {
                    continue;
                }
                break;
            }

            if (inserted) {
                success++;
            } else {
                errors.push(`Baris ${i + 1} (${clientName}): ${insertError?.message || "Gagal menyimpan booking"}`);
            }
        }

        if (insertedBookingIds.length > 0) {
            try {
                const syncResponse = await fetch("/api/google/sync", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ bookingIds: insertedBookingIds }),
                });
                const syncResult = await syncResponse.json().catch(() => null) as {
                    successCount?: number;
                    count?: number;
                    failedCount?: number;
                    skippedCount?: number;
                    errors?: string[];
                    skipped?: string[];
                } | null;

                if (!syncResponse.ok || !syncResult) {
                    errors.push("Booking berhasil diimport, tetapi sinkronisasi Google Calendar gagal dijalankan.");
                } else {
                    const successCount = Number(syncResult.successCount ?? syncResult.count ?? 0);
                    const failedCount = Number(syncResult.failedCount ?? 0);
                    const skippedCount = Number(syncResult.skippedCount ?? 0);
                    const syncErrors = Array.isArray(syncResult.errors) ? syncResult.errors : [];
                    const syncSkipped = Array.isArray(syncResult.skipped) ? syncResult.skipped : [];

                    if (failedCount > 0 || skippedCount > 0) {
                        errors.push(
                            `Sinkronisasi Google Calendar: berhasil ${successCount}, gagal ${failedCount}, dilewati ${skippedCount}.`,
                        );
                    }
                    for (const syncError of syncErrors) {
                        errors.push(`Sync gagal: ${syncError}`);
                    }
                    for (const skippedInfo of syncSkipped) {
                        errors.push(`Sync dilewati: ${skippedInfo}`);
                    }
                }
            } catch {
                errors.push("Booking berhasil diimport, tetapi sinkronisasi Google Calendar gagal dijalankan.");
            }
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
        setStep("upload");
    }

    const steps: { key: Step; label: string }[] = [
        { key: "upload", label: "Upload File" },
        { key: "preview", label: "Preview Data" },
        { key: "confirm", label: "Konfirmasi" },
    ];

    const currentStepIdx = steps.findIndex(s => s.key === step);

    return (
        <>
            <Button variant="outline" className="gap-2 h-9 shrink-0" onClick={() => setOpen(true)} title="Batch Import">
                <Zap className="w-4 h-4" />
                Batch Import
            </Button>

            <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
                <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Zap className="w-5 h-5" /> Batch Import Booking
                        </DialogTitle>
                        <DialogDescription>Import banyak booking sekaligus dari file Excel</DialogDescription>
                    </DialogHeader>

                    {/* Stepper */}
                    <div className="flex items-center gap-1 py-2">
                        {steps.map((s, i) => (
                            <React.Fragment key={s.key}>
                                <div className={`flex items-center gap-1.5 text-xs font-medium ${i <= currentStepIdx ? "text-foreground" : "text-muted-foreground"}`}>
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${i < currentStepIdx ? "bg-green-500 text-white" : i === currentStepIdx ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>
                                        {i < currentStepIdx ? "✓" : i + 1}
                                    </div>
                                    <span className="hidden sm:inline">{s.label}</span>
                                </div>
                                {i < steps.length - 1 && <div className={`flex-1 h-px ${i < currentStepIdx ? "bg-green-500" : "bg-border"}`} />}
                            </React.Fragment>
                        ))}
                    </div>

                    <div className="space-y-4">
                        {/* Step 1: Upload */}
                        {step === "upload" && (
                            <>
                                <Button variant="outline" className="w-full gap-2 border-green-300 text-green-700 dark:text-green-400 dark:border-green-500/30 hover:bg-green-50 dark:hover:bg-green-500/10" onClick={downloadTemplate}>
                                    <Download className="w-4 h-4" /> Download Template XLSX
                                </Button>

                                <label className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-muted-foreground/20 hover:border-muted-foreground/40 transition-colors cursor-pointer bg-muted/10">
                                    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} className="hidden" />
                                    <Upload className="w-8 h-8 text-muted-foreground/50" />
                                    <div className="text-center">
                                        <p className="text-sm text-muted-foreground">Drag & drop file .xlsx atau .csv di sini</p>
                                        <p className="text-xs text-muted-foreground/60 mt-1">atau</p>
                                    </div>
                                    <Button variant="outline" size="sm" asChild>
                                        <span>Pilih File</span>
                                    </Button>
                                </label>
                            </>
                        )}

                        {/* Step 2: Preview */}
                        {step === "preview" && (
                            <>
                                {file && (
                                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border text-sm">
                                        <FileSpreadsheet className="w-4 h-4 text-green-600 shrink-0" />
                                        <span className="flex-1 truncate font-medium">{file.name}</span>
                                        <span className="text-xs text-muted-foreground shrink-0">{preview.length} data</span>
                                    </div>
                                )}

                                <div className="rounded-lg border overflow-hidden">
                                    <div className="overflow-x-auto max-h-[240px]">
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
                            </>
                        )}

                        {/* Step 3: Confirm / Result */}
                        {step === "confirm" && (
                            <>
                                {importing ? (
                                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                        <p className="text-sm text-muted-foreground">Mengimport {preview.length} booking...</p>
                                    </div>
                                ) : result ? (
                                    <div className={`p-4 rounded-lg border text-sm ${result.errors.length === 0 ? "bg-green-50 dark:bg-green-500/5 border-green-200 dark:border-green-500/20" : "bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20"}`}>
                                        <div className="flex items-center gap-2 font-medium">
                                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                                            {result.success} booking berhasil diimport
                                        </div>
                                        {result.errors.length > 0 && (
                                            <div className="mt-2 text-xs text-red-600 dark:text-red-400 space-y-0.5">
                                                {result.errors.map((err, i) => <p key={i}>{err}</p>)}
                                            </div>
                                        )}
                                    </div>
                                ) : null}
                            </>
                        )}
                    </div>

                    <DialogFooter className="gap-2 flex-col-reverse sm:flex-row">
                        {step === "upload" && (
                            <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto">Tutup</Button>
                        )}
                        {step === "preview" && (
                            <>
                                <Button variant="outline" onClick={() => { setStep("upload"); setFile(null); setPreview([]); }} className="gap-1.5 w-full sm:w-auto">
                                    <ArrowLeft className="w-3.5 h-3.5" /> Kembali
                                </Button>
                                <Button onClick={handleImport} className="gap-1.5 w-full sm:w-auto" disabled={preview.length === 0}>
                                    Import {preview.length} Booking <ArrowRight className="w-3.5 h-3.5" />
                                </Button>
                            </>
                        )}
                        {step === "confirm" && result && (
                            <Button onClick={handleClose} className="w-full sm:w-auto">Selesai</Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
