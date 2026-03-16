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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionFeedbackDialog } from "@/components/ui/action-feedback-dialog";
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
  getDriveTemplateVariables,
  normalizeTemplateFormatMap,
  resolveTemplateByEventType,
  applyCalendarTemplate,
  applyDriveTemplate,
  getCalendarTemplateVariables,
} from "@/utils/google/template";
import {
  isGoogleCalendarConnected,
  isGoogleDriveConnected,
} from "@/utils/google/connection";
import {
  getStoredTemplateName,
  getStoredTemplateType,
  resolveTemplateType,
} from "@/lib/whatsapp-template";
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
  DEFAULT_CLIENT_STATUSES,
  INITIAL_BOOKING_STATUS,
  getDefaultFinalInvoiceVisibleFromStatus,
  normalizeClientProgressStatuses,
  resolveFinalInvoiceVisibleFromStatus,
} from "@/lib/client-status";
import {
  getActiveEventTypes,
  getBuiltInEventTypes,
  getEventTypeSettings,
  mergeCustomEventTypes,
} from "@/lib/event-type-config";
import {
  SortableConfigList,
  type SortableConfigItem,
} from "@/components/ui/sortable-config-list";

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
  studio_name: string | null;
  whatsapp_number: string | null;
  vendor_slug: string | null;
  google_access_token?: string | null;
  google_refresh_token?: string | null;
  google_drive_access_token?: string | null;
  google_drive_refresh_token?: string | null;
  final_invoice_visible_from_status?: string | null;
  form_event_types?: string[] | null;
  custom_event_types?: string[] | null;
  drive_folder_structure_map?: Record<string, string[]> | null;
  form_sections?: Record<string, FormLayoutItem[]> | FormLayoutItem[] | null;
  calendar_event_description?: string | null;
  calendar_event_description_map?: Record<string, string> | null;
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

type ConnectedGoogleAccountResponse = {
  calendar?: {
    connected?: boolean;
    email?: string | null;
  };
  drive?: {
    connected?: boolean;
    email?: string | null;
  };
};

const templateTypes = [
  {
    value: "whatsapp_client",
    label: "Kirim Detail Booking ke Klien (Admin → Klien).",
  },
  {
    value: "whatsapp_freelancer",
    label: "Kirim Detail Booking ke Freelance (Admin → Freelance).",
  },
  {
    value: "whatsapp_booking_confirm",
    label: "Kirim konfirmasi booking ke Admin (Klien → Admin).",
  },
  {
    value: "invoice",
    label: "Kirim Invoice ke Klien (Admin → Klien).",
  },
  {
    value: "whatsapp_settlement_client",
    label: "Kirim Invoice Pelunasan ke Klien (Admin → Klien).",
  },
  {
    value: "whatsapp_settlement_confirm",
    label: "Kirim Konfirmasi Pelunasan ke Admin (Klien → Admin).",
  },
];

const templateTitleKeyByType: Record<string, string> = {
  whatsapp_client: "templateWAClient",
  whatsapp_freelancer: "templateWAFreelancer",
  whatsapp_booking_confirm: "templateBookingConfirm",
  invoice: "templateInvoice",
  whatsapp_settlement_client: "templateSettlementClient",
  whatsapp_settlement_confirm: "templateSettlementConfirm",
};

const templateDescKeyByType: Record<string, string> = {
  whatsapp_client: "templateWAClientDesc",
  whatsapp_freelancer: "templateWAFreelancerDesc",
  whatsapp_booking_confirm: "templateBookingConfirmDesc",
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
  invoice: "border-violet-200/80 dark:border-violet-500/30",
  whatsapp_settlement_client: "border-emerald-200/80 dark:border-emerald-500/30",
  whatsapp_settlement_confirm: "border-emerald-200/80 dark:border-emerald-500/30",
};

const DEFAULT_QUEUE_TRIGGER_STATUS = "Antrian Edit";
const DEFAULT_FINAL_INVOICE_VISIBLE_FROM_STATUS = "Sesi Foto / Acara";
const SETTINGS_SAVED_MESSAGE = "✅ Pengaturan berhasil disimpan";

const variableHints: Record<string, string[]> = {
  whatsapp_client: [
    "{{client_name}}",
    "{{booking_code}}",
    "{{session_date}}",
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
    "{{booking_code}}",
    "{{session_date}}",
    "{{service_name}}",
    "{{total_price}}",
    "{{dp_paid}}",
    "{{studio_name}}",
    "{{event_type}}",
    "{{location}}",
    "{{tracking_link}}",
  ],
  whatsapp_settlement_client: [
    "{{client_name}}",
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
    "{{client_whatsapp}}",
    "{{booking_code}}",
    "{{session_date}}",
    "{{session_time}}",
    "{{service_name}}",
    "{{studio_name}}",
    "{{event_type}}",
    "{{location}}",
    "{{location_maps_url}}",
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
  "studio_name",
  "whatsapp_number",
  "vendor_slug",
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
  "default_wa_target",
  "final_invoice_visible_from_status",
  "form_event_types",
  "custom_event_types",
  "form_sections",
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

export default function SettingsPage() {
  const supabase = createClient();
  const t = useTranslations("Settings");
  const tp = useTranslations("SettingsPage");
  const locale = useLocale();
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
  const [countryCode, setCountryCode] = React.useState("+62");
  const [waNumber, setWaNumber] = React.useState("");
  const [vendorSlug, setVendorSlug] = React.useState("");

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

  const [statusSaving, setStatusSaving] = React.useState(false);
  const [statusSaved, setStatusSaved] = React.useState(false);

  // Custom client statuses (progress)
  const [customClientStatuses, setCustomClientStatuses] = React.useState<
    string[]
  >(normalizeClientProgressStatuses(DEFAULT_CLIENT_STATUSES));
  const [newClientStatusName, setNewClientStatusName] = React.useState("");
  const [queueTriggerStatus, setQueueTriggerStatus] =
    React.useState(DEFAULT_QUEUE_TRIGGER_STATUS);
  const [finalInvoiceVisibleFromStatus, setFinalInvoiceVisibleFromStatus] =
    React.useState(DEFAULT_FINAL_INVOICE_VISIBLE_FROM_STATUS);

  // Default WA target
  const [defaultWaTarget, setDefaultWaTarget] = React.useState<
    "client" | "freelancer"
  >("client");

  // Calendar event format
  const [calendarEventFormats, setCalendarEventFormats] = React.useState<
    Record<string, string>
  >(() => normalizeTemplateFormatMap(null, DEFAULT_CALENDAR_EVENT_FORMAT));
  const [calendarEventDescriptions, setCalendarEventDescriptions] =
    React.useState<Record<string, string>>(() =>
      normalizeTemplateFormatMap(null, DEFAULT_CALENDAR_EVENT_DESCRIPTION),
    );
  const [selectedCalendarEventType, setSelectedCalendarEventType] =
    React.useState("Umum");

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
  const feedbackTitle = locale === "en" ? "Information" : "Informasi";
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
  const eventTypeItems = React.useMemo<SortableConfigItem[]>(
    () =>
      eventTypeSettings.map((item) => ({
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
      })),
    [eventTypeSettings],
  );
  const clientStatusItems = React.useMemo<SortableConfigItem[]>(
    () =>
      customClientStatuses.map((status) => ({
        id: status,
        label: status,
        locked: status === INITIAL_BOOKING_STATUS,
        editable: status !== INITIAL_BOOKING_STATUS,
        removable: status !== INITIAL_BOOKING_STATUS,
        badge:
          status === INITIAL_BOOKING_STATUS ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Wajib
            </span>
          ) : null,
      })),
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
    if (
      !nextName ||
      oldName === nextName ||
      availableEventTypes.includes(nextName)
    )
      return;
    setCustomEventTypes((prev) =>
      prev.map((item) => (item === oldName ? nextName : item)),
    );
    setActiveEventTypes((prev) =>
      prev.map((item) => (item === oldName ? nextName : item)),
    );
    setCalendarEventFormats((prev) => {
      if (!(oldName in prev)) return prev;
      const next = { ...prev, [nextName]: prev[oldName] };
      delete next[oldName];
      return next;
    });
    setCalendarEventDescriptions((prev) => {
      if (!(oldName in prev)) return prev;
      const next = { ...prev, [nextName]: prev[oldName] };
      delete next[oldName];
      return next;
    });
    setDriveFolderFormats((prev) => {
      if (!(oldName in prev)) return prev;
      const next = { ...prev, [nextName]: prev[oldName] };
      delete next[oldName];
      return next;
    });
    setDriveFolderStructures((prev) => {
      if (!(oldName in prev)) return prev;
      const next = { ...prev, [nextName]: prev[oldName] };
      delete next[oldName];
      return next;
    });
    setFormSectionsByEventType((prev) => {
      if (!(oldName in prev)) return prev;
      const next = { ...prev, [nextName]: prev[oldName] };
      delete next[oldName];
      return next;
    });
  }

  function toggleEventTypeActive(name: string) {
    setActiveEventTypes((prev) =>
      prev.includes(name)
        ? prev.filter((item) => item !== name)
        : eventTypeSettings
            .map((item) => item.name)
            .filter((item) => item === name || prev.includes(item)),
    );
  }

  function removeEventType(name: string) {
    setCustomEventTypes((prev) => prev.filter((item) => item !== name));
    setActiveEventTypes((prev) => prev.filter((item) => item !== name));
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
      // Setelah Google auth sukses, lakukan silent fetchAll agar state tersync dari DB
      if (
        event.data?.type === "GOOGLE_AUTH_SUCCESS" ||
        event.data?.type === "GOOGLE_DRIVE_SUCCESS"
      ) {
        void fetchAll(true);
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
    };
  }, []);

  React.useEffect(() => {
    if (!availableEventTypes.includes(selectedEventType)) {
      setSelectedEventType("Umum");
    }
    if (!availableEventTypes.includes(selectedCalendarEventType)) {
      setSelectedCalendarEventType("Umum");
    }
    if (!availableEventTypes.includes(selectedDriveEventType)) {
      setSelectedDriveEventType("Umum");
    }
  }, [
    availableEventTypes,
    selectedCalendarEventType,
    selectedDriveEventType,
    selectedEventType,
  ]);

  const loadSettingsProfile = React.useEffectEvent(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.warn("Failed to load profile settings:", error.message);
      return null;
    }

    if (data && typeof data === "object") {
      PROFILE_SETTINGS_SELECT_COLUMNS.forEach((column) => {
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
      throw new Error(payload?.error || "Gagal menyiapkan profil.");
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
    setIsCalendarConnected(isGoogleCalendarConnected(prof));
    setIsDriveConnected(isGoogleDriveConnected(prof));
    setLogoUrl((prof as any)?.invoice_logo_url || null);
    setCalendarEventFormats(
      normalizeTemplateFormatMap(
        (prof as any)?.calendar_event_format_map,
        (prof as any)?.calendar_event_format || DEFAULT_CALENDAR_EVENT_FORMAT,
      ),
    );
    setCalendarEventDescriptions(
      normalizeTemplateFormatMap(
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
        Object.fromEntries(
          Object.entries(rawSections as Record<string, unknown>).map(
            ([key, value]) => [key, normalizeStoredFormLayout(value, key)],
          ),
        ) as Record<string, FormLayoutItem[]>,
      );
    } else {
      setFormSectionsByEventType({});
    }
    const loadedClientStatuses = normalizeClientProgressStatuses(
      ((prof as any)?.custom_client_statuses as string[] | undefined) ||
        customClientStatuses,
    );
    setCustomClientStatuses(loadedClientStatuses);
    if ((prof as any)?.queue_trigger_status) {
      setQueueTriggerStatus((prof as any).queue_trigger_status);
    }
    setFinalInvoiceVisibleFromStatus(
      resolveFinalInvoiceVisibleFromStatus(
        loadedClientStatuses,
        (prof as any)?.final_invoice_visible_from_status,
      ),
    );
    if ((prof as any)?.default_wa_target) {
      setDefaultWaTarget((prof as any).default_wa_target);
    }
    const savedWa = prof?.whatsapp_number || "";
    const matchedCode = COUNTRY_CODES.find((c) => savedWa.startsWith(c.code));
    if (matchedCode) {
      setCountryCode(matchedCode.code);
      setWaNumber(savedWa.slice(matchedCode.code.length));
    } else {
      setWaNumber(savedWa.replace(/^0/, ""));
    }
    setVendorSlug(prof?.vendor_slug || "");

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
      if (tt.value === "whatsapp_freelancer") {
        // Initialize per event type
        templateEventTypes.forEach((et) => {
          const key = `${tt.value}__${et}`;
          const existing = allTemplates.find(
            (tmpl: Template) =>
              resolveTemplateType(tmpl) === tt.value &&
              (tmpl.event_type || "Umum") === et,
          );
          contents[key] = existing?.content || "";
          contentsEn[key] = existing?.content_en || "";
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
    setLoading(false);
  });

  React.useEffect(() => {
    void fetchAll();
  }, []);

  React.useEffect(() => {
    if (activeTab !== "google") return;
    if (!isCalendarConnected && !isDriveConnected) {
      setCalendarConnectedEmail(null);
      setDriveConnectedEmail(null);
      setLoadingConnectedAccountInfo(false);
      return;
    }

    let cancelled = false;
    setLoadingConnectedAccountInfo(true);
    void fetch("/api/google/connected-account")
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json().catch(
          () => null,
        )) as ConnectedGoogleAccountResponse | null;
      })
      .then((payload) => {
        if (cancelled) return;
        setCalendarConnectedEmail(payload?.calendar?.email || null);
        setDriveConnectedEmail(payload?.drive?.email || null);
      })
      .catch(() => {
        if (cancelled) return;
        setCalendarConnectedEmail(null);
        setDriveConnectedEmail(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingConnectedAccountInfo(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, isCalendarConnected, isDriveConnected]);

  const saveProfilePatch = React.useEffectEvent(
    async (patch: Record<string, unknown>) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User tidak ditemukan.");
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

      throw new Error("Gagal menyimpan profil.");
    },
  );

  async function handleSaveGeneralSettings() {
    if (!profile) return;
    setSaving(true);

    const slug = slugify(vendorSlug || studioName);

    try {
      await saveProfilePatch({
        studio_name: studioName || null,
        whatsapp_number: waNumber ? `${countryCode}${waNumber}` : null,
        vendor_slug: slug || null,
        default_wa_target: defaultWaTarget,
      });

      setVendorSlug(slug);
      setSavedMsg(SETTINGS_SAVED_MESSAGE);
      setTimeout(() => setSavedMsg(""), 3000);
      void fetchAll(true);
    } catch (error) {
      console.error("Settings save error:", error);
      setSavedMsg("Gagal menyimpan.");
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
      setSavedMsg(SETTINGS_SAVED_MESSAGE);
      setTimeout(() => setSavedMsg(""), 3000);
      void fetchAll(true);
    } catch (error) {
      console.error("Google settings save error:", error);
      setSavedMsg("Gagal menyimpan.");
      setTimeout(() => setSavedMsg(""), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEventTypes() {
    setEventTypeSaving(true);
    try {
      await saveProfilePatch({
        form_event_types: activeEventTypes,
        custom_event_types: customEventTypes,
      });
      setEventTypeSaved(true);
      setTimeout(() => setEventTypeSaved(false), 3000);
      void fetchAll(true);
    } catch (error) {
      console.error("Event type save error:", error);
      showFeedback("Gagal menyimpan jenis acara global.");
    } finally {
      setEventTypeSaving(false);
    }
  }

  function resolveTemplateTargetFromKey(key: string) {
    if (key.startsWith("whatsapp_freelancer__")) {
      const eventType = key.slice("whatsapp_freelancer__".length) || "Umum";
      return { type: "whatsapp_freelancer", eventType };
    }
    return { type: key, eventType: undefined };
  }

  async function handleSaveAllTemplates() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      showFeedback("User tidak ditemukan.");
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
        setTemplateSavedMsg(SETTINGS_SAVED_MESSAGE);
        setTimeout(() => setTemplateSavedMsg(""), 3000);
        return;
      }

      let nextTemplates = [...templates];

      for (const key of changedKeys) {
        const { type, eventType } = resolveTemplateTargetFromKey(key);
        const content = templateContents[key] || "";
        const contentEn = templateContentsEn[key] || "";
        const existing = nextTemplates.find(
          (item) =>
            resolveTemplateType(item) === type &&
            (eventType
              ? (item.event_type || "Umum") === eventType
              : !item.event_type || item.event_type === null),
        );
        const storedType = getStoredTemplateType(type);
        const storedName = getStoredTemplateName(
          type,
          templateTypes.find((tt) => tt.value === type)?.label || type,
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
      setTemplateSavedMsg(SETTINGS_SAVED_MESSAGE);
      setTimeout(() => setTemplateSavedMsg(""), 3000);
      void fetchAll(true);
    } catch (error) {
      console.error("Template save error:", error);
      showFeedback("Gagal menyimpan template.");
    } finally {
      setTemplateSaving(false);
    }
  }

  async function handleSaveStatuses() {
    if (!profile) return;
    setStatusSaving(true);
    const normalizedClientStatuses = normalizeClientProgressStatuses(
      customClientStatuses,
    );
    const nextVisibleFromStatus = resolveFinalInvoiceVisibleFromStatus(
      normalizedClientStatuses,
      finalInvoiceVisibleFromStatus,
    );
    try {
      await saveProfilePatch({
        custom_statuses: normalizedClientStatuses,
        custom_client_statuses: normalizedClientStatuses,
        queue_trigger_status: queueTriggerStatus,
        final_invoice_visible_from_status: nextVisibleFromStatus,
      });
      setCustomClientStatuses(normalizedClientStatuses);
      setFinalInvoiceVisibleFromStatus(nextVisibleFromStatus);
      setStatusSaved(true);
      setTimeout(() => setStatusSaved(false), 3000);
    } catch (error) {
      console.error("Status save error:", error);
      showFeedback("Gagal menyimpan status.");
    } finally {
      setStatusSaving(false);
    }
  }

  async function resetGeneralToDefaultAndSave() {
    const defaultCalendarFormats = normalizeTemplateFormatMap(
      null,
      DEFAULT_CALENDAR_EVENT_FORMAT,
    );
    const defaultCalendarDescriptions = normalizeTemplateFormatMap(
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
    setSavedMsg(SETTINGS_SAVED_MESSAGE);
    setTimeout(() => setSavedMsg(""), 3000);
    void fetchAll(true);
  }

  async function resetTemplatesToDefaultAndSave() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User tidak ditemukan.");

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
    setTemplateSavedMsg(SETTINGS_SAVED_MESSAGE);
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

    setCustomClientStatuses(nextClientStatuses);
    setQueueTriggerStatus(DEFAULT_QUEUE_TRIGGER_STATUS);
    setFinalInvoiceVisibleFromStatus(nextVisibleFromStatus);

    await saveProfilePatch({
      custom_statuses: nextClientStatuses,
      custom_client_statuses: nextClientStatuses,
      queue_trigger_status: DEFAULT_QUEUE_TRIGGER_STATUS,
      final_invoice_visible_from_status: nextVisibleFromStatus,
    });
    setStatusSaved(true);
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
      showFeedback("Gagal mengembalikan ke default.");
    } finally {
      setResetSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!disconnectModal.service) return;
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
      });
      setIsCalendarConnected(false);
    } else {
      await saveProfilePatch({
        google_drive_access_token: null,
        google_drive_refresh_token: null,
        google_drive_token_expiry: null,
      });
      setIsDriveConnected(false);
    }
    setIsDisconnecting(false);
    setDisconnectModal({ open: false, service: null });
  }

  const inputClass =
    "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";
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

  function updateCalendarDescription(eventType: string, value: string) {
    setCalendarEventDescriptions((prev) => ({ ...prev, [eventType]: value }));
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

  // Logo handlers
  function handleLogoFileSelected(file: File) {
    if (file.size > 500 * 1024) {
      showFeedback(
        "Ukuran file melebihi 500KB. Silakan pilih gambar yang lebih kecil.",
      );
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
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        await saveProfilePatch({ invoice_logo_url: base64 });
        setLogoUrl(base64);
        setLogoUploading(false);
      };
      reader.readAsDataURL(blob);
    } catch {
      showFeedback("Gagal menyimpan logo.");
      setLogoUploading(false);
    }
  }

  async function handleRemoveLogo() {
    if (!profile?.id) return;
    await saveProfilePatch({ invoice_logo_url: null });
    setLogoUrl(null);
  }
  const siteUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://clientdesk.ryanekoapp.web.id";
  const localizedFormPath = `${siteUrl}/${locale || "id"}/formbooking/`;
  const slugPreview = slugify(vendorSlug || studioName) || "nama-vendor";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tabs = [
    { key: "umum", label: tp("tabGeneral") },
    { key: "template", label: tp("tabTemplates") },
    { key: "status", label: "Status Booking" },
    { key: "jenis-acara", label: tp("tabEventTypes") },
    { key: "google", label: tp("tabGoogle") },
    { key: "telegram", label: tp("tabTelegram") },
  ];
  const resetDialogMeta: Record<
    NonNullable<(typeof resetModal)["scope"]>,
    { title: string; description: string }
  > = {
    umum: {
      title: "Balikkan Pengaturan Umum ke Default?",
      description:
        "Format Google Calendar dan Google Drive akan dikembalikan ke default dan langsung disimpan.",
    },
    template: {
      title: "Balikkan Template ke Default?",
      description:
        "Semua template custom (WhatsApp + Invoice) akan dihapus dan langsung disimpan.",
    },
    status: {
      title: "Balikkan Status Booking ke Default?",
      description:
        "Status Booking dan Status Klien akan kembali ke nilai bawaan dan langsung disimpan.",
    },
    "jenis-acara": {
      title: "Balikkan Jenis Acara ke Default?",
      description:
        "Semua jenis acara custom akan dihapus dan jenis acara bawaan akan diaktifkan kembali.",
    },
    google: {
      title: "Balikkan Pengaturan Google ke Default?",
      description:
        "Format Google Calendar dan Google Drive akan dikembalikan ke default dan langsung disimpan.",
    },
  };

  const previewData: Record<string, string> = {
    client_name: "Budi",
    booking_code: "INV-100120250001",
    session_date: "15 April 2026",
    session_time: "17.00",
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
    client_whatsapp: "+628123456789",
    event_type: selectedEventType,
    day_name: "Rabu",
    location: "Jakarta Convention Center",
    location_maps_url:
      "https://maps.google.com/maps?q=Jakarta+Convention+Center",
    detail_location: "Gedung Utama, Lt. 3, Ruang Ballroom A",
    notes: "Mohon datang 30 menit lebih awal",
    tracking_link: "https://clientdesk.ryanekoapp.web.id/id/track/abc123",
    invoice_url:
      "https://clientdesk.ryanekoapp.web.id/api/public/invoice?code=INV-100120250001",
    settlement_link:
      "https://clientdesk.ryanekoapp.web.id/id/settlement/abc123",
  };

  function renderPreview(content: string, extraVars?: Record<string, string>) {
    if (!content) return tp("emptyMessage");
    const mergedVars = { ...previewData, ...extraVars };
    return content.replace(
      /\{\{(\w+)\}\}/g,
      (_, key) => mergedVars[key] || `{{${key}}}`,
    );
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
  const currentCalendarDescription =
    calendarEventDescriptions[selectedCalendarEventType] || "";
  const currentDriveFormat = driveFolderFormats[selectedDriveEventType] || "";
  const calendarTemplateVariables = Array.from(
    new Set([
      ...getCalendarTemplateVariables(selectedCalendarEventType),
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
    resolveTemplateByEventType(
      calendarEventDescriptions,
      selectedCalendarEventType,
      DEFAULT_CALENDAR_EVENT_DESCRIPTION,
    ),
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
    const isFreelancer = tt.value === "whatsapp_freelancer";
    const contentKey = isFreelancer
      ? `${tt.value}__${selectedEventType}`
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
    const hints = isFreelancer
      ? Array.from(
          new Set([
            ...(variableHints[tt.value] || []),
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
      : variableHints[tt.value] || [];
    const preview = renderPreview(
      content,
      isFreelancer
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
          {/* Event Type Selector for Freelancer */}
          {isFreelancer && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {tp("eventType")}
              </label>
              <select
                value={selectedEventType}
                onChange={(e) => setSelectedEventType(e.target.value)}
                className={inputClass + " cursor-pointer"}
              >
                {availableEventTypes.map((et) => (
                  <option key={et} value={et}>
                    {et === "Umum" ? tp(`event${et}` as any) : et}
                  </option>
                ))}
              </select>
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

  return (
    <>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b">
          <div className="-mx-1 overflow-x-auto px-1">
            <div className="flex min-w-max gap-0">
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
        {(activeTab === "umum" || activeTab === "google") && (
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
                        className={
                          inputClass + " !w-28 shrink-0 cursor-pointer"
                        }
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
                    className={inputClass}
                  />
                  <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md break-all">
                    {localizedFormPath}
                    <span className="text-primary font-semibold">
                      {slugPreview}
                    </span>
                  </div>
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
                </div>

                {/* Default WA Target */}
                <div className="space-y-2 pt-2 border-t">
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

                </div>
                </div>
              </>
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
                <div className="p-4 rounded-lg border bg-muted/30">
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
                          onClick={() => {
                            const w = 500,
                              h = 600;
                            const left =
                              window.screenX + (window.outerWidth - w) / 2;
                            const top =
                              window.screenY + (window.outerHeight - h) / 2;
                            window.open(
                              "/api/google/auth",
                              "google-auth",
                              `width=${w},height=${h},left=${left},top=${top},popup=yes`,
                            );
                          }}
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
                        Bisa dibedakan per jenis acara. Jika format jenis acara
                        kosong, sistem akan pakai format Umum.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Jenis Acara
                      </label>
                      <select
                        value={selectedCalendarEventType}
                        onChange={(e) =>
                          setSelectedCalendarEventType(e.target.value)
                        }
                        className={inputClass + " cursor-pointer"}
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
                      <textarea
                        ref={calendarDescriptionInputRef}
                        value={currentCalendarDescription}
                        onChange={(e) =>
                          updateCalendarDescription(
                            selectedCalendarEventType,
                            e.target.value,
                          )
                        }
                        rows={5}
                        className="placeholder:text-muted-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-y"
                        placeholder={DEFAULT_CALENDAR_EVENT_DESCRIPTION}
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
                <div className="p-4 rounded-lg border bg-muted/30">
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
                          onClick={() => {
                            const w = 500,
                              h = 600;
                            const left =
                              window.screenX + (window.outerWidth - w) / 2;
                            const top =
                              window.screenY + (window.outerHeight - h) / 2;
                            window.open(
                              "/api/google/drive/auth",
                              "google-drive-auth",
                              `width=${w},height=${h},left=${left},top=${top},popup=yes`,
                            );
                          }}
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
                        atur sendiri per jenis acara.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Jenis Acara
                      </label>
                      <select
                        value={selectedDriveEventType}
                        onChange={(e) =>
                          setSelectedDriveEventType(e.target.value)
                        }
                        className={inputClass + " cursor-pointer"}
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
                          dibuat beda per jenis acara.
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
                          placeholder="Contoh: {year}"
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
            <div className="pt-1">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  disabled={saving}
                  onClick={
                    activeTab === "google"
                      ? handleSaveGoogleSettings
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
                    setNormalizedClientStatuses((prev) =>
                      prev.map((status) => (status === id ? label : status)),
                    )
                  }
                  onDelete={(id) => {
                    if (customClientStatuses.length <= 2) {
                      showFeedback("Minimal 2 status harus ada.");
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
                    placeholder="Nama status klien baru..."
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
                    className="h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">(Tidak ada trigger)</option>
                    {customClientStatuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
                  <p className="text-sm font-medium">
                    {locale === "en"
                      ? "Final Invoice Visibility"
                      : "Tampilkan Invoice Final Mulai Status"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {locale === "en"
                      ? "Choose the first client status where the final invoice card should appear on the tracking page."
                      : "Pilih status klien pertama saat kartu invoice final mulai ditampilkan di halaman tracking."}
                  </p>
                  <select
                    value={resolveFinalInvoiceVisibleFromStatus(
                      customClientStatuses,
                      finalInvoiceVisibleFromStatus,
                    )}
                    onChange={(e) =>
                      setFinalInvoiceVisibleFromStatus(e.target.value)
                    }
                    className="h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                    {SETTINGS_SAVED_MESSAGE}
                  </span>
                )}
              </div>
            </div>
          </>
        )}

        {/* ═══ TAB: Jenis Acara ═══ */}
        {activeTab === "jenis-acara" && (
          <div className="space-y-6">
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
              <div className="px-6 py-4 border-b">
                <h3 className="font-semibold flex items-center gap-2">
                  <Globe className="w-4 h-4" /> Jenis Acara Global
                </h3>
                <p className="text-sm text-muted-foreground">
                  Kelola urutan, aktif/nonaktif, dan custom jenis acara dari
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
                      const value = newCustomEventType.trim();
                      if (!value || availableEventTypes.includes(value)) return;
                      setCustomEventTypes((prev) => [...prev, value]);
                      setActiveEventTypes((prev) => [...prev, value]);
                      setNewCustomEventType("");
                    }}
                    placeholder="Tambah jenis acara custom..."
                    className={inputClass}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const value = newCustomEventType.trim();
                      if (!value || availableEventTypes.includes(value)) return;
                      setCustomEventTypes((prev) => [...prev, value]);
                      setActiveEventTypes((prev) => [...prev, value]);
                      setNewCustomEventType("");
                    }}
                  >
                    Tambah
                  </Button>
                </div>
                <div className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  Jenis acara bawaan bisa diurutkan dan
                  diaktifkan/nonaktifkan. Jenis acara custom bisa ditambah,
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
                    {SETTINGS_SAVED_MESSAGE}
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
              <h3 className="font-semibold">{tp("telegramTitle")}</h3>
              <p className="text-sm text-muted-foreground">
                {tp("telegramDesc")}
              </p>
            </div>
            <div className="p-8 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto text-3xl">
                🤖
              </div>
              <h4 className="font-semibold">{tp("comingSoon")}</h4>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {tp("telegramComingSoonDesc")}
              </p>
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
                  : "Balik ke Default?"}
              </DialogTitle>
              <DialogDescription>
                {resetModal.scope
                  ? resetDialogMeta[resetModal.scope].description
                  : "Pengaturan akan dikembalikan ke default."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-center gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setResetModal({ open: false, scope: null })}
                disabled={resetSaving}
              >
                Batal
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
                Balik ke Default
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
