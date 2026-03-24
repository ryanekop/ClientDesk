import type {
  Subscription,
  SubscriptionStatus,
  SubscriptionTier,
} from "@/utils/subscription-service";

export type BookingWriteAccessReason = "active" | "expired";
export type BookingAccessLocale = "id" | "en";

export type BookingWriteAccessState = {
  canWriteBookings: boolean;
  isReadOnlyBookings: boolean;
  reason: BookingWriteAccessReason;
  hasSubscriptionRecord: boolean;
  subscriptionTier: SubscriptionTier | null;
  subscriptionStatus: SubscriptionStatus | null;
};

export const DEFAULT_BOOKING_WRITE_ACCESS: BookingWriteAccessState = {
  canWriteBookings: true,
  isReadOnlyBookings: false,
  reason: "active",
  hasSubscriptionRecord: false,
  subscriptionTier: null,
  subscriptionStatus: null,
};

function isValidFutureDate(value: string | null, now: Date) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() >= now.getTime();
}

export function resolveBookingWriteAccess(
  subscription: Subscription | null,
  now = new Date(),
): BookingWriteAccessState {
  if (!subscription) {
    return DEFAULT_BOOKING_WRITE_ACCESS;
  }

  const baseState = {
    hasSubscriptionRecord: true,
    subscriptionTier: subscription.tier,
    subscriptionStatus: subscription.status,
  } satisfies Pick<
    BookingWriteAccessState,
    "hasSubscriptionRecord" | "subscriptionTier" | "subscriptionStatus"
  >;

  if (subscription.tier === "lifetime") {
    return {
      ...baseState,
      canWriteBookings: true,
      isReadOnlyBookings: false,
      reason: "active",
    };
  }

  if (
    subscription.status === "active" &&
    isValidFutureDate(subscription.end_date, now)
  ) {
    return {
      ...baseState,
      canWriteBookings: true,
      isReadOnlyBookings: false,
      reason: "active",
    };
  }

  if (
    subscription.status === "trial" &&
    isValidFutureDate(subscription.trial_end_date, now)
  ) {
    return {
      ...baseState,
      canWriteBookings: true,
      isReadOnlyBookings: false,
      reason: "active",
    };
  }

  return {
    ...baseState,
    canWriteBookings: false,
    isReadOnlyBookings: true,
    reason: "expired",
  };
}

export function normalizeBookingAccessLocale(
  locale?: string | null,
): BookingAccessLocale {
  return locale === "en" ? "en" : "id";
}

export function getBookingWriteBlockedTitle(
  locale?: string | null,
): string {
  const resolvedLocale = normalizeBookingAccessLocale(locale);
  return resolvedLocale === "en"
    ? "Booking Access Locked"
    : "Akses Booking Terkunci";
}

export function getBookingWriteBlockedMessage(
  locale?: string | null,
): string {
  const resolvedLocale = normalizeBookingAccessLocale(locale);
  return resolvedLocale === "en"
    ? "Your trial or subscription has ended. You can still log in and view data, but creating, editing, or deleting bookings is locked until the subscription is renewed."
    : "Masa trial atau langganan akun sudah berakhir. Anda masih bisa login dan melihat data, tetapi membuat, mengubah, atau menghapus booking dikunci sampai langganan diperpanjang.";
}

export function getBookingWriteBlockedPublicMessage(
  locale?: string | null,
): string {
  const resolvedLocale = normalizeBookingAccessLocale(locale);
  return resolvedLocale === "en"
    ? "This booking form is temporarily unavailable because the admin account subscription has expired. Please contact the admin for further assistance."
    : "Form booking sementara tidak bisa dipakai karena masa trial atau langganan akun admin sudah berakhir. Silakan hubungi admin untuk informasi lebih lanjut.";
}
