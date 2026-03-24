import {
  getBookingWriteBlockedMessage,
  getBookingWriteBlockedPublicMessage,
  resolveBookingWriteAccess,
  type BookingWriteAccessState,
} from "@/lib/booking-write-access";
import { getSubscription } from "@/utils/subscription-service";

export class BookingWriteAccessDeniedError extends Error {
  access: BookingWriteAccessState;
  status: number;

  constructor(
    access: BookingWriteAccessState,
    options?: {
      locale?: string | null;
      publicFacing?: boolean;
    },
  ) {
    super(
      options?.publicFacing
        ? getBookingWriteBlockedPublicMessage(options.locale)
        : getBookingWriteBlockedMessage(options?.locale),
    );
    this.name = "BookingWriteAccessDeniedError";
    this.access = access;
    this.status = 403;
  }
}

export async function getBookingWriteAccessForUser(
  userId: string,
): Promise<BookingWriteAccessState> {
  const subscription = await getSubscription(userId);
  return resolveBookingWriteAccess(subscription);
}

export async function assertBookingWriteAccessForUser(
  userId: string,
  options?: {
    locale?: string | null;
    publicFacing?: boolean;
  },
): Promise<BookingWriteAccessState> {
  const access = await getBookingWriteAccessForUser(userId);
  if (!access.canWriteBookings) {
    throw new BookingWriteAccessDeniedError(access, options);
  }
  return access;
}
