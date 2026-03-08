"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Clock, PlayCircle, HardDrive, Edit3, Camera, Loader2, ExternalLink, Users } from "lucide-react";

type BookingData = {
    bookingCode: string;
    clientName: string;
    sessionDate: string | null;
    eventType: string | null;
    clientStatus: string | null;
    queuePosition: number | null;
    status: string;
    serviceName: string | null;
    driveUrl: string | null;
    createdAt: string;
};

const STATUS_STEPS = [
    { key: "Booking Confirmed", label: "Booking Dikonfirmasi", icon: CheckCircle2 },
    { key: "Sesi Foto / Acara", label: "Sesi Foto / Acara", icon: Camera },
    { key: "Antrian Edit", label: "Antrian Edit", icon: Users },
    { key: "Proses Edit", label: "Proses Edit", icon: Edit3 },
    { key: "Revisi", label: "Revisi", icon: Edit3 },
    { key: "File Siap", label: "File Siap (Google Drive)", icon: HardDrive },
    { key: "Selesai", label: "Selesai", icon: CheckCircle2 },
];

function getStepIndex(status: string | null): number {
    if (!status) return -1;
    return STATUS_STEPS.findIndex(s => s.key === status);
}

export default function TrackingPage() {
    const params = useParams();
    const uuid = params?.uuid as string;
    const [booking, setBooking] = React.useState<BookingData | null>(null);
    const [vendorName, setVendorName] = React.useState("");
    const [loading, setLoading] = React.useState(true);
    const [notFound, setNotFound] = React.useState(false);

    React.useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`/api/public/track?uuid=${encodeURIComponent(uuid)}`);
                const data = await res.json();
                if (!data.success) { setNotFound(true); setLoading(false); return; }
                setBooking(data.booking);
                setVendorName(data.vendorName || "");
            } catch {
                setNotFound(true);
            }
            setLoading(false);
        }
        if (uuid) load();
    }, [uuid]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (notFound || !booking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 px-4">
                <div className="text-center space-y-4 max-w-md mx-auto">
                    <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto text-4xl">🔍</div>
                    <h2 className="text-2xl font-bold">Booking Tidak Ditemukan</h2>
                    <p className="text-muted-foreground">Link tracking tidak valid atau booking sudah dihapus.</p>
                </div>
            </div>
        );
    }

    const currentIdx = getStepIndex(booking.clientStatus);
    const sessionDate = booking.sessionDate
        ? new Date(booking.sessionDate).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
        : "-";

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-8 sm:py-12 px-4">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-xl font-bold tracking-tight">{vendorName || "Studio"}</h1>
                    <p className="text-muted-foreground text-sm">Tracking Status Booking</p>
                </div>

                {/* Booking Info Card */}
                <div className="bg-background rounded-2xl shadow-lg border p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
                        <div>
                            <h2 className="text-lg font-bold">Detail Booking</h2>
                            <p className="text-muted-foreground text-sm">Kode: <span className="font-mono font-semibold text-primary">{booking.bookingCode}</span></p>
                        </div>
                        <div className="flex items-center gap-2">
                            {booking.queuePosition && booking.queuePosition > 0 && (
                                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                                    Antrian #{booking.queuePosition}
                                </span>
                            )}
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${currentIdx >= STATUS_STEPS.length - 1
                                    ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                                    : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                                }`}>
                                {booking.clientStatus || booking.status || "Pending"}
                            </span>
                        </div>
                    </div>

                    <div className="grid gap-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Nama</span>
                            <span className="font-medium">{booking.clientName}</span>
                        </div>
                        {booking.serviceName && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Paket</span>
                                <span className="font-medium">{booking.serviceName}</span>
                            </div>
                        )}
                        {booking.eventType && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Tipe Acara</span>
                                <span className="font-medium">{booking.eventType}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Jadwal</span>
                            <span className="font-medium">{sessionDate}</span>
                        </div>
                    </div>
                </div>

                {/* Timeline */}
                <div className="bg-background rounded-2xl shadow-lg border p-6">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-6">Progress</h3>
                    <div className="space-y-0">
                        {STATUS_STEPS.map((step, idx) => {
                            const isDone = idx <= currentIdx;
                            const isCurrent = idx === currentIdx;
                            const isLast = idx === STATUS_STEPS.length - 1;
                            const Icon = step.icon;

                            return (
                                <div key={step.key} className="relative flex gap-4">
                                    {/* Vertical Line */}
                                    {!isLast && (
                                        <div className={`absolute top-10 bottom-0 left-[19px] w-[2px] ${isDone && !isCurrent ? "bg-primary" : "bg-border"}`} />
                                    )}

                                    <div className={`relative z-10 flex shrink-0 items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${isDone
                                            ? "bg-primary border-primary text-primary-foreground"
                                            : isCurrent
                                                ? "bg-background border-primary text-primary ring-4 ring-primary/10"
                                                : "bg-background border-border text-muted-foreground"
                                        }`}>
                                        <Icon className="w-4 h-4" />
                                    </div>

                                    <div className={`flex flex-col pb-8 pt-2 ${!isDone && !isCurrent ? "opacity-40" : ""}`}>
                                        <p className={`font-semibold text-sm ${isCurrent ? "text-primary" : ""}`}>
                                            {step.label}
                                            {isCurrent && booking.queuePosition && booking.queuePosition > 0 && step.key === "Antrian Edit" && (
                                                <span className="text-xs font-normal text-muted-foreground ml-2">(Posisi #{booking.queuePosition})</span>
                                            )}
                                        </p>
                                        {isCurrent && (
                                            <p className="text-xs text-primary mt-0.5 flex items-center gap-1">
                                                <Clock className="w-3 h-3" /> Sedang berlangsung
                                            </p>
                                        )}
                                        {isDone && !isCurrent && (
                                            <p className="text-xs text-muted-foreground mt-0.5">✓ Selesai</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Drive Link */}
                {booking.driveUrl && (
                    <div className="bg-background rounded-2xl shadow-lg border p-6">
                        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">File Hasil</h3>
                        <a
                            href={booking.driveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                            <HardDrive className="w-4 h-4" />
                            Buka Google Drive
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    </div>
                )}

                <p className="text-center text-xs text-muted-foreground pb-4">
                    Powered by <span className="font-semibold">Client Desk</span>
                </p>
            </div>
        </div>
    );
}
