"use client";

import * as React from "react";
import { Save, Loader2, MessageSquare, Building2, Phone, Globe, Link2, Unlink, CheckCircle, XCircle, AlertCircle, ImagePlus, Trash2, Upload, Plus, GripVertical, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { ImageCropModal } from "@/components/ui/image-crop-modal";
import {
    GOOGLE_EVENT_TYPES,
    DRIVE_TEMPLATE_VARIABLES,
    DEFAULT_CALENDAR_EVENT_FORMAT,
    DEFAULT_DRIVE_FOLDER_FORMAT,
    normalizeTemplateFormatMap,
    resolveTemplateByEventType,
    applyCalendarTemplate,
    applyDriveTemplate,
    getCalendarTemplateVariables,
} from "@/utils/google/template";
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
    getDefaultFinalInvoiceVisibleFromStatus,
    resolveFinalInvoiceVisibleFromStatus,
} from "@/lib/client-status";

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
    final_invoice_visible_from_status?: string | null;
    custom_event_types?: string[] | null;
    drive_folder_structure_map?: Record<string, string[]> | null;
    form_sections?: Record<string, FormLayoutItem[]> | FormLayoutItem[] | null;
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

const templateTypes = [
    { value: "whatsapp_client", label: "Whatsapp ke Klien" },
    { value: "whatsapp_booking_confirm", label: "Whatsapp Konfirmasi Booking" },
    { value: "whatsapp_settlement_client", label: "Whatsapp Invoice Pelunasan" },
    { value: "whatsapp_settlement_confirm", label: "Whatsapp Konfirmasi Pelunasan" },
    { value: "whatsapp_freelancer", label: "Whatsapp ke Freelance" },
    { value: "invoice", label: "Invoice" },
];

const variableHints: Record<string, string[]> = {
    whatsapp_client: [
        "{{client_name}}", "{{booking_code}}", "{{session_date}}", "{{service_name}}",
        "{{total_price}}", "{{dp_paid}}", "{{studio_name}}", "{{event_type}}",
        "{{location}}", "{{location_maps_url}}", "{{detail_location}}", "{{notes}}",
        "{{tracking_link}}", "{{invoice_url}}",
    ],
    whatsapp_booking_confirm: [
        "{{client_name}}", "{{booking_code}}", "{{session_date}}", "{{service_name}}",
        "{{total_price}}", "{{dp_paid}}", "{{studio_name}}", "{{event_type}}",
        "{{location}}", "{{tracking_link}}",
    ],
    whatsapp_settlement_client: [
        "{{client_name}}", "{{booking_code}}", "{{session_date}}", "{{service_name}}",
        "{{total_price}}", "{{dp_paid}}", "{{final_total}}", "{{adjustments_total}}",
        "{{remaining_payment}}", "{{studio_name}}", "{{event_type}}", "{{location}}",
        "{{tracking_link}}", "{{invoice_url}}", "{{settlement_link}}",
    ],
    whatsapp_settlement_confirm: [
        "{{client_name}}", "{{booking_code}}", "{{service_name}}", "{{session_date}}",
        "{{payment_method}}", "{{final_total}}", "{{remaining_payment}}", "{{studio_name}}",
        "{{invoice_url}}", "{{settlement_link}}",
    ],
    whatsapp_freelancer: [
        "{{freelancer_name}}", "{{client_name}}", "{{client_whatsapp}}", "{{booking_code}}", "{{session_date}}",
        "{{session_time}}", "{{service_name}}", "{{studio_name}}", "{{event_type}}",
        "{{location}}", "{{location_maps_url}}", "{{detail_location}}", "{{notes}}",
    ],
    invoice: ["{{client_name}}", "{{booking_code}}", "{{service_name}}", "{{total_price}}", "{{dp_paid}}", "{{session_date}}", "{{invoice_url}}"],
};

function slugify(str: string) {
    return str.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

// Google Calendar SVG Logo (official 2020)
function GoogleCalendarLogo({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <g transform="translate(3.75 3.75)">
                <path fill="#FFFFFF" d="M148.882,43.618l-47.368-5.263l-57.895,5.263L38.355,96.25l5.263,52.632l52.632,6.579l52.632-6.579l5.263-53.947L148.882,43.618z" />
                <path fill="#1A73E8" d="M65.211,125.276c-3.934-2.658-6.658-6.539-8.145-11.671l9.132-3.763c0.829,3.158,2.276,5.605,4.342,7.342c2.053,1.737,4.553,2.592,7.474,2.592c2.987,0,5.553-0.908,7.697-2.724s3.224-4.132,3.224-6.934c0-2.868-1.132-5.211-3.395-7.026s-5.105-2.724-8.5-2.724h-5.276v-9.039H76.5c2.921,0,5.382-0.789,7.382-2.368c2-1.579,3-3.737,3-6.487c0-2.447-0.895-4.395-2.684-5.855s-4.053-2.197-6.803-2.197c-2.684,0-4.816,0.711-6.395,2.145s-2.724,3.197-3.447,5.276l-9.039-3.763c1.197-3.395,3.395-6.395,6.618-8.987c3.224-2.592,7.342-3.895,12.342-3.895c3.697,0,7.026,0.711,9.974,2.145c2.947,1.434,5.263,3.421,6.934,5.947c1.671,2.539,2.5,5.382,2.5,8.539c0,3.224-0.776,5.947-2.329,8.184c-1.553,2.237-3.461,3.947-5.724,5.145v0.539c2.987,1.25,5.421,3.158,7.342,5.724c1.908,2.566,2.868,5.632,2.868,9.211s-0.908,6.776-2.724,9.579c-1.816,2.803-4.329,5.013-7.513,6.618c-3.197,1.605-6.789,2.421-10.776,2.421C73.408,129.263,69.145,127.934,65.211,125.276z" />
                <path fill="#1A73E8" d="M121.25,79.961l-9.974,7.25l-5.013-7.605l17.987-12.974h6.895v61.197h-9.895L121.25,79.961z" />
                <path fill="#EA4335" d="M148.882,196.25l47.368-47.368l-23.684-10.526l-23.684,10.526l-10.526,23.684L148.882,196.25z" />
                <path fill="#34A853" d="M33.092,172.566l10.526,23.684h105.263v-47.368H43.618L33.092,172.566z" />
                <path fill="#4285F4" d="M12.039-3.75C3.316-3.75-3.75,3.316-3.75,12.039v136.842l23.684,10.526l23.684-10.526V43.618h105.263l10.526-23.684L148.882-3.75H12.039z" />
                <path fill="#188038" d="M-3.75,148.882v31.579c0,8.724,7.066,15.789,15.789,15.789h31.579v-47.368H-3.75z" />
                <path fill="#FBBC04" d="M148.882,43.618v105.263h47.368V43.618l-23.684-10.526L148.882,43.618z" />
                <path fill="#1967D2" d="M196.25,43.618V12.039c0-8.724-7.066-15.789-15.789-15.789h-31.579v47.368H196.25z" />
            </g>
        </svg>
    );
}

// Google Drive SVG Logo (official 2020)
function GoogleDriveLogo({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
            <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
            <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#00ac47" />
            <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
            <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
            <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
            <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
        </svg>
    );
}

export default function SettingsPage() {
    const supabase = createClient();
    const t = useTranslations("Settings");
    const tp = useTranslations("SettingsPage");
    const locale = useLocale();
    const [profile, setProfile] = React.useState<Profile | null>(null);
    const [templates, setTemplates] = React.useState<Template[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [savedMsg, setSavedMsg] = React.useState("");
    const [customEventTypes, setCustomEventTypes] = React.useState<string[]>([]);
    const [newCustomEventType, setNewCustomEventType] = React.useState("");
    const [formSectionsByEventType, setFormSectionsByEventType] = React.useState<Record<string, FormLayoutItem[]>>({});

    // Controlled fields for profile
    const [studioName, setStudioName] = React.useState("");
    const [countryCode, setCountryCode] = React.useState("+62");
    const [waNumber, setWaNumber] = React.useState("");
    const [vendorSlug, setVendorSlug] = React.useState("");

    // Template form
    const [activeTab, setActiveTab] = React.useState("umum");
    const [templateContents, setTemplateContents] = React.useState<Record<string, string>>({});
    const [templateContentsEn, setTemplateContentsEn] = React.useState<Record<string, string>>({});
    const [templateSaving, setTemplateSaving] = React.useState<string | null>(null);
    const [templateSavedMsg, setTemplateSavedMsg] = React.useState<string | null>(null);

    // Event type selector for freelancer template
    const [selectedEventType, setSelectedEventType] = React.useState("Umum");

    // Language tab per template
    const [templateLang, setTemplateLang] = React.useState<Record<string, "id" | "en">>({});

    // Google integration
    const [isCalendarConnected, setIsCalendarConnected] = React.useState(false);
    const [isDriveConnected, setIsDriveConnected] = React.useState(false);

    // Disconnect modal
    const [disconnectModal, setDisconnectModal] = React.useState<{ open: boolean; service: "calendar" | "drive" | null }>({ open: false, service: null });
    const [isDisconnecting, setIsDisconnecting] = React.useState(false);

    // Logo studio
    const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
    const [logoCropSrc, setLogoCropSrc] = React.useState<string | null>(null);
    const [showLogoCrop, setShowLogoCrop] = React.useState(false);
    const [logoUploading, setLogoUploading] = React.useState(false);
    const [logoOrientation, setLogoOrientation] = React.useState<"horizontal" | "square">("horizontal");
    const [logoLightboxOpen, setLogoLightboxOpen] = React.useState(false);
    const [dragOver, setDragOver] = React.useState(false);
    const logoInputRef = React.useRef<HTMLInputElement>(null);

    // Custom statuses
    const [customStatuses, setCustomStatuses] = React.useState<string[]>(["Pending", "DP", "Terjadwal", "Selesai", "Edit", "Batal"]);
    const [newStatusName, setNewStatusName] = React.useState("");
    const [editingStatusIdx, setEditingStatusIdx] = React.useState<number | null>(null);
    const [editingStatusName, setEditingStatusName] = React.useState("");
    const [statusSaving, setStatusSaving] = React.useState(false);
    const [statusSaved, setStatusSaved] = React.useState(false);
    const [dragIdx, setDragIdx] = React.useState<number | null>(null);

    // Custom client statuses (progress)
    const [customClientStatuses, setCustomClientStatuses] = React.useState<string[]>(["Booking Confirmed","Sesi Foto / Acara","Antrian Edit","Proses Edit","Revisi","File Siap","Selesai"]);
    const [newClientStatusName, setNewClientStatusName] = React.useState("");
    const [editingClientStatusIdx, setEditingClientStatusIdx] = React.useState<number | null>(null);
    const [editingClientStatusName, setEditingClientStatusName] = React.useState("");
    const [clientStatusSaving, setClientStatusSaving] = React.useState(false);
    const [clientStatusSaved, setClientStatusSaved] = React.useState(false);
    const [dragClientIdx, setDragClientIdx] = React.useState<number | null>(null);
    const [queueTriggerStatus, setQueueTriggerStatus] = React.useState("Antrian Edit");
    const [finalInvoiceVisibleFromStatus, setFinalInvoiceVisibleFromStatus] = React.useState("Sesi Foto / Acara");

    // Default WA target
    const [defaultWaTarget, setDefaultWaTarget] = React.useState<"client" | "freelancer">("client");

    // Calendar event format
    const [calendarEventFormats, setCalendarEventFormats] = React.useState<Record<string, string>>(
        () => normalizeTemplateFormatMap(null, DEFAULT_CALENDAR_EVENT_FORMAT),
    );
    const [selectedCalendarEventType, setSelectedCalendarEventType] = React.useState("Umum");

    // Drive folder format
    const [driveFolderFormats, setDriveFolderFormats] = React.useState<Record<string, string>>(
        () => normalizeTemplateFormatMap(null, DEFAULT_DRIVE_FOLDER_FORMAT),
    );
    const [driveFolderStructures, setDriveFolderStructures] = React.useState<Record<string, string[]>>(
        () => normalizeDriveFolderStructureSettings(null),
    );
    const [selectedDriveEventType, setSelectedDriveEventType] = React.useState("Umum");
    const [newDriveSegment, setNewDriveSegment] = React.useState("");
    const calendarFormatInputRef = React.useRef<HTMLInputElement>(null);
    const driveFormatInputRef = React.useRef<HTMLInputElement>(null);
    const availableEventTypes = React.useMemo(
        () => Array.from(new Set(["Umum", ...GOOGLE_EVENT_TYPES, ...customEventTypes])),
        [customEventTypes],
    );

    // Listen for Google auth popup callbacks
    React.useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === "GOOGLE_AUTH_SUCCESS") setIsCalendarConnected(true);
            if (event.data?.type === "GOOGLE_DRIVE_SUCCESS") setIsDriveConnected(true);
        };
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
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
    }, [availableEventTypes, selectedCalendarEventType, selectedDriveEventType, selectedEventType]);

    const fetchAll = React.useEffectEvent(async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: p } = await supabase
            .from("profiles")
            .select("id, full_name, studio_name, whatsapp_number, vendor_slug, google_access_token, google_drive_access_token, calendar_event_format, calendar_event_format_map, drive_folder_format, drive_folder_format_map, drive_folder_structure_map, invoice_logo_url, custom_statuses, custom_client_statuses, queue_trigger_status, default_wa_target, final_invoice_visible_from_status, custom_event_types, form_sections")
            .eq("id", user.id)
            .single();
        const prof = p as Profile;
        setProfile(prof);
        const loadedCustomEventTypes = Array.isArray((prof as any)?.custom_event_types)
            ? ((prof as any).custom_event_types as string[]).filter((item) => typeof item === "string" && item.trim().length > 0)
            : [];
        setCustomEventTypes(loadedCustomEventTypes);
        setStudioName(prof?.studio_name || "");
        setIsCalendarConnected(!!(prof as any)?.google_access_token);
        setIsDriveConnected(!!(prof as any)?.google_drive_access_token);
        setLogoUrl((prof as any)?.invoice_logo_url || null);
        setCalendarEventFormats(
            normalizeTemplateFormatMap(
                (prof as any)?.calendar_event_format_map,
                (prof as any)?.calendar_event_format || DEFAULT_CALENDAR_EVENT_FORMAT,
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
            setFormSectionsByEventType({ Umum: normalizeStoredFormLayout(rawSections, "Umum") });
        } else if (rawSections && typeof rawSections === "object") {
            setFormSectionsByEventType(
                Object.fromEntries(
                    Object.entries(rawSections as Record<string, unknown>).map(([key, value]) => [
                        key,
                        normalizeStoredFormLayout(value, key),
                    ]),
                ) as Record<string, FormLayoutItem[]>,
            );
        } else {
            setFormSectionsByEventType({});
        }
        if ((prof as any)?.custom_statuses) {
            setCustomStatuses((prof as any).custom_statuses);
        }
        if ((prof as any)?.custom_client_statuses) {
            setCustomClientStatuses((prof as any).custom_client_statuses);
        }
        const loadedClientStatuses = ((prof as any)?.custom_client_statuses as string[] | undefined) || customClientStatuses;
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
        const matchedCode = COUNTRY_CODES.find(c => savedWa.startsWith(c.code));
        if (matchedCode) {
            setCountryCode(matchedCode.code);
            setWaNumber(savedWa.slice(matchedCode.code.length));
        } else {
            setWaNumber(savedWa.replace(/^0/, ""));
        }
        setVendorSlug(prof?.vendor_slug || "");

        const { data: tData } = await supabase.from("templates").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
        const allTemplates = (tData || []) as Template[];
        setTemplates(allTemplates);

        // Initialize template contents from existing templates
        const contents: Record<string, string> = {};
        const contentsEn: Record<string, string> = {};
        const templateEventTypes = Array.from(new Set(["Umum", ...GOOGLE_EVENT_TYPES, ...loadedCustomEventTypes]));
        templateTypes.forEach(tt => {
            if (tt.value === "whatsapp_freelancer") {
                // Initialize per event type
                templateEventTypes.forEach(et => {
                    const key = `${tt.value}__${et}`;
                    const existing = allTemplates.find((tmpl: any) => tmpl.type === tt.value && (tmpl.event_type || "Umum") === et);
                    contents[key] = existing?.content || "";
                    contentsEn[key] = existing?.content_en || "";
                });
            } else {
                const existing = allTemplates.find((tmpl: any) => tmpl.type === tt.value);
                contents[tt.value] = existing?.content || "";
                contentsEn[tt.value] = existing?.content_en || "";
            }
        });
        setTemplateContents(contents);
        setTemplateContentsEn(contentsEn);
        setLoading(false);
    });

    React.useEffect(() => { void fetchAll(); }, []);

    async function handleSaveProfile(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!profile) return;
        setSaving(true);

        const slug = slugify(vendorSlug || studioName);

        await supabase.from("profiles").update({
            studio_name: studioName || null,
            whatsapp_number: waNumber ? `${countryCode}${waNumber}` : null,
            vendor_slug: slug || null,
            default_wa_target: defaultWaTarget,
            custom_event_types: customEventTypes,
            calendar_event_format: calendarEventFormats.Umum || DEFAULT_CALENDAR_EVENT_FORMAT,
            calendar_event_format_map: calendarEventFormats,
            drive_folder_format: driveFolderFormats.Umum || DEFAULT_DRIVE_FOLDER_FORMAT,
            drive_folder_format_map: driveFolderFormats,
            drive_folder_structure_map: driveFolderStructures,
        }).eq("id", profile.id);

        setVendorSlug(slug);
        setSavedMsg(t("berhasilSimpan"));
        setTimeout(() => setSavedMsg(""), 3000);
        setSaving(false);
        fetchAll();
    }

    async function handleSaveTemplate(type: string, eventType?: string) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const saveKey = eventType ? `${type}__${eventType}` : type;
        setTemplateSaving(saveKey);

        const content = templateContents[saveKey] || "";
        const contentEn = templateContentsEn[saveKey] || "";
        const existing = templates.find(t => t.type === type && (eventType ? (t.event_type || "Umum") === eventType : !t.event_type || t.event_type === null));

        if (existing) {
            await supabase.from("templates").update({ content, content_en: contentEn }).eq("id", existing.id);
        } else if (content.trim() || contentEn.trim()) {
            await supabase.from("templates").insert({
                user_id: user.id,
                type,
                name: templateTypes.find(tt => tt.value === type)?.label || type,
                content,
                content_en: contentEn,
                is_default: true,
                event_type: eventType || null,
            });
        }

        setTemplateSaving(null);
        setTemplateSavedMsg(saveKey);
        setTimeout(() => setTemplateSavedMsg(null), 3000);
        fetchAll();
    }

    async function handleDisconnect() {
        if (!disconnectModal.service) return;
        setIsDisconnecting(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setIsDisconnecting(false); return; }

        if (disconnectModal.service === "calendar") {
            await supabase.from("profiles").update({ google_access_token: null, google_refresh_token: null, google_token_expiry: null }).eq("id", user.id);
            setIsCalendarConnected(false);
        } else {
            await supabase.from("profiles").update({ google_drive_access_token: null, google_drive_refresh_token: null }).eq("id", user.id);
            setIsDriveConnected(false);
        }
        setIsDisconnecting(false);
        setDisconnectModal({ open: false, service: null });
    }

    const inputClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

    function insertIntoInput(
        ref: React.RefObject<HTMLInputElement | null>,
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

    function updateDriveFormat(eventType: string, value: string) {
        setDriveFolderFormats((prev) => ({ ...prev, [eventType]: value }));
    }

    function getDriveSegments(eventType: string) {
        const resolved = driveFolderStructures[eventType];
        if (resolved && resolved.length > 0) return resolved;
        return driveFolderStructures.Umum?.length ? driveFolderStructures.Umum : ["{client_name}"];
    }

    function updateDriveSegments(eventType: string, updater: (segments: string[]) => string[]) {
        setDriveFolderStructures((prev) => ({
            ...prev,
            [eventType]: updater(getDriveSegments(eventType)),
        }));
    }

    // Logo handlers
    function handleLogoFileSelected(file: File) {
        if (file.size > 500 * 1024) {
            alert("Ukuran file melebihi 500KB. Silakan pilih gambar yang lebih kecil.");
            return;
        }
        if (!file.type.startsWith("image/")) {
            alert("File harus berupa gambar (PNG/JPG).");
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
                await supabase.from("profiles").update({ invoice_logo_url: base64 }).eq("id", profile.id);
                setLogoUrl(base64);
                setLogoUploading(false);
            };
            reader.readAsDataURL(blob);
        } catch {
            alert("Gagal menyimpan logo.");
            setLogoUploading(false);
        }
    }

    async function handleRemoveLogo() {
        if (!profile?.id) return;
        await supabase.from("profiles").update({ invoice_logo_url: null }).eq("id", profile.id);
        setLogoUrl(null);
    }
    const siteUrl = typeof window !== "undefined" ? window.location.origin : "https://clientdesk.ryanekoapp.web.id";
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
        { key: "telegram", label: tp("tabTelegram") },
    ];

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
        location_maps_url: "https://maps.google.com/maps?q=Jakarta+Convention+Center",
        detail_location: "Gedung Utama, Lt. 3, Ruang Ballroom A",
        notes: "Mohon datang 30 menit lebih awal",
        tracking_link: "https://clientdesk.ryanekoapp.web.id/id/track/abc123",
        invoice_url: "https://clientdesk.ryanekoapp.web.id/api/public/invoice?code=INV-100120250001",
        settlement_link: "https://clientdesk.ryanekoapp.web.id/id/settlement/abc123",
    };

    function renderPreview(content: string, extraVars?: Record<string, string>) {
        if (!content) return tp("emptyMessage");
        const mergedVars = { ...previewData, ...extraVars };
        return content.replace(/\{\{(\w+)\}\}/g, (_, key) => mergedVars[key] || `{{${key}}}`);
    }

    const calendarPreviewVars = {
        ...previewData,
        event_type: selectedCalendarEventType,
        ...getEventExtraFieldPreviewVars(selectedCalendarEventType),
    };
    const drivePreviewVars = {
        ...previewData,
        event_type: selectedDriveEventType,
    };
    const currentCalendarFormat = calendarEventFormats[selectedCalendarEventType] || "";
    const currentDriveFormat = driveFolderFormats[selectedDriveEventType] || "";
    const calendarTemplateVariables = getCalendarTemplateVariables(selectedCalendarEventType);
    const calendarEventPreview = applyCalendarTemplate(
        resolveTemplateByEventType(
            calendarEventFormats,
            selectedCalendarEventType,
            DEFAULT_CALENDAR_EVENT_FORMAT,
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

    function renderTemplateCard(tt: typeof templateTypes[0]) {
        const isFreelancer = tt.value === "whatsapp_freelancer";
        const contentKey = isFreelancer ? `${tt.value}__${selectedEventType}` : tt.value;
        const currentLang = templateLang[contentKey] || "id";
        const content = currentLang === "id" ? (templateContents[contentKey] || "") : (templateContentsEn[contentKey] || "");
        const hints = isFreelancer
            ? Array.from(
                new Set([
                    ...(variableHints[tt.value] || []),
                    ...getEventExtraFieldTemplateTokens(selectedEventType),
                    ...getCustomFieldTemplateTokens(
                        formSectionsByEventType[selectedEventType] || formSectionsByEventType.Umum || [],
                        selectedEventType,
                        "whatsapp",
                    ),
                ]),
            )
            : (variableHints[tt.value] || []);
        const preview = renderPreview(content, isFreelancer
            ? {
                event_type: selectedEventType,
                ...getEventExtraFieldPreviewVars(selectedEventType),
                ...getCustomFieldPreviewVars(
                    formSectionsByEventType[selectedEventType] || formSectionsByEventType.Umum || [],
                    selectedEventType,
                ),
            }
            : undefined);

        return (
            <div key={tt.value} className="rounded-xl border bg-card text-card-foreground shadow-sm">
                <div className="px-6 py-4 border-b">
                    <h3 className="font-semibold flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        {tt.value === "whatsapp_client"
                            ? tp("templateWAClient")
                            : tt.value === "whatsapp_booking_confirm"
                                ? "Konfirmasi Booking"
                                : tt.value === "whatsapp_settlement_client"
                                    ? "Invoice Pelunasan ke Klien"
                                    : tt.value === "whatsapp_settlement_confirm"
                                        ? "Konfirmasi Pelunasan ke Admin"
                                        : tt.value === "whatsapp_freelancer"
                                            ? tp("templateWAFreelancer")
                                            : tp("templateInvoice")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        {tt.value === "whatsapp_client" && tp("templateWAClientDesc")}
                        {tt.value === "whatsapp_booking_confirm" && "Template pesan konfirmasi setelah klien mengisi form booking."}
                        {tt.value === "whatsapp_settlement_client" && "Template pesan WhatsApp dari admin ke klien saat invoice pelunasan dikirim."}
                        {tt.value === "whatsapp_settlement_confirm" && "Template pesan WhatsApp dari klien ke admin setelah pelunasan dikirim."}
                        {tt.value === "whatsapp_freelancer" && tp("templateWAFreelancerDesc")}
                        {tt.value === "invoice" && tp("templateInvoiceDesc")}
                    </p>
                </div>
                <div className="p-6 space-y-4">
                    {/* Event Type Selector for Freelancer */}
                    {isFreelancer && (
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{tp("eventType")}</label>
                            <select
                                value={selectedEventType}
                                onChange={e => setSelectedEventType(e.target.value)}
                                className={inputClass + " cursor-pointer"}
                            >
                                {availableEventTypes.map(et => (
                                    <option key={et} value={et}>{et === "Umum" ? tp(`event${et}` as any) : et}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Variables */}
                    <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{tp("variables")}</p>
                        <div className="flex flex-wrap gap-1.5">
                            {hints.map(v => (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => {
                                        const textarea = document.querySelector(`textarea[data-template-key="${contentKey}"]`) as HTMLTextAreaElement | null;
                                        if (textarea) {
                                            const start = textarea.selectionStart || 0;
                                            const end = textarea.selectionEnd || 0;
                                            const currentContent = currentLang === "id" ? (templateContents[contentKey] || "") : (templateContentsEn[contentKey] || "");
                                            const newContent = currentContent.substring(0, start) + v + currentContent.substring(end);
                                            if (currentLang === "id") {
                                                setTemplateContents(prev => ({ ...prev, [contentKey]: newContent }));
                                            } else {
                                                setTemplateContentsEn(prev => ({ ...prev, [contentKey]: newContent }));
                                            }
                                            // Restore cursor position after React re-render
                                            setTimeout(() => {
                                                textarea.focus();
                                                textarea.selectionStart = textarea.selectionEnd = start + v.length;
                                            }, 0);
                                        } else {
                                            if (currentLang === "id") {
                                                setTemplateContents(prev => ({ ...prev, [contentKey]: (prev[contentKey] || "") + v }));
                                            } else {
                                                setTemplateContentsEn(prev => ({ ...prev, [contentKey]: (prev[contentKey] || "") + v }));
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
                            onClick={() => setTemplateLang(prev => ({ ...prev, [contentKey]: "id" }))}
                            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${currentLang === "id"
                                ? "bg-foreground text-background"
                                : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                                }`}
                        >
                            Indonesian 🇮🇩
                        </button>
                        <button
                            type="button"
                            onClick={() => setTemplateLang(prev => ({ ...prev, [contentKey]: "en" }))}
                            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${currentLang === "en"
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
                        onChange={e => {
                            if (currentLang === "id") {
                                setTemplateContents(prev => ({ ...prev, [contentKey]: e.target.value }));
                            } else {
                                setTemplateContentsEn(prev => ({ ...prev, [contentKey]: e.target.value }));
                            }
                        }}
                        rows={5}
                        placeholder={currentLang === "id"
                            ? `Tulis template pesan dalam Bahasa Indonesia ...`
                            : `Write message template in English ...`}
                        className="placeholder:text-muted-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-y"
                    />

                    {/* Preview */}
                    <div className="bg-muted/30 rounded-md px-4 py-3 border">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Preview:</p>
                        <pre className="text-sm whitespace-pre-wrap font-sans text-foreground/80">{preview}</pre>
                    </div>

                    {/* Save */}
                    <div className="flex items-center gap-3">
                        <Button size="sm" className="gap-2" onClick={() => handleSaveTemplate(tt.value, isFreelancer ? selectedEventType : undefined)} disabled={templateSaving === contentKey}>
                            {templateSaving === contentKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            {t("simpanProfil").split(" ")[0] || "Simpan"}
                        </Button>
                        {templateSavedMsg === contentKey && <span className="text-sm text-green-600 dark:text-green-400">{tp("saved")}</span>}
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
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`shrink-0 whitespace-nowrap px-3 sm:px-4 pt-3 pb-2 text-sm font-medium border-b-[3px] transition-colors cursor-pointer ${activeTab === tab.key
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
                {activeTab === "umum" && (
                    <div className="space-y-6">
                        {/* Profile Section */}
                        <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                            <div className="px-6 py-4 border-b">
                                <h3 className="font-semibold flex items-center gap-2"><Building2 className="w-4 h-4" /> {t("profilStudio")}</h3>
                                <p className="text-sm text-muted-foreground">{t("infoStudio")}</p>
                            </div>
                            <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> {tp("vendorStudioName")}</label>
                                        <input value={studioName} onChange={e => setStudioName(e.target.value)} placeholder={tp("vendorNamePlaceholder")} className={inputClass} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {t("nomorWA")}</label>
                                        <div className="flex gap-2">
                                            <select value={countryCode} onChange={e => setCountryCode(e.target.value)} className={inputClass + " !w-28 shrink-0 cursor-pointer"}>
                                                {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                                            </select>
                                            <input type="tel" value={waNumber} onChange={e => { const val = e.target.value.replace(/[^0-9]/g, ""); setWaNumber(val.startsWith("0") ? val.slice(1) : val); }} placeholder="8123456789" className={inputClass} />
                                        </div>
                                    </div>
                                </div>

                                {/* Custom URL Slug */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> {tp("customUrlLabel")}</label>
                                    <input
                                        value={vendorSlug}
                                        onChange={e => setVendorSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                                        placeholder={slugify(studioName) || "nama-vendor"}
                                        className={inputClass}
                                    />
                                    <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md break-all">
                                        {siteUrl}/formbooking/<span className="text-primary font-semibold">{slugPreview}</span>
                                    </div>
                                </div>

                                {/* Logo Studio */}
                                <div className="space-y-4 pt-2 border-t">
                                    <div>
                                        <label className="text-sm font-medium flex items-center gap-1.5"><ImagePlus className="w-3.5 h-3.5" /> {tp("logoStudio")}</label>
                                        <p className="text-xs text-muted-foreground mt-0.5">{tp("logoDesc")}</p>
                                    </div>

                                    {/* 1. Orientation */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">{tp("orientation")}</span>
                                        <div className="flex rounded-lg border border-input overflow-hidden">
                                            <button type="button" onClick={() => setLogoOrientation("horizontal")}
                                                className={`px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${logoOrientation === "horizontal" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}`}>
                                                {tp("horizontal")}
                                            </button>
                                            <button type="button" onClick={() => setLogoOrientation("square")}
                                                className={`px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${logoOrientation === "square" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}`}>
                                                {tp("square")}
                                            </button>
                                        </div>
                                    </div>

                                    {/* 2. Preview */}
                                    {logoUrl && (
                                        <div className="space-y-2">
                                            <p className="text-xs text-muted-foreground font-medium">{tp("preview")}</p>
                                            <div className={`rounded-xl border bg-muted/20 overflow-hidden flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all ${logoOrientation === "horizontal" ? "w-64 h-32" : "w-40 h-40"}`} onClick={() => setLogoLightboxOpen(true)} title={tp("clickToEnlarge")}>
                                                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                                            </div>
                                            {/* 3. Delete */}
                                            <button type="button" onClick={handleRemoveLogo} className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 cursor-pointer transition-colors">
                                                <Trash2 className="w-3.5 h-3.5" /> {tp("deleteLogo")}
                                            </button>
                                        </div>
                                    )}

                                    {/* 4. Upload */}
                                    <div>
                                        <div
                                            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                            onDragLeave={() => setDragOver(false)}
                                            onDrop={(e) => {
                                                e.preventDefault(); setDragOver(false);
                                                const file = e.dataTransfer.files?.[0];
                                                if (file) handleLogoFileSelected(file);
                                            }}
                                            onClick={() => logoInputRef.current?.click()}
                                            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30"}`}
                                        >
                                            <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                                            <p className="text-sm text-muted-foreground">{logoUrl ? tp("uploadReplace") : tp("uploadNew")}</p>
                                            <p className="text-[10px] text-muted-foreground/60 mt-1">{tp("uploadHint")}</p>
                                        </div>
                                        <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/jpg" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleLogoFileSelected(e.target.files[0]); e.target.value = ""; }} />
                                        {logoUploading && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2"><Loader2 className="w-3 h-3 animate-spin" /> {tp("uploading")}</p>}
                                    </div>
                                </div>

                                {/* Default WA Target */}
                                <div className="space-y-2 pt-2 border-t">
                                    <label className="text-sm font-medium flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Default Penerima WA</label>
                                    <p className="text-xs text-muted-foreground">Tentukan siapa yang dikirim pesan WhatsApp dari tombol WA di daftar booking.</p>
                                    <div className="flex rounded-lg border border-input overflow-hidden w-fit">
                                        <button type="button" onClick={() => setDefaultWaTarget("client")}
                                            className={`px-4 py-1.5 text-xs font-medium transition-colors cursor-pointer ${defaultWaTarget === "client" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}`}>
                                            Klien
                                        </button>
                                        <button type="button" onClick={() => setDefaultWaTarget("freelancer")}
                                            className={`px-4 py-1.5 text-xs font-medium transition-colors cursor-pointer ${defaultWaTarget === "freelancer" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}`}>
                                            Freelancer
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-2 border-t">
                                    <div>
                                        <label className="text-sm font-medium flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Jenis Acara Global</label>
                                        <p className="text-xs text-muted-foreground mt-0.5">Custom jenis acara dikelola di sini dan dipakai lintas form booking, template, filter, serta integrasi.</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {customEventTypes.length === 0 ? (
                                            <span className="text-xs text-muted-foreground">Belum ada custom jenis acara.</span>
                                        ) : customEventTypes.map((eventType) => (
                                            <span key={eventType} className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium">
                                                {eventType}
                                                <button
                                                    type="button"
                                                    className="text-muted-foreground hover:text-red-500"
                                                    onClick={() => setCustomEventTypes((prev) => prev.filter((item) => item !== eventType))}
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            value={newCustomEventType}
                                            onChange={e => setNewCustomEventType(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key !== "Enter") return;
                                                e.preventDefault();
                                                const value = newCustomEventType.trim();
                                                if (!value || availableEventTypes.includes(value)) return;
                                                setCustomEventTypes((prev) => [...prev, value]);
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
                                                setNewCustomEventType("");
                                            }}
                                        >
                                            Tambah
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 pt-2">
                                    <Button type="submit" disabled={saving} className="gap-2">
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        {t("simpanProfil")}
                                    </Button>
                                    {savedMsg && <span className="text-sm text-green-600 dark:text-green-400">{savedMsg}</span>}
                                </div>
                            </form>
                        </div>

                        {/* Google Integration Section */}
                        <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                            <div className="px-6 py-4 border-b">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                                    {tp("googleIntegration")}
                                </h3>
                                <p className="text-sm text-muted-foreground">{tp("googleIntegrationDesc")}</p>
                            </div>
                            <div className="p-6 space-y-4">
                                {/* Google Calendar */}
                                <div className="p-4 rounded-lg border bg-muted/30">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-white dark:bg-white/10 flex items-center justify-center border">
                                            <GoogleCalendarLogo className="w-7 h-7" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{tp("googleCalendar")}</p>
                                            <p className="text-xs text-muted-foreground">{tp("googleCalendarDesc")}</p>
                                        </div>
                                    </div>
                                    <div className="border-t mt-3 pt-3 flex items-center justify-between">
                                        {isCalendarConnected ? (
                                            <>
                                                <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> {tp("connected")}</span>
                                                <Button variant="outline" size="sm" className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" onClick={() => setDisconnectModal({ open: true, service: "calendar" })}>
                                                    <Unlink className="w-3.5 h-3.5" /> {tp("disconnect")}
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-xs text-muted-foreground flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> {tp("notConnected")}</span>
                                                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                                                    const w = 500, h = 600;
                                                    const left = window.screenX + (window.outerWidth - w) / 2;
                                                    const top = window.screenY + (window.outerHeight - h) / 2;
                                                    window.open("/api/google/auth", "google-auth", `width=${w},height=${h},left=${left},top=${top},popup=yes`);
                                                }}>
                                                    <Link2 className="w-3.5 h-3.5" /> {tp("connect")}
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {isCalendarConnected && (
                                    <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
                                        <div>
                                            <p className="text-sm font-medium">Format Nama Event Calendar</p>
                                            <p className="text-xs text-muted-foreground">Bisa dibedakan per jenis acara. Jika format jenis acara kosong, sistem akan pakai format Umum.</p>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Jenis Acara</label>
                                            <select
                                                value={selectedCalendarEventType}
                                                onChange={e => setSelectedCalendarEventType(e.target.value)}
                                                className={inputClass + " cursor-pointer"}
                                            >
                                                {availableEventTypes.map(et => (
                                                    <option key={et} value={et}>{et === "Umum" ? tp(`event${et}` as any) : et}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <input
                                            ref={calendarFormatInputRef}
                                            value={currentCalendarFormat}
                                            onChange={e => updateCalendarFormat(selectedCalendarEventType, e.target.value)}
                                            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            placeholder={DEFAULT_CALENDAR_EVENT_FORMAT}
                                        />
                                        <div className="flex flex-wrap gap-1.5">
                                            {calendarTemplateVariables.map((token) => (
                                                <button
                                                    key={token}
                                                    type="button"
                                                    onClick={() => insertIntoInput(
                                                        calendarFormatInputRef,
                                                        token,
                                                        currentCalendarFormat,
                                                        (value) => updateCalendarFormat(selectedCalendarEventType, value),
                                                    )}
                                                    className="text-[11px] px-2 py-1 rounded-md border bg-muted/50 text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                                                >
                                                    {token.replace(/\{\{|\}\}/g, "")}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="rounded-md border bg-background/80 px-4 py-3">
                                            <p className="text-xs font-medium text-muted-foreground mb-1">Preview Event Calendar</p>
                                            <p className="text-sm text-foreground/90">{calendarEventPreview}</p>
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
                                            <p className="text-xs text-muted-foreground">{tp("googleDriveDesc")}</p>
                                        </div>
                                    </div>
                                    <div className="border-t mt-3 pt-3 flex items-center justify-between">
                                        {isDriveConnected ? (
                                            <>
                                                <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> {tp("connected")}</span>
                                                <Button variant="outline" size="sm" className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" onClick={() => setDisconnectModal({ open: true, service: "drive" })}>
                                                    <Unlink className="w-3.5 h-3.5" /> {tp("disconnect")}
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-xs text-muted-foreground flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> {tp("notConnected")}</span>
                                                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                                                    const w = 500, h = 600;
                                                    const left = window.screenX + (window.outerWidth - w) / 2;
                                                    const top = window.screenY + (window.outerHeight - h) / 2;
                                                    window.open("/api/google/drive/auth", "google-drive-auth", `width=${w},height=${h},left=${left},top=${top},popup=yes`);
                                                }}>
                                                    <Link2 className="w-3.5 h-3.5" /> {tp("connect")}
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {isDriveConnected && (
                                    <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
                                        <div>
                                            <p className="text-sm font-medium">Format Nama Folder Klien</p>
                                            <p className="text-xs text-muted-foreground">Pisahkan format folder dari koneksi Google Drive, dan atur sendiri per jenis acara.</p>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Jenis Acara</label>
                                            <select
                                                value={selectedDriveEventType}
                                                onChange={e => setSelectedDriveEventType(e.target.value)}
                                                className={inputClass + " cursor-pointer"}
                                            >
                                                {availableEventTypes.map(et => (
                                                    <option key={et} value={et}>{et === "Umum" ? tp(`event${et}` as any) : et}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <input
                                            ref={driveFormatInputRef}
                                            value={currentDriveFormat}
                                            onChange={e => updateDriveFormat(selectedDriveEventType, e.target.value)}
                                            placeholder={DEFAULT_DRIVE_FOLDER_FORMAT}
                                            className="placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                                        />
                                        <div className="flex flex-wrap gap-1.5">
                                            {DRIVE_TEMPLATE_VARIABLES.map((token) => (
                                                <button
                                                    key={token}
                                                    type="button"
                                                    onClick={() => insertIntoInput(
                                                        driveFormatInputRef,
                                                        token,
                                                        currentDriveFormat,
                                                        (value) => updateDriveFormat(selectedDriveEventType, value),
                                                    )}
                                                    className="text-[11px] px-2 py-1 rounded-md border bg-muted/50 text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                                                >
                                                    {token.replace(/\{|\}/g, "")}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="rounded-md border bg-background/80 px-4 py-3 space-y-1">
                                            <p className="text-xs font-medium text-muted-foreground">Preview Folder Klien</p>
                                            <p className="text-sm text-foreground/90">{driveFolderPreview}</p>
                                            <p className="text-[11px] text-muted-foreground">Fallback lama: Data Booking Client Desk &gt; <strong>{driveFolderPreview}</strong></p>
                                        </div>
                                        <div className="rounded-lg border bg-background/80 p-4 space-y-3">
                                            <div>
                                                <p className="text-sm font-medium">Struktur Folder Bertingkat</p>
                                                <p className="text-xs text-muted-foreground">Atur urutan folder sebelum masuk ke folder klien. Bisa dibuat beda per jenis acara.</p>
                                            </div>
                                            <div className="space-y-2">
                                                {getDriveSegments(selectedDriveEventType).map((segment, index, arr) => (
                                                    <div key={`${selectedDriveEventType}-${index}`} className="flex items-center gap-2">
                                                        <input
                                                            value={segment}
                                                            onChange={e => updateDriveSegments(selectedDriveEventType, (segments) =>
                                                                segments.map((item, itemIndex) => itemIndex === index ? e.target.value : item),
                                                            )}
                                                            placeholder="{client_name}"
                                                            className={inputClass}
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            disabled={index === 0}
                                                            onClick={() => updateDriveSegments(selectedDriveEventType, (segments) => {
                                                                const next = [...segments];
                                                                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                                                return next;
                                                            })}
                                                        >
                                                            ↑
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            disabled={index === arr.length - 1}
                                                            onClick={() => updateDriveSegments(selectedDriveEventType, (segments) => {
                                                                const next = [...segments];
                                                                [next[index + 1], next[index]] = [next[index], next[index + 1]];
                                                                return next;
                                                            })}
                                                        >
                                                            ↓
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            disabled={arr.length <= 1}
                                                            onClick={() => updateDriveSegments(selectedDriveEventType, (segments) =>
                                                                segments.filter((_, itemIndex) => itemIndex !== index),
                                                            )}
                                                        >
                                                            Hapus
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {DRIVE_TEMPLATE_VARIABLES.map((token) => (
                                                    <button
                                                        key={`segment-${token}`}
                                                        type="button"
                                                        onClick={() => setNewDriveSegment((prev) => `${prev}${token}`)}
                                                        className="text-[11px] px-2 py-1 rounded-md border bg-muted/50 text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                                                    >
                                                        {token.replace(/\{|\}/g, "")}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    value={newDriveSegment}
                                                    onChange={e => setNewDriveSegment(e.target.value)}
                                                    placeholder="Contoh: {year}"
                                                    className={inputClass}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => {
                                                        const value = newDriveSegment.trim();
                                                        if (!value) return;
                                                        updateDriveSegments(selectedDriveEventType, (segments) => [...segments, value]);
                                                        setNewDriveSegment("");
                                                    }}
                                                >
                                                    Tambah
                                                </Button>
                                            </div>
                                            <div className="rounded-md border bg-muted/20 px-4 py-3 space-y-1">
                                                <p className="text-xs font-medium text-muted-foreground">Preview Folder Bertingkat</p>
                                                <p className="text-sm text-foreground/90">Data Booking Client Desk &gt; {driveFolderStructurePreview || "{client_name}"}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ TAB: Template Pesan ═══ */}
                {activeTab === "template" && (
                    <div className="space-y-6">
                        {templateTypes.map(tt => renderTemplateCard(tt))}
                    </div>
                )}

                {/* ═══ TAB: Status Booking ═══ */}
                {activeTab === "status" && (
                    <>
                    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                        <div className="px-6 py-4 border-b">
                            <h3 className="font-semibold">Status Booking</h3>
                            <p className="text-sm text-muted-foreground">Atur status booking sesuai alur kerja kamu. Drag untuk mengubah urutan.</p>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Status list with drag-reorder */}
                            <div className="space-y-1">
                                {customStatuses.map((s, idx) => (
                                    <div
                                        key={idx}
                                        draggable
                                        onDragStart={() => setDragIdx(idx)}
                                        onDragOver={(e) => { e.preventDefault(); }}
                                        onDrop={() => {
                                            if (dragIdx === null || dragIdx === idx) return;
                                            const arr = [...customStatuses];
                                            const [moved] = arr.splice(dragIdx, 1);
                                            arr.splice(idx, 0, moved);
                                            setCustomStatuses(arr);
                                            setDragIdx(null);
                                        }}
                                        onDragEnd={() => setDragIdx(null)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border bg-background transition-all ${
                                            dragIdx === idx ? "opacity-50 border-dashed" : "hover:bg-muted/50"
                                        }`}
                                    >
                                        <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab shrink-0" />
                                        {editingStatusIdx === idx ? (
                                            <div className="flex items-center gap-2 flex-1">
                                                <input
                                                    autoFocus
                                                    value={editingStatusName}
                                                    onChange={e => setEditingStatusName(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === "Enter" && editingStatusName.trim()) {
                                                            const arr = [...customStatuses];
                                                            arr[idx] = editingStatusName.trim();
                                                            setCustomStatuses(arr);
                                                            setEditingStatusIdx(null);
                                                        }
                                                        if (e.key === "Escape") setEditingStatusIdx(null);
                                                    }}
                                                    className="h-7 flex-1 rounded border border-input px-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                />
                                                <button
                                                    onClick={() => {
                                                        if (editingStatusName.trim()) {
                                                            const arr = [...customStatuses];
                                                            arr[idx] = editingStatusName.trim();
                                                            setCustomStatuses(arr);
                                                        }
                                                        setEditingStatusIdx(null);
                                                    }}
                                                    className="text-green-600 hover:text-green-700 cursor-pointer"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => setEditingStatusIdx(null)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="flex-1 text-sm">{s}</span>
                                                <button
                                                    onClick={() => { setEditingStatusIdx(idx); setEditingStatusName(s); }}
                                                    className="text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded hover:bg-muted"
                                                    title="Rename"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (customStatuses.length <= 2) { alert("Minimal 2 status harus ada."); return; }
                                                        setCustomStatuses(customStatuses.filter((_, i) => i !== idx));
                                                    }}
                                                    className="text-muted-foreground hover:text-red-600 cursor-pointer p-1 rounded hover:bg-muted"
                                                    title="Hapus"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Add new status */}
                            <div className="flex items-center gap-2">
                                <input
                                    value={newStatusName}
                                    onChange={e => setNewStatusName(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === "Enter" && newStatusName.trim()) {
                                            setCustomStatuses([...customStatuses, newStatusName.trim()]);
                                            setNewStatusName("");
                                        }
                                    }}
                                    placeholder="Nama status baru..."
                                    className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={!newStatusName.trim()}
                                    onClick={() => {
                                        if (newStatusName.trim()) {
                                            setCustomStatuses([...customStatuses, newStatusName.trim()]);
                                            setNewStatusName("");
                                        }
                                    }}
                                    className="gap-1"
                                >
                                    <Plus className="w-4 h-4" /> Tambah
                                </Button>
                            </div>

                            {/* Save button */}
                            <div className="flex items-center gap-3 pt-2">
                                <Button
                                    size="sm"
                                    disabled={statusSaving}
                                    onClick={async () => {
                                        if (!profile) return;
                                        setStatusSaving(true);
                                        await supabase.from("profiles").update({ custom_statuses: customStatuses }).eq("id", profile.id);
                                        setStatusSaving(false);
                                        setStatusSaved(true);
                                        setTimeout(() => setStatusSaved(false), 2000);
                                    }}
                                    className="gap-1.5"
                                >
                                    {statusSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Simpan Status
                                </Button>
                                {statusSaved && <span className="text-xs text-green-600 dark:text-green-400">Tersimpan!</span>}
                            </div>
                        </div>
                    </div>

                    {/* Client Status (Progress) */}
                    <div className="rounded-xl border bg-card text-card-foreground shadow-sm mt-4">
                        <div className="px-6 py-4 border-b">
                            <h3 className="font-semibold">Status Klien (Progress)</h3>
                            <p className="text-sm text-muted-foreground">Atur langkah-langkah progress yang ditampilkan ke klien di halaman tracking. Drag untuk urutan.</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-1">
                                {customClientStatuses.map((s, idx) => (
                                    <div
                                        key={idx}
                                        draggable
                                        onDragStart={() => setDragClientIdx(idx)}
                                        onDragOver={(e) => { e.preventDefault(); }}
                                        onDrop={() => {
                                            if (dragClientIdx === null || dragClientIdx === idx) return;
                                            const arr = [...customClientStatuses];
                                            const [moved] = arr.splice(dragClientIdx, 1);
                                            arr.splice(idx, 0, moved);
                                            setCustomClientStatuses(arr);
                                            setDragClientIdx(null);
                                        }}
                                        onDragEnd={() => setDragClientIdx(null)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border bg-background transition-all ${
                                            dragClientIdx === idx ? "opacity-50 border-dashed" : "hover:bg-muted/50"
                                        }`}
                                    >
                                        <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab shrink-0" />
                                        {editingClientStatusIdx === idx ? (
                                            <div className="flex items-center gap-2 flex-1">
                                                <input
                                                    autoFocus
                                                    value={editingClientStatusName}
                                                    onChange={e => setEditingClientStatusName(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === "Enter" && editingClientStatusName.trim()) {
                                                            const arr = [...customClientStatuses];
                                                            arr[idx] = editingClientStatusName.trim();
                                                            setCustomClientStatuses(arr);
                                                            setEditingClientStatusIdx(null);
                                                        }
                                                        if (e.key === "Escape") setEditingClientStatusIdx(null);
                                                    }}
                                                    className="h-7 flex-1 rounded border border-input px-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                />
                                                <button
                                                    onClick={() => {
                                                        if (editingClientStatusName.trim()) {
                                                            const arr = [...customClientStatuses];
                                                            arr[idx] = editingClientStatusName.trim();
                                                            setCustomClientStatuses(arr);
                                                        }
                                                        setEditingClientStatusIdx(null);
                                                    }}
                                                    className="text-green-600 hover:text-green-700 cursor-pointer"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => setEditingClientStatusIdx(null)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="flex-1 text-sm">{s}</span>
                                                <button
                                                    onClick={() => { setEditingClientStatusIdx(idx); setEditingClientStatusName(s); }}
                                                    className="text-muted-foreground hover:text-foreground cursor-pointer p-1 rounded hover:bg-muted"
                                                    title="Rename"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (customClientStatuses.length <= 2) { alert("Minimal 2 status harus ada."); return; }
                                                        setCustomClientStatuses(customClientStatuses.filter((_, i) => i !== idx));
                                                    }}
                                                    className="text-muted-foreground hover:text-red-600 cursor-pointer p-1 rounded hover:bg-muted"
                                                    title="Hapus"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    value={newClientStatusName}
                                    onChange={e => setNewClientStatusName(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === "Enter" && newClientStatusName.trim()) {
                                            setCustomClientStatuses([...customClientStatuses, newClientStatusName.trim()]);
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
                                            setCustomClientStatuses([...customClientStatuses, newClientStatusName.trim()]);
                                            setNewClientStatusName("");
                                        }
                                    }}
                                    className="gap-1"
                                >
                                    <Plus className="w-4 h-4" /> Tambah
                                </Button>
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                                <Button
                                    size="sm"
                                    disabled={clientStatusSaving}
                                    onClick={async () => {
                                        if (!profile) return;
                                        setClientStatusSaving(true);
                                        const nextVisibleFromStatus = resolveFinalInvoiceVisibleFromStatus(
                                            customClientStatuses,
                                            finalInvoiceVisibleFromStatus,
                                        );
                                        await supabase.from("profiles").update({
                                            custom_client_statuses: customClientStatuses,
                                            queue_trigger_status: queueTriggerStatus,
                                            final_invoice_visible_from_status: nextVisibleFromStatus,
                                        }).eq("id", profile.id);
                                        setFinalInvoiceVisibleFromStatus(nextVisibleFromStatus);
                                        setClientStatusSaving(false);
                                        setClientStatusSaved(true);
                                        setTimeout(() => setClientStatusSaved(false), 2000);
                                    }}
                                    className="gap-1.5"
                                >
                                    {clientStatusSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Simpan Status Klien
                                </Button>
                                {clientStatusSaved && <span className="text-xs text-green-600 dark:text-green-400">Tersimpan!</span>}
                            </div>

                            {/* Queue trigger setting */}
                            <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
                                <p className="text-sm font-medium">Trigger Auto-Queue</p>
                                <p className="text-xs text-muted-foreground">Pilih status klien yang akan otomatis men-trigger antrian (posisi antrian otomatis terisi saat klien masuk ke status ini).</p>
                                <select
                                    value={queueTriggerStatus}
                                    onChange={e => setQueueTriggerStatus(e.target.value)}
                                    className="h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                    <option value="">(Tidak ada trigger)</option>
                                    {customClientStatuses.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
                                <p className="text-sm font-medium">
                                    {locale === "en" ? "Final Invoice Visibility" : "Tampilkan Invoice Final Mulai Status"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {locale === "en"
                                        ? "Choose the first client status where the final invoice card should appear on the tracking page."
                                        : "Pilih status klien pertama saat kartu invoice final mulai ditampilkan di halaman tracking."}
                                </p>
                                <select
                                    value={resolveFinalInvoiceVisibleFromStatus(customClientStatuses, finalInvoiceVisibleFromStatus)}
                                    onChange={e => setFinalInvoiceVisibleFromStatus(e.target.value)}
                                    className="h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                    {(customClientStatuses.length > 0 ? customClientStatuses : [getDefaultFinalInvoiceVisibleFromStatus(customClientStatuses)]).map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                    </>
                )}

                {/* ═══ TAB: Bot Telegram ═══ */}
                {activeTab === "telegram" && (
                    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                        <div className="px-6 py-4 border-b">
                            <h3 className="font-semibold">{tp("telegramTitle")}</h3>
                            <p className="text-sm text-muted-foreground">{tp("telegramDesc")}</p>
                        </div>
                        <div className="p-8 text-center space-y-3">
                            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto text-3xl">🤖</div>
                            <h4 className="font-semibold">{tp("comingSoon")}</h4>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                {tp("telegramComingSoonDesc")}
                            </p>
                        </div>
                    </div>
                )}

                {/* Disconnect Confirmation Modal */}
                <Dialog open={disconnectModal.open} onOpenChange={(o) => !o && setDisconnectModal({ open: false, service: null })}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader className="items-center text-center">
                            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-2">
                                <AlertCircle className="w-6 h-6 text-red-600" />
                            </div>
                            <DialogTitle className="text-xl">{tp("disconnectTitle")}</DialogTitle>
                            <DialogDescription>
                                {disconnectModal.service === "calendar"
                                    ? tp("disconnectCalendarDesc")
                                    : tp("disconnectDriveDesc")
                                }
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="sm:justify-center gap-2 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => setDisconnectModal({ open: false, service: null })} disabled={isDisconnecting}>{tp("cancel") || "Cancel"}</Button>
                            <Button variant="destructive" className="flex-1" onClick={handleDisconnect} disabled={isDisconnecting}>
                                {isDisconnecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Unlink className="w-4 h-4 mr-2" />}
                                {tp("yesDisconnect")}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Logo Crop Modal */}
            {logoCropSrc && (
                <ImageCropModal
                    open={showLogoCrop}
                    imageSrc={logoCropSrc}
                    title={`${tp("cropLogoTitle")} (${logoOrientation === "horizontal" ? tp("horizontal") : tp("square")})`}
                    aspect={logoOrientation === "horizontal" ? 16 / 10 : 1}
                    cropShape="rect"
                    onClose={() => { setShowLogoCrop(false); setLogoCropSrc(null); }}
                    onCropComplete={handleCroppedLogo}
                />
            )}

            {/* Logo Lightbox */}
            {logoLightboxOpen && logoUrl && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-8 cursor-pointer" onClick={() => setLogoLightboxOpen(false)}>
                    <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />
                </div>
            )}
        </>
    );
}
