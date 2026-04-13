"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

type TodaySessionsResponse = {
  totalItems?: number;
};

function isTodaySessionsResponse(value: unknown): value is TodaySessionsResponse {
  return Boolean(value) && typeof value === "object";
}

function getBrowserTimeZone() {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof resolved === "string" && resolved.trim() ? resolved : "UTC";
  } catch {
    return "UTC";
  }
}

function getLocalDateKey(date: Date, timeZone: string) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fall back to the browser-local calendar date if Intl formatting fails.
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

export function TodaySessionsCount() {
  const t = useTranslations("Dashboard");
  const [count, setCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const controller = new AbortController();
    const timeZone = getBrowserTimeZone();
    const today = getLocalDateKey(new Date(), timeZone);

    async function loadTodaySessions() {
      try {
        const params = new URLSearchParams({
          page: "1",
          perPage: "1",
          includeMetadata: "0",
          archiveMode: "active",
          dateBasis: "session_date",
          dateFrom: today,
          dateTo: today,
          timeZone,
        });
        const response = await fetch(`/api/internal/bookings?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json().catch(() => null)) as unknown;

        if (!response.ok || !isTodaySessionsResponse(result)) {
          throw new Error("Failed to load today's sessions.");
        }

        setCount(Number(result.totalItems) || 0);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setCount(0);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadTodaySessions();

    return () => controller.abort();
  }, []);

  return (
    <div className="text-xl font-bold text-foreground">
      {loading ? (
        <span className="inline-block h-7 w-16 animate-pulse rounded-md bg-muted align-middle" />
      ) : (
        count
      )}{" "}
      <span className="text-sm font-medium text-muted-foreground">
        {t("sesi")}
      </span>
    </div>
  );
}
