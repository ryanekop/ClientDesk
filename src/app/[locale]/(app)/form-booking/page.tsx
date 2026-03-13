"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import {
  ExternalLink,
  Copy,
  ClipboardCheck,
  Loader2,
  Percent,
  Palette,
  List,
  ToggleRight,
  RotateCcw,
  CreditCard,
  QrCode,
  Banknote,
  Plus,
  Trash2,
  RefreshCw,
  Settings2,
  Eye,
  Globe,
  FileText,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import CustomFormBuilder from "@/components/form-builder/custom-form-builder";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  normalizeStoredFormLayout,
  type FormLayoutItem,
} from "@/components/form-builder/booking-form-layout";
import {
  createEmptyBankAccount,
  buildDriveImageUrl,
  getEnabledBankAccounts,
  getPaymentMethodLabel,
  getValidBankAccounts,
  normalizeBankAccounts,
  normalizePaymentMethods,
  type BankAccount,
  type PaymentMethod,
} from "@/lib/payment-config";

const ALL_EVENT_TYPES = [
  "Umum",
  "Wedding",
  "Akad",
  "Resepsi",
  "Lamaran",
  "Prewedding",
  "Wisuda",
  "Maternity",
  "Newborn",
  "Family",
  "Komersil",
  "Lainnya",
];

type FormSectionsByEventType = Record<string, FormLayoutItem[]>;
type PreviewPayload = {
  studio_name: string | null;
  min_dp_percent: number;
  min_dp_map: Record<string, { mode: "percent" | "fixed"; value: number }>;
  form_brand_color: string;
  form_greeting: string | null;
  form_event_types: string[];
  custom_event_types: string[];
  form_show_notes: boolean;
  form_show_proof: boolean;
  form_terms_enabled: boolean;
  form_terms_agreement_text: string;
  form_terms_link_text: string;
  form_terms_suffix_text: string;
  form_terms_content: string;
  form_sections: FormSectionsByEventType;
  form_payment_methods: PaymentMethod[];
  qris_image_url: string | null;
  bank_accounts: BankAccount[];
};

type FormBookingSnapshot = {
  min_dp_percent: number;
  min_dp_map: Record<string, { mode: "percent" | "fixed"; value: number }>;
  form_brand_color: string;
  form_greeting: string;
  form_event_types: string[];
  custom_event_types: string[];
  form_show_notes: boolean;
  form_show_proof: boolean;
  form_terms_enabled: boolean;
  form_terms_agreement_text: string;
  form_terms_link_text: string;
  form_terms_suffix_text: string;
  form_terms_content: string;
  form_sections: FormSectionsByEventType;
  form_payment_methods: PaymentMethod[];
  bank_accounts: BankAccount[];
  form_lang: string;
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

const DEFAULTS = {
  brandColor: "#000000",
  greeting: "",
  eventTypes: ALL_EVENT_TYPES,
  showNotes: true,
  showProof: true,
  termsEnabled: false,
  termsAgreementText: "Saya telah membaca & setuju terhadap",
  termsLinkText: "Syarat & Ketentuan",
  termsSuffixText: "yang sudah ada.",
  termsContent: "",
  minDpPercent: 50,
  minDpMap: {} as Record<string, { mode: "percent" | "fixed"; value: number }>,
  paymentMethods: ["bank"] as PaymentMethod[],
  bankAccounts: [] as BankAccount[],
};

function createFormBookingSnapshot({
  minDpPercent,
  minDpMap,
  brandColor,
  greeting,
  selectedEventTypes,
  customEventTypes,
  showNotes,
  showProof,
  termsEnabled,
  termsAgreementText,
  termsLinkText,
  termsSuffixText,
  termsContent,
  formSectionsByEventType,
  formPaymentMethods,
  bankAccounts,
  formLang,
}: {
  minDpPercent: number;
  minDpMap: Record<string, { mode: "percent" | "fixed"; value: number }>;
  brandColor: string;
  greeting: string;
  selectedEventTypes: string[];
  customEventTypes: string[];
  showNotes: boolean;
  showProof: boolean;
  termsEnabled: boolean;
  termsAgreementText: string;
  termsLinkText: string;
  termsSuffixText: string;
  termsContent: string;
  formSectionsByEventType: FormSectionsByEventType;
  formPaymentMethods: PaymentMethod[];
  bankAccounts: BankAccount[];
  formLang: string;
}): FormBookingSnapshot {
  return {
    min_dp_percent: minDpPercent,
    min_dp_map: minDpMap,
    form_brand_color: brandColor,
    form_greeting: greeting,
    form_event_types: selectedEventTypes,
    custom_event_types: customEventTypes,
    form_show_notes: showNotes,
    form_show_proof: showProof,
    form_terms_enabled: termsEnabled,
    form_terms_agreement_text: termsAgreementText,
    form_terms_link_text: termsLinkText,
    form_terms_suffix_text: termsSuffixText,
    form_terms_content: termsContent,
    form_sections: formSectionsByEventType,
    form_payment_methods: formPaymentMethods,
    bank_accounts: bankAccounts,
    form_lang: formLang,
  };
}

export default function FormBookingPage() {
  const supabase = React.useMemo(() => createClient(), []);
  const locale = useLocale();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [vendorSlug, setVendorSlug] = React.useState("");
  const [studioName, setStudioName] = React.useState("");
  const [minDpPercent, setMinDpPercent] = React.useState(DEFAULTS.minDpPercent);
  const [minDpMap, setMinDpMap] = React.useState<Record<string, { mode: "percent" | "fixed"; value: number }>>(
    DEFAULTS.minDpMap,
  );
  const [selectedDpEventType, setSelectedDpEventType] = React.useState("Umum");
  const [savedMsg, setSavedMsg] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const [profileId, setProfileId] = React.useState("");
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = React.useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = React.useState(false);
  const [pendingNavigation, setPendingNavigation] = React.useState<string | null>(null);

  // Customization
  const [brandColor, setBrandColor] = React.useState(DEFAULTS.brandColor);
  const [greeting, setGreeting] = React.useState(DEFAULTS.greeting);
  const [selectedEventTypes, setSelectedEventTypes] = React.useState<string[]>(
    DEFAULTS.eventTypes,
  );
  const [customEventTypes, setCustomEventTypes] = React.useState<string[]>([]);
  const [newCustomType, setNewCustomType] = React.useState("");
  const [showNotes, setShowNotes] = React.useState(DEFAULTS.showNotes);
  const [showProof, setShowProof] = React.useState(DEFAULTS.showProof);
  const [formPaymentMethods, setFormPaymentMethods] = React.useState<PaymentMethod[]>(
    DEFAULTS.paymentMethods,
  );
  const [termsEnabled, setTermsEnabled] = React.useState(DEFAULTS.termsEnabled);
  const [termsAgreementText, setTermsAgreementText] = React.useState(
    DEFAULTS.termsAgreementText,
  );
  const [termsLinkText, setTermsLinkText] = React.useState(
    DEFAULTS.termsLinkText,
  );
  const [termsSuffixText, setTermsSuffixText] = React.useState(
    DEFAULTS.termsSuffixText,
  );
  const [termsContent, setTermsContent] = React.useState(DEFAULTS.termsContent);
  const [formLang, setFormLang] = React.useState("id");
  const [settingsTab, setSettingsTab] = React.useState<"general" | "customForm">("general");
  const [selectedCustomFormEventType, setSelectedCustomFormEventType] = React.useState("Umum");

  // Merged event types: built-in + custom
  const allEventTypes = React.useMemo(
    () => [...ALL_EVENT_TYPES, ...customEventTypes],
    [customEventTypes],
  );

  // Custom Form Builder
  const [formSectionsByEventType, setFormSectionsByEventType] = React.useState<FormSectionsByEventType>({});

  // Bank accounts (max 5)
  const [bankAccounts, setBankAccounts] = React.useState<BankAccount[]>([]);
  const [qrisImageUrl, setQrisImageUrl] = React.useState<string | null>(null);
  const [qrisUploading, setQrisUploading] = React.useState(false);
  const [qrisDeleting, setQrisDeleting] = React.useState(false);
  const [saveMessageTone, setSaveMessageTone] = React.useState<"success" | "error">("success");

  const [iframeKey, setIframeKey] = React.useState(0);
  const [mobileTab, setMobileTab] = React.useState<"settings" | "preview">(
    "settings",
  );
  const [isDriveConnected, setIsDriveConnected] = React.useState(false);
  const [siteUrl, setSiteUrl] = React.useState("");
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const qrisInputRef = React.useRef<HTMLInputElement>(null);

  const formUrl = vendorSlug
    ? `${siteUrl}/${formLang}/formbooking/${vendorSlug}`
    : "";
  const formPath = vendorSlug ? `/${formLang}/formbooking/${vendorSlug}` : "";
  const previewStorageKey = React.useMemo(
    () => (vendorSlug ? `clientdesk:form-preview:${vendorSlug}` : ""),
    [vendorSlug],
  );
  const previewPath = React.useMemo(() => {
    if (!formPath || !previewStorageKey) return "";
    return `${formPath}?preview=1&previewKey=${encodeURIComponent(previewStorageKey)}`;
  }, [formPath, previewStorageKey]);
  const previewSrc = previewPath || formPath;
  const previewPayload = React.useMemo<PreviewPayload>(
    () => ({
      studio_name: studioName || null,
      min_dp_percent: minDpPercent,
      min_dp_map: minDpMap,
      form_brand_color: brandColor,
      form_greeting: greeting || null,
      form_event_types: selectedEventTypes,
      custom_event_types: customEventTypes,
      form_show_notes: showNotes,
      form_show_proof: showProof,
      form_terms_enabled: termsEnabled,
      form_terms_agreement_text: termsAgreementText,
      form_terms_link_text: termsLinkText,
      form_terms_suffix_text: termsSuffixText,
      form_terms_content: termsContent,
      form_sections: formSectionsByEventType,
      form_payment_methods: formPaymentMethods,
      qris_image_url: qrisImageUrl,
      bank_accounts: getValidBankAccounts(bankAccounts),
    }),
    [
      bankAccounts,
      brandColor,
      customEventTypes,
      formSectionsByEventType,
      greeting,
      minDpMap,
      minDpPercent,
      selectedEventTypes,
      formPaymentMethods,
      showNotes,
      showProof,
      qrisImageUrl,
      termsAgreementText,
      termsContent,
      termsEnabled,
      termsLinkText,
      termsSuffixText,
      studioName,
    ],
  );
  const draftSnapshot = React.useMemo(
    () =>
      createFormBookingSnapshot({
        minDpPercent,
        minDpMap,
        brandColor,
        greeting,
        selectedEventTypes,
        customEventTypes,
        showNotes,
        showProof,
        termsEnabled,
        termsAgreementText,
        termsLinkText,
        termsSuffixText,
        termsContent,
        formSectionsByEventType,
        formPaymentMethods,
        bankAccounts,
        formLang,
      }),
    [
      bankAccounts,
      brandColor,
      customEventTypes,
      formLang,
      formSectionsByEventType,
      formPaymentMethods,
      greeting,
      minDpMap,
      minDpPercent,
      selectedEventTypes,
      showNotes,
      showProof,
      termsAgreementText,
      termsContent,
      termsEnabled,
      termsLinkText,
      termsSuffixText,
    ],
  );
  const serializedDraftSnapshot = React.useMemo(
    () => JSON.stringify(draftSnapshot),
    [draftSnapshot],
  );
  const hasUnsavedChanges =
    !loading &&
    lastSavedSnapshot !== null &&
    serializedDraftSnapshot !== lastSavedSnapshot;

  React.useEffect(() => {
    setSiteUrl(window.location.origin);
  }, [supabase]);

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "GOOGLE_DRIVE_SUCCESS") {
        setIsDriveConnected(true);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  React.useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (p) {
        setProfileId(p.id);
        setStudioName(p.studio_name || "");
        const loadedMinDpPercent = p.min_dp_percent ?? DEFAULTS.minDpPercent;
        setMinDpPercent(loadedMinDpPercent);
        // Load per-event-type DP map
        const savedMap: Record<string, { mode: "percent" | "fixed"; value: number }> =
          typeof p.min_dp_map === "object" && p.min_dp_map !== null
            ? Object.fromEntries(
                Object.entries(p.min_dp_map as Record<string, unknown>).map(([k, v]) => {
                  if (typeof v === "number") {
                    return [k, { mode: "percent" as const, value: v }];
                  }
                  if (v && typeof v === "object") {
                    const cfg = v as { mode?: unknown; value?: unknown };
                    return [
                      k,
                      {
                        mode: cfg.mode === "fixed" ? "fixed" : "percent",
                        value: typeof cfg.value === "number" ? cfg.value : 50,
                      },
                    ];
                  }
                  return [k, { mode: "percent" as const, value: 50 }];
                }),
              )
            : {};
        setMinDpMap(savedMap);
        const loadedBrandColor = p.form_brand_color || DEFAULTS.brandColor;
        const loadedGreeting = p.form_greeting || DEFAULTS.greeting;
        setBrandColor(loadedBrandColor);
        setGreeting(loadedGreeting);
        const loadedFormEventTypes = toStringArray(p.form_event_types);
        const loadedCustomEventTypes = toStringArray(p.custom_event_types);
        const loadedSelectedEventTypes =
          loadedFormEventTypes.length > 0
            ? [
                // Maintain order, keep saved selections + add new built-in types
                ...ALL_EVENT_TYPES.filter((t) => loadedFormEventTypes.includes(t)),
                ...ALL_EVENT_TYPES.filter((t) => !loadedFormEventTypes.includes(t)),
                ...loadedCustomEventTypes.filter((t) => loadedFormEventTypes.includes(t)),
                ...loadedCustomEventTypes.filter((t) => !loadedFormEventTypes.includes(t)),
              ]
            : [...ALL_EVENT_TYPES, ...loadedCustomEventTypes];
        setSelectedEventTypes(loadedSelectedEventTypes);
        setCustomEventTypes(loadedCustomEventTypes);
        const rawSections = (p as Record<string, unknown>).form_sections;
        let normalizedSections: FormSectionsByEventType = {};
        if (Array.isArray(rawSections)) {
          // Backward compatibility: old data stored as single array
          normalizedSections = {
            Umum: normalizeStoredFormLayout(rawSections, "Umum"),
          };
        } else if (rawSections && typeof rawSections === "object") {
          normalizedSections = Object.fromEntries(
            Object.entries(rawSections as Record<string, unknown>).map(([k, v]) => [
              k,
              normalizeStoredFormLayout(v, k),
            ]),
          ) as FormSectionsByEventType;
        }
        setFormSectionsByEventType(normalizedSections);
        const loadedShowNotes = p.form_show_notes ?? DEFAULTS.showNotes;
        const loadedBanks = normalizeBankAccounts(p.bank_accounts);
        const loadedPaymentMethods = normalizePaymentMethods(
          (p as Record<string, unknown>).form_payment_methods,
        );
        const loadedQrisImageUrl =
          typeof (p as Record<string, unknown>).qris_drive_file_id === "string"
            ? buildDriveImageUrl((p as Record<string, unknown>).qris_drive_file_id as string)
            : typeof (p as Record<string, unknown>).qris_image_url === "string"
              ? ((p as Record<string, unknown>).qris_image_url as string)
              : null;
        const loadedFormLang =
          ((p as Record<string, unknown>).form_lang as string) || "id";
        const loadedTermsEnabled =
          (p as Record<string, unknown>).form_terms_enabled === true;
        const loadedTermsAgreementText =
          typeof (p as Record<string, unknown>).form_terms_agreement_text === "string"
            ? ((p as Record<string, unknown>).form_terms_agreement_text as string)
            : DEFAULTS.termsAgreementText;
        const loadedTermsLinkText =
          typeof (p as Record<string, unknown>).form_terms_link_text === "string"
            ? ((p as Record<string, unknown>).form_terms_link_text as string)
            : DEFAULTS.termsLinkText;
        const loadedTermsSuffixText =
          typeof (p as Record<string, unknown>).form_terms_suffix_text === "string"
            ? ((p as Record<string, unknown>).form_terms_suffix_text as string)
            : DEFAULTS.termsSuffixText;
        const loadedTermsContent =
          typeof (p as Record<string, unknown>).form_terms_content === "string"
            ? ((p as Record<string, unknown>).form_terms_content as string)
            : DEFAULTS.termsContent;
        setShowNotes(loadedShowNotes);
        setBankAccounts(loadedBanks);
        setFormPaymentMethods(loadedPaymentMethods);
        setQrisImageUrl(loadedQrisImageUrl);
        setFormLang(loadedFormLang);
        setTermsEnabled(loadedTermsEnabled);
        setTermsAgreementText(loadedTermsAgreementText);
        setTermsLinkText(loadedTermsLinkText);
        setTermsSuffixText(loadedTermsSuffixText);
        setTermsContent(loadedTermsContent);

        if (p.vendor_slug) {
          setVendorSlug(p.vendor_slug);
        }
        const driveOk = !!(p as Record<string, unknown>)
          .google_drive_access_token;
        setIsDriveConnected(driveOk);
        const loadedShowProof = driveOk
          ? (p.form_show_proof ?? DEFAULTS.showProof)
          : false;
        setShowProof(loadedShowProof);
        setLastSavedSnapshot(
          JSON.stringify(
            createFormBookingSnapshot({
              minDpPercent: loadedMinDpPercent,
              minDpMap: savedMap,
              brandColor: loadedBrandColor,
              greeting: loadedGreeting,
              selectedEventTypes: loadedSelectedEventTypes,
              customEventTypes: loadedCustomEventTypes,
              showNotes: loadedShowNotes,
              showProof: loadedShowProof,
              termsEnabled: loadedTermsEnabled,
              termsAgreementText: loadedTermsAgreementText,
              termsLinkText: loadedTermsLinkText,
              termsSuffixText: loadedTermsSuffixText,
              termsContent: loadedTermsContent,
              formSectionsByEventType: normalizedSections,
              formPaymentMethods: loadedPaymentMethods,
              bankAccounts: loadedBanks,
              formLang: loadedFormLang,
            }),
          ),
        );
      }
      setLoading(false);
    }
    load();
  }, [supabase]);

  React.useEffect(() => {
    if (typeof window === "undefined" || !previewStorageKey || !vendorSlug) return;

    window.localStorage.setItem(
      previewStorageKey,
      JSON.stringify(previewPayload),
    );

    iframeRef.current?.contentWindow?.postMessage(
      {
        type: "clientdesk:form-preview-update",
        previewKey: previewStorageKey,
        payload: previewPayload,
      },
      window.location.origin,
    );
  }, [
    previewPayload,
    previewStorageKey,
    vendorSlug,
  ]);

  const customFormEventTypes = React.useMemo(
    () => (selectedEventTypes.length > 0 ? selectedEventTypes : allEventTypes),
    [selectedEventTypes, allEventTypes],
  );

  React.useEffect(() => {
    if (selectedEventTypes.length === 0) return;
    if (!selectedEventTypes.includes(selectedDpEventType)) {
      setSelectedDpEventType(selectedEventTypes[0]);
    }
  }, [selectedEventTypes, selectedDpEventType]);

  React.useEffect(() => {
    if (customFormEventTypes.length === 0) return;
    if (!customFormEventTypes.includes(selectedCustomFormEventType)) {
      setSelectedCustomFormEventType(customFormEventTypes[0]);
    }
  }, [customFormEventTypes, selectedCustomFormEventType]);

  // Get DP config for currently selected event type
  function getDpForEventType(eventType: string): { mode: "percent" | "fixed"; value: number } {
    return minDpMap[eventType] ?? { mode: "percent", value: minDpPercent };
  }

  function setDpForEventType(eventType: string, mode: "percent" | "fixed", value: number) {
    setMinDpMap((prev) => ({ ...prev, [eventType]: { mode, value } }));
  }

  const navigateToPath = React.useCallback(
    (href: string) => {
      const targetUrl = new URL(href, window.location.href);
      setPendingNavigation(null);
      setShowLeaveConfirm(false);
      window.location.assign(targetUrl.toString());
    },
    [],
  );

  async function handleSave() {
    if (!profileId) return false;
    setSaving(true);
    setSaveMessageTone("success");

    let slug = vendorSlug;
    if (!slug && studioName) {
      slug = studioName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      setVendorSlug(slug);
    }

    // Filter out empty bank accounts
    const validBanks = getValidBankAccounts(bankAccounts);
    const enabledBanks = getEnabledBankAccounts(bankAccounts);

    if (formPaymentMethods.length === 0) {
      setSavedMsg("Pilih minimal satu metode pembayaran.");
      setSaveMessageTone("error");
      setSaving(false);
      return false;
    }

    if (formPaymentMethods.includes("bank") && enabledBanks.length === 0) {
      setSavedMsg("Aktifkan minimal satu rekening bank untuk form booking.");
      setSaveMessageTone("error");
      setSaving(false);
      return false;
    }

    if (formPaymentMethods.includes("qris") && (!isDriveConnected || !qrisImageUrl)) {
      setSavedMsg("QRIS memerlukan Google Drive terhubung dan gambar QRIS yang sudah diupload.");
      setSaveMessageTone("error");
      setSaving(false);
      return false;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        vendor_slug: slug || null,
        min_dp_percent: minDpPercent,
        min_dp_map: minDpMap,
        form_brand_color: brandColor,
        form_greeting: greeting || null,
        form_event_types: selectedEventTypes,
        custom_event_types: customEventTypes,
        form_sections: formSectionsByEventType,
        form_show_notes: showNotes,
        form_show_proof: showProof,
        form_payment_methods: formPaymentMethods,
        form_terms_enabled: termsEnabled,
        form_terms_agreement_text: termsAgreementText || null,
        form_terms_link_text: termsLinkText || null,
        form_terms_suffix_text: termsSuffixText || null,
        form_terms_content: termsContent || null,
        bank_accounts: validBanks,
        form_lang: formLang,
      })
      .eq("id", profileId);

    if (error) {
      setSavedMsg("Gagal menyimpan.");
      setSaveMessageTone("error");
      setTimeout(() => setSavedMsg(""), 3000);
      setSaving(false);
      return false;
    }

    setBankAccounts(validBanks);
    setLastSavedSnapshot(
      JSON.stringify(
        createFormBookingSnapshot({
          minDpPercent,
          minDpMap,
          brandColor,
          greeting,
          selectedEventTypes,
          customEventTypes,
          showNotes,
          showProof,
          termsEnabled,
          termsAgreementText,
          termsLinkText,
          termsSuffixText,
          termsContent,
          formSectionsByEventType,
          formPaymentMethods,
          bankAccounts: validBanks,
          formLang,
        }),
      ),
    );
    setSavedMsg("Tersimpan!");
    setIframeKey((k) => k + 1);
    setTimeout(() => setSavedMsg(""), 3000);
    setSaving(false);
    return true;
  }

  function handleResetDefault() {
    setBrandColor(DEFAULTS.brandColor);
    setGreeting(DEFAULTS.greeting);
    setSelectedEventTypes([...DEFAULTS.eventTypes]);
    setShowNotes(DEFAULTS.showNotes);
    setShowProof(false); // Requires Google Drive — don't enable by default
    setFormPaymentMethods([...DEFAULTS.paymentMethods]);
    setTermsEnabled(DEFAULTS.termsEnabled);
    setTermsAgreementText(DEFAULTS.termsAgreementText);
    setTermsLinkText(DEFAULTS.termsLinkText);
    setTermsSuffixText(DEFAULTS.termsSuffixText);
    setTermsContent(DEFAULTS.termsContent);
    setMinDpPercent(DEFAULTS.minDpPercent);
    setMinDpMap({});
    setFormSectionsByEventType({});
    setBankAccounts([]);
    setFormLang("id");
    setQrisImageUrl(null);
    setShowResetConfirm(false);
  }

  function copyUrl() {
    navigator.clipboard.writeText(formUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function toggleEventType(t: string) {
    setSelectedEventTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  function updateBank(index: number, field: keyof BankAccount, value: string) {
    setBankAccounts((prev) =>
      prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)),
    );
  }

  function toggleBankEnabled(index: number) {
    setBankAccounts((prev) =>
      prev.map((bank, i) =>
        i === index ? { ...bank, enabled: !bank.enabled } : bank,
      ),
    );
  }

  function addBank() {
    if (bankAccounts.length < 5)
      setBankAccounts((prev) => [...prev, createEmptyBankAccount()]);
  }

  function removeBank(index: number) {
    setBankAccounts((prev) => prev.filter((_, i) => i !== index));
  }

  function updateFormSections(eventType: string, sections: FormLayoutItem[]) {
    setFormSectionsByEventType((prev) => ({
      ...prev,
      [eventType]: normalizeStoredFormLayout(sections, eventType),
    }));
  }

  function togglePaymentMethod(method: PaymentMethod) {
    setFormPaymentMethods((prev) =>
      prev.includes(method)
        ? prev.filter((item) => item !== method)
        : [...prev, method],
    );
  }

  function connectGoogleDrive() {
    const w = 520;
    const h = 700;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    window.open(
      "/api/google/drive/auth",
      "google-drive-auth",
      `width=${w},height=${h},left=${left},top=${top},popup=yes`,
    );
  }

  async function handleQrisFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    setQrisUploading(true);
    setSaveMessageTone("success");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/google/drive/upload-qris", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();

      if (!result.success) {
        setSavedMsg(result.error || "Gagal upload QRIS.");
        setSaveMessageTone("error");
        return;
      }

      setQrisImageUrl(result.qrisImageUrl || null);
      setSavedMsg("QRIS berhasil diupload.");
      setSaveMessageTone("success");
    } catch {
      setSavedMsg("Gagal upload QRIS.");
      setSaveMessageTone("error");
    } finally {
      if (qrisInputRef.current) qrisInputRef.current.value = "";
      setQrisUploading(false);
    }
  }

  async function handleDeleteQris() {
    setQrisDeleting(true);
    try {
      const res = await fetch("/api/google/drive/delete-qris", {
        method: "POST",
      });
      const result = await res.json();

      if (!result.success) {
        setSavedMsg(result.error || "Gagal menghapus QRIS.");
        setSaveMessageTone("error");
        return;
      }

      setQrisImageUrl(null);
      setSavedMsg("QRIS berhasil dihapus.");
      setSaveMessageTone("success");
    } catch {
      setSavedMsg("Gagal menghapus QRIS.");
      setSaveMessageTone("error");
    } finally {
      setQrisDeleting(false);
    }
  }

  React.useEffect(() => {
    if (typeof document === "undefined") return;

    const handleDocumentClick = (event: MouseEvent) => {
      if (!hasUnsavedChanges) return;
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const rawHref = anchor.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#")) return;
      if (
        rawHref.startsWith("mailto:") ||
        rawHref.startsWith("tel:") ||
        rawHref.startsWith("javascript:")
      ) {
        return;
      }

      const currentUrl = new URL(window.location.href);
      const nextUrl = new URL(anchor.href, currentUrl.href);
      const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      const currentPath = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;

      if (nextUrl.origin !== currentUrl.origin || nextPath === currentPath) return;

      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation(nextPath);
      setShowLeaveConfirm(true);
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [hasUnsavedChanges]);

  const inputClass =
    "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";
  const validBankAccounts = getValidBankAccounts(bankAccounts);
  const enabledBankAccounts = getEnabledBankAccounts(bankAccounts);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Form Booking Publik
        </h2>
        <p className="text-muted-foreground">
          Kelola dan bagikan form booking online untuk klien Anda.
        </p>
      </div>

      {/* Guidance banner when studio name is not set */}
      {!studioName && !loading && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4 flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-200 text-sm">Nama Studio belum diatur</p>
            <p className="text-amber-700 dark:text-amber-300 text-xs mt-1">
              Form booking memerlukan Nama Studio untuk membuat URL. Silakan atur Nama Studio di{" "}
              <a href={`/${locale}/settings`} className="underline font-medium">halaman Pengaturan</a> terlebih dahulu, lalu kembali ke sini.
            </p>
          </div>
        </div>
      )}

      {/* Main Content: Settings + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start pb-20 lg:pb-0">
        {/* LEFT: Settings — hidden on mobile when viewing preview */}
        <div
          className={`space-y-6 ${mobileTab === "preview" ? "hidden lg:block" : ""}`}
        >
          <div className="rounded-xl border bg-card p-1 shadow-sm">
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setSettingsTab("general")}
                className={`rounded-lg px-4 py-3 text-sm font-semibold transition-colors cursor-pointer ${
                  settingsTab === "general"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Pengaturan Umum
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab("customForm")}
                className={`rounded-lg px-4 py-3 text-sm font-semibold transition-colors cursor-pointer ${
                  settingsTab === "customForm"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Custom Form
              </button>
            </div>
          </div>

          {settingsTab === "general" && (
            <>
              {/* Payment Settings */}
              <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                <div className="px-6 py-4 border-b">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Percent className="w-4 h-4" /> Pengaturan Pembayaran
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Atur minimum DP berbeda untuk setiap jenis acara.
                  </p>
                </div>
                <div className="p-6 space-y-4">
                  {/* Event type selector */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Jenis Acara</label>
                    <select
                      value={selectedDpEventType}
                      onChange={(e) => setSelectedDpEventType(e.target.value)}
                      className={inputClass + " cursor-pointer"}
                    >
                      {selectedEventTypes.map((et) => (
                        <option key={et} value={et}>
                          {et}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* DP Mode Toggle + Value */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium">
                      Minimum DP —{" "}
                      <span className="text-primary">{selectedDpEventType}</span>
                    </label>
                    {/* Mode Toggle */}
                    <div className="flex rounded-lg border overflow-hidden w-fit">
                      <button
                        type="button"
                        onClick={() => setDpForEventType(selectedDpEventType, "percent", getDpForEventType(selectedDpEventType).value)}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${getDpForEventType(selectedDpEventType).mode === "percent" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
                      >
                        Persentase (%)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDpForEventType(selectedDpEventType, "fixed", getDpForEventType(selectedDpEventType).value)}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${getDpForEventType(selectedDpEventType).mode === "fixed" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
                      >
                        Nominal (Rp)
                      </button>
                    </div>
                    {/* Value Input */}
                    {getDpForEventType(selectedDpEventType).mode === "percent" ? (
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={getDpForEventType(selectedDpEventType).value}
                          onChange={(e) =>
                            setDpForEventType(
                              selectedDpEventType,
                              "percent",
                              Number(e.target.value),
                            )
                          }
                          className="flex-1 accent-primary h-2 cursor-pointer"
                        />
                        <span className="text-sm font-bold w-12 text-right tabular-nums">
                          {getDpForEventType(selectedDpEventType).value}%
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Rp</span>
                        <input
                          type="number"
                          min={0}
                          step={50000}
                          value={getDpForEventType(selectedDpEventType).value}
                          onChange={(e) =>
                            setDpForEventType(
                              selectedDpEventType,
                              "fixed",
                              Number(e.target.value),
                            )
                          }
                          className={inputClass + " flex-1"}
                          placeholder="500000"
                        />
                      </div>
                    )}
                  </div>

                  {/* Summary of all DP values */}
                  {Object.keys(minDpMap).length > 0 && (
                    <div className="pt-3 border-t space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Ringkasan DP
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedEventTypes.map((et) => {
                          const dp = minDpMap[et] ?? { mode: "percent" as const, value: minDpPercent };
                          const label = dp.mode === "fixed"
                            ? `Rp ${dp.value.toLocaleString("id-ID")}`
                            : `${dp.value}%`;
                          return (
                            <span
                              key={et}
                              className="text-[11px] px-2 py-1 rounded-md border bg-muted/50 text-muted-foreground"
                            >
                              {et}: <strong>{label}</strong>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Methods */}
              <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                <div className="px-6 py-4 border-b">
                  <h3 className="font-semibold flex items-center gap-2">
                    <CreditCard className="w-4 h-4" /> Metode Pembayaran
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pilih metode pembayaran yang tampil di form booking, atur rekening bank yang aktif, dan upload gambar QRIS.
                  </p>
                </div>
                <div className="p-6 space-y-4">
                  <div className="space-y-3 max-w-2xl">
                    {[
                      {
                        id: "bank" as PaymentMethod,
                        title: "Transfer Bank",
                        description: `${enabledBankAccounts.length}/${validBankAccounts.length} rekening aktif`,
                        icon: CreditCard,
                        disabled: false,
                      },
                      {
                        id: "qris" as PaymentMethod,
                        title: "QRIS",
                        description: qrisImageUrl
                          ? "Gambar QRIS siap dipakai"
                          : "Upload gambar QRIS",
                        icon: QrCode,
                        disabled: false,
                      },
                      {
                        id: "cash" as PaymentMethod,
                        title: "Cash",
                        description: "Bukti pembayaran otomatis nonaktif",
                        icon: Banknote,
                        disabled: false,
                      },
                    ].map((method) => {
                      const Icon = method.icon;
                      const active = formPaymentMethods.includes(method.id);
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => togglePaymentMethod(method.id)}
                          className={`rounded-xl border p-4 text-left transition-all cursor-pointer ${
                            active
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-input hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                }`}
                              >
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold">{method.title}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {method.description}
                                </p>
                              </div>
                            </div>
                            <div
                              className={`mt-1 h-5 w-5 rounded-full border ${
                                active ? "border-primary bg-primary" : "border-muted-foreground/30"
                              }`}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <CreditCard className="w-4 h-4" /> Rekening Bank
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Maksimal 5 rekening. Klien hanya melihat rekening yang dicentang aktif.
                        </p>
                      </div>
                      {bankAccounts.length < 5 && (
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          onClick={addBank}
                          className="gap-1.5 shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" /> Tambah
                        </Button>
                      )}
                    </div>

                    {bankAccounts.length === 0 ? (
                      <div className="rounded-lg border border-dashed px-4 py-6 text-center">
                        <p className="text-sm text-muted-foreground">
                          Belum ada rekening bank.
                        </p>
                      </div>
                    ) : (
                      bankAccounts.map((bank, i) => (
                        <div
                          key={bank.id}
                          className="rounded-lg border bg-background p-4 space-y-3 relative"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="text-xs font-semibold text-muted-foreground">
                              Rekening #{i + 1}
                            </span>
                            <div className="flex items-center gap-4">
                              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={bank.enabled}
                                  onChange={() => toggleBankEnabled(i)}
                                  className="accent-primary h-4 w-4"
                                />
                                Aktif di form booking
                              </label>
                              <button
                                type="button"
                                onClick={() => removeBank(i)}
                                className="text-red-500 hover:text-red-600 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">
                                Nama Bank
                              </label>
                              <input
                                value={bank.bank_name}
                                onChange={(e) =>
                                  updateBank(i, "bank_name", e.target.value)
                                }
                                placeholder="BCA / BNI / Mandiri"
                                className={inputClass}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">
                                Nomor Rekening
                              </label>
                              <input
                                value={bank.account_number}
                                onChange={(e) =>
                                  updateBank(i, "account_number", e.target.value)
                                }
                                placeholder="1234567890"
                                className={inputClass}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">
                                Atas Nama
                              </label>
                              <input
                                value={bank.account_name}
                                onChange={(e) =>
                                  updateBank(i, "account_name", e.target.value)
                                }
                                placeholder="Nama Pemilik Rekening"
                                className={inputClass}
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <QrCode className="w-4 h-4" /> QRIS
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          Gambar QRIS disimpan ke Google Drive vendor yang sedang login.
                        </p>
                      </div>
                      {isDriveConnected ? (
                        <span className="text-xs font-medium text-green-600 dark:text-green-400">
                          Google Drive terhubung
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          onClick={connectGoogleDrive}
                        >
                          Hubungkan Google Drive
                        </Button>
                      )}
                    </div>

                    {qrisImageUrl ? (
                      <div className="rounded-xl border bg-background p-4 space-y-3">
                        <div className="rounded-lg border bg-muted/30 p-4 flex items-center justify-center min-h-48">
                          <img
                            src={qrisImageUrl}
                            alt="QRIS"
                            referrerPolicy="no-referrer"
                            className="max-h-72 w-full object-contain"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            type="button"
                            onClick={() => qrisInputRef.current?.click()}
                            disabled={!isDriveConnected || qrisUploading}
                            className="gap-1.5"
                          >
                            {qrisUploading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4" />
                            )}
                            Ganti QRIS
                          </Button>
                          <Button
                            variant="outline"
                            type="button"
                            onClick={handleDeleteQris}
                            disabled={qrisDeleting}
                            className="gap-1.5 text-red-500 hover:text-red-600"
                          >
                            {qrisDeleting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                            Hapus
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => isDriveConnected && qrisInputRef.current?.click()}
                        disabled={!isDriveConnected || qrisUploading}
                        className={`w-full rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                          isDriveConnected
                            ? "border-input hover:border-primary/50 hover:bg-muted/30 cursor-pointer"
                            : "border-input opacity-60 cursor-not-allowed"
                        }`}
                      >
                        {qrisUploading ? (
                          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-2" />
                        ) : (
                          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        )}
                        <p className="text-sm font-medium">
                          {isDriveConnected
                            ? "Klik untuk upload QRIS"
                            : "Hubungkan Google Drive untuk upload QRIS"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Format gambar PNG / JPG. Akan tampil di form booking publik.
                        </p>
                      </button>
                    )}

                    <input
                      ref={qrisInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleQrisFileChange}
                    />
                  </div>

                  <div className="rounded-lg border bg-background px-4 py-3 text-xs text-muted-foreground">
                    Ringkasan: {formPaymentMethods.length > 0 ? formPaymentMethods.map(getPaymentMethodLabel).join(", ") : "belum ada metode aktif"}.
                    {formPaymentMethods.includes("bank")
                      ? ` Rekening aktif: ${enabledBankAccounts.length}.`
                      : ""}
                    {formPaymentMethods.includes("qris")
                      ? qrisImageUrl
                        ? " QRIS siap ditampilkan."
                        : " QRIS belum diupload."
                      : ""}
                  </div>
                </div>
              </div>

              {/* Customization */}
              <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                <div className="px-6 py-4 border-b">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Palette className="w-4 h-4" /> Kustomisasi Tampilan
                  </h3>
                </div>
                <div className="p-6 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Warna Brand</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={brandColor}
                        onChange={(e) => setBrandColor(e.target.value)}
                        className="w-10 h-10 rounded-lg border cursor-pointer p-0.5"
                      />
                      <input
                        value={brandColor}
                        onChange={(e) => setBrandColor(e.target.value)}
                        placeholder="#000000"
                        className={inputClass + " !w-32"}
                      />
                      <div
                        className="w-24 h-9 rounded-md"
                        style={{ backgroundColor: brandColor }}
                      ></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Teks Sapaan</label>
                    <input
                      value={greeting}
                      onChange={(e) => setGreeting(e.target.value)}
                      placeholder="Silakan isi formulir di bawah ini untuk booking."
                      className={inputClass}
                    />
                    <p className="text-xs text-muted-foreground">
                      Kosongkan untuk menggunakan teks default.
                    </p>
                  </div>

                  {/* Form Language */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />{" "}
                      {locale === "en" ? "Form Language" : "Bahasa Form"}
                    </label>
                    <select
                      value={formLang}
                      onChange={(e) => setFormLang(e.target.value)}
                      className={inputClass + " cursor-pointer"}
                    >
                      <option value="id">🇮🇩 Bahasa Indonesia</option>
                      <option value="en">🇬🇧 English</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      {locale === "en"
                        ? "Choose the language for the public booking form."
                        : "Pilih bahasa untuk form booking publik."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Event Types */}
              <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                <div className="px-6 py-4 border-b">
                  <h3 className="font-semibold flex items-center gap-2">
                    <List className="w-4 h-4" /> Tipe Acara
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pilih tipe acara yang tersedia di form booking.
                  </p>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {allEventTypes.map((t) => {
                      const isActive = selectedEventTypes.includes(t);
                      const isCustom = customEventTypes.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleEventType(t)}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${isActive ? "bg-primary text-primary-foreground border-primary" : "border-input text-muted-foreground hover:bg-muted/50"}`}
                        >
                          {t}
                          {isCustom && (
                            <span
                              className="ml-1.5 text-[10px] opacity-70 hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCustomEventTypes((prev) => prev.filter((c) => c !== t));
                                setSelectedEventTypes((prev) => prev.filter((c) => c !== t));
                                setMinDpMap((prev) => {
                                  const next = { ...prev };
                                  delete next[t];
                                  return next;
                                });
                                setFormSectionsByEventType((prev) => {
                                  const next = { ...prev };
                                  delete next[t];
                                  return next;
                                });
                              }}
                            >
                              ×
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {/* Add custom event type */}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <input
                      type="text"
                      value={newCustomType}
                      onChange={(e) => setNewCustomType(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const val = newCustomType.trim();
                          if (val && !allEventTypes.includes(val)) {
                            setCustomEventTypes((prev) => [...prev, val]);
                            setSelectedEventTypes((prev) => [...prev, val]);
                            setNewCustomType("");
                          }
                        }
                      }}
                      placeholder="Tambah tipe acara custom..."
                      className={inputClass + " flex-1 !h-8 text-xs"}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = newCustomType.trim();
                        if (val && !allEventTypes.includes(val)) {
                          setCustomEventTypes((prev) => [...prev, val]);
                          setSelectedEventTypes((prev) => [...prev, val]);
                          setNewCustomType("");
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg border text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                    >
                      Tambah
                    </button>
                  </div>
                </div>
              </div>

              {/* Field Toggles */}
              <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                <div className="px-6 py-4 border-b">
                  <h3 className="font-semibold flex items-center gap-2">
                    <ToggleRight className="w-4 h-4" /> Field Opsional
                  </h3>
                </div>
                <div className="p-6 space-y-3">
                  {[
                    {
                      label: "Catatan",
                      value: showNotes,
                      setter: setShowNotes,
                      disabled: false,
                    },
                  ].map((item) => (
                    <div key={item.label}>
                      <label
                        className={`flex items-center justify-between ${item.disabled ? "opacity-50" : "cursor-pointer"}`}
                      >
                        <span className="text-sm font-medium">{item.label}</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={item.value}
                          disabled={item.disabled}
                          onClick={() => !item.disabled && item.setter(!item.value)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${item.disabled ? "cursor-not-allowed" : "cursor-pointer"} ${item.value ? "bg-primary" : "bg-muted"}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${item.value ? "translate-x-6" : "translate-x-1"}`}
                          />
                        </button>
                      </label>
                    </div>
                  ))}
                  <p className="text-[11px] text-muted-foreground">
                    Upload bukti pembayaran di form publik akan mengikuti metode yang dipilih klien: aktif untuk bank/QRIS, nonaktif otomatis untuk cash.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                <div className="px-6 py-4 border-b">
                  <h3 className="font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Terms & Conditions
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tambahkan checkbox persetujuan di bagian paling bawah form booking, dengan teks custom dan popup yang bisa diformat.
                  </p>
                </div>
                <div className="p-6 space-y-4">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="text-sm font-medium">Aktifkan T&amp;C</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Saat aktif, klien harus menyetujui syarat sebelum booking bisa dikirim.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={termsEnabled}
                      onClick={() => setTermsEnabled((prev) => !prev)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${termsEnabled ? "bg-primary" : "bg-muted"}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${termsEnabled ? "translate-x-6" : "translate-x-1"}`}
                      />
                    </button>
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium">Teks sebelum hyperlink</label>
                      <input
                        value={termsAgreementText}
                        onChange={(e) => setTermsAgreementText(e.target.value)}
                        placeholder="Saya telah membaca & setuju terhadap"
                        className={inputClass}
                        disabled={!termsEnabled}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Teks hyperlink</label>
                      <input
                        value={termsLinkText}
                        onChange={(e) => setTermsLinkText(e.target.value)}
                        placeholder="Syarat & Ketentuan"
                        className={inputClass}
                        disabled={!termsEnabled}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Teks sesudah hyperlink</label>
                      <input
                        value={termsSuffixText}
                        onChange={(e) => setTermsSuffixText(e.target.value)}
                        placeholder="yang sudah ada."
                        className={inputClass}
                        disabled={!termsEnabled}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium">Isi popup T&amp;C</label>
                      <RichTextEditor
                        value={termsContent}
                        onChange={setTermsContent}
                        placeholder="Tulis syarat & ketentuan di sini. Bisa bold, italic, bullet list, numbering, heading, dan quote."
                        disabled={!termsEnabled}
                      />
                      <p className="text-xs text-muted-foreground">
                        Editor ini mendukung format dasar seperti bold, italic, underline, bullet list, numbering, heading, dan quote.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {settingsTab === "customForm" && (
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
              <div className="px-6 py-4 border-b">
                <h3 className="font-semibold flex items-center gap-2">
                  <List className="w-4 h-4" /> Custom Form
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Setiap jenis acara memiliki section bawaan sendiri: Informasi Klien, Detail Sesi, dan Paket Pembayaran. Item bawaan di dalamnya bisa direorder, lalu kamu bisa tambah field atau divider custom per section.
                </p>
              </div>
              <div className="p-6 space-y-4">
                {customFormEventTypes.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Jenis Acara</label>
                      <select
                        value={selectedCustomFormEventType}
                        onChange={(e) => setSelectedCustomFormEventType(e.target.value)}
                        className={inputClass + " cursor-pointer"}
                      >
                        {customFormEventTypes.map((eventType) => (
                          <option key={eventType} value={eventType}>
                            {eventType}
                          </option>
                        ))}
                      </select>
                    </div>
                    <CustomFormBuilder
                      eventType={selectedCustomFormEventType}
                      layout={normalizeStoredFormLayout(
                        formSectionsByEventType[selectedCustomFormEventType] || [],
                        selectedCustomFormEventType,
                      )}
                      onChange={(layout) =>
                        updateFormSections(selectedCustomFormEventType, layout)
                      }
                    />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Belum ada jenis acara aktif. Tambahkan dulu di Pengaturan Umum.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Save + Reset */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Simpan Pengaturan
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowResetConfirm(true)}
              className="gap-2 text-muted-foreground"
            >
              <RotateCcw className="w-4 h-4" /> Reset Default
            </Button>
            {savedMsg && (
              <span
                className={`text-sm ${
                  saveMessageTone === "error"
                    ? "text-red-600 dark:text-red-400"
                    : "text-green-600 dark:text-green-400"
                }`}
              >
                {savedMsg}
              </span>
            )}
          </div>

          {showResetConfirm && (
            <div
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => setShowResetConfirm(false)}
            >
              <div
                className="bg-card rounded-xl border shadow-lg p-6 max-w-sm w-full space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-semibold text-lg">Reset ke Default?</h3>
                <p className="text-sm text-muted-foreground">
                  Semua pengaturan form akan dikembalikan ke nilai default.
                  Perubahan belum tersimpan sampai Anda klik &quot;Simpan
                  Pengaturan&quot;.
                </p>
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowResetConfirm(false)}
                  >
                    Batal
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleResetDefault}
                    className="gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" /> Reset
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Dialog
            open={showLeaveConfirm}
            onOpenChange={(open) => {
              setShowLeaveConfirm(open);
              if (!open) setPendingNavigation(null);
            }}
          >
            <DialogContent className="overflow-x-hidden sm:max-w-lg">
              <DialogHeader className="items-center text-center">
                <DialogTitle className="text-xl">Simpan perubahan dulu?</DialogTitle>
                <DialogDescription className="max-w-sm">
                  Ada perubahan di Form Booking yang belum disimpan. Kalau kamu keluar sekarang, perubahan ini akan hilang.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 pt-2 sm:flex-col md:flex-row md:justify-center">
                <Button
                  variant="outline"
                  className="w-full md:w-auto"
                  onClick={() => {
                    setShowLeaveConfirm(false);
                    setPendingNavigation(null);
                  }}
                >
                  Tetap di Sini
                </Button>
                <Button
                  variant="outline"
                  className="w-full md:w-auto"
                  onClick={() => {
                    if (pendingNavigation) navigateToPath(pendingNavigation);
                  }}
                >
                  Keluar Tanpa Simpan
                </Button>
                <Button
                  className="w-full gap-2 md:w-auto"
                  onClick={async () => {
                    const saved = await handleSave();
                    if (saved && pendingNavigation) {
                      navigateToPath(pendingNavigation);
                    }
                  }}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Simpan & Keluar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* RIGHT: Linktree-Style Preview — hidden on mobile when viewing settings */}
        <div
          className={`sticky top-4 ${mobileTab === "settings" ? "hidden lg:flex" : "flex"}`}
          style={{
            height: "calc(100vh - 12rem)",
            maxHeight: "calc(100vh - 12rem)",
          }}
        >
          <div className="flex flex-col w-full">
            {/* Preview Header with Buttons */}
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Preview
              </h3>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIframeKey((k) => k + 1)}
                  title="Refresh"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
                {vendorSlug && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={copyUrl}
                      title="Salin URL"
                    >
                      {copied ? (
                        <ClipboardCheck className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => window.open(formUrl, "_blank")}
                      title="Buka di tab baru"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {vendorSlug ? (
              <div className="flex justify-center flex-1 min-h-0">
                {/* Linktree-style phone preview */}
                <div className="w-full max-w-[380px] flex flex-col min-h-0">
                  {/* URL Bar */}
                  <div className="bg-muted/80 dark:bg-muted/40 rounded-t-2xl px-4 py-2.5 flex items-center gap-2 border border-b-0 shrink-0">
                    <div className="flex gap-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
                    </div>
                    <div className="flex-1 text-center">
                      <span className="text-[11px] text-muted-foreground truncate block">
                        {formUrl
                          ? formUrl.replace(/^https?:\/\//, "")
                          : "Memuat preview..."}
                      </span>
                    </div>
                  </div>

                  {/* iframe content — fills remaining space */}
                  <div className="rounded-b-2xl overflow-hidden border border-t-0 bg-white dark:bg-background flex-1 min-h-0">
                    {previewSrc ? (
                      <iframe
                        ref={iframeRef}
                        key={iframeKey}
                        src={previewSrc}
                        className="w-full h-full"
                        title="Form Preview"
                        onLoad={() => {
                          if (!previewStorageKey || typeof window === "undefined") return;
                          iframeRef.current?.contentWindow?.postMessage(
                            {
                              type: "clientdesk:form-preview-update",
                              previewKey: previewStorageKey,
                              payload: previewPayload,
                            },
                            window.location.origin,
                          );
                        }}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-muted/10">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span className="text-xs">Menyiapkan preview...</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 rounded-2xl border bg-muted/20">
                <div className="text-center px-6 space-y-2">
                  <p className="text-3xl">📋</p>
                  <p className="text-sm font-medium">Form belum aktif</p>
                  <p className="text-xs text-muted-foreground">
                    {!studioName
                      ? "Atur Nama Studio di Pengaturan terlebih dahulu."
                      : "Klik \"Simpan Pengaturan\" untuk mengaktifkan form booking."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t z-40 lg:hidden">
        <div className="flex">
          <button
            onClick={() => setMobileTab("settings")}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors cursor-pointer ${mobileTab === "settings" ? "text-primary" : "text-muted-foreground"}`}
          >
            <Settings2 className="w-5 h-5" />
            Settings
          </button>
          <button
            onClick={() => {
              setMobileTab("preview");
              setIframeKey((k) => k + 1);
            }}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors cursor-pointer ${mobileTab === "preview" ? "text-primary" : "text-muted-foreground"}`}
          >
            <Eye className="w-5 h-5" />
            Preview
          </button>
        </div>
      </div>
    </div>
  );
}
