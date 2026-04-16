"use client";

import * as React from "react";
import {
  Save,
  Loader2,
  RotateCcw,
  MessageSquare,
  Building2,
  Phone,
  Globe,
  Link2,
  Unlink,
  CheckCircle,
  XCircle,
  AlertCircle,
  ImagePlus,
  Trash2,
  Upload,
  Plus,
  Search,
  Bot,
  ClipboardPaste,
} from "lucide-react";
import { adminNativeSelectClass } from "@/components/ui/admin-native-form-controls";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ActionFeedbackDialog } from "@/components/ui/action-feedback-dialog";
import { useSuccessToast } from "@/components/ui/success-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { ImageCropModal } from "@/components/ui/image-crop-modal";
import {
  DEFAULT_CALENDAR_EVENT_DESCRIPTION,
  DEFAULT_CALENDAR_EVENT_FORMAT,
  DEFAULT_DRIVE_FOLDER_FORMAT,
  buildCalendarDescriptionMapKey,
  getDriveTemplateVariables,
  getDefaultCalendarEventDescriptionByMode,
  normalizeCalendarEventDescriptionMap,
  normalizeGoogleCalendarTemplateMode,
  normalizeTemplateFormatMap,
  resolveCalendarDescriptionTemplateByMode,
  resolveTemplateByEventType,
  applyCalendarTemplate,
  applyDriveTemplate,
  getCalendarTemplateVariables,
  type GoogleCalendarTemplateMode,
} from "@/utils/google/template";
import {
  clearConnectedGoogleAccountCache,
  fetchConnectedGoogleAccountStatus,
  type ConnectedGoogleAccountResponse,
} from "@/utils/google/connected-account-client";
import {
  fillWhatsAppTemplate,
  getStoredTemplateName,
  getStoredTemplateType,
  resolveTemplateMode,
  resolveTemplateType,
  type WhatsAppTemplateMode,
} from "@/lib/whatsapp-template";
import { BOOKING_WHATSAPP_TIME_VARIABLES } from "@/lib/booking-whatsapp-template-vars";
import { isSplitCapableBookingEventType } from "@/lib/booking-template-mode";
import {
  getEventExtraFieldPreviewVars,
  getEventExtraFieldTemplateTokens,
} from "@/utils/form-extra-fields";
import {
  getCustomFieldPreviewVars,
  getCustomFieldTemplateTokens,
  normalizeStoredFormLayout,
  type FormLayoutItem,
} from "@/components/form-builder/booking-form-layout";
import { normalizeDriveFolderStructureSettings } from "@/lib/drive-folder-structure";
import {
  COMPLETED_BOOKING_STATUS,
  DEFAULT_DP_VERIFY_TRIGGER_STATUS,
  DEFAULT_CLIENT_STATUSES,
  INITIAL_BOOKING_STATUS,
  getDefaultFinalInvoiceVisibleFromStatus,
  getDefaultTrackingFileLinksVisibleFromStatus,
  getDefaultTrackingVideoLinksVisibleFromStatus,
  normalizeClientProgressStatuses,
  resolveDpVerifyTriggerStatus,
  resolveFinalInvoiceVisibleFromStatus,
  resolveOptionalClientProgressStatus,
  resolveTrackingFileLinksVisibleFromStatus,
  resolveTrackingVideoLinksVisibleFromStatus,
} from "@/lib/client-status";
import {
  getActiveEventTypes,
  getBuiltInEventTypes,
  getEventTypeSettings,
  mergeCustomEventTypes,
  normalizeEventTypeName,
  PUBLIC_CUSTOM_EVENT_TYPE,
} from "@/lib/event-type-config";
import {
  SortableConfigList,
  type SortableConfigItem,
} from "@/components/ui/sortable-config-list";
import {
  normalizeFastpikLinkDisplayMode,
  type FastpikLinkDisplayMode,
} from "@/lib/fastpik-link-display";
import {
  normalizeOperationalCostTemplates,
  type OperationalCostTemplate,
} from "@/lib/operational-costs";
import {
  getOnboardingActiveStep,
  isOnboardingGoogleStep,
  ONBOARDING_ACTIVE_STEP_EVENT,
} from "@/lib/onboarding";
import { useTenant } from "@/lib/tenant-context";
import {
  isMainClientDeskDomain,
  normalizeVendorSlug,
} from "@/lib/booking-url-mode";
import { optimizePngBlobForUpload } from "@/utils/optimize-png-blob";

const COUNTRY_CODES = [
  { code: "+62", flag: "🇮🇩", name: "Indonesia" },
  { code: "+60", flag: "🇲🇾", name: "Malaysia" },
  { code: "+65", flag: "🇸🇬", name: "Singapore" },
  { code: "+66", flag: "🇹🇭", name: "Thailand" },
  { code: "+63", flag: "🇵🇭", name: "Philippines" },
  { code: "+84", flag: "🇻🇳", name: "Vietnam" },
];

type Profile = {
  id: string;
  full_name: string;
  role?: string | null;
  tenant_id?: string | null;
  studio_name: string | null;
  studio_address?: string | null;
  whatsapp_number: string | null;
  vendor_slug: string | null;
  telegram_notifications_enabled?: boolean | null;
  telegram_chat_id?: string | null;
  telegram_language?: string | null;
  telegram_notify_new_booking?: boolean | null;
  telegram_notify_settlement_submitted?: boolean | null;
  telegram_notify_session_h1?: boolean | null;
  google_access_token?: string | null;
  google_refresh_token?: string | null;
  google_drive_access_token?: string | null;
  google_drive_refresh_token?: string | null;
  queue_trigger_status?: string | null;
  dp_verify_trigger_status?: string | null;
  session_time_trigger_from_status?: string | null;
  session_time_trigger_to_status?: string | null;
  final_invoice_visible_from_status?: string | null;
  tracking_file_links_visible_from_status?: string | null;
  tracking_video_links_visible_from_status?: string | null;
  tracking_hide_queue_number?: boolean | null;
  default_wa_target?: "client" | "freelancer" | null;
  booking_table_color_enabled?: boolean | null;
  finance_table_color_enabled?: boolean | null;
  form_event_types?: string[] | null;
  custom_event_types?: string[] | null;
  drive_folder_structure_map?: Record<string, string[]> | null;
  form_sections?: Record<string, FormLayoutItem[]> | FormLayoutItem[] | null;
  calendar_event_description?: string | null;
  calendar_event_description_map?: Record<string, string> | null;
  fastpik_integration_enabled?: boolean | null;
  fastpik_sync_mode?: "manual" | "auto" | null;
  fastpik_preset_source?: "clientdesk" | "fastpik" | null;
  fastpik_api_key?: string | null;
  fastpik_last_sync_at?: string | null;
  fastpik_last_sync_status?:
    | "idle"
    | "success"
    | "warning"
    | "failed"
    | "syncing"
    | null;
  fastpik_last_sync_message?: string | null;
  fastpik_default_max_photos?: number | null;
  fastpik_default_selection_days?: number | null;
  fastpik_default_download_days?: number | null;
  fastpik_default_detect_subfolders?: boolean | null;
  fastpik_default_password?: string | null;
  fastpik_link_display_mode?: FastpikLinkDisplayMode | null;
  fastpik_link_display_mode_booking_detail?: FastpikLinkDisplayMode | null;
  fastpik_link_display_mode_tracking?: FastpikLinkDisplayMode | null;
  form_greeting?: string | null;
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
  operational_cost_templates?: OperationalCostTemplate[] | null;
};

type Template = {
  id: string;
  type: string;
  name: string;
  content: string;
  content_en: string;
  is_default: boolean;
  event_type: string | null;
};

type GoogleConnectionService = "calendar" | "drive";

const GOOGLE_CONNECT_POLL_INTERVAL_MS = 2_000;
const GOOGLE_CONNECT_POLL_TIMEOUT_MS = 90_000;

const templateTypes = [
  { value: "whatsapp_client" },
  { value: "whatsapp_freelancer" },
  { value: "whatsapp_booking_confirm" },
  { value: "whatsapp_session_reminder_client" },
  { value: "invoice" },
  { value: "whatsapp_settlement_client" },
  { value: "whatsapp_settlement_confirm" },
];

function createOperationalCostTemplateId(prefix: "template" | "item") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `cost_${prefix}_${crypto.randomUUID()}`;
  }

  return `cost_${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}

function formatOperationalCostAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "";
  return new Intl.NumberFormat("id-ID").format(Math.floor(value));
}

function parseOperationalCostAmount(value: string) {
  const digitsOnly = value.replace(/\D+/g, "");
  if (!digitsOnly) return 0;
  const parsed = Number(digitsOnly);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function createEmptyOperationalCostTemplate(index: number): OperationalCostTemplate {
  const now = new Date().toISOString();
  return {
    id: createOperationalCostTemplateId("template"),
    name: `Template ${index + 1}`,
    items: [],
    created_at: now,
    updated_at: now,
  };
}

const EVENT_SCOPED_WHATSAPP_TEMPLATE_TYPES = new Set([
  "whatsapp_client",
  "whatsapp_freelancer",
  "whatsapp_booking_confirm",
  "whatsapp_session_reminder_client",
  "whatsapp_settlement_client",
  "whatsapp_settlement_confirm",
]);
const TEMPLATE_MODES: WhatsAppTemplateMode[] = ["normal", "split"];
const CALENDAR_DESCRIPTION_MODES: GoogleCalendarTemplateMode[] = [
  "normal",
  "split",
];

function isEventScopedWhatsAppTemplateType(type: string) {
  return EVENT_SCOPED_WHATSAPP_TEMPLATE_TYPES.has(type);
}

function isSplitCapableTemplateEvent(eventType: string | null | undefined) {
  return isSplitCapableBookingEventType(normalizeTemplateEventTypeValue(eventType));
}

function getSupportedTemplateModesForEvent(
  eventType: string | null | undefined,
): WhatsAppTemplateMode[] {
  return isSplitCapableTemplateEvent(eventType) ? TEMPLATE_MODES : ["normal"];
}

function buildTemplateContentKey(
  type: string,
  eventType: string | null | undefined,
  mode: WhatsAppTemplateMode = "normal",
) {
  if (!isEventScopedWhatsAppTemplateType(type)) return type;
  const normalizedEventType = normalizeTemplateEventTypeValue(eventType) || "Umum";
  const normalizedMode = getSupportedTemplateModesForEvent(normalizedEventType).includes(mode)
    ? mode
    : "normal";
  return `${type}__${normalizedEventType}__${normalizedMode}`;
}

const templateTitleKeyByType: Record<string, string> = {
  whatsapp_client: "templateWAClient",
  whatsapp_freelancer: "templateWAFreelancer",
  whatsapp_booking_confirm: "templateBookingConfirm",
  whatsapp_session_reminder_client: "templateSessionReminderClient",
  invoice: "templateInvoice",
  whatsapp_settlement_client: "templateSettlementClient",
  whatsapp_settlement_confirm: "templateSettlementConfirm",
};

const templateDescKeyByType: Record<string, string> = {
  whatsapp_client: "templateWAClientDesc",
  whatsapp_freelancer: "templateWAFreelancerDesc",
  whatsapp_booking_confirm: "templateBookingConfirmDesc",
  whatsapp_session_reminder_client: "templateSessionReminderClientDesc",
  invoice: "templateInvoiceDesc",
  whatsapp_settlement_client: "templateSettlementClientDesc",
  whatsapp_settlement_confirm: "templateSettlementConfirmDesc",
};

const templateCardToneByType: Record<string, string> = {
  whatsapp_client:
    "border-amber-300/90 bg-amber-50/20 ring-1 ring-amber-200/70 dark:border-amber-500/50 dark:bg-amber-500/8 dark:ring-amber-500/30",
  whatsapp_freelancer:
    "border-amber-300/90 bg-amber-50/20 ring-1 ring-amber-200/70 dark:border-amber-500/50 dark:bg-amber-500/8 dark:ring-amber-500/30",
  whatsapp_booking_confirm:
    "border-sky-300/90 bg-sky-50/20 ring-1 ring-sky-200/70 dark:border-sky-500/50 dark:bg-sky-500/8 dark:ring-sky-500/30",
  whatsapp_session_reminder_client:
    "border-teal-300/90 bg-teal-50/20 ring-1 ring-teal-200/70 dark:border-teal-500/50 dark:bg-teal-500/8 dark:ring-teal-500/30",
  invoice:
    "border-violet-300/90 bg-violet-50/20 ring-1 ring-violet-200/70 dark:border-violet-500/50 dark:bg-violet-500/8 dark:ring-violet-500/30",
  whatsapp_settlement_client:
    "border-emerald-300/90 bg-emerald-50/20 ring-1 ring-emerald-200/70 dark:border-emerald-500/50 dark:bg-emerald-500/8 dark:ring-emerald-500/30",
  whatsapp_settlement_confirm:
    "border-emerald-300/90 bg-emerald-50/20 ring-1 ring-emerald-200/70 dark:border-emerald-500/50 dark:bg-emerald-500/8 dark:ring-emerald-500/30",
};

const templateHeaderToneByType: Record<string, string> = {
  whatsapp_client: "border-amber-200/80 dark:border-amber-500/30",
  whatsapp_freelancer: "border-amber-200/80 dark:border-amber-500/30",
  whatsapp_booking_confirm: "border-sky-200/80 dark:border-sky-500/30",
  whatsapp_session_reminder_client: "border-teal-200/80 dark:border-teal-500/30",
  invoice: "border-violet-200/80 dark:border-violet-500/30",
  whatsapp_settlement_client: "border-emerald-200/80 dark:border-emerald-500/30",
  whatsapp_settlement_confirm: "border-emerald-200/80 dark:border-emerald-500/30",
};

const DEFAULT_QUEUE_TRIGGER_STATUS = "Antrian Edit";
const DEFAULT_FINAL_INVOICE_VISIBLE_FROM_STATUS = "Sesi Foto / Acara";
const DEFAULT_TRACKING_FILE_LINKS_VISIBLE_FROM_STATUS = "Sesi Foto / Acara";
const DEFAULT_TRACKING_VIDEO_LINKS_VISIBLE_FROM_STATUS = "File Siap";
const WEDDING_SPLIT_WHATSAPP_HINTS = [
  "{{akad_location}}",
  "{{akad_date}}",
  "{{akad_time}}",
  "{{resepsi_location}}",
  "{{resepsi_date}}",
  "{{resepsi_time}}",
  "{{resepsi_maps_url}}",
] as const;
const WISUDA_SPLIT_WHATSAPP_HINTS = [
  "{{wisuda_session_1_location}}",
  "{{wisuda_session_1_date}}",
  "{{wisuda_session_1_time}}",
  "{{wisuda_session_1_end_time}}",
  "{{wisuda_session_1_time_range}}",
  "{{wisuda_session_1_maps_url}}",
  "{{wisuda_session_2_location}}",
  "{{wisuda_session_2_date}}",
  "{{wisuda_session_2_time}}",
  "{{wisuda_session_2_end_time}}",
  "{{wisuda_session_2_time_range}}",
  "{{wisuda_session_2_maps_url}}",
] as const;

const variableHints: Record<string, string[]> = {
  whatsapp_client: [
    "{{client_name}}",
    "{{instagram}}",
    "{{instagram_link}}",
    "{{booking_code}}",
    "{{session_date}}",
    ...BOOKING_WHATSAPP_TIME_VARIABLES,
    "{{service_name}}",
    "{{total_price}}",
    "{{dp_paid}}",
    "{{studio_name}}",
    "{{event_type}}",
    "{{location}}",
    "{{location_maps_url}}",
    "{{detail_location}}",
    "{{notes}}",
    "{{tracking_link}}",
    "{{invoice_url}}",
  ],
  whatsapp_booking_confirm: [
    "{{client_name}}",
    "{{instagram}}",
    "{{instagram_link}}",
    "{{booking_code}}",
    "{{session_date}}",
    ...BOOKING_WHATSAPP_TIME_VARIABLES,
    "{{service_name}}",
    "{{total_price}}",
    "{{dp_paid}}",
    "{{studio_name}}",
    "{{event_type}}",
    "{{location}}",
    "{{tracking_link}}",
  ],
  whatsapp_session_reminder_client: [
    "{{client_name}}",
    "{{client_whatsapp}}",
    "{{booking_code}}",
    "{{session_label}}",
    "{{reminder_label}}",
    "{{session_date}}",
    ...BOOKING_WHATSAPP_TIME_VARIABLES,
    "{{service_name}}",
    "{{studio_name}}",
    "{{event_type}}",
    "{{location}}",
    "{{location_maps_url}}",
    "{{detail_location}}",
    "{{notes}}",
    "{{tracking_link}}",
  ],
  whatsapp_settlement_client: [
    "{{client_name}}",
    "{{instagram}}",
    "{{instagram_link}}",
    "{{booking_code}}",
    "{{session_date}}",
    "{{service_name}}",
    "{{total_price}}",
    "{{dp_paid}}",
    "{{final_total}}",
    "{{adjustments_total}}",
    "{{remaining_payment}}",
    "{{studio_name}}",
    "{{event_type}}",
    "{{location}}",
    "{{tracking_link}}",
    "{{invoice_url}}",
    "{{settlement_link}}",
  ],
  whatsapp_settlement_confirm: [
    "{{client_name}}",
    "{{instagram}}",
    "{{instagram_link}}",
    "{{booking_code}}",
    "{{service_name}}",
    "{{session_date}}",
    "{{payment_method}}",
    "{{final_total}}",
    "{{remaining_payment}}",
    "{{studio_name}}",
    "{{invoice_url}}",
    "{{settlement_link}}",
  ],
  whatsapp_freelancer: [
    "{{freelancer_name}}",
    "{{client_name}}",
    "{{instagram}}",
    "{{instagram_link}}",
    "{{client_whatsapp}}",
    "{{booking_code}}",
    "{{session_date}}",
    ...BOOKING_WHATSAPP_TIME_VARIABLES,
    "{{service_name}}",
    "{{studio_name}}",
    "{{event_type}}",
    "{{location}}",
    "{{location_maps_url}}",
    "{{drive_link}}",
    "{{detail_location}}",
    "{{notes}}",
  ],
  invoice: [
    "{{client_name}}",
    "{{booking_code}}",
    "{{service_name}}",
    "{{total_price}}",
    "{{dp_paid}}",
    "{{session_date}}",
    "{{invoice_url}}",
  ],
};

type SeoSectionKey = "global" | "form" | "track" | "settlement";
type SeoFieldKey = "metaTitle" | "metaDescription" | "metaKeywords";

type SeoSectionState = {
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
};

type SeoSettingsState = Record<SeoSectionKey, SeoSectionState>;
type SeoFieldInputElement = HTMLInputElement | HTMLTextAreaElement;
type SeoFieldRefsState = Record<
  SeoSectionKey,
  Record<SeoFieldKey, SeoFieldInputElement | null>
>;
type SeoValueSource = "section" | "global" | "dynamicDefault";
type ResolvedSeoField = {
  value: string;
  source: SeoValueSource;
};
type ResolvedSeoSectionState = Record<SeoFieldKey, ResolvedSeoField>;

const DEFAULT_SEO_SECTION_STATE: SeoSectionState = {
  metaTitle: "",
  metaDescription: "",
  metaKeywords: "",
};

function createDefaultSeoSettings(): SeoSettingsState {
  return {
    global: { ...DEFAULT_SEO_SECTION_STATE },
    form: { ...DEFAULT_SEO_SECTION_STATE },
    track: { ...DEFAULT_SEO_SECTION_STATE },
    settlement: { ...DEFAULT_SEO_SECTION_STATE },
  };
}

const DEFAULT_ACTIVE_SEO_FIELD_BY_SECTION: Record<SeoSectionKey, SeoFieldKey> = {
  global: "metaTitle",
  form: "metaTitle",
  track: "metaTitle",
  settlement: "metaTitle",
};

const SEO_VARIABLE_HINTS = [
  "{{studio_name}}",
  "{{vendor_slug}}",
  "{{client_name}}",
  "{{booking_code}}",
  "{{status}}",
  "{{event_type}}",
  "{{session_date}}",
  "{{tracking_uuid}}",
  "{{settlement_uuid}}",
] as const;

const SEO_DEFAULT_BY_SECTION: Record<SeoSectionKey, SeoSectionState> = {
  global: {
    metaTitle: "{{studio_name}}",
    metaDescription: "Booking sesi foto bersama {{studio_name}}.",
    metaKeywords: "",
  },
  form: {
    metaTitle: "Form Booking — {{studio_name}}",
    metaDescription: "Booking sesi foto bersama {{studio_name}}.",
    metaKeywords: "",
  },
  track: {
    metaTitle: "{{status}} — {{client_name}} — {{booking_code}}",
    metaDescription:
      "Tracking booking {{booking_code}} untuk {{client_name}} di {{studio_name}}",
    metaKeywords: "",
  },
  settlement: {
    metaTitle: "Pelunasan - {{booking_code}}",
    metaDescription: "Form pelunasan untuk booking {{booking_code}}",
    metaKeywords: "",
  },
};

function getSplitWhatsAppVariableHints(
  eventType: string | null | undefined,
  mode: WhatsAppTemplateMode,
): string[] {
  if (mode !== "split") return [];

  const normalizedEventType = normalizeTemplateEventTypeValue(eventType);
  if (normalizedEventType === "Wedding") {
    return [...WEDDING_SPLIT_WHATSAPP_HINTS];
  }
  if (normalizedEventType === "Wisuda") {
    return [...WISUDA_SPLIT_WHATSAPP_HINTS];
  }
  return [];
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractMissingColumnFromSupabaseError(
  error: { message?: string; details?: string; hint?: string } | null,
) {
  const messages = [error?.message, error?.details, error?.hint].filter(
    (value): value is string => Boolean(value),
  );

  for (const message of messages) {
    // PostgREST schema cache format:
    // "Could not find the 'calendar_event_description' column ..."
    const schemaCacheMatch = message.match(
      /Could not find the '([^']+)' column/i,
    );
    if (schemaCacheMatch?.[1]) {
      return schemaCacheMatch[1];
    }

    // Postgres format:
    // "column profiles.calendar_event_description does not exist"
    // or    "column \"calendar_event_description\" does not exist"
    const postgresMatch = message.match(
      /column\s+["']?(?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)["']?\s+does not exist/i,
    );
    if (postgresMatch?.[1]) {
      return postgresMatch[1];
    }
  }

  return null;
}

const PROFILE_SETTINGS_SELECT_COLUMNS = [
  "id",
  "full_name",
  "role",
  "studio_name",
  "studio_address",
  "whatsapp_number",
  "vendor_slug",
  "telegram_notifications_enabled",
  "telegram_chat_id",
  "telegram_language",
  "telegram_notify_new_booking",
  "telegram_notify_settlement_submitted",
  "telegram_notify_session_h1",
  "google_access_token",
  "google_refresh_token",
  "google_drive_access_token",
  "google_drive_refresh_token",
  "calendar_event_format",
  "calendar_event_format_map",
  "calendar_event_description",
  "calendar_event_description_map",
  "drive_folder_format",
  "drive_folder_format_map",
  "drive_folder_structure_map",
  "invoice_logo_url",
  "custom_statuses",
  "custom_client_statuses",
  "queue_trigger_status",
  "dp_verify_trigger_status",
  "session_time_trigger_from_status",
  "session_time_trigger_to_status",
  "default_wa_target",
  "booking_table_color_enabled",
  "finance_table_color_enabled",
  "final_invoice_visible_from_status",
  "tracking_file_links_visible_from_status",
  "tracking_video_links_visible_from_status",
  "tracking_hide_queue_number",
  "form_event_types",
  "custom_event_types",
  "form_sections",
  "fastpik_integration_enabled",
  "fastpik_sync_mode",
  "fastpik_preset_source",
  "fastpik_api_key",
  "fastpik_last_sync_at",
  "fastpik_last_sync_status",
  "fastpik_last_sync_message",
  "fastpik_default_max_photos",
  "fastpik_default_selection_days",
  "fastpik_default_download_days",
  "fastpik_default_detect_subfolders",
  "fastpik_default_password",
  "fastpik_link_display_mode",
  "fastpik_link_display_mode_booking_detail",
  "fastpik_link_display_mode_tracking",
  "form_greeting",
  "seo_meta_title",
  "seo_meta_description",
  "seo_meta_keywords",
  "seo_form_meta_title",
  "seo_form_meta_description",
  "seo_form_meta_keywords",
  "seo_track_meta_title",
  "seo_track_meta_description",
  "seo_track_meta_keywords",
  "seo_settlement_meta_title",
  "seo_settlement_meta_description",
  "seo_settlement_meta_keywords",
  "operational_cost_templates",
] as const;

// Google Calendar SVG Logo (official 2020)
function GoogleCalendarLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(3.75 3.75)">
        <path
          fill="#FFFFFF"
          d="M148.882,43.618l-47.368-5.263l-57.895,5.263L38.355,96.25l5.263,52.632l52.632,6.579l52.632-6.579l5.263-53.947L148.882,43.618z"
        />
        <path
          fill="#1A73E8"
          d="M65.211,125.276c-3.934-2.658-6.658-6.539-8.145-11.671l9.132-3.763c0.829,3.158,2.276,5.605,4.342,7.342c2.053,1.737,4.553,2.592,7.474,2.592c2.987,0,5.553-0.908,7.697-2.724s3.224-4.132,3.224-6.934c0-2.868-1.132-5.211-3.395-7.026s-5.105-2.724-8.5-2.724h-5.276v-9.039H76.5c2.921,0,5.382-0.789,7.382-2.368c2-1.579,3-3.737,3-6.487c0-2.447-0.895-4.395-2.684-5.855s-4.053-2.197-6.803-2.197c-2.684,0-4.816,0.711-6.395,2.145s-2.724,3.197-3.447,5.276l-9.039-3.763c1.197-3.395,3.395-6.395,6.618-8.987c3.224-2.592,7.342-3.895,12.342-3.895c3.697,0,7.026,0.711,9.974,2.145c2.947,1.434,5.263,3.421,6.934,5.947c1.671,2.539,2.5,5.382,2.5,8.539c0,3.224-0.776,5.947-2.329,8.184c-1.553,2.237-3.461,3.947-5.724,5.145v0.539c2.987,1.25,5.421,3.158,7.342,5.724c1.908,2.566,2.868,5.632,2.868,9.211s-0.908,6.776-2.724,9.579c-1.816,2.803-4.329,5.013-7.513,6.618c-3.197,1.605-6.789,2.421-10.776,2.421C73.408,129.263,69.145,127.934,65.211,125.276z"
        />
        <path
          fill="#1A73E8"
          d="M121.25,79.961l-9.974,7.25l-5.013-7.605l17.987-12.974h6.895v61.197h-9.895L121.25,79.961z"
        />
        <path
          fill="#EA4335"
          d="M148.882,196.25l47.368-47.368l-23.684-10.526l-23.684,10.526l-10.526,23.684L148.882,196.25z"
        />
        <path
          fill="#34A853"
          d="M33.092,172.566l10.526,23.684h105.263v-47.368H43.618L33.092,172.566z"
        />
        <path
          fill="#4285F4"
          d="M12.039-3.75C3.316-3.75-3.75,3.316-3.75,12.039v136.842l23.684,10.526l23.684-10.526V43.618h105.263l10.526-23.684L148.882-3.75H12.039z"
        />
        <path
          fill="#188038"
          d="M-3.75,148.882v31.579c0,8.724,7.066,15.789,15.789,15.789h31.579v-47.368H-3.75z"
        />
        <path
          fill="#FBBC04"
          d="M148.882,43.618v105.263h47.368V43.618l-23.684-10.526L148.882,43.618z"
        />
        <path
          fill="#1967D2"
          d="M196.25,43.618V12.039c0-8.724-7.066-15.789-15.789-15.789h-31.579v47.368H196.25z"
        />
      </g>
    </svg>
  );
}

// Google Drive SVG Logo (official 2020)
function GoogleDriveLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 87.3 78"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
        fill="#0066da"
      />
      <path
        d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z"
        fill="#00ac47"
      />
      <path
        d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"
        fill="#ea4335"
      />
      <path
        d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"
        fill="#00832d"
      />
      <path
        d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
        fill="#2684fc"
      />
      <path
        d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
        fill="#ffba00"
      />
    </svg>
  );
}

function normalizeTemplateEventTypeValue(
  eventType: string | null | undefined,
): string | null {
  const normalized = normalizeEventTypeName(eventType);
  if (normalized) return normalized;
  if (typeof eventType !== "string") return null;
  const trimmed = eventType.trim();
  return trimmed || null;
}

function parseTemplateContentKey(key: string) {
  for (const type of EVENT_SCOPED_WHATSAPP_TEMPLATE_TYPES) {
    const prefix = `${type}__`;
    if (key.startsWith(prefix)) {
      const [eventTypePart, modePart] = key.slice(prefix.length).split("__");
      const eventType = eventTypePart || "Umum";
      const mode = modePart === "split" ? "split" : "normal";
      return { type, eventType, mode: mode as WhatsAppTemplateMode };
    }
  }
  return { type: key, eventType: undefined, mode: "normal" as WhatsAppTemplateMode };
}

function resolveGoogleOAuthErrorMessage(args: {
  locale: string;
  service: GoogleConnectionService;
  errorCode?: string | null;
}) {
  const serviceName = args.service === "calendar" ? "Google Calendar" : "Google Drive";
  const code = typeof args.errorCode === "string" ? args.errorCode : "";
  const isEnglish = args.locale === "en";

  switch (code) {
    case "insufficient_scope":
      return isEnglish
        ? `${serviceName} permissions are incomplete. Please approve all required access and try again.`
        : `Izin ${serviceName} belum lengkap. Mohon izinkan semua akses yang diminta lalu coba lagi.`;
    case "not_authenticated":
      return isEnglish
        ? `Your session could not be verified while connecting ${serviceName}. Please sign in again and retry.`
        : `Sesi login tidak terverifikasi saat menghubungkan ${serviceName}. Silakan login ulang lalu coba lagi.`;
    case "invalid_state":
      return isEnglish
        ? `${serviceName} connection request has expired or is invalid. Please start the connection again from Settings.`
        : `Permintaan koneksi ${serviceName} sudah kedaluwarsa atau tidak valid. Silakan mulai ulang koneksi dari Settings.`;
    case "token_exchange_failed":
      return isEnglish
        ? `Failed to complete ${serviceName} authorization. Please try again.`
        : `Gagal menyelesaikan otorisasi ${serviceName}. Silakan coba lagi.`;
    case "db_error":
      return isEnglish
        ? `${serviceName} connected but failed to save the account state. Please try again.`
        : `${serviceName} berhasil diautentikasi tetapi gagal menyimpan status koneksi. Silakan coba lagi.`;
    case "access_denied":
      return isEnglish
        ? `You cancelled ${serviceName} authorization.`
        : `Kamu membatalkan izin ${serviceName}.`;
    case "no_code":
      return isEnglish
        ? `Authorization callback for ${serviceName} is incomplete. Please retry the connection.`
        : `Callback otorisasi ${serviceName} tidak lengkap. Silakan ulangi koneksi.`;
    default:
      return isEnglish
        ? `Failed to connect ${serviceName}. Please try again.`
        : `Gagal menghubungkan ${serviceName}. Silakan coba lagi.`;
  }
}

export default function SettingsPage() {
  const supabase = createClient();
  const t = useTranslations("Settings");
  const tp = useTranslations("SettingsPage");
  const currentYear = String(new Date().getFullYear());
  const locale = useLocale();
  const tenant = useTenant();
  const builtInEventTypes = React.useMemo(() => getBuiltInEventTypes(), []);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [savedMsg, setSavedMsg] = React.useState("");
  const [customEventTypes, setCustomEventTypes] = React.useState<string[]>([]);
  const [activeEventTypes, setActiveEventTypes] = React.useState<string[]>([]);
  const [newCustomEventType, setNewCustomEventType] = React.useState("");
  const [eventTypeSaving, setEventTypeSaving] = React.useState(false);
  const [eventTypeSaved, setEventTypeSaved] = React.useState(false);
  const [formSectionsByEventType, setFormSectionsByEventType] = React.useState<
    Record<string, FormLayoutItem[]>
  >({});

  // Controlled fields for profile
  const [studioName, setStudioName] = React.useState("");
  const [studioAddress, setStudioAddress] = React.useState("");
  const [countryCode, setCountryCode] = React.useState("+62");
  const [waNumber, setWaNumber] = React.useState("");
  const [vendorSlug, setVendorSlug] = React.useState("");
  const [telegramNotificationsEnabled, setTelegramNotificationsEnabled] =
    React.useState(false);
  const [telegramChatId, setTelegramChatId] = React.useState("");
  const [telegramLanguage, setTelegramLanguage] = React.useState<"id" | "en">("id");
  const [telegramNotifyNewBooking, setTelegramNotifyNewBooking] =
    React.useState(true);
  const [
    telegramNotifySettlementSubmitted,
    setTelegramNotifySettlementSubmitted,
  ] = React.useState(true);
  const [telegramNotifySessionH1, setTelegramNotifySessionH1] =
    React.useState(true);
  const [telegramTesting, setTelegramTesting] = React.useState(false);
  const [telegramActionMessage, setTelegramActionMessage] = React.useState("");
  const [disableBookingSlug, setDisableBookingSlug] = React.useState(false);
  const [defaultBookingVendorSlug, setDefaultBookingVendorSlug] =
    React.useState("");
  const [bookingModeSaving, setBookingModeSaving] = React.useState(false);

  // Template form
  const [activeTab, setActiveTab] = React.useState("umum");
  const [templateContents, setTemplateContents] = React.useState<
    Record<string, string>
  >({});
  const [templateContentsEn, setTemplateContentsEn] = React.useState<
    Record<string, string>
  >({});
  const [templateSaving, setTemplateSaving] = React.useState(false);
  const [templateSavedMsg, setTemplateSavedMsg] = React.useState("");
  const templateBaselineRef = React.useRef<{
    contents: Record<string, string>;
    contentsEn: Record<string, string>;
  }>({ contents: {}, contentsEn: {} });

  // Event type selector for freelancer template
  const [selectedEventType, setSelectedEventType] = React.useState("Umum");
  const [selectedTemplateMode, setSelectedTemplateMode] =
    React.useState<WhatsAppTemplateMode>("normal");

  // Language tab per template
  const [templateLang, setTemplateLang] = React.useState<
    Record<string, "id" | "en">
  >({});

  // Google integration
  const [isCalendarConnected, setIsCalendarConnected] = React.useState(false);
  const [isDriveConnected, setIsDriveConnected] = React.useState(false);
  const [calendarConnectedEmail, setCalendarConnectedEmail] = React.useState<
    string | null
  >(null);
  const [driveConnectedEmail, setDriveConnectedEmail] = React.useState<
    string | null
  >(null);
  const [loadingConnectedAccountInfo, setLoadingConnectedAccountInfo] =
    React.useState(false);
  const googleConnectPollIntervalRef = React.useRef<number | null>(null);
  const googleConnectPollTimeoutRef = React.useRef<number | null>(null);
  const [fastpikIntegrationEnabled, setFastpikIntegrationEnabled] =
    React.useState(false);
  const [fastpikSyncMode, setFastpikSyncMode] = React.useState<
    "manual" | "auto"
  >("manual");
  const [fastpikPresetSource, setFastpikPresetSource] = React.useState<
    "clientdesk" | "fastpik"
  >("clientdesk");
  const [fastpikApiKey, setFastpikApiKey] = React.useState("");
  const [fastpikLastSyncAt, setFastpikLastSyncAt] = React.useState<
    string | null
  >(null);
  const [fastpikLastSyncStatus, setFastpikLastSyncStatus] = React.useState<
    "idle" | "success" | "warning" | "failed" | "syncing"
  >("idle");
  const [fastpikLastSyncMessage, setFastpikLastSyncMessage] =
    React.useState("");
  const [fastpikDefaultMaxPhotos, setFastpikDefaultMaxPhotos] =
    React.useState(50);
  const [fastpikDefaultSelectionDays, setFastpikDefaultSelectionDays] =
    React.useState(14);
  const [fastpikDefaultDownloadDays, setFastpikDefaultDownloadDays] =
    React.useState(14);
  const [fastpikDefaultDetectSubfolders, setFastpikDefaultDetectSubfolders] =
    React.useState(false);
  const [fastpikDefaultPassword, setFastpikDefaultPassword] = React.useState(
    "",
  );
  const [fastpikLinkDisplayModeBookingDetail, setFastpikLinkDisplayModeBookingDetail] =
    React.useState<FastpikLinkDisplayMode>("prefer_fastpik");
  const [fastpikLinkDisplayModeTracking, setFastpikLinkDisplayModeTracking] =
    React.useState<FastpikLinkDisplayMode>("prefer_fastpik");
  const [fastpikTesting, setFastpikTesting] = React.useState(false);
  const [fastpikBatchSyncing, setFastpikBatchSyncing] = React.useState(false);
  const [fastpikActionMessage, setFastpikActionMessage] = React.useState("");

  // Disconnect modal
  const [disconnectModal, setDisconnectModal] = React.useState<{
    open: boolean;
    service: "calendar" | "drive" | null;
  }>({ open: false, service: null });
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [feedbackDialog, setFeedbackDialog] = React.useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: "", message: "" });
  const { showSuccessToast, successToastNode } = useSuccessToast();

  React.useEffect(() => {
    const syncSettingsTabFromOnboarding = () => {
      const activeStep = getOnboardingActiveStep();
      if (activeStep === "studioSettings") {
        setActiveTab("umum");
        return;
      }

      if (isOnboardingGoogleStep(activeStep)) {
        setActiveTab("google");
      }
    };

    syncSettingsTabFromOnboarding();
    window.addEventListener("storage", syncSettingsTabFromOnboarding);
    window.addEventListener(
      ONBOARDING_ACTIVE_STEP_EVENT,
      syncSettingsTabFromOnboarding,
    );

    return () => {
      window.removeEventListener("storage", syncSettingsTabFromOnboarding);
      window.removeEventListener(
        ONBOARDING_ACTIVE_STEP_EVENT,
        syncSettingsTabFromOnboarding,
      );
    };
  }, []);

  // Logo studio
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [logoCropSrc, setLogoCropSrc] = React.useState<string | null>(null);
  const [showLogoCrop, setShowLogoCrop] = React.useState(false);
  const [logoUploading, setLogoUploading] = React.useState(false);
  const [logoOrientation, setLogoOrientation] = React.useState<
    "horizontal" | "square"
  >("horizontal");
  const [logoLightboxOpen, setLogoLightboxOpen] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const [seoSettings, setSeoSettings] = React.useState<SeoSettingsState>(
    createDefaultSeoSettings,
  );
  const [formBookingGreeting, setFormBookingGreeting] = React.useState("");
  const [activeSeoFieldBySection, setActiveSeoFieldBySection] = React.useState<
    Record<SeoSectionKey, SeoFieldKey>
  >(DEFAULT_ACTIVE_SEO_FIELD_BY_SECTION);
  const seoFieldRefs = React.useRef<SeoFieldRefsState>({
    global: { metaTitle: null, metaDescription: null, metaKeywords: null },
    form: { metaTitle: null, metaDescription: null, metaKeywords: null },
    track: { metaTitle: null, metaDescription: null, metaKeywords: null },
    settlement: { metaTitle: null, metaDescription: null, metaKeywords: null },
  });

  const [statusSaving, setStatusSaving] = React.useState(false);
  const [statusSaved, setStatusSaved] = React.useState(false);

  // Custom client statuses (progress)
  const [customClientStatuses, setCustomClientStatuses] = React.useState<
    string[]
  >(normalizeClientProgressStatuses(DEFAULT_CLIENT_STATUSES));
  const [newClientStatusName, setNewClientStatusName] = React.useState("");
  const [queueTriggerStatus, setQueueTriggerStatus] =
    React.useState(DEFAULT_QUEUE_TRIGGER_STATUS);
  const [dpVerifyTriggerStatus, setDpVerifyTriggerStatus] = React.useState(
    DEFAULT_DP_VERIFY_TRIGGER_STATUS,
  );
  const [sessionTimeTriggerFromStatus, setSessionTimeTriggerFromStatus] =
    React.useState("");
  const [sessionTimeTriggerToStatus, setSessionTimeTriggerToStatus] =
    React.useState("");
  const [finalInvoiceVisibleFromStatus, setFinalInvoiceVisibleFromStatus] =
    React.useState(DEFAULT_FINAL_INVOICE_VISIBLE_FROM_STATUS);
  const [
    trackingFileLinksVisibleFromStatus,
    setTrackingFileLinksVisibleFromStatus,
  ] = React.useState(DEFAULT_TRACKING_FILE_LINKS_VISIBLE_FROM_STATUS);
  const [
    trackingVideoLinksVisibleFromStatus,
    setTrackingVideoLinksVisibleFromStatus,
  ] = React.useState(DEFAULT_TRACKING_VIDEO_LINKS_VISIBLE_FROM_STATUS);
  const [trackingHideQueueNumber, setTrackingHideQueueNumber] =
    React.useState(false);

  // Default WA target
  const [defaultWaTarget, setDefaultWaTarget] = React.useState<
    "client" | "freelancer"
  >("client");
  const [bookingTableColorEnabled, setBookingTableColorEnabled] =
    React.useState(false);
  const [financeTableColorEnabled, setFinanceTableColorEnabled] =
    React.useState(false);
  const [operationalCostTemplates, setOperationalCostTemplates] =
    React.useState<OperationalCostTemplate[]>([]);

  // Calendar event format
  const [calendarEventFormats, setCalendarEventFormats] = React.useState<
    Record<string, string>
  >(() => normalizeTemplateFormatMap(null, DEFAULT_CALENDAR_EVENT_FORMAT));
  const [calendarEventDescriptions, setCalendarEventDescriptions] =
    React.useState<Record<string, string>>(() =>
      normalizeCalendarEventDescriptionMap(
        null,
        DEFAULT_CALENDAR_EVENT_DESCRIPTION,
      ),
    );
  const [selectedCalendarEventType, setSelectedCalendarEventType] =
    React.useState("Umum");
  const [selectedCalendarDescriptionMode, setSelectedCalendarDescriptionMode] =
    React.useState<GoogleCalendarTemplateMode>("normal");

  // Drive folder format
  const [driveFolderFormats, setDriveFolderFormats] = React.useState<
    Record<string, string>
  >(() => normalizeTemplateFormatMap(null, DEFAULT_DRIVE_FOLDER_FORMAT));
  const [driveFolderStructures, setDriveFolderStructures] = React.useState<
    Record<string, string[]>
  >(() => normalizeDriveFolderStructureSettings(null));
  const [selectedDriveEventType, setSelectedDriveEventType] =
    React.useState("Umum");
  const [newDriveSegment, setNewDriveSegment] = React.useState("");
  const [resetModal, setResetModal] = React.useState<{
    open: boolean;
    scope: "umum" | "google" | "template" | "status" | "jenis-acara" | null;
  }>({ open: false, scope: null });
  const [resetSaving, setResetSaving] = React.useState(false);
  const unsupportedProfileColumnsRef = React.useRef<Set<string>>(new Set());
  const feedbackTitle = tp("feedbackTitle");
  const settingsSavedMessage = tp("settingsSavedMessage");
  const defaultSettingsSavedToastMessage = tp("settingsSavedToast");
  const showFeedback = React.useCallback(
    (message: string, title?: string) => {
      setFeedbackDialog({
        open: true,
        title: title || feedbackTitle,
        message,
      });
    },
    [feedbackTitle],
  );
  const showSettingsSavedToast = React.useCallback(
    (message?: string) => {
      showSuccessToast(message || defaultSettingsSavedToastMessage);
    },
    [defaultSettingsSavedToastMessage, showSuccessToast],
  );
  const stopGoogleConnectPolling = React.useCallback(() => {
    if (googleConnectPollIntervalRef.current !== null) {
      window.clearInterval(googleConnectPollIntervalRef.current);
      googleConnectPollIntervalRef.current = null;
    }
    if (googleConnectPollTimeoutRef.current !== null) {
      window.clearTimeout(googleConnectPollTimeoutRef.current);
      googleConnectPollTimeoutRef.current = null;
    }
    setLoadingConnectedAccountInfo(false);
  }, []);
  const applyConnectedAccountInfo = React.useEffectEvent(
    (payload: ConnectedGoogleAccountResponse | null) => {
      if (!payload) return;
      if (typeof payload.calendar?.connected === "boolean") {
        setIsCalendarConnected(payload.calendar.connected);
      }
      if (typeof payload.drive?.connected === "boolean") {
        setIsDriveConnected(payload.drive.connected);
      }
      setCalendarConnectedEmail(payload.calendar?.email || null);
      setDriveConnectedEmail(payload.drive?.email || null);
    },
  );
  const fetchConnectedAccountInfo = React.useEffectEvent(
    async (args?: { withLoading?: boolean; force?: boolean }) => {
      const withLoading = args?.withLoading ?? true;
      const force = args?.force ?? false;
      if (withLoading) setLoadingConnectedAccountInfo(true);
      try {
        return await fetchConnectedGoogleAccountStatus({ force });
      } catch {
        return null;
      } finally {
        if (withLoading) setLoadingConnectedAccountInfo(false);
      }
    },
  );
  const startGoogleConnectPolling = React.useEffectEvent(
    (service: GoogleConnectionService) => {
      stopGoogleConnectPolling();
      setLoadingConnectedAccountInfo(true);

      const runCheck = async () => {
        const payload = await fetchConnectedAccountInfo({
          withLoading: false,
          force: true,
        });
        if (!payload) return;
        applyConnectedAccountInfo(payload);
        const connected =
          service === "calendar"
            ? Boolean(payload.calendar?.connected)
            : Boolean(payload.drive?.connected);
        if (connected) {
          stopGoogleConnectPolling();
        }
      };

      void runCheck();
      googleConnectPollIntervalRef.current = window.setInterval(() => {
        void runCheck();
      }, GOOGLE_CONNECT_POLL_INTERVAL_MS);
      googleConnectPollTimeoutRef.current = window.setTimeout(() => {
        stopGoogleConnectPolling();
      }, GOOGLE_CONNECT_POLL_TIMEOUT_MS);
    },
  );
  const openGoogleConnectPopup = React.useEffectEvent(
    (service: GoogleConnectionService) => {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.delete("google_oauth");
      currentUrl.searchParams.delete("error");
      const returnPath = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
      const endpoint =
        service === "calendar" ? "/api/google/auth" : "/api/google/drive/auth";
      const authUrl = `${endpoint}?returnPath=${encodeURIComponent(returnPath)}`;
      const popupName = service === "calendar" ? "google-auth" : "google-drive-auth";
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(
        authUrl,
        popupName,
        `width=${width},height=${height},left=${left},top=${top},popup=yes`,
      );
      startGoogleConnectPolling(service);
      if (!popup) {
        window.location.assign(authUrl);
      }
    },
  );
  const calendarFormatInputRef = React.useRef<HTMLInputElement>(null);
  const calendarDescriptionInputRef = React.useRef<HTMLTextAreaElement>(null);
  const driveFormatInputRef = React.useRef<HTMLInputElement>(null);
  const eventTypeSettings = React.useMemo(
    () =>
      getEventTypeSettings({
        customEventTypes,
        activeEventTypes,
      }),
    [activeEventTypes, customEventTypes],
  );
  const availableEventTypes = React.useMemo(
    () => eventTypeSettings.map((item) => item.name),
    [eventTypeSettings],
  );
  const tenantDomain = (tenant.domain || "").trim().toLowerCase();
  const isMainTenantDomain = isMainClientDeskDomain(tenantDomain);
  const isCustomTenantDomain = Boolean(tenantDomain) && !isMainTenantDomain;
  const profileRole = (profile?.role || "").trim().toLowerCase();
  const isTenantAdmin = profileRole === "admin";
  const canEditTenantBookingMode = isCustomTenantDomain && isTenantAdmin;
  const slugInputReadOnly = isCustomTenantDomain && disableBookingSlug;
  React.useEffect(() => {
    if (activeTab === "keuangan" && !isTenantAdmin) {
      setActiveTab("umum");
    }
  }, [activeTab, isTenantAdmin]);
  const eventTypeItems = React.useMemo<SortableConfigItem[]>(
    () =>
      eventTypeSettings.map((item) => {
        return {
          id: item.name,
          label: item.name,
          active: item.active,
          editable: !item.builtIn,
          removable: !item.builtIn,
          badge: item.builtIn ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              Bawaan
            </span>
          ) : (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
              Custom
            </span>
          ),
        } satisfies SortableConfigItem;
      }),
    [eventTypeSettings],
  );
  const clientStatusItems = React.useMemo<SortableConfigItem[]>(
    () =>
      customClientStatuses.map((status) => {
        const isRequiredStatus =
          status === INITIAL_BOOKING_STATUS ||
          status === COMPLETED_BOOKING_STATUS;
        return {
          id: status,
          label: status,
          locked: isRequiredStatus,
          editable: !isRequiredStatus,
          removable: !isRequiredStatus,
          badge: isRequiredStatus ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Wajib
            </span>
          ) : null,
        };
      }),
    [customClientStatuses],
  );

  function reorderEventTypes(items: SortableConfigItem[]) {
    const orderedNames = items.map((item) => item.id);
    setCustomEventTypes((prev) =>
      orderedNames.filter((name) => prev.includes(name)),
    );
    setActiveEventTypes((prev) =>
      orderedNames.filter((name) => prev.includes(name)),
    );
  }

  function renameEventType(oldName: string, nextName: string) {
    if (oldName === PUBLIC_CUSTOM_EVENT_TYPE) return;
    const normalizedNextName = normalizeEventTypeName(nextName);
    if (
      !normalizedNextName ||
      oldName === normalizedNextName ||
      availableEventTypes.includes(normalizedNextName)
    )
      return;
    setCustomEventTypes((prev) =>
      prev.map((item) => (item === oldName ? normalizedNextName : item)),
    );
    setActiveEventTypes((prev) =>
      prev.map((item) => (item === oldName ? normalizedNextName : item)),
    );
    setCalendarEventFormats((prev) => {
      if (!(oldName in prev)) return prev;
      const next = { ...prev, [normalizedNextName]: prev[oldName] };
      delete next[oldName];
      return next;
    });
    setCalendarEventDescriptions((prev) => {
      if (!(oldName in prev)) return prev;
      const next = { ...prev, [normalizedNextName]: prev[oldName] };
      delete next[oldName];
      return next;
    });
    setDriveFolderFormats((prev) => {
      if (!(oldName in prev)) return prev;
      const next = { ...prev, [normalizedNextName]: prev[oldName] };
      delete next[oldName];
      return next;
    });
    setDriveFolderStructures((prev) => {
      if (!(oldName in prev)) return prev;
      const next = { ...prev, [normalizedNextName]: prev[oldName] };
      delete next[oldName];
      return next;
    });
    setFormSectionsByEventType((prev) => {
      if (!(oldName in prev)) return prev;
      const next = { ...prev, [normalizedNextName]: prev[oldName] };
      delete next[oldName];
      return next;
    });
  }

  function toggleEventTypeActive(name: string) {
    setActiveEventTypes((prev) =>
      prev.includes(name)
        ? prev.filter((item) => item !== name)
        : [
            ...eventTypeSettings
            .map((item) => item.name)
            .filter((item) => item === name || prev.includes(item)),
          ],
    );
  }

  function removeEventType(name: string) {
    if (name === PUBLIC_CUSTOM_EVENT_TYPE) return;
    setCustomEventTypes((prev) => prev.filter((item) => item !== name));
    setActiveEventTypes((prev) =>
      prev.filter((item) => item !== name),
    );
    setCalendarEventFormats((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setCalendarEventDescriptions((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setDriveFolderFormats((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setDriveFolderStructures((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setFormSectionsByEventType((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  function setNormalizedClientStatuses(
    nextStatuses: string[] | ((prev: string[]) => string[]),
  ) {
    setCustomClientStatuses((prev) => {
      const resolved =
        typeof nextStatuses === "function"
          ? nextStatuses(prev)
          : nextStatuses;
      return normalizeClientProgressStatuses(resolved);
    });
  }

  // Listen for Google auth popup callbacks
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const messageType = event.data?.type;
      if (messageType === "GOOGLE_AUTH_SUCCESS") {
        clearConnectedGoogleAccountCache();
        startGoogleConnectPolling("calendar");
        return;
      }
      if (messageType === "GOOGLE_DRIVE_SUCCESS") {
        clearConnectedGoogleAccountCache();
        startGoogleConnectPolling("drive");
        return;
      }
      if (
        messageType === "GOOGLE_AUTH_ERROR" ||
        messageType === "GOOGLE_DRIVE_ERROR"
      ) {
        stopGoogleConnectPolling();
        const service: GoogleConnectionService =
          messageType === "GOOGLE_AUTH_ERROR" ? "calendar" : "drive";
        const errorCode =
          typeof event.data?.error === "string" ? event.data.error : null;
        showFeedback(
          resolveGoogleOAuthErrorMessage({ locale, service, errorCode }),
        );
      }
    };

    // BroadcastChannel: lebih reliable dari window.opener.postMessage
    // karena window.opener bisa menjadi null saat popup melakukan cross-origin redirect ke Google
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("clientdesk-google-auth");
      channel.onmessage = handleMessage;
    } catch {
      /* BroadcastChannel tidak tersedia di browser ini */
    }

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      channel?.close();
      stopGoogleConnectPolling();
    };
  }, [locale, showFeedback, stopGoogleConnectPolling]);

  React.useEffect(() => {
    if (!availableEventTypes.includes(selectedEventType)) {
      setSelectedEventType("Umum");
    }
    if (!getSupportedTemplateModesForEvent(selectedEventType).includes(selectedTemplateMode)) {
      setSelectedTemplateMode("normal");
    }
    if (!availableEventTypes.includes(selectedCalendarEventType)) {
      setSelectedCalendarEventType("Umum");
    }
    const supportedCalendarModes = isSplitCapableTemplateEvent(
      selectedCalendarEventType,
    )
      ? CALENDAR_DESCRIPTION_MODES
      : (["normal"] as GoogleCalendarTemplateMode[]);
    if (!supportedCalendarModes.includes(selectedCalendarDescriptionMode)) {
      setSelectedCalendarDescriptionMode("normal");
    }
    if (!availableEventTypes.includes(selectedDriveEventType)) {
      setSelectedDriveEventType("Umum");
    }
  }, [
    availableEventTypes,
    selectedCalendarEventType,
    selectedCalendarDescriptionMode,
    selectedDriveEventType,
    selectedEventType,
    selectedTemplateMode,
  ]);

  React.useEffect(() => {
    setDisableBookingSlug(
      isMainClientDeskDomain(tenant.domain)
        ? false
        : Boolean(tenant.disableBookingSlug),
    );
    setDefaultBookingVendorSlug(tenant.defaultBookingVendorSlug || "");
  }, [tenant.defaultBookingVendorSlug, tenant.disableBookingSlug, tenant.domain]);

  const loadSettingsProfile = React.useEffectEvent(async (userId: string) => {
    const { data: roleData, error: roleError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (roleError) {
      console.warn("Failed to load profile role:", roleError.message);
      return null;
    }

    const role = (roleData?.role || "").trim().toLowerCase();
    let selectColumns = [
      ...(role === "admin"
        ? PROFILE_SETTINGS_SELECT_COLUMNS
        : PROFILE_SETTINGS_SELECT_COLUMNS.filter(
            (column) => column !== "operational_cost_templates",
          )),
    ];
    let data: Record<string, unknown> | null = null;
    let lastErrorMessage = "";

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const result = await supabase
        .from("profiles")
        .select(selectColumns.join(", "))
        .eq("id", userId)
        .single();

      if (!result.error) {
        data = (result.data ?? null) as Record<string, unknown> | null;
        break;
      }

      lastErrorMessage = result.error.message;
      const missingColumn = extractMissingColumnFromSupabaseError(result.error);
      if (missingColumn && selectColumns.includes(missingColumn as any)) {
        unsupportedProfileColumnsRef.current.add(missingColumn);
        selectColumns = selectColumns.filter((column) => column !== missingColumn);
        continue;
      }

      break;
    }

    if (!data) {
      console.warn("Failed to load profile settings:", lastErrorMessage);
      return null;
    }

    if (data && typeof data === "object") {
      selectColumns.forEach((column) => {
        if (!Object.prototype.hasOwnProperty.call(data, column)) {
          unsupportedProfileColumnsRef.current.add(column);
        }
      });
    }

    return data;
  });

  const ensureProfileRecord = React.useEffectEvent(async () => {
    const response = await fetch("/api/profile/ensure", { method: "POST" });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || tp("failedPrepareProfile"));
    }
  });

  const invalidateProfilePublicCache = React.useEffectEvent(async () => {
    try {
      await fetch("/api/internal/cache/invalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "profile" }),
      });
    } catch {
      // Best effort cache invalidation.
    }
  });

  const fetchAll = React.useEffectEvent(async (silent?: boolean) => {
    // Jika silent=true, skip loading spinner — untuk background refresh setelah save
    if (!silent) setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const [p, templatesResponse] = await Promise.all([
      loadSettingsProfile(user.id),
      supabase
        .from("templates")
        .select("id, type, name, content, content_en, is_default, event_type")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
    const profileData =
      p ??
      (await (async () => {
        try {
          await ensureProfileRecord();
          return await loadSettingsProfile(user.id);
        } catch (error) {
          console.error("Ensure profile failed:", error);
          return null;
        }
      })());
    const prof = (profileData ?? {
      id: user.id,
      full_name: String(
        user.user_metadata?.full_name || user.email?.split("@")[0] || "",
      ),
      studio_name: null,
      whatsapp_number: null,
      vendor_slug: null,
    }) as Profile;
    setProfile(prof);
    const loadedCustomEventTypes = mergeCustomEventTypes(
      (prof as any)?.custom_event_types,
      (prof as any)?.form_event_types,
    );
    const loadedActiveEventTypes = getActiveEventTypes({
      customEventTypes: loadedCustomEventTypes,
      activeEventTypes: (prof as any)?.form_event_types,
    });
    setCustomEventTypes(loadedCustomEventTypes);
    setActiveEventTypes(loadedActiveEventTypes);
    setStudioName(prof?.studio_name || "");
    setStudioAddress((prof as any)?.studio_address || "");
    setLogoUrl((prof as any)?.invoice_logo_url || null);
    setFormBookingGreeting((prof as any)?.form_greeting || "");
    setSeoSettings({
      global: {
        metaTitle: (prof as any)?.seo_meta_title || "",
        metaDescription: (prof as any)?.seo_meta_description || "",
        metaKeywords: (prof as any)?.seo_meta_keywords || "",
      },
      form: {
        metaTitle: (prof as any)?.seo_form_meta_title || "",
        metaDescription: (prof as any)?.seo_form_meta_description || "",
        metaKeywords: (prof as any)?.seo_form_meta_keywords || "",
      },
      track: {
        metaTitle: (prof as any)?.seo_track_meta_title || "",
        metaDescription: (prof as any)?.seo_track_meta_description || "",
        metaKeywords: (prof as any)?.seo_track_meta_keywords || "",
      },
      settlement: {
        metaTitle: (prof as any)?.seo_settlement_meta_title || "",
        metaDescription: (prof as any)?.seo_settlement_meta_description || "",
        metaKeywords: (prof as any)?.seo_settlement_meta_keywords || "",
      },
    });
    setCalendarEventFormats(
      normalizeTemplateFormatMap(
        (prof as any)?.calendar_event_format_map,
        (prof as any)?.calendar_event_format || DEFAULT_CALENDAR_EVENT_FORMAT,
      ),
    );
    setCalendarEventDescriptions(
      normalizeCalendarEventDescriptionMap(
        (prof as any)?.calendar_event_description_map,
        (prof as any)?.calendar_event_description ||
          DEFAULT_CALENDAR_EVENT_DESCRIPTION,
      ),
    );
    setDriveFolderFormats(
      normalizeTemplateFormatMap(
        (prof as any)?.drive_folder_format_map,
        (prof as any)?.drive_folder_format || DEFAULT_DRIVE_FOLDER_FORMAT,
      ),
    );
    setDriveFolderStructures(
      normalizeDriveFolderStructureSettings(
        (prof as any)?.drive_folder_structure_map,
        (prof as any)?.drive_folder_format || DEFAULT_DRIVE_FOLDER_FORMAT,
        (prof as any)?.drive_folder_format_map || null,
      ),
    );
    const rawSections = (prof as any)?.form_sections;
    if (Array.isArray(rawSections)) {
      setFormSectionsByEventType({
        Umum: normalizeStoredFormLayout(rawSections, "Umum"),
      });
    } else if (rawSections && typeof rawSections === "object") {
      setFormSectionsByEventType(
        Object.entries(rawSections as Record<string, unknown>).reduce(
          (acc, [key, value]) => {
            const normalizedKey = normalizeEventTypeName(key) || key;
            if (!(normalizedKey in acc) || key === normalizedKey) {
              acc[normalizedKey] = normalizeStoredFormLayout(
                value,
                normalizedKey,
              );
            }
            return acc;
          },
          {} as Record<string, FormLayoutItem[]>,
        ),
      );
    } else {
      setFormSectionsByEventType({});
    }
    const loadedClientStatuses = normalizeClientProgressStatuses(
      ((prof as any)?.custom_client_statuses as string[] | undefined) ||
        customClientStatuses,
    );
    setCustomClientStatuses(loadedClientStatuses);
    if (Object.prototype.hasOwnProperty.call(prof, "queue_trigger_status")) {
      const rawQueueTriggerStatus = (prof as any)?.queue_trigger_status;
      setQueueTriggerStatus(
        typeof rawQueueTriggerStatus === "string"
          ? rawQueueTriggerStatus
          : DEFAULT_QUEUE_TRIGGER_STATUS,
      );
    }
    setDpVerifyTriggerStatus(
      resolveDpVerifyTriggerStatus(
        loadedClientStatuses,
        (prof as any)?.dp_verify_trigger_status,
      ),
    );
    setSessionTimeTriggerFromStatus(
      resolveOptionalClientProgressStatus(
        loadedClientStatuses,
        (prof as any)?.session_time_trigger_from_status,
      ),
    );
    setSessionTimeTriggerToStatus(
      resolveOptionalClientProgressStatus(
        loadedClientStatuses,
        (prof as any)?.session_time_trigger_to_status,
      ),
    );
    setFinalInvoiceVisibleFromStatus(
      resolveFinalInvoiceVisibleFromStatus(
        loadedClientStatuses,
        (prof as any)?.final_invoice_visible_from_status,
      ),
    );
    setTrackingFileLinksVisibleFromStatus(
      resolveTrackingFileLinksVisibleFromStatus(
        loadedClientStatuses,
        (prof as any)?.tracking_file_links_visible_from_status,
      ),
    );
    setTrackingVideoLinksVisibleFromStatus(
      resolveTrackingVideoLinksVisibleFromStatus(
        loadedClientStatuses,
        prof.tracking_video_links_visible_from_status,
      ),
    );
    if (
      Object.prototype.hasOwnProperty.call(prof, "tracking_hide_queue_number")
    ) {
      setTrackingHideQueueNumber(
        Boolean((prof as any)?.tracking_hide_queue_number),
      );
    } else {
      setTrackingHideQueueNumber(false);
    }
    if ((prof as any)?.default_wa_target) {
      setDefaultWaTarget((prof as any).default_wa_target);
    }
    setBookingTableColorEnabled(
      Boolean((prof as any)?.booking_table_color_enabled),
    );
    setFinanceTableColorEnabled(
      Boolean((prof as any)?.finance_table_color_enabled),
    );
    setOperationalCostTemplates(
      normalizeOperationalCostTemplates((prof as any)?.operational_cost_templates),
    );
    const savedWa = prof?.whatsapp_number || "";
    const matchedCode = COUNTRY_CODES.find((c) => savedWa.startsWith(c.code));
    if (matchedCode) {
      setCountryCode(matchedCode.code);
      setWaNumber(savedWa.slice(matchedCode.code.length));
    } else {
      setWaNumber(savedWa.replace(/^0/, ""));
    }
    setVendorSlug(prof?.vendor_slug || "");
    setTelegramNotificationsEnabled(
      Boolean(prof?.telegram_notifications_enabled),
    );
    setTelegramChatId(prof?.telegram_chat_id || "");
    setTelegramLanguage(prof?.telegram_language === "en" ? "en" : "id");
    setTelegramNotifyNewBooking(
      prof?.telegram_notify_new_booking === false ? false : true,
    );
    setTelegramNotifySettlementSubmitted(
      prof?.telegram_notify_settlement_submitted === false
        ? false
        : true,
    );
    setTelegramNotifySessionH1(
      prof?.telegram_notify_session_h1 === false ? false : true,
    );
    setFastpikIntegrationEnabled(
      Boolean((prof as any)?.fastpik_integration_enabled),
    );
    setFastpikSyncMode(
      (prof as any)?.fastpik_sync_mode === "auto" ? "auto" : "manual",
    );
    setFastpikPresetSource(
      (prof as any)?.fastpik_preset_source === "fastpik"
        ? "fastpik"
        : "clientdesk",
    );
    setFastpikApiKey((prof as any)?.fastpik_api_key || "");
    setFastpikLastSyncAt((prof as any)?.fastpik_last_sync_at || null);
    setFastpikLastSyncStatus(
      ((prof as any)?.fastpik_last_sync_status || "idle") as
        | "idle"
        | "success"
        | "warning"
        | "failed"
        | "syncing",
    );
    setFastpikLastSyncMessage((prof as any)?.fastpik_last_sync_message || "");
    setFastpikDefaultMaxPhotos(
      Number((prof as any)?.fastpik_default_max_photos) > 0
        ? Number((prof as any)?.fastpik_default_max_photos)
        : 50,
    );
    setFastpikDefaultSelectionDays(
      Number((prof as any)?.fastpik_default_selection_days) > 0
        ? Number((prof as any)?.fastpik_default_selection_days)
        : 14,
    );
    setFastpikDefaultDownloadDays(
      Number((prof as any)?.fastpik_default_download_days) > 0
        ? Number((prof as any)?.fastpik_default_download_days)
        : 14,
    );
    setFastpikDefaultDetectSubfolders(
      Boolean((prof as any)?.fastpik_default_detect_subfolders),
    );
    setFastpikDefaultPassword((prof as any)?.fastpik_default_password || "");
    const legacyFastpikLinkDisplayMode = normalizeFastpikLinkDisplayMode(
      (prof as any)?.fastpik_link_display_mode,
    );
    setFastpikLinkDisplayModeBookingDetail(
      normalizeFastpikLinkDisplayMode(
        (prof as any)?.fastpik_link_display_mode_booking_detail ??
          legacyFastpikLinkDisplayMode,
      ),
    );
    setFastpikLinkDisplayModeTracking(
      normalizeFastpikLinkDisplayMode(
        (prof as any)?.fastpik_link_display_mode_tracking ??
          legacyFastpikLinkDisplayMode,
      ),
    );

    const allTemplates = (templatesResponse.data || []) as Template[];
    setTemplates(allTemplates);

    // Initialize template contents from existing templates
    const contents: Record<string, string> = {};
    const contentsEn: Record<string, string> = {};
    const templateEventTypes = getEventTypeSettings({
      customEventTypes: loadedCustomEventTypes,
      activeEventTypes: loadedActiveEventTypes,
    }).map((item) => item.name);
    templateTypes.forEach((tt) => {
      if (isEventScopedWhatsAppTemplateType(tt.value)) {
        templateEventTypes.forEach((et) => {
          getSupportedTemplateModesForEvent(et).forEach((mode) => {
            const key = buildTemplateContentKey(tt.value, et, mode);
            const existing = allTemplates.find(
              (tmpl: Template) =>
                resolveTemplateType(tmpl) === tt.value &&
                resolveTemplateMode(tmpl) === mode &&
                (normalizeTemplateEventTypeValue(tmpl.event_type) || "Umum") === et,
            );
            contents[key] = existing?.content || "";
            contentsEn[key] = existing?.content_en || "";
          });
        });
      } else {
        const existing = allTemplates.find(
          (tmpl: Template) => resolveTemplateType(tmpl) === tt.value,
        );
        contents[tt.value] = existing?.content || "";
        contentsEn[tt.value] = existing?.content_en || "";
      }
    });
    setTemplateContents(contents);
    setTemplateContentsEn(contentsEn);
    templateBaselineRef.current = {
      contents: { ...contents },
      contentsEn: { ...contentsEn },
    };

    const connectedPayload = await fetchConnectedAccountInfo({
      withLoading: false,
      force: false,
    });
    if (connectedPayload) {
      applyConnectedAccountInfo(connectedPayload);
    } else {
      setIsCalendarConnected(false);
      setIsDriveConnected(false);
      setCalendarConnectedEmail(null);
      setDriveConnectedEmail(null);
    }

    setLoading(false);
  });

  React.useEffect(() => {
    void fetchAll();
  }, []);

  React.useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const oauthStatus = currentUrl.searchParams.get("google_oauth");
    if (!oauthStatus) return;

    const errorCode = currentUrl.searchParams.get("error");
    if (oauthStatus === "calendar_success") {
      clearConnectedGoogleAccountCache();
      startGoogleConnectPolling("calendar");
      void fetchAll(true);
    } else if (oauthStatus === "drive_success") {
      clearConnectedGoogleAccountCache();
      startGoogleConnectPolling("drive");
      void fetchAll(true);
    } else if (oauthStatus === "calendar_error" || oauthStatus === "drive_error") {
      stopGoogleConnectPolling();
      const service: GoogleConnectionService = oauthStatus.startsWith("calendar")
        ? "calendar"
        : "drive";
      showFeedback(
        resolveGoogleOAuthErrorMessage({ locale, service, errorCode }),
      );
    }

    currentUrl.searchParams.delete("google_oauth");
    currentUrl.searchParams.delete("error");
    window.history.replaceState(
      window.history.state,
      "",
      `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
    );
  }, [locale, showFeedback, stopGoogleConnectPolling]);

  React.useEffect(() => {
    if (activeTab !== "google") return;

    let cancelled = false;
    void (async () => {
      const payload = await fetchConnectedAccountInfo({
        withLoading: true,
        force: true,
      });
      if (cancelled) return;
      if (payload) {
        applyConnectedAccountInfo(payload);
      } else {
        setCalendarConnectedEmail(null);
        setDriveConnectedEmail(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const saveProfilePatch = React.useEffectEvent(
    async (patch: Record<string, unknown>) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error(tp("userNotFound"));
      }

      await ensureProfileRecord();
      const nextPatch = { ...patch };
      for (const droppedColumn of unsupportedProfileColumnsRef.current) {
        delete nextPatch[droppedColumn];
      }

      for (let attempt = 0; attempt < 12; attempt += 1) {
        const { error } = await supabase
          .from("profiles")
          .update(nextPatch)
          .eq("id", user.id);

        if (!error) {
          await invalidateProfilePublicCache();
          return;
        }

        const missingColumn = extractMissingColumnFromSupabaseError(error);
        if (
          missingColumn &&
          Object.prototype.hasOwnProperty.call(nextPatch, missingColumn)
        ) {
          unsupportedProfileColumnsRef.current.add(missingColumn);
          delete nextPatch[missingColumn];
          continue;
        }

        throw error;
      }

      throw new Error(tp("failedSaveProfile"));
    },
  );

  async function updateTenantBookingMode(
    nextDisableBookingSlug: boolean,
    previousDisableBookingSlug: boolean,
  ) {
    if (!isCustomTenantDomain) return;

    const fallbackVendorSlug = normalizeVendorSlug(
      defaultBookingVendorSlug || vendorSlug || studioName,
    );

    setBookingModeSaving(true);
    try {
      const response = await fetch("/api/settings/booking-url-mode", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disableBookingSlug: nextDisableBookingSlug,
          defaultBookingVendorSlug: nextDisableBookingSlug
            ? fallbackVendorSlug
            : null,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            tenant?: {
              disable_booking_slug?: boolean;
              default_booking_vendor_slug?: string | null;
            };
          }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || tp("failedUpdateBookingUrlMode"));
      }

      setDisableBookingSlug(payload?.tenant?.disable_booking_slug === true);
      setDefaultBookingVendorSlug(
        payload?.tenant?.default_booking_vendor_slug || "",
      );
      setSavedMsg(settingsSavedMessage);
      showSettingsSavedToast();
      setTimeout(() => setSavedMsg(""), 3000);
    } catch (error) {
      console.error("Tenant booking mode update error:", error);
      setDisableBookingSlug(previousDisableBookingSlug);
      setSavedMsg(tp("failedSaveBookingUrlMode"));
      setTimeout(() => setSavedMsg(""), 3000);
    } finally {
      setBookingModeSaving(false);
    }
  }

  async function handleSaveGeneralSettings() {
    if (!profile) return;
    setSaving(true);

    const slug = slugify(vendorSlug || studioName);

    try {
      await saveProfilePatch({
        studio_name: studioName || null,
        studio_address: studioAddress.trim() ? studioAddress.trim() : null,
        whatsapp_number: waNumber ? `${countryCode}${waNumber}` : null,
        vendor_slug: slug || null,
      });

      setVendorSlug(slug);
      setSavedMsg(settingsSavedMessage);
      showSettingsSavedToast();
      setTimeout(() => setSavedMsg(""), 3000);
      void fetchAll(true);
    } catch (error) {
      console.error("Settings save error:", error);
      setSavedMsg(tp("failedSave"));
      setTimeout(() => setSavedMsg(""), 3000);
    } finally {
      setSaving(false);
    }
  }

  function buildTelegramProfilePatch() {
    return {
      telegram_notifications_enabled: telegramNotificationsEnabled,
      telegram_chat_id: telegramChatId.trim() || null,
      telegram_language: telegramLanguage,
      telegram_notify_new_booking: telegramNotifyNewBooking,
      telegram_notify_settlement_submitted: telegramNotifySettlementSubmitted,
      telegram_notify_session_h1: telegramNotifySessionH1,
    };
  }

  async function persistTelegramSettings(options?: { showSavedMessage?: boolean }) {
    if (!profile) {
      throw new Error(tp("profileNotFound"));
    }

    await saveProfilePatch(buildTelegramProfilePatch());
    if (options?.showSavedMessage) {
      setSavedMsg(settingsSavedMessage);
      showSettingsSavedToast();
      setTimeout(() => setSavedMsg(""), 3000);
    }
  }

  async function handleSaveTelegramSettings() {
    if (!profile) return;
    setSaving(true);
    try {
      await persistTelegramSettings({ showSavedMessage: true });
      void fetchAll(true);
    } catch (error) {
      console.error("Telegram settings save error:", error);
      setSavedMsg(tp("failedSave"));
      setTimeout(() => setSavedMsg(""), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSeoSettings() {
    if (!profile) return;
    setSaving(true);
    try {
      await saveProfilePatch({
        seo_meta_title: seoSettings.global.metaTitle.trim() || null,
        seo_meta_description: seoSettings.global.metaDescription.trim() || null,
        seo_meta_keywords: seoSettings.global.metaKeywords.trim() || null,
        seo_form_meta_title: seoSettings.form.metaTitle.trim() || null,
        seo_form_meta_description: seoSettings.form.metaDescription.trim() || null,
        seo_form_meta_keywords: seoSettings.form.metaKeywords.trim() || null,
        seo_track_meta_title: seoSettings.track.metaTitle.trim() || null,
        seo_track_meta_description: seoSettings.track.metaDescription.trim() || null,
        seo_track_meta_keywords: seoSettings.track.metaKeywords.trim() || null,
        seo_settlement_meta_title:
          seoSettings.settlement.metaTitle.trim() || null,
        seo_settlement_meta_description:
          seoSettings.settlement.metaDescription.trim() || null,
        seo_settlement_meta_keywords:
          seoSettings.settlement.metaKeywords.trim() || null,
      });
      setSavedMsg(settingsSavedMessage);
      showSettingsSavedToast();
      setTimeout(() => setSavedMsg(""), 3000);
      void fetchAll(true);
    } catch (error) {
      console.error("SEO settings save error:", error);
      setSavedMsg(tp("failedSave"));
      setTimeout(() => setSavedMsg(""), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveBookingListSettings() {
    if (!profile) return;
    setSaving(true);

    try {
      await saveProfilePatch({
        default_wa_target: defaultWaTarget,
        booking_table_color_enabled: bookingTableColorEnabled,
        finance_table_color_enabled: financeTableColorEnabled,
      });
      setSavedMsg(settingsSavedMessage);
      showSettingsSavedToast();
      setTimeout(() => setSavedMsg(""), 3000);
      void fetchAll(true);
    } catch (error) {
      console.error("Booking list settings save error:", error);
      setSavedMsg(tp("failedSave"));
      setTimeout(() => setSavedMsg(""), 3000);
    } finally {
      setSaving(false);
    }
  }

  function addOperationalCostTemplate() {
    setOperationalCostTemplates((prev) => [
      ...prev,
      createEmptyOperationalCostTemplate(prev.length),
    ]);
  }

  function updateOperationalCostTemplateName(templateId: string, name: string) {
    setOperationalCostTemplates((prev) =>
      prev.map((template) =>
        template.id === templateId
          ? { ...template, name, updated_at: new Date().toISOString() }
          : template,
      ),
    );
  }

  function removeOperationalCostTemplate(templateId: string) {
    setOperationalCostTemplates((prev) =>
      prev.filter((template) => template.id !== templateId),
    );
  }

  function addOperationalCostTemplateItem(templateId: string) {
    setOperationalCostTemplates((prev) =>
      prev.map((template) =>
        template.id === templateId
          ? {
              ...template,
              items: [
                ...template.items,
                {
                  id: createOperationalCostTemplateId("item"),
                  label: "",
                  amount: 0,
                },
              ],
              updated_at: new Date().toISOString(),
            }
          : template,
      ),
    );
  }

  function updateOperationalCostTemplateItem(
    templateId: string,
    itemId: string,
    field: "label" | "amount",
    value: string,
  ) {
    setOperationalCostTemplates((prev) =>
      prev.map((template) =>
        template.id === templateId
          ? {
              ...template,
              items: template.items.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      [field]:
                        field === "amount"
                          ? parseOperationalCostAmount(value)
                          : value,
                    }
                  : item,
              ),
              updated_at: new Date().toISOString(),
            }
          : template,
      ),
    );
  }

  function removeOperationalCostTemplateItem(templateId: string, itemId: string) {
    setOperationalCostTemplates((prev) =>
      prev.map((template) =>
        template.id === templateId
          ? {
              ...template,
              items: template.items.filter((item) => item.id !== itemId),
              updated_at: new Date().toISOString(),
            }
          : template,
      ),
    );
  }

  async function handleSaveOperationalCostTemplates() {
    if (!profile || !isTenantAdmin) return;
    setSaving(true);

    try {
      const normalizedTemplates =
        normalizeOperationalCostTemplates(operationalCostTemplates);
      await saveProfilePatch({
        operational_cost_templates: normalizedTemplates,
      });
      setOperationalCostTemplates(normalizedTemplates);
      setSavedMsg(settingsSavedMessage);
      showSettingsSavedToast();
      setTimeout(() => setSavedMsg(""), 3000);
      void fetchAll(true);
    } catch (error) {
      console.error("Operational cost template save error:", error);
      setSavedMsg(tp("failedSave"));
      setTimeout(() => setSavedMsg(""), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveGoogleSettings() {
    if (!profile) return;
    setSaving(true);

    try {
      await saveProfilePatch({
        calendar_event_format:
          calendarEventFormats.Umum || DEFAULT_CALENDAR_EVENT_FORMAT,
        calendar_event_format_map: calendarEventFormats,
        calendar_event_description:
          calendarEventDescriptions.Umum || DEFAULT_CALENDAR_EVENT_DESCRIPTION,
        calendar_event_description_map: calendarEventDescriptions,
        drive_folder_format:
          driveFolderFormats.Umum || DEFAULT_DRIVE_FOLDER_FORMAT,
        drive_folder_format_map: driveFolderFormats,
        drive_folder_structure_map: driveFolderStructures,
      });
      setSavedMsg(settingsSavedMessage);
      showSettingsSavedToast();
      setTimeout(() => setSavedMsg(""), 3000);
      void fetchAll(true);
    } catch (error) {
      console.error("Google settings save error:", error);
      setSavedMsg(tp("failedSave"));
      setTimeout(() => setSavedMsg(""), 3000);
    } finally {
      setSaving(false);
    }
  }

  function resolveFastpikStatusBadgeClass(
    value: "idle" | "success" | "warning" | "failed" | "syncing",
  ) {
    if (value === "success") {
      return "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300";
    }
    if (value === "warning") {
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300";
    }
    if (value === "failed") {
      return "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300";
    }
    if (value === "syncing") {
      return "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300";
    }
    return "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300";
  }

  function buildFastpikProfilePatch() {
    return {
      fastpik_integration_enabled: fastpikIntegrationEnabled,
      fastpik_sync_mode: fastpikSyncMode,
      fastpik_preset_source: fastpikPresetSource,
      fastpik_api_key: fastpikApiKey.trim() || null,
      fastpik_default_max_photos:
        Number.isFinite(fastpikDefaultMaxPhotos) && fastpikDefaultMaxPhotos > 0
          ? Math.floor(fastpikDefaultMaxPhotos)
          : 50,
      fastpik_default_selection_days:
        Number.isFinite(fastpikDefaultSelectionDays) &&
        fastpikDefaultSelectionDays > 0
          ? Math.floor(fastpikDefaultSelectionDays)
          : 14,
      fastpik_default_download_days:
        Number.isFinite(fastpikDefaultDownloadDays) &&
        fastpikDefaultDownloadDays > 0
          ? Math.floor(fastpikDefaultDownloadDays)
          : 14,
      fastpik_default_detect_subfolders: fastpikDefaultDetectSubfolders,
      fastpik_default_password: fastpikDefaultPassword.trim() || null,
      fastpik_link_display_mode_booking_detail:
        fastpikLinkDisplayModeBookingDetail,
      fastpik_link_display_mode_tracking: fastpikLinkDisplayModeTracking,
    };
  }

  async function persistFastpikSettings(options?: { showSavedMessage?: boolean }) {
    if (!profile) {
      throw new Error(tp("profileNotFound"));
    }

    await saveProfilePatch(buildFastpikProfilePatch());
    if (options?.showSavedMessage) {
      setSavedMsg(settingsSavedMessage);
      showSettingsSavedToast();
      setTimeout(() => setSavedMsg(""), 3000);
    }
  }

  async function handleSaveFastpikSettings() {
    if (!profile) return;
    setSaving(true);
    try {
      await persistFastpikSettings({ showSavedMessage: true });
      void fetchAll(true);
    } catch (error) {
      console.error("Fastpik settings save error:", error);
      setSavedMsg(tp("failedSave"));
      setTimeout(() => setSavedMsg(""), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleTestFastpikConnection() {
    setFastpikTesting(true);
    setFastpikActionMessage("");
    try {
      await persistFastpikSettings();
      const response = await fetch("/api/integrations/fastpik/test", {
        method: "POST",
      });
      const payload = await response.json().catch(() => null);
      const status =
        (payload?.status as
          | "idle"
          | "success"
          | "warning"
          | "failed"
          | "syncing"
          | undefined) || (response.ok ? "success" : "failed");
      const message =
        typeof payload?.message === "string"
          ? payload.message
          : response.ok
            ? tp("fastpikConnectionSuccess")
            : tp("fastpikConnectionFailed");
      setFastpikLastSyncStatus(status);
      setFastpikLastSyncMessage(message);
      setFastpikLastSyncAt(new Date().toISOString());
      setFastpikActionMessage(message);
      void fetchAll(true);
    } catch (error: any) {
      const message = error?.message || tp("fastpikConnectionFailed");
      setFastpikLastSyncStatus("failed");
      setFastpikLastSyncMessage(message);
      setFastpikLastSyncAt(new Date().toISOString());
      setFastpikActionMessage(message);
    } finally {
      setFastpikTesting(false);
    }
  }

  async function handleBatchSyncFastpik() {
    setFastpikBatchSyncing(true);
    setFastpikActionMessage("");
    try {
      await persistFastpikSettings();
      const response = await fetch("/api/integrations/fastpik/sync-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          chunkSize: 50,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || tp("fastpikBatchSyncFailed"));
      }

      const message = tp("fastpikBatchCompleted", {
        total: payload.total || 0,
        successCount: payload.successCount || 0,
        warningCount: payload.warningCount || 0,
        failedCount: payload.failedCount || 0,
      });
      const status: "idle" | "success" | "warning" | "failed" | "syncing" =
        (payload.failedCount || 0) > 0
          ? "failed"
          : (payload.warningCount || 0) > 0
            ? "warning"
            : "success";

      setFastpikLastSyncStatus(status);
      setFastpikLastSyncMessage(message);
      setFastpikLastSyncAt(new Date().toISOString());
      setFastpikActionMessage(message);
      void fetchAll(true);
    } catch (error: any) {
      const message = error?.message || tp("fastpikBatchSyncFailed");
      setFastpikLastSyncStatus("failed");
      setFastpikLastSyncMessage(message);
      setFastpikLastSyncAt(new Date().toISOString());
      setFastpikActionMessage(message);
    } finally {
      setFastpikBatchSyncing(false);
    }
  }

  async function handleTestTelegramConnection() {
    setTelegramTesting(true);
    setTelegramActionMessage("");
    try {
      await persistTelegramSettings();
      const response = await fetch("/api/integrations/telegram/test", {
        method: "POST",
      });
      const payload = await response.json().catch(() => null);
      const message =
        typeof payload?.message === "string"
          ? payload.message
          : response.ok
            ? tp("telegramTestSuccess")
            : tp("telegramTestFailed");
      if (!response.ok) {
        throw new Error(message);
      }
      setTelegramActionMessage(message);
      showSettingsSavedToast(message);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : tp("telegramTestFailed");
      setTelegramActionMessage(message);
      showFeedback(message);
    } finally {
      setTelegramTesting(false);
    }
  }

  async function handleSaveEventTypes() {
    setEventTypeSaving(true);
    try {
      const normalizedCustomEventTypes = mergeCustomEventTypes(customEventTypes);
      const normalizedActiveEventTypes = getActiveEventTypes({
        customEventTypes: normalizedCustomEventTypes,
        activeEventTypes,
      });
      await saveProfilePatch({
        form_event_types: normalizedActiveEventTypes,
        custom_event_types: normalizedCustomEventTypes,
      });
      setCustomEventTypes(normalizedCustomEventTypes);
      setActiveEventTypes(normalizedActiveEventTypes);
      setEventTypeSaved(true);
      showSettingsSavedToast();
      setTimeout(() => setEventTypeSaved(false), 3000);
      void fetchAll(true);
    } catch (error) {
      console.error("Event type save error:", error);
      showFeedback(tp("failedSaveGlobalEventTypes"));
    } finally {
      setEventTypeSaving(false);
    }
  }

  function resolveTemplateTargetFromKey(key: string) {
    return parseTemplateContentKey(key);
  }

  async function handleSaveAllTemplates() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      showFeedback(tp("userNotFound"));
      return;
    }
    setTemplateSaving(true);
    try {
      const keys = Array.from(
        new Set([
          ...Object.keys(templateBaselineRef.current.contents),
          ...Object.keys(templateBaselineRef.current.contentsEn),
          ...Object.keys(templateContents),
          ...Object.keys(templateContentsEn),
        ]),
      );
      const changedKeys = keys.filter((key) => {
        const currentId = templateContents[key] || "";
        const currentEn = templateContentsEn[key] || "";
        const baselineId = templateBaselineRef.current.contents[key] || "";
        const baselineEn = templateBaselineRef.current.contentsEn[key] || "";
        return currentId !== baselineId || currentEn !== baselineEn;
      });

      if (changedKeys.length === 0) {
        setTemplateSavedMsg(settingsSavedMessage);
        showSettingsSavedToast();
        setTimeout(() => setTemplateSavedMsg(""), 3000);
        return;
      }

      let nextTemplates = [...templates];

      for (const key of changedKeys) {
        const { type, eventType, mode } = resolveTemplateTargetFromKey(key);
        const content = templateContents[key] || "";
        const contentEn = templateContentsEn[key] || "";
        const existing = nextTemplates.find(
          (item) =>
            resolveTemplateType(item) === type &&
            resolveTemplateMode(item) === mode &&
            (eventType
              ? (normalizeTemplateEventTypeValue(item.event_type) || "Umum") ===
                eventType
              : !item.event_type || item.event_type === null),
        );
        const storedType = getStoredTemplateType(type);
        const storedName = getStoredTemplateName(
          type,
          tp(templateTitleKeyByType[type] || "templateInvoice"),
          mode,
        );

        if (existing) {
          const { data, error } = await supabase
            .from("templates")
            .update({
              type: storedType,
              name: storedName,
              content,
              content_en: contentEn,
            })
            .eq("id", existing.id)
            .select(
              "id, type, name, content, content_en, is_default, event_type",
            )
            .single();
          if (error) throw error;
          nextTemplates = nextTemplates.map((item) =>
            item.id === existing.id ? (data as Template) : item,
          );
          continue;
        }

        if (content.trim() || contentEn.trim()) {
          const { data, error } = await supabase
            .from("templates")
            .insert({
              user_id: user.id,
              type: storedType,
              name: storedName,
              content,
              content_en: contentEn,
              is_default: true,
              event_type: eventType || null,
            })
            .select(
              "id, type, name, content, content_en, is_default, event_type",
            )
            .single();
          if (error) throw error;
          nextTemplates = [...nextTemplates, data as Template];
        }
      }

      setTemplates(nextTemplates);
      setTemplateSavedMsg(settingsSavedMessage);
      showSettingsSavedToast();
      setTimeout(() => setTemplateSavedMsg(""), 3000);
      void fetchAll(true);
    } catch (error) {
      console.error("Template save error:", error);
      showFeedback(tp("failedSaveTemplate"));
    } finally {
      setTemplateSaving(false);
    }
  }

  async function handleSaveStatuses() {
    if (!profile) return;
    const normalizedClientStatuses = normalizeClientProgressStatuses(
      customClientStatuses,
    );
    const nextVisibleFromStatus = resolveFinalInvoiceVisibleFromStatus(
      normalizedClientStatuses,
      finalInvoiceVisibleFromStatus,
    );
    const nextTrackingFileVisibleFromStatus =
      resolveTrackingFileLinksVisibleFromStatus(
        normalizedClientStatuses,
        trackingFileLinksVisibleFromStatus,
      );
    const nextTrackingVideoVisibleFromStatus =
      resolveTrackingVideoLinksVisibleFromStatus(
        normalizedClientStatuses,
        trackingVideoLinksVisibleFromStatus,
      );
    const nextDpVerifyTriggerStatus = resolveDpVerifyTriggerStatus(
      normalizedClientStatuses,
      dpVerifyTriggerStatus,
    );
    const nextSessionTimeTriggerFromStatus = resolveOptionalClientProgressStatus(
      normalizedClientStatuses,
      sessionTimeTriggerFromStatus,
    );
    const nextSessionTimeTriggerToStatus = resolveOptionalClientProgressStatus(
      normalizedClientStatuses,
      sessionTimeTriggerToStatus,
    );
    const hasSessionTimeTriggerPair = Boolean(
      nextSessionTimeTriggerFromStatus && nextSessionTimeTriggerToStatus,
    );
    if (
      hasSessionTimeTriggerPair &&
      nextSessionTimeTriggerFromStatus === nextSessionTimeTriggerToStatus
    ) {
      showFeedback("Status asal dan tujuan trigger jam sesi tidak boleh sama.");
      return;
    }
    setStatusSaving(true);
    try {
      await saveProfilePatch({
        custom_statuses: normalizedClientStatuses,
        custom_client_statuses: normalizedClientStatuses,
        queue_trigger_status: queueTriggerStatus,
        dp_verify_trigger_status: nextDpVerifyTriggerStatus || null,
        session_time_trigger_from_status: hasSessionTimeTriggerPair
          ? nextSessionTimeTriggerFromStatus
          : null,
        session_time_trigger_to_status: hasSessionTimeTriggerPair
          ? nextSessionTimeTriggerToStatus
          : null,
        final_invoice_visible_from_status: nextVisibleFromStatus,
        tracking_file_links_visible_from_status:
          nextTrackingFileVisibleFromStatus,
        tracking_video_links_visible_from_status:
          nextTrackingVideoVisibleFromStatus,
        tracking_hide_queue_number: trackingHideQueueNumber,
      });
      setCustomClientStatuses(normalizedClientStatuses);
      setDpVerifyTriggerStatus(nextDpVerifyTriggerStatus);
      setSessionTimeTriggerFromStatus(
        hasSessionTimeTriggerPair ? nextSessionTimeTriggerFromStatus : "",
      );
      setSessionTimeTriggerToStatus(
        hasSessionTimeTriggerPair ? nextSessionTimeTriggerToStatus : "",
      );
      setFinalInvoiceVisibleFromStatus(nextVisibleFromStatus);
      setTrackingFileLinksVisibleFromStatus(nextTrackingFileVisibleFromStatus);
      setTrackingVideoLinksVisibleFromStatus(nextTrackingVideoVisibleFromStatus);
      setStatusSaved(true);
      showSettingsSavedToast();
      setTimeout(() => setStatusSaved(false), 3000);
    } catch (error) {
      console.error("Status save error:", error);
      showFeedback(tp("failedSaveStatus"));
    } finally {
      setStatusSaving(false);
    }
  }

  async function resetGeneralToDefaultAndSave() {
    const defaultCalendarFormats = normalizeTemplateFormatMap(
      null,
      DEFAULT_CALENDAR_EVENT_FORMAT,
    );
    const defaultCalendarDescriptions = normalizeCalendarEventDescriptionMap(
      null,
      DEFAULT_CALENDAR_EVENT_DESCRIPTION,
    );
    const defaultDriveFormats = normalizeTemplateFormatMap(
      null,
      DEFAULT_DRIVE_FOLDER_FORMAT,
    );
    const defaultDriveStructures = normalizeDriveFolderStructureSettings(null);

    setCalendarEventFormats(defaultCalendarFormats);
    setCalendarEventDescriptions(defaultCalendarDescriptions);
    setDriveFolderFormats(defaultDriveFormats);
    setDriveFolderStructures(defaultDriveStructures);

    await saveProfilePatch({
      calendar_event_format:
        defaultCalendarFormats.Umum || DEFAULT_CALENDAR_EVENT_FORMAT,
      calendar_event_format_map: defaultCalendarFormats,
      calendar_event_description:
        defaultCalendarDescriptions.Umum || DEFAULT_CALENDAR_EVENT_DESCRIPTION,
      calendar_event_description_map: defaultCalendarDescriptions,
      drive_folder_format:
        defaultDriveFormats.Umum || DEFAULT_DRIVE_FOLDER_FORMAT,
      drive_folder_format_map: defaultDriveFormats,
      drive_folder_structure_map: defaultDriveStructures,
    });
    setSavedMsg(settingsSavedMessage);
    showSettingsSavedToast();
    setTimeout(() => setSavedMsg(""), 3000);
    void fetchAll(true);
  }

  async function resetTemplatesToDefaultAndSave() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error(tp("userNotFound"));

    const managedTemplateTypes = new Set(templateTypes.map((item) => item.value));
    const managedTemplateIds = templates
      .filter((item) => managedTemplateTypes.has(resolveTemplateType(item)))
      .map((item) => item.id);

    if (managedTemplateIds.length > 0) {
      const { error } = await supabase
        .from("templates")
        .delete()
        .eq("user_id", user.id)
        .in("id", managedTemplateIds);
      if (error) throw error;
    }

    setTemplates((prev) =>
      prev.filter((item) => !managedTemplateTypes.has(resolveTemplateType(item))),
    );
    setTemplateContents({});
    setTemplateContentsEn({});
    templateBaselineRef.current = { contents: {}, contentsEn: {} };
    setTemplateSavedMsg(settingsSavedMessage);
    showSettingsSavedToast();
    setTimeout(() => setTemplateSavedMsg(""), 3000);
    void fetchAll(true);
  }

  async function resetStatusesToDefaultAndSave() {
    const nextClientStatuses = normalizeClientProgressStatuses(
      DEFAULT_CLIENT_STATUSES,
    );
    const nextVisibleFromStatus = resolveFinalInvoiceVisibleFromStatus(
      nextClientStatuses,
      DEFAULT_FINAL_INVOICE_VISIBLE_FROM_STATUS,
    );
    const nextTrackingFileVisibleFromStatus =
      resolveTrackingFileLinksVisibleFromStatus(
        nextClientStatuses,
        DEFAULT_TRACKING_FILE_LINKS_VISIBLE_FROM_STATUS,
      );
    const nextTrackingVideoVisibleFromStatus =
      resolveTrackingVideoLinksVisibleFromStatus(
        nextClientStatuses,
        DEFAULT_TRACKING_VIDEO_LINKS_VISIBLE_FROM_STATUS,
      );

    setCustomClientStatuses(nextClientStatuses);
    setQueueTriggerStatus(DEFAULT_QUEUE_TRIGGER_STATUS);
    setDpVerifyTriggerStatus(DEFAULT_DP_VERIFY_TRIGGER_STATUS);
    setSessionTimeTriggerFromStatus("");
    setSessionTimeTriggerToStatus("");
    setFinalInvoiceVisibleFromStatus(nextVisibleFromStatus);
    setTrackingFileLinksVisibleFromStatus(nextTrackingFileVisibleFromStatus);
    setTrackingVideoLinksVisibleFromStatus(nextTrackingVideoVisibleFromStatus);
    setTrackingHideQueueNumber(false);

    await saveProfilePatch({
      custom_statuses: nextClientStatuses,
      custom_client_statuses: nextClientStatuses,
      queue_trigger_status: DEFAULT_QUEUE_TRIGGER_STATUS,
      dp_verify_trigger_status: DEFAULT_DP_VERIFY_TRIGGER_STATUS || null,
      session_time_trigger_from_status: null,
      session_time_trigger_to_status: null,
      final_invoice_visible_from_status: nextVisibleFromStatus,
      tracking_file_links_visible_from_status: nextTrackingFileVisibleFromStatus,
      tracking_video_links_visible_from_status: nextTrackingVideoVisibleFromStatus,
      tracking_hide_queue_number: false,
    });
    setStatusSaved(true);
    showSettingsSavedToast();
    setTimeout(() => setStatusSaved(false), 3000);
  }

  async function resetEventTypesToDefaultAndSave() {
    const nextBuiltInEventTypes = [...builtInEventTypes];
    setCustomEventTypes([]);
    setActiveEventTypes(nextBuiltInEventTypes);
    setNewCustomEventType("");

    await saveProfilePatch({
      form_event_types: nextBuiltInEventTypes,
      custom_event_types: [],
    });
    setEventTypeSaved(true);
    showSettingsSavedToast();
    setTimeout(() => setEventTypeSaved(false), 3000);
    void fetchAll(true);
  }

  async function handleConfirmReset() {
    if (!resetModal.scope) return;
    setResetSaving(true);
    try {
      if (resetModal.scope === "umum") {
        await resetGeneralToDefaultAndSave();
      } else if (resetModal.scope === "google") {
        await resetGeneralToDefaultAndSave();
      } else if (resetModal.scope === "template") {
        await resetTemplatesToDefaultAndSave();
      } else if (resetModal.scope === "status") {
        await resetStatusesToDefaultAndSave();
      } else if (resetModal.scope === "jenis-acara") {
        await resetEventTypesToDefaultAndSave();
      }
      setResetModal({ open: false, scope: null });
    } catch (error) {
      console.error("Reset settings error:", error);
      showFeedback(tp("failedResetToDefault"));
    } finally {
      setResetSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!disconnectModal.service) return;
    stopGoogleConnectPolling();
    clearConnectedGoogleAccountCache();
    setIsDisconnecting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setIsDisconnecting(false);
      return;
    }

    if (disconnectModal.service === "calendar") {
      await saveProfilePatch({
        google_access_token: null,
        google_refresh_token: null,
        google_token_expiry: null,
        google_calendar_account_email: null,
      });
      setIsCalendarConnected(false);
      setCalendarConnectedEmail(null);
    } else {
      await saveProfilePatch({
        google_drive_access_token: null,
        google_drive_refresh_token: null,
        google_drive_token_expiry: null,
        google_drive_account_email: null,
      });
      setIsDriveConnected(false);
      setDriveConnectedEmail(null);
    }
    setIsDisconnecting(false);
    setDisconnectModal({ open: false, service: null });
  }

  const inputClass =
    "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";
  const textareaClass =
    "placeholder:text-muted-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-y";
  const selectClass = adminNativeSelectClass;
  const unifiedSaveButtonClass = "h-11 min-w-[190px] gap-2 px-6 text-sm";
  const unifiedResetButtonClass = "h-11 gap-2 px-5";

  function insertIntoInput(
    ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
    token: string,
    currentValue: string,
    onChange: (value: string) => void,
  ) {
    const input = ref.current;
    if (!input) {
      onChange(`${currentValue}${currentValue ? " " : ""}${token}`);
      return;
    }

    const start = input.selectionStart ?? currentValue.length;
    const end = input.selectionEnd ?? currentValue.length;
    const newValue = `${currentValue.slice(0, start)}${token}${currentValue.slice(end)}`;
    onChange(newValue);

    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  }

  function updateCalendarFormat(eventType: string, value: string) {
    setCalendarEventFormats((prev) => ({ ...prev, [eventType]: value }));
  }

  function updateCalendarDescription(
    eventType: string,
    value: string,
    mode: GoogleCalendarTemplateMode = "normal",
  ) {
    const key = buildCalendarDescriptionMapKey(eventType, mode);
    setCalendarEventDescriptions((prev) => ({ ...prev, [key]: value }));
  }

  function updateDriveFormat(eventType: string, value: string) {
    setDriveFolderFormats((prev) => ({ ...prev, [eventType]: value }));
  }

  function getDriveSegments(eventType: string) {
    const resolved = driveFolderStructures[eventType];
    if (resolved && resolved.length > 0) return resolved;
    return driveFolderStructures.Umum?.length
      ? driveFolderStructures.Umum
      : ["{client_name}"];
  }

  function updateDriveSegments(
    eventType: string,
    updater: (segments: string[]) => string[],
  ) {
    setDriveFolderStructures((prev) => ({
      ...prev,
      [eventType]: updater(getDriveSegments(eventType)),
    }));
  }

  function updateSeoSection(
    section: SeoSectionKey,
    patch: Partial<SeoSectionState>,
  ) {
    setSeoSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        ...patch,
      },
    }));
  }

  function setActiveSeoField(section: SeoSectionKey, field: SeoFieldKey) {
    setActiveSeoFieldBySection((prev) => ({ ...prev, [section]: field }));
  }

  function setSeoFieldRef(
    section: SeoSectionKey,
    field: SeoFieldKey,
    node: SeoFieldInputElement | null,
  ) {
    seoFieldRefs.current[section][field] = node;
  }

  function handleInsertSeoVariable(section: SeoSectionKey, token: string) {
    const activeField = activeSeoFieldBySection[section] || "metaTitle";
    const fieldRef = {
      current: seoFieldRefs.current[section][activeField],
    } as React.RefObject<SeoFieldInputElement | null>;
    insertIntoInput(
      fieldRef,
      token,
      seoSettings[section][activeField],
      (value) =>
        updateSeoSection(section, {
          [activeField]: value,
        } as Partial<SeoSectionState>),
    );
  }

  // Logo handlers
  function handleLogoFileSelected(file: File) {
    if (file.size > 500 * 1024) {
      showFeedback(tp("fileTooLarge"));
      return;
    }
    if (!file.type.startsWith("image/")) {
      showFeedback("File harus berupa gambar (PNG/JPG).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoCropSrc(reader.result as string);
      setShowLogoCrop(true);
    };
    reader.readAsDataURL(file);
  }

  async function handleCroppedLogo(blob: Blob) {
    setShowLogoCrop(false);
    setLogoCropSrc(null);
    if (!profile?.id) return;
    setLogoUploading(true);
    try {
      const optimizedBlob = await optimizePngBlobForUpload(blob, {
        maxBytes: 500 * 1024,
        maxDimension: 1600,
        minDimension: 256,
      }).catch(() => {
        throw new Error(tp("failedSaveLogo"));
      });
      const extension =
        optimizedBlob.type === "image/png"
          ? "png"
          : optimizedBlob.type === "image/webp"
            ? "webp"
            : "jpg";
      const uploadFile = new File(
        [optimizedBlob],
        `invoice-logo-${Date.now()}.${extension}`,
        { type: optimizedBlob.type || "image/png" },
      );
      const formData = new FormData();
      formData.append("assetType", "invoice_logo");
      formData.append("file", uploadFile);

      const response = await fetch("/api/profile/branding-upload", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; url?: string; error?: string }
        | null;

      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || tp("failedSaveLogo"));
      }

      setLogoUrl(payload.url);
    } catch (error) {
      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : tp("failedSaveLogo");
      showFeedback(errorMessage);
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleRemoveLogo() {
    if (!profile?.id) return;
    await saveProfilePatch({ invoice_logo_url: null });
    setLogoUrl(null);
  }
  const previewLocale = locale || "id";
  const siteUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://example.com";
  const slugPreview = normalizeVendorSlug(vendorSlug || studioName) || "nama-vendor";
  const sluglessModeActive = isCustomTenantDomain && disableBookingSlug;
  const localizedFormBasePath = `${siteUrl}/${previewLocale}/formbooking`;
  const localizedFormPath = sluglessModeActive
    ? `${localizedFormBasePath}/`
    : `${localizedFormBasePath}/${slugPreview}`;
  const sluglessDefaultVendorSlug = normalizeVendorSlug(
    defaultBookingVendorSlug || vendorSlug || studioName,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tabs = [
    { key: "umum", label: tp("tabGeneral") },
    { key: "seo", label: tp("tabSeo") },
    { key: "template", label: tp("tabTemplates") },
    { key: "daftar-booking", label: tp("tabBookingList") },
    ...(isTenantAdmin ? [{ key: "keuangan", label: tp("tabFinance") }] : []),
    { key: "status", label: tp("tabStatus") },
    { key: "jenis-acara", label: tp("tabEventTypes") },
    { key: "google", label: tp("tabGoogle") },
    { key: "fastpik", label: tp("tabFastpik") },
    { key: "telegram", label: tp("tabTelegram") },
  ];
  const resetDialogMeta: Record<
    NonNullable<(typeof resetModal)["scope"]>,
    { title: string; description: string }
  > = {
    umum: {
      title: tp("resetGeneralTitle"),
      description: tp("resetGeneralDescription"),
    },
    template: {
      title: tp("resetTemplateTitle"),
      description: tp("resetTemplateDescription"),
    },
    status: {
      title: tp("resetStatusTitle"),
      description: tp("resetStatusDescription"),
    },
    "jenis-acara": {
      title: tp("resetEventTypesTitle"),
      description: tp("resetEventTypesDescription"),
    },
    google: {
      title: tp("resetGoogleTitle"),
      description: tp("resetGoogleDescription"),
    },
  };

  const previewData: Record<string, string> = {
    client_name: "Budi",
    booking_code: "INV-100120250001",
    session_label: "Sesi utama",
    reminder_label: previewLocale === "en" ? "tomorrow" : "besok",
    session_date: "15 April 2026",
    session_time: "17.00 - 18.00",
    session_start: "17.00",
    session_end: "18.00",
    end_time: "18.00",
    service_name: "Paket Wedding",
    total_price: "Rp 5.000.000",
    dp_paid: "Rp 2.500.000",
    final_total: "Rp 6.000.000",
    adjustments_total: "Rp 1.000.000",
    remaining_payment: "Rp 3.500.000",
    payment_method: "Transfer Bank",
    studio_name: studioName || "Memori Studio",
    freelancer_name: "Andi",
    freelance: "Andi, Bima",
    client_whatsapp: "+628123456789",
    instagram: "@budiwedding",
    instagram_link: "https://instagram.com/budiwedding",
    event_type: selectedEventType,
    booking_detail_link: `${siteUrl}/${previewLocale}/bookings/booking-id-123`,
    day_name: "Rabu",
    location: "Jakarta Convention Center",
    akad_location: "Masjid Raya Jakarta",
    akad_date: "15 April 2026",
    akad_time: "08.00",
    resepsi_location: "Grand Ballroom Jakarta",
    resepsi_date: "15 April 2026",
    resepsi_time: "18.00",
    resepsi_maps_url: "https://maps.google.com/maps?q=Grand+Ballroom+Jakarta",
    wisuda_session_1_location: "Balairung Kampus",
    wisuda_session_1_date: "10 September 2026",
    wisuda_session_1_time: "07.30",
    wisuda_session_1_end_time: "09.00",
    wisuda_session_1_time_range: "07.30 - 09.00",
    wisuda_session_1_maps_url: "https://maps.google.com/maps?q=Balairung+Kampus",
    wisuda_session_2_location: "Taman Wisuda",
    wisuda_session_2_date: "10 September 2026",
    wisuda_session_2_time: "13.00",
    wisuda_session_2_end_time: "14.00",
    wisuda_session_2_time_range: "13.00 - 14.00",
    wisuda_session_2_maps_url: "https://maps.google.com/maps?q=Taman+Wisuda",
    location_maps_url:
      "https://maps.google.com/maps?q=Jakarta+Convention+Center",
    detail_location: "Gedung Utama, Lt. 3, Ruang Ballroom A",
    notes: "Mohon datang 30 menit lebih awal",
    drive_link: "https://drive.google.com/drive/folders/abc123",
    tracking_link: `${siteUrl}/${previewLocale}/track/abc123`,
    invoice_url: `${siteUrl}/api/public/invoice?code=INV-100120250001`,
    settlement_link: `${siteUrl}/${previewLocale}/settlement/abc123`,
  };

  function renderPreview(content: string, extraVars?: Record<string, string>) {
    if (!content) return tp("emptyMessage");
    const mergedVars = { ...previewData, ...extraVars };
    return content.replace(
      /\{\{(\w+)\}\}/g,
      (_, key) => mergedVars[key] || `{{${key}}}`,
    );
  }

  const seoPreviewVariables: Record<string, string> = {
    studio_name: studioName || "Memori Studio",
    vendor_slug: slugPreview,
    client_name: "Budi",
    booking_code: "INV-100120250001",
    status: "Sesi Foto / Acara",
    event_type: "Wedding",
    session_date: "15 April 2026",
    tracking_uuid: "abc123",
    settlement_uuid: "abc123",
  };

  function renderSeoTextTemplate(content: string) {
    if (!content.trim()) return "";
    return fillWhatsAppTemplate(content, seoPreviewVariables);
  }

  function getSeoDynamicDefaultBySection(section: SeoSectionKey): SeoSectionState {
    if (section === "form") {
      return {
        ...SEO_DEFAULT_BY_SECTION.form,
        metaDescription:
          formBookingGreeting.trim() || SEO_DEFAULT_BY_SECTION.form.metaDescription,
      };
    }
    return SEO_DEFAULT_BY_SECTION[section];
  }

  function resolveSeoField(
    section: SeoSectionKey,
    field: SeoFieldKey,
  ): ResolvedSeoField {
    const sectionValue = seoSettings[section][field].trim();
    if (sectionValue) {
      return {
        value: sectionValue,
        source: "section",
      };
    }

    if (section !== "global") {
      const globalValue = seoSettings.global[field].trim();
      if (globalValue) {
        return {
          value: globalValue,
          source: "global",
        };
      }
    }

    return {
      value: getSeoDynamicDefaultBySection(section)[field],
      source: "dynamicDefault",
    };
  }

  function getResolvedSeoSection(section: SeoSectionKey): ResolvedSeoSectionState {
    return {
      metaTitle: resolveSeoField(section, "metaTitle"),
      metaDescription: resolveSeoField(section, "metaDescription"),
      metaKeywords: resolveSeoField(section, "metaKeywords"),
    };
  }

  function getSeoSourceLabel(section: SeoSectionKey, source: SeoValueSource) {
    if (source === "section") {
      return section === "global"
        ? tp("seoSourceGlobalOverride")
        : tp("seoSourceSectionOverride");
    }
    if (source === "global") {
      return tp("seoSourceGlobalFallback");
    }
    return tp("seoSourceDynamicDefault");
  }

  const calendarPreviewVars = {
    ...previewData,
    event_type: selectedCalendarEventType,
    ...getEventExtraFieldPreviewVars(selectedCalendarEventType),
    ...getCustomFieldPreviewVars(
      formSectionsByEventType[selectedCalendarEventType] ||
        formSectionsByEventType.Umum ||
        [],
      selectedCalendarEventType,
    ),
  };
  const drivePreviewVars = {
    ...previewData,
    event_type: selectedDriveEventType,
    ...getEventExtraFieldPreviewVars(selectedDriveEventType),
    ...getCustomFieldPreviewVars(
      formSectionsByEventType[selectedDriveEventType] ||
        formSectionsByEventType.Umum ||
        [],
      selectedDriveEventType,
    ),
  };
  const currentCalendarFormat =
    calendarEventFormats[selectedCalendarEventType] || "";
  const supportedCalendarDescriptionModes = isSplitCapableTemplateEvent(
    selectedCalendarEventType,
  )
    ? CALENDAR_DESCRIPTION_MODES
    : (["normal"] as GoogleCalendarTemplateMode[]);
  const activeCalendarDescriptionMode = supportedCalendarDescriptionModes.includes(
    selectedCalendarDescriptionMode,
  )
    ? selectedCalendarDescriptionMode
    : "normal";
  const currentCalendarDescriptionKey = buildCalendarDescriptionMapKey(
    selectedCalendarEventType,
    activeCalendarDescriptionMode,
  );
  const currentCalendarDescription =
    calendarEventDescriptions[currentCalendarDescriptionKey] || "";
  const currentDriveFormat = driveFolderFormats[selectedDriveEventType] || "";
  const calendarTemplateVariables = Array.from(
    new Set([
      ...getCalendarTemplateVariables(
        selectedCalendarEventType,
        activeCalendarDescriptionMode,
      ),
      ...getCustomFieldTemplateTokens(
        formSectionsByEventType[selectedCalendarEventType] ||
          formSectionsByEventType.Umum ||
          [],
        selectedCalendarEventType,
        "calendar",
      ),
    ]),
  );
  const calendarEventPreview = applyCalendarTemplate(
    resolveTemplateByEventType(
      calendarEventFormats,
      selectedCalendarEventType,
      DEFAULT_CALENDAR_EVENT_FORMAT,
    ),
    calendarPreviewVars,
  );
  const calendarDescriptionPreview = applyCalendarTemplate(
    resolveCalendarDescriptionTemplateByMode({
      mapValue: calendarEventDescriptions,
      eventType: selectedCalendarEventType,
      mode: activeCalendarDescriptionMode,
      fallback: getDefaultCalendarEventDescriptionByMode({
        eventType: selectedCalendarEventType,
        mode: activeCalendarDescriptionMode,
      }),
    }),
    calendarPreviewVars,
  );
  const driveFolderPreview = applyDriveTemplate(
    resolveTemplateByEventType(
      driveFolderFormats,
      selectedDriveEventType,
      DEFAULT_DRIVE_FOLDER_FORMAT,
    ),
    drivePreviewVars,
  );
  const driveFolderStructurePreview = getDriveSegments(selectedDriveEventType)
    .map((segment) => applyDriveTemplate(segment, drivePreviewVars))
    .filter((segment) => segment.trim().length > 0)
    .join(" > ");
  const driveTemplateVariables = Array.from(
    new Set([
      ...getDriveTemplateVariables(selectedDriveEventType),
      ...getCustomFieldTemplateTokens(
        formSectionsByEventType[selectedDriveEventType] ||
          formSectionsByEventType.Umum ||
          [],
        selectedDriveEventType,
        "drive",
      ),
    ]),
  );

  function renderTemplateCard(tt: (typeof templateTypes)[0]) {
    const isEventScoped = isEventScopedWhatsAppTemplateType(tt.value);
    const supportedModes = isEventScoped
      ? getSupportedTemplateModesForEvent(selectedEventType)
      : (["normal"] as WhatsAppTemplateMode[]);
    const activeTemplateMode = supportedModes.includes(selectedTemplateMode)
      ? selectedTemplateMode
      : "normal";
    const contentKey = isEventScoped
      ? buildTemplateContentKey(tt.value, selectedEventType, activeTemplateMode)
      : tt.value;
    const cardToneClass =
      templateCardToneByType[tt.value] ||
      "border-border bg-card ring-1 ring-border/50 dark:border-border dark:bg-card dark:ring-border/40";
    const headerToneClass =
      templateHeaderToneByType[tt.value] || "border-border/70";
    const titleKey = templateTitleKeyByType[tt.value] || "templateInvoice";
    const descKey = templateDescKeyByType[tt.value] || "templateInvoiceDesc";
    const currentLang = templateLang[contentKey] || "id";
    const content =
      currentLang === "id"
        ? templateContents[contentKey] || ""
        : templateContentsEn[contentKey] || "";
    const baseHints = variableHints[tt.value] || [];
    const splitHints = isEventScoped
      ? getSplitWhatsAppVariableHints(selectedEventType, activeTemplateMode)
      : [];
    const hints = isEventScoped
      ? Array.from(
          new Set([
            ...baseHints,
            ...splitHints,
            ...getEventExtraFieldTemplateTokens(selectedEventType),
            ...getCustomFieldTemplateTokens(
              formSectionsByEventType[selectedEventType] ||
                formSectionsByEventType.Umum ||
                [],
              selectedEventType,
              "whatsapp",
            ),
          ]),
        )
      : baseHints;
    const preview = renderPreview(
      content,
      isEventScoped
        ? {
            event_type: selectedEventType,
            ...getEventExtraFieldPreviewVars(selectedEventType),
            ...getCustomFieldPreviewVars(
              formSectionsByEventType[selectedEventType] ||
                formSectionsByEventType.Umum ||
                [],
              selectedEventType,
            ),
          }
        : undefined,
    );

    return (
      <div
        key={tt.value}
        className={`rounded-xl border text-card-foreground shadow-sm ${cardToneClass}`}
      >
        <div className={`px-6 py-4 border-b ${headerToneClass}`}>
          <h3 className="font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            {tp(titleKey)}
          </h3>
          <p className="text-sm text-muted-foreground">{tp(descKey)}</p>
        </div>
        <div className="p-6 space-y-4">
          {isEventScoped && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {tp("eventType")}
              </label>
              <select
                value={selectedEventType}
                onChange={(e) => setSelectedEventType(e.target.value)}
                className={selectClass}
              >
                {availableEventTypes.map((et) => (
                  <option key={et} value={et}>
                    {et === "Umum" ? tp(`event${et}` as any) : et}
                  </option>
                ))}
              </select>
              {supportedModes.length > 1 && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {tp("templateMode")}
                  </label>
                  <select
                    value={activeTemplateMode}
                    onChange={(e) =>
                      setSelectedTemplateMode(
                        e.target.value === "split" ? "split" : "normal",
                      )
                    }
                    className={selectClass}
                  >
                    <option value="normal">{tp("templateModeNormal")}</option>
                    <option value="split">{tp("templateModeSplit")}</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Variables */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {tp("variables")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {hints.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    const textarea = document.querySelector(
                      `textarea[data-template-key="${contentKey}"]`,
                    ) as HTMLTextAreaElement | null;
                    if (textarea) {
                      const start = textarea.selectionStart || 0;
                      const end = textarea.selectionEnd || 0;
                      const currentContent =
                        currentLang === "id"
                          ? templateContents[contentKey] || ""
                          : templateContentsEn[contentKey] || "";
                      const newContent =
                        currentContent.substring(0, start) +
                        v +
                        currentContent.substring(end);
                      if (currentLang === "id") {
                        setTemplateContents((prev) => ({
                          ...prev,
                          [contentKey]: newContent,
                        }));
                      } else {
                        setTemplateContentsEn((prev) => ({
                          ...prev,
                          [contentKey]: newContent,
                        }));
                      }
                      // Restore cursor position after React re-render
                      setTimeout(() => {
                        textarea.focus();
                        textarea.selectionStart = textarea.selectionEnd =
                          start + v.length;
                      }, 0);
                    } else {
                      if (currentLang === "id") {
                        setTemplateContents((prev) => ({
                          ...prev,
                          [contentKey]: (prev[contentKey] || "") + v,
                        }));
                      } else {
                        setTemplateContentsEn((prev) => ({
                          ...prev,
                          [contentKey]: (prev[contentKey] || "") + v,
                        }));
                      }
                    }
                  }}
                  className="text-[11px] px-2 py-1 rounded-md border bg-muted/50 text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                >
                  {v.replace(/\{\{|\}\}/g, "")}
                </button>
              ))}
            </div>
          </div>

          {/* Language Tabs */}
          <div className="flex rounded-lg border overflow-hidden">
            <button
              type="button"
              onClick={() =>
                setTemplateLang((prev) => ({ ...prev, [contentKey]: "id" }))
              }
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                currentLang === "id"
                  ? "bg-foreground text-background"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              Indonesian 🇮🇩
            </button>
            <button
              type="button"
              onClick={() =>
                setTemplateLang((prev) => ({ ...prev, [contentKey]: "en" }))
              }
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                currentLang === "en"
                  ? "bg-foreground text-background"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              English 🇬🇧
            </button>
          </div>

          <textarea
            data-template-key={contentKey}
            value={content}
            onChange={(e) => {
              if (currentLang === "id") {
                setTemplateContents((prev) => ({
                  ...prev,
                  [contentKey]: e.target.value,
                }));
              } else {
                setTemplateContentsEn((prev) => ({
                  ...prev,
                  [contentKey]: e.target.value,
                }));
              }
            }}
            rows={5}
            placeholder={
              currentLang === "id"
                ? `Tulis template pesan dalam Bahasa Indonesia ...`
                : `Write message template in English ...`
            }
            className="placeholder:text-muted-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-y"
          />

          {/* Preview */}
          <div className="bg-muted/30 rounded-md px-4 py-3 border">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Preview:
            </p>
            <pre className="text-sm whitespace-pre-wrap font-sans text-foreground/80">
              {preview}
            </pre>
          </div>

        </div>
      </div>
    );
  }

  function renderSeoSectionCard(args: {
    section: SeoSectionKey;
    title: string;
    description: string;
  }) {
    const current = seoSettings[args.section];
    const resolved = getResolvedSeoSection(args.section);
    const dynamicDefaults = getSeoDynamicDefaultBySection(args.section);
    const fallbackChainLabel =
      args.section === "global"
        ? tp("seoFallbackChainGlobal")
        : tp("seoFallbackChainSection");
    const titlePreview = renderSeoTextTemplate(resolved.metaTitle.value).trim();
    const descriptionPreview = renderSeoTextTemplate(
      resolved.metaDescription.value,
    ).trim();
    const keywordsPreview = renderSeoTextTemplate(resolved.metaKeywords.value)
      .split(",")
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword.length > 0);
    const defaultTitlePreview = renderSeoTextTemplate(
      dynamicDefaults.metaTitle,
    ).trim();
    const defaultDescriptionPreview = renderSeoTextTemplate(
      dynamicDefaults.metaDescription,
    ).trim();
    const defaultKeywordsPreview = renderSeoTextTemplate(
      dynamicDefaults.metaKeywords,
    )
      .split(",")
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword.length > 0);

    return (
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="px-6 py-4 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <Search className="w-4 h-4" />
            {args.title}
          </h3>
          <p className="text-sm text-muted-foreground">{args.description}</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{tp("seoMetaTitleLabel")}</label>
            <input
              ref={(node) => setSeoFieldRef(args.section, "metaTitle", node)}
              onFocus={() => setActiveSeoField(args.section, "metaTitle")}
              value={current.metaTitle}
              onChange={(e) =>
                updateSeoSection(args.section, { metaTitle: e.target.value })
              }
              placeholder={tp("seoMetaTitlePlaceholder")}
              className={inputClass}
            />
            <p className="text-xs text-muted-foreground">{tp("seoMetaTitleHint")}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              {tp("seoMetaDescriptionLabel")}
            </label>
            <textarea
              ref={(node) => setSeoFieldRef(args.section, "metaDescription", node)}
              onFocus={() => setActiveSeoField(args.section, "metaDescription")}
              value={current.metaDescription}
              onChange={(e) =>
                updateSeoSection(args.section, {
                  metaDescription: e.target.value,
                })
              }
              rows={3}
              placeholder={tp("seoMetaDescriptionPlaceholder")}
              className={textareaClass}
            />
            <p className="text-xs text-muted-foreground">
              {tp("seoMetaDescriptionHint")}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{tp("seoMetaKeywordsLabel")}</label>
            <input
              ref={(node) => setSeoFieldRef(args.section, "metaKeywords", node)}
              onFocus={() => setActiveSeoField(args.section, "metaKeywords")}
              value={current.metaKeywords}
              onChange={(e) =>
                updateSeoSection(args.section, { metaKeywords: e.target.value })
              }
              placeholder={tp("seoMetaKeywordsPlaceholder")}
              className={inputClass}
            />
            <p className="text-xs text-muted-foreground">
              {tp("seoMetaKeywordsHint")}
            </p>
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {tp("seoVariablesLabel")}
            </p>
            <p className="text-xs text-muted-foreground">
              {tp("seoVariablesClickHint")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SEO_VARIABLE_HINTS.map((token) => (
                <button
                  key={`${args.section}-${token}`}
                  type="button"
                  onClick={() => handleInsertSeoVariable(args.section, token)}
                  className="text-[11px] px-2 py-1 rounded-md border bg-muted/50 text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                >
                  {token}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-md border bg-background/80 px-4 py-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {tp("seoDefaultActiveLabel")}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {fallbackChainLabel}
            </p>
            {args.section === "form" && (
              <p className="text-[11px] text-muted-foreground">
                {tp("seoFormDescriptionDefaultSource")}
              </p>
            )}
            <p className="text-sm font-semibold text-foreground">
              {defaultTitlePreview || tp("seoPreviewTitleEmpty")}
            </p>
            <p className="text-sm text-muted-foreground">
              {defaultDescriptionPreview || tp("seoPreviewDescriptionEmpty")}
            </p>
            <p className="text-xs text-muted-foreground">
              {defaultKeywordsPreview.length > 0
                ? defaultKeywordsPreview.join(" • ")
                : tp("seoPreviewKeywordsEmpty")}
            </p>
          </div>

          <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {tp("seoPreviewLabel")}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {tp("seoMetaTitleLabel")} -{" "}
              {getSeoSourceLabel(args.section, resolved.metaTitle.source)}
            </p>
            <p className="text-sm font-semibold text-foreground">
              {titlePreview || tp("seoPreviewTitleEmpty")}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {tp("seoMetaDescriptionLabel")} -{" "}
              {getSeoSourceLabel(args.section, resolved.metaDescription.source)}
            </p>
            <p className="text-sm text-muted-foreground">
              {descriptionPreview || tp("seoPreviewDescriptionEmpty")}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {tp("seoMetaKeywordsLabel")} -{" "}
              {getSeoSourceLabel(args.section, resolved.metaKeywords.source)}
            </p>
            <p className="text-xs text-muted-foreground">
              {keywordsPreview.length > 0
                ? keywordsPreview.join(" • ")
                : tp("seoPreviewKeywordsEmpty")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {successToastNode}
      <div className="space-y-6 max-w-5xl mx-auto">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b">
          <div className="-mx-1 overflow-x-auto px-1 md:mx-0 md:overflow-visible md:px-0">
            <div className="flex min-w-max gap-0 md:min-w-0 md:flex-wrap">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`shrink-0 whitespace-nowrap px-3 sm:px-4 pt-3 pb-2 text-sm font-medium border-b-[3px] transition-colors cursor-pointer ${
                    activeTab === tab.key
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground/80 hover:border-muted-foreground/30"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ TAB: Umum ═══ */}
        {(activeTab === "umum" ||
          activeTab === "seo" ||
          activeTab === "daftar-booking" ||
          activeTab === "google" ||
          activeTab === "fastpik") && (
          <div className="space-y-6">
            {activeTab === "umum" && (
              <>
                {/* Profile Section */}
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
              <div className="px-6 py-4 border-b">
                <h3 className="font-semibold flex items-center gap-2">
                  <Building2 className="w-4 h-4" /> {t("profilStudio")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("infoStudio")}
                </p>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" />{" "}
                      {tp("vendorStudioName")}
                    </label>
                    <input
                      value={studioName}
                      onChange={(e) => setStudioName(e.target.value)}
                      placeholder={tp("vendorNamePlaceholder")}
                      data-onboarding-target="settings-studio-name"
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> {t("nomorWA")}
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className={`${selectClass} !w-28 shrink-0`}
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.flag} {c.code}
                          </option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        value={waNumber}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, "");
                          setWaNumber(val.startsWith("0") ? val.slice(1) : val);
                        }}
                        placeholder="8123456789"
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>

                {/* Custom URL Slug */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" /> {tp("customUrlLabel")}
                  </label>
                  <input
                    value={vendorSlug}
                    onChange={(e) =>
                      setVendorSlug(
                        e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                      )
                    }
                    placeholder={slugify(studioName) || "nama-vendor"}
                    readOnly={slugInputReadOnly}
                    aria-readonly={slugInputReadOnly}
                    className={`${inputClass} ${
                      slugInputReadOnly
                        ? "bg-muted/60 text-muted-foreground cursor-not-allowed"
                        : ""
                    }`}
                  />
                  <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md break-all">
                    <span className="text-primary font-semibold">
                      {localizedFormPath}
                    </span>
                  </div>
                  <a
                    href={`/${locale}/settings/custom-domain`}
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {tp("customDomainPromo")}
                  </a>
                  {Boolean(tenantDomain) && (
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">
                            {tp("disableBookingSlugLabel")}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {tp("disableBookingSlugHint")}
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={disableBookingSlug}
                          disabled={
                            !canEditTenantBookingMode ||
                            bookingModeSaving ||
                            isMainTenantDomain
                          }
                          onClick={() => {
                            const previousValue = disableBookingSlug;
                            const nextValue = !disableBookingSlug;
                            setDisableBookingSlug(nextValue);
                            void updateTenantBookingMode(nextValue, previousValue);
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            disableBookingSlug ? "bg-primary" : "bg-muted"
                          } ${
                            canEditTenantBookingMode &&
                            !bookingModeSaving &&
                            !isMainTenantDomain
                              ? "cursor-pointer"
                              : "cursor-not-allowed opacity-60"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                              disableBookingSlug ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                      {isMainTenantDomain && (
                        <p className="text-[11px] text-muted-foreground">
                          {tp("bookingSlugMainDomainNote")}
                        </p>
                      )}
                      {!isMainTenantDomain && !canEditTenantBookingMode && (
                        <p className="text-[11px] text-muted-foreground">
                          {tp("disableBookingSlugAdminOnly")}
                        </p>
                      )}
                      {disableBookingSlug && (
                        <p className="text-[11px] text-muted-foreground">
                          {tp("disableBookingSlugMappedVendor", {
                            slug: sluglessDefaultVendorSlug || "-",
                          })}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Logo Studio */}
                <div className="space-y-4 pt-2 border-t">
                  <div>
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <ImagePlus className="w-3.5 h-3.5" /> {tp("logoStudio")}
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tp("logoDesc")}
                    </p>
                  </div>

                  {/* 1. Orientation */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {tp("orientation")}
                    </span>
                    <div className="flex rounded-lg border border-input overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setLogoOrientation("horizontal")}
                        className={`px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${logoOrientation === "horizontal" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}`}
                      >
                        {tp("horizontal")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setLogoOrientation("square")}
                        className={`px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${logoOrientation === "square" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}`}
                      >
                        {tp("square")}
                      </button>
                    </div>
                  </div>

                  {/* 2. Preview */}
                  {logoUrl && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">
                        {tp("preview")}
                      </p>
                      <div
                        className={`rounded-xl border bg-muted/20 overflow-hidden flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all ${logoOrientation === "horizontal" ? "w-64 h-32" : "w-40 h-40"}`}
                        onClick={() => setLogoLightboxOpen(true)}
                        title={tp("clickToEnlarge")}
                      >
                        <img
                          src={logoUrl}
                          alt="Logo"
                          className="w-full h-full object-contain p-2"
                        />
                      </div>
                      {/* 3. Delete */}
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> {tp("deleteLogo")}
                      </button>
                    </div>
                  )}

                  {/* 4. Upload */}
                  <div>
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleLogoFileSelected(file);
                      }}
                      onClick={() => logoInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"}`}
                    >
                      <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {logoUrl ? tp("uploadReplace") : tp("uploadNew")}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {tp("uploadHint")}
                      </p>
                    </div>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0])
                          handleLogoFileSelected(e.target.files[0]);
                        e.target.value = "";
                      }}
                    />
                    {logoUploading && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
                        <Loader2 className="w-3 h-3 animate-spin" />{" "}
                        {tp("uploading")}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {tp("studioAddressLabel")}
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {tp("studioAddressDesc")}
                    </p>
                    <textarea
                      value={studioAddress}
                      onChange={(e) => setStudioAddress(e.target.value)}
                      rows={3}
                      className={textareaClass}
                      placeholder={tp("studioAddressPlaceholder")}
                    />
                  </div>
                </div>

                </div>
                </div>
              </>
            )}

            {activeTab === "seo" && (
              <>
                {renderSeoSectionCard({
                  section: "global",
                  title: tp("seoGlobalTitle"),
                  description: tp("seoGlobalDescription"),
                })}
                {renderSeoSectionCard({
                  section: "form",
                  title: tp("seoFormTitle"),
                  description: tp("seoFormDescription"),
                })}
                {renderSeoSectionCard({
                  section: "track",
                  title: tp("seoTrackTitle"),
                  description: tp("seoTrackDescription"),
                })}
                {renderSeoSectionCard({
                  section: "settlement",
                  title: tp("seoSettlementTitle"),
                  description: tp("seoSettlementDescription"),
                })}
              </>
            )}

            {activeTab === "daftar-booking" && (
              <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                <div className="px-6 py-4 border-b">
                  <h3 className="font-semibold flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />{" "}
                    {tp("bookingListSettingsTitle")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {tp("bookingListSettingsDesc")}
                  </p>
                </div>
                <div className="p-6 space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" />{" "}
                      {tp("waPrimaryActionLabel")}
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {tp("waPrimaryActionDesc")}
                    </p>
                    <div className="flex rounded-lg border border-input overflow-hidden w-fit">
                      <button
                        type="button"
                        onClick={() => setDefaultWaTarget("client")}
                        className={`px-4 py-1.5 text-xs font-medium transition-colors cursor-pointer ${defaultWaTarget === "client" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}`}
                      >
                        {tp("waTargetClient")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDefaultWaTarget("freelancer")}
                        className={`px-4 py-1.5 text-xs font-medium transition-colors cursor-pointer ${defaultWaTarget === "freelancer" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}`}
                      >
                        {tp("waTargetFreelancer")}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 border-t pt-4">
                    <label className="flex items-start gap-3 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bookingTableColorEnabled}
                        onChange={(event) =>
                          setBookingTableColorEnabled(event.target.checked)
                        }
                        className="mt-0.5 accent-primary"
                      />
                      <span>
                        <span className="font-medium block">
                          {tp("bookingTableColorToggleLabel")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {tp("bookingTableColorToggleDesc")}
                        </span>
                      </span>
                    </label>

                    <label className="flex items-start gap-3 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={financeTableColorEnabled}
                        onChange={(event) =>
                          setFinanceTableColorEnabled(event.target.checked)
                        }
                        className="mt-0.5 accent-primary"
                      />
                      <span>
                        <span className="font-medium block">
                          {tp("financeTableColorToggleLabel")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {tp("financeTableColorToggleDesc")}
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "google" && (
              <>
                {/* Google Integration Section */}
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
              <div className="px-6 py-4 border-b">
                <h3 className="font-semibold flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  {tp("googleIntegration")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {tp("googleIntegrationDesc")}
                </p>
              </div>
              <div className="p-6 space-y-4">
                {/* Google Calendar */}
                <div
                  className="p-4 rounded-lg border bg-muted/30"
                  data-onboarding-target="settings-google-calendar"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white dark:bg-white/10 flex items-center justify-center border">
                      <GoogleCalendarLogo className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {tp("googleCalendar")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tp("googleCalendarDesc")}
                      </p>
                    </div>
                  </div>
                  <div className="border-t mt-3 pt-3 flex items-center justify-between">
                    {isCalendarConnected ? (
                      <>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] text-muted-foreground">
                            {tp("connectedAs")}{" "}
                            {loadingConnectedAccountInfo
                              ? locale === "en"
                                ? "Loading..."
                                : "Memuat..."
                              : calendarConnectedEmail ||
                                tp("connectedEmailUnavailable")}
                          </span>
                          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />{" "}
                            {tp("connected")}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                          onClick={() =>
                            setDisconnectModal({
                              open: true,
                              service: "calendar",
                            })
                          }
                        >
                          <Unlink className="w-3.5 h-3.5" /> {tp("disconnect")}
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" />{" "}
                          {tp("notConnected")}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => openGoogleConnectPopup("calendar")}
                        >
                          <Link2 className="w-3.5 h-3.5" /> {tp("connect")}
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {isCalendarConnected && (
                  <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
                    <div>
                      <p className="text-sm font-medium">
                        Format Nama Event Calendar
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Bisa dibedakan per tipe acara. Jika format tipe acara
                        kosong, sistem akan pakai format Umum.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Tipe Acara
                      </label>
                      <select
                        value={selectedCalendarEventType}
                        onChange={(e) =>
                          setSelectedCalendarEventType(e.target.value)
                        }
                        className={selectClass}
                      >
                        {availableEventTypes.map((et) => (
                          <option key={et} value={et}>
                            {et === "Umum" ? tp(`event${et}` as any) : et}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      ref={calendarFormatInputRef}
                      value={currentCalendarFormat}
                      onChange={(e) =>
                        updateCalendarFormat(
                          selectedCalendarEventType,
                          e.target.value,
                        )
                      }
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder={DEFAULT_CALENDAR_EVENT_FORMAT}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {calendarTemplateVariables.map((token) => (
                        <button
                          key={token}
                          type="button"
                          onClick={() =>
                            insertIntoInput(
                              calendarFormatInputRef,
                              token,
                              currentCalendarFormat,
                              (value) =>
                                updateCalendarFormat(
                                  selectedCalendarEventType,
                                  value,
                                ),
                            )
                          }
                          className="text-[11px] px-2 py-1 rounded-md border bg-muted/50 text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                        >
                          {token.replace(/\{\{|\}\}/g, "")}
                        </button>
                      ))}
                    </div>
                    <div className="rounded-md border bg-background/80 px-4 py-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Preview Event Calendar
                      </p>
                      <p className="text-sm text-foreground/90">
                        {calendarEventPreview}
                      </p>
                    </div>
                    <div className="space-y-2 rounded-lg border bg-background/80 p-4">
                      <div>
                        <p className="text-sm font-medium">
                          Deskripsi Event Calendar
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Deskripsi ini dipakai saat event kalender dibuat dan
                          saat tim di-update.
                        </p>
                      </div>
                      {supportedCalendarDescriptionModes.length > 1 && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">
                            {tp("templateMode")}
                          </label>
                          <select
                            value={activeCalendarDescriptionMode}
                            onChange={(e) =>
                              setSelectedCalendarDescriptionMode(
                                normalizeGoogleCalendarTemplateMode(
                                  e.target.value,
                                ),
                              )
                            }
                            className={selectClass}
                          >
                            <option value="normal">
                              {tp("templateModeNormal")}
                            </option>
                            <option value="split">
                              {tp("templateModeSplit")}
                            </option>
                          </select>
                        </div>
                      )}
                      <textarea
                        ref={calendarDescriptionInputRef}
                        value={currentCalendarDescription}
                        onChange={(e) =>
                          updateCalendarDescription(
                            selectedCalendarEventType,
                            e.target.value,
                            activeCalendarDescriptionMode,
                          )
                        }
                        rows={5}
                        className="placeholder:text-muted-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-y"
                        placeholder={getDefaultCalendarEventDescriptionByMode({
                          eventType: selectedCalendarEventType,
                          mode: activeCalendarDescriptionMode,
                        })}
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {calendarTemplateVariables.map((token) => (
                          <button
                            key={`description-${token}`}
                            type="button"
                            onClick={() =>
                              insertIntoInput(
                                calendarDescriptionInputRef,
                                token,
                                currentCalendarDescription,
                                (value) =>
                                  updateCalendarDescription(
                                    selectedCalendarEventType,
                                    value,
                                    activeCalendarDescriptionMode,
                                  ),
                              )
                            }
                            className="text-[11px] px-2 py-1 rounded-md border bg-muted/50 text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                          >
                            {token.replace(/\{\{|\}\}/g, "")}
                          </button>
                        ))}
                      </div>
                      <div className="rounded-md border bg-muted/20 px-4 py-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Preview Deskripsi Calendar
                        </p>
                        <pre className="whitespace-pre-wrap text-sm text-foreground/90 font-sans">
                          {calendarDescriptionPreview}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                {/* Google Drive */}
                <div
                  className="p-4 rounded-lg border bg-muted/30"
                  data-onboarding-target="settings-google-drive"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white dark:bg-white/10 flex items-center justify-center border">
                      <GoogleDriveLogo className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{tp("googleDrive")}</p>
                      <p className="text-xs text-muted-foreground">
                        {tp("googleDriveDesc")}
                      </p>
                    </div>
                  </div>
                  <div className="border-t mt-3 pt-3 flex items-center justify-between">
                    {isDriveConnected ? (
                      <>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] text-muted-foreground">
                            {tp("connectedAs")}{" "}
                            {loadingConnectedAccountInfo
                              ? locale === "en"
                                ? "Loading..."
                                : "Memuat..."
                              : driveConnectedEmail ||
                                tp("connectedEmailUnavailable")}
                          </span>
                          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />{" "}
                            {tp("connected")}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                          onClick={() =>
                            setDisconnectModal({ open: true, service: "drive" })
                          }
                        >
                          <Unlink className="w-3.5 h-3.5" /> {tp("disconnect")}
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" />{" "}
                          {tp("notConnected")}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => openGoogleConnectPopup("drive")}
                        >
                          <Link2 className="w-3.5 h-3.5" /> {tp("connect")}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {isDriveConnected && (
                  <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
                    <div>
                      <p className="text-sm font-medium">
                        Format Nama Folder Klien
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pisahkan format folder dari koneksi Google Drive, dan
                        atur sendiri per tipe acara.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Tipe Acara
                      </label>
                      <select
                        value={selectedDriveEventType}
                        onChange={(e) =>
                          setSelectedDriveEventType(e.target.value)
                        }
                        className={selectClass}
                      >
                        {availableEventTypes.map((et) => (
                          <option key={et} value={et}>
                            {et === "Umum" ? tp(`event${et}` as any) : et}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      ref={driveFormatInputRef}
                      value={currentDriveFormat}
                      onChange={(e) =>
                        updateDriveFormat(
                          selectedDriveEventType,
                          e.target.value,
                        )
                      }
                      placeholder={DEFAULT_DRIVE_FOLDER_FORMAT}
                      className="placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {driveTemplateVariables.map((token) => (
                        <button
                          key={token}
                          type="button"
                          onClick={() =>
                            insertIntoInput(
                              driveFormatInputRef,
                              token,
                              currentDriveFormat,
                              (value) =>
                                updateDriveFormat(
                                  selectedDriveEventType,
                                  value,
                                ),
                            )
                          }
                          className="text-[11px] px-2 py-1 rounded-md border bg-muted/50 text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                        >
                          {token.replace(/\{|\}/g, "")}
                        </button>
                      ))}
                    </div>
                    <div className="rounded-md border bg-background/80 px-4 py-3 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Preview Folder Klien
                      </p>
                      <p className="text-sm text-foreground/90">
                        {driveFolderPreview}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Fallback lama: Data Booking Client Desk &gt;{" "}
                        <strong>{driveFolderPreview}</strong>
                      </p>
                    </div>
                    <div className="rounded-lg border bg-background/80 p-4 space-y-3">
                      <div>
                        <p className="text-sm font-medium">
                          Struktur Folder Bertingkat
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Atur urutan folder sebelum masuk ke folder klien. Bisa
                          dibuat beda per tipe acara.
                        </p>
                      </div>
                      <div className="space-y-2">
                        {getDriveSegments(selectedDriveEventType).map(
                          (segment, index, arr) => (
                            <div
                              key={`${selectedDriveEventType}-${index}`}
                              className="flex items-center gap-2"
                            >
                              <input
                                value={segment}
                                onChange={(e) =>
                                  updateDriveSegments(
                                    selectedDriveEventType,
                                    (segments) =>
                                      segments.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? e.target.value
                                          : item,
                                      ),
                                  )
                                }
                                placeholder="{client_name}"
                                className={inputClass}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={index === 0}
                                onClick={() =>
                                  updateDriveSegments(
                                    selectedDriveEventType,
                                    (segments) => {
                                      const next = [...segments];
                                      [next[index - 1], next[index]] = [
                                        next[index],
                                        next[index - 1],
                                      ];
                                      return next;
                                    },
                                  )
                                }
                              >
                                ↑
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={index === arr.length - 1}
                                onClick={() =>
                                  updateDriveSegments(
                                    selectedDriveEventType,
                                    (segments) => {
                                      const next = [...segments];
                                      [next[index + 1], next[index]] = [
                                        next[index],
                                        next[index + 1],
                                      ];
                                      return next;
                                    },
                                  )
                                }
                              >
                                ↓
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={arr.length <= 1}
                                onClick={() =>
                                  updateDriveSegments(
                                    selectedDriveEventType,
                                    (segments) =>
                                      segments.filter(
                                        (_, itemIndex) => itemIndex !== index,
                                      ),
                                  )
                                }
                              >
                                Hapus
                              </Button>
                            </div>
                          ),
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {driveTemplateVariables.map((token) => (
                          <button
                            key={`segment-${token}`}
                            type="button"
                            onClick={() =>
                              setNewDriveSegment((prev) => `${prev}${token}`)
                            }
                            className="text-[11px] px-2 py-1 rounded-md border bg-muted/50 text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                          >
                            {token.replace(/\{|\}/g, "")}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          value={newDriveSegment}
                          onChange={(e) => setNewDriveSegment(e.target.value)}
                          placeholder={tp("driveSegmentExamplePlaceholder", {
                            year: currentYear,
                          })}
                          className={inputClass}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const value = newDriveSegment.trim();
                            if (!value) return;
                            updateDriveSegments(
                              selectedDriveEventType,
                              (segments) => [...segments, value],
                            );
                            setNewDriveSegment("");
                          }}
                        >
                          Tambah
                        </Button>
                      </div>
                      <div className="rounded-md border bg-muted/20 px-4 py-3 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          Preview Folder Bertingkat
                        </p>
                        <p className="text-sm text-foreground/90">
                          Data Booking Client Desk &gt;{" "}
                          {driveFolderStructurePreview || "{client_name}"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
              </>
            )}
            {activeTab === "fastpik" && (
              <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                <div className="px-6 py-4 border-b">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Link2 className="w-4 h-4" /> {tp("fastpikIntegrationTitle")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {tp("fastpikIntegrationDesc")}
                  </p>
                </div>
                <div className="p-6 space-y-5">
                  <div className="rounded-lg border bg-muted/20 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {tp("fastpikIntegrationStatus")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fastpikIntegrationEnabled
                          ? tp("connected")
                          : tp("notConnected")}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {tp("fastpikToggleHint")}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={fastpikIntegrationEnabled}
                      onClick={() =>
                        setFastpikIntegrationEnabled((prev) => !prev)
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                        fastpikIntegrationEnabled ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                          fastpikIntegrationEnabled
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        {tp("fastpikSyncMode")}
                      </label>
                      <select
                        value={fastpikSyncMode}
                        onChange={(e) =>
                          setFastpikSyncMode(
                            e.target.value === "auto" ? "auto" : "manual",
                          )
                        }
                        className={selectClass}
                      >
                        <option value="manual">{tp("fastpikSyncManual")}</option>
                        <option value="auto">{tp("fastpikSyncAuto")}</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        {tp("fastpikPresetSource")}
                      </label>
                      <select
                        value={fastpikPresetSource}
                        onChange={(e) =>
                          setFastpikPresetSource(
                            e.target.value === "fastpik"
                              ? "fastpik"
                              : "clientdesk",
                          )
                        }
                        className={selectClass}
                      >
                        <option value="clientdesk">
                          {tp("fastpikPresetClientdesk")}
                        </option>
                        <option value="fastpik">
                          {tp("fastpikPresetFastpik")}
                        </option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      {tp("fastpikApiKey")}
                    </label>
                    <input
                      type="password"
                      value={fastpikApiKey}
                      onChange={(e) => setFastpikApiKey(e.target.value)}
                      placeholder="fpk_xxx.yyy"
                      className={inputClass}
                    />
                    <p className="text-xs text-muted-foreground">
                      {tp("fastpikApiKeyHint")}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      {tp("fastpikLinkDisplayModeBookingDetail")}
                    </label>
                    <select
                      value={fastpikLinkDisplayModeBookingDetail}
                      onChange={(e) =>
                        setFastpikLinkDisplayModeBookingDetail(
                          normalizeFastpikLinkDisplayMode(e.target.value),
                        )
                      }
                      className={selectClass}
                    >
                      <option value="both">{tp("fastpikLinkModeBoth")}</option>
                      <option value="prefer_fastpik">
                        {tp("fastpikLinkModePreferFastpik")}
                      </option>
                      <option value="drive_only">
                        {tp("fastpikLinkModeDriveOnly")}
                      </option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      {tp("fastpikLinkDisplayModeBookingDetailHint")}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      {tp("fastpikLinkDisplayModeTracking")}
                    </label>
                    <select
                      value={fastpikLinkDisplayModeTracking}
                      onChange={(e) =>
                        setFastpikLinkDisplayModeTracking(
                          normalizeFastpikLinkDisplayMode(e.target.value),
                        )
                      }
                      className={selectClass}
                    >
                      <option value="both">{tp("fastpikLinkModeBoth")}</option>
                      <option value="prefer_fastpik">
                        {tp("fastpikLinkModePreferFastpik")}
                      </option>
                      <option value="drive_only">
                        {tp("fastpikLinkModeDriveOnly")}
                      </option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      {tp("fastpikLinkDisplayModeTrackingHint")}
                    </p>
                  </div>

                  {fastpikPresetSource === "clientdesk" && (
                    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                      <p className="text-sm font-medium">
                        {tp("fastpikDefaultsTitle")}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className="text-xs text-muted-foreground">
                            {tp("fastpikDefaultMaxPhotos")}
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={fastpikDefaultMaxPhotos}
                            onChange={(e) =>
                              setFastpikDefaultMaxPhotos(Number(e.target.value))
                            }
                            className={inputClass}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs text-muted-foreground">
                            {tp("fastpikDefaultSelectionDays")}
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={fastpikDefaultSelectionDays}
                            onChange={(e) =>
                              setFastpikDefaultSelectionDays(
                                Number(e.target.value),
                              )
                            }
                            className={inputClass}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs text-muted-foreground">
                            {tp("fastpikDefaultDownloadDays")}
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={fastpikDefaultDownloadDays}
                            onChange={(e) =>
                              setFastpikDefaultDownloadDays(
                                Number(e.target.value),
                              )
                            }
                            className={inputClass}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs text-muted-foreground">
                            {tp("fastpikDefaultPassword")}
                          </label>
                          <input
                            type="text"
                            value={fastpikDefaultPassword}
                            onChange={(e) =>
                              setFastpikDefaultPassword(e.target.value)
                            }
                            placeholder={tp("fastpikOptional")}
                            className={inputClass}
                          />
                        </div>
                      </div>
                      <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={fastpikDefaultDetectSubfolders}
                          onChange={(e) =>
                            setFastpikDefaultDetectSubfolders(e.target.checked)
                          }
                          className="accent-primary"
                        />
                        {tp("fastpikDetectSubfolders")}
                      </label>
                    </div>
                  )}

                  <div className="rounded-lg border bg-muted/10 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {tp("fastpikLastSync")}
                      </span>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full ${resolveFastpikStatusBadgeClass(fastpikLastSyncStatus)}`}
                      >
                        {fastpikLastSyncStatus}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {fastpikLastSyncAt
                        ? new Date(fastpikLastSyncAt).toLocaleString()
                        : tp("fastpikNeverSynced")}
                    </p>
                    {fastpikLastSyncMessage && (
                      <p className="text-xs text-foreground/80">
                        {fastpikLastSyncMessage}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={handleTestFastpikConnection}
                      disabled={fastpikTesting || !fastpikApiKey.trim()}
                    >
                      {fastpikTesting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      {tp("fastpikTestConnection")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={handleBatchSyncFastpik}
                      disabled={fastpikBatchSyncing || !fastpikIntegrationEnabled}
                    >
                      {fastpikBatchSyncing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4" />
                      )}
                      {tp("fastpikBatchSync")}
                    </Button>
                  </div>
                  {fastpikActionMessage && (
                    <p className="text-xs text-muted-foreground">
                      {fastpikActionMessage}
                    </p>
                  )}
                </div>
              </div>
            )}
            <div className="pt-1">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  disabled={saving}
                  onClick={
                    activeTab === "google"
                      ? handleSaveGoogleSettings
                      : activeTab === "fastpik"
                        ? handleSaveFastpikSettings
                        : activeTab === "seo"
                          ? handleSaveSeoSettings
                        : activeTab === "daftar-booking"
                          ? handleSaveBookingListSettings
                        : handleSaveGeneralSettings
                  }
                  className={unifiedSaveButtonClass}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Simpan Semua
                </Button>
                {activeTab === "google" && (
                  <Button
                    type="button"
                    variant="outline"
                    className={unifiedResetButtonClass}
                    onClick={() =>
                      setResetModal({ open: true, scope: "google" })
                    }
                    disabled={resetSaving}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Balik ke Default
                  </Button>
                )}
                {savedMsg && (
                  <span className="text-sm text-green-600 dark:text-green-400">
                    {savedMsg}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: Template Pesan ═══ */}
        {activeTab === "template" && (
          <div className="space-y-6">
            {templateTypes.map((tt) => renderTemplateCard(tt))}
            <div className="pt-1">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  disabled={templateSaving}
                  onClick={handleSaveAllTemplates}
                  className={unifiedSaveButtonClass}
                >
                  {templateSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Simpan Semua
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={unifiedResetButtonClass}
                  onClick={() =>
                    setResetModal({ open: true, scope: "template" })
                  }
                  disabled={resetSaving}
                >
                  <RotateCcw className="w-4 h-4" />
                  Balik ke Default
                </Button>
                {templateSavedMsg && (
                  <span className="text-sm text-green-600 dark:text-green-400">
                    {templateSavedMsg}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: Keuangan ═══ */}
        {activeTab === "keuangan" && isTenantAdmin && (
          <div className="space-y-6">
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
              <div className="flex flex-col gap-3 border-b px-6 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-semibold">Template Biaya Operasional</h3>
                  <p className="text-sm text-muted-foreground">
                    Siapkan preset biaya internal untuk dipakai cepat di edit booking admin.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={addOperationalCostTemplate}
                >
                  <Plus className="h-4 w-4" />
                  Tambah Template
                </Button>
              </div>
              <div className="space-y-4 p-6">
                {operationalCostTemplates.length === 0 ? (
                  <div className="rounded-lg border border-dashed bg-muted/10 px-4 py-5 text-sm text-muted-foreground">
                    Belum ada template biaya operasional.
                  </div>
                ) : (
                  operationalCostTemplates.map((template, templateIndex) => (
                    <div key={template.id} className="rounded-lg border bg-muted/10 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">
                            Nama Template
                          </label>
                          <input
                            value={template.name}
                            onChange={(event) =>
                              updateOperationalCostTemplateName(
                                template.id,
                                event.target.value,
                              )
                            }
                            placeholder={`Template ${templateIndex + 1}`}
                            className={inputClass}
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => addOperationalCostTemplateItem(template.id)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Tambah Item
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => removeOperationalCostTemplate(template.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {template.items.length === 0 ? (
                          <div className="rounded-md border border-dashed bg-background/70 px-3 py-3 text-xs text-muted-foreground">
                            Belum ada item biaya di template ini.
                          </div>
                        ) : (
                          template.items.map((item, itemIndex) => (
                            <div
                              key={item.id}
                              className="grid gap-3 rounded-md border bg-background p-3 md:grid-cols-[minmax(0,1fr)_220px_auto]"
                            >
                              <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">
                                  Nama Biaya {itemIndex + 1}
                                </label>
                                <input
                                  value={item.label}
                                  onChange={(event) =>
                                    updateOperationalCostTemplateItem(
                                      template.id,
                                      item.id,
                                      "label",
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Contoh: Biaya Freelance"
                                  className={inputClass}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">
                                  Nominal (Rp)
                                </label>
                                <div className="flex items-center gap-1.5">
                                  <span className="shrink-0 text-sm font-medium text-muted-foreground">
                                    Rp
                                  </span>
                                  <input
                                    value={formatOperationalCostAmount(item.amount)}
                                    onChange={(event) =>
                                      updateOperationalCostTemplateItem(
                                        template.id,
                                        item.id,
                                        "amount",
                                        event.target.value,
                                      )
                                    }
                                    inputMode="numeric"
                                    placeholder="0"
                                    className={`${inputClass} flex-1`}
                                  />
                                </div>
                              </div>
                              <div className="flex items-end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() =>
                                    removeOperationalCostTemplateItem(template.id, item.id)
                                  }
                                  aria-label={`Hapus item biaya ${itemIndex + 1}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="pt-1">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveOperationalCostTemplates}
                  className={unifiedSaveButtonClass}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Simpan Semua
                </Button>
                {savedMsg && (
                  <span className="text-sm text-green-600 dark:text-green-400">
                    {savedMsg}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: Status Booking ═══ */}
        {activeTab === "status" && (
          <>
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
              <div className="px-6 py-4 border-b">
                <h3 className="font-semibold">Status Klien (Progress)</h3>
                <p className="text-sm text-muted-foreground">
                  Atur langkah-langkah progress yang ditampilkan ke klien di
                  halaman tracking. Drag untuk urutan.
                </p>
              </div>
              <div className="p-6 space-y-4">
                <SortableConfigList
                  items={clientStatusItems}
                  onReorder={(items) =>
                    setNormalizedClientStatuses(items.map((item) => item.id))
                  }
                  onRename={(id, label) =>
                    setNormalizedClientStatuses((prev) => {
                      if (
                        id === INITIAL_BOOKING_STATUS ||
                        id === COMPLETED_BOOKING_STATUS
                      ) {
                        return prev;
                      }
                      return prev.map((status) =>
                        status === id ? label : status,
                      );
                    })
                  }
                  onDelete={(id) => {
                    if (
                      id === INITIAL_BOOKING_STATUS ||
                      id === COMPLETED_BOOKING_STATUS
                    ) {
                      return;
                    }
                    if (customClientStatuses.length <= 2) {
                      showFeedback(tp("minimumClientStatuses"));
                      return;
                    }
                    setNormalizedClientStatuses((prev) =>
                      prev.filter((status) => status !== id),
                    );
                  }}
                />

                <div className="flex items-center gap-2">
                  <input
                    value={newClientStatusName}
                    onChange={(e) => setNewClientStatusName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newClientStatusName.trim()) {
                        setNormalizedClientStatuses([
                          ...customClientStatuses,
                          newClientStatusName.trim(),
                        ]);
                        setNewClientStatusName("");
                      }
                    }}
                    placeholder={tp("newClientStatusPlaceholder")}
                    className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!newClientStatusName.trim()}
                    onClick={() => {
                      if (newClientStatusName.trim()) {
                        setNormalizedClientStatuses([
                          ...customClientStatuses,
                          newClientStatusName.trim(),
                        ]);
                        setNewClientStatusName("");
                      }
                    }}
                    className="gap-1"
                  >
                    <Plus className="w-4 h-4" /> Tambah
                  </Button>
                </div>

                {/* Queue trigger setting */}
                <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
                  <p className="text-sm font-medium">Trigger Auto-Queue</p>
                  <p className="text-xs text-muted-foreground">
                    Pilih status klien yang akan otomatis men-trigger antrian
                    (posisi antrian otomatis terisi saat klien masuk ke status
                    ini).
                  </p>
                  <select
                    value={queueTriggerStatus}
                    onChange={(e) => setQueueTriggerStatus(e.target.value)}
                    className={`${selectClass} max-w-xs text-sm`}
                  >
                    <option value="">Off (Tidak ada trigger)</option>
                    {customClientStatuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
                  <p className="text-sm font-medium">
                    Trigger Auto-DP Terverifikasi
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pilih status klien yang otomatis menandai DP sebagai
                    terverifikasi saat booking masuk ke status ini.
                  </p>
                  <select
                    value={resolveDpVerifyTriggerStatus(
                      customClientStatuses,
                      dpVerifyTriggerStatus,
                    )}
                    onChange={(e) => setDpVerifyTriggerStatus(e.target.value)}
                    className={`${selectClass} max-w-xs text-sm`}
                  >
                    <option value="">(Tidak ada trigger)</option>
                    {customClientStatuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      Trigger Otomatis Saat Jam Sesi Tiba
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Booking otomatis pindah status saat jam sesi sudah tiba.
                      Untuk booking split, semua jam sesi valid diperiksa dan
                      trigger jalan saat sesi pertama yang sudah due tercapai.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        Dari status
                      </span>
                      <select
                        value={resolveOptionalClientProgressStatus(
                          customClientStatuses,
                          sessionTimeTriggerFromStatus,
                        )}
                        onChange={(e) =>
                          setSessionTimeTriggerFromStatus(e.target.value)
                        }
                        className={`${selectClass} text-sm`}
                      >
                        <option value="">Off (Tidak ada trigger)</option>
                        {customClientStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        Ke status
                      </span>
                      <select
                        value={resolveOptionalClientProgressStatus(
                          customClientStatuses,
                          sessionTimeTriggerToStatus,
                        )}
                        onChange={(e) =>
                          setSessionTimeTriggerToStatus(e.target.value)
                        }
                        className={`${selectClass} text-sm`}
                      >
                        <option value="">Off (Tidak ada trigger)</option>
                        {customClientStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
                  <p className="text-sm font-medium">
                    {tp("finalInvoiceVisibilityTitle")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tp("finalInvoiceVisibilityDescription")}
                  </p>
                  <select
                    value={resolveFinalInvoiceVisibleFromStatus(
                      customClientStatuses,
                      finalInvoiceVisibleFromStatus,
                    )}
                    onChange={(e) =>
                      setFinalInvoiceVisibleFromStatus(e.target.value)
                    }
                    className={`${selectClass} max-w-xs text-sm`}
                  >
                    {(customClientStatuses.length > 0
                      ? customClientStatuses
                      : [
                          getDefaultFinalInvoiceVisibleFromStatus(
                            customClientStatuses,
                          ),
                        ]
                    ).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
                  <p className="text-sm font-medium">
                    {tp("fileLinkVisibilityTitle")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tp("fileLinkVisibilityDescription")}
                  </p>
                  <select
                    value={resolveTrackingFileLinksVisibleFromStatus(
                      customClientStatuses,
                      trackingFileLinksVisibleFromStatus,
                    )}
                    onChange={(e) =>
                      setTrackingFileLinksVisibleFromStatus(e.target.value)
                    }
                    className={`${selectClass} max-w-xs text-sm`}
                  >
                    {(customClientStatuses.length > 0
                      ? customClientStatuses
                      : [
                          getDefaultTrackingFileLinksVisibleFromStatus(
                            customClientStatuses,
                          ),
                        ]
                    ).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
                  <p className="text-sm font-medium">
                    {tp("videoLinkVisibilityTitle")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tp("videoLinkVisibilityDescription")}
                  </p>
                  <select
                    value={resolveTrackingVideoLinksVisibleFromStatus(
                      customClientStatuses,
                      trackingVideoLinksVisibleFromStatus,
                    )}
                    onChange={(e) =>
                      setTrackingVideoLinksVisibleFromStatus(e.target.value)
                    }
                    className={`${selectClass} max-w-xs text-sm`}
                  >
                    {(customClientStatuses.length > 0
                      ? customClientStatuses
                      : [
                          getDefaultTrackingVideoLinksVisibleFromStatus(
                            customClientStatuses,
                          ),
                        ]
                    ).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
                  <label className="flex items-start gap-3 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trackingHideQueueNumber}
                      onChange={(event) =>
                        setTrackingHideQueueNumber(event.target.checked)
                      }
                      className="mt-0.5 accent-primary"
                    />
                    <span>
                      <span className="font-medium block">
                        {tp("hideQueueNumberVisibilityTitle")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {tp("hideQueueNumberVisibilityDescription")}
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            </div>
            <div className="pt-1">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  disabled={statusSaving}
                  onClick={handleSaveStatuses}
                  className={unifiedSaveButtonClass}
                >
                  {statusSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Simpan Semua
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={unifiedResetButtonClass}
                  onClick={() => setResetModal({ open: true, scope: "status" })}
                  disabled={resetSaving}
                >
                  <RotateCcw className="w-4 h-4" />
                  Balik ke Default
                </Button>
                {statusSaved && (
                  <span className="text-sm text-green-600 dark:text-green-400">
                    {settingsSavedMessage}
                  </span>
                )}
              </div>
            </div>
          </>
        )}

        {/* ═══ TAB: Tipe Acara ═══ */}
        {activeTab === "jenis-acara" && (
          <div className="space-y-6">
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
              <div className="px-6 py-4 border-b">
                <h3 className="font-semibold flex items-center gap-2">
                  <Globe className="w-4 h-4" /> Tipe Acara Global
                </h3>
                <p className="text-sm text-muted-foreground">
                  Kelola urutan, aktif/nonaktif, dan custom tipe acara dari
                  sini. Berlaku untuk form booking, paket, template, dan
                  filter.
                </p>
              </div>
              <div className="p-6 space-y-4">
                <SortableConfigList
                  items={eventTypeItems}
                  onReorder={reorderEventTypes}
                  onRename={renameEventType}
                  onToggleActive={toggleEventTypeActive}
                  onDelete={removeEventType}
                />
                <div className="flex items-center gap-2">
                  <input
                    value={newCustomEventType}
                    onChange={(e) => setNewCustomEventType(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      const value = normalizeEventTypeName(newCustomEventType);
                      if (!value || availableEventTypes.includes(value)) return;
                      setCustomEventTypes((prev) => [...prev, value]);
                      setActiveEventTypes((prev) =>
                        Array.from(new Set([...prev, value])),
                      );
                      setNewCustomEventType("");
                    }}
                    placeholder="Tambah tipe acara custom..."
                    className={inputClass}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const value = normalizeEventTypeName(newCustomEventType);
                      if (!value || availableEventTypes.includes(value)) return;
                      setCustomEventTypes((prev) => [...prev, value]);
                      setActiveEventTypes((prev) =>
                        Array.from(new Set([...prev, value])),
                      );
                      setNewCustomEventType("");
                    }}
                  >
                    Tambah
                  </Button>
                </div>
                <div className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  Tipe acara bawaan bisa diurutkan dan
                  diaktifkan/nonaktifkan. Tipe acara custom bisa ditambah,
                  diubah nama, dihapus, dan diurutkan.
                </div>
              </div>
            </div>
            <div className="pt-1">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  disabled={eventTypeSaving}
                  onClick={handleSaveEventTypes}
                  className={unifiedSaveButtonClass}
                >
                  {eventTypeSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Simpan Semua
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={unifiedResetButtonClass}
                  onClick={() =>
                    setResetModal({ open: true, scope: "jenis-acara" })
                  }
                  disabled={resetSaving}
                >
                  <RotateCcw className="w-4 h-4" />
                  Balik ke Default
                </Button>
                {eventTypeSaved && (
                  <span className="text-sm text-green-600 dark:text-green-400">
                    {settingsSavedMessage}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: Bot Telegram ═══ */}
        {activeTab === "telegram" && (
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
            <div className="px-6 py-4 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <Bot className="w-4 h-4" />
                {tp("telegramTitle")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {tp("telegramDesc")}
              </p>
            </div>
            <div className="p-6 space-y-6">
              <div className="rounded-lg border bg-muted/10 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-medium">
                      {tp("telegramNotificationStatus")}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {tp("telegramToggleHint")}
                    </p>
                  </div>
                  <Switch
                    checked={telegramNotificationsEnabled}
                    onCheckedChange={(checked) =>
                      setTelegramNotificationsEnabled(checked)
                    }
                    aria-label={tp("telegramNotificationStatus")}
                  />
                </div>
              </div>

              <div className="rounded-lg border bg-muted/10 p-4 space-y-4">
                <p className="text-sm font-medium text-center">
                  {tp("telegramSetupGuideTitle")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <a
                    href="https://t.me/userinfo3bot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center text-center group"
                  >
                    <span className="relative mb-2">
                      <span className="w-16 h-16 rounded-full bg-background border-2 border-muted-foreground/20 flex items-center justify-center group-hover:border-primary transition-colors">
                        <Search className="w-7 h-7 text-muted-foreground group-hover:text-primary transition-colors" />
                      </span>
                      <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center">
                        1
                      </span>
                    </span>
                    <span className="text-sm font-semibold">
                      {tp("telegramSetupGuideChatIdTitle")}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {tp("telegramSetupGuideChatIdDesc")}
                    </span>
                  </a>
                  <a
                    href="https://t.me/Clientdesks_bot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center text-center group"
                  >
                    <span className="relative mb-2">
                      <span className="w-16 h-16 rounded-full bg-background border-2 border-muted-foreground/20 flex items-center justify-center group-hover:border-primary transition-colors">
                        <Bot className="w-7 h-7 text-muted-foreground group-hover:text-primary transition-colors" />
                      </span>
                      <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center">
                        2
                      </span>
                    </span>
                    <span className="text-sm font-semibold">
                      {tp("telegramSetupGuideBotTitle")}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {tp("telegramSetupGuideBotDesc")}
                    </span>
                  </a>
                  <div className="flex flex-col items-center text-center">
                    <span className="relative mb-2">
                      <span className="w-16 h-16 rounded-full bg-background border-2 border-muted-foreground/20 flex items-center justify-center">
                        <ClipboardPaste className="w-7 h-7 text-muted-foreground" />
                      </span>
                      <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center">
                        3
                      </span>
                    </span>
                    <span className="text-sm font-semibold">
                      {tp("telegramSetupGuidePasteTitle")}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {tp("telegramSetupGuidePasteDesc")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">
                    {tp("telegramChatId")}
                  </label>
                  <input
                    type="text"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    placeholder={tp("telegramChatIdPlaceholder")}
                    className={inputClass}
                  />
                  <p className="text-xs text-muted-foreground">
                    {tp("telegramChatIdHint")}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">
                    {tp("telegramLanguage")}
                  </label>
                  <select
                    value={telegramLanguage}
                    onChange={(e) =>
                      setTelegramLanguage(e.target.value === "en" ? "en" : "id")
                    }
                    className={selectClass}
                  >
                    <option value="id">Indonesia</option>
                    <option value="en">English</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {tp("telegramLanguageHint")}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="rounded-lg border p-4 text-sm space-y-2">
                  <span className="flex items-center gap-2 font-medium">
                    <input
                      type="checkbox"
                      checked={telegramNotifyNewBooking}
                      onChange={(e) =>
                        setTelegramNotifyNewBooking(e.target.checked)
                      }
                      className="accent-primary"
                    />
                    {tp("telegramNotifyNewBooking")}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {tp("telegramNotifyNewBookingDesc")}
                  </span>
                </label>
                <label className="rounded-lg border p-4 text-sm space-y-2">
                  <span className="flex items-center gap-2 font-medium">
                    <input
                      type="checkbox"
                      checked={telegramNotifySettlementSubmitted}
                      onChange={(e) =>
                        setTelegramNotifySettlementSubmitted(e.target.checked)
                      }
                      className="accent-primary"
                    />
                    {tp("telegramNotifySettlement")}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {tp("telegramNotifySettlementDesc")}
                  </span>
                </label>
                <label className="rounded-lg border p-4 text-sm space-y-2">
                  <span className="flex items-center gap-2 font-medium">
                    <input
                      type="checkbox"
                      checked={telegramNotifySessionH1}
                      onChange={(e) =>
                        setTelegramNotifySessionH1(e.target.checked)
                      }
                      className="accent-primary"
                    />
                    {tp("telegramNotifySessionH1")}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {tp("telegramNotifySessionH1Desc")}
                  </span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveTelegramSettings}
                  className="h-10 gap-2 px-5 text-sm"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Simpan Semua
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={handleTestTelegramConnection}
                  disabled={telegramTesting || !telegramChatId.trim()}
                >
                  {telegramTesting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MessageSquare className="w-4 h-4" />
                  )}
                  {tp("telegramTestSend")}
                </Button>
                {telegramActionMessage && (
                  <p className="text-xs text-muted-foreground">
                    {telegramActionMessage}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Reset Confirmation Modal */}
        <Dialog
          open={resetModal.open}
          onOpenChange={(open) =>
            !open && !resetSaving && setResetModal({ open: false, scope: null })
          }
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="items-center text-center">
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center mb-2">
                <RotateCcw className="w-6 h-6 text-amber-600" />
              </div>
              <DialogTitle className="text-xl">
                {resetModal.scope
                  ? resetDialogMeta[resetModal.scope].title
                  : tp("resetToDefaultTitle")}
              </DialogTitle>
              <DialogDescription>
                {resetModal.scope
                  ? resetDialogMeta[resetModal.scope].description
                  : tp("resetToDefaultDescription")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-center gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setResetModal({ open: false, scope: null })}
                disabled={resetSaving}
              >
                {t("batal")}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleConfirmReset}
                disabled={resetSaving}
              >
                {resetSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <RotateCcw className="w-4 h-4 mr-2" />
                )}
                {tp("resetToDefault")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Disconnect Confirmation Modal */}
        <Dialog
          open={disconnectModal.open}
          onOpenChange={(o) =>
            !o && setDisconnectModal({ open: false, service: null })
          }
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="items-center text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-2">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <DialogTitle className="text-xl">
                {tp("disconnectTitle")}
              </DialogTitle>
              <DialogDescription>
                {disconnectModal.service === "calendar"
                  ? tp("disconnectCalendarDesc")
                  : tp("disconnectDriveDesc")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-center gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() =>
                  setDisconnectModal({ open: false, service: null })
                }
                disabled={isDisconnecting}
              >
                {tp("cancel") || "Cancel"}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
              >
                {isDisconnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Unlink className="w-4 h-4 mr-2" />
                )}
                {tp("yesDisconnect")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ActionFeedbackDialog
          open={feedbackDialog.open}
          onOpenChange={(open) =>
            setFeedbackDialog((prev) => ({ ...prev, open }))
          }
          title={feedbackDialog.title}
          message={feedbackDialog.message}
          confirmLabel="OK"
        />
      </div>

      {/* Logo Crop Modal */}
      {logoCropSrc && (
        <ImageCropModal
          open={showLogoCrop}
          imageSrc={logoCropSrc}
          title={`${tp("cropLogoTitle")} (${logoOrientation === "horizontal" ? tp("horizontal") : tp("square")})`}
          aspect={logoOrientation === "horizontal" ? 16 / 10 : 1}
          cropShape="rect"
          onClose={() => {
            setShowLogoCrop(false);
            setLogoCropSrc(null);
          }}
          onCropComplete={handleCroppedLogo}
        />
      )}

      {/* Logo Lightbox */}
      {logoLightboxOpen && logoUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-8 cursor-pointer"
          onClick={() => setLogoLightboxOpen(false)}
        >
          <img
            src={logoUrl}
            alt="Logo"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
