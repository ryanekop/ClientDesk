"use client";

import * as React from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Step = "upload" | "preview" | "confirm";

type PreviewRow = {
  rowNumber: number;
  externalImportId: string;
  clientName: string;
  eventType: string;
  sessionDate: string | null;
  status: string;
  mainServices: string[];
  addonServices: string[];
  freelancers: string[];
  dpPaid: number;
  totalPrice: number;
  errors: string[];
  warnings: string[];
};

type ValidationResponse = {
  success: boolean;
  canCommit: boolean;
  summary: {
    totalRows: number;
    validRows: number;
    warningRows: number;
    errorRows: number;
  };
  previewRows: PreviewRow[];
  report: {
    fileName: string;
    base64: string;
  };
  error?: string;
};

type CommitResponse = {
  success: boolean;
  summary?: {
    totalRows: number;
    importedRows: number;
    failedRows: number;
  };
  syncSummary?: {
    successCount: number;
    failedCount: number;
    skippedCount: number;
    errors: string[];
    skipped: string[];
  };
  report?: {
    fileName: string;
    base64: string;
  };
  error?: string;
};

function downloadBase64Xlsx(base64: string, fileName: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function BatchImportButton({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<Step>("upload");
  const [file, setFile] = React.useState<File | null>(null);
  const [validating, setValidating] = React.useState(false);
  const [committing, setCommitting] = React.useState(false);
  const [validation, setValidation] = React.useState<ValidationResponse | null>(null);
  const [commitResult, setCommitResult] = React.useState<CommitResponse | null>(null);
  const [fatalError, setFatalError] = React.useState<string | null>(null);

  const currentStepIdx = React.useMemo(() => {
    const map: Record<Step, number> = {
      upload: 0,
      preview: 1,
      confirm: 2,
    };
    return map[step];
  }, [step]);

  function resetState() {
    setOpen(false);
    setStep("upload");
    setFile(null);
    setValidating(false);
    setCommitting(false);
    setValidation(null);
    setCommitResult(null);
    setFatalError(null);
  }

  async function handleDownloadTemplate() {
    setFatalError(null);
    try {
      const response = await fetch("/api/bookings/import/template", {
        method: "GET",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error || "Gagal download template.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "template_batch_booking_v2.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal download template.";
      setFatalError(message);
    }
  }

  async function runValidation(selectedFile: File) {
    setValidating(true);
    setFatalError(null);
    setValidation(null);
    setCommitResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/bookings/import/validate", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as
        | ValidationResponse
        | { success: false; error?: string }
        | null;

      if (!response.ok || !payload || payload.success === false) {
        const message =
          payload && "error" in payload && payload.error
            ? payload.error
            : "Gagal memvalidasi file import.";
        throw new Error(message);
      }

      setValidation(payload);
      setStep("preview");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Gagal memvalidasi file import.";
      setFatalError(message);
    } finally {
      setValidating(false);
    }
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    void runValidation(selected);
  }

  async function handleCommit() {
    if (!file || !validation || !validation.canCommit) return;
    setCommitting(true);
    setStep("confirm");
    setFatalError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/bookings/import/commit", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as CommitResponse | null;
      if (!payload) {
        throw new Error("Gagal commit import.");
      }

      if (!response.ok || payload.success === false) {
        setCommitResult(payload);
        return;
      }

      setCommitResult(payload);
      if (payload.success && (payload.summary?.importedRows || 0) > 0) {
        onImported();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal commit import.";
      setCommitResult({ success: false, error: message });
    } finally {
      setCommitting(false);
    }
  }

  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload File" },
    { key: "preview", label: "Preview & Validasi" },
    { key: "confirm", label: "Commit" },
  ];

  return (
    <>
      <Button
        variant="outline"
        className="gap-2 h-9 shrink-0"
        onClick={() => setOpen(true)}
        title="Batch Import"
      >
        <Zap className="w-4 h-4" />
        Batch Import
      </Button>

      <Dialog open={open} onOpenChange={(next) => !next && resetState()}>
        <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" /> Batch Import Booking v2
            </DialogTitle>
            <DialogDescription>
              Upload file XLSX, validasi dulu, lalu commit saat error = 0.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-1 py-2">
            {steps.map((item, index) => (
              <React.Fragment key={item.key}>
                <div
                  className={`flex items-center gap-1.5 text-xs font-medium ${
                    index <= currentStepIdx ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                      index < currentStepIdx
                        ? "bg-green-500 text-white"
                        : index === currentStepIdx
                          ? "bg-foreground text-background"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {index < currentStepIdx ? "✓" : index + 1}
                  </div>
                  <span className="hidden sm:inline">{item.label}</span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-px ${
                      index < currentStepIdx ? "bg-green-500" : "bg-border"
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="space-y-4">
            {fatalError && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{fatalError}</span>
              </div>
            )}

            {step === "upload" && (
              <>
                <Button
                  variant="outline"
                  className="w-full gap-2 border-green-300 text-green-700 dark:text-green-400 dark:border-green-500/30 hover:bg-green-50 dark:hover:bg-green-500/10"
                  onClick={handleDownloadTemplate}
                >
                  <Download className="w-4 h-4" /> Download Template XLSX v2
                </Button>

                <label className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-muted-foreground/20 hover:border-muted-foreground/40 transition-colors cursor-pointer bg-muted/10">
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={validating}
                  />
                  {validating ? (
                    <Loader2 className="w-8 h-8 text-muted-foreground/50 animate-spin" />
                  ) : (
                    <Upload className="w-8 h-8 text-muted-foreground/50" />
                  )}
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">
                      Upload file .xlsx sesuai template v2
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      External import ID digenerate otomatis, admin tidak perlu isi manual
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Validasi akan jalan otomatis setelah file dipilih
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <span>{validating ? "Memvalidasi..." : "Pilih File"}</span>
                  </Button>
                </label>
              </>
            )}

            {step === "preview" && validation && (
              <>
                {file && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border text-sm">
                    <FileSpreadsheet className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="flex-1 truncate font-medium">{file.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {validation.summary.totalRows} baris
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="rounded-md border p-2 bg-muted/20">
                    <p className="text-muted-foreground">Valid</p>
                    <p className="font-semibold text-green-600">{validation.summary.validRows}</p>
                  </div>
                  <div className="rounded-md border p-2 bg-muted/20">
                    <p className="text-muted-foreground">Warning</p>
                    <p className="font-semibold text-amber-600">{validation.summary.warningRows}</p>
                  </div>
                  <div className="rounded-md border p-2 bg-muted/20">
                    <p className="text-muted-foreground">Error</p>
                    <p className="font-semibold text-red-600">{validation.summary.errorRows}</p>
                  </div>
                  <div className="rounded-md border p-2 bg-muted/20">
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-semibold">{validation.summary.totalRows}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      downloadBase64Xlsx(validation.report.base64, validation.report.fileName)
                    }
                    className="gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Report Validasi
                  </Button>
                  {!validation.canCommit && (
                    <span className="text-xs text-red-600 self-center">
                      Commit dikunci karena masih ada error.
                    </span>
                  )}
                </div>

                <div className="rounded-lg border overflow-hidden">
                  <div className="overflow-x-auto max-h-[280px]">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Row</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Import ID (otomatis)</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Nama Klien</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Event</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Issue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {validation.previewRows.slice(0, 120).map((row) => {
                          const hasError = row.errors.length > 0;
                          const hasWarning = row.warnings.length > 0;
                          return (
                            <tr key={row.rowNumber} className="hover:bg-muted/30 align-top">
                              <td className="px-3 py-1.5 text-muted-foreground">{row.rowNumber}</td>
                              <td className="px-3 py-1.5 font-mono">{row.externalImportId || "-"}</td>
                              <td className="px-3 py-1.5 font-medium">{row.clientName || "-"}</td>
                              <td className="px-3 py-1.5">{row.eventType || "-"}</td>
                              <td className="px-3 py-1.5">{row.status || "-"}</td>
                              <td className="px-3 py-1.5">
                                {hasError ? (
                                  <span className="text-red-600">{row.errors[0]}</span>
                                ) : hasWarning ? (
                                  <span className="text-amber-600">{row.warnings[0]}</span>
                                ) : (
                                  <span className="text-green-600">OK</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {step === "confirm" && (
              <>
                {committing ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Commit import sedang diproses...</p>
                  </div>
                ) : commitResult ? (
                  <div
                    className={`p-4 rounded-lg border text-sm ${
                      commitResult.success
                        ? "bg-green-50 dark:bg-green-500/5 border-green-200 dark:border-green-500/20"
                        : "bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium">
                      {commitResult.success ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      )}
                      {commitResult.success
                        ? `${commitResult.summary?.importedRows || 0} booking berhasil diimport`
                        : "Commit import gagal"}
                    </div>
                    {commitResult.summary && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Total {commitResult.summary.totalRows}, berhasil {commitResult.summary.importedRows}, gagal {commitResult.summary.failedRows}
                      </p>
                    )}
                    {commitResult.syncSummary && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Sync Calendar: berhasil {commitResult.syncSummary.successCount}, gagal {commitResult.syncSummary.failedCount}, dilewati {commitResult.syncSummary.skippedCount}
                      </p>
                    )}
                    {commitResult.error && (
                      <p className="mt-2 text-xs text-red-600">{commitResult.error}</p>
                    )}
                    {commitResult.report && (
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() =>
                            downloadBase64Xlsx(
                              commitResult.report?.base64 || "",
                              commitResult.report?.fileName || "import_commit_report.xlsx",
                            )
                          }
                        >
                          <Download className="w-3.5 h-3.5" /> Download Report Commit
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                    Menunggu proses commit.
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="gap-2 flex-col-reverse sm:flex-row">
            {step === "upload" && (
              <Button variant="outline" onClick={resetState} className="w-full sm:w-auto">
                Tutup
              </Button>
            )}

            {step === "preview" && validation && (
              <>
                <Button
                  variant="outline"
                  className="gap-1.5 w-full sm:w-auto"
                  onClick={() => {
                    setStep("upload");
                    setValidation(null);
                    setCommitResult(null);
                    setFatalError(null);
                  }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Ganti File
                </Button>
                <Button
                  onClick={handleCommit}
                  className="gap-1.5 w-full sm:w-auto"
                  disabled={!validation.canCommit}
                >
                  Commit Import <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </>
            )}

            {step === "confirm" && (
              <Button onClick={resetState} className="w-full sm:w-auto">
                Selesai
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
