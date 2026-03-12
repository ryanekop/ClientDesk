"use client";

import * as React from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Types ──

export type FormField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "checkbox";
  required: boolean;
  placeholder: string;
  options?: string[]; // for select type
};

export type FormSection = {
  id: string;
  title: string;
  fields: FormField[];
  is_builtin?: boolean; // protect built-in sections from deletion
};

// ── Helpers ──

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

const FIELD_TYPES: { value: FormField["type"]; label: string }[] = [
  { value: "text", label: "Teks" },
  { value: "textarea", label: "Teks Panjang" },
  { value: "number", label: "Angka" },
  { value: "select", label: "Pilihan (Dropdown)" },
  { value: "checkbox", label: "Centang (Ya/Tidak)" },
];

const inputClass =
  "placeholder:text-muted-foreground h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] transition-all dark:bg-input/30";

// ── Component ──

export default function CustomFormBuilder({
  sections,
  onChange,
}: {
  sections: FormSection[];
  onChange: (sections: FormSection[]) => void;
}) {
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    new Set(sections.map((s) => s.id))
  );
  const [editingFieldId, setEditingFieldId] = React.useState<string | null>(
    null
  );

  function toggleExpand(id: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Section CRUD
  function addSection() {
    const newSection: FormSection = {
      id: genId(),
      title: "Section Baru",
      fields: [],
    };
    onChange([...sections, newSection]);
    setExpandedSections((prev) => new Set(prev).add(newSection.id));
  }

  function updateSection(id: string, updates: Partial<FormSection>) {
    onChange(
      sections.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  }

  function deleteSection(id: string) {
    onChange(sections.filter((s) => s.id !== id));
  }

  function moveSectionUp(idx: number) {
    if (idx <= 0) return;
    const arr = [...sections];
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    onChange(arr);
  }

  function moveSectionDown(idx: number) {
    if (idx >= sections.length - 1) return;
    const arr = [...sections];
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    onChange(arr);
  }

  // Field CRUD
  function addField(sectionId: string) {
    const field: FormField = {
      id: genId(),
      label: "",
      type: "text",
      required: false,
      placeholder: "",
    };
    updateSection(sectionId, {
      fields: [
        ...(sections.find((s) => s.id === sectionId)?.fields || []),
        field,
      ],
    });
    setEditingFieldId(field.id);
  }

  function updateField(
    sectionId: string,
    fieldId: string,
    updates: Partial<FormField>
  ) {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    updateSection(sectionId, {
      fields: section.fields.map((f) =>
        f.id === fieldId ? { ...f, ...updates } : f
      ),
    });
  }

  function deleteField(sectionId: string, fieldId: string) {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    updateSection(sectionId, {
      fields: section.fields.filter((f) => f.id !== fieldId),
    });
  }

  function moveFieldUp(sectionId: string, idx: number) {
    const section = sections.find((s) => s.id === sectionId);
    if (!section || idx <= 0) return;
    const fields = [...section.fields];
    [fields[idx - 1], fields[idx]] = [fields[idx], fields[idx - 1]];
    updateSection(sectionId, { fields });
  }

  function moveFieldDown(sectionId: string, idx: number) {
    const section = sections.find((s) => s.id === sectionId);
    if (!section || idx >= section.fields.length - 1) return;
    const fields = [...section.fields];
    [fields[idx], fields[idx + 1]] = [fields[idx + 1], fields[idx]];
    updateSection(sectionId, { fields });
  }

  return (
    <div className="space-y-3">
      {sections.map((section, sIdx) => {
        const isExpanded = expandedSections.has(section.id);
        return (
          <div
            key={section.id}
            className="rounded-lg border bg-card shadow-sm"
          >
            {/* Section Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b">
              <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0" />
              <button
                type="button"
                onClick={() => toggleExpand(section.id)}
                className="flex items-center gap-1.5 flex-1 text-left cursor-pointer"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                )}
                <input
                  value={section.title}
                  onChange={(e) =>
                    updateSection(section.id, { title: e.target.value })
                  }
                  onClick={(e) => e.stopPropagation()}
                  className="font-semibold text-sm bg-transparent border-none outline-none flex-1 min-w-0"
                  placeholder="Nama Section"
                />
              </button>
              <span className="text-[10px] text-muted-foreground">
                {section.fields.length} field
              </span>
              <div className="flex gap-0.5">
                <button
                  type="button"
                  className="p-1 rounded hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => moveSectionUp(sIdx)}
                  title="Pindah ke atas"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => moveSectionDown(sIdx)}
                  title="Pindah ke bawah"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
              {!section.is_builtin && (
                <button
                  type="button"
                  className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 transition-colors cursor-pointer"
                  onClick={() => deleteSection(section.id)}
                  title="Hapus section"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Fields */}
            {isExpanded && (
              <div className="p-4 space-y-2">
                {section.fields.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    Belum ada field. Klik &quot;Tambah Field&quot; untuk
                    menambahkan.
                  </p>
                )}
                {section.fields.map((field, fIdx) => {
                  const isEditing = editingFieldId === field.id;
                  return (
                    <div
                      key={field.id}
                      className={`rounded-md border p-3 transition-all ${
                        isEditing ? "bg-muted/30 border-primary/30" : ""
                      }`}
                    >
                      {isEditing ? (
                        // Edit mode
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[11px] text-muted-foreground font-medium">
                                Label
                              </label>
                              <input
                                value={field.label}
                                onChange={(e) =>
                                  updateField(section.id, field.id, {
                                    label: e.target.value,
                                  })
                                }
                                placeholder="Nama Field"
                                className={inputClass}
                                autoFocus
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-muted-foreground font-medium">
                                Tipe
                              </label>
                              <select
                                value={field.type}
                                onChange={(e) =>
                                  updateField(section.id, field.id, {
                                    type: e.target.value as FormField["type"],
                                  })
                                }
                                className={inputClass + " cursor-pointer"}
                              >
                                {FIELD_TYPES.map((ft) => (
                                  <option key={ft.value} value={ft.value}>
                                    {ft.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="text-[11px] text-muted-foreground font-medium">
                              Placeholder
                            </label>
                            <input
                              value={field.placeholder}
                              onChange={(e) =>
                                updateField(section.id, field.id, {
                                  placeholder: e.target.value,
                                })
                              }
                              placeholder="Teks placeholder..."
                              className={inputClass}
                            />
                          </div>
                          {field.type === "select" && (
                            <div>
                              <label className="text-[11px] text-muted-foreground font-medium">
                                Opsi (pisahkan dengan koma)
                              </label>
                              <input
                                value={(field.options || []).join(", ")}
                                onChange={(e) =>
                                  updateField(section.id, field.id, {
                                    options: e.target.value
                                      .split(",")
                                      .map((o) => o.trim())
                                      .filter(Boolean),
                                  })
                                }
                                placeholder="Opsi 1, Opsi 2, Opsi 3"
                                className={inputClass}
                              />
                            </div>
                          )}
                          <div className="flex items-center justify-between pt-1">
                            <label className="flex items-center gap-2 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(e) =>
                                  updateField(section.id, field.id, {
                                    required: e.target.checked,
                                  })
                                }
                                className="accent-primary w-3.5 h-3.5"
                              />
                              Wajib diisi
                            </label>
                            <button
                              type="button"
                              onClick={() => setEditingFieldId(null)}
                              className="text-xs text-primary font-medium hover:underline cursor-pointer"
                            >
                              Selesai
                            </button>
                          </div>
                        </div>
                      ) : (
                        // View mode
                        <div className="flex items-center gap-2">
                          <div className="flex gap-0.5 shrink-0">
                            <button
                              type="button"
                              className="p-0.5 rounded hover:bg-muted/50 cursor-pointer"
                              onClick={() =>
                                moveFieldUp(section.id, fIdx)
                              }
                            >
                              <ArrowUp className="w-3 h-3 text-muted-foreground" />
                            </button>
                            <button
                              type="button"
                              className="p-0.5 rounded hover:bg-muted/50 cursor-pointer"
                              onClick={() =>
                                moveFieldDown(section.id, fIdx)
                              }
                            >
                              <ArrowDown className="w-3 h-3 text-muted-foreground" />
                            </button>
                          </div>
                          <Type className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm flex-1 truncate">
                            {field.label || (
                              <span className="text-muted-foreground italic">
                                (tanpa label)
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                            {FIELD_TYPES.find((ft) => ft.value === field.type)
                              ?.label || field.type}
                          </span>
                          {field.required && (
                            <span className="text-red-500 text-[10px] font-bold">
                              *
                            </span>
                          )}
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => setEditingFieldId(field.id)}
                            title="Edit field"
                          >
                            <Type className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 transition-colors cursor-pointer"
                            onClick={() =>
                              deleteField(section.id, field.id)
                            }
                            title="Hapus field"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => addField(section.id)}
                  className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline cursor-pointer pt-1"
                >
                  <Plus className="w-3 h-3" /> Tambah Field
                </button>
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={addSection}
        className="flex items-center gap-2 w-full justify-center py-3 rounded-lg border border-dashed text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-all cursor-pointer"
      >
        <Plus className="w-4 h-4" /> Tambah Section
      </button>
    </div>
  );
}
