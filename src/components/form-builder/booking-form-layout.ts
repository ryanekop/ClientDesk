import {
  EVENT_EXTRA_FIELDS,
  getExtraFieldDefinitionByKey,
} from "@/utils/form-extra-fields";
import { normalizeEventTypeName } from "@/lib/event-type-config";
import { FREELANCER_ASSIGNMENTS_EXTRA_FIELD_KEY } from "@/lib/freelancer-session-assignments";

export type CustomFieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "checkbox";

export type FormField = {
  id: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  placeholder: string;
  options?: string[];
};

export type FormSection = {
  id: string;
  title: string;
  fields: FormField[];
  is_builtin?: boolean;
};

export type BuiltInCategory = "Klien" | "Sesi" | "Pembayaran";

export type BuiltInSectionId =
  | "client_info"
  | "session_details"
  | "payment_details";

export type BuiltInFieldId =
  | "client_name"
  | "client_whatsapp"
  | "instagram"
  | "event_type"
  | "wedding_split_toggle"
  | "wisuda_split_toggle"
  | "akad_date"
  | "akad_time"
  | "resepsi_date"
  | "resepsi_time"
  | "wisuda_session1_date"
  | "wisuda_session1_time"
  | "wisuda_session2_date"
  | "wisuda_session2_time"
  | "session_date"
  | "session_time"
  | "location"
  | "location_detail"
  | "notes"
  | "service_package"
  | "addon_packages"
  | "dp_paid"
  | "bank_accounts"
  | "payment_proof"
  | `extra:${string}`;

export type BuiltInSectionDefinition = {
  sectionId: BuiltInSectionId;
  title: string;
  category: BuiltInCategory;
};

export type BuiltInFieldDefinition = {
  builtinId: BuiltInFieldId;
  label: string;
  category: BuiltInCategory;
  sectionId: BuiltInSectionId;
};

export type BuiltInSectionItem = {
  id: string;
  kind: "builtin_section";
  sectionId: BuiltInSectionId;
};

export type BuiltInFieldItem = {
  id: string;
  kind: "builtin_field";
  builtinId: BuiltInFieldId;
  labelOverride?: string;
  description?: string;
  hidden?: boolean;
};

export type CustomFieldItem = {
  id: string;
  kind: "custom_field";
  label: string;
  type: CustomFieldType;
  required: boolean;
  placeholder: string;
  options?: string[];
  description?: string;
  hidden?: boolean;
};

export type CustomSectionItem = {
  id: string;
  kind: "custom_section";
  title: string;
};

export type SectionContentItem =
  | BuiltInFieldItem
  | CustomFieldItem
  | CustomSectionItem;

export type FormLayoutItem = BuiltInSectionItem | SectionContentItem;

export type GroupedFormLayoutSection = {
  section: BuiltInSectionDefinition;
  items: SectionContentItem[];
};

export type CustomFieldSnapshot = {
  id: string;
  label: string;
  type: CustomFieldType;
  value: string;
  sectionId: BuiltInSectionId;
  sectionTitle: string;
};

export type GroupedCustomLayoutSection = {
  sectionId: BuiltInSectionId;
  sectionTitle: string;
  items: Array<CustomFieldItem | CustomSectionItem>;
};

type BuiltInFieldDefinitionOptions = {
  extraFieldKeys?: string[];
};

function getKnownExtraFieldKeys() {
  return Array.from(
    new Set(
      Object.values(EVENT_EXTRA_FIELDS).flatMap((fields) =>
        fields.map((field) => field.key),
      ),
    ),
  );
}

const BUILT_IN_SECTIONS: BuiltInSectionDefinition[] = [
  {
    sectionId: "client_info",
    title: "Informasi Klien",
    category: "Klien",
  },
  {
    sectionId: "session_details",
    title: "Detail Sesi",
    category: "Sesi",
  },
  {
    sectionId: "payment_details",
    title: "Paket Pembayaran",
    category: "Pembayaran",
  },
];

const BASE_BUILT_IN_FIELDS: BuiltInFieldDefinition[] = [
  {
    builtinId: "client_name",
    label: "Nama Lengkap",
    category: "Klien",
    sectionId: "client_info",
  },
  {
    builtinId: "client_whatsapp",
    label: "Nomor WhatsApp",
    category: "Klien",
    sectionId: "client_info",
  },
  {
    builtinId: "instagram",
    label: "Instagram",
    category: "Klien",
    sectionId: "client_info",
  },
  {
    builtinId: "event_type",
    label: "Tipe Acara",
    category: "Sesi",
    sectionId: "session_details",
  },
];

const WEDDING_BUILT_IN_FIELDS: BuiltInFieldDefinition[] = [
  {
    builtinId: "wedding_split_toggle",
    label: "Toggle Akad & Resepsi beda hari",
    category: "Sesi",
    sectionId: "session_details",
  },
  {
    builtinId: "akad_date",
    label: "Ceremony Date",
    category: "Sesi",
    sectionId: "session_details",
  },
  {
    builtinId: "akad_time",
    label: "Ceremony Time",
    category: "Sesi",
    sectionId: "session_details",
  },
  {
    builtinId: "resepsi_date",
    label: "Reception Date",
    category: "Sesi",
    sectionId: "session_details",
  },
  {
    builtinId: "resepsi_time",
    label: "Reception Time",
    category: "Sesi",
    sectionId: "session_details",
  },
];

const WISUDA_BUILT_IN_FIELDS: BuiltInFieldDefinition[] = [
  {
    builtinId: "wisuda_split_toggle",
    label: "Toggle Sesi 1 & Sesi 2",
    category: "Sesi",
    sectionId: "session_details",
  },
  {
    builtinId: "wisuda_session1_date",
    label: "Tanggal Sesi 1",
    category: "Sesi",
    sectionId: "session_details",
  },
  {
    builtinId: "wisuda_session1_time",
    label: "Jam Sesi 1",
    category: "Sesi",
    sectionId: "session_details",
  },
  {
    builtinId: "wisuda_session2_date",
    label: "Tanggal Sesi 2",
    category: "Sesi",
    sectionId: "session_details",
  },
  {
    builtinId: "wisuda_session2_time",
    label: "Jam Sesi 2",
    category: "Sesi",
    sectionId: "session_details",
  },
];

const DEFAULT_SESSION_FIELDS: BuiltInFieldDefinition[] = [
  {
    builtinId: "session_date",
    label: "Jadwal Sesi",
    category: "Sesi",
    sectionId: "session_details",
  },
  {
    builtinId: "session_time",
    label: "Jam",
    category: "Sesi",
    sectionId: "session_details",
  },
];

const PAYMENT_BUILT_IN_FIELDS: BuiltInFieldDefinition[] = [
  {
    builtinId: "service_package",
    label: "Paket Layanan",
    category: "Pembayaran",
    sectionId: "payment_details",
  },
  {
    builtinId: "addon_packages",
    label: "Paket Tambahan",
    category: "Pembayaran",
    sectionId: "payment_details",
  },
  {
    builtinId: "dp_paid",
    label: "DP Dibayar",
    category: "Pembayaran",
    sectionId: "payment_details",
  },
  {
    builtinId: "bank_accounts",
    label: "Rekening Pembayaran",
    category: "Pembayaran",
    sectionId: "payment_details",
  },
  {
    builtinId: "payment_proof",
    label: "Bukti Pembayaran",
    category: "Pembayaran",
    sectionId: "payment_details",
  },
];

function customFieldToLayout(field: FormField): CustomFieldItem {
  return {
    id: field.id,
    kind: "custom_field",
    label: field.label,
    type: field.type,
    required: field.required,
    placeholder: field.placeholder,
    options: Array.isArray(field.options) ? field.options : undefined,
  };
}

function isCustomFieldType(value: unknown): value is CustomFieldType {
  return (
    value === "text" ||
    value === "textarea" ||
    value === "number" ||
    value === "select" ||
    value === "checkbox"
  );
}

function normalizeLegacyField(raw: unknown, fallbackIndex: number): FormField | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const field = raw as Record<string, unknown>;
  const options = Array.isArray(field.options)
    ? field.options.filter((option): option is string => typeof option === "string")
    : undefined;

  return {
    id:
      typeof field.id === "string" && field.id.length > 0
        ? field.id
        : `legacy-field-${fallbackIndex}`,
    label: typeof field.label === "string" ? field.label : "",
    type: isCustomFieldType(field.type) ? field.type : "text",
    required: Boolean(field.required),
    placeholder:
      typeof field.placeholder === "string" ? field.placeholder : "",
    options,
  };
}

function getLegacySectionFields(section: unknown): FormField[] {
  if (!section || typeof section !== "object") {
    return [];
  }

  const rawFields = (section as Record<string, unknown>).fields;
  if (!Array.isArray(rawFields)) {
    return [];
  }

  return rawFields
    .map((field, index) => normalizeLegacyField(field, index))
    .filter((field): field is FormField => field !== null);
}

function createBuiltInSectionItem(sectionId: BuiltInSectionId): BuiltInSectionItem {
  return {
    id: `section:${sectionId}`,
    kind: "builtin_section",
    sectionId,
  };
}

export function createBuiltInFieldItem(
  builtinId: BuiltInFieldId,
): BuiltInFieldItem {
  return {
    id: `builtin:${builtinId}`,
    kind: "builtin_field",
    builtinId,
  };
}

function initializeBuckets(): Record<BuiltInSectionId, SectionContentItem[]> {
  return {
    client_info: [],
    session_details: [],
    payment_details: [],
  };
}

function flattenBuckets(
  buckets: Record<BuiltInSectionId, SectionContentItem[]>,
): FormLayoutItem[] {
  return BUILT_IN_SECTIONS.flatMap((section) => [
    createBuiltInSectionItem(section.sectionId),
    ...buckets[section.sectionId],
  ]);
}

function legacySectionsToLayout(
  eventType: string,
  sections: FormSection[],
): FormLayoutItem[] {
  const buckets = initializeBuckets();
  const clientSection = sections.find(
    (section) =>
      !!section &&
      typeof section === "object" &&
      (section as FormSection).id === "builtin-client-info",
  );
  const sessionSection = sections.find(
    (section) =>
      !!section &&
      typeof section === "object" &&
      (section as FormSection).id === "builtin-session-details",
  );
  const clientCustomFields = getLegacySectionFields(clientSection);
  const sessionCustomFields = getLegacySectionFields(sessionSection);
  const additionalSections = sections.filter(
    (section) =>
      !!section &&
      typeof section === "object" &&
      section.id !== "builtin-client-info" &&
      section.id !== "builtin-session-details",
  );

  const clientBuiltIns = getBuiltInFieldDefinitions(eventType).filter(
    (field) => field.sectionId === "client_info",
  );
  const sessionBuiltIns = getBuiltInFieldDefinitions(eventType).filter(
    (field) => field.sectionId === "session_details",
  );
  const paymentBuiltIns = getBuiltInFieldDefinitions(eventType).filter(
    (field) => field.sectionId === "payment_details",
  );

  buckets.client_info.push(
    ...clientBuiltIns.map((field) => createBuiltInFieldItem(field.builtinId)),
    ...clientCustomFields.map(customFieldToLayout),
  );
  buckets.session_details.push(
    ...sessionBuiltIns.map((field) => createBuiltInFieldItem(field.builtinId)),
    ...sessionCustomFields.map(customFieldToLayout),
  );
  additionalSections.forEach((section, index) => {
    const customFields = getLegacySectionFields(section);
    if (!customFields.length) {
      return;
    }

    buckets.session_details.push({
      id: typeof section.id === "string" ? section.id : `legacy-section-${index}`,
      kind: "custom_section",
      title: typeof section.title === "string" ? section.title : "Section Lama",
    });
    buckets.session_details.push(...customFields.map(customFieldToLayout));
  });
  buckets.payment_details.push(
    ...paymentBuiltIns.map((field) => createBuiltInFieldItem(field.builtinId)),
  );

  return flattenBuckets(buckets);
}

export function getBuiltInSectionDefinitions(): BuiltInSectionDefinition[] {
  return BUILT_IN_SECTIONS;
}

export function getBuiltInSectionDefinition(
  sectionId: BuiltInSectionId,
): BuiltInSectionDefinition | undefined {
  return BUILT_IN_SECTIONS.find((section) => section.sectionId === sectionId);
}

export function getBuiltInFieldDefinitions(
  eventType: string,
  options: BuiltInFieldDefinitionOptions = {},
): BuiltInFieldDefinition[] {
  const isWeddingEvent = eventType === "Wedding";
  const isWisudaEvent = eventType === "Wisuda";
  const extraFieldKeys = new Set<string>(
    (EVENT_EXTRA_FIELDS[eventType] || []).map((field) => field.key),
  );
  (options.extraFieldKeys || []).forEach((key) => {
    if (getExtraFieldDefinitionByKey(key)) {
      extraFieldKeys.add(key);
    }
  });

  const extraFields = Array.from(extraFieldKeys)
    .map((key) => getExtraFieldDefinitionByKey(key))
    .filter((field): field is NonNullable<typeof field> => Boolean(field))
    .map((field) => ({
      builtinId: `extra:${field.key}` as BuiltInFieldId,
      label: field.label,
      category: "Sesi" as const,
      sectionId: "session_details" as const,
    }));
  const locationFields =
    isWeddingEvent
      ? [
          {
            builtinId: "location_detail" as const,
            label: "Location Details",
            category: "Sesi" as const,
            sectionId: "session_details" as const,
          },
        ]
      : [
          {
            builtinId: "location" as const,
            label: "Lokasi",
            category: "Sesi" as const,
            sectionId: "session_details" as const,
          },
          {
            builtinId: "location_detail" as const,
            label: "Location Details",
            category: "Sesi" as const,
            sectionId: "session_details" as const,
          },
        ];

  const splitSessionFields = isWeddingEvent
    ? WEDDING_BUILT_IN_FIELDS
    : isWisudaEvent
      ? WISUDA_BUILT_IN_FIELDS
      : [];

  return [
    ...BASE_BUILT_IN_FIELDS,
    ...splitSessionFields,
    ...DEFAULT_SESSION_FIELDS,
    ...extraFields,
    ...locationFields,
    {
      builtinId: "notes",
      label: "Catatan",
      category: "Sesi",
      sectionId: "session_details",
    },
    ...PAYMENT_BUILT_IN_FIELDS,
  ];
}

export function getBuiltInFieldCatalogDefinitions(
  eventType: string,
): BuiltInFieldDefinition[] {
  const knownExtraFieldKeys = getKnownExtraFieldKeys();
  const candidateEventTypes = Array.from(
    new Set([
      eventType,
      "Umum",
      "Wedding",
      "Wisuda",
      ...Object.keys(EVENT_EXTRA_FIELDS),
    ]),
  );
  const merged = new Map<BuiltInFieldId, BuiltInFieldDefinition>();

  candidateEventTypes.forEach((candidateEventType) => {
    getBuiltInFieldDefinitions(candidateEventType, {
      extraFieldKeys: knownExtraFieldKeys,
    }).forEach((definition) => {
      if (!merged.has(definition.builtinId)) {
        merged.set(definition.builtinId, definition);
      }
    });
  });

  return Array.from(merged.values());
}

export function getBuiltInFieldDefinition(
  builtinId: BuiltInFieldId,
  eventType: string,
  options: BuiltInFieldDefinitionOptions = {},
): BuiltInFieldDefinition | undefined {
  return (
    getBuiltInFieldDefinitions(eventType, options).find(
      (field) => field.builtinId === builtinId,
    ) ||
    getBuiltInFieldCatalogDefinitions(eventType).find(
      (field) => field.builtinId === builtinId,
    )
  );
}

export function getSectionIdForBuiltInField(
  builtinId: BuiltInFieldId,
  eventType: string,
  options: BuiltInFieldDefinitionOptions = {},
): BuiltInSectionId {
  return (
    getBuiltInFieldDefinition(builtinId, eventType, options)?.sectionId ??
    "session_details"
  );
}

export function createDefaultFormLayout(eventType: string): FormLayoutItem[] {
  const buckets = initializeBuckets();
  getBuiltInFieldDefinitions(eventType).forEach((field) => {
    buckets[field.sectionId].push(createBuiltInFieldItem(field.builtinId));
  });
  return flattenBuckets(buckets);
}

export function createCustomFieldItem(): CustomFieldItem {
  return {
    id: Math.random().toString(36).slice(2, 10),
    kind: "custom_field",
    label: "",
    type: "text",
    required: false,
    placeholder: "",
    description: "",
    hidden: false,
  };
}

export function createCustomSectionItem(): CustomSectionItem {
  return {
    id: Math.random().toString(36).slice(2, 10),
    kind: "custom_section",
    title: "Divider Baru",
  };
}

function isNewLayoutItem(value: unknown): value is FormLayoutItem {
  return (
    !!value &&
    typeof value === "object" &&
    "kind" in value &&
    (((value as FormLayoutItem).kind === "builtin_section" &&
      "sectionId" in value) ||
      ((value as FormLayoutItem).kind === "builtin_field" &&
        "builtinId" in value) ||
      (value as FormLayoutItem).kind === "custom_field" ||
      (value as FormLayoutItem).kind === "custom_section")
  );
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeOptionalOptions(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = value
    .filter((option): option is string => typeof option === "string")
    .map((option) => option.trim())
    .filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeBuiltInFieldItem(item: BuiltInFieldItem): BuiltInFieldItem {
  return {
    ...createBuiltInFieldItem(item.builtinId),
    labelOverride: normalizeOptionalText(item.labelOverride),
    description: normalizeOptionalText(item.description),
    hidden: item.hidden === true ? true : undefined,
  };
}

function normalizeCustomFieldItem(item: CustomFieldItem): CustomFieldItem {
  return {
    id: item.id,
    kind: "custom_field",
    label: typeof item.label === "string" ? item.label : "",
    type: isCustomFieldType(item.type) ? item.type : "text",
    required: Boolean(item.required),
    placeholder: typeof item.placeholder === "string" ? item.placeholder : "",
    options: normalizeOptionalOptions(item.options),
    description: normalizeOptionalText(item.description),
    hidden: item.hidden === true ? true : undefined,
  };
}

function normalizeNewLayout(
  items: FormLayoutItem[],
  eventType: string,
): FormLayoutItem[] {
  const explicitExtraFieldKeys = Array.from(
    new Set(
      items.flatMap((item) => {
        if (item.kind !== "builtin_field") return [];
        if (!item.builtinId.startsWith("extra:")) return [];
        const extraFieldKey = item.builtinId.slice("extra:".length);
        return getExtraFieldDefinitionByKey(extraFieldKey)
          ? [extraFieldKey]
          : [];
      }),
    ),
  );
  const builtInOptions = { extraFieldKeys: explicitExtraFieldKeys };
  const validBuiltInIds = new Set([
    ...getBuiltInFieldDefinitions(eventType, builtInOptions).map(
      (field) => field.builtinId,
    ),
    ...getBuiltInFieldCatalogDefinitions(eventType).map(
      (field) => field.builtinId,
    ),
  ]);
  const seenBuiltIns = new Set<BuiltInFieldId>();
  const buckets = initializeBuckets();
  let currentSection: BuiltInSectionId = "client_info";

  items.forEach((item) => {
    if (item.kind === "builtin_section") {
      currentSection = item.sectionId;
      return;
    }

    if (item.kind === "builtin_field") {
      if (!validBuiltInIds.has(item.builtinId) || seenBuiltIns.has(item.builtinId)) {
        return;
      }

      const sectionId = getSectionIdForBuiltInField(
        item.builtinId,
        eventType,
        builtInOptions,
      );
      seenBuiltIns.add(item.builtinId);
      currentSection = sectionId;
      buckets[sectionId].push(normalizeBuiltInFieldItem(item));
      return;
    }

    if (item.kind === "custom_field") {
      buckets[currentSection].push(normalizeCustomFieldItem(item));
      return;
    }

    buckets[currentSection].push(item);
  });

  getBuiltInFieldDefinitions(eventType, builtInOptions).forEach((field) => {
    if (seenBuiltIns.has(field.builtinId)) return;
    buckets[field.sectionId].push(createBuiltInFieldItem(field.builtinId));
  });

  return flattenBuckets(buckets);
}

export function normalizeStoredFormLayout(
  raw: unknown,
  eventType: string,
): FormLayoutItem[] {
  if (!raw) return createDefaultFormLayout(eventType);

  if (Array.isArray(raw) && raw.every(isNewLayoutItem)) {
    return normalizeNewLayout(raw, eventType);
  }

  if (Array.isArray(raw)) {
    return normalizeNewLayout(legacySectionsToLayout(eventType, raw as FormSection[]), eventType);
  }

  return createDefaultFormLayout(eventType);
}

export function resolveNormalizedActiveFormLayout(
  formSectionsByEventType: Record<string, FormLayoutItem[]>,
  eventType: string | null | undefined,
): FormLayoutItem[] {
  const normalizedEventType = normalizeEventTypeName(eventType) || eventType || "";
  const candidateLayout = normalizedEventType
    ? formSectionsByEventType[normalizedEventType] ||
      formSectionsByEventType.Umum ||
      []
    : formSectionsByEventType.Umum || [];

  return normalizeStoredFormLayout(
    candidateLayout,
    normalizedEventType || "Umum",
  );
}

export function groupFormLayoutBySection(
  raw: unknown,
  eventType: string,
): GroupedFormLayoutSection[] {
  const normalized = normalizeStoredFormLayout(raw, eventType);
  const buckets = initializeBuckets();
  let currentSection: BuiltInSectionId = "client_info";

  normalized.forEach((item) => {
    if (item.kind === "builtin_section") {
      currentSection = item.sectionId;
      return;
    }

    if (item.kind === "builtin_field") {
      const sectionId = getSectionIdForBuiltInField(item.builtinId, eventType);
      currentSection = sectionId;
      buckets[sectionId].push(item);
      return;
    }

    buckets[currentSection].push(item);
  });

  return BUILT_IN_SECTIONS.map((section) => ({
    section,
    items: buckets[section.sectionId],
  }));
}

export function flattenGroupedFormLayout(
  sections: GroupedFormLayoutSection[],
): FormLayoutItem[] {
  const buckets = initializeBuckets();

  sections.forEach((section) => {
    buckets[section.section.sectionId] = section.items;
  });

  return flattenBuckets(buckets);
}

export function getGroupedCustomLayoutSections(
  raw: unknown,
  eventType: string,
): GroupedCustomLayoutSection[] {
  return groupFormLayoutBySection(raw, eventType).map((section) => ({
    sectionId: section.section.sectionId,
    sectionTitle: section.section.title,
    items: section.items.filter(
      (item): item is CustomFieldItem | CustomSectionItem =>
        item.kind === "custom_section" ||
        (item.kind === "custom_field" && item.hidden !== true),
    ),
  }));
}

export function buildCustomFieldSnapshots(
  raw: unknown,
  eventType: string,
  values: Record<string, string>,
): CustomFieldSnapshot[] {
  const snapshots: CustomFieldSnapshot[] = [];

  getGroupedCustomLayoutSections(raw, eventType).forEach((section) => {
    section.items.forEach((item) => {
      if (item.kind !== "custom_field") return;
      const value = values[item.id];
      if (!value) return;

      snapshots.push({
        id: item.id,
        label: item.label,
        type: item.type,
        value,
        sectionId: section.sectionId,
        sectionTitle: section.sectionTitle,
      });
    });
  });

  return snapshots;
}

function isCustomFieldSnapshot(value: unknown): value is CustomFieldSnapshot {
  return (
    !!value &&
    typeof value === "object" &&
    "id" in value &&
    "label" in value &&
    "type" in value &&
    "value" in value
  );
}

export function stringifyFormFieldValue(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => stringifyFormFieldValue(item))
      .filter((item) => item.length > 0)
      .join(", ");
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map((item) => stringifyFormFieldValue(item))
      .filter((item) => item.length > 0)
      .join(", ");
  }

  return "";
}

export function extractCustomFieldSnapshots(raw: unknown): CustomFieldSnapshot[] {
  if (!raw || typeof raw !== "object") return [];

  const customFields = (raw as Record<string, unknown>).custom_fields;
  if (Array.isArray(customFields) && customFields.every(isCustomFieldSnapshot)) {
    return customFields.map((item) => ({
      ...item,
      id: String(item.id),
      label: String(item.label),
      value: stringifyFormFieldValue(item.value),
    }));
  }

  return [];
}

export function extractLegacyCustomFieldValues(
  raw: unknown,
): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};

  const customFields = (raw as Record<string, unknown>).custom_fields;
  if (!customFields || typeof customFields !== "object" || Array.isArray(customFields)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(customFields)
      .map(([key, value]) => [key, stringifyFormFieldValue(value)] as const)
      .filter(([, value]) => value.length > 0),
  ) as Record<string, string>;
}

export function extractCustomFieldValueMap(
  raw: unknown,
): Record<string, string> {
  const snapshots = extractCustomFieldSnapshots(raw);
  if (snapshots.length > 0) {
    return Object.fromEntries(
      snapshots.map((item) => [item.id, item.value]),
    ) as Record<string, string>;
  }

  return extractLegacyCustomFieldValues(raw);
}

export function extractBuiltInExtraFieldValues(
  raw: unknown,
): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};

  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>)
      .filter(
        ([key]) =>
          key !== "custom_fields" &&
          key !== FREELANCER_ASSIGNMENTS_EXTRA_FIELD_KEY &&
          key !== "fastpik_project",
      )
      .map(([key, value]) => [key, stringifyFormFieldValue(value)] as const)
      .filter(([, value]) => value.length > 0),
  ) as Record<string, string>;
}

export function getCustomFieldTemplateTokens(
  raw: unknown,
  eventType: string,
  format: "calendar" | "drive" | "whatsapp" = "calendar",
): string[] {
  const wrap =
    format === "drive"
      ? (key: string) => `{${key}}`
      : (key: string) => `{{${key}}}`;

  return getGroupedCustomLayoutSections(raw, eventType)
    .flatMap((section) =>
      section.items
        .filter((item): item is CustomFieldItem => item.kind === "custom_field")
        .map((item) => wrap(item.id)),
    );
}

export function getCustomFieldPreviewVars(
  raw: unknown,
  eventType: string,
): Record<string, string> {
  return Object.fromEntries(
    getGroupedCustomLayoutSections(raw, eventType).flatMap((section) =>
      section.items
        .filter((item): item is CustomFieldItem => item.kind === "custom_field")
        .map((item) => [item.id, item.placeholder || item.label]),
    ),
  ) as Record<string, string>;
}

export function buildCustomFieldTemplateVars(raw: unknown): Record<string, string> {
  return Object.fromEntries(
    extractCustomFieldSnapshots(raw)
      .filter((item) => item.value.trim().length > 0)
      .map((item) => [item.id, item.value]),
  ) as Record<string, string>;
}
