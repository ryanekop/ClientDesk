import { isCancelledBookingStatus } from "@/lib/client-status";

type StatusTransitionSyncParams = {
  bookingId: string;
  previousStatus?: string | null;
  nextStatus?: string | null;
  locale?: string;
};

type DeleteBookingCalendarResponse = {
  success?: boolean;
  failedCount?: number;
  errors?: string[];
  error?: string;
} | null;

type InviteCalendarResponse = {
  success?: boolean;
  error?: string;
} | null;

function isEnglishLocale(locale?: string) {
  return (locale || "").toLowerCase().startsWith("en");
}

export function isTransitionToCancelled(
  previousStatus?: string | null,
  nextStatus?: string | null,
) {
  return (
    !isCancelledBookingStatus(previousStatus) &&
    isCancelledBookingStatus(nextStatus)
  );
}

export function isTransitionFromCancelled(
  previousStatus?: string | null,
  nextStatus?: string | null,
) {
  return (
    isCancelledBookingStatus(previousStatus) &&
    !isCancelledBookingStatus(nextStatus)
  );
}

export async function syncGoogleCalendarForStatusTransition({
  bookingId,
  previousStatus,
  nextStatus,
  locale,
}: StatusTransitionSyncParams): Promise<string | null> {
  if (isTransitionToCancelled(previousStatus, nextStatus)) {
    try {
      const response = await fetch("/api/google/calendar-delete-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const result =
        ((await response
          .json()
          .catch(() => null)) as DeleteBookingCalendarResponse) || null;

      if (!response.ok) {
        return isEnglishLocale(locale)
          ? `Status updated, but failed to remove Google Calendar event: ${result?.error || "Unknown error"}`
          : `Status booking tersimpan, tetapi event Google Calendar gagal dihapus: ${result?.error || "Unknown error"}`;
      }

      if (result && result.success === false) {
        const firstError = Array.isArray(result.errors) ? result.errors[0] : null;
        return isEnglishLocale(locale)
          ? `Status updated, but some Google Calendar events failed to delete.${firstError ? ` ${firstError}` : ""}`
          : `Status booking tersimpan, tetapi sebagian event Google Calendar gagal dihapus.${firstError ? ` ${firstError}` : ""}`;
      }
    } catch {
      return isEnglishLocale(locale)
        ? "Status updated, but failed to remove Google Calendar event."
        : "Status booking tersimpan, tetapi event Google Calendar gagal dihapus.";
    }

    return null;
  }

  if (isTransitionFromCancelled(previousStatus, nextStatus)) {
    try {
      const response = await fetch("/api/google/calendar-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const result =
        ((await response.json().catch(() => null)) as InviteCalendarResponse) ||
        null;

      if (!response.ok || result?.success === false) {
        return isEnglishLocale(locale)
          ? `Status updated, but failed to recreate Google Calendar event: ${result?.error || "Unknown error"}`
          : `Status booking tersimpan, tetapi event Google Calendar gagal dibuat ulang: ${result?.error || "Unknown error"}`;
      }
    } catch {
      return isEnglishLocale(locale)
        ? "Status updated, but failed to recreate Google Calendar event."
        : "Status booking tersimpan, tetapi event Google Calendar gagal dibuat ulang.";
    }
  }

  return null;
}
