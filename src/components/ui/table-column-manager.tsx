"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  Eye,
  EyeOff,
  GripVertical,
  Lock,
  LockOpen,
  Loader2,
  RotateCcw,
  Settings2,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  canReorderTableColumn,
  canToggleTableColumnPin,
  canToggleTableColumnVisibility,
  isAlwaysVisibleTableColumnId,
  lockBoundaryColumns,
  type TableColumnPreference,
} from "@/lib/table-column-prefs";

type TableColumnManagerProps = {
  title: string;
  description: string;
  columns: TableColumnPreference[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (columns: TableColumnPreference[]) => void;
  onSave: () => void | Promise<void>;
  onResetWidths?: () => void | Promise<void>;
  saving?: boolean;
  resettingWidths?: boolean;
  triggerLabel?: string;
  triggerClassName?: string;
};

function getColumnDescription(column: TableColumnPreference) {
  const isPinned = column.pin === "left" || column.pin === "right";

  if (isAlwaysVisibleTableColumnId(column.id)) {
    return isPinned
      ? "Selalu tampil di tabel dan saat ini terkunci saat digeser"
      : "Selalu tampil di tabel";
  }

  if (column.locked) {
    return column.visible
      ? "Posisi kolom terkunci, tapi tetap bisa disembunyikan"
      : "Disembunyikan, posisi kolom tetap terkunci saat ditampilkan";
  }

  if (isPinned) {
    return column.visible
      ? "Tampil di tabel dan terkunci saat digeser"
      : "Disembunyikan, tetap terkunci saat ditampilkan";
  }

  return column.visible ? "Tampil di tabel" : "Disembunyikan dari tabel";
}

function SortableColumnItem({
  column,
  description,
  onTogglePin,
  onToggleVisibility,
}: {
  column: TableColumnPreference;
  description: string;
  onTogglePin: (id: string) => void;
  onToggleVisibility: (id: string) => void;
}) {
  /* eslint-disable react-hooks/refs */
  const canReorder = canReorderTableColumn(column);
  const canTogglePinState = canToggleTableColumnPin(column);
  const canToggleVisibilityState = canToggleTableColumnVisibility(column);
  const sortable = useSortable({
    id: column.id,
    disabled: !canReorder,
  });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.45 : 1,
  };

  return (
    <div ref={sortable.setNodeRef} style={style}>
      <div
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
          sortable.isDragging
            ? "border-dashed border-primary bg-primary/5"
            : "bg-card"
        }`}
      >
        <button
          type="button"
          ref={sortable.setActivatorNodeRef}
          disabled={!canReorder}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
            !canReorder
              ? "cursor-not-allowed border-muted bg-muted/40 text-muted-foreground"
              : "touch-none cursor-grab border-input bg-background text-muted-foreground hover:bg-muted/50 active:cursor-grabbing"
          }`}
          title={
            !canReorder
              ? isAlwaysVisibleTableColumnId(column.id)
                ? "Kolom tetap di posisi ini"
                : "Kolom terkunci"
              : "Drag untuk ubah urutan"
          }
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{column.label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onTogglePin(column.id)}
          disabled={!canTogglePinState}
          title={
            !canTogglePinState
              ? "Kolom selalu terkunci saat digeser"
              : column.pin === "left" || column.pin === "right"
                ? "Buka kunci kolom"
                : "Kunci kolom saat digeser"
          }
        >
          {column.pin === "left" || column.pin === "right" ? (
            <Lock className="h-4 w-4" />
          ) : (
            <LockOpen className="h-4 w-4" />
          )}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onToggleVisibility(column.id)}
          disabled={!canToggleVisibilityState}
          title={
            !canToggleVisibilityState
              ? "Kolom ini selalu tampil"
              : column.visible
                ? "Sembunyikan"
                : "Tampilkan"
          }
        >
          {column.visible ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
  /* eslint-enable react-hooks/refs */
}

export function TableColumnManager({
  title,
  description,
  columns,
  open,
  onOpenChange,
  onChange,
  onSave,
  onResetWidths,
  saving = false,
  resettingWidths = false,
  triggerLabel = "Kelola Kolom",
  triggerClassName,
}: TableColumnManagerProps) {
  const [activeColumnId, setActiveColumnId] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

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

  function toggleVisibility(id: string) {
    onChange(
      lockBoundaryColumns(
        columns.map((column) =>
          column.id === id && canToggleTableColumnVisibility(column)
            ? { ...column, visible: !column.visible }
            : column,
        ),
      ),
    );
  }

  function togglePin(id: string) {
    onChange(
      lockBoundaryColumns(
        columns.map((column) =>
          column.id === id && canToggleTableColumnPin(column)
            ? {
                ...column,
                pin:
                  column.id === "actions"
                    ? column.pin === "right"
                      ? null
                      : "right"
                    : column.pin === "left"
                      ? null
                      : "left",
              }
            : column,
        ),
      ),
    );
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveColumnId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveColumnId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sourceIndex = columns.findIndex((column) => column.id === active.id);
    const targetIndex = columns.findIndex((column) => column.id === over.id);
    if (sourceIndex < 0 || targetIndex < 0) return;
    if (
      !canReorderTableColumn(columns[sourceIndex]) ||
      !canReorderTableColumn(columns[targetIndex])
    ) {
      return;
    }
    if (columns[sourceIndex]?.pin !== columns[targetIndex]?.pin) return;

    onChange(lockBoundaryColumns(arrayMove(columns, sourceIndex, targetIndex)));
  }

  const activeColumn =
    columns.find((column) => column.id === activeColumnId) || null;

  return (
    <>
      <Button
        variant="outline"
        className={cn("h-9 gap-2", triggerClassName)}
        onClick={() => onOpenChange(true)}
      >
        <Settings2 className="w-4 h-4" />
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveColumnId(null)}
          >
            <SortableContext
              items={columns.map((column) => column.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 py-2">
                {columns.map((column) => (
                  <SortableColumnItem
                    key={column.id}
                    column={column}
                    description={getColumnDescription(column)}
                    onTogglePin={togglePin}
                    onToggleVisibility={toggleVisibility}
                  />
                ))}
              </div>
            </SortableContext>

            {mounted
              ? createPortal(
                  <DragOverlay>
                    {activeColumn ? (
                      <div className="z-[9999] rounded-xl border border-primary bg-card px-4 py-3 shadow-2xl ring-1 ring-primary/10">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground">
                            <GripVertical className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{activeColumn.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {getColumnDescription(activeColumn)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </DragOverlay>,
                  document.body,
                )
              : null}
          </DndContext>

          <DialogFooter className="sm:justify-between gap-2">
            {onResetWidths ? (
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => void onResetWidths()}
                disabled={saving || resettingWidths}
              >
                {resettingWidths ? (
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-2 w-4 h-4" />
                )}
                Reset Lebar
              </Button>
            ) : (
              <div className="hidden sm:block" />
            )}
            <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                Tutup
              </Button>
              <Button
                onClick={() => void onSave()}
                disabled={saving}
                className="w-full sm:w-auto"
              >
                {saving ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : null}
                Simpan Kolom
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
