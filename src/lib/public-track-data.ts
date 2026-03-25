import { unstable_cache } from "next/cache";
import {
  buildTrackCacheTag,
  buildTrackUserCacheTag,
  normalizePublicLocale,
} from "@/lib/public-cache-tags";
import { normalizeFastpikLinkDisplayMode } from "@/lib/fastpik-link-display";
import { createServiceClient } from "@/lib/supabase/service";

type BookingStampRow = {
  id: string;
  user_id: string;
  updated_at: string | null;
};

type ProfileStampRow = {
  updated_at: string | null;
};

export type TrackBookingRow = {
  id: string;
  user_id: string;
  booking_code: string;
  tracking_uuid: string | null;
  client_name: string;
  session_date: string | null;
  event_type: string | null;
  client_status: string | null;
  queue_position: number | null;
  status: string;
  drive_folder_url: string | null;
  fastpik_project_id: string | null;
  fastpik_project_link: string | null;
  fastpik_project_edit_link: string | null;
  fastpik_sync_status: string | null;
  fastpik_last_synced_at: string | null;
  total_price: number;
  dp_paid: number;
  is_fully_paid: boolean;
  settlement_status: string | null;
  final_adjustments: unknown;
  final_payment_amount: number | null;
  final_paid_at: string | null;
  final_invoice_sent_at: string | null;
  location: string | null;
  extra_fields: Record<string, unknown> | null;
  services: { name?: string } | null;
  created_at: string;
};

export type TrackProfileRow = {
  studio_name: string | null;
  custom_client_statuses: string[] | null;
  final_invoice_visible_from_status: string | null;
  tracking_file_links_visible_from_status?: string | null;
  fastpik_link_display_mode: "both" | "prefer_fastpik" | "drive_only" | null;
  fastpik_link_display_mode_tracking?:
    | "both"
    | "prefer_fastpik"
    | "drive_only"
    | null;
};

export type TrackBasePayload = {
  booking: TrackBookingRow;
  vendorName: string;
  customClientStatuses: string[] | null;
  finalInvoiceVisibleFromStatus: string | null;
  trackingFileLinksVisibleFromStatus: string | null;
  fastpikLinkDisplayMode: "both" | "prefer_fastpik" | "drive_only";
};

function normalizeTrackingUuid(uuid: string | null | undefined) {
  return (uuid || "").trim();
}

async function fetchBookingStamp(trackingUuid: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("bookings")
    .select("id, user_id, updated_at")
    .eq("tracking_uuid", trackingUuid)
    .limit(1)
    .maybeSingle<BookingStampRow>();

  return data || null;
}

async function fetchProfileStamp(userId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("profiles")
    .select("updated_at")
    .eq("id", userId)
    .limit(1)
    .maybeSingle<ProfileStampRow>();

  return data || null;
}

async function fetchTrackBasePayload(trackingUuid: string) {
  const supabase = createServiceClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id, user_id, booking_code, tracking_uuid, client_name, session_date, event_type, client_status, queue_position, status, drive_folder_url, fastpik_project_id, fastpik_project_link, fastpik_project_edit_link, fastpik_sync_status, fastpik_last_synced_at, total_price, dp_paid, is_fully_paid, settlement_status, final_adjustments, final_payment_amount, final_paid_at, final_invoice_sent_at, location, extra_fields, services(name), created_at",
    )
    .eq("tracking_uuid", trackingUuid)
    .maybeSingle<TrackBookingRow>();

  if (!booking) {
    return null;
  }

  const { data: profileWithSplitMode, error: profileWithSplitModeError } = await supabase
    .from("profiles")
    .select(
      "studio_name, custom_client_statuses, final_invoice_visible_from_status, tracking_file_links_visible_from_status, fastpik_link_display_mode, fastpik_link_display_mode_tracking",
    )
    .eq("id", booking.user_id)
    .maybeSingle<TrackProfileRow>();

  let profile = profileWithSplitMode;
  if (!profile && profileWithSplitModeError) {
    const { data: legacyProfile } = await supabase
      .from("profiles")
      .select(
        "studio_name, custom_client_statuses, final_invoice_visible_from_status, tracking_file_links_visible_from_status, fastpik_link_display_mode",
      )
      .eq("id", booking.user_id)
      .maybeSingle<TrackProfileRow>();
    profile = legacyProfile;
  }

  return {
    booking,
    vendorName: profile?.studio_name || "",
    customClientStatuses: profile?.custom_client_statuses || null,
    finalInvoiceVisibleFromStatus: profile?.final_invoice_visible_from_status || null,
    trackingFileLinksVisibleFromStatus:
      profile?.tracking_file_links_visible_from_status || null,
    fastpikLinkDisplayMode: normalizeFastpikLinkDisplayMode(
      profile?.fastpik_link_display_mode_tracking ??
        profile?.fastpik_link_display_mode,
    ),
  } satisfies TrackBasePayload;
}

export async function getTrackBasePayloadCached(
  trackingUuid: string,
  locale: string,
) {
  const normalizedUuid = normalizeTrackingUuid(trackingUuid);
  if (!normalizedUuid) return null;

  const bookingStamp = await fetchBookingStamp(normalizedUuid);
  if (!bookingStamp) return null;

  const profileStamp = await fetchProfileStamp(bookingStamp.user_id);
  const normalizedLocale = normalizePublicLocale(locale);

  const cacheKey = [
    "public-track-base",
    normalizedUuid.toLowerCase(),
    normalizedLocale,
    bookingStamp.id,
    bookingStamp.updated_at || "no-booking-updated-at",
    profileStamp?.updated_at || "no-profile-updated-at",
  ];

  const cached = unstable_cache(
    async () => fetchTrackBasePayload(normalizedUuid),
    cacheKey,
    {
      revalidate: false,
      tags: [
        buildTrackCacheTag(normalizedUuid, normalizedLocale),
        buildTrackUserCacheTag(bookingStamp.user_id),
      ],
    },
  );

  return cached();
}
