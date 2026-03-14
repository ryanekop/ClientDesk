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
    CANCELLED_BOOKING_STATUS,
    DEFAULT_CLIENT_STATUSES,
    getBookingStatusOptions,
} from "@/lib/client-status";
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

type StatusVisual = {
    eventBackground: string;
    eventBorder: string;
    badgeClass: string;
};

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
const STATUS_VISUAL_PALETTE: StatusVisual[] = [
    {
        eventBackground: "#3b82f6",
        eventBorder: "#2563eb",
        badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
    },
    {
        eventBackground: "#a855f7",
        eventBorder: "#9333ea",
        badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400",
    },
    {
        eventBackground: "#f59e0b",
        eventBorder: "#d97706",
        badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
    },
    {
        eventBackground: "#f97316",
        eventBorder: "#ea580c",
        badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
    },
    {
        eventBackground: "#ec4899",
        eventBorder: "#db2777",
        badgeClass: "bg-pink-100 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400",
    },
    {
        eventBackground: "#10b981",
        eventBorder: "#059669",
        badgeClass: "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400",
    },
    {
        eventBackground: "#10b981",
        eventBorder: "#059669",
        badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    },
    {
        eventBackground: "#06b6d4",
        eventBorder: "#0891b2",
        badgeClass: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400",
    },
    {
        eventBackground: "#6366f1",
        eventBorder: "#4f46e5",
        badgeClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400",
    },
    {
        eventBackground: "#f43f5e",
        eventBorder: "#e11d48",
        badgeClass: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
    },
];
const DEFAULT_STATUS_OPTIONS = getBookingStatusOptions(DEFAULT_CLIENT_STATUSES);

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
    const [statusOptions, setStatusOptions] = React.useState<string[]>(DEFAULT_STATUS_OPTIONS);
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

    const { statusVisuals, statusVisualsLowercase } = React.useMemo(() => {
        const map: Record<string, StatusVisual> = {};
        statusOptions
            .filter((status) => status.toLowerCase() !== CANCELLED_BOOKING_STATUS.toLowerCase())
            .forEach((status, index) => {
                map[status] = STATUS_VISUAL_PALETTE[index % STATUS_VISUAL_PALETTE.length];
            });
        map[CANCELLED_BOOKING_STATUS] = {
            eventBackground: "#ef4444",
            eventBorder: "#dc2626",
            badgeClass: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
        };

        const lowerMap: Record<string, StatusVisual> = {};
        Object.entries(map).forEach(([status, visual]) => {
            lowerMap[status.toLowerCase()] = visual;
        });

        return { statusVisuals: map, statusVisualsLowercase: lowerMap };
    }, [statusOptions]);

    const resolveStatusVisual = React.useCallback((status?: string | null) => {
        if (!status) return null;
        return statusVisuals[status] || statusVisualsLowercase[status.toLowerCase()] || null;
    }, [statusVisuals, statusVisualsLowercase]);

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
            .select("google_access_token, google_refresh_token, calendar_event_format, calendar_event_format_map, studio_name, custom_client_statuses")
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
        setStatusOptions(getBookingStatusOptions((profile as any)?.custom_client_statuses as string[] | null | undefined));
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
        const visual = resolveStatusVisual(event.status);
        const backgroundColor = visual?.eventBackground || "#64748b";
        const borderColor = visual?.eventBorder || "#475569";
        return {
            style: {
                backgroundColor, borderColor, color: "white",
                borderRadius: "5px", padding: "2px 5px",
                display: "block", border: "1px solid", opacity: 0.9,
                cursor: "pointer",
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
                {statusOptions.map((status) => {
                    const visual = resolveStatusVisual(status);
                    return (
                        <span key={status} className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: visual?.eventBackground || "#64748b" }}></span>
                            {status}
                        </span>
                    );
                })}
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
                <DialogContent className="w-[calc(100vw-2rem)] max-w-[760px] overflow-hidden">
                    <DialogHeader>
                        <DialogTitle className="text-lg">{selectedEvent?.clientName}</DialogTitle>
                    </DialogHeader>
                    {selectedEvent && (
                        <div className="space-y-3 py-1">
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground w-20 shrink-0">Paket</span>
                                <span className="font-medium break-words">{selectedEvent.serviceName}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground w-20 shrink-0">Jadwal</span>
                                <span className="font-medium break-words">{selectedEvent.start ? format(selectedEvent.start, "PPPp", { locale: id }) : "-"}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground w-20 shrink-0">Status</span>
                                <span className={cn(
                                    "text-xs font-medium px-2 py-0.5 rounded-full",
                                    resolveStatusVisual(selectedEvent.status)?.badgeClass || "bg-muted text-muted-foreground",
                                )}>
                                    {selectedEvent.status || "-"}
                                </span>
                            </div>
                            {selectedEvent.location && (
                                <div className="flex items-start gap-2 text-sm">
                                    <span className="text-muted-foreground w-20 shrink-0">Lokasi</span>
                                    <span className="font-medium break-words">{selectedEvent.location}</span>
                                </div>
                            )}
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
