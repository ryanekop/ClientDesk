export const DEFAULT_CLIENT_STATUSES = [
  "Booking Confirmed",
  "Sesi Foto / Acara",
  "Antrian Edit",
  "Proses Edit",
  "Revisi",
  "File Siap",
  "Selesai",
];

export const CANCELLED_BOOKING_STATUS = "Batal";

function normalizeStatusValue(value: string) {
  return value.trim();
}

function dedupeStatuses(statuses: string[]) {
  return Array.from(new Set(statuses));
}

export function isCancelledBookingStatus(status?: string | null) {
  return normalizeStatusValue(status || "").toLowerCase() === CANCELLED_BOOKING_STATUS.toLowerCase();
}

export function getClientProgressStatuses(statuses?: string[] | null) {
  const normalized = dedupeStatuses(
    (statuses || [])
      .map((item) => normalizeStatusValue(item))
      .filter(Boolean)
      .filter((item) => !isCancelledBookingStatus(item)),
  );

  if (normalized.length > 0) {
    return normalized;
  }

  return [...DEFAULT_CLIENT_STATUSES];
}

export function getInitialBookingStatus(statuses?: string[] | null) {
  return getClientProgressStatuses(statuses)[0] || DEFAULT_CLIENT_STATUSES[0];
}

export function getBookingStatusOptions(statuses?: string[] | null) {
  const progressStatuses = getClientProgressStatuses(statuses);
  return progressStatuses.includes(CANCELLED_BOOKING_STATUS)
    ? progressStatuses
    : [...progressStatuses, CANCELLED_BOOKING_STATUS];
}

export function resolveUnifiedBookingStatus({
  status,
  clientStatus,
  statuses,
}: {
  status?: string | null;
  clientStatus?: string | null;
  statuses?: string[] | null;
}) {
  if (isCancelledBookingStatus(status) || isCancelledBookingStatus(clientStatus)) {
    return CANCELLED_BOOKING_STATUS;
  }

  const options = getBookingStatusOptions(statuses);
  const normalizedClientStatus = normalizeStatusValue(clientStatus || "");
  if (normalizedClientStatus && options.includes(normalizedClientStatus)) {
    return normalizedClientStatus;
  }

  const normalizedStatus = normalizeStatusValue(status || "");
  if (normalizedStatus && options.includes(normalizedStatus)) {
    return normalizedStatus;
  }

  return getInitialBookingStatus(statuses);
}

export function getDefaultFinalInvoiceVisibleFromStatus(statuses?: string[] | null) {
  const normalized = getClientProgressStatuses(statuses);
  return normalized.includes("Sesi Foto / Acara")
    ? "Sesi Foto / Acara"
    : normalized[0] || "Sesi Foto / Acara";
}

export function resolveFinalInvoiceVisibleFromStatus(
  statuses?: string[] | null,
  selectedStatus?: string | null,
) {
  const normalized = getClientProgressStatuses(statuses);
  if (selectedStatus && normalized.includes(selectedStatus)) {
    return selectedStatus;
  }
  return getDefaultFinalInvoiceVisibleFromStatus(normalized);
}

export function shouldShowFinalInvoiceForClientStatus({
  statuses,
  currentStatus,
  visibleFromStatus,
}: {
  statuses?: string[] | null;
  currentStatus?: string | null;
  visibleFromStatus?: string | null;
}) {
  if (!currentStatus) return false;

  const normalized = getClientProgressStatuses(statuses);
  const threshold = resolveFinalInvoiceVisibleFromStatus(normalized, visibleFromStatus);
  const currentIndex = normalized.indexOf(currentStatus);
  const thresholdIndex = normalized.indexOf(threshold);

  if (currentIndex === -1 || thresholdIndex === -1) {
    return false;
  }

  return currentIndex >= thresholdIndex;
}
