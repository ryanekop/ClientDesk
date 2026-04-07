export type BookingArchiveMode = "active" | "archived";

export function normalizeBookingArchiveMode(
  value: unknown,
): BookingArchiveMode {
  return value === "archived" ? "archived" : "active";
}

export function isArchivedBooking(
  value: { archived_at?: string | null } | null | undefined,
) {
  return (
    typeof value?.archived_at === "string" &&
    value.archived_at.trim().length > 0
  );
}
