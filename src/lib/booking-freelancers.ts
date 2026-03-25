function normalizeFreelancerName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function uniqueFreelancerNames(values: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(normalized);
  }

  return unique;
}

export function resolveBookingFreelancerNames(input: {
  bookingFreelance?: unknown;
  legacyFreelance?: unknown;
}) {
  const junctionNames = Array.isArray(input.bookingFreelance)
    ? input.bookingFreelance
        .map((item) => {
          if (!item || typeof item !== "object") return "";
          const row = item as { freelance?: unknown; name?: unknown };
          if (row.freelance && typeof row.freelance === "object") {
            return normalizeFreelancerName(
              (row.freelance as { name?: unknown }).name,
            );
          }
          return normalizeFreelancerName(row.name);
        })
        .filter(Boolean)
    : [];

  if (junctionNames.length > 0) {
    return uniqueFreelancerNames(junctionNames);
  }

  if (input.legacyFreelance && typeof input.legacyFreelance === "object") {
    const legacyName = normalizeFreelancerName(
      (input.legacyFreelance as { name?: unknown }).name,
    );
    if (legacyName) return [legacyName];
  }

  return [];
}

export function formatBookingFreelancerNames(
  names: string[],
  fallback = "-",
) {
  const normalized = uniqueFreelancerNames(names);
  return normalized.length > 0 ? normalized.join(", ") : fallback;
}
