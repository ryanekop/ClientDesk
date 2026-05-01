import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  notifyTelegramSessionReminder,
  resolveTelegramReminderSessions,
} from "@/lib/telegram-notifications";

type TelegramProfileRow = {
  id: string;
  tenant_id: string | null;
  studio_name: string | null;
  telegram_notifications_enabled: boolean | null;
  telegram_chat_id: string | null;
  telegram_language: string | null;
  telegram_notify_session_h1: boolean | null;
};

type BookingRow = {
  id: string;
  user_id: string;
  booking_code: string;
  client_name: string;
  client_whatsapp: string | null;
  instagram: string | null;
  event_type: string | null;
  session_date: string | null;
  total_price: number | null;
  dp_paid: number | null;
  location: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_detail: string | null;
  notes: string | null;
  extra_fields: unknown;
  drive_folder_url: string | null;
  tracking_uuid?: string | null;
  status: string | null;
  services?: { name?: string | null; price?: number | null } | null;
  booking_services?: unknown;
};

function getJakartaDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || "1970";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const day = parts.find((part) => part.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
}

function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function dateKeyToIso(dateKey: string) {
  return `${dateKey}T00:00:00.000+07:00`;
}

function getBearerOrSecret(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return bearer || request.nextUrl.searchParams.get("secret")?.trim() || "";
}

function isCronAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return getBearerOrSecret(request) === secret;
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const todayKey = getJakartaDateKey(new Date());
  const targetDateKey =
    request.nextUrl.searchParams.get("date")?.trim() || addDaysToDateKey(todayKey, 1);
  const queryFromKey = addDaysToDateKey(targetDateKey, -30);
  const queryToKey = addDaysToDateKey(targetDateKey, 2);
  const publicOrigin = request.nextUrl.origin;

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select(
      "id, tenant_id, studio_name, telegram_notifications_enabled, telegram_chat_id, telegram_language, telegram_notify_session_h1",
    )
    .eq("telegram_notifications_enabled", true)
    .not("telegram_chat_id", "is", null)
    .neq("telegram_chat_id", "");

  if (profilesError) {
    return NextResponse.json(
      { success: false, error: profilesError.message },
      { status: 500 },
    );
  }

  const profileRows = ((profiles || []) as TelegramProfileRow[]).filter(
    (profile) => profile.telegram_notify_session_h1 !== false,
  );
  if (profileRows.length === 0) {
    return NextResponse.json({
      success: true,
      targetDate: targetDateKey,
      checkedBookings: 0,
      sent: 0,
      skipped: 0,
    });
  }

  const profileById = new Map(profileRows.map((profile) => [profile.id, profile]));
  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select(
      [
        "id",
        "user_id",
        "booking_code",
        "client_name",
        "client_whatsapp",
        "instagram",
        "event_type",
        "session_date",
        "total_price",
        "dp_paid",
        "location",
        "location_lat",
        "location_lng",
        "location_detail",
        "notes",
        "extra_fields",
        "drive_folder_url",
        "tracking_uuid",
        "status",
        "services(name, price)",
        "booking_services(quantity, kind, sort_order, services(name, price, duration_minutes))",
      ].join(", "),
    )
    .in("user_id", profileRows.map((profile) => profile.id))
    .gte("session_date", dateKeyToIso(queryFromKey))
    .lt("session_date", dateKeyToIso(queryToKey))
    .neq("status", "Batal");

  if (bookingsError) {
    return NextResponse.json(
      { success: false, error: bookingsError.message },
      { status: 500 },
    );
  }

  let sent = 0;
  let skipped = 0;
  let matchedSessions = 0;

  for (const booking of ((bookings || []) as unknown as BookingRow[])) {
    const profile = profileById.get(booking.user_id);
    if (!profile) {
      skipped += 1;
      continue;
    }

    const sessions = resolveTelegramReminderSessions({
      booking,
      targetDateKey,
    });
    matchedSessions += sessions.length;
    for (const session of sessions) {
      const result = await notifyTelegramSessionReminder({
        supabase,
        profile,
        booking,
        session,
        targetDateKey,
        publicOrigin,
      });
      if (result?.sent) sent += 1;
      else skipped += 1;
    }
  }

  return NextResponse.json({
    success: true,
    targetDate: targetDateKey,
    checkedBookings: (bookings || []).length,
    matchedSessions,
    sent,
    skipped,
  });
}
