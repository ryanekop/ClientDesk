"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Type,
  Rows3,
  Lock,
  FolderKanban,
} from "lucide-react";
import {
  createCustomFieldItem,
  createCustomSectionItem,
  flattenGroupedFormLayout,
  getBuiltInFieldDefinition,
  groupFormLayoutBySection,
  normalizeStoredFormLayout,
  type BuiltInSectionId,
  type CustomFieldItem,
  type CustomFieldType,
  type FormLayoutItem,
  type GroupedFormLayoutSection,
  type SectionContentItem,
} from "@/components/form-builder/booking-form-layout";

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: "text", label: "Teks" },
  { value: "textarea", label: "Teks Panjang" },
  { value: "number", label: "Angka" },
  { value: "select", label: "Pilihan (Dropdown)" },
  { value: "checkbox", label: "Checkbox (Yes/No)" },
];

const inputClass =
  "placeholder:text-muted-foreground h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] transition-all dark:bg-input/30";

function updateLayoutItem(
  items: SectionContentItem[],
  id: string,
  updates: Partial<SectionContentItem>,
): SectionContentItem[] {
  return items.map((item) =>
    item.id === id ? ({ ...item, ...updates } as SectionContentItem) : item,
  );
}

function removeItem(
  items: SectionContentItem[],
  id: string,
): { item: SectionContentItem | null; items: SectionContentItem[] } {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return { item: null, items };

  return {
    item: items[index],
    items: items.filter((item) => item.id !== id),
  };
}

function insertItem(
  items: SectionContentItem[],
  item: SectionContentItem,
  index?: number,
): SectionContentItem[] {
  const next = [...items];
  const insertionIndex =
    typeof index === "number" ? Math.max(0, Math.min(index, next.length)) : next.length;
  next.splice(insertionIndex, 0, item);
  return next;
}

function BuilderDragHandle({
  listeners,
  attributes,
  setActivatorNodeRef,
}: {
  listeners?: ReturnType<typeof useSortable>["listeners"];
  attributes?: ReturnType<typeof useSortable>["attributes"];
  setActivatorNodeRef?: ReturnType<typeof useSortable>["setActivatorNodeRef"];
}) {
  return (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className="touch-none select-none cursor-grab rounded p-1 text-muted-foreground/60 transition-colors hover:bg-muted/40 active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}

function SortableItemShell({
  id,
  children,
}: {
  id: string;
  children: (
    sortable: ReturnType<typeof useSortable>,
  ) => React.ReactNode;
}) {
  const sortable = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.35 : 1,
  };

  return (
    <div ref={sortable.setNodeRef} style={style}>
      {children(sortable)}
    </div>
  );
}

function SectionDropArea({
  sectionId,
  children,
}: {
  sectionId: BuiltInSectionId;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop:${sectionId}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={`space-y-3 rounded-xl transition-colors ${
        isOver ? "bg-primary/5" : ""
      }`}
    >
      {children}
    </div>
  );
}

function ItemMoveControls({
  index,
  itemsLength,
  onMove,
  onDelete,
  deleteTitle,
}: {
  index: number;
  itemsLength: number;
  onMove: (direction: "up" | "down") => void;
  onDelete?: () => void;
  deleteTitle?: string;
}) {
  return (
    <div className="flex shrink-0 gap-0.5">
      <button
        type="button"
        className="rounded p-1 transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-30"
        onClick={() => onMove("up")}
        disabled={index === 0}
        title="Pindah ke atas"
      >
        <ArrowUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className="rounded p-1 transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-30"
        onClick={() => onMove("down")}
        disabled={index === itemsLength - 1}
        title="Pindah ke bawah"
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </button>
      {onDelete ? (
        <button
          type="button"
          className="rounded p-1 text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
          onClick={onDelete}
          title={deleteTitle}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export default function CustomFormBuilder({
  eventType,
  layout,
  onChange,
}: {
  eventType: string;
  layout: FormLayoutItem[];
  onChange: (layout: FormLayoutItem[]) => void;
}) {
  const normalizedLayout = React.useMemo(
    () => normalizeStoredFormLayout(layout, eventType),
    [layout, eventType],
  );
  const groupedSections = React.useMemo(
    () => groupFormLayoutBySection(normalizedLayout, eventType),
    [normalizedLayout, eventType],
  );
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(
    new Set(normalizedLayout.map((item) => item.id)),
  );
  const [editingItemId, setEditingItemId] = React.useState<string | null>(null);
  const [activeDragId, setActiveDragId] = React.useState<string | null>(null);
  const [optionDrafts, setOptionDrafts] = React.useState<Record<string, string>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  React.useEffect(() => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      groupedSections.forEach((section) => {
        next.add(section.section.sectionId);
        section.items.forEach((item) => next.add(item.id));
      });
      return next;
    });
  }, [groupedSections]);

  React.useEffect(() => {
    setOptionDrafts((prev) => {
      const next = { ...prev };
      const validIds = new Set<string>();

      groupedSections.forEach((section) => {
        section.items.forEach((item) => {
          if (item.kind !== "custom_field") return;
          if (item.type !== "select" && item.type !== "checkbox") return;

          validIds.add(item.id);
          if (next[item.id] === undefined) {
            const defaultOptions =
              item.type === "checkbox" && (!item.options || item.options.length === 0)
                ? ["Ya", "Tidak"]
                : (item.options || []);
            next[item.id] = defaultOptions.join(", ");
          }
        });
      });

      Object.keys(next).forEach((id) => {
        if (!validIds.has(id)) delete next[id];
      });

      return next;
    });
  }, [groupedSections]);

  const itemLookup = React.useMemo(() => {
    const map = new Map<
      string,
      { sectionId: BuiltInSectionId; item: SectionContentItem; index: number }
    >();

    groupedSections.forEach((section) => {
      section.items.forEach((item, index) => {
        map.set(item.id, {
          sectionId: section.section.sectionId,
          item,
          index,
        });
      });
    });

    return map;
  }, [groupedSections]);

  const activeDragItem = activeDragId ? itemLookup.get(activeDragId)?.item ?? null : null;

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function commitSections(sections: GroupedFormLayoutSection[]) {
    onChange(flattenGroupedFormLayout(sections));
  }

  function updateSection(
    sectionId: BuiltInSectionId,
    updater: (items: SectionContentItem[]) => SectionContentItem[],
  ) {
    const nextSections = groupedSections.map((section) =>
      section.section.sectionId === sectionId
        ? { ...section, items: updater(section.items) }
        : section,
    );
    commitSections(nextSections);
  }

  function addCustomField(sectionId: BuiltInSectionId) {
    const nextItem = createCustomFieldItem();
    updateSection(sectionId, (items) => [...items, nextItem]);
    setExpandedIds((prev) => new Set(prev).add(nextItem.id));
    setEditingItemId(nextItem.id);
  }

  function addCustomDivider(sectionId: BuiltInSectionId) {
    const nextItem = createCustomSectionItem();
    updateSection(sectionId, (items) => [...items, nextItem]);
    setExpandedIds((prev) => new Set(prev).add(nextItem.id));
    setEditingItemId(nextItem.id);
  }

  function deleteItem(sectionId: BuiltInSectionId, id: string) {
    updateSection(sectionId, (items) => items.filter((item) => item.id !== id));
  }

  function moveItem(
    sectionId: BuiltInSectionId,
    index: number,
    direction: "up" | "down",
  ) {
    updateSection(sectionId, (items) => {
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= items.length) return items;
      const next = [...items];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function updateCustomField(
    sectionId: BuiltInSectionId,
    id: string,
    updates: Partial<CustomFieldItem>,
  ) {
    updateSection(sectionId, (items) => updateLayoutItem(items, id, updates));
  }

  function updateCustomDivider(
    sectionId: BuiltInSectionId,
    id: string,
    title: string,
  ) {
    updateSection(sectionId, (items) =>
      updateLayoutItem(items, id, { title }),
    );
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);

    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;

    const activeMeta = itemLookup.get(activeId);
    if (!activeMeta) return;

    const overMeta =
      overId.startsWith("drop:")
        ? { sectionId: overId.replace("drop:", "") as BuiltInSectionId, item: null, index: -1 }
        : itemLookup.get(overId) ?? null;
    if (!overMeta) return;

    const isBuiltIn = activeMeta.item.kind === "builtin_field";
    const targetSectionId = overMeta.sectionId;
    const sourceSectionId = activeMeta.sectionId;

    if (isBuiltIn && sourceSectionId !== targetSectionId) {
      return;
    }

    const nextSections = groupedSections.map((section) => ({
      ...section,
      items: [...section.items],
    }));

    const sourceSection = nextSections.find(
      (section) => section.section.sectionId === sourceSectionId,
    );
    const targetSection = nextSections.find(
      (section) => section.section.sectionId === targetSectionId,
    );
    if (!sourceSection || !targetSection) return;

    if (sourceSectionId === targetSectionId && overMeta.item) {
      sourceSection.items = arrayMove(
        sourceSection.items,
        activeMeta.index,
        overMeta.index,
      );
      commitSections(nextSections);
      return;
    }

    const { item: movedItem, items: sourceItems } = removeItem(
      sourceSection.items,
      activeId,
    );
    if (!movedItem) return;
    sourceSection.items = sourceItems;

    let targetIndex = targetSection.items.length;
    if (overMeta.item) {
      targetIndex = targetSection.items.findIndex((item) => item.id === overId);
      if (targetIndex === -1) targetIndex = targetSection.items.length;
    }

    targetSection.items = insertItem(targetSection.items, movedItem, targetIndex);
    commitSections(nextSections);
  }

  function handleDragCancel() {
    setActiveDragId(null);
  }

  function renderBuiltInItem(
    item: Extract<SectionContentItem, { kind: "builtin_field" }>,
    index: number,
    sectionId: BuiltInSectionId,
    itemsLength: number,
  ) {
    const definition = getBuiltInFieldDefinition(item.builtinId, eventType);
    if (!definition) return null;
    const isExpanded = expandedIds.has(item.id);

    return (
      <SortableItemShell key={item.id} id={item.id}>
        {({ attributes, listeners, setActivatorNodeRef, isDragging }) => (
          <div className="rounded-lg border border-muted-foreground/20 bg-muted/35 shadow-sm">
            <div className="space-y-3 px-4 py-3">
              <div className="flex items-start gap-2">
                <BuilderDragHandle
                  attributes={attributes}
                  listeners={listeners}
                  setActivatorNodeRef={setActivatorNodeRef}
                />
                <button
                  type="button"
                  onClick={() => toggleExpand(item.id)}
                  className="flex min-w-0 flex-1 items-start gap-2 text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 text-sm font-medium text-foreground break-words">
                    {definition.label}
                  </span>
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-8 sm:pl-9">
                <span className="rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                  {definition.category}
                </span>
                <span className="rounded-full bg-slate-300/70 px-2 py-0.5 text-[10px] text-slate-700">
                  Bawaan
                </span>
                <div className="sm:ml-auto">
                  <ItemMoveControls
                    index={index}
                    itemsLength={itemsLength}
                    onMove={(direction) => moveItem(sectionId, index, direction)}
                  />
                </div>
              </div>
            </div>
            {isExpanded && (
              <div className="px-4 pb-4">
                <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/20 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" />
                  Field bawaan ini tetap tampil, tapi urutannya bisa diatur di dalam
                  section.
                </div>
              </div>
            )}
            {isDragging && <div className="h-1 rounded-b-lg bg-primary/20" />}
          </div>
        )}
      </SortableItemShell>
    );
  }

  function renderCustomDivider(
    item: Extract<SectionContentItem, { kind: "custom_section" }>,
    index: number,
    sectionId: BuiltInSectionId,
    itemsLength: number,
  ) {
    const isExpanded = expandedIds.has(item.id);
    const isEditing = editingItemId === item.id;

    return (
      <SortableItemShell key={item.id} id={item.id}>
        {({ attributes, listeners, setActivatorNodeRef, isDragging }) => (
          <div className="rounded-lg border bg-card shadow-sm">
            <div className="space-y-3 px-4 py-3">
              <div className="flex items-start gap-2">
                <BuilderDragHandle
                  attributes={attributes}
                  listeners={listeners}
                  setActivatorNodeRef={setActivatorNodeRef}
                />
                <button
                  type="button"
                  onClick={() => toggleExpand(item.id)}
                  className="flex min-w-0 flex-1 items-start gap-2 text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <Rows3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 text-sm font-medium break-words">
                    {item.title || "Divider Baru"}
                  </span>
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-8 sm:pl-9">
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  Divider
                </span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
                  Drag antar section
                </span>
                <div className="sm:ml-auto">
                  <ItemMoveControls
                    index={index}
                    itemsLength={itemsLength}
                    onMove={(direction) => moveItem(sectionId, index, direction)}
                    onDelete={() => deleteItem(sectionId, item.id)}
                    deleteTitle="Delete divider"
                  />
                </div>
              </div>
            </div>
            {isExpanded && (
              <div className="space-y-2 p-4 pt-0">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Judul Divider
                </label>
                <input
                  value={item.title}
                  onFocus={() => setEditingItemId(item.id)}
                  onChange={(e) =>
                    updateCustomDivider(sectionId, item.id, e.target.value)
                  }
                  className={inputClass + (isEditing ? " border-primary/40" : "")}
                  placeholder="Judul divider"
                />
              </div>
            )}
            {isDragging && <div className="h-1 rounded-b-lg bg-primary/20" />}
          </div>
        )}
      </SortableItemShell>
    );
  }

  function renderCustomField(
    item: CustomFieldItem,
    index: number,
    sectionId: BuiltInSectionId,
    itemsLength: number,
  ) {
    const isExpanded = expandedIds.has(item.id);
    const isEditing = editingItemId === item.id;

    return (
      <SortableItemShell key={item.id} id={item.id}>
        {({ attributes, listeners, setActivatorNodeRef, isDragging }) => (
          <div
            className={`rounded-lg border bg-card shadow-sm ${
              isEditing ? "border-primary/30" : ""
            }`}
          >
            <div className="space-y-3 px-4 py-3">
              <div className="flex items-start gap-2">
                <BuilderDragHandle
                  attributes={attributes}
                  listeners={listeners}
                  setActivatorNodeRef={setActivatorNodeRef}
                />
                <button
                  type="button"
                  onClick={() => toggleExpand(item.id)}
                  className="flex min-w-0 flex-1 items-start gap-2 text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <Type className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 text-sm font-medium break-words">
                    {item.label || (
                      <span className="italic text-muted-foreground">
                        (Field tanpa label)
                      </span>
                    )}
                  </span>
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-8 sm:pl-9">
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {FIELD_TYPES.find((field) => field.value === item.type)?.label ||
                    item.type}
                </span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
                  Drag antar section
                </span>
                {item.required && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">
                    Wajib
                  </span>
                )}
                <div className="sm:ml-auto">
                  <ItemMoveControls
                    index={index}
                    itemsLength={itemsLength}
                    onMove={(direction) => moveItem(sectionId, index, direction)}
                    onDelete={() => deleteItem(sectionId, item.id)}
                    deleteTitle="Delete field"
                  />
                </div>
              </div>
            </div>
            {isExpanded && (
              <div className="space-y-3 p-4 pt-0">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Label
                    </label>
                    <input
                      value={item.label}
                      onFocus={() => setEditingItemId(item.id)}
                      onChange={(e) =>
                        updateCustomField(sectionId, item.id, {
                          label: e.target.value,
                        })
                      }
                      placeholder="Nama field"
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Tipe
                    </label>
                    <select
                      value={item.type}
                      onFocus={() => setEditingItemId(item.id)}
                      onChange={(e) =>
                        updateCustomField(sectionId, item.id, {
                          type: e.target.value as CustomFieldType,
                          options:
                            e.target.value === "checkbox"
                              ? item.options && item.options.length > 0
                                ? item.options
                                : ["Ya", "Tidak"]
                              : item.options,
                        })
                      }
                      className={inputClass + " cursor-pointer"}
                    >
                      {FIELD_TYPES.map((fieldType) => (
                        <option key={fieldType.value} value={fieldType.value}>
                          {fieldType.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {item.type !== "checkbox" && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Placeholder
                    </label>
                    <input
                      value={item.placeholder}
                      onFocus={() => setEditingItemId(item.id)}
                      onChange={(e) =>
                        updateCustomField(sectionId, item.id, {
                          placeholder: e.target.value,
                        })
                      }
                      placeholder="Teks placeholder..."
                      className={inputClass}
                    />
                  </div>
                )}
                {(item.type === "select" || item.type === "checkbox") && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Opsi
                    </label>
                    <input
                      value={
                        optionDrafts[item.id] ??
                        (
                          item.type === "checkbox" && (!item.options || item.options.length === 0)
                            ? ["Ya", "Tidak"]
                            : (item.options || [])
                        ).join(", ")
                      }
                      onFocus={() => setEditingItemId(item.id)}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setOptionDrafts((prev) => ({ ...prev, [item.id]: raw }));
                        updateCustomField(sectionId, item.id, {
                          options: raw
                            .split(",")
                            .map((option) => option.trim())
                            .filter(Boolean),
                        });
                      }}
                      placeholder={
                        item.type === "checkbox"
                          ? "Yes, No"
                          : "Opsi 1, Opsi 2"
                      }
                      className={inputClass}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Pisahkan setiap opsi dengan koma.
                    </p>
                  </div>
                )}
                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={item.required}
                    onChange={(e) =>
                      updateCustomField(sectionId, item.id, {
                        required: e.target.checked,
                      })
                    }
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  Wajib diisi
                </label>
              </div>
            )}
            {isDragging && <div className="h-1 rounded-b-lg bg-primary/20" />}
          </div>
        )}
      </SortableItemShell>
    );
  }

  function renderSection(section: GroupedFormLayoutSection) {
    const sectionId = section.section.sectionId;
    const isExpanded = expandedIds.has(sectionId);

    return (
      <div key={sectionId} className="rounded-xl border bg-card shadow-sm">
        <button
          type="button"
          onClick={() => toggleExpand(sectionId)}
          className="w-full border-b px-4 py-4 text-left sm:px-5"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-muted p-2">
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold break-words">{section.section.title}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Section bawaan tetap tampil. Custom field dan divider bisa di-drag
                antar section, sedangkan field bawaan tetap di section asalnya.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {section.section.category}
                </span>
                <span className="rounded-full bg-slate-300/70 px-2 py-0.5 text-[10px] text-slate-700">
                  Section Bawaan
                </span>
              </div>
            </div>
            {isExpanded ? (
              <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </div>
        </button>

        {isExpanded && (
          <SectionDropArea sectionId={sectionId}>
            <div className="space-y-3 p-5">
              <SortableContext
                items={section.items.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                {section.items.map((item, index) => {
                  if (item.kind === "builtin_field") {
                    return renderBuiltInItem(
                      item,
                      index,
                      sectionId,
                      section.items.length,
                    );
                  }
                  if (item.kind === "custom_section") {
                    return renderCustomDivider(
                      item,
                      index,
                      sectionId,
                      section.items.length,
                    );
                  }
                  return renderCustomField(
                    item,
                    index,
                    sectionId,
                    section.items.length,
                  );
                })}
              </SortableContext>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => addCustomField(sectionId)}
                  className="flex items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground transition-all hover:bg-muted/30 hover:text-foreground"
                >
                  <Plus className="h-4 w-4" /> Tambah Field di Section Ini
                </button>
                <button
                  type="button"
                  onClick={() => addCustomDivider(sectionId)}
                  className="flex items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground transition-all hover:bg-muted/30 hover:text-foreground"
                >
                  <Rows3 className="h-4 w-4" /> Tambah Divider di Section Ini
                </button>
              </div>
            </div>
          </SectionDropArea>
        )}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="space-y-4">{groupedSections.map(renderSection)}</div>

      <DragOverlay>
        {activeDragItem ? (
          <div className="rounded-lg border bg-background px-4 py-3 shadow-xl">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground/60" />
              <span className="text-sm font-medium">
                {activeDragItem.kind === "builtin_field"
                  ? getBuiltInFieldDefinition(activeDragItem.builtinId, eventType)
                      ?.label || "Field Bawaan"
                  : activeDragItem.kind === "custom_section"
                    ? activeDragItem.title || "Divider Baru"
                    : activeDragItem.label || "Field Custom"}
              </span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
