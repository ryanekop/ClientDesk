"use client";

import * as React from "react";
import { Calendar, dateFnsLocalizer, Event, ToolbarProps, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { id } from "date-fns/locale/id";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { createClient } from "@/utils/supabase/client";
import { Loader2, Link2, Unlink, CalendarPlus, ChevronLeft, ChevronRight, CalendarDays, CalendarRange, Clock, List, ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";

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

/* ─── Custom Toolbar ─── */
function CustomToolbar({ onNavigate, onView, view, label }: ToolbarProps<CalendarEvent, object>) {
    const viewButtons: { key: View; label: string; icon: React.ReactNode }[] = [
        { key: "month", label: "Bulan", icon: <CalendarDays className="w-3.5 h-3.5" /> },
        { key: "week", label: "Minggu", icon: <CalendarRange className="w-3.5 h-3.5" /> },
        { key: "day", label: "Hari", icon: <Clock className="w-3.5 h-3.5" /> },
        { key: "agenda", label: "Agenda", icon: <List className="w-3.5 h-3.5" /> },
    ];

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-1">
                <button onClick={() => onNavigate("TODAY")}
                    className="inline-flex items-center gap-1.5 px-3 h-8 text-xs font-medium rounded-md border border-input bg-background hover:bg-muted transition-colors">
                    <CalendarDays className="w-3.5 h-3.5" /> Hari Ini
                </button>
                <button onClick={() => onNavigate("PREV")}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-input bg-background hover:bg-muted transition-colors" title="Mundur">
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => onNavigate("NEXT")}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-input bg-background hover:bg-muted transition-colors" title="Maju">
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            <span className="text-sm font-semibold text-foreground">{label}</span>

            <div className="flex items-center gap-1 bg-muted/50 p-0.5 rounded-lg">
                {viewButtons.map(vb => (
                    <button key={vb.key} onClick={() => onView(vb.key)}
                        className={cn(
                            "inline-flex items-center gap-1.5 px-3 h-7 text-xs font-medium rounded-md transition-colors",
                            view === vb.key
                                ? "bg-foreground text-background shadow-sm"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}>
                        {vb.icon} {vb.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default function CalendarPage() {
    const supabase = createClient();
    const t = useTranslations("Calendar");
    const router = useRouter();
    const locale = useLocale();
    const [events, setEvents] = React.useState<CalendarEvent[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [isGoogleConnected, setIsGoogleConnected] = React.useState(false);
    const [syncing, setSyncing] = React.useState(false);

    // Event popup
    const [selectedEvent, setSelectedEvent] = React.useState<CalendarEvent | null>(null);
    const [eventPopupOpen, setEventPopupOpen] = React.useState(false);

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
                    title: `${booking.client_name} - ${booking.services?.name || "Booking"}`,
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

    function handleSelectEvent(event: CalendarEvent) {
        setSelectedEvent(event);
        setEventPopupOpen(true);
    }

    function openGoogleCalendarEvent() {
        if (!selectedEvent?.start) return;
        const start = selectedEvent.start;
        const dateStr = format(start, "yyyyMMdd'T'HHmmss");
        const titleStr = typeof selectedEvent.title === "string" ? selectedEvent.title : String(selectedEvent.title || "");
        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(titleStr)}&dates=${dateStr}/${dateStr}`;
        window.open(url, "_blank");
        setEventPopupOpen(false);
    }

    function goToBookingDetail() {
        if (!selectedEvent?.bookingId) return;
        router.push(`/${locale}/bookings/${selectedEvent.bookingId}`);
        setEventPopupOpen(false);
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
                cursor: "pointer",
            }
        };
    };

    const statusLabel: Record<string, string> = {
        pending: "Pending", dp: "DP", terjadwal: "Terjadwal",
        selesai: "Selesai", batal: "Batal",
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
                    .rbc-toolbar { display: none !important; }
                    .rbc-header { padding: 8px 4px; font-weight: 500; font-size: 0.875rem; border-bottom: 1px solid var(--border); }
                    .rbc-month-view, .rbc-time-view, .rbc-agenda-view { border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
                    .rbc-month-row, .rbc-day-bg, .rbc-time-header-content { border-color: var(--border) !important; }
                    .rbc-today { background-color: var(--muted) !important; }
                    .rbc-off-range-bg { background-color: var(--background) !important; }
                    .rbc-event { padding: 2px 4px !important; font-size: 0.75rem; font-weight: 500; cursor: pointer !important; }
                    .rbc-event:hover { opacity: 1 !important; filter: brightness(1.1); }
                    .dark .rbc-day-bg { border-color: #27272a; }
                    .dark .rbc-header { border-bottom-color: #27272a; }
                    .dark .rbc-month-row + .rbc-month-row { border-top-color: #27272a; }
                    .dark .rbc-time-content { border-top-color: #27272a; }
                    .dark .rbc-time-header-content { border-left-color: #27272a; }
                    .dark .rbc-day-slot .rbc-time-slot { border-top-color: #27272a; }
                `}} />

                <div className="flex-1 min-h-0 flex flex-col">
                    <Calendar
                        localizer={localizer}
                        events={events}
                        startAccessor="start"
                        endAccessor="end"
                        style={{ height: "100%" }}
                        culture="id-ID"
                        eventPropGetter={eventStyleGetter}
                        onSelectEvent={handleSelectEvent}
                        components={{
                            toolbar: CustomToolbar,
                        }}
                        messages={{
                            next: "Maju", previous: "Mundur", today: "Hari Ini",
                            month: "Bulan", week: "Minggu", day: "Hari", agenda: "Agenda",
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

            {/* Event Popup */}
            <Dialog open={eventPopupOpen} onOpenChange={setEventPopupOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-lg">{selectedEvent?.clientName}</DialogTitle>
                    </DialogHeader>
                    {selectedEvent && (
                        <div className="space-y-3 py-1">
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground w-20 shrink-0">Paket</span>
                                <span className="font-medium">{selectedEvent.serviceName}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground w-20 shrink-0">Jadwal</span>
                                <span className="font-medium">{selectedEvent.start ? format(selectedEvent.start, "PPPp", { locale: id }) : "-"}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground w-20 shrink-0">Status</span>
                                <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full",
                                    selectedEvent.status?.toLowerCase() === "pending" && "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
                                    selectedEvent.status?.toLowerCase() === "dp" && "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
                                    selectedEvent.status?.toLowerCase() === "terjadwal" && "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
                                    selectedEvent.status?.toLowerCase() === "selesai" && "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400",
                                    selectedEvent.status?.toLowerCase() === "batal" && "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
                                )}>
                                    {statusLabel[selectedEvent.status?.toLowerCase() || ""] || selectedEvent.status}
                                </span>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
                        <Button variant="outline" className="flex-1 gap-2" onClick={openGoogleCalendarEvent}>
                            <ExternalLink className="w-4 h-4" /> Buka di Google Calendar
                        </Button>
                        <Button className="flex-1 gap-2 bg-foreground text-background hover:bg-foreground/90" onClick={goToBookingDetail}>
                            <Info className="w-4 h-4" /> Lihat Detail Booking
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
