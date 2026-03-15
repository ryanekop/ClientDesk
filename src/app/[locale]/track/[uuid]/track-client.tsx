"use client";

import * as React from "react";
import { Check, Clock, HardDrive, ExternalLink, Download } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { formatSessionDate } from "@/utils/format-date";

type BookingData = {
    bookingCode: string;
    trackingUuid: string | null;
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
    settlementStatus: string;
    finalAdjustmentsTotal: number;
    finalInvoiceTotal: number;
    remainingFinalPayment: number;
    finalInvoiceSentAt: string | null;
    location: string | null;
    showFinalInvoice: boolean;
};

const DEFAULT_STEPS = [
    { key: "Pending", labelKey: "stepPending" },
    { key: "Booking Confirmed", labelKey: "stepConfirmed" },
    { key: "Sesi Foto / Acara", labelKey: "stepSession" },
    { key: "Antrian Edit", labelKey: "stepEditQueue" },
    { key: "Proses Edit", labelKey: "stepEditing" },
    { key: "Revisi", labelKey: "stepRevision" },
    { key: "File Siap", labelKey: "stepFileReady" },
    { key: "Selesai", labelKey: "stepDone" },
];

interface TrackingClientProps {
    booking: BookingData;
    vendorName: string;
    customStatuses?: string[] | null;
}

export default function TrackingClient({ booking, vendorName, customStatuses }: TrackingClientProps) {
    const t = useTranslations("Track");
    const locale = useLocale();

    // Build steps from custom statuses or fallback to defaults
    const steps = React.useMemo(() => {
        if (!customStatuses || customStatuses.length === 0) return DEFAULT_STEPS;
        return customStatuses.map((key) => {
            const defaultMatch = DEFAULT_STEPS.find(d => d.key === key);
            return {
                key,
                labelKey: defaultMatch?.labelKey,
            };
        });
    }, [customStatuses]);

    const currentIdx = booking.clientStatus ? steps.findIndex(s => s.key === booking.clientStatus) : -1;
    const sessionDate = booking.sessionDate
        ? formatSessionDate(booking.sessionDate)
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
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${currentIdx >= steps.length - 1
                                ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                                }`}>
                                {booking.clientStatus || booking.status || steps[0]?.key || "Pending"}
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
                        {steps.map((step, idx) => {
                            const isCurrent = idx === currentIdx;
                            const isPast = idx < currentIdx;
                            const isDone = idx <= currentIdx;
                            const isFirst = idx === 0;
                            const isLast = idx === steps.length - 1;
                            const topActive = idx <= currentIdx;
                            const bottomActive = idx < currentIdx;
                            const stepLabel = step.labelKey ? t(step.labelKey as never) : step.key;
                            const showQueuePosition = isCurrent && Boolean(booking.queuePosition && booking.queuePosition > 0);

                            return (
                                <div key={step.key} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-2 sm:gap-3">
                                    <div className="relative">
                                        {!isFirst && (
                                            <span
                                                className={`absolute left-1/2 top-0 h-1/2 w-px -translate-x-1/2 ${topActive ? "bg-foreground/70" : "bg-border"}`}
                                            />
                                        )}
                                        {!isLast && (
                                            <span
                                                className={`absolute left-1/2 bottom-0 h-1/2 w-px -translate-x-1/2 ${bottomActive ? "bg-foreground/70" : "bg-border"}`}
                                            />
                                        )}
                                        <span
                                            className={`absolute left-1/2 top-1/2 z-10 flex h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-all ${isCurrent
                                                ? "bg-foreground ring-4 ring-foreground/10"
                                                : isPast
                                                    ? "bg-foreground"
                                                    : "border-2 border-border bg-background"
                                                }`}
                                        >
                                            {isPast && !isCurrent && <Check className="h-2.5 w-2.5 text-background" />}
                                        </span>
                                    </div>

                                    <div className="py-3">
                                        <div className={`rounded-lg px-3 py-2 ${isCurrent ? "border border-foreground/15 bg-muted/40" : "border border-transparent"}`}>
                                            <p className={`text-sm font-semibold leading-5 ${isCurrent ? "text-foreground" : isDone ? "text-foreground/85" : "text-muted-foreground"}`}>
                                                {stepLabel}
                                                {showQueuePosition && (
                                                    <span className="ml-2 text-xs font-medium text-muted-foreground">
                                                        ({t("position")} #{booking.queuePosition})
                                                    </span>
                                                )}
                                            </p>
                                            {isCurrent && (
                                                <p className="mt-1 flex items-center gap-1.5 text-xs text-foreground/75">
                                                    <Clock className="h-3 w-3" /> {t("inProgress")}
                                                </p>
                                            )}
                                            {isPast && (
                                                <p className="mt-1 text-xs text-muted-foreground">✓ {t("completed")}</p>
                                            )}
                                        </div>
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

                {booking.showFinalInvoice && (
                    <div className="bg-background rounded-2xl shadow-lg border p-6">
                        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">{t("finalInvoiceTitle")}</h3>
                        <div className="space-y-2 text-sm border-b pb-3 mb-3">
                            <div className="flex justify-between"><span className="text-muted-foreground">{t("baseTotal")}</span><span className="font-medium">Rp {(booking.totalPrice || 0).toLocaleString("id-ID")}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">{t("adjustments")}</span><span className="font-medium">Rp {(booking.finalAdjustmentsTotal || 0).toLocaleString("id-ID")}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">{t("finalTotal")}</span><span className="font-medium">Rp {(booking.finalInvoiceTotal || 0).toLocaleString("id-ID")}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">{t("remaining")}</span><span className="font-semibold">Rp {(booking.remainingFinalPayment || 0).toLocaleString("id-ID")}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className={`font-semibold ${booking.isFullyPaid ? "text-green-600" : booking.settlementStatus === "submitted" ? "text-blue-600" : "text-amber-600"}`}>{booking.isFullyPaid ? `✅ ${t("paid")}` : booking.settlementStatus === "submitted" ? t("awaitingVerification") : booking.settlementStatus === "draft" ? t("notReady") : `⏳ ${t("unpaid")}`}</span></div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={() => window.open(`/api/public/invoice?code=${encodeURIComponent(booking.bookingCode)}&lang=${locale}&stage=final`, "_blank")}
                                className="flex items-center gap-2 text-sm text-primary hover:underline cursor-pointer"
                            >
                                <Download className="w-4 h-4" />
                                {t("downloadFinalInvoice")}
                            </button>
                            {booking.trackingUuid && (
                                <a
                                    href={`/${locale}/settlement/${booking.trackingUuid}`}
                                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    {t("openSettlementForm")}
                                </a>
                            )}
                        </div>
                        {booking.settlementStatus === "draft" && !booking.isFullyPaid && (
                            <p className="mt-3 text-xs text-muted-foreground">{t("settlementNotOpened")}</p>
                        )}
                    </div>
                )}

                <p className="text-center text-xs text-muted-foreground pb-4">
                    Powered by <span className="font-semibold">Client Desk</span>
                </p>
            </div>
        </div>
    );
}
