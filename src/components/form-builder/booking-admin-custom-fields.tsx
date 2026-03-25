"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import type {
  CustomFieldItem,
  CustomSectionItem,
} from "@/components/form-builder/booking-form-layout";

type AdminCustomItem = CustomFieldItem | CustomSectionItem;

type Props = {
  items: AdminCustomItem[];
  values: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  inputClass: string;
  textareaClass: string;
  selectClass: string;
  strings?: {
    checkboxYes?: string;
    checkboxNo?: string;
    selectPlaceholder?: string;
  };
};

function getOptions(
  field: CustomFieldItem,
  strings: Required<NonNullable<Props["strings"]>>,
): string[] {
  if (field.type === "checkbox") {
    return field.options && field.options.length > 0
      ? field.options
      : [strings.checkboxYes, strings.checkboxNo];
  }

  return field.options || [];
}

export function BookingAdminCustomFields({
  items,
  values,
  onChange,
  inputClass,
  textareaClass,
  selectClass,
  strings,
}: Props) {
  const locale = useLocale();
  const uiStrings: Required<NonNullable<Props["strings"]>> = {
    checkboxYes: locale === "en" ? "Yes" : "Ya",
    checkboxNo: locale === "en" ? "No" : "Tidak",
    selectPlaceholder: locale === "en" ? "Select..." : "Pilih...",
    ...strings,
  };

  return (
    <>
      {items.map((item) => {
        if (item.kind === "custom_section") {
          return (
            <div key={item.id} className="col-span-full pt-2">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {item.title}
                </h4>
                <div className="h-px flex-1 bg-border" />
              </div>
            </div>
          );
        }

        const options = getOptions(item, uiStrings);
        const isFullWidth = item.type === "textarea" || item.type === "checkbox";

        return (
          <div
            key={item.id}
            className={`space-y-1.5 ${isFullWidth ? "col-span-full" : ""}`}
          >
            <label className="text-xs font-medium text-muted-foreground">
              {item.label}
              {item.required && <span className="ml-0.5 text-red-500">*</span>}
            </label>

            {item.type === "textarea" ? (
              <textarea
                rows={3}
                value={values[item.id] || ""}
                onChange={(e) => onChange(item.id, e.target.value)}
                placeholder={item.placeholder}
                className={textareaClass}
                required={item.required}
              />
            ) : item.type === "select" ? (
              <select
                value={values[item.id] || ""}
                onChange={(e) => onChange(item.id, e.target.value)}
                className={selectClass}
                required={item.required}
              >
                <option value="">
                  {item.placeholder || uiStrings.selectPlaceholder}
                </option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : item.type === "checkbox" ? (
              <div className="space-y-2 rounded-lg border border-input bg-background px-3 py-3">
                {options.map((option) => (
                  <label
                    key={option}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <input
                      type="radio"
                      name={item.id}
                      value={option}
                      checked={(values[item.id] || "") === option}
                      onChange={(e) => onChange(item.id, e.target.value)}
                      required={item.required}
                      className="h-4 w-4 accent-primary"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            ) : (
              <input
                type={item.type === "number" ? "number" : "text"}
                value={values[item.id] || ""}
                onChange={(e) => onChange(item.id, e.target.value)}
                placeholder={item.placeholder}
                className={inputClass}
                required={item.required}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
