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
  required?: boolean;
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
  notesLabel?: string;
  description?: string;
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
  layoutMode?: FormLayoutMode;
};

type SessionFieldGroup =
  | "schedule"
  | "split_location"
  | "location"
  | "extra_non_location";

type SessionFieldGroups = Record<SessionFieldGroup, BuiltInFieldDefinition[]>;

type SessionFieldOrderStrategy = "desired" | "legacy_regressed";

export type FormLayoutMode = "normal" | "split";
export type FormLayoutByMode = Partial<Record<FormLayoutMode, FormLayoutItem[]>>;

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
    title: "Detail Sesi/Acara",
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

const SESSION_NOTES_FIELD: BuiltInFieldDefinition = {
  builtinId: "notes",
  label: "Catatan",
  category: "Sesi",
  sectionId: "session_details",
};

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

const BUILT_IN_REQUIRED_LOCKED_IDS = new Set<BuiltInFieldId>([
  "client_name",
  "client_whatsapp",
  "event_type",
  "session_date",
  "session_time",
  "akad_date",
  "akad_time",
  "resepsi_date",
  "resepsi_time",
  "wisuda_session1_date",
  "wisuda_session1_time",
  "wisuda_session2_date",
  "wisuda_session2_time",
  "service_package",
  "dp_paid",
  "bank_accounts",
  "payment_proof",
]);

const BUILT_IN_REQUIRED_DEFAULT_IDS = new Set<BuiltInFieldId>([
  ...BUILT_IN_REQUIRED_LOCKED_IDS,
  "location",
]);

export function isBuiltInFieldRequiredLocked(builtinId: BuiltInFieldId) {
  return BUILT_IN_REQUIRED_LOCKED_IDS.has(builtinId);
}

export function isBuiltInFieldRequiredByDefault(builtinId: BuiltInFieldId) {
  return BUILT_IN_REQUIRED_DEFAULT_IDS.has(builtinId);
}

export function resolveBuiltInFieldRequired(
  item: Pick<BuiltInFieldItem, "builtinId" | "required">,
) {
  if (isBuiltInFieldRequiredLocked(item.builtinId)) return true;
  if (typeof item.required === "boolean") return item.required;
  return isBuiltInFieldRequiredByDefault(item.builtinId);
}

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
  const required = isBuiltInFieldRequiredByDefault(builtinId);
  return {
    id: `builtin:${builtinId}`,
    kind: "builtin_field",
    builtinId,
    required: required ? true : undefined,
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

function getSessionExtraFieldDefinitions(extraFieldKeys: Iterable<string>) {
  return Array.from(extraFieldKeys)
    .map((key) => getExtraFieldDefinitionByKey(key))
    .filter((field): field is NonNullable<typeof field> => Boolean(field));
}

function toExtraBuiltInFieldDefinition(
  extraField: NonNullable<ReturnType<typeof getExtraFieldDefinitionByKey>>,
): BuiltInFieldDefinition {
  return {
    builtinId: `extra:${extraField.key}` as BuiltInFieldId,
    label: extraField.label,
    category: "Sesi",
    sectionId: "session_details",
  };
}

function getSplitToggleFields(eventType: string): BuiltInFieldDefinition[] {
  if (eventType === "Wedding") {
    return WEDDING_BUILT_IN_FIELDS.filter(
      (field) => field.builtinId === "wedding_split_toggle",
    );
  }
  if (eventType === "Wisuda") {
    return WISUDA_BUILT_IN_FIELDS.filter(
      (field) => field.builtinId === "wisuda_split_toggle",
    );
  }
  return [];
}

function isSplitCapableEventType(eventType: string) {
  return eventType === "Wedding" || eventType === "Wisuda";
}

function resolveLayoutModeForEvent(
  eventType: string,
  layoutMode?: FormLayoutMode,
): FormLayoutMode {
  if (!isSplitCapableEventType(eventType)) return "normal";
  return layoutMode === "split" ? "split" : "normal";
}

const WEDDING_SPLIT_LOCATION_EXTRA_KEYS = new Set(["tempat_akad", "tempat_resepsi"]);
const WISUDA_SPLIT_LOCATION_EXTRA_KEYS = new Set([
  "tempat_wisuda_1",
  "tempat_wisuda_2",
]);

function isSplitLocationExtraField(eventType: string, key: string) {
  if (eventType === "Wedding") {
    return WEDDING_SPLIT_LOCATION_EXTRA_KEYS.has(key);
  }
  if (eventType === "Wisuda") {
    return WISUDA_SPLIT_LOCATION_EXTRA_KEYS.has(key);
  }
  return false;
}

function getSplitScheduleFields(eventType: string): BuiltInFieldDefinition[] {
  if (eventType === "Wedding") {
    return WEDDING_BUILT_IN_FIELDS.filter(
      (field) => field.builtinId !== "wedding_split_toggle",
    );
  }
  if (eventType === "Wisuda") {
    return WISUDA_BUILT_IN_FIELDS.filter(
      (field) => field.builtinId !== "wisuda_split_toggle",
    );
  }
  return [];
}

function getLocationFields(eventType: string): BuiltInFieldDefinition[] {
  if (eventType === "Wedding") {
    return [
      {
        builtinId: "location",
        label: "Lokasi",
        category: "Sesi",
        sectionId: "session_details",
      },
      {
        builtinId: "location_detail",
        label: "Location Details",
        category: "Sesi",
        sectionId: "session_details",
      },
    ];
  }

  return [
    {
      builtinId: "location",
      label: "Lokasi",
      category: "Sesi",
      sectionId: "session_details",
    },
    {
      builtinId: "location_detail",
      label: "Location Details",
      category: "Sesi",
      sectionId: "session_details",
    },
  ];
}

function buildSessionFieldGroups(
  eventType: string,
  extraFieldKeys: Iterable<string>,
  layoutMode?: FormLayoutMode,
): SessionFieldGroups {
  const resolvedLayoutMode = resolveLayoutModeForEvent(eventType, layoutMode);
  const splitScheduleFields = getSplitScheduleFields(eventType);
  const locationFields = getLocationFields(eventType);
  const extraFields = getSessionExtraFieldDefinitions(extraFieldKeys);
  const splitLocationFields = extraFields
    .filter((field) => field.isLocation && isSplitLocationExtraField(eventType, field.key))
    .map(toExtraBuiltInFieldDefinition);
  const regularLocationFields = extraFields
    .filter((field) => field.isLocation && !isSplitLocationExtraField(eventType, field.key))
    .map(toExtraBuiltInFieldDefinition);
  const extraNonLocationFields = extraFields
    .filter((field) => !field.isLocation)
    .map(toExtraBuiltInFieldDefinition);
  const baseLocationField = locationFields.find((field) => field.builtinId === "location");
  const locationDetailField = locationFields.find(
    (field) => field.builtinId === "location_detail",
  );
  const splitSchedule =
    resolvedLayoutMode === "split" ? splitScheduleFields : DEFAULT_SESSION_FIELDS;
  const locationGroup: BuiltInFieldDefinition[] = [];

  if (resolvedLayoutMode === "normal" && baseLocationField) {
    locationGroup.push(baseLocationField);
  }
  if (locationDetailField) {
    locationGroup.push(locationDetailField);
  }
  locationGroup.push(...regularLocationFields);

  return {
    schedule: splitSchedule,
    split_location: resolvedLayoutMode === "split" ? splitLocationFields : [],
    location: locationGroup,
    extra_non_location: extraNonLocationFields,
  };
}

function getSessionBuiltInOrderIds(
  eventType: string,
  options: BuiltInFieldDefinitionOptions,
  strategy: SessionFieldOrderStrategy,
): BuiltInFieldId[] {
  const resolvedLayoutMode = resolveLayoutModeForEvent(eventType, options.layoutMode);
  const extraFieldKeys = new Set<string>(
    (EVENT_EXTRA_FIELDS[eventType] || []).map((field) => field.key),
  );
  (options.extraFieldKeys || []).forEach((key) => {
    if (getExtraFieldDefinitionByKey(key)) {
      extraFieldKeys.add(key);
    }
  });

  const sessionFieldGroups = buildSessionFieldGroups(
    eventType,
    extraFieldKeys,
    options.layoutMode,
  );
  const splitToggleFields = getSplitToggleFields(eventType);
  const splitLocationFieldIds = sessionFieldGroups.split_location.map(
    (field) => field.builtinId,
  );
  const locationFieldIds = sessionFieldGroups.location.map((field) => field.builtinId);
  const extraNonLocationFieldIds = sessionFieldGroups.extra_non_location.map(
    (field) => field.builtinId,
  );
  const splitFallbackScheduleIds: BuiltInFieldId[] = DEFAULT_SESSION_FIELDS.map(
    (field) => field.builtinId,
  );
  const scheduleIds: BuiltInFieldId[] =
    resolvedLayoutMode === "split" && strategy === "legacy_regressed"
      ? [
          ...sessionFieldGroups.schedule.map((field) => field.builtinId),
          ...splitFallbackScheduleIds,
        ]
      : sessionFieldGroups.schedule.map((field) => field.builtinId);
  const splitHiddenFallbackIds: BuiltInFieldId[] =
    resolvedLayoutMode === "split" && strategy === "desired"
      ? [...splitFallbackScheduleIds, "location"]
      : [];
  const orderedEventSpecificIds: BuiltInFieldId[] =
    strategy === "desired"
      ? resolvedLayoutMode === "split"
        ? [
            ...splitLocationFieldIds,
            ...locationFieldIds,
            ...extraNonLocationFieldIds,
          ]
        : [...locationFieldIds, ...extraNonLocationFieldIds]
      : resolvedLayoutMode === "split"
        ? [
            "location",
            ...locationFieldIds,
            ...splitLocationFieldIds,
            ...extraNonLocationFieldIds,
          ]
        : [...extraNonLocationFieldIds, ...locationFieldIds];

  return [
    "event_type",
    ...splitToggleFields.map((field) => field.builtinId),
    ...scheduleIds,
    ...orderedEventSpecificIds,
    ...splitHiddenFallbackIds,
    SESSION_NOTES_FIELD.builtinId,
  ];
}

export function getBuiltInFieldDefinitions(
  eventType: string,
  options: BuiltInFieldDefinitionOptions = {},
): BuiltInFieldDefinition[] {
  const extraFieldKeys = new Set<string>(
    (EVENT_EXTRA_FIELDS[eventType] || []).map((field) => field.key),
  );
  (options.extraFieldKeys || []).forEach((key) => {
    if (getExtraFieldDefinitionByKey(key)) {
      extraFieldKeys.add(key);
    }
  });

  const splitToggleFields = getSplitToggleFields(eventType);
  const sessionFieldGroups = buildSessionFieldGroups(
    eventType,
    extraFieldKeys,
    options.layoutMode,
  );
  const splitToggleIds = new Set(
    splitToggleFields.map((field) => field.builtinId),
  );
  const sessionFieldPool = new Map<BuiltInFieldId, BuiltInFieldDefinition>([
    ...splitToggleFields,
    ...sessionFieldGroups.schedule,
    ...sessionFieldGroups.split_location,
    ...sessionFieldGroups.location,
    ...sessionFieldGroups.extra_non_location,
    SESSION_NOTES_FIELD,
  ].map((field) => [field.builtinId, field] as const));
  const orderedSessionFieldIds = getSessionBuiltInOrderIds(eventType, options, "desired");
  const orderedSessionFields = orderedSessionFieldIds
    .filter((builtinId) => !splitToggleIds.has(builtinId))
    .map((builtinId) => sessionFieldPool.get(builtinId))
    .filter((field): field is BuiltInFieldDefinition => Boolean(field));
  const sessionFields = [...splitToggleFields, ...orderedSessionFields];

  return [
    ...BASE_BUILT_IN_FIELDS,
    ...sessionFields,
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
    const candidateModes: FormLayoutMode[] = isSplitCapableEventType(candidateEventType)
      ? ["normal", "split"]
      : ["normal"];
    candidateModes.forEach((mode) => {
      getBuiltInFieldDefinitions(candidateEventType, {
        extraFieldKeys: knownExtraFieldKeys,
        layoutMode: mode,
      }).forEach((definition) => {
        if (!merged.has(definition.builtinId)) {
          merged.set(definition.builtinId, definition);
        }
      });
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

export function createDefaultFormLayout(
  eventType: string,
  options: Pick<BuiltInFieldDefinitionOptions, "layoutMode"> = {},
): FormLayoutItem[] {
  const buckets = initializeBuckets();
  getBuiltInFieldDefinitions(eventType, options).forEach((field) => {
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
    notesLabel: "",
    description: "",
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
  return value.trim().length > 0 ? value : undefined;
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
  const normalizedRequired =
    typeof item.required === "boolean" ? item.required : undefined;
  const required = isBuiltInFieldRequiredLocked(item.builtinId)
    ? true
    : normalizedRequired;
  return {
    ...createBuiltInFieldItem(item.builtinId),
    required,
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

function normalizeCustomSectionItem(item: CustomSectionItem): CustomSectionItem {
  return {
    id: item.id,
    kind: "custom_section",
    title: typeof item.title === "string" ? item.title : "Divider Baru",
    notesLabel: normalizeOptionalText(item.notesLabel),
    description: normalizeOptionalText(item.description),
  };
}

function filterOrderToPresentIds(
  order: BuiltInFieldId[],
  presentIds: BuiltInFieldId[],
) {
  const presentSet = new Set(presentIds);
  return order.filter((builtinId) => presentSet.has(builtinId));
}

function buildLegacySplitRegressionOrderCandidates(
  eventType: string,
  options: BuiltInFieldDefinitionOptions,
): BuiltInFieldId[][] {
  const extraFieldKeys = new Set<string>(
    (EVENT_EXTRA_FIELDS[eventType] || []).map((field) => field.key),
  );
  (options.extraFieldKeys || []).forEach((key) => {
    if (getExtraFieldDefinitionByKey(key)) {
      extraFieldKeys.add(key);
    }
  });

  const sessionFieldGroups = buildSessionFieldGroups(
    eventType,
    extraFieldKeys,
    options.layoutMode,
  );
  const splitToggleIds = getSplitToggleFields(eventType).map(
    (field) => field.builtinId,
  );
  const splitScheduleIds = sessionFieldGroups.schedule.map(
    (field) => field.builtinId,
  );
  const splitLocationIds = sessionFieldGroups.split_location.map(
    (field) => field.builtinId,
  );
  const locationDetailId = sessionFieldGroups.location.find(
    (field) => field.builtinId === "location_detail",
  )?.builtinId;
  const extraNonLocationIds = sessionFieldGroups.extra_non_location.map(
    (field) => field.builtinId,
  );
  const visibleNormalCoreIds = [
    ...(locationDetailId ? [locationDetailId] : []),
    ...extraNonLocationIds,
    SESSION_NOTES_FIELD.builtinId,
  ];

  const candidateOrders: BuiltInFieldId[][] = [
    getSessionBuiltInOrderIds(eventType, options, "legacy_regressed"),
    [
      "event_type",
      ...splitToggleIds,
      ...DEFAULT_SESSION_FIELDS.map((field) => field.builtinId),
      "location",
      ...visibleNormalCoreIds,
      ...splitScheduleIds,
      ...splitLocationIds,
    ],
    [
      "event_type",
      ...DEFAULT_SESSION_FIELDS.map((field) => field.builtinId),
      "location",
      ...visibleNormalCoreIds,
      ...splitToggleIds,
      ...splitScheduleIds,
      ...splitLocationIds,
    ],
    [
      "event_type",
      ...visibleNormalCoreIds,
      ...splitToggleIds,
      ...splitScheduleIds,
      ...splitLocationIds,
    ],
    [
      "event_type",
      ...(locationDetailId ? [locationDetailId] : []),
      SESSION_NOTES_FIELD.builtinId,
      ...splitToggleIds,
      ...splitScheduleIds,
      ...splitLocationIds,
      ...extraNonLocationIds,
    ],
    [
      "event_type",
      ...splitToggleIds,
      ...(locationDetailId ? [locationDetailId] : []),
      ...extraNonLocationIds,
      SESSION_NOTES_FIELD.builtinId,
      ...splitScheduleIds,
      ...splitLocationIds,
    ],
  ];

  const seen = new Set<string>();
  return candidateOrders.filter((order) => {
    const key = order.join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function maybeMigrateSessionBuiltInOrder(
  items: SectionContentItem[],
  eventType: string,
  options: BuiltInFieldDefinitionOptions,
): SectionContentItem[] {
  const isSplitEvent = eventType === "Wedding" || eventType === "Wisuda";
  if (!isSplitEvent) return items;
  const resolvedLayoutMode = resolveLayoutModeForEvent(eventType, options.layoutMode);
  if (resolvedLayoutMode !== "split") return items;

  const builtInItems = items.filter(
    (item): item is BuiltInFieldItem => item.kind === "builtin_field",
  );
  if (builtInItems.length === 0) return items;
  const currentOrderIds = builtInItems.map((item) => item.builtinId);
  const desiredOrderIds = getSessionBuiltInOrderIds(eventType, options, "desired");
  const desiredOrderSet = new Set(desiredOrderIds);

  if (currentOrderIds.some((id) => !desiredOrderSet.has(id))) {
    return items;
  }

  const matchesLegacyRegression = buildLegacySplitRegressionOrderCandidates(
    eventType,
    options,
  ).some((candidateOrder) => {
    const filteredCandidate = filterOrderToPresentIds(candidateOrder, currentOrderIds);
    return filteredCandidate.join("|") === currentOrderIds.join("|");
  });

  if (!matchesLegacyRegression) {
    return items;
  }

  const itemById = new Map(
    builtInItems.map((item) => [item.builtinId, item] as const),
  );
  const reorderedBuiltIns = filterOrderToPresentIds(
    desiredOrderIds,
    currentOrderIds,
  )
    .map((builtinId) => itemById.get(builtinId))
    .filter((item): item is BuiltInFieldItem => Boolean(item));

  if (reorderedBuiltIns.length !== builtInItems.length) {
    return items;
  }

  let reorderedIndex = 0;
  return items.map((item) => {
    if (item.kind !== "builtin_field") return item;
    const nextItem = reorderedBuiltIns[reorderedIndex];
    reorderedIndex += 1;
    return nextItem || item;
  });
}

function normalizeNewLayout(
  items: FormLayoutItem[],
  eventType: string,
  options: Pick<BuiltInFieldDefinitionOptions, "layoutMode"> = {},
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
  const builtInOptions: BuiltInFieldDefinitionOptions = {
    extraFieldKeys: explicitExtraFieldKeys,
    layoutMode: options.layoutMode,
  };
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

    buckets[currentSection].push(normalizeCustomSectionItem(item));
  });

  getBuiltInFieldDefinitions(eventType, builtInOptions).forEach((field) => {
    if (seenBuiltIns.has(field.builtinId)) return;
    buckets[field.sectionId].push(createBuiltInFieldItem(field.builtinId));
  });

  buckets.session_details = maybeMigrateSessionBuiltInOrder(
    buckets.session_details,
    eventType,
    builtInOptions,
  );

  return flattenBuckets(buckets);
}

export function normalizeStoredFormLayout(
  raw: unknown,
  eventType: string,
  options: Pick<BuiltInFieldDefinitionOptions, "layoutMode"> = {},
): FormLayoutItem[] {
  if (!raw) return createDefaultFormLayout(eventType, options);

  if (Array.isArray(raw) && raw.every(isNewLayoutItem)) {
    return normalizeNewLayout(raw, eventType, options);
  }

  if (Array.isArray(raw)) {
    return normalizeNewLayout(
      legacySectionsToLayout(eventType, raw as FormSection[]),
      eventType,
      options,
    );
  }

  return createDefaultFormLayout(eventType, options);
}

function isFormLayoutByMode(value: unknown): value is FormLayoutByMode {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return "normal" in candidate || "split" in candidate;
}

export function resolveNormalizedActiveFormLayout(
  formSectionsByEventType: Record<string, FormLayoutItem[] | FormLayoutByMode>,
  eventType: string | null | undefined,
  options: Pick<BuiltInFieldDefinitionOptions, "layoutMode"> = {},
): FormLayoutItem[] {
  const normalizedEventType = normalizeEventTypeName(eventType) || eventType || "";
  const candidateLayout = normalizedEventType
    ? formSectionsByEventType[normalizedEventType] ||
      formSectionsByEventType.Umum ||
      []
    : formSectionsByEventType.Umum || [];
  const resolvedLayoutMode = resolveLayoutModeForEvent(
    normalizedEventType || "Umum",
    options.layoutMode,
  );
  const candidateRaw = isFormLayoutByMode(candidateLayout)
    ? resolvedLayoutMode === "split"
      ? candidateLayout.split
      : candidateLayout.normal ?? candidateLayout.split ?? []
    : candidateLayout;

  return normalizeStoredFormLayout(
    candidateRaw,
    normalizedEventType || "Umum",
    { layoutMode: resolvedLayoutMode },
  );
}

export function groupFormLayoutBySection(
  raw: unknown,
  eventType: string,
  options: Pick<BuiltInFieldDefinitionOptions, "layoutMode"> = {},
): GroupedFormLayoutSection[] {
  const normalized = normalizeStoredFormLayout(raw, eventType, options);
  const buckets = initializeBuckets();
  let currentSection: BuiltInSectionId = "client_info";

  normalized.forEach((item) => {
    if (item.kind === "builtin_section") {
      currentSection = item.sectionId;
      return;
    }

    if (item.kind === "builtin_field") {
      const sectionId = getSectionIdForBuiltInField(item.builtinId, eventType, options);
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
  options: Pick<BuiltInFieldDefinitionOptions, "layoutMode"> = {},
): GroupedCustomLayoutSection[] {
  return groupFormLayoutBySection(raw, eventType, options).map((section) => ({
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
  options: Pick<BuiltInFieldDefinitionOptions, "layoutMode"> = {},
): CustomFieldSnapshot[] {
  const snapshots: CustomFieldSnapshot[] = [];

  getGroupedCustomLayoutSections(raw, eventType, options).forEach((section) => {
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
  options: Pick<BuiltInFieldDefinitionOptions, "layoutMode"> = {},
): string[] {
  const wrap =
    format === "drive"
      ? (key: string) => `{${key}}`
      : (key: string) => `{{${key}}}`;

  return getGroupedCustomLayoutSections(raw, eventType, options)
    .flatMap((section) =>
      section.items
        .filter((item): item is CustomFieldItem => item.kind === "custom_field")
        .map((item) => wrap(item.id)),
    );
}

export function getCustomFieldPreviewVars(
  raw: unknown,
  eventType: string,
  options: Pick<BuiltInFieldDefinitionOptions, "layoutMode"> = {},
): Record<string, string> {
  return Object.fromEntries(
    getGroupedCustomLayoutSections(raw, eventType, options).flatMap((section) =>
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
