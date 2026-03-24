import {
  formatSessionTime,
  formatTemplateSessionDate,
} from "@/utils/format-date";
import { buildGoogleMapsUrlOrFallback } from "@/utils/location";
import { UNIVERSITY_REFERENCE_EXTRA_KEY } from "@/lib/university-references";

export type EventExtraField = {
  key: string;
  label: string;
  isLocation?: boolean;
  fullWidth?: boolean;
  required?: boolean;
  isNumeric?: boolean;
};

export const EVENT_EXTRA_FIELDS: Record<string, EventExtraField[]> = {
  Wisuda: [
    { key: "universitas", label: "Universitas" },
    { key: "fakultas", label: "Fakultas" },
  ],
  Wedding: [
    {
      key: "nama_pasangan",
      label: "Nama Pasangan",
      fullWidth: true,
      required: true,
    },
    { key: "instagram_pasangan", label: "Instagram Pasangan", fullWidth: true },
    {
      key: "jumlah_tamu",
      label: "Estimasi Tamu",
      fullWidth: true,
      isNumeric: true,
    },
    {
      key: "tempat_akad",
      label: "Lokasi Akad",
      isLocation: true,
      required: true,
    },
    {
      key: "tempat_resepsi",
      label: "Lokasi Resepsi",
      isLocation: true,
      required: true,
    },
  ],
  Akad: [
    {
      key: "nama_pasangan",
      label: "Nama Pasangan",
      fullWidth: true,
      required: true,
    },
    { key: "instagram_pasangan", label: "Instagram Pasangan", fullWidth: true },
    {
      key: "jumlah_tamu",
      label: "Estimasi Tamu",
      fullWidth: true,
      isNumeric: true,
    },
  ],
  Resepsi: [
    {
      key: "nama_pasangan",
      label: "Nama Pasangan",
      fullWidth: true,
      required: true,
    },
    { key: "instagram_pasangan", label: "Instagram Pasangan", fullWidth: true },
    {
      key: "jumlah_tamu",
      label: "Estimasi Tamu",
      fullWidth: true,
      isNumeric: true,
    },
  ],
  Lamaran: [
    {
      key: "nama_pasangan",
      label: "Nama Pasangan",
      fullWidth: true,
      required: true,
    },
    { key: "instagram_pasangan", label: "Instagram Pasangan", fullWidth: true },
    {
      key: "jumlah_tamu",
      label: "Estimasi Tamu",
      fullWidth: true,
      isNumeric: true,
    },
  ],
  Prewedding: [
    {
      key: "nama_pasangan",
      label: "Nama Pasangan",
      fullWidth: true,
      required: true,
    },
    { key: "instagram_pasangan", label: "Instagram Pasangan", fullWidth: true },
  ],
  Maternity: [
    { key: "usia_kehamilan", label: "Usia Kehamilan" },
    { key: "gender_bayi", label: "Gender Bayi" },
  ],
  Newborn: [
    { key: "nama_bayi", label: "Nama Bayi" },
    { key: "tanggal_lahir", label: "Tanggal Lahir" },
  ],
  Komersil: [
    { key: "nama_brand", label: "Nama Brand" },
    { key: "tipe_konten", label: "Tipe Konten" },
  ],
  Family: [{ key: "jumlah_anggota", label: "Jumlah Anggota" }],
};

export const MULTI_SESSION_TEMPLATE_KEYS = [
  "akad_location",
  "akad_date",
  "akad_time",
  "resepsi_location",
  "resepsi_date",
  "resepsi_time",
  "resepsi_maps_url",
] as const;

const EXTRA_FIELD_PREVIEW_VALUES: Record<string, string> = {
  universitas: "Universitas Indonesia",
  fakultas: "FISIP",
  nama_pasangan: "Sinta",
  instagram_pasangan: "@sintaaulia",
  jumlah_tamu: "300",
  tempat_akad: "Masjid Raya",
  tempat_resepsi: "Grand Ballroom",
  usia_kehamilan: "32 minggu",
  gender_bayi: "Perempuan",
  nama_bayi: "Alya",
  tanggal_lahir: "10 Februari 2026",
  nama_brand: "Atelier Maison",
  tipe_konten: "Katalog Produk",
  jumlah_anggota: "5 orang",
};

export function getEventExtraFields(eventType: string | null | undefined): EventExtraField[] {
  if (!eventType) return [];
  return EVENT_EXTRA_FIELDS[eventType] || [];
}

export function getEventExtraFieldTemplateTokens(
  eventType: string | null | undefined,
  format: "calendar" | "drive" = "calendar",
): string[] {
  const wrap = format === "drive"
    ? (key: string) => `{${key}}`
    : (key: string) => `{{${key}}}`;

  return getEventExtraFields(eventType).map((field) => wrap(field.key));
}

export function getMultiSessionTemplateTokens(
  format: "calendar" | "drive" | "whatsapp" = "calendar",
): string[] {
  const wrap = format === "drive"
    ? (key: string) => `{${key}}`
    : (key: string) => `{{${key}}}`;
  return MULTI_SESSION_TEMPLATE_KEYS.map((key) => wrap(key));
}

export function buildExtraFieldTemplateVars(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};

  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(
      ([key, value]) =>
        key !== "custom_fields" &&
        key !== UNIVERSITY_REFERENCE_EXTRA_KEY &&
        typeof value === "string" &&
        value.trim().length > 0,
    ),
  ) as Record<string, string>;
}

function readStringField(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "string" ? value.trim() : "";
}

function buildSessionDateTimeVars(
  source: Record<string, unknown>,
  key: string,
  locale: "id" | "en",
) {
  const raw = readStringField(source, key);
  if (!raw) {
    return { date: "", time: "" };
  }

  const formattedDate = formatTemplateSessionDate(raw, { locale });
  const formattedTime = formatSessionTime(raw);

  return {
    date: formattedDate === "-" ? raw : formattedDate,
    time: formattedTime === "-" ? "" : formattedTime,
  };
}

export function buildMultiSessionTemplateVars(
  raw: unknown,
  options: { locale?: "id" | "en" } = {},
): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};

  const locale = options.locale || "id";
  const source = raw as Record<string, unknown>;

  const akad = buildSessionDateTimeVars(source, "tanggal_akad", locale);
  const resepsi = buildSessionDateTimeVars(source, "tanggal_resepsi", locale);
  const akadLocation = readStringField(source, "tempat_akad");
  const resepsiLocation = readStringField(source, "tempat_resepsi");
  const resepsiMapsUrl = buildGoogleMapsUrlOrFallback(
    { address: resepsiLocation || null },
    "-",
  );

  const entries = [
    ["akad_location", akadLocation],
    ["akad_date", akad.date],
    ["akad_time", akad.time],
    ["resepsi_location", resepsiLocation],
    ["resepsi_date", resepsi.date],
    ["resepsi_time", resepsi.time],
    ["resepsi_maps_url", resepsiMapsUrl],
  ].filter(([, value]) => value.length > 0) as Array<[string, string]>;

  return Object.fromEntries(entries);
}

export function getEventExtraFieldPreviewVars(
  eventType: string | null | undefined,
): Record<string, string> {
  return Object.fromEntries(
    getEventExtraFields(eventType).map((field) => [
      field.key,
      EXTRA_FIELD_PREVIEW_VALUES[field.key] || field.label,
    ]),
  );
}
