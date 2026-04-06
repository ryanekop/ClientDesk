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
  Plus,
  Settings2,
  Trash2,
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
import { LocationAutocomplete, type LocationSelectionMeta } from "@/components/ui/location-autocomplete";
import { UniversityAutocomplete } from "@/components/ui/university-autocomplete";
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
  failedValidateImport: string;
  failedCommitImport: string;
  stepUpload: string;
  stepPreview: string;
  stepConfirm: string;
  triggerTitle: string;
  triggerLabel: string;
  dialogTitle: string;
  dialogDescription: string;
  showAdvancedLabel: string;
  hideAdvancedLabel: string;
  guidanceTitle: string;
  guidanceUniversity: string;
  guidanceSessionDate: string;
  guidanceSessionTime: string;
  guidanceBookingDate: string;
  guidanceWisudaOnly: string;
  validateBatchLabel: string;
  pasteTipsLabel: string;
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

type BatchColumn = {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  advanced?: boolean;
  internal?: boolean;
  inputType?: "text" | "university" | "location";
  normalizeMode?: "whatsapp" | "date" | "time";
};

type BatchRow = Record<string, string>;

const TABLE_COLUMNS: BatchColumn[] = [
  { key: "client_name", label: "Nama Klien", required: true, placeholder: "Nama Klien..." },
  {
    key: "client_whatsapp",
    label: "Nomor WA",
    placeholder: "+628123...",
    normalizeMode: "whatsapp",
  },
  { key: "event_type", label: "Event", required: true, placeholder: "Wedding / Wisuda / ..." },
  { key: "main_services", label: "Paket Utama", required: true, placeholder: "Nama paket" },
  {
    key: "extra.universitas",
    label: "Universitas",
    placeholder: "Contoh: Universitas Indonesia / Universitas Indonesia (UI) / UI",
    inputType: "university",
  },
  {
    key: "session_date",
    label: "Tanggal Sesi",
    placeholder: "DD/MM/YYYY atau YYYY-MM-DD",
    normalizeMode: "date",
  },
  { key: "session_time", label: "Jam Sesi", placeholder: "HH:mm", normalizeMode: "time" },
  {
    key: "booking_date",
    label: "Tanggal Booking",
    placeholder: "DD/MM/YYYY atau YYYY-MM-DD",
    normalizeMode: "date",
  },
  { key: "location", label: "Lokasi", placeholder: "Lokasi utama", inputType: "location" },
  { key: "dp_paid", label: "DP", required: true, placeholder: "1000000" },
  { key: "status", label: "Status", placeholder: "Default otomatis" , advanced: true },
  { key: "addon_services", label: "Add-on", placeholder: "Nama addon 1 | addon 2", advanced: true },
  { key: "freelancers", label: "Freelancer", placeholder: "Nama freelance", advanced: true },
  { key: "location_lat", label: "Location Latitude", internal: true, advanced: true },
  { key: "location_lng", label: "Location Longitude", internal: true, advanced: true },
  { key: "location_detail", label: "Detail Lokasi", placeholder: "Gedung / area", advanced: true },
  { key: "notes", label: "Catatan", placeholder: "Catatan klien", advanced: true },
  { key: "admin_notes", label: "Catatan Admin", placeholder: "Internal", advanced: true },
  { key: "instagram", label: "Instagram", placeholder: "@username", advanced: true },
  { key: "akad_date", label: "Tanggal Akad", placeholder: "YYYY-MM-DDTHH:mm", advanced: true },
  { key: "resepsi_date", label: "Tanggal Resepsi", placeholder: "YYYY-MM-DDTHH:mm", advanced: true },
  { key: "wisuda_session_1_date", label: "Tanggal Wisuda 1", placeholder: "YYYY-MM-DDTHH:mm", advanced: true },
  { key: "wisuda_session_2_date", label: "Tanggal Wisuda 2", placeholder: "YYYY-MM-DDTHH:mm", advanced: true },
  { key: "extra.tempat_akad", label: "Lokasi Akad", placeholder: "Lokasi akad", advanced: true },
  { key: "extra.tempat_resepsi", label: "Lokasi Resepsi", placeholder: "Lokasi resepsi", advanced: true },
  { key: "extra.tempat_wisuda_1", label: "Lokasi Wisuda 1", placeholder: "Lokasi sesi 1", advanced: true },
  { key: "extra.tempat_wisuda_2", label: "Lokasi Wisuda 2", placeholder: "Lokasi sesi 2", advanced: true },
  { key: "main_service_ids", label: "Main Service IDs", placeholder: "uuid|uuid", advanced: true },
  { key: "addon_service_ids", label: "Addon Service IDs", placeholder: "uuid|uuid", advanced: true },
  { key: "freelance_ids", label: "Freelance IDs", placeholder: "uuid|uuid", advanced: true },
  { key: "accommodation_fee", label: "Biaya Akomodasi", placeholder: "0", advanced: true },
  { key: "discount_amount", label: "Diskon", placeholder: "0", advanced: true },
];

function buildBatchImportStrings(t: BatchImportTranslator): BatchImportStrings {
  return {
    blockedBookingWriteFallback: t("blockedBookingWriteFallback"),
    failedValidateImport: t("failedValidateImport"),
    failedCommitImport: t("failedCommitImport"),
    stepUpload: t("stepUpload"),
    stepPreview: t("stepPreview"),
    stepConfirm: t("stepConfirm"),
    triggerTitle: t("triggerTitle"),
    triggerLabel: t("triggerLabel"),
    dialogTitle: t("dialogTitle"),
    dialogDescription: t("dialogDescription"),
    showAdvancedLabel: t("showAdvancedLabel"),
    hideAdvancedLabel: t("hideAdvancedLabel"),
    guidanceTitle: t("guidanceTitle"),
    guidanceUniversity: t("guidanceUniversity"),
    guidanceSessionDate: t("guidanceSessionDate"),
    guidanceSessionTime: t("guidanceSessionTime"),
    guidanceBookingDate: t("guidanceBookingDate"),
    guidanceWisudaOnly: t("guidanceWisudaOnly"),
    validateBatchLabel: t("validateBatchLabel"),
    pasteTipsLabel: t("pasteTipsLabel"),
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

function parseClipboardTable(raw: string): string[][] {
  if (!raw.trim()) return [];
  const lines = raw.replace(/\r/g, "").split("\n");
  const effectiveLines =
    lines.length > 0 && lines[lines.length - 1] === ""
      ? lines.slice(0, -1)
      : lines;

  return effectiveLines.map((line) => line.split("\t"));
}

function normalizeWhatsappForSubmit(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  let digits = value.replace(/[^0-9]/g, "");
  if (!digits) return value;

  if (digits.startsWith("0")) {
    digits = `62${digits.slice(1)}`;
  } else if (!digits.startsWith("62")) {
    digits = `62${digits}`;
  }

  digits = digits.replace(/^62+/, "62");
  if (digits.length <= 2) return value;
  return `+${digits}`;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function isValidDateParts(year: number, month: number, day: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function parseExcelSerial(value: number) {
  if (!Number.isFinite(value)) return null;
  const epoch = Date.UTC(1899, 11, 30);
  const millis = Math.round(value * 24 * 60 * 60 * 1000);
  const parsed = new Date(epoch + millis);
  if (!Number.isFinite(parsed.getTime())) return null;
  return {
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
    day: parsed.getUTCDate(),
    hours: parsed.getUTCHours(),
    minutes: parsed.getUTCMinutes(),
  };
}

function normalizeDateForCell(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "";

  const token = value.split(/[T\s]+/).filter(Boolean)[0] || value;
  if (/^\d+(\.\d+)?$/.test(token)) {
    const numeric = Number(token);
    if (Number.isFinite(numeric)) {
      const excel = parseExcelSerial(Math.floor(numeric));
      if (excel && isValidDateParts(excel.year, excel.month, excel.day)) {
        return `${excel.year}-${pad2(excel.month)}-${pad2(excel.day)}`;
      }
    }
  }

  const normalized = token.replace(/[.]/g, "-").replace(/\//g, "-");
  let match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (isValidDateParts(year, month, day)) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
    return null;
  }

  match = normalized.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!isValidDateParts(year, month, day)) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function normalizeTimeForCell(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "";

  if (/^\d+(\.\d+)?$/.test(value)) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= 0 && numeric < 1) {
      const excel = parseExcelSerial(numeric);
      if (excel) {
        return `${pad2(excel.hours)}:${pad2(excel.minutes)}`;
      }
    }
    if (Number.isFinite(numeric) && numeric >= 100 && numeric <= 2359) {
      const token = String(Math.floor(numeric)).padStart(4, "0");
      const hours = Number(token.slice(0, 2));
      const minutes = Number(token.slice(2, 4));
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        return `${pad2(hours)}:${pad2(minutes)}`;
      }
    }
  }

  let match = value.match(/^(\d{1,2})[:.](\d{1,2})(?::(\d{1,2}))?$/);
  if (match) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${pad2(hours)}:${pad2(minutes)}`;
    }
    return null;
  }

  match = value.match(/^(\d{3,4})$/);
  if (!match) return null;
  const token = match[1].padStart(4, "0");
  const hours = Number(token.slice(0, 2));
  const minutes = Number(token.slice(2, 4));
  if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
    return `${pad2(hours)}:${pad2(minutes)}`;
  }
  return null;
}

function normalizeCellValueByColumn(column: BatchColumn, rawValue: string) {
  const trimmed = rawValue.trim();
  if (!column.normalizeMode) return trimmed;

  if (column.normalizeMode === "whatsapp") {
    return normalizeWhatsappForSubmit(trimmed);
  }
  if (column.normalizeMode === "date") {
    return normalizeDateForCell(trimmed) ?? trimmed;
  }
  if (column.normalizeMode === "time") {
    return normalizeTimeForCell(trimmed) ?? trimmed;
  }
  return trimmed;
}

function parseCoordinateCell(raw: string | undefined) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function createEmptyRow(): BatchRow {
  const row: BatchRow = {};
  TABLE_COLUMNS.forEach((column) => {
    row[column.key] = "";
  });
  return row;
}

function rowHasAnyValue(row: BatchRow, keys: string[]) {
  return keys.some((key) => (row[key] || "").trim().length > 0);
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
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [rows, setRows] = React.useState<BatchRow[]>([createEmptyRow()]);
  const [validating, setValidating] = React.useState(false);
  const [committing, setCommitting] = React.useState(false);
  const [validation, setValidation] = React.useState<ValidationResponse | null>(null);
  const [commitResult, setCommitResult] = React.useState<CommitResponse | null>(null);
  const [preparedRows, setPreparedRows] = React.useState<string[][]>([]);
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

  const visibleColumns = React.useMemo(
    () => TABLE_COLUMNS.filter((column) => !column.internal && (showAdvanced || !column.advanced)),
    [showAdvanced],
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
    setShowAdvanced(false);
    setRows([createEmptyRow()]);
    setValidating(false);
    setCommitting(false);
    setValidation(null);
    setCommitResult(null);
    setPreparedRows([]);
    setFatalError(null);
  }

  function clearValidationSnapshots() {
    if (validation) setValidation(null);
    if (commitResult) setCommitResult(null);
    if (fatalError) setFatalError(null);
  }

  function updateCell(
    rowIndex: number,
    key: string,
    value: string,
    options?: { keepLocationCoordinates?: boolean },
  ) {
    setRows((prev) => {
      const next = prev.map((row) => ({ ...row }));
      if (!next[rowIndex]) {
        while (next.length <= rowIndex) {
          next.push(createEmptyRow());
        }
      }
      next[rowIndex][key] = value;
      if (key === "location" && !options?.keepLocationCoordinates) {
        next[rowIndex].location_lat = "";
        next[rowIndex].location_lng = "";
      }
      return next;
    });

    clearValidationSnapshots();
  }

  function setLocationCoordinates(
    rowIndex: number,
    meta: Pick<LocationSelectionMeta, "lat" | "lng">,
  ) {
    setRows((prev) => {
      const next = prev.map((row) => ({ ...row }));
      if (!next[rowIndex]) {
        while (next.length <= rowIndex) {
          next.push(createEmptyRow());
        }
      }
      if (
        typeof meta.lat === "number" &&
        Number.isFinite(meta.lat) &&
        typeof meta.lng === "number" &&
        Number.isFinite(meta.lng)
      ) {
        next[rowIndex].location_lat = String(meta.lat);
        next[rowIndex].location_lng = String(meta.lng);
      } else {
        next[rowIndex].location_lat = "";
        next[rowIndex].location_lng = "";
      }
      return next;
    });
    clearValidationSnapshots();
  }

  function autoNormalizeCell(
    rowIndex: number,
    column: BatchColumn,
    currentValueOverride?: string,
  ) {
    const currentValue = currentValueOverride ?? rows[rowIndex]?.[column.key] ?? "";
    const normalized = normalizeCellValueByColumn(column, currentValue);
    if (normalized === currentValue) return;
    updateCell(rowIndex, column.key, normalized);
  }

  function handlePasteAtCell(
    event: React.ClipboardEvent<HTMLInputElement>,
    startRowIndex: number,
    startColumnIndex: number,
  ) {
    const text = event.clipboardData.getData("text/plain");
    const matrix = parseClipboardTable(text);
    if (matrix.length === 0) return;

    event.preventDefault();
    setRows((prev) => {
      const next = prev.map((row) => ({ ...row }));
      const requiredRows = startRowIndex + matrix.length;
      while (next.length < requiredRows) {
        next.push(createEmptyRow());
      }

      matrix.forEach((clipboardRow, rowOffset) => {
        clipboardRow.forEach((cellValue, columnOffset) => {
          const column = visibleColumns[startColumnIndex + columnOffset];
          if (!column) return;
          const normalizedValue = normalizeCellValueByColumn(column, cellValue);
          next[startRowIndex + rowOffset][column.key] = normalizedValue;
          if (column.key === "location") {
            next[startRowIndex + rowOffset].location_lat = "";
            next[startRowIndex + rowOffset].location_lng = "";
          }
        });
      });

      return next;
    });

    clearValidationSnapshots();
  }

  function addRow() {
    setRows((prev) => [...prev, createEmptyRow()]);
  }

  function removeRow(index: number) {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, rowIndex) => rowIndex !== index);
      return next.length > 0 ? next : [createEmptyRow()];
    });
    clearValidationSnapshots();
  }

  function buildRowsForValidation(): string[][] {
    const headers = TABLE_COLUMNS.map((column) => column.key);
    const dataRows = rows
      .map((row) =>
        headers.map((header) => {
          const column = TABLE_COLUMNS.find((item) => item.key === header);
          const rawValue = row[header] || "";
          if (!column) return rawValue.trim();
          return normalizeCellValueByColumn(column, rawValue);
        }),
      )
      .filter((rowValues) => rowValues.some((item) => item.length > 0));

    if (dataRows.length === 0) return [];
    return [headers, ...dataRows];
  }

  async function runValidation() {
    const rowsForValidation = buildRowsForValidation();
    if (rowsForValidation.length === 0) {
      setFatalError(ui.failedValidateImport);
      return;
    }

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
          rows: rowsForValidation,
          hasHeader: true,
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

      setPreparedRows(rowsForValidation);
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
    if (!validation || !validation.canCommit || preparedRows.length === 0) return;
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
          rows: preparedRows,
          hasHeader: true,
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

  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: ui.stepUpload },
    { key: "preview", label: ui.stepPreview },
    { key: "confirm", label: ui.stepConfirm },
  ];

  const filledRowCount = React.useMemo(() => {
    const keys = TABLE_COLUMNS.map((column) => column.key);
    return rows.filter((row) => rowHasAnyValue(row, keys)).length;
  }, [rows]);

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
        <DialogContent className="w-[95vw] max-w-[960px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" /> {ui.dialogTitle}
            </DialogTitle>
            <DialogDescription>
              {ui.dialogDescription}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 py-2 overflow-x-auto">
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
                    className={`h-px w-8 sm:w-12 shrink-0 ${
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
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => setShowAdvanced((prev) => !prev)}
                  >
                    <Settings2 className="w-4 h-4" />
                    {showAdvanced ? ui.hideAdvancedLabel : ui.showAdvancedLabel}
                  </Button>
                </div>

                <div className="rounded-xl border bg-card overflow-hidden">
                  <div className="border-b bg-muted/30 px-4 py-3 text-sm">
                    <p className="font-medium">Batch Mode Tabel</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Paste langsung dari Excel/Google Sheets ke sel tabel (tanpa header). Sistem otomatis deteksi baris x kolom.
                    </p>
                    <p className="text-xs text-muted-foreground/80 mt-1">
                      Baris terisi: {filledRowCount} • Total baris: {rows.length}
                    </p>
                    <div className="mt-3 rounded-md border bg-background/80 p-2.5 space-y-1 text-[11px] text-muted-foreground">
                      <p className="font-medium text-foreground/90">{ui.guidanceTitle}</p>
                      <p>{ui.guidanceUniversity}</p>
                      <p>{ui.guidanceSessionDate}</p>
                      <p>{ui.guidanceSessionTime}</p>
                      <p>{ui.guidanceBookingDate}</p>
                      <p>{ui.guidanceWisudaOnly}</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-[46vh]">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground w-12">No</th>
                          {visibleColumns.map((column) => (
                            <th key={column.key} className="px-3 py-2 text-left font-medium text-muted-foreground min-w-[170px]">
                              {column.label}
                              {column.required ? <span className="text-red-500">*</span> : null}
                            </th>
                          ))}
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground w-16">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {rows.map((row, rowIndex) => (
                          <tr key={`row-${rowIndex}`} className="hover:bg-muted/20 align-top">
                            <td className="px-3 py-2 text-muted-foreground">{rowIndex + 1}</td>
                            {visibleColumns.map((column, columnIndex) => (
                              <td key={`${rowIndex}-${column.key}`} className="px-3 py-2">
                                {column.inputType === "university" ? (
                                  <UniversityAutocomplete
                                    value={row[column.key] || ""}
                                    onValueChange={(nextValue) =>
                                      updateCell(rowIndex, column.key, nextValue)
                                    }
                                    onSelect={() => undefined}
                                    placeholder={column.placeholder || ""}
                                    inputClassName="h-8 rounded-md border bg-background px-2 py-1.5 text-xs pr-8"
                                    containerClassName="w-full"
                                    showSelectionHint={false}
                                    onPaste={(event) =>
                                      handlePasteAtCell(event, rowIndex, columnIndex)
                                    }
                                  />
                                ) : column.inputType === "location" ? (
                                  <LocationAutocomplete
                                    value={row[column.key] || ""}
                                    onChange={(nextValue) =>
                                      updateCell(rowIndex, column.key, nextValue)
                                    }
                                    onLocationChange={(meta) => {
                                      if (meta.source === "autocomplete") {
                                        setLocationCoordinates(rowIndex, {
                                          lat: meta.lat,
                                          lng: meta.lng,
                                        });
                                      }
                                    }}
                                    showMapButton={false}
                                    placeholder={column.placeholder || ""}
                                    inputClassName="h-8 rounded-md border bg-background px-2 py-1.5 text-xs"
                                    initialLat={parseCoordinateCell(row.location_lat)}
                                    initialLng={parseCoordinateCell(row.location_lng)}
                                    onPaste={(event) =>
                                      handlePasteAtCell(event, rowIndex, columnIndex)
                                    }
                                  />
                                ) : (
                                  <input
                                    value={row[column.key] || ""}
                                    onChange={(event) =>
                                      updateCell(rowIndex, column.key, event.target.value)
                                    }
                                    onBlur={(event) => {
                                      if (!column.normalizeMode) return;
                                      autoNormalizeCell(rowIndex, column, event.target.value);
                                    }}
                                    onPaste={(event) =>
                                      handlePasteAtCell(event, rowIndex, columnIndex)
                                    }
                                    placeholder={column.placeholder || ""}
                                    className="w-full rounded-md border bg-background px-2 py-1.5 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                                  />
                                )}
                              </td>
                            ))}
                            <td className="px-3 py-2 text-right">
                              {rows.length > 1 ? (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeRow(rowIndex)}
                                  title="Hapus Baris"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3 border-t bg-muted/20 flex flex-wrap items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2 border-dashed border-2"
                      onClick={addRow}
                    >
                      <Plus className="w-4 h-4" /> Tambah Baris
                    </Button>

                    <div className="text-xs text-muted-foreground">
                      {ui.pasteTipsLabel}
                    </div>
                  </div>
                </div>
              </>
            )}

            {step === "preview" && validation && (
              <>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border text-sm">
                  <FileSpreadsheet className="w-4 h-4 text-green-600 shrink-0" />
                  <span className="flex-1 truncate font-medium">Data batch siap commit</span>
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
              <>
                <Button variant="outline" onClick={resetState} className="w-full sm:w-auto">
                  {ui.closeLabel}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    void runValidation();
                  }}
                  disabled={validating}
                  className="gap-2 w-full sm:w-auto"
                >
                  {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {validating ? ui.validatingLabel : ui.validateBatchLabel}
                </Button>
              </>
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
