"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TableColumnPreference } from "@/lib/table-column-prefs";

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
};

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
}: TableColumnManagerProps) {
  const [draggedId, setDraggedId] = React.useState<string | null>(null);

  function reorderColumns(sourceId: string, targetId: string) {
    if (!sourceId || !targetId || sourceId === targetId) return;

    const sourceIndex = columns.findIndex((column) => column.id === sourceId);
    const targetIndex = columns.findIndex((column) => column.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    if (columns[sourceIndex]?.locked || columns[targetIndex]?.locked) return;

    const next = [...columns];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    onChange(next);
  }

  function moveColumn(id: string, direction: -1 | 1) {
    const index = columns.findIndex((column) => column.id === id);
    if (index < 0) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= columns.length) return;
    if (columns[index]?.locked || columns[nextIndex]?.locked) return;

    const next = [...columns];
    const [moved] = next.splice(index, 1);
    next.splice(nextIndex, 0, moved);
    onChange(next);
  }

  function toggleVisibility(id: string) {
    onChange(
      columns.map((column) =>
        column.id === id && !column.locked
          ? { ...column, visible: !column.visible }
          : column,
      ),
    );
  }

  return (
    <>
      <Button
        variant="outline"
        className="h-9 gap-2"
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

          <div className="space-y-2 py-2">
            {columns.map((column, index) => {
              const canMoveUp =
                !column.locked &&
                index > 0 &&
                !columns[index - 1]?.locked;
              const canMoveDown =
                !column.locked &&
                index < columns.length - 1 &&
                !columns[index + 1]?.locked;

              return (
                <div
                  key={column.id}
                  draggable={!column.locked}
                  onDragStart={() => !column.locked && setDraggedId(column.id)}
                  onDragOver={(event) => {
                    if (!column.locked) event.preventDefault();
                  }}
                  onDrop={() => {
                    if (!column.locked && draggedId) {
                      reorderColumns(draggedId, column.id);
                    }
                    setDraggedId(null);
                  }}
                  onDragEnd={() => setDraggedId(null)}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                    draggedId === column.id
                      ? "border-dashed border-primary bg-primary/5"
                      : "bg-card"
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                      column.locked
                        ? "border-muted bg-muted/40 text-muted-foreground"
                        : "border-input bg-background text-muted-foreground"
                    }`}
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{column.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {column.locked
                        ? "Kolom terkunci"
                        : column.visible
                          ? "Tampil di tabel"
                          : "Disembunyikan dari tabel"}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => toggleVisibility(column.id)}
                      disabled={column.locked}
                      title={column.visible ? "Sembunyikan" : "Tampilkan"}
                    >
                      {column.visible ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => moveColumn(column.id, -1)}
                      disabled={!canMoveUp}
                      title="Geser ke atas"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => moveColumn(column.id, 1)}
                      disabled={!canMoveDown}
                      title="Geser ke bawah"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

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
