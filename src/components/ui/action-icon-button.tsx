import * as React from "react";
import { cn } from "@/lib/utils";

type ActionTone =
  | "slate"
  | "blue"
  | "indigo"
  | "violet"
  | "emerald"
  | "green"
  | "orange"
  | "sky"
  | "amber"
  | "cyan"
  | "red";

type ActionIconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ActionTone;
};

const toneClasses: Record<ActionTone, string> = {
  slate:
    "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300 dark:hover:bg-slate-800/70",
  blue: "border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-800/60",
  indigo:
    "border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-800/60",
  violet:
    "border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-800/60",
  emerald:
    "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-800/60",
  green:
    "border-green-200 bg-green-50 text-green-600 hover:bg-green-100 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-800/60",
  orange:
    "border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100 dark:border-orange-700 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-800/60",
  sky: "border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-300 dark:hover:bg-sky-800/60",
  amber:
    "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-800/60",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-600 hover:bg-cyan-100 dark:border-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 dark:hover:bg-cyan-800/60",
  red: "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-800/60",
};

export const ActionIconButton = React.forwardRef<
  HTMLButtonElement,
  ActionIconButtonProps
>(({ className, tone = "slate", type = "button", ...props }, ref) => {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
});

ActionIconButton.displayName = "ActionIconButton";
