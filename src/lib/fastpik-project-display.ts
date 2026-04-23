import type { FastpikProjectInfoSnapshot } from "@/lib/fastpik-project-info";

export function formatFastpikToggleLabel(
  value: boolean | null | undefined,
  locale: string,
) {
  if (value === null || value === undefined) return "-";
  if (locale === "en") return value ? "Enabled" : "Disabled";
  return value ? "Aktif" : "Nonaktif";
}

export function formatFastpikDurationLabel(params: {
  days: number | null | undefined;
  enabled?: boolean | null | undefined;
  locale: string;
  unknownNullAsUnlimited?: boolean;
}) {
  const { days, enabled, locale, unknownNullAsUnlimited = false } = params;

  if (typeof days === "number") {
    return locale === "en" ? `${days} days` : `${days} hari`;
  }

  if (enabled === false) {
    return locale === "en" ? "Disabled" : "Nonaktif";
  }

  if (enabled === true || unknownNullAsUnlimited) {
    return locale === "en" ? "Unlimited" : "Selamanya";
  }

  return "-";
}

export function formatFastpikProjectTypeLabel(
  value: string | null | undefined,
  locale: string,
) {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return "-";
  if (normalized === "print") {
    return locale === "en" ? "Print" : "Cetak";
  }
  if (normalized === "edit") {
    return locale === "en" ? "Photo Selection" : "Pilih Foto";
  }
  return value || "-";
}

export function formatFastpikPhotoCountLabel(
  value: number | null | undefined,
  locale: string,
) {
  if (typeof value !== "number") return "-";
  return locale === "en" ? `${value} photos` : `${value} foto`;
}

export function formatFastpikDetailValue(params: {
  primary: string | null | undefined;
  description?: string | null | undefined;
}) {
  const primary = typeof params.primary === "string" ? params.primary.trim() : "";
  const description =
    typeof params.description === "string" ? params.description.trim() : "";

  return {
    primary: primary || "-",
    description: description || null,
    isEmpty: !primary && !description,
  };
}

export function hasFastpikPrintConfiguration(
  snapshot: FastpikProjectInfoSnapshot | null | undefined,
) {
  if (!snapshot) return false;
  return (
    snapshot.print_enabled !== null ||
    snapshot.print_days !== null ||
    snapshot.max_photos !== null ||
    Boolean(snapshot.print_template_label) ||
    Boolean(snapshot.print_template_description) ||
    Boolean(snapshot.print_size_label) ||
    Boolean(snapshot.print_size_description)
  );
}
