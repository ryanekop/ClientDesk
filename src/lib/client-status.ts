export const DEFAULT_CLIENT_STATUSES = [
  "Booking Confirmed",
  "Sesi Foto / Acara",
  "Antrian Edit",
  "Proses Edit",
  "Revisi",
  "File Siap",
  "Selesai",
];

export function getDefaultFinalInvoiceVisibleFromStatus(statuses?: string[] | null) {
  const normalized = statuses && statuses.length > 0 ? statuses : DEFAULT_CLIENT_STATUSES;
  return normalized.includes("Sesi Foto / Acara")
    ? "Sesi Foto / Acara"
    : normalized[0] || "Sesi Foto / Acara";
}

export function resolveFinalInvoiceVisibleFromStatus(
  statuses?: string[] | null,
  selectedStatus?: string | null,
) {
  const normalized = statuses && statuses.length > 0 ? statuses : DEFAULT_CLIENT_STATUSES;
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

  const normalized = statuses && statuses.length > 0 ? statuses : DEFAULT_CLIENT_STATUSES;
  const threshold = resolveFinalInvoiceVisibleFromStatus(normalized, visibleFromStatus);
  const currentIndex = normalized.indexOf(currentStatus);
  const thresholdIndex = normalized.indexOf(threshold);

  if (currentIndex === -1 || thresholdIndex === -1) {
    return false;
  }

  return currentIndex >= thresholdIndex;
}
