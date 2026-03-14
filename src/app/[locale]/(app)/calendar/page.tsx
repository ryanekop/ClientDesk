"use client";

import * as React from "react";
import { Calendar, dateFnsLocalizer, Event, ToolbarProps, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { id } from "date-fns/locale/id";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { createClient } from "@/utils/supabase/client";
import { Loader2, Link2, Unlink, CalendarPlus, ChevronLeft, ChevronRight, CalendarDays, CalendarRange, Clock, List, ExternalLink, Info, Users, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { getSessionDateUTC, formatSessionDate } from "@/utils/format-date";
import {
    DEFAULT_CALENDAR_EVENT_FORMAT,
    applyCalendarTemplate,
    buildCalendarRangeFromStoredSession,
    buildCalendarTemplateVars,
    resolveTemplateByEventType,
} from "@/utils/google/template";

const locales = { "id-ID": id };

const localizer = dateFnsLocalizer({
    format, parse, startOfWeek, getDay, locales,
});

type CalendarEvent = Event & {
    bookingId?: string;
    clientName?: string;
    status?: string;
    serviceName?: string;
    location?: string;
    source: "booking" | "google" | "freelancer";
    freelancerName?: string;
    freelancerColor?: string;
};

type FreelancerCal = { id: string; name: string; google_email: string };

const FREELANCER_COLORS = ["#8b5cf6", "#ec4899", "#f97316", "#06b6d4", "#84cc16"];

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
                            "inline-flex items-center gap-1.5 px-2 sm:px-3 h-7 text-xs font-medium rounded-md transition-colors",
                            view === vb.key
                                ? "bg-foreground text-background shadow-sm"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}>
                        {vb.icon} <span className="hidden sm:inline">{vb.label}</span>
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
    const [calendarEventFormat, setCalendarEventFormat] = React.useState(DEFAULT_CALENDAR_EVENT_FORMAT);
    const [calendarEventFormatMap, setCalendarEventFormatMap] = React.useState<Record<string, string>>({});
    const [studioName, setStudioName] = React.useState("Client Desk");
    const [calendarWarningDismissed, setCalendarWarningDismissed] = React.useState(() => {
        if (typeof window !== "undefined") return localStorage.getItem("dismiss_calendar_warning") === "1";
        return false;
    });

    // Freelancer calendars
    const [freelancerCals, setFreelancerCals] = React.useState<FreelancerCal[]>([]);
    const [activeFreelancers, setActiveFreelancers] = React.useState<Set<string>>(new Set());
    const [freelancerEvents, setFreelancerEvents] = React.useState<CalendarEvent[]>([]);
    const [loadingFreelancers, setLoadingFreelancers] = React.useState(false);

    // Event popup
    const [selectedEvent, setSelectedEvent] = React.useState<CalendarEvent | null>(null);
    const [eventPopupOpen, setEventPopupOpen] = React.useState(false);

    React.useEffect(() => {
        fetchBookings();
        checkGoogleConnection();
        fetchFreelancerList();

        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === "GOOGLE_AUTH_SUCCESS") {
                setIsGoogleConnected(true);
            }
        };
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    React.useEffect(() => {
        fetchBookings();
    }, [calendarEventFormat, calendarEventFormatMap, studioName]);

    // Fetch freelancer calendar events when toggles change
    React.useEffect(() => {
        fetchFreelancerCalendars();
    }, [activeFreelancers]);

    async function fetchFreelancerList() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
            .from("freelance")
            .select("id, name, google_email")
            .eq("user_id", user.id)
            .eq("status", "active")
            .not("google_email", "is", null);
        setFreelancerCals((data || []).filter((f: any) => f.google_email) as FreelancerCal[]);
    }

    async function fetchFreelancerCalendars() {
        if (activeFreelancers.size === 0) { setFreelancerEvents([]); return; }
        setLoadingFreelancers(true);
        const allEvents: CalendarEvent[] = [];

        for (const fId of activeFreelancers) {
            const f = freelancerCals.find(fc => fc.id === fId);
            if (!f) continue;
            const colorIdx = freelancerCals.indexOf(f) % FREELANCER_COLORS.length;
            try {
                const res = await fetch(`/api/google/freelancer-calendar?email=${encodeURIComponent(f.google_email)}`);
                const json = await res.json();
                if (json.success && json.events) {
                    const mapped: CalendarEvent[] = json.events.map((e: any) => ({
                        title: `[${f.name}] ${e.title}`,
                        start: new Date(e.start),
                        end: new Date(e.end),
                        source: "freelancer" as const,
                        freelancerName: f.name,
                        freelancerColor: FREELANCER_COLORS[colorIdx],
                    }));
                    allEvents.push(...mapped);
                }
            } catch { /* skip errors */ }
        }
        setFreelancerEvents(allEvents);
        setLoadingFreelancers(false);
    }

    async function checkGoogleConnection() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
            .from("profiles")
            .select("google_access_token, google_refresh_token, calendar_event_format, calendar_event_format_map, studio_name")
            .eq("id", user.id)
            .single();

        if ((profile as any)?.google_access_token || (profile as any)?.google_refresh_token) {
            setIsGoogleConnected(true);
        }
        if ((profile as any)?.calendar_event_format) {
            setCalendarEventFormat((profile as any).calendar_event_format);
        }
        if ((profile as any)?.calendar_event_format_map && typeof (profile as any).calendar_event_format_map === "object") {
            setCalendarEventFormatMap((profile as any).calendar_event_format_map);
        }
        if ((profile as any)?.studio_name) {
            setStudioName((profile as any).studio_name);
        }
    }

    async function fetchBookings() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from("bookings")
            .select("id, booking_code, client_name, session_date, status, location, event_type, extra_fields, services(name, duration_minutes)")
            .eq("user_id", user.id)
            .not("session_date", "is", null);

        if (data) {
            const bookingEvents: CalendarEvent[] = data.map((booking: any) => {
                const sessionDate = getSessionDateUTC(booking.session_date);
                const durationMinutes = booking.services?.duration_minutes || 120;
                const endDate = new Date(sessionDate.getTime() + durationMinutes * 60 * 1000);
                const range = buildCalendarRangeFromStoredSession(booking.session_date, durationMinutes);
                const eventFormat = resolveTemplateByEventType(
                    calendarEventFormatMap,
                    booking.event_type,
                    calendarEventFormat || DEFAULT_CALENDAR_EVENT_FORMAT,
                );
                const title = applyCalendarTemplate(eventFormat, buildCalendarTemplateVars({
                    client_name: booking.client_name,
                    service_name: booking.services?.name || booking.event_type || "Booking",
                    event_type: booking.event_type || "-",
                    booking_code: booking.booking_code || "",
                    studio_name: studioName || "Client Desk",
                    location: booking.location || "-",
                    ...range.templateVars,
                }, booking.extra_fields));
                return {
                    title,
                    start: sessionDate,
                    end: endDate,
                    bookingId: booking.id,
                    clientName: booking.client_name,
                    status: booking.status,
                    serviceName: booking.services?.name || "Layanan",
                    location: booking.location || undefined,
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
        const bookingIds = events
            .filter((event) => event.source === "booking" && typeof event.bookingId === "string")
            .map((event) => event.bookingId as string);
        if (bookingIds.length === 0) return alert(t("tidakAdaBooking"));
        setSyncing(true);

        try {
            const res = await fetch("/api/google/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bookingIds,
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

    const allEvents = [...events, ...freelancerEvents];

    const eventStyleGetter = (event: CalendarEvent) => {
        // Freelancer calendar events
        if (event.source === "freelancer" && event.freelancerColor) {
            return {
                style: {
                    backgroundColor: event.freelancerColor, borderColor: event.freelancerColor,
                    color: "#fff", borderRadius: "6px", border: "none", opacity: 0.85, cursor: "pointer",
                }
            };
        }
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
                    {isGoogleConnected && (
                        <Button
                            onClick={handleSyncToGoogle}
                            disabled={syncing}
                            className="gap-2"
                        >
                            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}
                            {syncing ? t("menyinkronkan") : t("sinkron")}
                        </Button>
                    )}
                </div>
            </div>

            {/* Warning banner when not connected */}
            {!isGoogleConnected && !calendarWarningDismissed && (
                <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 px-4 py-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <p className="text-sm text-amber-800 dark:text-amber-300 flex-1">
                        Google Calendar belum terhubung. <a href="/id/settings" className="underline font-medium">Hubungkan di Pengaturan</a> untuk sinkronisasi jadwal otomatis.
                    </p>
                    <button onClick={() => { setCalendarWarningDismissed(true); localStorage.setItem("dismiss_calendar_warning", "1"); }} className="p-1 rounded hover:bg-amber-200/50 dark:hover:bg-amber-500/20 transition-colors cursor-pointer">
                        <X className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </button>
                </div>
            )}

            <div className="rounded-xl border bg-card text-card-foreground shadow-sm flex-1 p-4 relative flex flex-col min-h-[500px]">
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

                    /* Mobile: smaller text/padding only */
                    @media (max-width: 767px) {
                        .rbc-header { padding: 4px 2px; font-size: 0.7rem; }
                        .rbc-event { padding: 1px 4px !important; font-size: 0.65rem; }
                        .rbc-show-more { font-size: 0.6rem !important; }
                    }
                `}} />

                <div className="flex-1 min-h-0 flex flex-col">
                    <Calendar
                        localizer={localizer}
                        events={allEvents}
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
                        length={365}
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
                {freelancerCals.map((f, i) => activeFreelancers.has(f.id) && (
                    <span key={f.id} className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: FREELANCER_COLORS[i % FREELANCER_COLORS.length] }}></span>
                        {f.name}
                    </span>
                ))}
            </div>

            {/* Freelancer Calendar Toggles */}
            {freelancerCals.length > 0 && (
                <div className="rounded-xl border bg-card p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Users className="w-4 h-4" />
                        Kalender Freelancer
                        {loadingFreelancers && <Loader2 className="w-3 h-3 animate-spin" />}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {freelancerCals.map((f, i) => {
                            const isActive = activeFreelancers.has(f.id);
                            const color = FREELANCER_COLORS[i % FREELANCER_COLORS.length];
                            return (
                                <button
                                    key={f.id}
                                    onClick={() => {
                                        setActiveFreelancers(prev => {
                                            const next = new Set(prev);
                                            if (next.has(f.id)) next.delete(f.id); else next.add(f.id);
                                            return next;
                                        });
                                    }}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer",
                                        isActive
                                            ? "text-white border-transparent"
                                            : "border-input text-muted-foreground hover:bg-muted/50"
                                    )}
                                    style={isActive ? { backgroundColor: color, borderColor: color } : {}}
                                >
                                    {f.name}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-[10px] text-muted-foreground">Freelancer harus share Google Calendar ke email admin Anda terlebih dahulu.</p>
                </div>
            )}

            {/* Event Popup */}
            <Dialog open={eventPopupOpen} onOpenChange={setEventPopupOpen}>
                <DialogContent className="w-[calc(100vw-2rem)] max-w-[760px] p-0 overflow-hidden">
                    <DialogHeader>
                        <DialogTitle className="text-2xl px-6 pt-6">{selectedEvent?.clientName}</DialogTitle>
                    </DialogHeader>
                    {selectedEvent && (
                        <div className="space-y-4 px-6 py-4">
                            <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-4 text-sm sm:text-base">
                                <span className="text-muted-foreground shrink-0">Paket</span>
                                <span className="font-semibold break-words">{selectedEvent.serviceName}</span>
                            </div>
                            <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-4 text-sm sm:text-base">
                                <span className="text-muted-foreground shrink-0">Jadwal</span>
                                <span className="font-semibold break-words">{selectedEvent.start ? format(selectedEvent.start, "PPPp", { locale: id }) : "-"}</span>
                            </div>
                            <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-4 text-sm sm:text-base">
                                <span className="text-muted-foreground shrink-0">Status</span>
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
                            {selectedEvent.location && (
                                <div className="grid grid-cols-[120px_minmax(0,1fr)] items-start gap-4 text-sm sm:text-base">
                                    <span className="text-muted-foreground shrink-0">Lokasi</span>
                                    <span className="font-semibold break-words">{selectedEvent.location}</span>
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter className="flex-col sm:flex-row gap-3 px-6 pb-6 pt-1">
                        <Button variant="outline" className="flex-1 gap-2 h-12 text-base" onClick={openGoogleCalendarEvent}>
                            <ExternalLink className="w-4 h-4" /> Buka di Google Calendar
                        </Button>
                        <Button className="flex-1 gap-2 h-12 text-base bg-foreground text-background hover:bg-foreground/90" onClick={goToBookingDetail}>
                            <Info className="w-4 h-4" /> Lihat Detail Booking
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
