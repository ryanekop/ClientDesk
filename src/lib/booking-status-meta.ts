import type { CSSProperties } from "react";

export type BookingStatusIconKey =
  | "clock"
  | "check-circle-2"
  | "camera"
  | "list-ordered"
  | "edit-3"
  | "refresh-cw"
  | "folder-check"
  | "party-popper"
  | "credit-card"
  | "upload-cloud"
  | "truck"
  | "calendar-check";

export type BookingStatusMeta = {
  icon?: BookingStatusIconKey;
  color?: string;
};

export type BookingStatusMetaMap = Record<string, BookingStatusMeta>;

export type BookingStatusBadgeStyle = {
  className: string;
  style?: CSSProperties;
};

export const BOOKING_STATUS_ICON_OPTIONS: Array<{
  key: BookingStatusIconKey;
  label: string;
}> = [
  { key: "clock", label: "Jam / Pending" },
  { key: "check-circle-2", label: "Checklist / Confirmed" },
  { key: "camera", label: "Kamera / Sesi Foto" },
  { key: "list-ordered", label: "Antrian" },
  { key: "edit-3", label: "Edit" },
  { key: "refresh-cw", label: "Revisi" },
  { key: "folder-check", label: "File Siap" },
  { key: "party-popper", label: "Selesai" },
  { key: "credit-card", label: "Pembayaran" },
  { key: "upload-cloud", label: "Upload" },
  { key: "truck", label: "Delivery" },
  { key: "calendar-check", label: "Kalender" },
];

export const BOOKING_STATUS_DEFAULT_COLOR_HEX_PALETTE = [
  "#1d4ed8",
  "#7e22ce",
  "#b45309",
  "#c2410c",
  "#be185d",
  "#15803d",
  "#047857",
  "#0e7490",
  "#4338ca",
  "#be123c",
] as const;

const VALID_ICON_KEYS = new Set(
  BOOKING_STATUS_ICON_OPTIONS.map((option) => option.key),
);

export function isValidBookingStatusIconKey(
  value: unknown,
): value is BookingStatusIconKey {
  return typeof value === "string" && VALID_ICON_KEYS.has(value as BookingStatusIconKey);
}

export function normalizeHexColor(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed.toLowerCase()}`;
  return "";
}

export function normalizeBookingStatusMeta(
  value: unknown,
  statuses: string[],
): BookingStatusMetaMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const source = value as Record<string, unknown>;
  const statusSet = new Set(statuses);
  const normalized: BookingStatusMetaMap = {};

  for (const [status, rawMeta] of Object.entries(source)) {
    if (!statusSet.has(status) || !rawMeta || typeof rawMeta !== "object" || Array.isArray(rawMeta)) {
      continue;
    }

    const meta = rawMeta as Record<string, unknown>;
    const icon = isValidBookingStatusIconKey(meta.icon) ? meta.icon : undefined;
    const color = normalizeHexColor(meta.color);
    if (icon || color) {
      normalized[status] = {
        ...(icon ? { icon } : {}),
        ...(color ? { color } : {}),
      };
    }
  }

  return normalized;
}

export function getDefaultStatusColor(statuses: string[], status: string) {
  const index = statuses.findIndex((item) => item === status);
  if (index < 0) return "";
  return BOOKING_STATUS_DEFAULT_COLOR_HEX_PALETTE[
    index % BOOKING_STATUS_DEFAULT_COLOR_HEX_PALETTE.length
  ];
}

export function getDefaultStatusMeta(statuses: string[]): BookingStatusMetaMap {
  return statuses.reduce<BookingStatusMetaMap>((acc, status, index) => {
    acc[status] = {
      color:
        BOOKING_STATUS_DEFAULT_COLOR_HEX_PALETTE[
          index % BOOKING_STATUS_DEFAULT_COLOR_HEX_PALETTE.length
        ],
    };
    return acc;
  }, {});
}

export function mergeStatusMetaWithDefaults(
  statuses: string[],
  value: unknown,
): BookingStatusMetaMap {
  const defaults = getDefaultStatusMeta(statuses);
  const normalized = normalizeBookingStatusMeta(value, statuses);
  return statuses.reduce<BookingStatusMetaMap>((acc, status) => {
    const defaultMeta = defaults[status] || {};
    const storedMeta = normalized[status] || {};
    acc[status] = {
      ...defaultMeta,
      ...storedMeta,
    };
    return acc;
  }, {});
}

export function updateBookingStatusMetaKey(
  meta: BookingStatusMetaMap,
  previousStatus: string,
  nextStatus: string,
) {
  if (previousStatus === nextStatus || !meta[previousStatus]) return meta;
  const next = { ...meta };
  next[nextStatus] = next[previousStatus];
  delete next[previousStatus];
  return next;
}

function hexToRgb(hex: string) {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

function mixChannel(foreground: number, background: number, amount: number) {
  return Math.round(foreground * amount + background * (1 - amount));
}

function toRgbString(rgb: { r: number; g: number; b: number }) {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

function getReadableTextColor(rgb: { r: number; g: number; b: number }) {
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  if (luminance > 0.58) {
    return "rgb(31, 41, 55)";
  }
  return toRgbString({
    r: mixChannel(rgb.r, 0, 0.78),
    g: mixChannel(rgb.g, 0, 0.78),
    b: mixChannel(rgb.b, 0, 0.78),
  });
}

export function buildCustomStatusBadgeStyle(
  color: string | null | undefined,
): BookingStatusBadgeStyle | null {
  const rgb = color ? hexToRgb(color) : null;
  if (!rgb) return null;

  const background = {
    r: mixChannel(rgb.r, 255, 0.16),
    g: mixChannel(rgb.g, 255, 0.16),
    b: mixChannel(rgb.b, 255, 0.16),
  };
  const border = {
    r: mixChannel(rgb.r, 255, 0.34),
    g: mixChannel(rgb.g, 255, 0.34),
    b: mixChannel(rgb.b, 255, 0.34),
  };

  return {
    className: "border",
    style: {
      backgroundColor: toRgbString(background),
      borderColor: toRgbString(border),
      color: getReadableTextColor(rgb),
    },
  };
}
