import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const PAGE_HEADER_ACTIONS_CLASSNAME =
  "grid w-full gap-2 sm:grid-cols-2 sm:[&>*:only-child]:col-span-2 lg:flex lg:w-auto lg:flex-wrap lg:justify-end";

export const PAGE_HEADER_COMPACT_MOBILE_ACTIONS_CLASSNAME =
  "grid-cols-2 max-[360px]:grid-cols-1 [&>*:only-child]:col-span-2 max-[360px]:[&>*:only-child]:col-span-1";

type PageHeaderProps = {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
  actionsClassName?: string;
};

export function PageHeader({
  children,
  actions,
  className,
  contentClassName,
  actionsClassName,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between",
        className,
      )}
    >
      <div className={cn("min-w-0", contentClassName)}>{children}</div>
      {actions ? (
        <div className={cn(PAGE_HEADER_ACTIONS_CLASSNAME, actionsClassName)}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}
