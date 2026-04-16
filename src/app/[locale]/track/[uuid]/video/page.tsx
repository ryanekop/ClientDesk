import { ExternalLink, Video } from "lucide-react";
import { getTranslations } from "next-intl/server";
import {
  resolveUnifiedBookingStatus,
  shouldShowTrackingVideoLinksForClientStatus,
} from "@/lib/client-status";
import { getTrackBasePayloadCached } from "@/lib/public-track-data";

interface PageProps {
  params: Promise<{ locale: string; uuid: string }>;
}

export default async function TrackVideoPage({ params }: PageProps) {
  const { locale, uuid } = await params;
  const t = await getTranslations("Track");
  const result = await getTrackBasePayloadCached(uuid, locale);

  const booking = result?.booking || null;
  const effectiveClientStatus = booking
    ? resolveUnifiedBookingStatus({
        status: booking.status,
        clientStatus: booking.client_status,
        statuses: result?.customClientStatuses,
      })
    : null;
  const videoUrl = booking?.video_drive_folder_url?.trim() || "";
  const canShowVideo =
    Boolean(videoUrl) &&
    shouldShowTrackingVideoLinksForClientStatus({
      statuses: result?.customClientStatuses,
      currentStatus: effectiveClientStatus,
      visibleFromStatus: result?.trackingVideoLinksVisibleFromStatus,
    });

  if (!booking || !canShowVideo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-10 dark:from-slate-950 dark:to-slate-900">
        <div className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center">
          <div className="w-full rounded-2xl border bg-background p-6 text-center shadow-lg">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Video className="h-6 w-6 text-muted-foreground" />
            </div>
            <h1 className="text-xl font-bold">{t("videoUnavailableTitle")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("videoUnavailableDescription")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-10 dark:from-slate-950 dark:to-slate-900">
      <div className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center">
        <div className="w-full rounded-2xl border bg-background p-6 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Video className="h-6 w-6" />
          </div>
          <p className="text-sm text-muted-foreground">
            {result?.vendorName || "ClientDesk"}
          </p>
          <h1 className="mt-1 text-2xl font-bold">{t("videoGatewayTitle")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("videoGatewayDescription", { name: booking.client_name })}
          </p>
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
          >
            {t("openVideoResult")}
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
