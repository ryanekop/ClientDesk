"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import type { TableMenuKey, TableColumnPreference } from "@/lib/table-column-prefs";

type UseResizableTableColumnsOptions = {
  menuKey: TableMenuKey;
  userId: string | null;
  columns: TableColumnPreference[];
  nonResizableColumnIds?: string[];
  minWidthByColumnId?: Record<string, number>;
  maxWidthByColumnId?: Record<string, number>;
  defaultMinWidth?: number;
  defaultMaxWidth?: number;
};

type ResizeHandleProps = {
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
};

const STORAGE_PREFIX = "clientdesk:table_column_widths";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeWidthMap(
  raw: unknown,
  options: {
    nonResizableColumnIds: Set<string>;
    minWidthByColumnId: Record<string, number>;
    maxWidthByColumnId: Record<string, number>;
    defaultMinWidth: number;
    defaultMaxWidth: number;
  },
) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {} as Record<string, number>;
  }

  const normalized: Record<string, number> = {};
  Object.entries(raw as Record<string, unknown>).forEach(([columnId, value]) => {
    if (options.nonResizableColumnIds.has(columnId)) return;
    if (typeof value !== "number" || !Number.isFinite(value)) return;

    const min = Math.max(
      64,
      options.minWidthByColumnId[columnId] ?? options.defaultMinWidth,
    );
    const max = Math.max(min, options.maxWidthByColumnId[columnId] ?? options.defaultMaxWidth);
    normalized[columnId] = Math.round(clamp(value, min, max));
  });

  return normalized;
}

function areWidthMapsEqual(
  left: Record<string, number>,
  right: Record<string, number>,
) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every((key) => left[key] === right[key]);
}

export function useResizableTableColumns({
  menuKey,
  userId,
  columns,
  nonResizableColumnIds = [],
  minWidthByColumnId = {},
  maxWidthByColumnId = {},
  defaultMinWidth = 96,
  defaultMaxWidth = 720,
}: UseResizableTableColumnsOptions) {
  const nonResizableSet = React.useMemo(
    () => new Set(nonResizableColumnIds),
    [nonResizableColumnIds],
  );
  const storageKey = React.useMemo(
    () => (userId ? `${STORAGE_PREFIX}:${menuKey}:${userId}` : null),
    [menuKey, userId],
  );
  const [widthByColumnId, setWidthByColumnId] = React.useState<Record<string, number>>(
    {},
  );
  const [hydratedStorageKey, setHydratedStorageKey] = React.useState<string | null>(
    null,
  );
  const [activeResizeColumnId, setActiveResizeColumnId] = React.useState<string | null>(
    null,
  );
  const widthByColumnIdRef = React.useRef(widthByColumnId);

  React.useEffect(() => {
    widthByColumnIdRef.current = widthByColumnId;
  }, [widthByColumnId]);

  const normalizeMap = React.useCallback(
    (raw: unknown) =>
      normalizeWidthMap(raw, {
        nonResizableColumnIds: nonResizableSet,
        minWidthByColumnId,
        maxWidthByColumnId,
        defaultMinWidth,
        defaultMaxWidth,
      }),
    [
      defaultMaxWidth,
      defaultMinWidth,
      maxWidthByColumnId,
      minWidthByColumnId,
      nonResizableSet,
    ],
  );

  React.useEffect(() => {
    setHydratedStorageKey(null);

    if (!storageKey) {
      setWidthByColumnId({});
      return;
    }

    try {
      const rawValue = window.localStorage.getItem(storageKey);
      if (!rawValue) {
        setWidthByColumnId({});
      } else {
        const parsed = JSON.parse(rawValue) as unknown;
        setWidthByColumnId(normalizeMap(parsed));
      }
    } catch {
      setWidthByColumnId({});
    } finally {
      setHydratedStorageKey(storageKey);
    }
  }, [normalizeMap, storageKey]);

  React.useEffect(() => {
    if (!storageKey || hydratedStorageKey !== storageKey) return;

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(widthByColumnId));
    } catch {
      // Ignore storage write failures.
    }
  }, [hydratedStorageKey, storageKey, widthByColumnId]);

  React.useEffect(() => {
    if (!storageKey) return;

    function handleStorage(event: StorageEvent) {
      if (event.storageArea !== window.localStorage) return;
      if (event.key !== storageKey) return;

      if (!event.newValue) {
        setWidthByColumnId({});
        return;
      }

      try {
        const parsed = JSON.parse(event.newValue) as unknown;
        const normalized = normalizeMap(parsed);
        setWidthByColumnId((current) =>
          areWidthMapsEqual(current, normalized) ? current : normalized,
        );
      } catch {
        setWidthByColumnId({});
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [normalizeMap, storageKey]);

  const getMinWidth = React.useCallback(
    (columnId: string) =>
      Math.max(64, minWidthByColumnId[columnId] ?? defaultMinWidth),
    [defaultMinWidth, minWidthByColumnId],
  );
  const getMaxWidth = React.useCallback(
    (columnId: string) => {
      const min = getMinWidth(columnId);
      return Math.max(min, maxWidthByColumnId[columnId] ?? defaultMaxWidth);
    },
    [defaultMaxWidth, getMinWidth, maxWidthByColumnId],
  );
  const isColumnResizable = React.useCallback(
    (columnId: string) =>
      columns.some((column) => column.id === columnId) && !nonResizableSet.has(columnId),
    [columns, nonResizableSet],
  );

  const startResize = React.useCallback(
    (columnId: string, event: React.PointerEvent<HTMLElement>) => {
      if (!isColumnResizable(columnId)) return;
      if (event.pointerType !== "touch" && event.button !== 0) return;

      event.preventDefault();
      event.stopPropagation();

      const headerCell =
        event.currentTarget.closest("th[data-column-id]") ||
        event.currentTarget.closest("td[data-column-id]");
      const currentWidth = headerCell
        ? (headerCell as HTMLElement).getBoundingClientRect().width
        : widthByColumnIdRef.current[columnId] ?? getMinWidth(columnId);

      const startX = event.clientX;
      const startWidth = Math.round(currentWidth);
      const minWidth = getMinWidth(columnId);
      const maxWidth = getMaxWidth(columnId);

      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      setActiveResizeColumnId(columnId);

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const nextWidth = Math.round(clamp(startWidth + deltaX, minWidth, maxWidth));
        setWidthByColumnId((current) => {
          if (current[columnId] === nextWidth) return current;
          return { ...current, [columnId]: nextWidth };
        });
      };

      const cleanup = () => {
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        setActiveResizeColumnId((current) => (current === columnId ? null : current));
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", cleanup);
        window.removeEventListener("pointercancel", cleanup);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", cleanup);
      window.addEventListener("pointercancel", cleanup);
    },
    [getMaxWidth, getMinWidth, isColumnResizable],
  );

  const getColumnWidthStyle = React.useCallback(
    (columnId: string): CSSProperties | undefined => {
      if (!isColumnResizable(columnId)) return undefined;
      const width = widthByColumnId[columnId];
      if (typeof width !== "number" || !Number.isFinite(width)) return undefined;

      return {
        width,
        minWidth: width,
        maxWidth: width,
      };
    },
    [isColumnResizable, widthByColumnId],
  );

  const getResizeHandleProps = React.useCallback(
    (columnId: string): ResizeHandleProps | null => {
      if (!isColumnResizable(columnId)) return null;

      return {
        onPointerDown: (event) => startResize(columnId, event),
      };
    },
    [isColumnResizable, startResize],
  );

  const isColumnBeingResized = React.useCallback(
    (columnId: string) => activeResizeColumnId === columnId,
    [activeResizeColumnId],
  );

  return {
    getColumnWidthStyle,
    getResizeHandleProps,
    isColumnResizable,
    isColumnBeingResized,
  };
}
