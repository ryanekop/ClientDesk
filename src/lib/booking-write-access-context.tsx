"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { AlertCircle } from "lucide-react";
import {
  DEFAULT_BOOKING_WRITE_ACCESS,
  getBookingWriteBlockedMessage,
  getBookingWriteBlockedTitle,
  normalizeBookingAccessLocale,
  type BookingWriteAccessState,
} from "@/lib/booking-write-access";
import { cn } from "@/lib/utils";

const BookingWriteAccessContext = React.createContext<BookingWriteAccessState>(
  DEFAULT_BOOKING_WRITE_ACCESS,
);

export function BookingWriteAccessProvider({
  value,
  children,
}: {
  value: BookingWriteAccessState;
  children: React.ReactNode;
}) {
  return (
    <BookingWriteAccessContext.Provider value={value}>
      {children}
    </BookingWriteAccessContext.Provider>
  );
}

export function useBookingWriteAccess() {
  return React.useContext(BookingWriteAccessContext);
}

export function useBookingWriteGuard(
  onBlocked?: (payload: { title: string; message: string }) => void,
) {
  const locale = useLocale();
  const access = useBookingWriteAccess();

  return React.useCallback(() => {
    if (access.canWriteBookings) return true;
    onBlocked?.({
      title: getBookingWriteBlockedTitle(locale),
      message: getBookingWriteBlockedMessage(locale),
    });
    return false;
  }, [access.canWriteBookings, locale, onBlocked]);
}

export function BookingWriteReadonlyBanner({
  className,
}: {
  className?: string;
}) {
  const locale = useLocale();
  const access = useBookingWriteAccess();

  if (access.canWriteBookings) return null;

  const resolvedLocale = normalizeBookingAccessLocale(locale);

  return (
    <div
      className={cn(
        "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold">
            {resolvedLocale === "en"
              ? "Booking pages are currently read-only"
              : "Halaman booking sedang mode read-only"}
          </p>
          <p className="text-amber-800 dark:text-amber-100/90">
            {getBookingWriteBlockedMessage(resolvedLocale)}
          </p>
        </div>
      </div>
    </div>
  );
}
