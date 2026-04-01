"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import type { TableColumnPreference, TableColumnPin } from "@/lib/table-column-prefs";

type StickyColumnConfig = {
  pin: Exclude<TableColumnPin, null>;
  offset: number;
  isEdge: boolean;
};

type UseStickyTableColumnsOptions = {
  enabled?: boolean;
  isResizing?: boolean;
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

export function useStickyTableColumns(
  columns: TableColumnPreference[],
  options?: UseStickyTableColumnsOptions,
) {
  const tableRef = React.useRef<HTMLTableElement | null>(null);
  const [widths, setWidths] = React.useState<Record<string, number>>({});
  const widthsRef = React.useRef(widths);
  const lastMeasuredWidthsRef = React.useRef<Record<string, number>>({});
  const enabled = options?.enabled ?? true;
  const isResizing = options?.isResizing ?? false;
  const pinnedColumnIds = React.useMemo(
    () =>
      columns
        .filter((column) => column.visible && (column.pin === "left" || column.pin === "right"))
        .map((column) => column.id),
    [columns],
  );
  const columnsKey = React.useMemo(
    () =>
      pinnedColumnIds
        .map((columnId) => {
          const column = columns.find((item) => item.id === columnId);
          return `${columnId}:${column?.pin ?? "none"}`;
        })
        .join("|"),
    [columns, pinnedColumnIds],
  );

  React.useEffect(() => {
    widthsRef.current = widths;
  }, [widths]);

  React.useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table || !enabled || isResizing || pinnedColumnIds.length === 0) return;
    let isSuspended = false;

    const headerCells = pinnedColumnIds
      .map((columnId) =>
        table.querySelector<HTMLTableCellElement>(
          `thead [data-column-id="${CSS.escape(columnId)}"]`,
        ),
      )
      .filter((cell): cell is HTMLTableCellElement => Boolean(cell));
    if (headerCells.length === 0) return;

    const updateWidths = () => {
      if (isSuspended || !enabled || isResizing) return;
      const next: Record<string, number> = {};
      headerCells.forEach((cell) => {
        const columnId = cell.dataset.columnId;
        if (!columnId) return;
        next[columnId] = toStableWidth(cell.offsetWidth);
      });
      if (areWidthMapsEqual(lastMeasuredWidthsRef.current, next)) return;
      lastMeasuredWidthsRef.current = next;
      if (areWidthMapsEqual(widthsRef.current, next)) return;
      setWidths((current) => (areWidthMapsEqual(current, next) ? current : next));
    };

    updateWidths();

    if (typeof ResizeObserver === "undefined") {
      return undefined;
    }

    let frameId: number | null = null;
    const scheduleUpdate = () => {
      if (isSuspended) return;
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        if (isSuspended) return;
        updateWidths();
      });
    };

    const observer = new ResizeObserver(() => {
      scheduleUpdate();
    });

    headerCells.forEach((cell) => observer.observe(cell));

    return () => {
      isSuspended = true;
      observer.disconnect();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [columnsKey, enabled, isResizing, pinnedColumnIds]);

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
