"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import type { TableColumnPreference, TableColumnPin } from "@/lib/table-column-prefs";

type StickyColumnConfig = {
  pin: Exclude<TableColumnPin, null>;
  offset: number;
  isEdge: boolean;
};

function areWidthMapsEqual(
  current: Record<string, number>,
  next: Record<string, number>,
) {
  const currentEntries = Object.entries(current);
  const nextEntries = Object.entries(next);
  if (currentEntries.length !== nextEntries.length) return false;

  return currentEntries.every(([key, value]) => next[key] === value);
}

function toStableWidth(value: number) {
  return Math.round(value);
}

export function useStickyTableColumns(columns: TableColumnPreference[]) {
  const tableRef = React.useRef<HTMLTableElement | null>(null);
  const [widths, setWidths] = React.useState<Record<string, number>>({});
  const columnsKey = React.useMemo(
    () =>
      columns
        .map((column) => `${column.id}:${column.visible}:${column.pin ?? "none"}`)
        .join("|"),
    [columns],
  );

  React.useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    const headerCells = Array.from(
      table.querySelectorAll<HTMLTableCellElement>("thead [data-column-id]"),
    );
    if (headerCells.length === 0) return;

    const updateWidths = () => {
      const next: Record<string, number> = {};
      headerCells.forEach((cell) => {
        const columnId = cell.dataset.columnId;
        if (!columnId) return;
        next[columnId] = toStableWidth(cell.getBoundingClientRect().width);
      });
      setWidths((current) => (areWidthMapsEqual(current, next) ? current : next));
    };

    updateWidths();

    if (typeof ResizeObserver === "undefined") {
      return undefined;
    }

    let frameId: number | null = null;
    const scheduleUpdate = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        updateWidths();
      });
    };

    const observer = new ResizeObserver(() => {
      scheduleUpdate();
    });

    headerCells.forEach((cell) => observer.observe(cell));

    return () => {
      observer.disconnect();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [columnsKey]);

  const stickyColumns = React.useMemo(() => {
    const leftPinned = columns.filter(
      (column) => column.visible && column.pin === "left",
    );
    const rightPinned = columns.filter(
      (column) => column.visible && column.pin === "right",
    );
    const result: Record<string, StickyColumnConfig> = {};

    let leftOffset = 0;
    leftPinned.forEach((column, index) => {
      result[column.id] = {
        pin: "left",
        offset: leftOffset,
        isEdge: index === leftPinned.length - 1,
      };
      leftOffset += widths[column.id] || 0;
    });

    let rightOffset = 0;
    [...rightPinned].reverse().forEach((column, reverseIndex) => {
      result[column.id] = {
        pin: "right",
        offset: rightOffset,
        isEdge: reverseIndex === rightPinned.length - 1,
      };
      rightOffset += widths[column.id] || 0;
    });

    return result;
  }, [columns, widths]);

  const getStickyColumnStyle = React.useCallback(
    (columnId: string, options?: { header?: boolean }): CSSProperties | undefined => {
      const config = stickyColumns[columnId];
      if (!config) return undefined;

      return {
        position: "sticky",
        [config.pin]: config.offset,
        zIndex: options?.header ? 40 : 30,
        boxShadow: config.isEdge
          ? config.pin === "left"
            ? "2px 0 0 0 var(--color-border), 12px 0 18px -16px rgba(15, 23, 42, 0.14)"
            : "-2px 0 0 0 var(--color-border), -12px 0 18px -16px rgba(15, 23, 42, 0.14)"
          : undefined,
      };
    },
    [stickyColumns],
  );

  const getStickyColumnClassName = React.useCallback(
    (columnId: string, options?: { header?: boolean }) => {
      const config = stickyColumns[columnId];
      if (!config) return "";
      if (options?.header) {
        return "sticky-table-cell sticky-table-cell--header";
      }
      return "sticky-table-cell";
    },
    [stickyColumns],
  );

  return {
    tableRef,
    getStickyColumnStyle,
    getStickyColumnClassName,
  };
}
