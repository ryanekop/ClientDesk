import {
  extractBuiltInExtraFieldValues,
  extractCustomFieldSnapshots,
  getGroupedCustomLayoutSections,
  type FormLayoutItem,
} from "@/components/form-builder/booking-form-layout";
import { getEventExtraFields } from "@/utils/form-extra-fields";
import type { TableColumnPreference } from "@/lib/table-column-prefs";

type BookingMetadataRow = {
  event_type?: string | null;
  extra_fields?: unknown;
};

function humanizeKey(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function buildExtraColumnId(key: string) {
  return `extra:${key}`;
}

export function buildCustomColumnId(key: string) {
  return `custom:${key}`;
}

export function buildBookingMetadataColumns(
  rows: BookingMetadataRow[],
  formSectionsByEventType: Record<string, FormLayoutItem[]>,
): TableColumnPreference[] {
  const builtInMap = new Map<string, string>();
  const customMap = new Map<string, string>();

  Object.entries(formSectionsByEventType).forEach(([eventType, layout]) => {
    getEventExtraFields(eventType).forEach((field) => {
      if (!builtInMap.has(field.key)) {
        builtInMap.set(field.key, field.label);
      }
    });
    getGroupedCustomLayoutSections(layout, eventType).forEach((section) => {
      section.items.forEach((item) => {
        if (item.kind !== "custom_field") return;
        if (!customMap.has(item.id)) {
          customMap.set(item.id, item.label);
        }
      });
    });
  });

  rows.forEach((row) => {
    getEventExtraFields(row.event_type || undefined).forEach((field) => {
      if (!builtInMap.has(field.key)) {
        builtInMap.set(field.key, field.label);
      }
    });

    Object.keys(extractBuiltInExtraFieldValues(row.extra_fields)).forEach((key) => {
      if (!builtInMap.has(key)) {
        builtInMap.set(key, humanizeKey(key));
      }
    });

    extractCustomFieldSnapshots(row.extra_fields).forEach((item) => {
      if (!customMap.has(item.id)) {
        customMap.set(item.id, item.label || humanizeKey(item.id));
      }
    });
  });

  return [
    ...Array.from(builtInMap.entries()).map(([key, label]) => ({
      id: buildExtraColumnId(key),
      label,
      visible: false,
    })),
    ...Array.from(customMap.entries()).map(([key, label]) => ({
      id: buildCustomColumnId(key),
      label,
      visible: false,
    })),
  ];
}

export function getBookingMetadataValue(
  extraFields: unknown,
  columnId: string,
): string {
  if (columnId.startsWith("extra:")) {
    const key = columnId.replace(/^extra:/, "");
    return extractBuiltInExtraFieldValues(extraFields)[key] || "-";
  }

  if (columnId.startsWith("custom:")) {
    const key = columnId.replace(/^custom:/, "");
    const snapshot = extractCustomFieldSnapshots(extraFields).find(
      (item) => item.id === key,
    );
    return snapshot?.value || "-";
  }

  return "-";
}
