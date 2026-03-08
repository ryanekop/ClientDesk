"use client";

import * as React from "react";
import { Clock, CalendarDays, MapPin, User } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";

type UpcomingBooking = {
    id: string;
    client_name: string;
    booking_code: string;
    session_date: string;
    location: string | null;
    services: { name: string } | null;
    status: string;
};

export function RealtimeClock() {
    const [now, setNow] = React.useState(new Date());

    React.useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const dayName = now.toLocaleDateString("id-ID", { weekday: "long" });
    const dateStr = now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    return (
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
            <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-500/10">
                    <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Waktu Sekarang</span>
            </div>
            <p className="text-lg font-bold">{dayName}, {dateStr}</p>
            <div className="text-2xl font-bold tabular-nums tracking-tight text-primary mt-1">{timeStr}</div>
        </div>
    );
}

export function UpcomingBookingCard() {
    const supabase = createClient();
    const [booking, setBooking] = React.useState<UpcomingBooking | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const now = new Date().toISOString();
            const { data } = await supabase
                .from("bookings")
                .select("id, client_name, booking_code, session_date, location, status, services(name)")
                .eq("user_id", user.id)
                .gte("session_date", now)
                .neq("status", "Batal")
                .order("session_date", { ascending: true })
                .limit(1)
                .single();

            setBooking(data as any);
            setLoading(false);
        }
        load();
    }, []);

    if (loading) {
        return (
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-500/10">
                        <CalendarDays className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Booking Terdekat</span>
                </div>
                <div className="h-12 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                </div>
            </div>
        );
    }

    if (!booking) {
        return (
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-500/10">
                        <CalendarDays className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Booking Terdekat</span>
                </div>
                <p className="text-sm text-muted-foreground">Tidak ada booking mendatang.</p>
            </div>
        );
    }

    const sessionDate = new Date(booking.session_date);
    const dateStr = sessionDate.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });
    const timeStr = sessionDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

    // Calculate days until
    const now = new Date();
    const diffMs = sessionDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const urgencyLabel = diffDays === 0 ? "Hari ini" : diffDays === 1 ? "Besok" : `${diffDays} hari lagi`;

    const statusColors: Record<string, string> = {
        pending: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
        dp: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
        terjadwal: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
        selesai: "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400",
    };

    return (
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-500/10">
                        <CalendarDays className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Booking Terdekat</span>
                </div>
                <span className={cn(
                    "text-xs font-semibold px-2 py-0.5 rounded-full",
                    diffDays <= 1 ? "bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400" : "bg-purple-100 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400"
                )}>
                    {urgencyLabel}
                </span>
            </div>
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="font-semibold text-sm">{booking.client_name}</span>
                    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full ml-auto", statusColors[booking.status?.toLowerCase()] || statusColors.pending)}>
                        {booking.status}
                    </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                    <span>{dateStr}, {timeStr}</span>
                </div>
                {booking.location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{booking.location}</span>
                    </div>
                )}
                <div className="text-xs text-muted-foreground">
                    {(booking.services as any)?.name || booking.booking_code}
                </div>
            </div>
        </div>
    );
}
