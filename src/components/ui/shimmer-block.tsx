"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type ShimmerBlockProps = React.HTMLAttributes<HTMLDivElement>;

export function ShimmerBlock({
  className,
  ...props
}: ShimmerBlockProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted/60",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)] dark:before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)]",
        className,
      )}
      {...props}
    />
  );
}

