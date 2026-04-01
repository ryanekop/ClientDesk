const TEMPLATE_FALLBACK_VALUE = "-";

function isInstagramHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  return normalized === "instagram.com" || normalized === "www.instagram.com";
}

function normalizeInstagramHandle(value: string) {
  const withoutAt = value.replace(/^@+/, "");
  if (!withoutAt || /\s/.test(withoutAt)) return "";
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(withoutAt)) return "";
  return withoutAt;
}

function resolveInstagramLink(value: string) {
  const compact = value.replace(/\s+/g, "");
  if (!compact) return TEMPLATE_FALLBACK_VALUE;

  const isInstagramUrl = /^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i.test(
    compact,
  );
  if (isInstagramUrl) {
    const withScheme = /^https?:\/\//i.test(compact)
      ? compact
      : `https://${compact}`;
    try {
      const parsed = new URL(withScheme);
      if (!isInstagramHostname(parsed.hostname)) {
        return TEMPLATE_FALLBACK_VALUE;
      }
      return parsed.toString();
    } catch {
      return TEMPLATE_FALLBACK_VALUE;
    }
  }

  const handle = normalizeInstagramHandle(value.trim());
  if (!handle) return TEMPLATE_FALLBACK_VALUE;
  return `https://instagram.com/${handle}`;
}

export function buildInstagramTemplateVars(value: string | null | undefined) {
  const instagram = typeof value === "string" ? value.trim() : "";
  if (!instagram) {
    return {
      instagram: TEMPLATE_FALLBACK_VALUE,
      instagram_link: TEMPLATE_FALLBACK_VALUE,
    };
  }
  const instagramLink = resolveInstagramLink(instagram);
  if (instagramLink === TEMPLATE_FALLBACK_VALUE) {
    return {
      instagram: TEMPLATE_FALLBACK_VALUE,
      instagram_link: TEMPLATE_FALLBACK_VALUE,
    };
  }

  return {
    instagram,
    instagram_link: instagramLink,
  };
}
