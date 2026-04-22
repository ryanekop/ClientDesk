import { CANCELLED_BOOKING_STATUS } from "@/lib/client-status";

export const BOOKING_STATUS_COLOR_PALETTE = [
  "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-none",
  "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 border-none",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-none",
  "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border-none",
  "bg-pink-100 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400 border-none",
  "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400 border-none",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-none",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400 border-none",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 border-none",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border-none",
] as const;

export function buildBookingStatusColorMap(statuses: string[]) {
  const map: Record<string, string> = {};

  statuses
    .filter(
      (status) =>
        status.toLowerCase() !== CANCELLED_BOOKING_STATUS.toLowerCase(),
    )
    .forEach((status, index) => {
      map[status] =
        BOOKING_STATUS_COLOR_PALETTE[index % BOOKING_STATUS_COLOR_PALETTE.length];
    });

  map[CANCELLED_BOOKING_STATUS] =
    "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-none";

  return map;
}
