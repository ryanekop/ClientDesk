import {
  isShowAllPackagesEventType,
  normalizeEventTypeList,
  normalizeEventTypeName,
} from "@/lib/event-type-config";
import { normalizeCityCode } from "@/lib/city-references";

export type BookingServiceGroup = "main" | "addon";

export type BookingServiceAvailabilityRecord = {
  is_addon?: boolean | null;
  event_types?: unknown;
  city_codes?: unknown;
};

type BookingAvailabilityInput = {
  eventType: string;
  cityCode?: string | null;
  allowCityFallbackWhenMissing?: boolean;
};

const CITY_SCOPED_EVENT_TYPE = "Wisuda";

export function isCityScopedBookingEventType(
  eventType: string | null | undefined,
): boolean {
  return normalizeEventTypeName(eventType) === CITY_SCOPED_EVENT_TYPE;
}

function getNormalizedServiceCityCodes(service: BookingServiceAvailabilityRecord) {
  if (!Array.isArray(service.city_codes)) return [];
  const deduped = new Set<string>();
  service.city_codes.forEach((cityCode) => {
    const normalizedCityCode = normalizeCityCode(cityCode);
    if (!normalizedCityCode) return;
    deduped.add(normalizedCityCode);
  });
  return Array.from(deduped);
}

function getNormalizedServiceEventTypes(service: BookingServiceAvailabilityRecord) {
  return normalizeEventTypeList(service.event_types);
}

export function isServiceAvailableForBookingSelection(
  service: BookingServiceAvailabilityRecord,
  input: BookingAvailabilityInput,
) {
  const normalizedEventType = normalizeEventTypeName(input.eventType);
  if (!normalizedEventType) return false;

  const showAllPackages = isShowAllPackagesEventType(normalizedEventType);
  const serviceEventTypes = getNormalizedServiceEventTypes(service);
  if (!showAllPackages && serviceEventTypes.length > 0) {
    if (!serviceEventTypes.includes(normalizedEventType)) {
      return false;
    }
  }

  if (!isCityScopedBookingEventType(normalizedEventType)) {
    return true;
  }

  const normalizedSelectedCityCode = normalizeCityCode(input.cityCode);
  if (!normalizedSelectedCityCode) {
    return Boolean(input.allowCityFallbackWhenMissing);
  }

  const serviceCityCodes = getNormalizedServiceCityCodes(service);
  if (serviceCityCodes.length === 0) {
    return true;
  }

  return serviceCityCodes.includes(normalizedSelectedCityCode);
}

export function filterServicesForBookingSelection<
  T extends BookingServiceAvailabilityRecord,
>(
  services: T[],
  input: BookingAvailabilityInput & { group: BookingServiceGroup },
) {
  if (!input.eventType) return [];
  const targetIsAddon = input.group === "addon";

  return services.filter((service) => {
    if (Boolean(service.is_addon) !== targetIsAddon) {
      return false;
    }

    return isServiceAvailableForBookingSelection(service, input);
  });
}
