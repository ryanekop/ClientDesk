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
  normalizePinnedColumnOrder,
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
  saving?: boolean;
  triggerLabel?: string;
  triggerClassName?: string;
};

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
  const sortable = useSortable({
    id: column.id,
    disabled: column.locked,
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
          disabled={column.locked}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
            column.locked
              ? "cursor-not-allowed border-muted bg-muted/40 text-muted-foreground"
              : "touch-none cursor-grab border-input bg-background text-muted-foreground hover:bg-muted/50 active:cursor-grabbing"
          }`}
          title={column.locked ? "Kolom terkunci" : "Drag untuk ubah urutan"}
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
          disabled={column.locked}
          title={
            column.locked
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
          disabled={column.locked}
          title={column.visible ? "Sembunyikan" : "Tampilkan"}
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
  saving = false,
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
      normalizePinnedColumnOrder(
        columns.map((column) =>
          column.id === id && !column.locked
            ? { ...column, visible: !column.visible }
            : column,
        ),
      ),
    );
  }

  function togglePin(id: string) {
    onChange(
      normalizePinnedColumnOrder(
        columns.map((column) =>
          column.id === id && !column.locked
            ? { ...column, pin: column.pin === "left" ? null : "left" }
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
    if (columns[sourceIndex]?.locked || columns[targetIndex]?.locked) return;
    if (columns[sourceIndex]?.pin !== columns[targetIndex]?.pin) return;

    onChange(normalizePinnedColumnOrder(arrayMove(columns, sourceIndex, targetIndex)));
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
                    description={
                      column.locked
                        ? "Kolom selalu terkunci"
                        : column.pin === "left" || column.pin === "right"
                          ? column.visible
                            ? "Tampil di tabel dan terkunci saat digeser"
                            : "Disembunyikan, tetap terkunci saat ditampilkan"
                        : column.visible
                          ? "Tampil di tabel"
                          : "Disembunyikan dari tabel"
                    }
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
                              {activeColumn.pin === "left" ||
                              activeColumn.pin === "right"
                                ? activeColumn.visible
                                  ? "Tampil di tabel dan terkunci saat digeser"
                                  : "Disembunyikan, tetap terkunci saat ditampilkan"
                                : activeColumn.visible
                                  ? "Tampil di tabel"
                                  : "Disembunyikan dari tabel"}
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

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Tutup
            </Button>
            <Button onClick={() => void onSave()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : null}
              Simpan Kolom
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
