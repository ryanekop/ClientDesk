"use client";

import * as React from "react";
import { CheckCircle2, Clock, PlayCircle, HardDrive, Edit3, Camera, Loader2, ExternalLink, Users, Download } from "lucide-react";
import { useTranslations } from "next-intl";

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
    totalPrice: number;
    dpPaid: number;
    isFullyPaid: boolean;
    location: string | null;
};

const STATUS_STEPS_KEYS = [
    { key: "Booking Confirmed", labelKey: "stepConfirmed", icon: CheckCircle2 },
    { key: "Sesi Foto / Acara", labelKey: "stepSession", icon: Camera },
    { key: "Antrian Edit", labelKey: "stepEditQueue", icon: Users },
    { key: "Proses Edit", labelKey: "stepEditing", icon: Edit3 },
    { key: "Revisi", labelKey: "stepRevision", icon: Edit3 },
    { key: "File Siap", labelKey: "stepFileReady", icon: HardDrive },
    { key: "Selesai", labelKey: "stepDone", icon: CheckCircle2 },
];

function getStepIndex(status: string | null): number {
    if (!status) return -1;
    return STATUS_STEPS_KEYS.findIndex(s => s.key === status);
}

interface TrackingClientProps {
    booking: BookingData;
    vendorName: string;
}

export default function TrackingClient({ booking, vendorName }: TrackingClientProps) {
    const t = useTranslations("Track");

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
                    <p className="text-muted-foreground text-sm">{t("trackingTitle")} - {booking.clientName}</p>
                </div>

                {/* Booking Info Card */}
                <div className="bg-background rounded-2xl shadow-lg border p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
                        <div>
                            <h2 className="text-lg font-bold">{t("bookingDetail")}</h2>
                            <p className="text-muted-foreground text-sm">{t("code")} <span className="font-semibold text-primary">{booking.bookingCode}</span></p>
                        </div>
                        <div className="flex items-center gap-2">
                            {booking.queuePosition && booking.queuePosition > 0 && booking.clientStatus !== "Selesai" && (
                                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                                    {t("queue")} #{booking.queuePosition}
                                </span>
                            )}
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${currentIdx >= STATUS_STEPS_KEYS.length - 1
                                ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                                }`}>
                                {booking.clientStatus || booking.status || "Pending"}
                            </span>
                        </div>
                    </div>

                    <div className="grid gap-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("name")}</span>
                            <span className="font-medium">{booking.clientName}</span>
                        </div>
                        {booking.serviceName && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">{t("package")}</span>
                                <span className="font-medium">{booking.serviceName}</span>
                            </div>
                        )}
                        {booking.eventType && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">{t("eventType")}</span>
                                <span className="font-medium">{booking.eventType}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("schedule")}</span>
                            <span className="font-medium">{sessionDate}</span>
                        </div>
                    </div>
                </div>

                {/* Timeline */}
                <div className="bg-background rounded-2xl shadow-lg border p-6">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-6">{t("progress")}</h3>
                    <div className="space-y-0">
                        {STATUS_STEPS_KEYS.map((step, idx) => {
                            const isDone = idx <= currentIdx;
                            const isCurrent = idx === currentIdx;
                            const isLast = idx === STATUS_STEPS_KEYS.length - 1;
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
                                            {t(step.labelKey as any)}
                                            {isCurrent && booking.queuePosition && booking.queuePosition > 0 && step.key === "Antrian Edit" && (
                                                <span className="text-xs font-normal text-muted-foreground ml-2">({t("position")} #{booking.queuePosition})</span>
                                            )}
                                        </p>
                                        {isCurrent && (
                                            <p className="text-xs text-primary mt-0.5 flex items-center gap-1">
                                                <Clock className="w-3 h-3" /> {t("inProgress")}
                                            </p>
                                        )}
                                        {isDone && !isCurrent && (
                                            <p className="text-xs text-muted-foreground mt-0.5">✓ {t("completed")}</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Drive Link - only show if status >= Sesi Foto */}
                {booking.driveUrl && currentIdx >= 1 && (
                    <div className="bg-background rounded-2xl shadow-lg border p-6">
                        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">{t("fileResults")}</h3>
                        <a
                            href={booking.driveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                            <HardDrive className="w-4 h-4" />
                            {t("openGoogleDrive")}
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    </div>
                )}

                {/* Invoice Download */}
                <div className="bg-background rounded-2xl shadow-lg border p-6">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">{t("invoiceTitle")}</h3>
                    <div className="space-y-2 text-sm border-b pb-3 mb-3">
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("code").replace(":", "")}</span><span className="font-medium">{booking.bookingCode}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("total")}</span><span className="font-medium">Rp {(booking.totalPrice || 0).toLocaleString("id-ID")}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("dpPaid")}</span><span className="font-medium">Rp {(booking.dpPaid || 0).toLocaleString("id-ID")}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("remaining")}</span><span className="font-semibold">Rp {((booking.totalPrice || 0) - (booking.dpPaid || 0)).toLocaleString("id-ID")}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className={`font-semibold ${booking.isFullyPaid ? "text-green-600" : "text-amber-600"}`}>{booking.isFullyPaid ? `✅ ${t("paid")}` : `⏳ ${t("unpaid")}`}</span></div>
                    </div>
                    <button
                        onClick={() => window.open(`/api/public/invoice?code=${encodeURIComponent(booking.bookingCode)}`, "_blank")}
                        className="flex items-center gap-2 text-sm text-primary hover:underline cursor-pointer"
                    >
                        <Download className="w-4 h-4" />
                        {t("downloadInvoice")}
                    </button>
                </div>

                <p className="text-center text-xs text-muted-foreground pb-4">
                    Powered by <span className="font-semibold">Client Desk</span>
                </p>
            </div>
        </div>
    );
}
