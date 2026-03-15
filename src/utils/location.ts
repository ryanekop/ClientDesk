export type LocationCoordinates = {
  lat: number | null;
  lng: number | null;
};

export type LocationCandidate = {
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
};

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "-") return null;
  return trimmed ? trimmed : null;
}

export function normalizeCoordinate(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function hasLocationCoordinates(
  lat: number | null | undefined,
  lng: number | null | undefined,
): lat is number {
  return (
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    typeof lng === "number" &&
    Number.isFinite(lng)
  );
}

export function resolvePreferredLocation(candidates: LocationCandidate[]) {
  for (const candidate of candidates) {
    const address = normalizeText(candidate.address);
    if (!address) continue;

    return {
      location: address,
      locationLat: normalizeCoordinate(candidate.lat),
      locationLng: normalizeCoordinate(candidate.lng),
    };
  }

  return {
    location: null,
    locationLat: null,
    locationLng: null,
  };
}

export function buildGoogleMapsQueryUrl(candidate: LocationCandidate) {
  if (hasLocationCoordinates(candidate.lat, candidate.lng)) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(
      `${candidate.lat},${candidate.lng}`,
    )}`;
  }

  const address = normalizeText(candidate.address);
  if (!address) return null;

  return `https://maps.google.com/maps?q=${encodeURIComponent(address)}`;
}

export function buildGoogleMapsDirectionUrl(candidate: LocationCandidate) {
  if (hasLocationCoordinates(candidate.lat, candidate.lng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      `${candidate.lat},${candidate.lng}`,
    )}`;
  }

  const address = normalizeText(candidate.address);
  if (!address) return null;

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    address,
  )}`;
}

export function buildGoogleMapsUrlOrFallback(
  candidate: LocationCandidate,
  fallback = "-",
) {
  return buildGoogleMapsQueryUrl(candidate) || fallback;
}
