import type { Metadata } from "next";
import { fillWhatsAppTemplate } from "@/lib/whatsapp-template";

export type SeoPageKey = "form" | "track" | "settlement";

export type SeoProfileFields = {
  seo_meta_title?: string | null;
  seo_meta_description?: string | null;
  seo_meta_keywords?: string | null;
  seo_form_meta_title?: string | null;
  seo_form_meta_description?: string | null;
  seo_form_meta_keywords?: string | null;
  seo_track_meta_title?: string | null;
  seo_track_meta_description?: string | null;
  seo_track_meta_keywords?: string | null;
  seo_settlement_meta_title?: string | null;
  seo_settlement_meta_description?: string | null;
  seo_settlement_meta_keywords?: string | null;
};

type BuildSeoMetadataInput = {
  page: SeoPageKey;
  profileSeo?: SeoProfileFields | null;
  variables?: Record<string, string | null | undefined>;
  fallbackTitle: string;
  fallbackDescription: string;
  fallbackKeywords?: string[];
  fallbackImageUrl?: string | null;
};

function normalizeText(value: string | null | undefined) {
  const normalized = (value || "").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeVariableValues(variables: BuildSeoMetadataInput["variables"]) {
  const normalized: Record<string, string> = {};
  if (!variables) return normalized;

  Object.entries(variables).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      normalized[key] = "";
      return;
    }
    normalized[key] = String(value);
  });

  return normalized;
}

function resolvePageValue(
  page: SeoPageKey,
  profileSeo: SeoProfileFields | null | undefined,
  type: "title" | "description" | "keywords",
) {
  if (!profileSeo) return null;

  if (page === "form") {
    if (type === "title") return normalizeText(profileSeo.seo_form_meta_title);
    if (type === "description") return normalizeText(profileSeo.seo_form_meta_description);
    return normalizeText(profileSeo.seo_form_meta_keywords);
  }

  if (page === "track") {
    if (type === "title") return normalizeText(profileSeo.seo_track_meta_title);
    if (type === "description") return normalizeText(profileSeo.seo_track_meta_description);
    return normalizeText(profileSeo.seo_track_meta_keywords);
  }

  if (type === "title") return normalizeText(profileSeo.seo_settlement_meta_title);
  if (type === "description") return normalizeText(profileSeo.seo_settlement_meta_description);
  return normalizeText(profileSeo.seo_settlement_meta_keywords);
}

function renderTemplate(
  template: string | null,
  variables: Record<string, string>,
  fallback: string,
) {
  if (!template) return fallback;
  const rendered = fillWhatsAppTemplate(template, variables).trim();
  return rendered || fallback;
}

function parseKeywords(input: string | null | undefined) {
  const raw = normalizeText(input);
  if (!raw) return [];
  return raw
    .split(",")
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0);
}

export function buildSeoMetadata(input: BuildSeoMetadataInput): Metadata {
  const variables = normalizeVariableValues(input.variables);
  const profileSeo = input.profileSeo || null;
  const globalTitle = normalizeText(profileSeo?.seo_meta_title);
  const globalDescription = normalizeText(profileSeo?.seo_meta_description);
  const globalKeywords = normalizeText(profileSeo?.seo_meta_keywords);

  const pageTitle = resolvePageValue(input.page, profileSeo, "title");
  const pageDescription = resolvePageValue(input.page, profileSeo, "description");
  const pageKeywords = resolvePageValue(input.page, profileSeo, "keywords");

  const title = renderTemplate(
    pageTitle || globalTitle,
    variables,
    input.fallbackTitle,
  );
  const description = renderTemplate(
    pageDescription || globalDescription,
    variables,
    input.fallbackDescription,
  );
  const parsedKeywords = parseKeywords(
    pageKeywords || globalKeywords || input.fallbackKeywords?.join(", "),
  );
  const imageUrl = normalizeText(input.fallbackImageUrl);
  const metadata: Metadata = {
    title,
    description,
  };

  if (parsedKeywords.length > 0) {
    metadata.keywords = parsedKeywords;
  }

  metadata.openGraph = {
    title,
    description,
    type: "website",
    ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
  };
  metadata.twitter = {
    card: imageUrl ? "summary_large_image" : "summary",
    title,
    description,
    ...(imageUrl ? { images: [imageUrl] } : {}),
  };

  return metadata;
}
