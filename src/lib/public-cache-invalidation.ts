import { revalidateTag } from "next/cache";
import {
  buildInvoiceTagsForBooking,
  buildInvoiceUserCacheTag,
  buildTrackTagsForUuid,
  buildTrackUserCacheTag,
  buildVendorCacheTag,
  buildVendorUserCacheTag,
} from "@/lib/public-cache-tags";

type BookingInvalidationInput = {
  bookingCode?: string | null;
  trackingUuid?: string | null;
  vendorSlug?: string | null;
  userId?: string | null;
};

type ProfileInvalidationInput = {
  userId?: string | null;
  vendorSlug?: string | null;
  previousVendorSlug?: string | null;
};

function addTag(tags: Set<string>, value: string | null | undefined) {
  const normalized = (value || "").trim();
  if (!normalized) return;
  tags.add(normalized);
}

function revalidateTags(tags: Iterable<string>) {
  for (const tag of tags) {
    revalidateTag(tag, "max");
  }
}

export function invalidatePublicCachesForProfile(input: ProfileInvalidationInput) {
  const tags = new Set<string>();

  if (input.userId) {
    addTag(tags, buildVendorUserCacheTag(input.userId));
    addTag(tags, buildInvoiceUserCacheTag(input.userId));
    addTag(tags, buildTrackUserCacheTag(input.userId));
  }

  if (input.vendorSlug) {
    addTag(tags, buildVendorCacheTag(input.vendorSlug));
  }

  if (input.previousVendorSlug) {
    addTag(tags, buildVendorCacheTag(input.previousVendorSlug));
  }

  revalidateTags(tags);
}

export function invalidatePublicCachesForBooking(input: BookingInvalidationInput) {
  const tags = new Set<string>();

  if (input.userId) {
    addTag(tags, buildInvoiceUserCacheTag(input.userId));
    addTag(tags, buildTrackUserCacheTag(input.userId));
    addTag(tags, buildVendorUserCacheTag(input.userId));
  }

  if (input.vendorSlug) {
    addTag(tags, buildVendorCacheTag(input.vendorSlug));
  }

  if (input.bookingCode) {
    for (const tag of buildInvoiceTagsForBooking(input.bookingCode)) {
      addTag(tags, tag);
    }
  }

  if (input.trackingUuid) {
    for (const tag of buildTrackTagsForUuid(input.trackingUuid)) {
      addTag(tags, tag);
    }
  }

  revalidateTags(tags);
}
