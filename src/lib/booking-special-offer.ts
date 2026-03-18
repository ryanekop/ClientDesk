import type { BookingServiceSelection } from "@/lib/booking-services";

type UnknownRecord = Record<string, unknown>;

export type BookingSpecialLinkRule = {
  id: string;
  token: string;
  userId: string;
  name: string;
  eventTypeLocked: boolean;
  eventTypes: string[];
  packageLocked: boolean;
  packageServiceIds: string[];
  addonLocked: boolean;
  addonServiceIds: string[];
  accommodationFee: number;
  discountAmount: number;
  isActive: boolean;
  consumedAt: string | null;
  consumedBookingId: string | null;
};

export type BookingSpecialOfferSnapshot = {
  link_id: string;
  link_name: string | null;
  event_type_locked: boolean;
  event_types: string[];
  selected_event_type: string | null;
  package_locked: boolean;
  addon_locked: boolean;
  package_service_ids: string[];
  addon_service_ids: string[];
  selected_package_service_ids: string[];
  selected_addon_service_ids: string[];
  package_total: number;
  addon_total: number;
  accommodation_fee: number;
  discount_amount: number;
  final_total: number;
  applied_at: string;
};

export type BookingInitialPriceBreakdown = {
  packageTotal: number;
  addonTotal: number;
  accommodationFee: number;
  discountAmount: number;
  totalPrice: number;
  source: "special_offer" | "legacy";
  specialOffer: BookingSpecialOfferSnapshot | null;
};

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

export function toNonNegativeMoney(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim().replace(/,/g, ""))
        : Number.NaN;
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(parsed, 0);
}

export function normalizeUuidList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean),
    ),
  );
}

export function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean),
    ),
  );
}

export function normalizeSpecialOfferToken(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeBookingSpecialLinkRule(
  row: unknown,
): BookingSpecialLinkRule | null {
  const record = asRecord(row);
  if (!record) return null;

  const id = typeof record.id === "string" ? record.id.trim() : "";
  const token = normalizeSpecialOfferToken(record.token);
  const userId = typeof record.user_id === "string" ? record.user_id.trim() : "";
  if (!id || !token || !userId) return null;

  return {
    id,
    token,
    userId,
    name:
      typeof record.name === "string" && record.name.trim()
        ? record.name.trim()
        : "Special Booking",
    eventTypeLocked: record.event_type_locked === true,
    eventTypes: normalizeStringList(record.event_types),
    packageLocked: record.package_locked === true,
    packageServiceIds: normalizeUuidList(record.package_service_ids),
    addonLocked: record.addon_locked === true,
    addonServiceIds: normalizeUuidList(record.addon_service_ids),
    accommodationFee: toNonNegativeMoney(record.accommodation_fee),
    discountAmount: toNonNegativeMoney(record.discount_amount),
    isActive: record.is_active !== false,
    consumedAt:
      typeof record.consumed_at === "string" && record.consumed_at.trim()
        ? record.consumed_at
        : null,
    consumedBookingId:
      typeof record.consumed_booking_id === "string" &&
      record.consumed_booking_id.trim()
        ? record.consumed_booking_id
        : null,
  };
}

export function isBookingSpecialLinkAvailable(
  rule: BookingSpecialLinkRule | null | undefined,
) {
  return Boolean(
    rule &&
      rule.isActive &&
      !rule.consumedAt &&
      !rule.consumedBookingId &&
      (!rule.eventTypeLocked || rule.eventTypes.length > 0) &&
      (!rule.packageLocked || rule.packageServiceIds.length > 0) &&
      (!rule.addonLocked || rule.addonServiceIds.length > 0),
  );
}

export function computeSpecialOfferTotal(input: {
  packageTotal: number;
  addonTotal: number;
  accommodationFee?: number;
  discountAmount?: number;
}) {
  const packageTotal = toNonNegativeMoney(input.packageTotal);
  const addonTotal = toNonNegativeMoney(input.addonTotal);
  const accommodationFee = toNonNegativeMoney(input.accommodationFee);
  const discountAmount = toNonNegativeMoney(input.discountAmount);
  return Math.max(packageTotal + addonTotal + accommodationFee - discountAmount, 0);
}

export function buildSpecialOfferSnapshot(input: {
  rule: BookingSpecialLinkRule;
  selectedEventType?: string | null;
  selectedPackageServiceIds: string[];
  selectedAddonServiceIds: string[];
  packageTotal: number;
  addonTotal: number;
}) {
  const packageTotal = toNonNegativeMoney(input.packageTotal);
  const addonTotal = toNonNegativeMoney(input.addonTotal);
  const accommodationFee = toNonNegativeMoney(input.rule.accommodationFee);
  const discountAmount = toNonNegativeMoney(input.rule.discountAmount);
  return {
    link_id: input.rule.id,
    link_name: input.rule.name || null,
    event_type_locked: input.rule.eventTypeLocked,
    event_types: normalizeStringList(input.rule.eventTypes),
    selected_event_type:
      typeof input.selectedEventType === "string" &&
      input.selectedEventType.trim()
        ? input.selectedEventType.trim()
        : null,
    package_locked: input.rule.packageLocked,
    addon_locked: input.rule.addonLocked,
    package_service_ids: normalizeUuidList(input.rule.packageServiceIds),
    addon_service_ids: normalizeUuidList(input.rule.addonServiceIds),
    selected_package_service_ids: normalizeUuidList(input.selectedPackageServiceIds),
    selected_addon_service_ids: normalizeUuidList(input.selectedAddonServiceIds),
    package_total: packageTotal,
    addon_total: addonTotal,
    accommodation_fee: accommodationFee,
    discount_amount: discountAmount,
    final_total: computeSpecialOfferTotal({
      packageTotal,
      addonTotal,
      accommodationFee,
      discountAmount,
    }),
    applied_at: new Date().toISOString(),
  } satisfies BookingSpecialOfferSnapshot;
}

export function buildEditableSpecialOfferSnapshot(input: {
  existingSnapshot?: BookingSpecialOfferSnapshot | null;
  selectedEventType?: string | null;
  selectedPackageServiceIds: string[];
  selectedAddonServiceIds: string[];
  packageTotal: number;
  addonTotal: number;
  accommodationFee?: number;
  discountAmount?: number;
  includeWhenZero?: boolean;
}): BookingSpecialOfferSnapshot | null {
  const packageTotal = toNonNegativeMoney(input.packageTotal);
  const addonTotal = toNonNegativeMoney(input.addonTotal);
  const accommodationFee = toNonNegativeMoney(input.accommodationFee);
  const discountAmount = toNonNegativeMoney(input.discountAmount);
  const existingSnapshot = input.existingSnapshot || null;

  const shouldPersist =
    Boolean(existingSnapshot) ||
    Boolean(input.includeWhenZero) ||
    accommodationFee > 0 ||
    discountAmount > 0;
  if (!shouldPersist) return null;

  const selectedEventType =
    typeof input.selectedEventType === "string" && input.selectedEventType.trim()
      ? input.selectedEventType.trim()
      : existingSnapshot?.selected_event_type || null;

  const selectedPackageServiceIds = normalizeUuidList(input.selectedPackageServiceIds);
  const selectedAddonServiceIds = normalizeUuidList(input.selectedAddonServiceIds);

  return {
    link_id: existingSnapshot?.link_id || "manual-special-offer",
    link_name: existingSnapshot?.link_name || "Penyesuaian Admin",
    event_type_locked: existingSnapshot?.event_type_locked === true,
    event_types: normalizeStringList(existingSnapshot?.event_types || []),
    selected_event_type: selectedEventType,
    package_locked: existingSnapshot?.package_locked === true,
    addon_locked: existingSnapshot?.addon_locked === true,
    package_service_ids:
      normalizeUuidList(existingSnapshot?.package_service_ids || []).length > 0
        ? normalizeUuidList(existingSnapshot?.package_service_ids || [])
        : selectedPackageServiceIds,
    addon_service_ids:
      normalizeUuidList(existingSnapshot?.addon_service_ids || []).length > 0
        ? normalizeUuidList(existingSnapshot?.addon_service_ids || [])
        : selectedAddonServiceIds,
    selected_package_service_ids: selectedPackageServiceIds,
    selected_addon_service_ids: selectedAddonServiceIds,
    package_total: packageTotal,
    addon_total: addonTotal,
    accommodation_fee: accommodationFee,
    discount_amount: discountAmount,
    final_total: computeSpecialOfferTotal({
      packageTotal,
      addonTotal,
      accommodationFee,
      discountAmount,
    }),
    applied_at: new Date().toISOString(),
  };
}

export function mergeSpecialOfferSnapshotIntoExtraFields(
  extraFields: unknown,
  snapshot: BookingSpecialOfferSnapshot | null,
): Record<string, unknown> | null {
  const current = asRecord(extraFields);
  const next: Record<string, unknown> = current ? { ...current } : {};
  if (snapshot) {
    next.special_offer = snapshot;
  } else {
    delete next.special_offer;
  }
  return Object.keys(next).length > 0 ? next : null;
}

export function resolveSpecialOfferSnapshotFromExtraFields(
  extraFields: unknown,
): BookingSpecialOfferSnapshot | null {
  const root = asRecord(extraFields);
  if (!root) return null;
  const payload = asRecord(root.special_offer);
  if (!payload) return null;

  const linkId = typeof payload.link_id === "string" ? payload.link_id.trim() : "";
  if (!linkId) return null;

  const packageTotal = toNonNegativeMoney(payload.package_total);
  const addonTotal = toNonNegativeMoney(payload.addon_total);
  const accommodationFee = toNonNegativeMoney(payload.accommodation_fee);
  const discountAmount = toNonNegativeMoney(payload.discount_amount);
  const fallbackTotal = computeSpecialOfferTotal({
    packageTotal,
    addonTotal,
    accommodationFee,
    discountAmount,
  });
  const finalTotalRaw = toNonNegativeMoney(payload.final_total);

  return {
    link_id: linkId,
    link_name:
      typeof payload.link_name === "string" && payload.link_name.trim()
        ? payload.link_name.trim()
        : null,
    event_type_locked: payload.event_type_locked === true,
    event_types: normalizeStringList(payload.event_types),
    selected_event_type:
      typeof payload.selected_event_type === "string" &&
      payload.selected_event_type.trim()
        ? payload.selected_event_type.trim()
        : null,
    package_locked: payload.package_locked === true,
    addon_locked: payload.addon_locked === true,
    package_service_ids: normalizeUuidList(payload.package_service_ids),
    addon_service_ids: normalizeUuidList(payload.addon_service_ids),
    selected_package_service_ids: normalizeUuidList(
      payload.selected_package_service_ids,
    ),
    selected_addon_service_ids: normalizeUuidList(payload.selected_addon_service_ids),
    package_total: packageTotal,
    addon_total: addonTotal,
    accommodation_fee: accommodationFee,
    discount_amount: discountAmount,
    final_total: finalTotalRaw > 0 || fallbackTotal === 0 ? finalTotalRaw : fallbackTotal,
    applied_at:
      typeof payload.applied_at === "string" && payload.applied_at.trim()
        ? payload.applied_at
        : "",
  };
}

export function getInitialBookingPriceBreakdown(input: {
  totalPrice: number;
  serviceSelections?: BookingServiceSelection[] | null;
  legacyServicePrice?: number | null;
  extraFields?: unknown;
}): BookingInitialPriceBreakdown {
  const normalizedTotal = toNonNegativeMoney(input.totalPrice);
  const specialOffer = resolveSpecialOfferSnapshotFromExtraFields(input.extraFields);
  if (specialOffer) {
    return {
      packageTotal: specialOffer.package_total,
      addonTotal: specialOffer.addon_total,
      accommodationFee: specialOffer.accommodation_fee,
      discountAmount: specialOffer.discount_amount,
      totalPrice: toNonNegativeMoney(specialOffer.final_total || normalizedTotal),
      source: "special_offer",
      specialOffer,
    };
  }

  const selections = Array.isArray(input.serviceSelections) ? input.serviceSelections : [];
  const packageFromSelections = selections
    .filter((item) => item.kind === "main")
    .reduce((sum, item) => sum + toNonNegativeMoney(item.service.price), 0);
  const addonFromSelections = selections
    .filter((item) => item.kind === "addon")
    .reduce((sum, item) => sum + toNonNegativeMoney(item.service.price), 0);

  let packageTotal = packageFromSelections;
  let addonTotal = addonFromSelections;

  if (packageTotal <= 0 && addonTotal > 0) {
    packageTotal = Math.max(normalizedTotal - addonTotal, 0);
  }
  if (packageTotal <= 0) {
    packageTotal = toNonNegativeMoney(input.legacyServicePrice);
  }
  if (packageTotal <= 0) {
    packageTotal = normalizedTotal;
  }
  if (addonTotal <= 0) {
    addonTotal = Math.max(normalizedTotal - packageTotal, 0);
  }

  return {
    packageTotal,
    addonTotal,
    accommodationFee: 0,
    discountAmount: 0,
    totalPrice: normalizedTotal,
    source: "legacy",
    specialOffer: null,
  };
}
