"use client";

import * as React from "react";
import {
  CalendarDays,
  MapPin,
  User,
  ExternalLink,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";
import { formatSessionDate } from "@/utils/format-date";

export type UpcomingBooking = {
  id: string;
  client_name: string;
  booking_code: string;
  session_date: string;
  location: string | null;
  services: { name: string } | null;
  status: string;
};

interface UpcomingBookingCardProps {
  booking: UpcomingBooking | null;
}

export function UpcomingBookingCard({ booking }: UpcomingBookingCardProps) {
  const locale = useLocale();
  const t = useTranslations("Dashboard");

  const headerContent = (
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-500/10">
        <CalendarDays className="w-5 h-5 text-purple-600 dark:text-purple-400" />
      </div>
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {t("bookingTerdekat")}
      </span>
    </div>
  );

  if (!booking) {
    return (
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
        <div className="flex items-center gap-3 mb-3">{headerContent}</div>
        <p className="text-sm text-muted-foreground">{t("tidakAdaBooking")}</p>
      </div>
    );
  }

  const dateLocale = locale === "en" ? "en" : "id";
  const dateStr = formatSessionDate(booking.session_date, { locale: dateLocale as "id" | "en", withTime: false });
  const d = new Date(booking.session_date);
  const timeStr = `${String(d.getUTCHours()).padStart(2, "0")}.${String(d.getUTCMinutes()).padStart(2, "0")}`;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sessionStart = new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
  );
  const diffDays = Math.round(
    (sessionStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24),
  );
  const urgencyLabel =
    diffDays <= 0
      ? t("hariIni")
      : diffDays === 1
        ? t("besok")
        : t("hariLagi", { days: diffDays });

  const statusColors: Record<string, string> = {
    pending:
      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    dp: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
    terjadwal:
      "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
    selesai:
      "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400",
  };

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        {headerContent}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-xs font-semibold px-2 py-0.5 rounded-full",
              diffDays <= 1
                ? "bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                : "bg-purple-100 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400",
            )}
          >
            {urgencyLabel}
          </span>
          <a
            href={`/${locale}/bookings/${booking.id}`}
            className="p-1.5 rounded-md hover:bg-muted/50 transition-colors"
            title={t("lihatDetail")}
          >
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </a>
        </div>
      </div>
      <div className="space-y-2 flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <User className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="font-semibold text-sm truncate">
            {booking.client_name}
          </span>
          <span
            className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded-full ml-auto shrink-0",
              statusColors[booking.status?.toLowerCase()] ||
                statusColors.pending,
            )}
          >
            {booking.status}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
          <CalendarDays className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            {dateStr}, {timeStr}
          </span>
        </div>
        {booking.location && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground min-w-0">
            <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="line-clamp-2 break-words">{booking.location}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
          <Package className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            {(booking.services as { name: string } | null)?.name ||
              booking.booking_code}
          </span>
        </div>
      </div>
    </div>
  );
}
