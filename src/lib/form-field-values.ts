export type CustomFieldSnapshot = {
  id: string;
  label: string;
  type: string;
  value: string;
  sectionId?: string;
  sectionTitle?: string;
};

function isCustomFieldSnapshot(value: unknown): value is CustomFieldSnapshot {
  return (
    value !== null &&
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

  if (!customFields || typeof customFields !== "object" || Array.isArray(customFields)) {
    return [];
  }

  return Object.entries(customFields).map(([key, value]) => ({
    id: key,
    label: key,
    type: "text",
    value: stringifyFormFieldValue(value),
  })).filter((item) => item.value.length > 0);
}

export function extractBuiltInExtraFieldValues(
  raw: unknown,
): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};

  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>)
      .filter(([key]) => key !== "custom_fields")
      .map(([key, value]) => [key, stringifyFormFieldValue(value)] as const)
      .filter(([, value]) => value.length > 0),
  ) as Record<string, string>;
}
