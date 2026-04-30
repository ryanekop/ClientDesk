"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
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
  CheckCircle,
  GripVertical,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from "lucide-react";

export type SortableConfigItem = {
  id: string;
  label: string;
  active?: boolean;
  locked?: boolean;
  removable?: boolean;
  editable?: boolean;
  badge?: React.ReactNode;
};

function SortableRow({
  item,
  editingId,
  editingValue,
  onEditingValueChange,
  onStartEdit,
  onCancelEdit,
  onConfirmEdit,
  onToggleActive,
  onDelete,
  renderControls,
}: {
  item: SortableConfigItem;
  editingId: string | null;
  editingValue: string;
  onEditingValueChange: (value: string) => void;
  onStartEdit: (item: SortableConfigItem) => void;
  onCancelEdit: () => void;
  onConfirmEdit: (id: string) => void;
  onToggleActive?: (id: string) => void;
  onDelete?: (id: string) => void;
  renderControls?: (item: SortableConfigItem) => React.ReactNode;
}) {
  /* eslint-disable react-hooks/refs */
  const sortable = useSortable({ id: item.id, disabled: item.locked });
  const isEditing = editingId === item.id;
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.45 : 1,
  };

  return (
    <div ref={sortable.setNodeRef} style={style}>
      <div
        className={`flex items-center gap-2 rounded-lg border bg-background px-3 py-2 transition-all ${
          sortable.isDragging ? "border-dashed border-primary bg-primary/5" : ""
        }`}
      >
        <button
          type="button"
          ref={sortable.setActivatorNodeRef}
          disabled={item.locked}
          className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
            item.locked
              ? "cursor-not-allowed border-muted bg-muted/40 text-muted-foreground"
              : "touch-none cursor-grab border-input text-muted-foreground hover:bg-muted/50 active:cursor-grabbing"
          }`}
          title={item.locked ? "Item terkunci" : "Drag untuk ubah urutan"}
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {isEditing ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              autoFocus
              value={editingValue}
              onChange={(event) => onEditingValueChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && editingValue.trim()) {
                  onConfirmEdit(item.id);
                }
                if (event.key === "Escape") {
                  onCancelEdit();
                }
              }}
              className="h-8 flex-1 rounded border border-input px-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <button
              type="button"
              className="rounded p-1 text-green-600 hover:bg-muted"
              onClick={() => onConfirmEdit(item.id)}
              disabled={!editingValue.trim()}
              title="Simpan"
            >
              <CheckCircle className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded p-1 text-muted-foreground hover:bg-muted"
              onClick={onCancelEdit}
              title="Batal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm">{item.label}</span>
                {item.badge}
              </div>
            </div>
            {renderControls ? renderControls(item) : null}
            {typeof item.active === "boolean" && onToggleActive ? (
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-muted"
                onClick={() => onToggleActive(item.id)}
                title={item.active ? "Nonaktifkan" : "Aktifkan"}
              >
                {item.active ? (
                  <ToggleRight className="h-5 w-5 text-green-600" />
                ) : (
                  <ToggleLeft className="h-5 w-5" />
                )}
              </button>
            ) : null}
            {item.editable !== false ? (
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-muted"
                onClick={() => onStartEdit(item)}
                title="Ubah nama"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {item.removable !== false && onDelete ? (
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-red-600"
                onClick={() => onDelete(item.id)}
                title="Hapus"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
  /* eslint-enable react-hooks/refs */
}

export function SortableConfigList({
  items,
  onReorder,
  onRename,
  onToggleActive,
  onDelete,
  renderControls,
}: {
  items: SortableConfigItem[];
  onReorder: (items: SortableConfigItem[]) => void;
  onRename: (id: string, label: string) => void;
  onToggleActive?: (id: string) => void;
  onDelete?: (id: string) => void;
  renderControls?: (item: SortableConfigItem) => React.ReactNode;
}) {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingValue, setEditingValue] = React.useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const activeItem = items.find((item) => item.id === activeId) || null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  function startEdit(item: SortableConfigItem) {
    setEditingId(item.id);
    setEditingValue(item.label);
  }

  function confirmEdit(id: string) {
    if (!editingValue.trim()) return;
    onRename(id, editingValue.trim());
    setEditingId(null);
    setEditingValue("");
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-1">
          {items.map((item) => (
            <SortableRow
              key={item.id}
              item={item}
              editingId={editingId}
              editingValue={editingValue}
              onEditingValueChange={setEditingValue}
              onStartEdit={startEdit}
              onCancelEdit={() => {
                setEditingId(null);
                setEditingValue("");
              }}
              onConfirmEdit={confirmEdit}
              onToggleActive={onToggleActive}
              onDelete={onDelete}
              renderControls={renderControls}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeItem ? (
          <div className="rounded-lg border border-primary bg-card px-3 py-2 shadow-xl">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-input text-muted-foreground">
                <GripVertical className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">{activeItem.label}</span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
