import type { NextRequest } from "next/server";
import { resolveApiLocale, type AppLocale } from "@/lib/i18n/api-locale";
import idMessages from "../../../messages/id.json";
import enMessages from "../../../messages/en.json";

type ApiErrorTemplateMap = Record<string, string>;

const API_ERROR_MESSAGES: Record<AppLocale, ApiErrorTemplateMap> = {
  id: idMessages.ApiErrors as ApiErrorTemplateMap,
  en: enMessages.ApiErrors as ApiErrorTemplateMap,
};

export type ApiErrorKey = keyof typeof idMessages.ApiErrors;

function formatTemplate(template: string, params?: Record<string, string | number>) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

export function apiT(
  locale: AppLocale,
  key: ApiErrorKey,
  params?: Record<string, string | number>,
) {
  const template = API_ERROR_MESSAGES[locale][key] || API_ERROR_MESSAGES.id[key];
  return formatTemplate(template, params);
}

export function apiText(
  request: NextRequest,
  key: ApiErrorKey,
  params?: Record<string, string | number>,
) {
  const locale = resolveApiLocale(request);
  return apiT(locale, key, params);
}
