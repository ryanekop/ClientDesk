"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
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
import { cn } from "@/lib/utils";

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

type BatchImportButtonProps = {
  onImported: () => void;
  canCommitBookings?: boolean;
  bookingWriteBlockedMessage?: string;
  buttonClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  strings?: Partial<BatchImportStrings>;
};

type BatchImportStrings = {
  blockedBookingWriteFallback: string;
  failedDownloadTemplate: string;
  failedValidateImport: string;
  failedCommitImport: string;
  stepUpload: string;
  stepPreview: string;
  stepConfirm: string;
  triggerTitle: string;
  triggerLabel: string;
  dialogTitle: string;
  dialogDescription: string;
  downloadTemplateLabel: string;
  uploadPrimaryHint: string;
  uploadHintAutoId: string;
  uploadHintAutoValidate: string;
  validatingLabel: string;
  chooseFileLabel: string;
  rowsLabel: string;
  statValid: string;
  statWarning: string;
  statError: string;
  statTotal: string;
  downloadValidationReportLabel: string;
  commitLockedMessage: string;
  headerRow: string;
  headerClientName: string;
  headerEvent: string;
  headerStatus: string;
  headerIssue: string;
  okLabel: string;
  commitProcessingLabel: string;
  commitSuccessLabel: (count: number) => string;
  commitFailedLabel: string;
  commitSummaryLabel: (total: number, success: number, failed: number) => string;
  commitSyncSummaryLabel: (success: number, failed: number, skipped: number) => string;
  downloadCommitReportLabel: string;
  waitingCommitLabel: string;
  closeLabel: string;
  changeFileLabel: string;
  commitImportLabel: string;
  finishLabel: string;
};

type BatchImportTranslator = ReturnType<typeof useTranslations<"BatchImport">>;

function buildBatchImportStrings(t: BatchImportTranslator): BatchImportStrings {
  return {
    blockedBookingWriteFallback: t("blockedBookingWriteFallback"),
    failedDownloadTemplate: t("failedDownloadTemplate"),
    failedValidateImport: t("failedValidateImport"),
    failedCommitImport: t("failedCommitImport"),
    stepUpload: t("stepUpload"),
    stepPreview: t("stepPreview"),
    stepConfirm: t("stepConfirm"),
    triggerTitle: t("triggerTitle"),
    triggerLabel: t("triggerLabel"),
    dialogTitle: t("dialogTitle"),
    dialogDescription: t("dialogDescription"),
    downloadTemplateLabel: t("downloadTemplateLabel"),
    uploadPrimaryHint: t("uploadPrimaryHint"),
    uploadHintAutoId: t("uploadHintAutoId"),
    uploadHintAutoValidate: t("uploadHintAutoValidate"),
    validatingLabel: t("validatingLabel"),
    chooseFileLabel: t("chooseFileLabel"),
    rowsLabel: t("rowsLabel"),
    statValid: t("statValid"),
    statWarning: t("statWarning"),
    statError: t("statError"),
    statTotal: t("statTotal"),
    downloadValidationReportLabel: t("downloadValidationReportLabel"),
    commitLockedMessage: t("commitLockedMessage"),
    headerRow: t("headerRow"),
    headerClientName: t("headerClientName"),
    headerEvent: t("headerEvent"),
    headerStatus: t("headerStatus"),
    headerIssue: t("headerIssue"),
    okLabel: t("okLabel"),
    commitProcessingLabel: t("commitProcessingLabel"),
    commitSuccessLabel: (count) => t("commitSuccessLabel", { count }),
    commitFailedLabel: t("commitFailedLabel"),
    commitSummaryLabel: (total, success, failed) =>
      t("commitSummaryLabel", { total, success, failed }),
    commitSyncSummaryLabel: (success, failed, skipped) =>
      t("commitSyncSummaryLabel", { success, failed, skipped }),
    downloadCommitReportLabel: t("downloadCommitReportLabel"),
    waitingCommitLabel: t("waitingCommitLabel"),
    closeLabel: t("closeLabel"),
    changeFileLabel: t("changeFileLabel"),
    commitImportLabel: t("commitImportLabel"),
    finishLabel: t("finishLabel"),
  };
}

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

function parsePastedTable(raw: string): string[][] {
  if (!raw.trim()) return [];

  return raw
    .split(/\r?\n/)
    .map((line) =>
      line
        .split("\t")
        .map((cell) => cell.trim()),
    )
    .filter((row) => row.some((cell) => cell.length > 0));
}

export function BatchImportButton({
  onImported,
  canCommitBookings = true,
  bookingWriteBlockedMessage,
  buttonClassName,
  open: controlledOpen,
  onOpenChange,
  strings,
}: BatchImportButtonProps) {
  const t = useTranslations("BatchImport");
  const ui = React.useMemo(
    () => ({
      ...buildBatchImportStrings(t),
      ...strings,
    }),
    [strings, t],
  );
  const blockedMessage =
    bookingWriteBlockedMessage || ui.blockedBookingWriteFallback;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const [step, setStep] = React.useState<Step>("upload");
  const [rawPasteText, setRawPasteText] = React.useState("");
  const [pasteRows, setPasteRows] = React.useState<string[][]>([]);
  const [headerMode, setHeaderMode] = React.useState<"auto" | "yes" | "no">("auto");
  const [validating, setValidating] = React.useState(false);
  const [committing, setCommitting] = React.useState(false);
  const [validation, setValidation] = React.useState<ValidationResponse | null>(null);
  const [commitResult, setCommitResult] = React.useState<CommitResponse | null>(null);
  const [fatalError, setFatalError] = React.useState<string | null>(null);
  const isControlled = typeof controlledOpen === "boolean";
  const open = isControlled ? Boolean(controlledOpen) : uncontrolledOpen;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

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
    setRawPasteText("");
    setPasteRows([]);
    setHeaderMode("auto");
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
        throw new Error(payload?.error || ui.failedDownloadTemplate);
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
        error instanceof Error ? error.message : ui.failedDownloadTemplate;
      setFatalError(message);
    }
  }

  async function runValidationFromPaste(nextRows: string[][]) {
    setValidating(true);
    setFatalError(null);
    setValidation(null);
    setCommitResult(null);

    try {
      const response = await fetch("/api/bookings/import/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "paste",
          rows: nextRows,
          hasHeader:
            headerMode === "auto" ? null : headerMode === "yes",
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | ValidationResponse
        | { success: false; error?: string }
        | null;

      if (!response.ok || !payload || payload.success === false) {
        const message =
          payload && "error" in payload && payload.error
            ? payload.error
            : ui.failedValidateImport;
        throw new Error(message);
      }

      setValidation(payload);
      setStep("preview");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : ui.failedValidateImport;
      setFatalError(message);
    } finally {
      setValidating(false);
    }
  }

  async function handleCommit() {
    if (!validation || !validation.canCommit || pasteRows.length === 0) return;
    if (!canCommitBookings) {
      setFatalError(blockedMessage);
      return;
    }
    setCommitting(true);
    setStep("confirm");
    setFatalError(null);

    try {
      const response = await fetch("/api/bookings/import/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "paste",
          rows: pasteRows,
          hasHeader:
            headerMode === "auto" ? null : headerMode === "yes",
        }),
      });

      const payload = (await response.json().catch(() => null)) as CommitResponse | null;
      if (!payload) {
        throw new Error(ui.failedCommitImport);
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
        error instanceof Error ? error.message : ui.failedCommitImport;
      setCommitResult({ success: false, error: message });
    } finally {
      setCommitting(false);
    }
  }

  function handlePasteInputChange(nextValue: string) {
    setRawPasteText(nextValue);
    setPasteRows(parsePastedTable(nextValue));
    setValidation(null);
    setCommitResult(null);
  }

  function handleValidatePaste() {
    if (pasteRows.length === 0) {
      setFatalError(ui.failedValidateImport);
      return;
    }
    void runValidationFromPaste(pasteRows);
  }

  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: ui.stepUpload },
    { key: "preview", label: ui.stepPreview },
    { key: "confirm", label: ui.stepConfirm },
  ];

  return (
    <>
      <Button
        variant="outline"
        className={cn("h-9 gap-2 shrink-0", buttonClassName)}
        onClick={() => setOpen(true)}
        title={ui.triggerTitle}
      >
        <Zap className="w-4 h-4" />
        {ui.triggerLabel}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) {
            setOpen(true);
            return;
          }
          resetState();
        }}
      >
        <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" /> {ui.dialogTitle}
            </DialogTitle>
            <DialogDescription>
              {ui.dialogDescription}
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
                  <Download className="w-4 h-4" /> {ui.downloadTemplateLabel}
                </Button>

                <div className="space-y-3 rounded-xl border bg-muted/10 p-4">
                  <div className="flex items-start gap-2">
                    {validating ? (
                      <Loader2 className="mt-0.5 w-4 h-4 text-muted-foreground/70 animate-spin" />
                    ) : (
                      <Upload className="mt-0.5 w-4 h-4 text-muted-foreground/70" />
                    )}
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{ui.uploadPrimaryHint}</p>
                      <p className="text-xs text-muted-foreground/60">{ui.uploadHintAutoId}</p>
                      <p className="text-xs text-muted-foreground/60">{ui.uploadHintAutoValidate}</p>
                    </div>
                  </div>

                  <textarea
                    value={rawPasteText}
                    onChange={(event) => handlePasteInputChange(event.target.value)}
                    placeholder="Paste data dari Excel/Google Sheets di sini (Ctrl/Cmd + V)."
                    rows={8}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Header baris pertama:</span>
                    {[
                      { value: "auto" as const, label: "Auto" },
                      { value: "yes" as const, label: "Ya" },
                      { value: "no" as const, label: "Tidak" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setHeaderMode(option.value)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                          headerMode === option.value
                            ? "border-foreground bg-foreground text-background"
                            : "border-input text-muted-foreground hover:bg-muted/60"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  {pasteRows.length > 0 ? (
                    <div className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">
                      Terdeteksi {pasteRows.length} baris data.
                    </div>
                  ) : null}

                  {pasteRows.length > 0 ? (
                    <div className="rounded-lg border overflow-x-auto">
                      <table className="w-full text-xs">
                        <tbody className="divide-y divide-border/50">
                          {pasteRows.slice(0, 6).map((row, rowIndex) => (
                            <tr key={`${rowIndex}-${row.join("|")}`}>
                              {row.slice(0, 8).map((cell, columnIndex) => (
                                <td key={`${rowIndex}-${columnIndex}`} className="px-2 py-1.5">
                                  {cell || <span className="text-muted-foreground/50">-</span>}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={handleValidatePaste}
                      disabled={validating || pasteRows.length === 0}
                      className="gap-2"
                    >
                      {validating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : null}
                      {validating ? ui.validatingLabel : ui.chooseFileLabel}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handlePasteInputChange("")}
                      disabled={validating || !rawPasteText}
                    >
                      Bersihkan
                    </Button>
                  </div>
                </div>
              </>
            )}

            {step === "preview" && validation && (
              <>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border text-sm">
                  <FileSpreadsheet className="w-4 h-4 text-green-600 shrink-0" />
                  <span className="flex-1 truncate font-medium">Data paste siap commit</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {validation.summary.totalRows} {ui.rowsLabel}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="rounded-md border p-2 bg-muted/20">
                    <p className="text-muted-foreground">{ui.statValid}</p>
                    <p className="font-semibold text-green-600">{validation.summary.validRows}</p>
                  </div>
                  <div className="rounded-md border p-2 bg-muted/20">
                    <p className="text-muted-foreground">{ui.statWarning}</p>
                    <p className="font-semibold text-amber-600">{validation.summary.warningRows}</p>
                  </div>
                  <div className="rounded-md border p-2 bg-muted/20">
                    <p className="text-muted-foreground">{ui.statError}</p>
                    <p className="font-semibold text-red-600">{validation.summary.errorRows}</p>
                  </div>
                  <div className="rounded-md border p-2 bg-muted/20">
                    <p className="text-muted-foreground">{ui.statTotal}</p>
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
                    <Download className="w-3.5 h-3.5" /> {ui.downloadValidationReportLabel}
                  </Button>
                  {!validation.canCommit && (
                    <span className="text-xs text-red-600 self-center">
                      {ui.commitLockedMessage}
                    </span>
                  )}
                  {validation.canCommit && !canCommitBookings && (
                    <span className="text-xs text-amber-600 self-center">
                      {blockedMessage}
                    </span>
                  )}
                </div>

                <div className="rounded-lg border overflow-hidden">
                  <div className="overflow-x-auto max-h-[280px]">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">{ui.headerRow}</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">{ui.headerClientName}</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">{ui.headerEvent}</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">{ui.headerStatus}</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">{ui.headerIssue}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {validation.previewRows.slice(0, 120).map((row) => {
                          const hasError = row.errors.length > 0;
                          const hasWarning = row.warnings.length > 0;
                          return (
                            <tr key={row.rowNumber} className="hover:bg-muted/30 align-top">
                              <td className="px-3 py-1.5 text-muted-foreground">{row.rowNumber}</td>
                              <td className="px-3 py-1.5 font-medium">{row.clientName || "-"}</td>
                              <td className="px-3 py-1.5">{row.eventType || "-"}</td>
                              <td className="px-3 py-1.5">{row.status || "-"}</td>
                              <td className="px-3 py-1.5">
                                {hasError ? (
                                  <span className="text-red-600">{row.errors[0]}</span>
                                ) : hasWarning ? (
                                  <span className="text-amber-600">{row.warnings[0]}</span>
                                ) : (
                                  <span className="text-green-600">{ui.okLabel}</span>
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
                    <p className="text-sm text-muted-foreground">{ui.commitProcessingLabel}</p>
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
                        ? ui.commitSuccessLabel(commitResult.summary?.importedRows || 0)
                        : ui.commitFailedLabel}
                    </div>
                    {commitResult.summary && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {ui.commitSummaryLabel(
                          commitResult.summary.totalRows,
                          commitResult.summary.importedRows,
                          commitResult.summary.failedRows,
                        )}
                      </p>
                    )}
                    {commitResult.syncSummary && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {ui.commitSyncSummaryLabel(
                          commitResult.syncSummary.successCount,
                          commitResult.syncSummary.failedCount,
                          commitResult.syncSummary.skippedCount,
                        )}
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
                          <Download className="w-3.5 h-3.5" /> {ui.downloadCommitReportLabel}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                    {ui.waitingCommitLabel}
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="gap-2 flex-col-reverse sm:flex-row">
            {step === "upload" && (
              <Button variant="outline" onClick={resetState} className="w-full sm:w-auto">
                {ui.closeLabel}
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
                  <ArrowLeft className="w-3.5 h-3.5" /> {ui.changeFileLabel}
                </Button>
                <Button
                  onClick={handleCommit}
                  className="gap-1.5 w-full sm:w-auto"
                  disabled={!validation.canCommit || !canCommitBookings}
                >
                  {ui.commitImportLabel} <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </>
            )}

            {step === "confirm" && (
              <Button onClick={resetState} className="w-full sm:w-auto">
                {ui.finishLabel}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
