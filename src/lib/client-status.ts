export const INITIAL_BOOKING_STATUS = "Pending";
export const COMPLETED_BOOKING_STATUS = "Selesai";
export const DEFAULT_DP_VERIFY_TRIGGER_STATUS = "";

export const DEFAULT_CLIENT_STATUSES = [
  INITIAL_BOOKING_STATUS,
  "Booking Confirmed",
  "Sesi Foto / Acara",
  "Antrian Edit",
  "Proses Edit",
  "Revisi",
  "File Siap",
  COMPLETED_BOOKING_STATUS,
];

export const CANCELLED_BOOKING_STATUS = "Batal";

function normalizeStatusValue(value: string) {
  return value.trim();
}

function dedupeStatuses(statuses: string[]) {
  return Array.from(new Set(statuses));
}

function isInitialBookingStatus(status?: string | null) {
  return normalizeStatusValue(status || "").toLowerCase() === INITIAL_BOOKING_STATUS.toLowerCase();
}

function isCompletedBookingStatus(status?: string | null) {
  return normalizeStatusValue(status || "").toLowerCase() === COMPLETED_BOOKING_STATUS.toLowerCase();
}

export function isCancelledBookingStatus(status?: string | null) {
  return normalizeStatusValue(status || "").toLowerCase() === CANCELLED_BOOKING_STATUS.toLowerCase();
}

export function normalizeClientProgressStatuses(statuses?: string[] | null) {
  const normalizedInput = dedupeStatuses(
    (statuses || []).map((item) => normalizeStatusValue(item)).filter(Boolean),
  );

  const progressStatuses = (normalizedInput.length > 0
    ? normalizedInput
    : DEFAULT_CLIENT_STATUSES
  ).filter((item) => !isCancelledBookingStatus(item));

  const middleStatuses = progressStatuses.filter(
    (item) => !isInitialBookingStatus(item) && !isCompletedBookingStatus(item),
  );
  return [INITIAL_BOOKING_STATUS, ...middleStatuses, COMPLETED_BOOKING_STATUS];
}

export function getClientProgressStatuses(statuses?: string[] | null) {
  const normalized = normalizeClientProgressStatuses(statuses);
  return normalized.length > 0 ? normalized : [...DEFAULT_CLIENT_STATUSES];
}

export function getInitialBookingStatus(statuses?: string[] | null) {
  return getClientProgressStatuses(statuses)[0] || INITIAL_BOOKING_STATUS;
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

export function getDefaultTrackingFileLinksVisibleFromStatus(
  statuses?: string[] | null,
) {
  return getDefaultFinalInvoiceVisibleFromStatus(statuses);
}

export function resolveTrackingFileLinksVisibleFromStatus(
  statuses?: string[] | null,
  selectedStatus?: string | null,
) {
  const normalized = getClientProgressStatuses(statuses);
  if (selectedStatus && normalized.includes(selectedStatus)) {
    return selectedStatus;
  }
  return getDefaultTrackingFileLinksVisibleFromStatus(normalized);
}

export function resolveDpVerifyTriggerStatus(
  statuses?: string[] | null,
  selectedStatus?: string | null,
) {
  const normalized = getClientProgressStatuses(statuses);
  if (selectedStatus && normalized.includes(selectedStatus)) {
    return selectedStatus;
  }
  return DEFAULT_DP_VERIFY_TRIGGER_STATUS;
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

export function shouldShowTrackingFileLinksForClientStatus({
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
  const threshold = resolveTrackingFileLinksVisibleFromStatus(
    normalized,
    visibleFromStatus,
  );
  const currentIndex = normalized.indexOf(currentStatus);
  const thresholdIndex = normalized.indexOf(threshold);

  if (currentIndex === -1 || thresholdIndex === -1) {
    return false;
  }

  return currentIndex >= thresholdIndex;
}
