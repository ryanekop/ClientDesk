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

export function buildExtraFieldTemplateVars(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};

  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(
      ([key, value]) =>
        key !== "custom_fields" &&
        typeof value === "string" &&
        value.trim().length > 0,
    ),
  ) as Record<string, string>;
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
