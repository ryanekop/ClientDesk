const HEX_COLOR_6 = /^#([0-9a-f]{6})$/i;
const HEX_COLOR_3 = /^#([0-9a-f]{3})$/i;

function clampAlpha(value: number) {
  if (!Number.isFinite(value)) return 1;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const prefixed = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  const shortMatch = prefixed.match(HEX_COLOR_3);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].toUpperCase().split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  const longMatch = prefixed.match(HEX_COLOR_6);
  if (longMatch) {
    return `#${longMatch[1].toUpperCase()}`;
  }

  return null;
}

export function resolveHexColor(
  value: unknown,
  fallback?: unknown,
  finalFallback = "#000000",
) {
  const normalized = normalizeHexColor(value);
  if (normalized) return normalized;

  const normalizedFallback = normalizeHexColor(fallback);
  if (normalizedFallback) return normalizedFallback;

  return normalizeHexColor(finalFallback) || "#000000";
}

export function withAlpha(color: unknown, alpha: number, fallbackColor?: unknown) {
  const resolvedColor = resolveHexColor(color, fallbackColor);
  const alphaValue = clampAlpha(alpha);
  const red = Number.parseInt(resolvedColor.slice(1, 3), 16);
  const green = Number.parseInt(resolvedColor.slice(3, 5), 16);
  const blue = Number.parseInt(resolvedColor.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alphaValue.toFixed(3)})`;
}

export function buildServiceSoftPalette(args: {
  serviceColor?: unknown;
  fallbackColor?: unknown;
  selected?: boolean;
}) {
  const color = resolveHexColor(args.serviceColor, args.fallbackColor);
  const selected = Boolean(args.selected);
  return {
    color,
    backgroundColor: withAlpha(color, selected ? 0.2 : 0.12),
    borderColor: withAlpha(color, selected ? 0.55 : 0.28),
    ringColor: withAlpha(color, 0.3),
    iconBorderColor: withAlpha(color, selected ? 0.55 : 0.4),
    summaryBackgroundColor: withAlpha(color, 0.12),
    summaryBorderColor: withAlpha(color, 0.35),
  };
}
