import type { createClient } from "@/utils/supabase/client";

type ClientSupabase = ReturnType<typeof createClient>;

export type BookingDeleteTarget = {
  id: string;
  fastpik_project_id?: string | null;
  fastpik_project_link?: string | null;
  fastpik_project_edit_link?: string | null;
};

export type BookingDeleteWarning =
  | { type: "googleCalendarDeleteFailed"; reason: string }
  | { type: "googleCalendarDeletePartial"; firstError: string | null }
  | { type: "googleCalendarDeleteFailedGeneric" }
  | { type: "fastpikProjectDeleteFailed"; reason: string }
  | { type: "fastpikProjectDeleteFailedGeneric" };

export type BookingDeleteResult =
  | { ok: true; warnings: BookingDeleteWarning[] }
  | { ok: false; warnings: BookingDeleteWarning[] };

export async function deleteBookingWithDependencies(args: {
  supabase: ClientSupabase;
  booking: BookingDeleteTarget;
  locale: string;
}) {
  const { supabase, booking, locale } = args;
  const warnings: BookingDeleteWarning[] = [];

  try {
    const calendarRes = await fetch("/api/google/calendar-delete-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: booking.id }),
    });
    const calendarResult = (await calendarRes.json().catch(() => null)) as {
      success?: boolean;
      errors?: string[];
      error?: string;
    } | null;

    if (!calendarRes.ok) {
      warnings.push({
        type: "googleCalendarDeleteFailed",
        reason: calendarResult?.error || "Unknown error",
      });
    } else if (calendarResult?.success === false) {
      warnings.push({
        type: "googleCalendarDeletePartial",
        firstError: Array.isArray(calendarResult.errors)
          ? calendarResult.errors[0] || null
          : null,
      });
    }
  } catch {
    warnings.push({ type: "googleCalendarDeleteFailedGeneric" });
  }

  const hasFastpikProject = Boolean(
    booking.fastpik_project_id?.trim() ||
      booking.fastpik_project_link?.trim() ||
      booking.fastpik_project_edit_link?.trim(),
  );

  if (hasFastpikProject) {
    try {
      const fastpikRes = await fetch(
        "/api/integrations/fastpik/delete-booking-project",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId: booking.id,
            locale,
          }),
        },
      );
      const fastpikResult = (await fastpikRes.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
        error?: string;
      } | null;

      if (!fastpikRes.ok || fastpikResult?.success === false) {
        warnings.push({
          type: "fastpikProjectDeleteFailed",
          reason:
            (typeof fastpikResult?.message === "string" &&
              fastpikResult.message.trim()) ||
            (typeof fastpikResult?.error === "string" &&
              fastpikResult.error.trim()) ||
            "Unknown error",
        });
      }
    } catch {
      warnings.push({ type: "fastpikProjectDeleteFailedGeneric" });
    }
  }

  const { error } = await supabase.from("bookings").delete().eq("id", booking.id);
  if (error) {
    return { ok: false, warnings } satisfies BookingDeleteResult;
  }

  return { ok: true, warnings } satisfies BookingDeleteResult;
}
