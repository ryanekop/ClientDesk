export type FastpikLinkDisplayMode = "both" | "prefer_fastpik" | "drive_only";

export function normalizeFastpikLinkDisplayMode(
  value: unknown,
): FastpikLinkDisplayMode {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "both" || raw === "prefer_fastpik" || raw === "drive_only") {
    return raw;
  }
  return "prefer_fastpik";
}

function normalizeUrl(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

export function resolveFastpikLinkDisplay(params: {
  mode: unknown;
  fastpikUrl: string | null | undefined;
  driveUrl: string | null | undefined;
}) {
  const mode = normalizeFastpikLinkDisplayMode(params.mode);
  const fastpikUrl = normalizeUrl(params.fastpikUrl);
  const driveUrl = normalizeUrl(params.driveUrl);

  const hasFastpik = Boolean(fastpikUrl);
  const hasDrive = Boolean(driveUrl);

  if (mode === "both") {
    return {
      mode,
      hasFastpik,
      hasDrive,
      showFastpik: hasFastpik,
      showDrive: hasDrive,
      fastpikUrl,
      driveUrl,
      primaryUrl: fastpikUrl || driveUrl,
      primaryType: fastpikUrl ? "fastpik" : driveUrl ? "drive" : null,
    } as const;
  }

  if (mode === "drive_only") {
    return {
      mode,
      hasFastpik,
      hasDrive,
      showFastpik: false,
      showDrive: hasDrive,
      fastpikUrl,
      driveUrl,
      primaryUrl: driveUrl,
      primaryType: driveUrl ? "drive" : null,
    } as const;
  }

  return {
    mode,
    hasFastpik,
    hasDrive,
    showFastpik: hasFastpik,
    showDrive: !hasFastpik && hasDrive,
    fastpikUrl,
    driveUrl,
    primaryUrl: fastpikUrl || driveUrl,
    primaryType: fastpikUrl ? "fastpik" : driveUrl ? "drive" : null,
  } as const;
}
