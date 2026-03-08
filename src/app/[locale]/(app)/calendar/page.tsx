"use client";

import * as React from "react";
import { Calendar, dateFnsLocalizer, Event } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { id } from "date-fns/locale/id";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { createClient } from "@/utils/supabase/client";
import { Loader2, Link2, Unlink, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

const locales = { "id-ID": id };

const localizer = dateFnsLocalizer({
    format, parse, startOfWeek, getDay, locales,
});

type CalendarEvent = Event & {
    bookingId?: string;
    clientName?: string;
    status?: string;
    serviceName?: string;
    source: "booking" | "google";
};

export default function CalendarPage() {
    const supabase = createClient();
    const t = useTranslations("Calendar");
    const [events, setEvents] = React.useState<CalendarEvent[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [isGoogleConnected, setIsGoogleConnected] = React.useState(false);
    const [syncing, setSyncing] = React.useState(false);

    React.useEffect(() => {
        fetchBookings();
        checkGoogleConnection();

        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === "GOOGLE_AUTH_SUCCESS") {
                setIsGoogleConnected(true);
            }
        };
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    async function checkGoogleConnection() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
            .from("profiles")
            .select("google_access_token, google_refresh_token")
            .eq("id", user.id)
            .single();

        if (profile?.google_access_token && profile?.google_refresh_token) {
            setIsGoogleConnected(true);
        }
    }

    async function fetchBookings() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from("bookings")
            .select("id, client_name, session_date, status, services(name)")
            .eq("user_id", user.id)
            .not("session_date", "is", null);

        if (data) {
            const bookingEvents: CalendarEvent[] = data.map((booking: any) => {
                const sessionDate = new Date(booking.session_date);
                const endDate = new Date(sessionDate.getTime() + 2 * 60 * 60 * 1000);
                return {
                    title: `📋 ${booking.client_name} - ${booking.services?.name || "Booking"}`,
                    start: sessionDate,
                    end: endDate,
                    bookingId: booking.id,
                    clientName: booking.client_name,
                    status: booking.status,
                    serviceName: booking.services?.name || "Layanan",
                    source: "booking" as const,
                };
            });
            setEvents(bookingEvents);
        }
        setLoading(false);
    }

    function handleConnectGoogle() {
        const width = 500;
        const height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        window.open(
            "/api/google/auth",
            "google-auth",
            `width=${width},height=${height},left=${left},top=${top},popup=yes`
        );
    }

    async function handleDisconnectGoogle() {
        if (!confirm(t("putuskanConfirm"))) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase
            .from("profiles")
            .update({
                google_access_token: null,
                google_refresh_token: null,
                google_token_expiry: null,
            })
            .eq("id", user.id);

        setIsGoogleConnected(false);
    }

    async function handleSyncToGoogle() {
        if (events.filter(e => e.source === "booking").length === 0) return alert(t("tidakAdaBooking"));
        setSyncing(true);

        try {
            const res = await fetch("/api/google/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    events: events.filter(e => e.source === "booking").map((e) => ({
                        summary: e.title,
                        description: `Status: ${e.status} | Klien: ${e.clientName} | Layanan: ${e.serviceName}`,
                        start: e.start?.toISOString(),
                        end: e.end?.toISOString(),
                    })),
                }),
            });
            const result = await res.json();
            if (result.success) {
                alert(t("berhasilSinkron", { count: result.count }));
            } else {
                alert(`Gagal: ${result.error}`);
            }
        } catch {
            alert(t("gagalSinkron"));
        }
        setSyncing(false);
    }

    const eventStyleGetter = (event: CalendarEvent) => {
        let backgroundColor = "#64748b";
        let borderColor = "#475569";
        switch (event.status?.toLowerCase()) {
            case "pending": backgroundColor = "#64748b"; borderColor = "#475569"; break;
            case "dp": backgroundColor = "#f59e0b"; borderColor = "#d97706"; break;
            case "terjadwal": backgroundColor = "#3b82f6"; borderColor = "#2563eb"; break;
            case "selesai": backgroundColor = "#10b981"; borderColor = "#059669"; break;
            case "batal": backgroundColor = "#ef4444"; borderColor = "#dc2626"; break;
        }
        return {
            style: {
                backgroundColor, borderColor, color: "white",
                borderRadius: "5px", padding: "2px 5px",
                display: "block", border: "1px solid", opacity: 0.9,
            }
        };
    };

    return (
        <div className="space-y-6 h-[calc(100vh-8rem)] min-h-[600px] flex flex-col">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
                    <p className="text-muted-foreground">{t("subtitle")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {isGoogleConnected ? (
                        <>
                            <Button
                                onClick={handleSyncToGoogle}
                                disabled={syncing}
                                className="gap-2"
                            >
                                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}
                                {syncing ? t("menyinkronkan") : t("sinkron")}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleDisconnectGoogle}
                                className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                            >
                                <Unlink className="w-4 h-4" />
                                {t("putuskan")}
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="outline"
                            onClick={handleConnectGoogle}
                            className="gap-2"
                        >
                            <Link2 className="w-4 h-4" />
                            {t("hubungkan")}
                        </Button>
                    )}
                </div>
            </div>

            <div className="rounded-xl border bg-card text-card-foreground shadow-sm flex-1 p-4 relative overflow-hidden flex flex-col h-full">
                {loading && (
                    <div className="absolute inset-0 z-10 bg-background/50 flex items-center justify-center backdrop-blur-sm">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                )}

                <style dangerouslySetInnerHTML={{
                    __html: `
                    .rbc-calendar { font-family: var(--font-sans); }
                    .rbc-toolbar { flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
                    .rbc-btn-group > button {
                        color: var(--foreground); border-color: var(--border);
                        background-color: transparent;
                        border-radius: var(--radius-md) !important; margin-right: 4px;
                    }
                    .rbc-btn-group > button:hover { background-color: var(--muted); }
                    .rbc-btn-group > button.rbc-active {
                        background-color: var(--primary); color: var(--primary-foreground);
                        box-shadow: none; border-color: var(--primary);
                    }
                    .rbc-header { padding: 8px 4px; font-weight: 500; font-size: 0.875rem; border-bottom: 1px solid var(--border); }
                    .rbc-month-view, .rbc-time-view, .rbc-agenda-view { border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
                    .rbc-month-row, .rbc-day-bg, .rbc-time-header-content { border-color: var(--border) !important; }
                    .rbc-today { background-color: var(--muted) !important; }
                    .rbc-off-range-bg { background-color: var(--background) !important; }
                    .rbc-event { padding: 2px 4px !important; font-size: 0.75rem; font-weight: 500; }
                    .dark .rbc-toolbar button { color: #fff; }
                    .dark .rbc-day-bg { border-color: #27272a; }
                    .dark .rbc-header { border-bottom-color: #27272a; }
                    .dark .rbc-month-row + .rbc-month-row { border-top-color: #27272a; }
                    .dark .rbc-time-content { border-top-color: #27272a; }
                    .dark .rbc-time-header-content { border-left-color: #27272a; }
                    .dark .rbc-day-slot .rbc-time-slot { border-top-color: #27272a; }
                `}} />

                <div className="flex-1 min-h-0">
                    <Calendar
                        localizer={localizer}
                        events={events}
                        startAccessor="start"
                        endAccessor="end"
                        style={{ height: "100%" }}
                        culture="id-ID"
                        eventPropGetter={eventStyleGetter}
                        messages={{
                            next: t("maju"), previous: t("mundur"), today: t("hariIni"),
                            month: t("bulan"), week: t("minggu"), day: t("hari"), agenda: t("agenda"),
                            date: t("tanggal"), time: t("waktu"), event: t("booking"),
                            noEventsInRange: t("tidakAdaJadwal"),
                        }}
                        popup
                    />
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#64748b]"></span> {t("pending")}</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#f59e0b]"></span> {t("dp")}</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#3b82f6]"></span> {t("terjadwal")}</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#10b981]"></span> {t("selesai")}</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#ef4444]"></span> {t("batal")}</span>
            </div>
        </div>
    );
}
