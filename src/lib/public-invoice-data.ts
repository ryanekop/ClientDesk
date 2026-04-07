import { unstable_cache } from "next/cache";
import {
  buildInvoiceCacheTag,
  buildInvoiceUserCacheTag,
  normalizeInvoiceStage,
  normalizePublicLocale,
} from "@/lib/public-cache-tags";
import { createServiceClient } from "@/lib/supabase/service";

type BookingStampRow = {
  id: string;
  user_id: string;
  updated_at: string | null;
};

type ProfileStampRow = {
  updated_at: string | null;
};

export type InvoiceBookingRow = {
  id: string;
  booking_code: string;
  client_name: string;
  client_whatsapp: string | null;
  booking_date: string | null;
  session_date: string | null;
  event_type: string | null;
  extra_fields: Record<string, unknown> | null;
  total_price: number;
  dp_paid: number;
  is_fully_paid: boolean;
  status: string;
  settlement_status: string | null;
  final_adjustments: unknown;
  final_payment_amount: number | null;
  final_paid_at: string | null;
  user_id: string;
  services:
    | {
        id: string;
        name: string;
        price: number;
        description: string | null;
        is_addon: boolean;
      }
    | Array<{
        id: string;
        name: string;
        price: number;
        description: string | null;
        is_addon: boolean;
      }>
    | null;
  booking_services?: unknown[] | null;
};

export type InvoiceProfileRow = {
  studio_name: string | null;
  studio_address: string | null;
  invoice_logo_url: string | null;
};

export type InvoicePayload = {
  booking: InvoiceBookingRow;
  profile: InvoiceProfileRow | null;
};

function normalizeBookingCode(code: string | null | undefined) {
  return (code || "").trim();
}

async function fetchBookingStamp(code: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("bookings")
    .select("id, user_id, updated_at")
    .eq("booking_code", code)
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

async function fetchInvoicePayload(bookingCode: string) {
  const supabase = createServiceClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id, booking_code, client_name, client_whatsapp, booking_date, session_date, event_type, extra_fields, total_price, dp_paid, is_fully_paid, status, settlement_status, final_adjustments, final_payment_amount, final_paid_at, user_id, services(id, name, price, description, is_addon), booking_services(id, kind, sort_order, quantity, service:services(id, name, price, description, is_addon))",
    )
    .eq("booking_code", bookingCode)
    .maybeSingle<InvoiceBookingRow>();

  if (!booking) {
    return null;
  }

  const profileSelect = "studio_name, studio_address, invoice_logo_url";
  const { data: profileWithAddress, error: profileWithAddressError } =
    await supabase
      .from("profiles")
      .select(profileSelect)
      .eq("id", booking.user_id)
      .maybeSingle<InvoiceProfileRow>();

  const missingStudioAddressColumn =
    typeof profileWithAddressError?.message === "string" &&
    /Could not find the 'studio_address' column|studio_address["']?\s+does not exist/i.test(
      profileWithAddressError.message,
    );
  let profile: InvoiceProfileRow | null = profileWithAddress || null;

  if (missingStudioAddressColumn) {
    const { data: legacyProfile } = await supabase
      .from("profiles")
      .select("studio_name, invoice_logo_url")
      .eq("id", booking.user_id)
      .maybeSingle<Pick<InvoiceProfileRow, "studio_name" | "invoice_logo_url">>();
    profile = legacyProfile
      ? {
          ...legacyProfile,
          studio_address: null,
        }
      : null;
  }

  return {
    booking,
    profile: profile || null,
  } as InvoicePayload;
}

export async function getInvoicePayloadCached(
  bookingCode: string,
  stage: string,
  locale: string,
) {
  const normalizedCode = normalizeBookingCode(bookingCode);
  if (!normalizedCode) return null;

  const bookingStamp = await fetchBookingStamp(normalizedCode);
  if (!bookingStamp) return null;

  const profileStamp = await fetchProfileStamp(bookingStamp.user_id);
  const normalizedStage = normalizeInvoiceStage(stage);
  const normalizedLocale = normalizePublicLocale(locale);

  const cacheKey = [
    "public-invoice-payload",
    normalizedCode.toLowerCase(),
    normalizedStage,
    normalizedLocale,
    bookingStamp.id,
    bookingStamp.updated_at || "no-booking-updated-at",
    profileStamp?.updated_at || "no-profile-updated-at",
  ];

  const cached = unstable_cache(
    async () => fetchInvoicePayload(normalizedCode),
    cacheKey,
    {
      revalidate: false,
      tags: [
        buildInvoiceCacheTag(normalizedCode, normalizedStage, normalizedLocale),
        buildInvoiceUserCacheTag(bookingStamp.user_id),
      ],
    },
  );

  return cached();
}
