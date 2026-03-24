"use client";

import * as React from "react";

import { ShimmerBlock } from "@/components/ui/shimmer-block";

export function TableRowsSkeleton({
  rows = 6,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr
          key={`table-skeleton-${rowIndex}`}
          className="border-b border-border/50"
        >
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <td
              key={`table-skeleton-cell-${rowIndex}-${columnIndex}`}
              className="px-4 py-4"
            >
              <div className="space-y-2">
                <ShimmerBlock className="h-4 w-full max-w-[180px]" />
                {columnIndex === 0 ? (
                  <ShimmerBlock className="h-3 w-24" />
                ) : null}
              </div>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function CardListSkeleton({
  count = 4,
  withBadge = true,
  withActions = true,
}: {
  count?: number;
  withBadge?: boolean;
  withActions?: boolean;
}) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`card-skeleton-${index}`}
          className="rounded-xl border bg-card p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <ShimmerBlock className="h-5 w-40" />
              <ShimmerBlock className="h-3 w-24" />
            </div>
            {withBadge ? <ShimmerBlock className="h-6 w-20 rounded-full" /> : null}
          </div>
          <div className="mt-4 space-y-2 border-t pt-3">
            <ShimmerBlock className="h-3.5 w-full" />
            <ShimmerBlock className="h-3.5 w-5/6" />
            <ShimmerBlock className="h-3.5 w-2/3" />
          </div>
          {withActions ? (
            <div className="mt-4 flex gap-2 border-t pt-3">
              <ShimmerBlock className="h-8 w-8 rounded-md" />
              <ShimmerBlock className="h-8 w-8 rounded-md" />
              <ShimmerBlock className="h-8 w-8 rounded-md" />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
