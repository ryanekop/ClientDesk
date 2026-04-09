"use client";

import * as React from "react";
import {
    Check,
    CheckCircle2,
    Clock,
    HardDrive,
    ExternalLink,
    Download,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { formatSessionDate } from "@/utils/format-date";
import { resolveFastpikLinkDisplay } from "@/lib/fastpik-link-display";
import { useTenant } from "@/lib/tenant-context";
import { shouldHideTenantBranding } from "@/lib/tenant-branding";

type BookingData = {
    bookingCode: string;
    trackingUuid: string | null;
    clientName: string;
    sessionDate: string | null;
    sessionRows?: Array<{
        key: string;
        label: string | null;
        sessionDate: string;
        location: string | null;
    }>;
    eventType: string | null;
    clientStatus: string | null;
    queueTriggerStatus: string;
    trackingHideQueueNumber: boolean;
    queuePosition: number | null;
    status: string;
    serviceName: string | null;
    invoiceUrlInitial?: string | null;
    invoiceUrlFinal?: string | null;
    fastpikUrl: string | null;
    driveUrl: string | null;
    fastpikLinkDisplayMode: "both" | "prefer_fastpik" | "drive_only";
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
    initialBreakdown: {
        packageTotal: number;
        addonTotal: number;
        accommodationFee: number;
        discountAmount: number;
    } | null;
    fastpikProjectInfo: {
        password: string | null;
        selection_days: number | null;
        download_days: number | null;
        max_photos: number | null;
        source: string | null;
        synced_at: string | null;
    } | null;
    fastpikDataSource: "live" | "fallback";
    fastpikDataSyncedAt: string | null;
    fastpikDataMessage: string | null;
    showFinalInvoice: boolean;
    showFileResults: boolean;
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

type TrackApiResponse =
    | {
          success: true;
          booking: BookingData;
      }
    | {
          success: false;
          error?: string;
      };

export default function TrackingClient({ booking: initialBooking, vendorName, customStatuses }: TrackingClientProps) {
    const t = useTranslations("Track");
    const locale = useLocale();
    const activeLocale = locale || "id";
    const tenant = useTenant();
    const showPoweredBy = !shouldHideTenantBranding({
        id: tenant.id,
        domain: tenant.domain,
    });
    const [bookingState, setBookingState] = React.useState(initialBooking);
    const [passwordCopied, setPasswordCopied] = React.useState(false);
    const booking = bookingState;

    React.useEffect(() => {
        setBookingState(initialBooking);
    }, [initialBooking]);

    React.useEffect(() => {
        const trackingUuid = (initialBooking.trackingUuid || "").trim();
        if (!trackingUuid) return;

        let cancelled = false;

        async function refreshTrackData() {
            try {
                const response = await fetch(
                    `/api/public/track?uuid=${encodeURIComponent(trackingUuid)}&locale=${encodeURIComponent(activeLocale)}`,
                    { cache: "no-store" },
                );
                if (!response.ok) return;
                const payload = (await response.json()) as TrackApiResponse;
                if (!payload.success || cancelled) return;
                setBookingState(payload.booking);
            } catch {
                // Keep server-rendered fallback data when refresh fails.
            }
        }

        void refreshTrackData();

        return () => {
            cancelled = true;
        };
    }, [activeLocale, initialBooking.trackingUuid]);

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
    const effectiveQueueTriggerStatus =
        booking.queueTriggerStatus?.trim() || "Antrian Edit";
    const shouldHideQueueNumber =
        booking.trackingHideQueueNumber &&
        booking.clientStatus === effectiveQueueTriggerStatus;
    const dateLocale = locale === "en" ? "en" : "id";
    const scheduleRows = React.useMemo(() => {
        const rows =
            Array.isArray(booking.sessionRows) && booking.sessionRows.length > 0
                ? booking.sessionRows
                : booking.sessionDate
                  ? [
                        {
                            key: "primary",
                            label: null,
                            sessionDate: booking.sessionDate,
                            location: booking.location,
                        },
                    ]
                  : [];
        return rows.map((row, index) => ({
            key: row.key || `session-${index}`,
            label: row.label,
            value: formatSessionDate(row.sessionDate, { locale: dateLocale }),
        }));
    }, [booking.location, booking.sessionDate, booking.sessionRows, dateLocale]);
    const galleryLinks = resolveFastpikLinkDisplay({
        mode: booking.fastpikLinkDisplayMode,
        fastpikUrl: booking.fastpikUrl,
        driveUrl: booking.driveUrl,
    });
    const hasVisibleFileResults =
        booking.showFileResults &&
        ((galleryLinks.showFastpik && Boolean(galleryLinks.fastpikUrl)) ||
            (galleryLinks.showDrive && Boolean(galleryLinks.driveUrl)));
    const handleCopyFastpikPassword = React.useCallback(() => {
        const password = booking.fastpikProjectInfo?.password || "";
        if (!password) return;
        navigator.clipboard
            .writeText(password)
            .then(() => {
                setPasswordCopied(true);
                window.setTimeout(() => setPasswordCopied(false), 1800);
            })
            .catch(() => {
                setPasswordCopied(false);
            });
    }, [booking.fastpikProjectInfo?.password]);
    const fastpikSyncMetaLabel = React.useMemo(() => {
        const sourceLabel =
            booking.fastpikDataSource === "live"
                ? locale === "en"
                    ? "Live"
                    : "Live"
                : locale === "en"
                  ? "Fallback"
                  : "Fallback";
        const syncedAtValue =
            booking.fastpikDataSyncedAt || booking.fastpikProjectInfo?.synced_at;
        let syncedAtLabel = locale === "en" ? "Not available" : "Belum tersedia";
        if (syncedAtValue) {
            const parsed = new Date(syncedAtValue);
            if (!Number.isNaN(parsed.getTime())) {
                syncedAtLabel = parsed.toLocaleString(
                    locale === "en" ? "en-US" : "id-ID",
                    {
                        dateStyle: "medium",
                        timeStyle: "short",
                    },
                );
            }
        }
        return {
            sourceLabel,
            syncedAtLabel,
        };
    }, [
        booking.fastpikDataSource,
        booking.fastpikDataSyncedAt,
        booking.fastpikProjectInfo?.synced_at,
        locale,
    ]);

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
                            {booking.queuePosition &&
                                booking.queuePosition > 0 &&
                                booking.clientStatus !== "Selesai" &&
                                !shouldHideQueueNumber && (
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
                        <div className="flex items-start justify-between gap-3">
                            <span className="text-muted-foreground">{t("schedule")}</span>
                            {scheduleRows.length === 0 ? (
                                <span className="font-medium">-</span>
                            ) : (
                                <div className="space-y-1 text-right">
                                    {scheduleRows.map((row) => (
                                        <p key={row.key} className="font-medium">
                                            {row.label ? `${row.label}: ` : ""}
                                            {row.value}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {hasVisibleFileResults && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-4 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-full bg-emerald-100 p-1.5 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                                <CheckCircle2 className="h-5 w-5" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                                    {t("fileReadyBannerTitle")}
                                </p>
                                <p className="text-sm text-emerald-800/90 dark:text-emerald-200/90">
                                    {t("fileReadyBannerDescription")}
                                </p>
                                <p className="text-xs font-medium text-emerald-700/90 dark:text-emerald-300/90">
                                    {t("fileReadyBannerHint")}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

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
                            const showQueuePosition =
                                isCurrent &&
                                Boolean(booking.queuePosition && booking.queuePosition > 0) &&
                                !shouldHideQueueNumber;
                            const showInProgress = isCurrent && !isLast;
                            const showCompleted = isPast || (isCurrent && isLast);

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
                                            {showInProgress && (
                                                <p className="mt-1 flex items-center gap-1.5 text-xs text-foreground/75">
                                                    <Clock className="h-3 w-3" /> {t("inProgress")}
                                                </p>
                                            )}
                                            {showCompleted && (
                                                <p className="mt-1 text-xs text-muted-foreground">✓ {t("completed")}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Gallery links follow admin visibility threshold from Status Settings */}
                {(galleryLinks.showFastpik || galleryLinks.showDrive) && booking.showFileResults && (
                    <div className="bg-background rounded-2xl shadow-lg border p-6">
                        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">{t("fileResults")}</h3>
                        <p className="mb-3 text-xs text-muted-foreground">
                            {locale === "en" ? "Fastpik source:" : "Sumber Fastpik:"}{" "}
                            <span className="font-medium text-foreground">{fastpikSyncMetaLabel.sourceLabel}</span>
                            {" · "}
                            {locale === "en" ? "Last sync:" : "Sinkron terakhir:"}{" "}
                            <span className="font-medium text-foreground">{fastpikSyncMetaLabel.syncedAtLabel}</span>
                        </p>
                        {booking.fastpikDataSource === "fallback" && booking.fastpikDataMessage ? (
                            <p className="mb-3 text-[11px] text-amber-700 dark:text-amber-300">
                                {booking.fastpikDataMessage}
                            </p>
                        ) : null}
                        <div className="space-y-2">
                            {galleryLinks.showFastpik && galleryLinks.fastpikUrl && (
                                <a
                                    href={galleryLinks.fastpikUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                                >
                                    <HardDrive className="w-4 h-4" />
                                    {t("openFastpik")}
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                            )}
                            {galleryLinks.showDrive && galleryLinks.driveUrl && (
                                <a
                                    href={galleryLinks.driveUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                                >
                                    <HardDrive className="w-4 h-4" />
                                    {t("openGoogleDrive")}
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                            )}
                        </div>
                        {booking.fastpikProjectInfo && (
                            <div className="mt-4 rounded-lg border bg-muted/20 p-3 space-y-2 text-sm">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    {t("fastpikProjectInfo")}
                                </p>
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">{t("fastpikPassword")}</span>
                                    <span className="font-medium flex items-center gap-2">
                                        {booking.fastpikProjectInfo.password || t("notAvailable")}
                                        {booking.fastpikProjectInfo.password ? (
                                            <button
                                                type="button"
                                                onClick={handleCopyFastpikPassword}
                                                className="rounded border px-2 py-0.5 text-[11px] text-primary hover:bg-muted/70 transition-colors"
                                            >
                                                {passwordCopied ? t("copied") : t("copy")}
                                            </button>
                                        ) : null}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">{t("selectionDuration")}</span>
                                    <span className="font-medium">
                                        {booking.fastpikProjectInfo.selection_days !== null
                                            ? t("days", { count: booking.fastpikProjectInfo.selection_days })
                                            : t("foreverDuration")}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">{t("downloadDuration")}</span>
                                    <span className="font-medium">
                                        {booking.fastpikProjectInfo.download_days !== null
                                            ? t("days", { count: booking.fastpikProjectInfo.download_days })
                                            : t("foreverDuration")}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">{t("maxPhotos")}</span>
                                    <span className="font-medium">
                                        {booking.fastpikProjectInfo.max_photos !== null
                                            ? t("photosCount", { count: booking.fastpikProjectInfo.max_photos })
                                            : t("notAvailable")}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Invoice Download */}
                <div className="bg-background rounded-2xl shadow-lg border p-6">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">{t("invoiceTitle")}</h3>
                    <div className="space-y-2 text-sm border-b pb-3 mb-3">
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("code").replace(":", "")}</span><span className="font-medium">{booking.bookingCode}</span></div>
                        {booking.initialBreakdown ? (
                            <>
                                <div className="flex justify-between"><span className="text-muted-foreground">{t("initialPackage")}</span><span className="font-medium">Rp {(booking.initialBreakdown.packageTotal || 0).toLocaleString("id-ID")}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">{t("initialAddon")}</span><span className="font-medium">Rp {(booking.initialBreakdown.addonTotal || 0).toLocaleString("id-ID")}</span></div>
                                {(booking.initialBreakdown.accommodationFee || 0) > 0 ? (
                                    <div className="flex justify-between"><span className="text-muted-foreground">{t("accommodationFee")}</span><span className="font-medium">Rp {(booking.initialBreakdown.accommodationFee || 0).toLocaleString("id-ID")}</span></div>
                                ) : null}
                                {(booking.initialBreakdown.discountAmount || 0) > 0 ? (
                                    <div className="flex justify-between"><span className="text-muted-foreground">{t("specialDiscount")}</span><span className="font-medium">- Rp {(booking.initialBreakdown.discountAmount || 0).toLocaleString("id-ID")}</span></div>
                                ) : null}
                            </>
                        ) : null}
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("total")}</span><span className="font-medium">Rp {(booking.totalPrice || 0).toLocaleString("id-ID")}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("dpPaid")}</span><span className="font-medium">Rp {(booking.dpPaid || 0).toLocaleString("id-ID")}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">{t("remaining")}</span><span className="font-semibold">Rp {((booking.totalPrice || 0) - (booking.dpPaid || 0)).toLocaleString("id-ID")}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className={`font-semibold ${booking.isFullyPaid ? "text-green-600" : "text-amber-600"}`}>{booking.isFullyPaid ? `✅ ${t("paid")}` : `⏳ ${t("unpaid")}`}</span></div>
                    </div>
                    <button
                        onClick={() =>
                            window.open(
                                booking.invoiceUrlInitial ||
                                    `/api/public/invoice?code=${encodeURIComponent(booking.bookingCode)}`,
                                "_blank",
                            )
                        }
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
                            {booking.initialBreakdown ? (
                                <>
                                    <div className="flex justify-between"><span className="text-muted-foreground">{t("initialPackage")}</span><span className="font-medium">Rp {(booking.initialBreakdown.packageTotal || 0).toLocaleString("id-ID")}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">{t("initialAddon")}</span><span className="font-medium">Rp {(booking.initialBreakdown.addonTotal || 0).toLocaleString("id-ID")}</span></div>
                                    {(booking.initialBreakdown.accommodationFee || 0) > 0 ? (
                                        <div className="flex justify-between"><span className="text-muted-foreground">{t("accommodationFee")}</span><span className="font-medium">Rp {(booking.initialBreakdown.accommodationFee || 0).toLocaleString("id-ID")}</span></div>
                                    ) : null}
                                    {(booking.initialBreakdown.discountAmount || 0) > 0 ? (
                                        <div className="flex justify-between"><span className="text-muted-foreground">{t("specialDiscount")}</span><span className="font-medium">- Rp {(booking.initialBreakdown.discountAmount || 0).toLocaleString("id-ID")}</span></div>
                                    ) : null}
                                </>
                            ) : null}
                            <div className="flex justify-between"><span className="text-muted-foreground">{t("baseTotal")}</span><span className="font-medium">Rp {(booking.totalPrice || 0).toLocaleString("id-ID")}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">{t("adjustments")}</span><span className="font-medium">Rp {(booking.finalAdjustmentsTotal || 0).toLocaleString("id-ID")}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">{t("finalTotal")}</span><span className="font-medium">Rp {(booking.finalInvoiceTotal || 0).toLocaleString("id-ID")}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">{t("remaining")}</span><span className="font-semibold">Rp {(booking.remainingFinalPayment || 0).toLocaleString("id-ID")}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className={`font-semibold ${booking.isFullyPaid ? "text-green-600" : booking.settlementStatus === "submitted" ? "text-blue-600" : "text-amber-600"}`}>{booking.isFullyPaid ? `✅ ${t("paid")}` : booking.settlementStatus === "submitted" ? t("awaitingVerification") : `⏳ ${t("unpaid")}`}</span></div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={() =>
                                    window.open(
                                        booking.invoiceUrlFinal ||
                                            `/api/public/invoice?code=${encodeURIComponent(booking.bookingCode)}&lang=${locale}&stage=final`,
                                        "_blank",
                                    )
                                }
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
                    </div>
                )}

                {showPoweredBy && (
                    <p className="text-center text-xs text-muted-foreground pb-4">
                        Powered by <span className="font-semibold">Client Desk</span>
                    </p>
                )}
            </div>
        </div>
    );
}
