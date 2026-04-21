"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Edit2, MessageSquare, Phone, Folder, FolderPlus, Loader2, MapPin, Instagram, Navigation, Link2, Copy, ClipboardCheck, ListOrdered, ExternalLink, Upload, FileText, Trash2, AlertCircle, Image as ImageIcon, RefreshCcw, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/public/file-dropzone";
import { ActionFeedbackDialog } from "@/components/ui/action-feedback-dialog";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { adminNativeSelectClass } from "@/components/ui/admin-native-form-controls";
import { useSuccessToast } from "@/components/ui/success-toast";
import { CancelStatusPaymentDialog } from "@/components/cancel-status-payment-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { Link } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import {
    BookingWriteReadonlyBanner,
    useBookingWriteAccess,
    useBookingWriteGuard,
} from "@/lib/booking-write-access-context";
import { formatSessionDate, formatTemplateSessionDate } from "@/utils/format-date";
import {
    extractBuiltInExtraFieldValues,
    extractCustomFieldSnapshots,
    type CustomFieldSnapshot,
} from "@/components/form-builder/booking-form-layout";
import { buildDriveImageUrl, type PaymentSource } from "@/lib/payment-config";
import {
    buildAutoDpVerificationPatch,
    getFinalAdjustmentsTotal,
    getFinalInvoiceTotal,
    getInvoiceStage,
    getNetVerifiedRevenueAmount,
    getRemainingFinalPayment,
    getVerifiedDpAmount,
    getDpRefundAmount,
    isBookingFullyPaid,
    getSettlementLabel,
    getSettlementStatus,
    normalizeFinalAdjustments,
    type FinalAdjustment,
    type SettlementStatus,
} from "@/lib/final-settlement";
import {
    getNetRevenueAfterOperationalCosts,
    getOperationalCostsTotal,
    normalizeOperationalCosts,
} from "@/lib/operational-costs";
import {
    fillWhatsAppTemplate,
    getWhatsAppTemplateContent,
    normalizeWhatsAppNumber,
    resolveWhatsAppTemplateMode,
} from "@/lib/whatsapp-template";
import {
    getBookingServiceLabel,
    normalizeBookingServiceSelections,
    type BookingServiceSelection,
} from "@/lib/booking-services";
import {
    buildBookingSessionDisplay,
    splitBookingSessionDisplayLines,
} from "@/lib/booking-session-display";
import { buildBookingWhatsAppTemplateVars } from "@/lib/booking-whatsapp-template-vars";
import { buildDriveFolderPathSegments } from "@/lib/drive-folder-structure";
import {
    DEFAULT_CLIENT_STATUSES,
    getBookingStatusOptions,
    resolveUnifiedBookingStatus,
} from "@/lib/client-status";
import {
    normalizeFastpikLinkDisplayMode,
    resolveFastpikLinkDisplay,
    type FastpikLinkDisplayMode,
} from "@/lib/fastpik-link-display";
import { resolveFastpikProjectInfoFromExtraFields } from "@/lib/fastpik-project-info";
import {
    clearConnectedGoogleAccountCache,
    fetchConnectedGoogleAccountStatus,
} from "@/utils/google/connected-account-client";
import {
    buildGoogleMapsDirectionUrl,
    buildGoogleMapsQueryUrl,
} from "@/utils/location";
import {
    buildWhatsAppUrl,
    closePreopenedWindow,
    openWhatsAppUrl,
    preopenWindowForDeferredNavigation,
} from "@/utils/whatsapp-link";
import {
    isTransitionToCancelled,
    syncGoogleCalendarForStatusTransition,
} from "@/utils/google-calendar-status-sync";
import { buildCancelPaymentPatch, type CancelPaymentPolicy } from "@/lib/cancel-payment";
import {
    formatProjectDeadlineDate,
    getProjectDeadlineCountdownLabel,
    getProjectDeadlineTone,
    normalizeClientStatusDeadlineDefaultDays,
    normalizeClientStatusDeadlineTriggerStatus,
    normalizeProjectDeadlineDate,
} from "@/lib/booking-deadline";
import {
    isShowAllPackagesEventType,
    normalizeEventTypeName,
} from "@/lib/event-type-config";
import { MAX_GOOGLE_UPLOAD_BYTES } from "@/lib/security/public-upload";
import { normalizeSafeExternalUrl } from "@/utils/safe-link";
import { updateBookingStatusWithQueueTransition } from "@/lib/booking-status-queue";
import {
    buildEditableSpecialOfferSnapshot,
    computeSpecialOfferTotal,
    getInitialBookingPriceBreakdown,
    mergeSpecialOfferSnapshotIntoExtraFields,
    resolveSpecialOfferSnapshotFromExtraFields,
} from "@/lib/booking-special-offer";
import {
    UNIVERSITY_ABBREVIATION_DRAFT_EXTRA_KEY,
    UNIVERSITY_REFERENCE_EXTRA_KEY,
} from "@/lib/university-references";
import { FREELANCER_ASSIGNMENTS_EXTRA_FIELD_KEY } from "@/lib/freelancer-session-assignments";
import { isArchivedBooking } from "@/lib/booking-archive";

const EXTRA_FIELD_LABEL_KEYS: Record<string, string> = {
    universitas: "extraFieldLabels.university",
    fakultas: "extraFieldLabels.faculty",
    nama_pasangan: "extraFieldLabels.partnerName",
    instagram_pasangan: "extraFieldLabels.partnerInstagram",
    tempat_akad: "extraFieldLabels.akadVenue",
    tempat_resepsi: "extraFieldLabels.receptionVenue",
    tempat_wisuda_1: "extraFieldLabels.wisudaSession1Venue",
    tempat_wisuda_2: "extraFieldLabels.wisudaSession2Venue",
    tanggal_akad: "extraFieldLabels.akadDate",
    tanggal_resepsi: "extraFieldLabels.receptionDate",
    tanggal_wisuda_1: "extraFieldLabels.wisudaSession1Date",
    tanggal_wisuda_2: "extraFieldLabels.wisudaSession2Date",
    usia_kehamilan: "extraFieldLabels.pregnancyAge",
    gender_bayi: "extraFieldLabels.babyGender",
    nama_bayi: "extraFieldLabels.babyName",
    tanggal_lahir: "extraFieldLabels.dateOfBirth",
    nama_brand: "extraFieldLabels.brandName",
    tipe_konten: "extraFieldLabels.contentType",
    jumlah_anggota: "extraFieldLabels.memberCount",
    jumlah_tamu: "extraFieldLabels.estimatedGuests",
};

const LOCATION_FIELDS = new Set([
    "tempat_akad",
    "tempat_resepsi",
    "tempat_wisuda_1",
    "tempat_wisuda_2",
]);
const HIDDEN_EXTRA_FIELD_KEYS = new Set([
    "terms_accepted",
    "terms_accepted_at",
    "addon_ids",
    "addon_names",
    "fastpik_project",
    "special_offer",
    "wisuda_session_duration_minutes",
    FREELANCER_ASSIGNMENTS_EXTRA_FIELD_KEY,
    UNIVERSITY_ABBREVIATION_DRAFT_EXTRA_KEY,
    UNIVERSITY_REFERENCE_EXTRA_KEY,
]);
const FASTPIK_APP_BASE_URL = (process.env.NEXT_PUBLIC_FASTPIK_BASE_URL || "https://fastpik.ryanekoapp.web.id").replace(/\/+$/, "");

function getBookingDetailSelect(canViewOperationalCosts: boolean) {
    return [
        "id, booking_code, client_name, client_whatsapp, session_date, status, total_price, dp_paid, dp_verified_amount, dp_verified_at, dp_refund_amount, dp_refunded_at, is_fully_paid, drive_folder_url, video_drive_folder_url, fastpik_project_id, fastpik_project_link, fastpik_project_edit_link, fastpik_sync_status, fastpik_last_synced_at, portfolio_url, payment_proof_url, payment_proof_drive_file_id, payment_method, payment_source",
        canViewOperationalCosts ? "operational_costs" : "",
        "settlement_status, final_adjustments, final_payment_proof_url, final_payment_proof_drive_file_id, final_payment_amount, final_payment_method, final_payment_source, final_paid_at, final_invoice_sent_at, location, location_lat, location_lng, location_detail, instagram, event_type, notes, admin_notes, extra_fields, tracking_uuid, archived_at, archived_by, client_status, queue_position, project_deadline_date, services(id, name, price, duration_minutes, is_addon, affects_schedule), booking_services(id, kind, sort_order, quantity, service:services(id, name, price, duration_minutes, is_addon, affects_schedule)), freelance(id, name, whatsapp_number), booking_freelance(freelance_id, freelance(id, name, whatsapp_number))",
    ]
        .filter(Boolean)
        .join(", ");
}

type FreelancerDetail = { id: string; name: string; whatsapp_number: string | null };
type BookingRow = Booking & {
    payment_proof_url: string | null;
    freelance: FreelancerDetail | null;
    booking_freelance?: Array<{ freelance: FreelancerDetail | null }>;
    booking_services?: unknown[];
};

type Booking = {
    id: string;
    booking_code: string;
    client_name: string;
    client_whatsapp: string | null;
    session_date: string | null;
    status: string;
    total_price: number;
    dp_paid: number;
    dp_verified_amount: number;
    dp_verified_at: string | null;
    dp_refund_amount: number;
    dp_refunded_at: string | null;
    is_fully_paid: boolean;
    payment_proof_url: string | null;
    payment_proof_drive_file_id: string | null;
    drive_folder_url: string | null;
    video_drive_folder_url: string | null;
    fastpik_project_id: string | null;
    fastpik_project_link: string | null;
    fastpik_project_edit_link: string | null;
    fastpik_sync_status: string | null;
    fastpik_last_synced_at: string | null;
    portfolio_url: string | null;
    location: string | null;
    location_lat: number | null;
    location_lng: number | null;
    location_detail: string | null;
    instagram: string | null;
    event_type: string | null;
    notes: string | null;
    admin_notes: string | null;
    extra_fields: Record<string, unknown> | null;
    payment_method: string | null;
    payment_source: PaymentSource | null;
    operational_costs: unknown;
    settlement_status: string | null;
    final_adjustments: unknown;
    final_payment_proof_url: string | null;
    final_payment_proof_drive_file_id: string | null;
    final_payment_amount: number;
    final_payment_method: string | null;
    final_payment_source: PaymentSource | null;
    final_paid_at: string | null;
    final_invoice_sent_at: string | null;
    services: {
        id: string;
        name: string;
        price: number;
        duration_minutes?: number | null;
        is_addon?: boolean | null;
        affects_schedule?: boolean | null;
    } | null;
    freelancers: FreelancerDetail | null; // old single FK
    booking_freelancers: FreelancerDetail[]; // new junction
    tracking_uuid: string | null;
    archived_at?: string | null;
    archived_by?: string | null;
    client_status: string | null;
    queue_position: number | null;
    project_deadline_date: string | null;
    service_selections?: BookingServiceSelection[];
    service_label?: string;
};

type AddonService = {
    id: string;
    name: string;
    price: number;
    description: string | null;
    event_types: string[] | null;
};

type BookingProofStage = "initial" | "final";

type BookingDetailTabKey =
    | "informasi"
    | "keuangan"
    | "hasil-jadi"
    | "status-klien";

type DrivePathProfile = {
    studio_name?: string | null;
    drive_folder_format?: string | null;
    drive_folder_format_map?: Record<string, string> | null;
    drive_folder_structure_map?: Record<string, string[] | string> | null;
};

type BookingProfileRow = {
    role?: string | null;
    custom_client_statuses?: string[] | null;
    dp_verify_trigger_status?: string | null;
    queue_trigger_status?: string | null;
    client_status_deadline_trigger_status?: string | null;
    client_status_deadline_default_days?: number | null;
    form_show_proof?: boolean | null;
    google_drive_access_token?: string | null;
    google_drive_refresh_token?: string | null;
    fastpik_link_display_mode?: FastpikLinkDisplayMode | null;
    fastpik_link_display_mode_booking_detail?: FastpikLinkDisplayMode | null;
};

type EditableAdjustment = {
    id: string;
    service_id: string | null;
    source: "service_addon" | "manual";
    label: string;
    unit_price: string;
    quantity: string;
    amount: string;
    reason: string;
    created_at: string;
};

const RESPONSIVE_SECTION_HEADER_CLASS =
    "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between";
const RESPONSIVE_SECTION_ACTIONS_CLASS =
    "grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap";
const RESPONSIVE_ACTION_GROUP_CLASS =
    "grid grid-cols-1 gap-2 sm:flex sm:flex-wrap";
const RESPONSIVE_ACTION_BUTTON_CLASS =
    "w-full justify-center sm:w-auto";
const RESPONSIVE_ACTION_LINK_CLASS = "w-full sm:w-auto";
const RESPONSIVE_INLINE_ACTION_CLASS =
    "flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center";
const RESPONSIVE_MONEY_INPUT_CLASS =
    "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] sm:w-40";

function getAdminDeadlineBadgeClassName(deadlineDate: string | null | undefined) {
    const tone = getProjectDeadlineTone(deadlineDate);
    if (tone === "overdue" || tone === "today") {
        return "inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300";
    }
    if (tone === "soon") {
        return "inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300";
    }
    if (tone === "safe") {
        return "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300";
    }
    return "inline-flex rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground";
}

function StatusBadge({ status }: { status: string }) {
    const variants: Record<string, string> = {
        pending: "bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400",
        dp: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
        terjadwal: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
        selesai: "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400",
        batal: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
    };
    const cls = variants[status.toLowerCase()] || "bg-muted text-muted-foreground";
    return <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cls}`}>{status}</span>;
}

function SettlementBadge({ status }: { status: SettlementStatus }) {
    const variants: Record<SettlementStatus, string> = {
        draft: "bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400",
        sent: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
        submitted: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
        paid: "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400",
    };
    return <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${variants[status]}`}>{getSettlementLabel(status)}</span>;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-start sm:gap-3">
            <div className="text-muted-foreground sm:w-40 sm:shrink-0">{label}</div>
            <div className="min-w-0 flex-1 break-words">{value}</div>
        </div>
    );
}

function renderSessionDisplayValue(value: string) {
    return (
        <div className="space-y-1">
            {splitBookingSessionDisplayLines(value).map((line, index) => (
                <div key={`${line}-${index}`} className="whitespace-nowrap">
                    {line}
                </div>
            ))}
        </div>
    );
}

function formatPaymentMethod(method: string | null) {
    if (method === "bank") return "Transfer Bank";
    if (method === "qris") return "QRIS";
    if (method === "cash") return "Cash";
    return "-";
}

function formatPaymentSource(source: PaymentSource | null) {
    if (!source) return "-";
    if (source.type === "bank") {
        const accountSuffix = source.account_number ? ` • ${source.account_number}` : "";
        return `${source.bank_name}${accountSuffix}`;
    }
    return source.label;
}

function groupCustomSnapshotsBySection(snapshots: CustomFieldSnapshot[]) {
    return snapshots.reduce<Record<string, CustomFieldSnapshot[]>>((acc, item) => {
        const key = item.sectionId;
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {});
}

function LocationValue({
    address,
    lat,
    lng,
}: {
    address: string;
    lat?: number | null;
    lng?: number | null;
}) {
    const mapsUrl = buildGoogleMapsQueryUrl({ address, lat, lng });
    const dirUrl = buildGoogleMapsDirectionUrl({ address, lat, lng });
    return (
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0 break-words">{address}</div>
            <div className="flex gap-1 sm:mt-0.5 sm:shrink-0">
                {mapsUrl && (
                    <button type="button" onClick={() => window.open(mapsUrl, "_blank")} title="Buka di Google Maps"
                        className="text-blue-600 hover:text-blue-700 transition-colors inline-flex items-center justify-center w-6 h-6 rounded hover:bg-blue-50 dark:hover:bg-blue-500/10">
                        <MapPin className="w-3.5 h-3.5" />
                    </button>
                )}
                {dirUrl && (
                    <button type="button" onClick={() => window.open(dirUrl, "_blank")} title="Direction"
                        className="text-green-600 hover:text-green-700 transition-colors inline-flex items-center justify-center w-6 h-6 rounded hover:bg-green-50 dark:hover:bg-green-500/10">
                        <Navigation className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
}

function PaymentProofPanel({
    url,
    driveFileId,
    alt,
    linkLabel,
}: {
    url: string;
    driveFileId: string | null;
    alt: string;
    linkLabel: string;
}) {
    const safeUrl = React.useMemo(() => normalizeSafeExternalUrl(url), [url]);
    const previewSrc = driveFileId ? buildDriveImageUrl(driveFileId) : safeUrl || undefined;
    const [previewFailed, setPreviewFailed] = React.useState(false);

    React.useEffect(() => {
        setPreviewFailed(false);
    }, [previewSrc]);

    if (!previewFailed && safeUrl) {
        return (
            <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={previewSrc}
                    alt={alt}
                    onError={() => setPreviewFailed(true)}
                    className="max-w-sm w-full rounded-lg border bg-muted/20 shadow-sm"
                />
            </a>
        );
    }

    if (safeUrl) {
        return (
            <a
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/40"
            >
                <div className="min-w-0">
                    <p className="text-sm font-medium">{linkLabel}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{safeUrl}</p>
                </div>
                <ExternalLink className="w-4 h-4 shrink-0 text-muted-foreground" />
            </a>
        );
    }

    return (
        <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3">
            <div className="min-w-0">
                <p className="text-sm font-medium">{linkLabel}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">URL bukti tidak valid.</p>
            </div>
        </div>
    );
}

function PaymentProofManager({
    title,
    url,
    driveFileId,
    alt,
    linkLabel,
    emptyLabel,
    helperText,
    uploadLabel,
    uploading,
    deleting,
    canUpload,
    canDelete,
    deleteLabel,
    onUpload,
    onDelete,
    onError,
}: {
    title: string;
    url: string | null;
    driveFileId: string | null;
    alt: string;
    linkLabel: string;
    emptyLabel: string;
    helperText?: string;
    uploadLabel: string;
    uploading: boolean;
    deleting?: boolean;
    canUpload: boolean;
    canDelete?: boolean;
    deleteLabel?: string;
    onUpload: (file: File) => Promise<boolean>;
    onDelete?: () => void;
    onError: (message: string) => void;
}) {
    const tBookingDetail = useTranslations("BookingDetail");
    const [file, setFile] = React.useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
    const [resetKey, setResetKey] = React.useState(0);

    React.useEffect(() => () => {
        if (previewUrl?.startsWith("blob:")) {
            URL.revokeObjectURL(previewUrl);
        }
    }, [previewUrl]);

    function handleFileSelect(nextFile: File | null) {
        if (previewUrl?.startsWith("blob:")) {
            URL.revokeObjectURL(previewUrl);
        }

        setFile(nextFile);

        if (!nextFile) {
            setPreviewUrl(null);
            return;
        }

        if (nextFile.size > MAX_GOOGLE_UPLOAD_BYTES) {
            setFile(null);
            setPreviewUrl(null);
            setResetKey((current) => current + 1);
            onError(tBookingDetail("maxFileSize5mb"));
            return;
        }

        if (nextFile.type.startsWith("image/")) {
            setPreviewUrl(URL.createObjectURL(nextFile));
            return;
        }

        setPreviewUrl(null);
    }

    async function handleUpload() {
        if (!file || uploading) return;
        const success = await onUpload(file);
        if (!success) return;

        if (previewUrl?.startsWith("blob:")) {
            URL.revokeObjectURL(previewUrl);
        }

        setFile(null);
        setPreviewUrl(null);
        setResetKey((current) => current + 1);
    }

    return (
        <div className="rounded-xl border bg-card p-4 space-y-4 sm:p-6">
            <div className="space-y-3">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4" /> {title}
                </h3>
                {url ? (
                    <PaymentProofPanel
                        url={url}
                        driveFileId={driveFileId}
                        alt={alt}
                        linkLabel={linkLabel}
                    />
                ) : (
                    <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
                        {emptyLabel}
                    </div>
                )}
            </div>

            {canUpload ? (
                <div className="space-y-3 border-t pt-4">
                    <FileDropzone
                        key={resetKey}
                        file={file}
                        previewUrl={previewUrl}
                        accept="image/*,.pdf"
                        label={uploadLabel}
                        helperText={helperText}
                        emptyText={tBookingDetail("paymentProofUploadPrompt")}
                        emptySubtext={tBookingDetail("paymentProofUploadHint")}
                        removeLabel={tBookingDetail("removeFile")}
                        onFileSelect={handleFileSelect}
                    />
                    <div className="flex justify-end">
                        <Button
                            type="button"
                            onClick={handleUpload}
                            disabled={!file || uploading}
                            className="gap-2"
                        >
                            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            {uploading ? tBookingDetail("uploading") : uploadLabel}
                        </Button>
                    </div>
                </div>
            ) : null}

            {canDelete && onDelete ? (
                <div className="flex justify-end border-t pt-4">
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="gap-1.5"
                        onClick={onDelete}
                        disabled={deleting}
                    >
                        {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        {deleteLabel || tBookingDetail("deleteProof")}
                    </Button>
                </div>
            ) : null}
        </div>
    );
}

function toEditableAdjustments(items: FinalAdjustment[]): EditableAdjustment[] {
    return items.map((item) => ({
        id: item.id,
        service_id: item.service_id || null,
        source: item.source || "manual",
        label: item.label,
        unit_price: String(item.unit_price || item.amount || 0),
        quantity: String(item.quantity || 1),
        amount: String(item.amount),
        reason: item.reason,
        created_at: item.created_at,
    }));
}

function normalizeEditableAdjustments(items: EditableAdjustment[]): FinalAdjustment[] {
    return items
        .map((item) => ({
            id: item.id || crypto.randomUUID(),
            service_id: item.service_id,
            source: item.source,
            label: item.label.trim(),
            unit_price: Number(item.unit_price) || 0,
            quantity: Math.max(Number(item.quantity) || 1, 1),
            amount: (Number(item.unit_price) || 0) * Math.max(Number(item.quantity) || 1, 1),
            reason: item.reason.trim(),
            created_at: item.created_at || new Date().toISOString(),
        }))
        .filter((item) => item.label && item.amount > 0);
}

function isAddonAvailableForEvent(service: AddonService, eventType: string | null) {
    if (!service.event_types || service.event_types.length === 0) return true;
    if (!eventType) return true;
    if (isShowAllPackagesEventType(eventType)) return true;
    const normalizedEventType = normalizeEventTypeName(eventType);
    if (!normalizedEventType) return false;
    return service.event_types.some(
        (serviceEventType) =>
            normalizeEventTypeName(serviceEventType) === normalizedEventType,
    );
}

export default function BookingDetailPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = params.id as string;
    const supabase = createClient();
    const locale = useLocale();
    const tBookingDetail = useTranslations("BookingDetail");
    const tCommon = useTranslations("Common");
    const bookingsPath = `/${locale}/bookings`;
    const bookingDetailPath = `/${locale}/bookings/${id}`;
    const postSaveState = searchParams.get("saved");
    const [booking, setBooking] = React.useState<Booking | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [isCurrentUserAdmin, setIsCurrentUserAdmin] = React.useState(false);
    const [creatingFolder, setCreatingFolder] = React.useState(false);
    const [isDriveConnected, setIsDriveConnected] = React.useState(false);
    const [clientStatus, setClientStatus] = React.useState("");
    const [dpVerifyTriggerStatus, setDpVerifyTriggerStatus] = React.useState("");
    const [queueTriggerStatus, setQueueTriggerStatus] = React.useState("Antrian Edit");
    const [clientStatusDeadlineTriggerStatus, setClientStatusDeadlineTriggerStatus] =
        React.useState<string | null>(null);
    const [clientStatusDeadlineDefaultDays, setClientStatusDeadlineDefaultDays] =
        React.useState<number>(7);
    const [projectDeadlineDate, setProjectDeadlineDate] = React.useState("");
    const [activeDetailTab, setActiveDetailTab] =
        React.useState<BookingDetailTabKey>("informasi");
    const [savingStatus, setSavingStatus] = React.useState(false);
    const [statusSaved, setStatusSaved] = React.useState(false);
    const [cancelStatusConfirmOpen, setCancelStatusConfirmOpen] = React.useState(false);
    const [bookingStatuses, setBookingStatuses] = React.useState<string[]>(
        getBookingStatusOptions(DEFAULT_CLIENT_STATUSES),
    );
    const [studioName, setStudioName] = React.useState("");
    const [driveFolderPathHint, setDriveFolderPathHint] = React.useState("Data Booking Client Desk > {client_name} > File Client");
    const [refreshingDrivePathHint, setRefreshingDrivePathHint] = React.useState(false);
    const [savedTemplates, setSavedTemplates] = React.useState<{ id: string; type: string; name?: string | null; content: string; content_en: string; event_type: string | null }[]>([]);
    const [adjustmentItems, setAdjustmentItems] = React.useState<EditableAdjustment[]>([]);
    const [addonServices, setAddonServices] = React.useState<AddonService[]>([]);
    const [savingAdjustments, setSavingAdjustments] = React.useState(false);
    const [sendingFinalInvoice, setSendingFinalInvoice] = React.useState(false);
    const [markingFinalPaid, setMarkingFinalPaid] = React.useState(false);
    const [markingFinalUnpaid, setMarkingFinalUnpaid] = React.useState(false);
    const [markingDpVerified, setMarkingDpVerified] = React.useState(false);
    const [markingDpUnverified, setMarkingDpUnverified] = React.useState(false);
    const [syncingFastpik, setSyncingFastpik] = React.useState(false);
    const [fastpikDataSource, setFastpikDataSource] = React.useState<"live" | "fallback">("fallback");
    const [fastpikDataSyncedAt, setFastpikDataSyncedAt] = React.useState<string | null>(null);
    const [fastpikDataMessage, setFastpikDataMessage] = React.useState<string | null>(null);
    const [fastpikLinkDisplayMode, setFastpikLinkDisplayMode] =
        React.useState<FastpikLinkDisplayMode>("prefer_fastpik");
    const [editingDp, setEditingDp] = React.useState(false);
    const [dpInput, setDpInput] = React.useState("");
    const [savingDp, setSavingDp] = React.useState(false);
    const [editingAccommodation, setEditingAccommodation] = React.useState(false);
    const [accommodationInput, setAccommodationInput] = React.useState("");
    const [savingAccommodation, setSavingAccommodation] = React.useState(false);
    const [editingDiscount, setEditingDiscount] = React.useState(false);
    const [discountInput, setDiscountInput] = React.useState("");
    const [savingDiscount, setSavingDiscount] = React.useState(false);
    const [customAddonOpen, setCustomAddonOpen] = React.useState(false);
    const [customAddonName, setCustomAddonName] = React.useState("");
    const [customAddonPrice, setCustomAddonPrice] = React.useState("");
    const [customAddonDescription, setCustomAddonDescription] = React.useState("");
    const [creatingCustomAddon, setCreatingCustomAddon] = React.useState(false);

    // File upload states
    const [uploadingFile, setUploadingFile] = React.useState(false);
    const [uploadedFiles, setUploadedFiles] = React.useState<{ name: string; url: string; fileId?: string }[]>([]);
    const [deletingFileIdx, setDeletingFileIdx] = React.useState<number | null>(null);
    const [deleteFileModal, setDeleteFileModal] = React.useState<{ open: boolean; idx: number | null }>({ open: false, idx: null });
    const [waFreelancePopup, setWaFreelancePopup] = React.useState(false);
    const [deleteBookingModalOpen, setDeleteBookingModalOpen] = React.useState(false);
    const [deletingBooking, setDeletingBooking] = React.useState(false);
    const [archiveBookingDialogOpen, setArchiveBookingDialogOpen] = React.useState(false);
    const [archivingBooking, setArchivingBooking] = React.useState(false);
    const [pendingRedirect, setPendingRedirect] = React.useState<string | null>(null);
    const [feedbackDialog, setFeedbackDialog] = React.useState<{
        open: boolean;
        title: string;
        message: string;
    }>({ open: false, title: "", message: "" });
    const [proofUploadsEnabled, setProofUploadsEnabled] = React.useState(true);
    const [uploadingProofStage, setUploadingProofStage] = React.useState<BookingProofStage | null>(null);
    const [deletingProofStage, setDeletingProofStage] = React.useState<BookingProofStage | null>(null);
    const [deleteProofDialog, setDeleteProofDialog] = React.useState<{
        open: boolean;
        stage: BookingProofStage | null;
    }>({ open: false, stage: null });
    const { canWriteBookings } = useBookingWriteAccess();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const currentDpValue = booking?.dp_paid ?? 0;
    const fastpikLinkVisibility = React.useMemo(
        () =>
            resolveFastpikLinkDisplay({
                mode: fastpikLinkDisplayMode,
                fastpikUrl: booking?.fastpik_project_link,
                driveUrl: booking?.drive_folder_url,
            }),
        [
            fastpikLinkDisplayMode,
            booking?.fastpik_project_link,
            booking?.drive_folder_url,
        ],
    );

    const showFeedback = React.useCallback((message: string, title?: string) => {
        setFeedbackDialog({
            open: true,
            title: title || tBookingDetail("feedbackTitle"),
            message,
        });
    }, [tBookingDetail]);
    const invalidateBookingPublicCache = React.useCallback(
        async (options: { bookingCode?: string | null; trackingUuid?: string | null }) => {
            const bookingCode = options.bookingCode?.trim() || null;
            const trackingUuid = options.trackingUuid?.trim() || null;
            if (!bookingCode && !trackingUuid) return;
            try {
                await fetch("/api/internal/cache/invalidate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        scope: "booking",
                        bookingCode,
                        trackingUuid,
                    }),
                });
            } catch {
                // Best effort cache invalidation.
            }
        },
        [],
    );
    const requireBookingWrite = useBookingWriteGuard(({ message, title }) => {
        showFeedback(message, title);
    });
    const { showSuccessToast, successToastNode } = useSuccessToast();
    const warningTitle = tBookingDetail("warningTitle");
    const refreshDriveConnectionStatus = React.useCallback(
        async (force = false) => {
            const connectedPayload = await fetchConnectedGoogleAccountStatus({
                force,
            });
            const connected = connectedPayload?.drive.connected === true;
            setIsDriveConnected(connected);
            return connected;
        },
        [],
    );
    React.useEffect(() => {
        if (postSaveState !== "create" && postSaveState !== "edit") return;

        showSuccessToast(
            postSaveState === "create"
                ? tBookingDetail("bookingCreatedSuccess")
                : tBookingDetail("bookingUpdatedSuccess"),
        );

        const nextSearchParams = new URLSearchParams(searchParams.toString());
        nextSearchParams.delete("saved");
        const nextQuery = nextSearchParams.toString();
        router.replace(
            nextQuery
                ? `${bookingDetailPath}?${nextQuery}`
                : bookingDetailPath,
            { scroll: false },
        );
    }, [
        bookingDetailPath,
        postSaveState,
        router,
        searchParams,
        showSuccessToast,
        tBookingDetail,
    ]);
    const copyTextWithSuccessToast = React.useCallback(
        async (text: string, successMessage: string, errorMessage: string) => {
            try {
                await navigator.clipboard.writeText(text);
                showSuccessToast(successMessage);
            } catch {
                showFeedback(errorMessage, warningTitle);
            }
        },
        [showFeedback, showSuccessToast, warningTitle],
    );
    const fastpikDashboardUrl = React.useMemo(
        () => `${FASTPIK_APP_BASE_URL}/${locale}/dashboard`,
        [locale],
    );

    const handleOpenFastpikDashboard = React.useCallback(() => {
        window.open(fastpikDashboardUrl, "_blank", "noopener,noreferrer");
        const projectId = booking?.fastpik_project_id?.trim();
        if (!projectId) return;
        void copyTextWithSuccessToast(
            projectId,
            tBookingDetail("fastpikProjectIdCopied"),
            tBookingDetail("fastpikProjectIdCopyFailed"),
        );
    }, [booking?.fastpik_project_id, copyTextWithSuccessToast, fastpikDashboardUrl, tBookingDetail]);

    const handleAdminPaymentProofUpload = React.useCallback(async (
        stage: BookingProofStage,
        file: File,
    ) => {
        if (!requireBookingWrite()) return false;
        if (!booking) return false;

        setUploadingProofStage(stage);
        try {
            const formData = new FormData();
            formData.append("stage", stage);
            formData.append("file", file);

            const response = await fetch(`/api/internal/bookings/${booking.id}/payment-proof`, {
                method: "POST",
                body: formData,
            });
            const payload = (
                response.headers.get("content-type")?.includes("application/json")
                    ? await response.json().catch(() => null)
                    : null
            ) as {
                success?: boolean;
                error?: string;
                code?: string;
                proofUrl?: string | null;
                driveFileId?: string | null;
            } | null;

            if (!response.ok || payload?.success !== true) {
                showFeedback(
                    response.status === 413 || payload?.code === "FILE_TOO_LARGE"
                        ? tBookingDetail("maxFileSize5mb")
                        : payload?.error || tBookingDetail("failedUploadPaymentProof"),
                    warningTitle,
                );
                return false;
            }

            setBooking((prev) => {
                if (!prev) return prev;
                if (stage === "final") {
                    return {
                        ...prev,
                        final_payment_proof_url: payload.proofUrl || null,
                        final_payment_proof_drive_file_id: payload.driveFileId || null,
                    };
                }

                return {
                    ...prev,
                    payment_proof_url: payload.proofUrl || null,
                    payment_proof_drive_file_id: payload.driveFileId || null,
                };
            });
            showSuccessToast(
                stage === "final"
                    ? tBookingDetail("finalProofUploaded")
                    : tBookingDetail("initialProofUploaded"),
            );
            return true;
        } catch {
            showFeedback(tBookingDetail("failedUploadPaymentProof"), warningTitle);
            return false;
        } finally {
            setUploadingProofStage(null);
        }
    }, [booking, requireBookingWrite, showFeedback, showSuccessToast, tBookingDetail, warningTitle]);
    const requestDeletePaymentProof = React.useCallback((stage: BookingProofStage) => {
        if (!requireBookingWrite()) return;
        setDeleteProofDialog({ open: true, stage });
    }, [requireBookingWrite]);
    const handleDeletePaymentProof = React.useCallback(async () => {
        if (!requireBookingWrite()) return;
        if (!booking || !deleteProofDialog.stage) return;

        const stage = deleteProofDialog.stage;
        setDeleteProofDialog({ open: false, stage: null });
        setDeletingProofStage(stage);
        try {
            const response = await fetch(
                `/api/internal/bookings/${booking.id}/payment-proof?stage=${encodeURIComponent(stage)}`,
                { method: "DELETE" },
            );
            const payload = (
                response.headers.get("content-type")?.includes("application/json")
                    ? await response.json().catch(() => null)
                    : null
            ) as {
                success?: boolean;
                error?: string;
                warning?: string | null;
            } | null;

            if (!response.ok || payload?.success !== true) {
                showFeedback(payload?.error || tBookingDetail("failedDeletePaymentProof"), warningTitle);
                return;
            }

            setBooking((prev) => {
                if (!prev) return prev;
                if (stage === "final") {
                    return {
                        ...prev,
                        final_payment_proof_url: null,
                        final_payment_proof_drive_file_id: null,
                    };
                }
                return {
                    ...prev,
                    payment_proof_url: null,
                    payment_proof_drive_file_id: null,
                };
            });

            if (payload?.warning) {
                showFeedback(payload.warning, warningTitle);
                return;
            }

            showSuccessToast(
                stage === "final"
                    ? tBookingDetail("finalProofDeleted")
                    : tBookingDetail("initialProofDeleted"),
            );
        } catch {
            showFeedback(tBookingDetail("failedDeletePaymentProof"), warningTitle);
        } finally {
            setDeletingProofStage(null);
        }
    }, [
        booking,
        deleteProofDialog.stage,
        requireBookingWrite,
        showFeedback,
        showSuccessToast,
        tBookingDetail,
        warningTitle,
    ]);

    const handleSyncFastpikManual = React.useCallback(async () => {
        if (!requireBookingWrite()) return;
        if (!booking) return;
        setSyncingFastpik(true);
        try {
            const response = await fetch("/api/integrations/fastpik/sync-booking", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bookingId: booking.id,
                    locale,
                    mode: "manual",
                }),
            });
            const payload = await response.json().catch(() => null);
            const message =
                (typeof payload?.message === "string" && payload.message) ||
                (response.ok
                    ? tBookingDetail("fastpikSyncCompleted")
                    : payload?.error || tBookingDetail("fastpikSyncFailed"));

            const hasSyncState =
                typeof payload?.status === "string" && payload.status !== "idle";
            const hasProjectPayload =
                typeof payload?.projectId === "string" ||
                typeof payload?.projectLink === "string" ||
                typeof payload?.projectEditLink === "string";

            if (response.ok && (hasSyncState || hasProjectPayload)) {
                const nowIso = new Date().toISOString();
                const syncSucceeded = payload?.success !== false;
                setBooking((prev) =>
                    prev
                        ? {
                              ...prev,
                              fastpik_project_id:
                                  typeof payload?.projectId === "string"
                                      ? payload.projectId
                                      : prev.fastpik_project_id,
                              fastpik_project_link:
                                  typeof payload?.projectLink === "string"
                                      ? payload.projectLink
                                      : prev.fastpik_project_link,
                              fastpik_project_edit_link:
                                  typeof payload?.projectEditLink === "string"
                                      ? payload.projectEditLink
                                      : prev.fastpik_project_edit_link,
                              fastpik_sync_status:
                                  typeof payload?.status === "string"
                                      ? payload.status
                                      : prev.fastpik_sync_status,
                              fastpik_last_synced_at: nowIso,
                              extra_fields:
                                  payload?.fastpikProjectInfo &&
                                  typeof payload.fastpikProjectInfo === "object" &&
                                  !Array.isArray(payload.fastpikProjectInfo)
                                      ? {
                                            ...(prev.extra_fields || {}),
                                            fastpik_project: payload.fastpikProjectInfo,
                                        }
                                      : prev.extra_fields,
                          }
                        : prev,
                );
                setFastpikDataSource(syncSucceeded ? "live" : "fallback");
                setFastpikDataSyncedAt(nowIso);
                setFastpikDataMessage(
                    typeof payload?.message === "string" ? payload.message : null,
                );
            }

            showFeedback(
                message,
                response.ok
                    ? locale === "en"
                        ? "Fastpik Sync"
                        : "Sinkron Fastpik"
                    : locale === "en"
                      ? "Warning"
                      : "Peringatan",
            );
        } catch {
            setFastpikDataSource("fallback");
            showFeedback(
                tBookingDetail("fastpikSyncFailed"),
                warningTitle,
            );
        } finally {
            setSyncingFastpik(false);
        }
    }, [booking, locale, requireBookingWrite, showFeedback, tBookingDetail, warningTitle]);

    const hydrateFastpikLive = React.useCallback(async (bookingId: string) => {
        if (!canWriteBookings) return;
        if (!bookingId) return;
        try {
            const response = await fetch("/api/integrations/fastpik/live-booking", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bookingId,
                    locale,
                }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok || payload?.success === false) {
                setFastpikDataSource("fallback");
                if (typeof payload?.message === "string") {
                    setFastpikDataMessage(payload.message);
                }
                return;
            }

            setFastpikDataSource(payload?.source === "live" ? "live" : "fallback");
            setFastpikDataSyncedAt(
                typeof payload?.syncedAt === "string" ? payload.syncedAt : null,
            );
            setFastpikDataMessage(
                typeof payload?.message === "string" ? payload.message : null,
            );

            const patch = payload?.booking;
            if (patch && typeof patch === "object") {
                const rawPatch = patch as Record<string, unknown>;
                setBooking((prev) =>
                    prev
                        ? {
                              ...prev,
                              fastpik_project_id:
                                  rawPatch.fastpik_project_id === null
                                      ? null
                                      : typeof rawPatch.fastpik_project_id === "string"
                                      ? String(rawPatch.fastpik_project_id)
                                      : prev.fastpik_project_id,
                              fastpik_project_link:
                                  rawPatch.fastpik_project_link === null
                                      ? null
                                      : typeof rawPatch.fastpik_project_link === "string"
                                      ? String(rawPatch.fastpik_project_link)
                                      : prev.fastpik_project_link,
                              fastpik_project_edit_link:
                                  rawPatch.fastpik_project_edit_link === null
                                      ? null
                                      : typeof rawPatch.fastpik_project_edit_link === "string"
                                      ? String(rawPatch.fastpik_project_edit_link)
                                      : prev.fastpik_project_edit_link,
                              fastpik_sync_status:
                                  rawPatch.fastpik_sync_status === null
                                      ? null
                                      : typeof rawPatch.fastpik_sync_status === "string"
                                      ? String(rawPatch.fastpik_sync_status)
                                      : prev.fastpik_sync_status,
                              fastpik_last_synced_at:
                                  rawPatch.fastpik_last_synced_at === null
                                      ? null
                                      : typeof rawPatch.fastpik_last_synced_at === "string"
                                      ? String(rawPatch.fastpik_last_synced_at)
                                      : prev.fastpik_last_synced_at,
                              extra_fields:
                                  rawPatch.extra_fields &&
                                  typeof rawPatch.extra_fields === "object" &&
                                  !Array.isArray(rawPatch.extra_fields)
                                      ? (rawPatch.extra_fields as Record<string, unknown>)
                                      : prev.extra_fields,
                          }
                        : prev,
                );
            }
        } catch {
            setFastpikDataSource("fallback");
        }
    }, [canWriteBookings, locale]);

    const buildPathHint = React.useCallback((profile: DrivePathProfile | null | undefined, bookingValue: Pick<Booking, "booking_code" | "client_name" | "event_type" | "session_date" | "extra_fields">) => {
        const folderPathSegments = buildDriveFolderPathSegments({
            structureMap: profile?.drive_folder_structure_map,
            legacyFormat: profile?.drive_folder_format,
            legacyFormatMap: profile?.drive_folder_format_map,
            studioName: profile?.studio_name,
            bookingCode: bookingValue.booking_code,
            clientName: bookingValue.client_name,
            eventType: bookingValue.event_type,
            sessionDate: bookingValue.session_date,
            extraFields: bookingValue.extra_fields,
        });
        return ["Data Booking Client Desk", ...folderPathSegments, "File Client"].join(" > ");
    }, []);

    React.useEffect(() => {
        setDpInput(String(currentDpValue));
    }, [currentDpValue]);

    React.useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase
                .from("profiles")
                .select("role, studio_name, custom_client_statuses, dp_verify_trigger_status, queue_trigger_status, client_status_deadline_trigger_status, client_status_deadline_default_days, drive_folder_format, drive_folder_format_map, drive_folder_structure_map, fastpik_link_display_mode, form_show_proof")
                .eq("id", user.id)
                .single();
            const profileRow = (profile ?? null) as BookingProfileRow | null;
            const userIsAdmin = (profileRow?.role || "").trim().toLowerCase() === "admin";
            setIsCurrentUserAdmin(userIsAdmin);

            const [{ data }, { data: addonServiceRows }] = await Promise.all([
                supabase.from("bookings")
                    .select(getBookingDetailSelect(userIsAdmin))
                    .eq("id", id).single(),
                supabase.from("services")
                    .select("id, name, price, description, event_types")
                    .eq("user_id", user.id)
                    .eq("is_active", true)
                    .eq("is_addon", true)
                    .order("sort_order", { ascending: true })
                    .order("created_at", { ascending: true }),
            ]);
            // Normalize freelancers from junction table
            const rawBooking = data as BookingRow | null;
            const serviceSelections = normalizeBookingServiceSelections(
                rawBooking?.booking_services,
                rawBooking?.services || null,
            );
            const { data: splitModeProfile } = await supabase
                .from("profiles")
                .select("fastpik_link_display_mode_booking_detail")
                .eq("id", user.id)
                .single();
            const bookingDetailLinkMode = (
                splitModeProfile as
                    | { fastpik_link_display_mode_booking_detail?: FastpikLinkDisplayMode | null }
                    | null
            )?.fastpik_link_display_mode_booking_detail;
            const statusOptions = getBookingStatusOptions(profileRow?.custom_client_statuses as string[] | null | undefined);
            setDpVerifyTriggerStatus(profileRow?.dp_verify_trigger_status ?? "");
            setQueueTriggerStatus((profileRow?.queue_trigger_status || "Antrian Edit").trim() || "Antrian Edit");
            setClientStatusDeadlineTriggerStatus(
                normalizeClientStatusDeadlineTriggerStatus(
                    profileRow?.client_status_deadline_trigger_status,
                    statusOptions,
                ),
            );
            setClientStatusDeadlineDefaultDays(
                normalizeClientStatusDeadlineDefaultDays(
                    profileRow?.client_status_deadline_default_days,
                ),
            );
            setFastpikLinkDisplayMode(
                normalizeFastpikLinkDisplayMode(
                    bookingDetailLinkMode ??
                        profileRow?.fastpik_link_display_mode,
                ),
            );
            setBookingStatuses(statusOptions);
            setProofUploadsEnabled(profileRow?.form_show_proof ?? true);
            const syncedStatus = resolveUnifiedBookingStatus({
                status: rawBooking?.status,
                clientStatus: rawBooking?.client_status,
                statuses: statusOptions,
            });
            const normalized = rawBooking ? {
                ...rawBooking,
                event_type: normalizeEventTypeName(rawBooking.event_type) || rawBooking.event_type,
                status: syncedStatus,
                client_status: syncedStatus,
                service_selections: serviceSelections,
                service_label: getBookingServiceLabel(serviceSelections, {
                    kind: "main",
                    fallback: rawBooking.services?.name || "-",
                }),
                booking_freelancers: (() => {
                    const junctionFreelancers =
                        rawBooking.booking_freelance
                            ?.map((item) => item.freelance)
                            .filter((item): item is FreelancerDetail => Boolean(item)) || [];
                    return junctionFreelancers.length > 0
                        ? junctionFreelancers
                        : rawBooking.freelance
                            ? [rawBooking.freelance]
                            : [];
                })()
            } : rawBooking;
            setBooking(normalized as unknown as Booking);
            if (rawBooking) {
                setFastpikDataSource(
                    rawBooking.fastpik_last_synced_at ? "live" : "fallback",
                );
                setFastpikDataSyncedAt(rawBooking.fastpik_last_synced_at || null);
                setFastpikDataMessage(null);
                if (canWriteBookings) {
                    void hydrateFastpikLive(rawBooking.id);
                }
            }
            setAdjustmentItems(
                toEditableAdjustments(
                    normalizeFinalAdjustments(rawBooking?.final_adjustments),
                ),
            );
            setAddonServices((addonServiceRows || []) as AddonService[]);
            if (rawBooking) {
                setClientStatus(syncedStatus);
                setProjectDeadlineDate(rawBooking.project_deadline_date || "");
                if (canWriteBookings && (rawBooking.client_status !== syncedStatus || rawBooking.status !== syncedStatus)) {
                    await supabase.from("bookings").update({ status: syncedStatus, client_status: syncedStatus }).eq("id", id);
                    await invalidateBookingPublicCache({
                        bookingCode: rawBooking.booking_code,
                        trackingUuid: rawBooking.tracking_uuid,
                    });
                }
                // Generate tracking_uuid if not set
                if (canWriteBookings && !rawBooking.tracking_uuid) {
                    const uuid = crypto.randomUUID();
                    await supabase.from("bookings").update({ tracking_uuid: uuid }).eq("id", id);
                    setBooking(prev => prev ? { ...prev, tracking_uuid: uuid } : prev);
                    await invalidateBookingPublicCache({
                        bookingCode: rawBooking.booking_code,
                        trackingUuid: uuid,
                    });
                }
            }
            await refreshDriveConnectionStatus(false);
            if (profile?.studio_name) setStudioName(profile.studio_name);
            if (rawBooking) {
                setDriveFolderPathHint(buildPathHint(profile as DrivePathProfile | null, rawBooking));
            }
            setLoading(false);
        }

        async function fetchTemplates() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase.from("templates").select("id, type, name, content, content_en, event_type").eq("user_id", user.id);
            setSavedTemplates((data || []) as { id: string; type: string; name?: string | null; content: string; content_en: string; event_type: string | null }[]);
        }
        load();
        fetchTemplates();
    }, [
        buildPathHint,
        canWriteBookings,
        hydrateFastpikLive,
        id,
        invalidateBookingPublicCache,
        refreshDriveConnectionStatus,
        supabase,
    ]);

    async function handleSaveClientStatus(options?: {
        skipCancelConfirmation?: boolean;
        cancelPayment?: { policy: CancelPaymentPolicy; refundAmount: number };
    }) {
        if (!requireBookingWrite()) return;
        if (!booking) return;
        const previousStatus = booking.client_status || booking.status || null;
        const nextStatus = clientStatus || booking.status || null;

        if (
            isTransitionToCancelled(previousStatus, nextStatus) &&
            !options?.skipCancelConfirmation
        ) {
            setCancelStatusConfirmOpen(true);
            return;
        }

        setSavingStatus(true);
        const isCancelling = isTransitionToCancelled(previousStatus, nextStatus);
        const cancelPatch = isCancelling
            ? buildCancelPaymentPatch({
                policy: options?.cancelPayment?.policy || "forfeit",
                refundAmount: options?.cancelPayment?.refundAmount || 0,
                verifiedAmount: booking.dp_verified_amount || 0,
            })
            : null;
        const autoDpPatch = buildAutoDpVerificationPatch({
            previousStatus,
            nextStatus,
            triggerStatus: dpVerifyTriggerStatus,
            dpPaid: booking.dp_paid,
            dpVerifiedAt: booking.dp_verified_at,
        });
        const normalizedExistingProjectDeadlineDate = normalizeProjectDeadlineDate(
            booking.project_deadline_date,
        );
        const normalizedProjectDeadlineInput = normalizeProjectDeadlineDate(
            projectDeadlineDate,
        );
        const hasManualDeadlinePatch =
            normalizedExistingProjectDeadlineDate !== normalizedProjectDeadlineInput;
        const updateResult = await updateBookingStatusWithQueueTransition({
            supabase,
            bookingId: booking.id,
            previousStatus,
            nextStatus,
            queueTriggerStatus,
            currentDeadlineDate: booking.project_deadline_date,
            deadlineTriggerStatus: clientStatusDeadlineTriggerStatus,
            deadlineDefaultDays: clientStatusDeadlineDefaultDays,
            patch: {
                ...(cancelPatch || {}),
                ...(autoDpPatch || {}),
                ...(hasManualDeadlinePatch
                    ? { project_deadline_date: normalizedProjectDeadlineInput }
                    : {}),
            },
        });
        setSavingStatus(false);

        if (!updateResult.ok) {
            showFeedback(updateResult.errorMessage || tBookingDetail("failedSaveStatus"));
            return;
        }
        await invalidateBookingPublicCache({
            bookingCode: booking.booking_code,
            trackingUuid: booking.tracking_uuid,
        });

        setCancelStatusConfirmOpen(false);
        setBooking((prev) =>
            prev
                ? {
                    ...prev,
                    status: nextStatus || prev.status,
                    client_status: nextStatus,
                    queue_position:
                        updateResult.transition === "entered"
                            ? (updateResult.queuePosition ?? prev.queue_position)
                            : updateResult.transition === "left"
                                ? null
                                : prev.queue_position,
                    project_deadline_date:
                        updateResult.projectDeadlineDate ?? prev.project_deadline_date,
                    ...(cancelPatch || {}),
                    ...(autoDpPatch || {}),
                }
                : prev,
        );
        setStatusSaved(true);
        setTimeout(() => setStatusSaved(false), 2000);
        setProjectDeadlineDate(updateResult.projectDeadlineDate || "");
        if (updateResult.autoDeadlineApplied && updateResult.projectDeadlineDate) {
            showFeedback(
                locale === "en"
                    ? `Project deadline was created automatically for ${formatProjectDeadlineDate(updateResult.projectDeadlineDate, "en")}.`
                    : `Deadline project otomatis dibuat untuk ${formatProjectDeadlineDate(updateResult.projectDeadlineDate, "id")}.`,
            );
        }

        const calendarWarning = await syncGoogleCalendarForStatusTransition({
            bookingId: booking.id,
            previousStatus,
            nextStatus,
            locale,
        });
        if (calendarWarning) {
            showFeedback(
                calendarWarning,
                locale === "en" ? "Warning" : "Peringatan",
            );
        }
    }

    async function handleSaveDp() {
        if (!requireBookingWrite()) return;
        if (!booking) return;
        const nextDp = Number(dpInput);
        if (!Number.isFinite(nextDp) || nextDp < 0) {
            showFeedback("Nominal DP harus 0 atau lebih.");
            return;
        }

        setSavingDp(true);
        const dpChanged = nextDp !== (booking.dp_paid || 0);
        const shouldResetVerification = dpChanged && Boolean(booking.dp_verified_at);
        const verificationResetPatch = shouldResetVerification
            ? {
                dp_verified_amount: 0,
                dp_verified_at: null,
                dp_refund_amount: 0,
                dp_refunded_at: null,
            }
            : {};
        const nextFinalPaymentAmount = booking.is_fully_paid
            ? Math.max(getFinalInvoiceTotal(booking.total_price, booking.final_adjustments) - nextDp, 0)
            : booking.final_payment_amount;

        const { error } = await supabase
            .from("bookings")
            .update({
                dp_paid: nextDp,
                final_payment_amount: nextFinalPaymentAmount,
                ...verificationResetPatch,
            })
            .eq("id", booking.id);

        if (error) {
            showFeedback(tBookingDetail("failedSaveDp"));
            setSavingDp(false);
            return;
        }
        await invalidateBookingPublicCache({
            bookingCode: booking.booking_code,
            trackingUuid: booking.tracking_uuid,
        });

        setBooking((prev) => prev ? {
            ...prev,
            dp_paid: nextDp,
            final_payment_amount: nextFinalPaymentAmount,
            ...verificationResetPatch,
        } : prev);
        setEditingDp(false);
        setSavingDp(false);
    }

    async function saveInitialPricingComponents(input: {
        accommodationFee: number;
        discountAmount: number;
    }) {
        if (!requireBookingWrite()) return false;
        if (!booking) return false;

        const normalizedAccommodationFee = Math.max(input.accommodationFee || 0, 0);
        const normalizedDiscountAmount = Math.max(input.discountAmount || 0, 0);
        const serviceDerivedBreakdown = getInitialBookingPriceBreakdown({
            totalPrice: booking.total_price,
            serviceSelections: booking.service_selections,
            legacyServicePrice: booking.services?.price ?? booking.total_price,
            extraFields: null,
        });
        const selectedPackageServiceIds = [
            ...new Set([
                ...(booking.service_selections || [])
                    .filter((selection) => selection.kind === "main")
                    .map((selection) => selection.service.id),
                ...(booking.services?.id ? [booking.services.id] : []),
            ]),
        ];
        const selectedAddonServiceIds = [
            ...new Set(
                (booking.service_selections || [])
                    .filter((selection) => selection.kind === "addon")
                    .map((selection) => selection.service.id),
            ),
        ];
        const existingSpecialOffer = resolveSpecialOfferSnapshotFromExtraFields(
            booking.extra_fields,
        );
        const nextSpecialOffer = buildEditableSpecialOfferSnapshot({
            existingSnapshot: existingSpecialOffer,
            selectedEventType: booking.event_type,
            selectedPackageServiceIds,
            selectedAddonServiceIds,
            packageTotal: serviceDerivedBreakdown.packageTotal,
            addonTotal: serviceDerivedBreakdown.addonTotal,
            accommodationFee: normalizedAccommodationFee,
            discountAmount: normalizedDiscountAmount,
            includeWhenZero: Boolean(existingSpecialOffer),
        });
        const nextTotalPrice = computeSpecialOfferTotal({
            packageTotal: serviceDerivedBreakdown.packageTotal,
            addonTotal: serviceDerivedBreakdown.addonTotal,
            accommodationFee: normalizedAccommodationFee,
            discountAmount: normalizedDiscountAmount,
        });
        const nextExtraFields = mergeSpecialOfferSnapshotIntoExtraFields(
            booking.extra_fields,
            nextSpecialOffer,
        );
        const nextIsFullyPaid = isBookingFullyPaid({
            total_price: nextTotalPrice,
            dp_paid: booking.dp_paid || 0,
            dp_verified_amount: booking.dp_verified_amount,
            dp_verified_at: booking.dp_verified_at,
            dp_refund_amount: booking.dp_refund_amount,
            dp_refunded_at: booking.dp_refunded_at,
            final_adjustments: booking.final_adjustments,
            final_payment_amount: booking.final_payment_amount,
            final_paid_at: booking.final_paid_at,
            settlement_status: booking.settlement_status,
            is_fully_paid: booking.is_fully_paid,
        });
        const patch = {
            total_price: nextTotalPrice,
            is_fully_paid: nextIsFullyPaid,
            extra_fields: nextExtraFields,
            updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
            .from("bookings")
            .update(patch)
            .eq("id", booking.id);

        if (error) {
            showFeedback(tBookingDetail("failedSaveInitialPriceComponents"));
            return false;
        }
        await invalidateBookingPublicCache({
            bookingCode: booking.booking_code,
            trackingUuid: booking.tracking_uuid,
        });

        setBooking((prev) => (prev ? { ...prev, ...patch } : prev));
        return true;
    }

    async function handleSaveAccommodation() {
        const nextAccommodation = Number(accommodationInput);
        if (!Number.isFinite(nextAccommodation) || nextAccommodation < 0) {
            showFeedback("Nominal akomodasi harus 0 atau lebih.");
            return;
        }

        setSavingAccommodation(true);
        const saved = await saveInitialPricingComponents({
            accommodationFee: nextAccommodation,
            discountAmount: initialPriceBreakdown.discountAmount,
        });
        setSavingAccommodation(false);
        if (!saved) return;
        setEditingAccommodation(false);
    }

    async function handleSaveDiscount() {
        const nextDiscount = Number(discountInput);
        if (!Number.isFinite(nextDiscount) || nextDiscount < 0) {
            showFeedback("Nominal diskon harus 0 atau lebih.");
            return;
        }

        setSavingDiscount(true);
        const saved = await saveInitialPricingComponents({
            accommodationFee: initialPriceBreakdown.accommodationFee,
            discountAmount: nextDiscount,
        });
        setSavingDiscount(false);
        if (!saved) return;
        setEditingDiscount(false);
    }

    async function handleMarkDpVerified() {
        if (!requireBookingWrite()) return;
        if (!booking) return;
        setMarkingDpVerified(true);
        const verifiedAmount = Math.max(booking.dp_paid || 0, 0);
        const verifiedAt = verifiedAmount > 0 ? new Date().toISOString() : null;
        const patch = {
            dp_verified_amount: verifiedAmount,
            dp_verified_at: verifiedAt,
            dp_refund_amount: 0,
            dp_refunded_at: null,
        };

        const { error } = await supabase
            .from("bookings")
            .update(patch)
            .eq("id", booking.id);
        setMarkingDpVerified(false);

        if (error) {
            showFeedback(tBookingDetail("failedVerifyDp"));
            return;
        }
        await invalidateBookingPublicCache({
            bookingCode: booking.booking_code,
            trackingUuid: booking.tracking_uuid,
        });

        setBooking((prev) => (prev ? { ...prev, ...patch } : prev));
    }

    async function handleMarkDpUnverified() {
        if (!requireBookingWrite()) return;
        if (!booking) return;
        setMarkingDpUnverified(true);
        const patch = {
            dp_verified_amount: 0,
            dp_verified_at: null,
            dp_refund_amount: 0,
            dp_refunded_at: null,
        };

        const { error } = await supabase
            .from("bookings")
            .update(patch)
            .eq("id", booking.id);
        setMarkingDpUnverified(false);

        if (error) {
            showFeedback(tBookingDetail("failedUnverifyDp"));
            return;
        }
        await invalidateBookingPublicCache({
            bookingCode: booking.booking_code,
            trackingUuid: booking.tracking_uuid,
        });

        setBooking((prev) => (prev ? { ...prev, ...patch } : prev));
    }

    async function copyTrackingLink() {
        if (!booking?.tracking_uuid) return;
        const url = `${window.location.origin}/${locale}/track/${booking.tracking_uuid}`;
        try {
            await navigator.clipboard.writeText(url);
            showSuccessToast(tBookingDetail("trackingLinkCopied"));
        } catch {
            showFeedback(tBookingDetail("trackingLinkCopyFailed"), warningTitle);
        }
    }

    async function handleRefreshDrivePathHint() {
        if (!booking) return;
        setRefreshingDrivePathHint(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: profile } = await supabase
                .from("profiles")
                .select("studio_name, drive_folder_format, drive_folder_format_map, drive_folder_structure_map")
                .eq("id", user.id)
                .single();
            setDriveFolderPathHint(buildPathHint(profile as DrivePathProfile | null, booking));
        } catch {
            showFeedback(tBookingDetail("failedRefreshDrivePath"));
        } finally {
            setRefreshingDrivePathHint(false);
        }
    }

    const formatDate = (d: string | null) => {
        if (!d) return "-";
        return formatSessionDate(d, { locale: locale === "en" ? "en" : "id" });
    };

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);

    function sendWA(phone: string | null, name: string) {
        if (!phone || !booking) return;
        const cleaned = normalizeWhatsAppNumber(phone);
        const templateMode = resolveWhatsAppTemplateMode({
            eventType: booking.event_type,
            extraFields: booking.extra_fields,
        });
        // Use client template if available
        const content = getWhatsAppTemplateContent(
            savedTemplates,
            "whatsapp_client",
            locale,
            booking.event_type,
            templateMode,
        );
        let msg: string;
        if (content.trim()) {
            const vars = buildBookingWhatsAppTemplateVars({
                booking: {
                    ...booking,
                    client_name: booking.client_name || name,
                },
                locale,
                studioName,
                trackingLink: trackingLink || "-",
                invoiceUrl: `${window.location.origin}/api/public/invoice?code=${encodeURIComponent(booking.booking_code)}&lang=${locale}&stage=${activeInvoiceStage}`,
                totalPriceOverride: finalInvoiceTotal || booking.total_price || 0,
            });
            msg = fillWhatsAppTemplate(content, vars);
        } else {
            msg = `Halo ${name}, terima kasih telah booking di studio kami!`;
        }
        openWhatsAppUrl(buildWhatsAppUrl(cleaned, msg));
    }

    function sendWAFreelance(phone: string | null, fname: string) {
        if (!phone || !booking) { showFeedback(tBookingDetail("freelancerPhoneUnavailable")); return; }
        const cleaned = normalizeWhatsAppNumber(phone);
        const templateMode = resolveWhatsAppTemplateMode({
            eventType: booking.event_type,
            extraFields: booking.extra_fields,
        });
        // Use freelancer template if available
        const content = getWhatsAppTemplateContent(
            savedTemplates,
            "whatsapp_freelancer",
            locale,
            booking.event_type,
            templateMode,
        );
        let msg: string;
        if (content.trim()) {
            const vars = buildBookingWhatsAppTemplateVars({
                booking,
                locale,
                studioName,
                freelancerName: fname,
            });
            msg = fillWhatsAppTemplate(content, vars);
        } else {
            msg = tBookingDetail("freelancerFallbackMessage", {
                freelancerName: fname,
                clientName: booking.client_name,
                bookingCode: booking.booking_code,
                sessionDate: booking.session_date
                    ? formatTemplateSessionDate(booking.session_date, { locale: locale === "en" ? "en" : "id" })
                    : "-",
            });
        }
        openWhatsAppUrl(buildWhatsAppUrl(cleaned, msg));
    }

    async function handleCreateFolder() {
        if (!requireBookingWrite()) return;
        if (!booking) return;
        setCreatingFolder(true);
        const res = await fetch("/api/google/drive/create-folder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingId: booking.id, bookingCode: booking.booking_code, clientName: booking.client_name }),
        });
        const result = await res.json();
        if (result.success && result.folderUrl) {
            window.open(result.folderUrl, "_blank");
            setBooking(prev => prev ? { ...prev, drive_folder_url: result.folderUrl } : prev);
        } else {
            clearConnectedGoogleAccountCache();
            await refreshDriveConnectionStatus(true);
            showFeedback(result.error || tBookingDetail("failedCreateFolder"));
        }
        setCreatingFolder(false);
    }

    async function handleUploadClientFile(e: React.ChangeEvent<HTMLInputElement>) {
        if (!requireBookingWrite()) return;
        const file = e.target.files?.[0];
        if (!file || !booking) return;
        if (file.size > MAX_GOOGLE_UPLOAD_BYTES) {
            showFeedback(tBookingDetail("maxFileSize5mb"), warningTitle);
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }
        setUploadingFile(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("bookingId", booking.id);
            formData.append("clientName", booking.client_name);
            formData.append("bookingCode", booking.booking_code);
            formData.append("eventType", booking.event_type || "");
            const res = await fetch("/api/google/drive/upload-client-file", {
                method: "POST",
                body: formData,
            });
            const result = (
                res.headers.get("content-type")?.includes("application/json")
                    ? await res.json().catch(() => null)
                    : null
            ) as {
                success?: boolean;
                error?: string;
                code?: string;
                fileUrl?: string | null;
                fileName?: string;
                fileId?: string | null;
                folderUrl?: string | null;
            } | null;
            const uploadedFileUrl =
                typeof result?.fileUrl === "string" && result.fileUrl.trim()
                    ? result.fileUrl
                    : null;
            const uploadedFolderUrl =
                typeof result?.folderUrl === "string" && result.folderUrl.trim()
                    ? result.folderUrl
                    : null;
            if (res.ok && result?.success && uploadedFileUrl) {
                setUploadedFiles(prev => [
                    ...prev,
                    {
                        name: result.fileName || file.name,
                        url: uploadedFileUrl,
                        fileId: result.fileId || undefined,
                    },
                ]);
                // Update drive_folder_url if it was set by the API
                if (!booking.drive_folder_url && uploadedFolderUrl) {
                    setBooking(prev => prev ? { ...prev, drive_folder_url: uploadedFolderUrl } : prev);
                }
            } else {
                if (!(res.status === 413 || result?.code === "FILE_TOO_LARGE")) {
                    clearConnectedGoogleAccountCache();
                    await refreshDriveConnectionStatus(true);
                }
                showFeedback(
                    res.status === 413 || result?.code === "FILE_TOO_LARGE"
                        ? tBookingDetail("maxFileSize5mb")
                        : result?.error || tBookingDetail("failedUploadFile"),
                );
            }
        } catch {
            showFeedback(tBookingDetail("failedUploadFile"));
        }
        setUploadingFile(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
    }

    async function handleDeleteClientFile(idx: number) {
        const file = uploadedFiles[idx];
        if (!file?.fileId) return;
        setDeletingFileIdx(idx);
        setDeleteFileModal({ open: false, idx: null });
        try {
            const res = await fetch("/api/google/drive/delete-file", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileId: file.fileId }),
            });
            const result = await res.json();
            if (result.success) {
                setUploadedFiles(prev => prev.filter((_, i) => i !== idx));
            } else {
                clearConnectedGoogleAccountCache();
                await refreshDriveConnectionStatus(true);
                showFeedback(result.error || tBookingDetail("failedDeleteFile"));
            }
        } catch {
            clearConnectedGoogleAccountCache();
            await refreshDriveConnectionStatus(true);
            showFeedback(tBookingDetail("failedDeleteFile"));
        }
        setDeletingFileIdx(null);
    }

    const filteredAddonServices = React.useMemo(
        () => addonServices.filter((service) => isAddonAvailableForEvent(service, booking?.event_type || null)),
        [addonServices, booking?.event_type],
    );

    function addAdjustmentItem(service?: AddonService) {
        setAdjustmentItems((prev) => [
            ...prev,
            {
                id: crypto.randomUUID(),
                service_id: service?.id || null,
                source: service ? "service_addon" : "manual",
                label: service?.name || "",
                unit_price: String(service?.price || ""),
                quantity: "1",
                amount: String(service?.price || ""),
                reason: "",
                created_at: new Date().toISOString(),
            },
        ]);
    }

    function handleSelectAdjustmentService(id: string, serviceId: string) {
        const selectedService = filteredAddonServices.find((service) => service.id === serviceId) || null;
        setAdjustmentItems((prev) =>
            prev.map((item) =>
                item.id === id
                    ? {
                        ...item,
                        service_id: selectedService?.id || null,
                        source: selectedService ? "service_addon" : "manual",
                        label: selectedService?.name || item.label,
                        unit_price: selectedService ? String(selectedService.price) : item.unit_price,
                        amount: selectedService
                            ? String(selectedService.price * Math.max(Number(item.quantity) || 1, 1))
                            : item.amount,
                    }
                    : item,
            ),
        );
    }

    function updateAdjustmentItem(id: string, field: keyof EditableAdjustment, value: string) {
        setAdjustmentItems((prev) =>
            prev.map((item) => {
                if (item.id !== id) return item;
                const nextItem = { ...item, [field]: value };
                const unitPrice = Number(field === "unit_price" ? value : nextItem.unit_price) || 0;
                const quantity = Math.max(Number(field === "quantity" ? value : nextItem.quantity) || 1, 1);
                return {
                    ...nextItem,
                    amount: String(unitPrice * quantity),
                };
            }),
        );
    }

    function removeAdjustmentItem(id: string) {
        setAdjustmentItems((prev) => prev.filter((item) => item.id !== id));
    }

    async function saveFinalAdjustments(nextStatus?: SettlementStatus) {
        if (!requireBookingWrite()) return null;
        if (!booking) return null;

        const normalizedAdjustments = normalizeEditableAdjustments(adjustmentItems);
        setSavingAdjustments(true);
        const updatePayload: Record<string, unknown> = {
            final_adjustments: normalizedAdjustments,
        };
        if (nextStatus) {
            updatePayload.settlement_status = nextStatus;
        }

        const { error } = await supabase
            .from("bookings")
            .update(updatePayload)
            .eq("id", booking.id);

        setSavingAdjustments(false);

        if (error) {
            showFeedback(tBookingDetail("failedSaveFinalAddons"));
            return null;
        }
        await invalidateBookingPublicCache({
            bookingCode: booking.booking_code,
            trackingUuid: booking.tracking_uuid,
        });

        setBooking((prev) =>
            prev
                ? {
                    ...prev,
                    final_adjustments: normalizedAdjustments,
                    settlement_status: nextStatus || prev.settlement_status,
                }
                : prev,
        );
        setAdjustmentItems(toEditableAdjustments(normalizedAdjustments));

        return normalizedAdjustments;
    }

    async function handleCreateCustomAddon() {
        if (!requireBookingWrite()) return;
        if (!booking || !customAddonName.trim() || Number(customAddonPrice) <= 0) {
            showFeedback("Isi nama dan harga add-on custom terlebih dahulu.");
            return;
        }

        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) {
            showFeedback(tBookingDetail("sessionNotFound"));
            return;
        }

        setCreatingCustomAddon(true);
        const { data, error } = await supabase
            .from("services")
            .insert({
                user_id: auth.user.id,
                name: customAddonName.trim(),
                price: Number(customAddonPrice) || 0,
                description: customAddonDescription.trim() || null,
                is_addon: true,
                is_active: true,
                event_types: booking.event_type
                    ? [normalizeEventTypeName(booking.event_type) || booking.event_type]
                    : null,
            })
            .select("id, name, price, description, event_types")
            .single();
        setCreatingCustomAddon(false);

        if (error || !data) {
            showFeedback(tBookingDetail("failedCreateCustomAddon"));
            return;
        }

        const nextService = data as AddonService;
        setAddonServices((prev) => [...prev, nextService]);
        addAdjustmentItem(nextService);
        setCustomAddonName("");
        setCustomAddonPrice("");
        setCustomAddonDescription("");
        setCustomAddonOpen(false);
    }

    async function handleSendFinalInvoice() {
        if (!requireBookingWrite()) return;
        if (!booking?.tracking_uuid || !booking.client_whatsapp) {
            showFeedback(tBookingDetail("trackingLinkOrWhatsappMissing"));
            return;
        }

        const preOpenedWindow = preopenWindowForDeferredNavigation();
        setSendingFinalInvoice(true);
        const normalizedAdjustments = await saveFinalAdjustments("sent");
        if (!normalizedAdjustments) {
            setSendingFinalInvoice(false);
            closePreopenedWindow(preOpenedWindow);
            return;
        }

        const sentAt = new Date().toISOString();
        const { error } = await supabase
            .from("bookings")
            .update({
                settlement_status: "sent",
                final_invoice_sent_at: sentAt,
                final_payment_amount: 0,
                final_payment_method: null,
                final_payment_source: null,
                final_payment_proof_url: null,
                final_payment_proof_drive_file_id: null,
                final_paid_at: null,
                is_fully_paid: false,
            })
            .eq("id", booking.id);

        setSendingFinalInvoice(false);

        if (error) {
            showFeedback(tBookingDetail("failedSendFinalInvoice"));
            closePreopenedWindow(preOpenedWindow);
            return;
        }
        await invalidateBookingPublicCache({
            bookingCode: booking.booking_code,
            trackingUuid: booking.tracking_uuid,
        });

        const finalTotal = getFinalInvoiceTotal(booking.total_price, normalizedAdjustments);
        const remainingFinal = getRemainingFinalPayment({
            total_price: booking.total_price,
            dp_paid: booking.dp_paid,
            final_adjustments: normalizedAdjustments,
            is_fully_paid: false,
            settlement_status: "sent",
        });
        const invoiceUrl = `${window.location.origin}/api/public/invoice?code=${encodeURIComponent(booking.booking_code)}&lang=${locale}&stage=final`;
        const settlementUrl = `${window.location.origin}/${locale}/settlement/${booking.tracking_uuid}`;
        const cleaned = normalizeWhatsAppNumber(booking.client_whatsapp);
        const templateMode = resolveWhatsAppTemplateMode({
            eventType: booking.event_type,
            extraFields: booking.extra_fields,
        });
        const templateContent = getWhatsAppTemplateContent(
            savedTemplates,
            "whatsapp_settlement_client",
            locale,
            booking.event_type,
            templateMode,
        );
        const baseVars = buildBookingWhatsAppTemplateVars({
            booking: {
                client_name: booking.client_name,
                client_whatsapp: booking.client_whatsapp || "-",
                instagram: booking.instagram,
                booking_code: booking.booking_code,
                session_date: booking.session_date,
                total_price: booking.total_price,
                dp_paid: booking.dp_paid,
                event_type: booking.event_type,
                location: booking.location,
                location_lat: booking.location_lat,
                location_lng: booking.location_lng,
                location_detail: booking.location_detail,
                notes: booking.notes,
                extra_fields: booking.extra_fields,
                service_label: booking.service_label || booking.services?.name || "-",
                services: booking.services,
                service_selections: booking.service_selections,
            },
            locale,
            studioName,
            trackingLink: booking.tracking_uuid
                ? `${window.location.origin}/${locale}/track/${booking.tracking_uuid}`
                : "-",
            invoiceUrl,
        });
        const message = templateContent.trim()
            ? fillWhatsAppTemplate(templateContent, {
                ...baseVars,
                final_total: formatCurrency(finalTotal),
                adjustments_total: formatCurrency(getFinalAdjustmentsTotal(normalizedAdjustments)),
                remaining_payment: formatCurrency(remainingFinal),
                settlement_link: settlementUrl,
            })
            : `Halo ${booking.client_name}, invoice final untuk booking ${booking.booking_code} sudah kami siapkan.\n\n` +
                `Paket: ${booking.service_label || booking.services?.name || "-"}\n` +
                `Total awal: ${formatCurrency(booking.total_price)}\n` +
                `Add-on akhir: ${formatCurrency(getFinalAdjustmentsTotal(normalizedAdjustments))}\n` +
                `Total final: ${formatCurrency(finalTotal)}\n` +
                `DP terbayar: ${formatCurrency(booking.dp_paid)}\n` +
                `${tBookingDetail("waSettlementRemainingLabel")}: ${formatCurrency(remainingFinal)}\n\n` +
                `Invoice final: ${invoiceUrl}\n` +
                `${tBookingDetail("waSettlementFormLabel")}: ${settlementUrl}\n\n` +
                `${tBookingDetail("waSettlementInstruction")}`;

        setBooking((prev) =>
            prev
                ? {
                    ...prev,
                    settlement_status: "sent",
                    final_invoice_sent_at: sentAt,
                    final_adjustments: normalizedAdjustments,
                    final_payment_amount: 0,
                    final_payment_method: null,
                    final_payment_source: null,
                    final_payment_proof_url: null,
                    final_payment_proof_drive_file_id: null,
                    final_paid_at: null,
                    is_fully_paid: false,
                }
                : prev,
        );

        openWhatsAppUrl(buildWhatsAppUrl(cleaned, message), {
            preOpenedWindow,
        });
    }

    async function handleMarkFinalPaid() {
        if (!requireBookingWrite()) return;
        if (!booking) return;

        const normalizedAdjustments = normalizeEditableAdjustments(adjustmentItems);
        const remainingFinal = getRemainingFinalPayment({
            total_price: booking.total_price,
            dp_paid: booking.dp_paid,
            final_adjustments: normalizedAdjustments,
            final_payment_amount: booking.final_payment_amount,
            final_paid_at: booking.final_paid_at,
            settlement_status: booking.settlement_status,
            is_fully_paid: booking.is_fully_paid,
        });

        setMarkingFinalPaid(true);
        const paidAt = new Date().toISOString();
        const { error } = await supabase
            .from("bookings")
            .update({
                final_adjustments: normalizedAdjustments,
                settlement_status: "paid",
                final_payment_amount: remainingFinal,
                final_paid_at: paidAt,
                is_fully_paid: true,
            })
            .eq("id", booking.id);
        setMarkingFinalPaid(false);

        if (error) {
            showFeedback(tBookingDetail("failedMarkBookingPaid"));
            return;
        }
        await invalidateBookingPublicCache({
            bookingCode: booking.booking_code,
            trackingUuid: booking.tracking_uuid,
        });

        setBooking((prev) =>
            prev
                ? {
                    ...prev,
                    final_adjustments: normalizedAdjustments,
                    settlement_status: "paid",
                    final_payment_amount: remainingFinal,
                    final_paid_at: paidAt,
                    is_fully_paid: true,
                }
                : prev,
        );
        setAdjustmentItems(toEditableAdjustments(normalizedAdjustments));
    }

    async function handleMarkFinalUnpaid() {
        if (!requireBookingWrite()) return;
        if (!booking) return;

        setMarkingFinalUnpaid(true);
        const nextSettlementStatus = booking.final_invoice_sent_at ? "sent" : "draft";
        const { error } = await supabase
            .from("bookings")
            .update({
                is_fully_paid: false,
                settlement_status: nextSettlementStatus,
                final_payment_amount: 0,
                final_paid_at: null,
            })
            .eq("id", booking.id);
        setMarkingFinalUnpaid(false);

        if (error) {
            showFeedback(tBookingDetail("failedCancelBookingPaid"));
            return;
        }
        await invalidateBookingPublicCache({
            bookingCode: booking.booking_code,
            trackingUuid: booking.tracking_uuid,
        });

        setBooking((prev) =>
            prev
                ? {
                    ...prev,
                    is_fully_paid: false,
                    settlement_status: nextSettlementStatus,
                    final_payment_amount: 0,
                    final_paid_at: null,
                }
                : prev,
        );
    }

    async function handleDeleteBooking() {
        if (!requireBookingWrite()) return;
        if (!booking) return;

        setDeletingBooking(true);
        const warningDetails: string[] = [];

        try {
            const calendarRes = await fetch("/api/google/calendar-delete-booking", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bookingId: booking.id }),
            });
            const calendarResult = await calendarRes.json().catch(() => null) as {
                success?: boolean;
                errors?: string[];
                error?: string;
            } | null;

            if (!calendarRes.ok) {
                warningDetails.push(
                    locale === "en"
                        ? `Google Calendar event deletion failed: ${calendarResult?.error || "Unknown error"}`
                        : tBookingDetail("googleCalendarDeleteFailed", {
                            reason: calendarResult?.error || "Unknown error",
                        }),
                );
            } else if (calendarResult && calendarResult.success === false) {
                const firstError = Array.isArray(calendarResult.errors) ? calendarResult.errors[0] : null;
                warningDetails.push(
                    locale === "en"
                        ? `Some Google Calendar events failed to delete.${firstError ? ` ${firstError}` : ""}`
                        : tBookingDetail("googleCalendarDeletePartial", {
                            firstError: firstError ? ` ${firstError}` : "",
                        }),
                );
            }
        } catch {
            warningDetails.push(
                locale === "en"
                    ? "Failed to remove Google Calendar event."
                    : tBookingDetail("googleCalendarDeleteFailedGeneric"),
            );
        }

        const hasFastpikProject = Boolean(
            booking.fastpik_project_id?.trim() ||
            booking.fastpik_project_link?.trim() ||
            booking.fastpik_project_edit_link?.trim(),
        );
        if (hasFastpikProject) {
            try {
                const fastpikRes = await fetch("/api/integrations/fastpik/delete-booking-project", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        bookingId: booking.id,
                        locale,
                    }),
                });
                const fastpikResult = await fastpikRes.json().catch(() => null) as {
                    success?: boolean;
                    message?: string;
                    error?: string;
                } | null;

                if (!fastpikRes.ok || fastpikResult?.success === false) {
                    const reason =
                        (typeof fastpikResult?.message === "string" &&
                            fastpikResult.message.trim()) ||
                        (typeof fastpikResult?.error === "string" &&
                            fastpikResult.error.trim()) ||
                        "Unknown error";
                    warningDetails.push(
                        locale === "en"
                            ? `Fastpik project deletion failed: ${reason}`
                            : tBookingDetail("fastpikProjectDeleteFailed", { reason }),
                    );
                }
            } catch {
                warningDetails.push(
                    locale === "en"
                        ? "Failed to delete Fastpik project."
                        : tBookingDetail("fastpikProjectDeleteFailedGeneric"),
                );
            }
        }

        const { error } = await supabase.from("bookings").delete().eq("id", booking.id);
        if (error) {
            setDeletingBooking(false);
            showFeedback(locale === "en" ? "Failed to delete booking." : tBookingDetail("failedDeleteBooking"));
            return;
        }

        setDeleteBookingModalOpen(false);
        setDeletingBooking(false);

        if (warningDetails.length > 0) {
            const warningMessage = locale === "en"
                ? `Booking deleted with warning${warningDetails.length > 1 ? "s" : ""}: ${warningDetails.join(" ")}`
                : tBookingDetail("bookingDeletedWithWarning", { warnings: warningDetails.join(" ") });
            setPendingRedirect(bookingsPath);
            showFeedback(warningMessage, warningTitle);
            return;
        }

        router.push(bookingsPath);
        router.refresh();
    }

    async function handleArchiveBookingToggle() {
        if (!requireBookingWrite()) return;
        if (!booking) return;

        const nextArchived = !isArchivedBooking(booking);
        const {
            data: { user },
        } = await supabase.auth.getUser();
        const archivedBy = nextArchived ? user?.id || null : null;
        setArchivingBooking(true);

        const { error } = await supabase
            .from("bookings")
            .update(
                nextArchived
                    ? {
                        archived_at: new Date().toISOString(),
                        archived_by: archivedBy,
                    }
                    : {
                        archived_at: null,
                        archived_by: null,
                    },
            )
            .eq("id", booking.id);

        setArchivingBooking(false);

        if (error) {
            showFeedback(
                locale === "en"
                    ? "Failed to update archive status."
                    : "Gagal memperbarui status arsip.",
                warningTitle,
            );
            return;
        }

        setArchiveBookingDialogOpen(false);
        setBooking((prev) =>
            prev
                ? {
                    ...prev,
                    archived_at: nextArchived ? new Date().toISOString() : null,
                    archived_by: archivedBy,
                }
                : prev,
        );
        showSuccessToast(
            nextArchived
                ? (locale === "en" ? "Booking archived." : "Booking berhasil diarsipkan.")
                : (locale === "en" ? "Booking restored." : "Booking berhasil dikembalikan."),
        );
    }

    if (loading) return (
        <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
    );

    if (!booking) return (
        <div className="text-center py-24 text-muted-foreground">Booking tidak ditemukan.</div>
    );

    const settlementStatus = getSettlementStatus(booking.settlement_status);
    const finalAdjustments = normalizeEditableAdjustments(adjustmentItems);
    const finalAdjustmentsTotal = getFinalAdjustmentsTotal(finalAdjustments);
    const operationalCosts = isCurrentUserAdmin
        ? normalizeOperationalCosts(booking.operational_costs)
        : [];
    const operationalCostsTotal = getOperationalCostsTotal(operationalCosts);
    const finalInvoiceTotal = getFinalInvoiceTotal(booking.total_price, finalAdjustments);
    const verifiedPaymentInput = {
        total_price: booking.total_price,
        dp_paid: booking.dp_paid,
        dp_verified_amount: booking.dp_verified_amount,
        dp_verified_at: booking.dp_verified_at,
        dp_refund_amount: booking.dp_refund_amount,
        dp_refunded_at: booking.dp_refunded_at,
        final_adjustments: finalAdjustments,
        final_payment_amount: booking.final_payment_amount,
        final_paid_at: booking.final_paid_at,
        settlement_status: booking.settlement_status,
        is_fully_paid: booking.is_fully_paid,
    };
    const verifiedDpAmount = getVerifiedDpAmount(verifiedPaymentInput);
    const dpRefundAmount = getDpRefundAmount(verifiedPaymentInput);
    const verifiedFinalPayment = booking.final_paid_at ? booking.final_payment_amount || 0 : 0;
    const netVerifiedRevenue = getNetVerifiedRevenueAmount(verifiedPaymentInput);
    const netRevenueAfterOperationalCosts = isCurrentUserAdmin
        ? getNetRevenueAfterOperationalCosts({
            ...verifiedPaymentInput,
            operational_costs: operationalCosts,
        })
        : netVerifiedRevenue;
    const initialPaymentStatus = booking.is_fully_paid
        ? "Lunas"
        : verifiedDpAmount > 0
            ? "DP Terverifikasi"
            : booking.dp_paid > 0
                ? "DP Menunggu Verifikasi"
            : tBookingDetail("unpaid");
    const remaining = getRemainingFinalPayment({
        total_price: booking.total_price,
        dp_paid: booking.dp_paid,
        final_adjustments: finalAdjustments,
        final_payment_amount: booking.final_payment_amount,
        final_paid_at: booking.final_paid_at,
        settlement_status: booking.settlement_status,
        is_fully_paid: booking.is_fully_paid,
    });
    const activeInvoiceStage = getInvoiceStage({
        total_price: booking.total_price,
        dp_paid: booking.dp_paid,
        final_adjustments: finalAdjustments,
        final_payment_amount: booking.final_payment_amount,
        final_paid_at: booking.final_paid_at,
        settlement_status: booking.settlement_status,
        is_fully_paid: booking.is_fully_paid,
    });
    const normalizedSettlementStatus = (booking.settlement_status || "").trim().toLowerCase();
    const hasFinalProofContext = Boolean(
        booking.final_payment_method ||
        booking.final_payment_source ||
        (booking.final_payment_amount || 0) > 0 ||
        booking.final_payment_proof_url ||
        (normalizedSettlementStatus && normalizedSettlementStatus !== "pending"),
    );
    const showInitialProofSection = proofUploadsEnabled || Boolean(booking.payment_proof_url);
    const showFinalProofSection = Boolean(booking.final_payment_proof_url) || (proofUploadsEnabled && hasFinalProofContext);
    const initialPriceBreakdown = getInitialBookingPriceBreakdown({
        totalPrice: booking.total_price,
        serviceSelections: booking.service_selections,
        legacyServicePrice: booking.services?.price ?? booking.total_price,
        extraFields: booking.extra_fields,
    });
    const sessionDisplay = buildBookingSessionDisplay({
        eventType: booking.event_type,
        sessionDate: booking.session_date,
        extraFields: booking.extra_fields,
        legacyService: booking.services,
        serviceSelections: booking.service_selections,
        locale: locale === "en" ? "en" : "id",
    });
    const trackingLink = booking.tracking_uuid ? `${window.location.origin}/${locale}/track/${booking.tracking_uuid}` : "";
    const settlementLink = booking.tracking_uuid ? `${window.location.origin}/${locale}/settlement/${booking.tracking_uuid}` : "";
    const builtInExtraFields = extractBuiltInExtraFieldValues(booking.extra_fields);
    const extraEntries = Object.entries(builtInExtraFields);
    const addonNamesFromServices = (booking.service_selections || [])
        .filter((selection) => selection.kind === "addon")
        .map((selection) =>
            `${selection.service.name}${selection.quantity > 1 ? ` x${selection.quantity}` : ""}`,
        )
        .filter(Boolean);
    const addonLabel =
        addonNamesFromServices.length > 0
            ? addonNamesFromServices.join(", ")
            : builtInExtraFields.addon_names || "-";
    const customFieldSnapshots = extractCustomFieldSnapshots(booking.extra_fields)
        .filter((field) => !HIDDEN_EXTRA_FIELD_KEYS.has(field.id));
    const customFieldsBySection = groupCustomSnapshotsBySection(customFieldSnapshots);
    const fastpikProjectInfo = resolveFastpikProjectInfoFromExtraFields(booking.extra_fields);
    const formatFastpikSyncTimestamp = (value: string | null | undefined) => {
        if (!value) return "-";
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return "-";
        return parsed.toLocaleString(locale === "en" ? "en-US" : "id-ID", {
            dateStyle: "medium",
            timeStyle: "short",
        });
    };
    const fastpikSyncMeta = {
        source: fastpikDataSource === "live" ? "Live" : "Fallback",
        syncedAt: formatFastpikSyncTimestamp(
            fastpikDataSyncedAt ||
                fastpikProjectInfo?.synced_at ||
                booking.fastpik_last_synced_at,
        ),
    };
    const normalizedQueueTriggerStatus =
        (queueTriggerStatus || "Antrian Edit").trim() || "Antrian Edit";
    const normalizedCurrentStatus =
        (booking.client_status || booking.status || "").trim();
    const normalizedSelectedStatus = (clientStatus || "").trim();
    const isCurrentlyInQueue =
        normalizedCurrentStatus === normalizedQueueTriggerStatus &&
        booking.queue_position !== null;
    const willEnterQueueAfterSave =
        normalizedSelectedStatus === normalizedQueueTriggerStatus &&
        normalizedCurrentStatus !== normalizedQueueTriggerStatus;
    const queuePositionDisplay = isCurrentlyInQueue
        ? `#${booking.queue_position}`
        : willEnterQueueAfterSave
            ? "Akan otomatis saat disimpan."
            : "-";
    const deadlineLocale = locale === "en" ? "en" : "id";
    const effectiveProjectDeadlineDate =
        projectDeadlineDate || booking.project_deadline_date;
    const projectDeadlineCountdown = getProjectDeadlineCountdownLabel(
        effectiveProjectDeadlineDate,
        deadlineLocale,
    );

    // Separate nama_pasangan from other extra fields (show right after Nama for Wedding)
    const namaPasangan = builtInExtraFields.nama_pasangan;
    const sessionLocationEntries = extraEntries.filter(
        ([key, val]) =>
            LOCATION_FIELDS.has(key) && typeof val === "string" && val.trim().length > 0,
    );
    const otherExtraEntries = extraEntries.filter(
        ([key]) =>
            key !== "nama_pasangan" &&
            !HIDDEN_EXTRA_FIELD_KEYS.has(key) &&
            !LOCATION_FIELDS.has(key),
    );
    const normalizeInstagramValue = (rawValue: string) => {
        const trimmed = rawValue.trim();
        if (!trimmed) return { url: null, label: rawValue };

        const compact = trimmed.replace(/\s+/g, "");
        const isInstagramUrl = /^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i.test(compact);
        if (isInstagramUrl) {
            const url = /^https?:\/\//i.test(compact) ? compact : `https://${compact}`;
            try {
                const parsed = new URL(url);
                const firstPath = parsed.pathname.split("/").filter(Boolean)[0] || "";
                const reservedPaths = new Set(["p", "reel", "reels", "stories", "tv", "explore"]);
                const handle = reservedPaths.has(firstPath.toLowerCase())
                    ? ""
                    : firstPath.replace(/^@+/, "");
                return {
                    url,
                    label: handle ? `@${handle}` : trimmed,
                };
            } catch {
                return { url, label: trimmed };
            }
        }

        const handle = compact.replace(/^@+/, "");
        if (!handle) return { url: null, label: trimmed };
        return {
            url: `https://instagram.com/${handle}`,
            label: `@${handle}`,
        };
    };
    const renderInstagramFieldValue = (rawValue: string) => {
        const instagramValue = normalizeInstagramValue(rawValue);
        if (!instagramValue.url) return rawValue;
        return (
            <a href={instagramValue.url} target="_blank" rel="noreferrer"
                className="inline-flex max-w-full items-center gap-1 break-all text-blue-600 hover:underline">
                <Instagram className="w-3.5 h-3.5" /> {instagramValue.label}
            </a>
        );
    };
    const renderExtraFieldValue = (key: string, rawValue: string) => {
        if (
            key === "tanggal_akad" ||
            key === "tanggal_resepsi" ||
            key === "tanggal_wisuda_1" ||
            key === "tanggal_wisuda_2"
        ) {
            return formatDate(rawValue);
        }
        if (key === "instagram_pasangan") {
            return renderInstagramFieldValue(rawValue);
        }
        if (LOCATION_FIELDS.has(key)) {
            return <LocationValue address={rawValue} />;
        }
        return rawValue;
    };
    const copyFastpikPassword = () => {
        const password = fastpikProjectInfo?.password || "";
        if (!password) {
            showFeedback(
                locale === "en"
                    ? "Fastpik password is not available yet."
                    : tBookingDetail("fastpikPasswordUnavailable"),
            );
            return;
        }
        void copyTextWithSuccessToast(
            password,
            locale === "en"
                ? "Fastpik password copied."
                : tBookingDetail("fastpikPasswordCopied"),
            locale === "en"
                ? "Failed to copy Fastpik password."
                : tBookingDetail("fastpikPasswordCopyFailed"),
        );
    };
    const handleCopyGalleryLink = (url: string) => {
        void copyTextWithSuccessToast(
            url,
            locale === "en" ? "Gallery link copied." : tBookingDetail("galleryLinkCopied"),
            locale === "en"
                ? "Failed to copy gallery link."
                : tBookingDetail("galleryLinkCopyFailed"),
        );
    };
    const handleCopyPortfolioLink = (url: string) => {
        void copyTextWithSuccessToast(
            url,
            locale === "en"
                ? "Portfolio link copied."
                : tBookingDetail("portfolioLinkCopied"),
            locale === "en"
                ? "Failed to copy portfolio link."
                : tBookingDetail("portfolioLinkCopyFailed"),
        );
    };
    const renderGalleryLinkCard = (
        label: string,
        url: string,
        iconClassName: string,
        mutedBackground = false,
    ) => (
        <div className="space-y-1.5">
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <div className={`flex min-w-0 flex-col gap-2 rounded-lg border p-3 text-sm ${mutedBackground ? "bg-muted/20" : "bg-muted/30"} sm:flex-row sm:items-center`}>
                <div className="flex min-w-0 items-start gap-2">
                    <Link2 className={`mt-0.5 w-4 h-4 shrink-0 ${iconClassName}`} />
                    <span className="min-w-0 flex-1 break-all text-xs text-muted-foreground sm:truncate">{url}</span>
                </div>
                <div className="flex shrink-0 justify-end gap-1">
                    <button
                        onClick={() => handleCopyGalleryLink(url)}
                        className="p-1.5 rounded hover:bg-muted transition-colors cursor-pointer"
                        title="Salin Link"
                    >
                        <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => window.open(url, "_blank")}
                        className="p-1.5 rounded hover:bg-muted transition-colors cursor-pointer"
                        title="Buka di Tab Baru"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
    const detailTabs: Array<{ key: BookingDetailTabKey; label: string }> = [
        { key: "informasi", label: "Informasi" },
        { key: "keuangan", label: "Keuangan" },
        { key: "hasil-jadi", label: "Hasil Jadi" },
        { key: "status-klien", label: "Status Klien" },
    ];

    return (
        <>
        {successToastNode}
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <Link href="/bookings">
                        <Button variant="ghost" size="icon" className="shrink-0">
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </Link>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="break-words text-2xl font-bold tracking-tight">{booking.client_name}</h2>
                            <StatusBadge status={booking.status} />
                            {isArchivedBooking(booking) ? (
                                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                    {tCommon("diarsipkan")}
                                </span>
                            ) : null}
                        </div>
                        <p className="break-words text-muted-foreground text-sm">
                            {booking.booking_code}
                            {booking.event_type && booking.event_type !== "Umum" ? ` · ${booking.event_type}` : ""}
                        </p>
                    </div>
                </div>
                <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:shrink-0">
                    <Button
                        variant="outline"
                        size="sm"
                        className={`${RESPONSIVE_ACTION_BUTTON_CLASS} gap-1.5`}
                        onClick={() => setArchiveBookingDialogOpen(true)}
                        disabled={!canWriteBookings || archivingBooking}
                    >
                        {archivingBooking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                        {isArchivedBooking(booking)
                            ? (locale === "en" ? "Restore from Archive" : "Kembalikan dari Arsip")
                            : tCommon("arsipkan")}
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        className={`${RESPONSIVE_ACTION_BUTTON_CLASS} gap-1.5`}
                        onClick={() => setDeleteBookingModalOpen(true)}
                        disabled={!canWriteBookings}
                    >
                        <Trash2 className="w-4 h-4" /> Hapus
                    </Button>
                    {canWriteBookings ? (
                        <Link href={`/bookings/${booking.id}/edit`} className={RESPONSIVE_ACTION_LINK_CLASS}>
                            <Button variant="outline" size="sm" className={`${RESPONSIVE_ACTION_BUTTON_CLASS} gap-1.5`}>
                                <Edit2 className="w-4 h-4" /> Edit
                            </Button>
                        </Link>
                    ) : (
                        <Button variant="outline" size="sm" className={`${RESPONSIVE_ACTION_BUTTON_CLASS} gap-1.5`} disabled>
                            <Edit2 className="w-4 h-4" /> Edit
                        </Button>
                    )}
                </div>
            </div>

            <BookingWriteReadonlyBanner />

            {/* Quick Actions */}
            <div className={RESPONSIVE_ACTION_GROUP_CLASS}>
                <Button variant="outline" size="sm" className={`${RESPONSIVE_ACTION_BUTTON_CLASS} gap-1.5`} onClick={() => sendWA(booking.client_whatsapp, booking.client_name)}>
                    <MessageSquare className="w-4 h-4 text-green-600" /> Whatsapp Klien
                </Button>
                {booking.booking_freelancers.length > 0 && (
                    <Button variant="outline" size="sm" className={`${RESPONSIVE_ACTION_BUTTON_CLASS} gap-1.5`} onClick={() => {
                        if (booking.booking_freelancers.length === 1) {
                            sendWAFreelance(booking.booking_freelancers[0].whatsapp_number, booking.booking_freelancers[0].name);
                        } else {
                            setWaFreelancePopup(true);
                        }
                    }}>
                        <Phone className="w-4 h-4 text-blue-600" /> Whatsapp Freelance
                    </Button>
                )}
                {booking.drive_folder_url ? (
                    <Button variant="outline" size="sm" className={`${RESPONSIVE_ACTION_BUTTON_CLASS} gap-1.5`} onClick={() => window.open(booking.drive_folder_url!, "_blank")}>
                        <Folder className="w-4 h-4 text-yellow-600" /> Buka Drive Folder
                    </Button>
                ) : (
                    <Button variant="outline" size="sm" className={`${RESPONSIVE_ACTION_BUTTON_CLASS} gap-1.5`} disabled={!isDriveConnected || creatingFolder || !canWriteBookings} onClick={handleCreateFolder}>
                        {creatingFolder ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4 text-yellow-600" />}
                        Buat Drive Folder
                    </Button>
                )}
            </div>

            <div className="border-b">
                <div className="-mx-1 overflow-x-auto px-1 md:mx-0 md:overflow-visible md:px-0">
                    <div className="flex min-w-max gap-0 md:min-w-0 md:flex-wrap">
                        {detailTabs.map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setActiveDetailTab(tab.key)}
                                className={`shrink-0 whitespace-nowrap px-3 sm:px-4 pt-3 pb-2 text-sm font-medium border-b-[3px] transition-colors cursor-pointer ${
                                    activeDetailTab === tab.key
                                        ? "border-foreground text-foreground"
                                        : "border-transparent text-muted-foreground hover:text-foreground/80 hover:border-muted-foreground/30"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Informasi Klien */}
            {activeDetailTab === "informasi" && (
            <div className="rounded-xl border bg-card p-4 space-y-3 sm:p-6">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Informasi Klien</h3>
                <InfoRow label="Nama" value={booking.client_name} />
                {namaPasangan && (
                    <InfoRow label="Nama Pasangan" value={namaPasangan} />
                )}
                <InfoRow label="WhatsApp" value={booking.client_whatsapp || "-"} />
                {booking.instagram && (
                    <InfoRow label="Instagram" value={renderInstagramFieldValue(booking.instagram)} />
                )}
                {booking.event_type && booking.event_type !== "Umum" && (
                    <InfoRow label="Tipe Acara" value={booking.event_type} />
                )}
                {otherExtraEntries.map(([key, val]) => (
                    <InfoRow
                        key={key}
                        label={EXTRA_FIELD_LABEL_KEYS[key] ? tBookingDetail(EXTRA_FIELD_LABEL_KEYS[key]) : key}
                        value={renderExtraFieldValue(key, val)}
                    />
                ))}
                {(customFieldsBySection.client_info || []).map((field) => (
                    <InfoRow key={field.id} label={field.label} value={field.value} />
                ))}
            </div>
            )}

            {/* Detail Sesi/Acara */}
            {activeDetailTab === "informasi" && (
            <div className="rounded-xl border bg-card p-4 space-y-3 sm:p-6">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">{tBookingDetail("sectionSessionDetail")}</h3>
                <InfoRow label={tBookingDetail("sessionDateLabel")} value={renderSessionDisplayValue(sessionDisplay.dateDisplay)} />
                <InfoRow label={tBookingDetail("sessionTimeLabel")} value={renderSessionDisplayValue(sessionDisplay.timeDisplay)} />
                {sessionLocationEntries.map(([key, value]) => (
                    <InfoRow
                        key={key}
                        label={EXTRA_FIELD_LABEL_KEYS[key] ? tBookingDetail(EXTRA_FIELD_LABEL_KEYS[key]) : key}
                        value={renderExtraFieldValue(key, value)}
                    />
                ))}
                {booking.location && sessionLocationEntries.length === 0 && (
                    <InfoRow
                        label="Lokasi"
                        value={
                            <LocationValue
                                address={booking.location}
                                lat={booking.location_lat}
                                lng={booking.location_lng}
                            />
                        }
                    />
                )}
                {booking.location_detail && (
                    <InfoRow label={tBookingDetail("locationDetailLabel")} value={booking.location_detail} />
                )}
                <InfoRow label="Paket" value={booking.service_label || booking.services?.name || "-"} />
                <InfoRow label="Add-on" value={addonLabel} />
                <InfoRow label="Freelance" value={
                    booking.booking_freelancers.length > 0
                        ? booking.booking_freelancers.map(f => f.name).join(", ")
                        : "-"
                } />
                {(customFieldsBySection.session_details || []).map((field) => (
                    <InfoRow key={field.id} label={field.label} value={field.value} />
                ))}
            </div>
            )}

            {/* Keuangan */}
            {activeDetailTab === "keuangan" && (
            <>
            <div className="rounded-xl border bg-card p-4 space-y-3 sm:p-6">
                <div className={RESPONSIVE_SECTION_HEADER_CLASS}>
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Keuangan</h3>
                    <Link href="/invoice-pelunasan" className={RESPONSIVE_ACTION_LINK_CLASS}>
                        <Button variant="outline" size="sm" className={`${RESPONSIVE_ACTION_BUTTON_CLASS} gap-1.5`}>
                            <ExternalLink className="w-4 h-4" />
                            Buka Invoice & Pelunasan
                        </Button>
                    </Link>
                </div>
                <InfoRow label="Status Pembayaran Awal" value={initialPaymentStatus} />
                <InfoRow label={tBookingDetail("settlementStatusLabel")} value={getSettlementLabel(settlementStatus)} />
                <div className="border-t pt-3 space-y-3">
                    <InfoRow label="Paket Awal" value={formatCurrency(initialPriceBreakdown.packageTotal)} />
                    <InfoRow label="Add-on Awal" value={formatCurrency(initialPriceBreakdown.addonTotal)} />
                    {(editingAccommodation || Number(initialPriceBreakdown.accommodationFee) > 0) ? (
                    <InfoRow
                        label="Akomodasi"
                        value={editingAccommodation ? (
                            <div className={RESPONSIVE_INLINE_ACTION_CLASS}>
                                <input
                                    type="number"
                                    min={0}
                                    value={accommodationInput}
                                    onChange={(e) => setAccommodationInput(e.target.value)}
                                    className={RESPONSIVE_MONEY_INPUT_CLASS}
                                />
                                <Button size="sm" className={RESPONSIVE_ACTION_BUTTON_CLASS} onClick={() => { void handleSaveAccommodation(); }} disabled={savingAccommodation}>
                                    {savingAccommodation ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan"}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={RESPONSIVE_ACTION_BUTTON_CLASS}
                                    onClick={() => {
                                        setAccommodationInput(String(initialPriceBreakdown.accommodationFee || 0));
                                        setEditingAccommodation(false);
                                        }}
                                        disabled={savingAccommodation}
                                    >
                                        Batal
                                    </Button>
                                </div>
                            ) : (
                                <div className={RESPONSIVE_INLINE_ACTION_CLASS}>
                                    <span>{formatCurrency(initialPriceBreakdown.accommodationFee)}</span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className={`${RESPONSIVE_ACTION_BUTTON_CLASS} h-8 px-2.5`}
                                        onClick={() => {
                                            setAccommodationInput(String(initialPriceBreakdown.accommodationFee || 0));
                                            setEditingAccommodation(true);
                                        }}
                                    >
                                        Edit Akomodasi
                                    </Button>
                                </div>
                            )}
                        />
                    ) : null}
                    {(editingDiscount || Number(initialPriceBreakdown.discountAmount) > 0) ? (
                        <InfoRow
                            label="Diskon"
                            value={editingDiscount ? (
                                <div className={RESPONSIVE_INLINE_ACTION_CLASS}>
                                    <input
                                        type="number"
                                        min={0}
                                        value={discountInput}
                                        onChange={(e) => setDiscountInput(e.target.value)}
                                        className={RESPONSIVE_MONEY_INPUT_CLASS}
                                    />
                                    <Button size="sm" className={RESPONSIVE_ACTION_BUTTON_CLASS} onClick={() => { void handleSaveDiscount(); }} disabled={savingDiscount}>
                                        {savingDiscount ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan"}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className={RESPONSIVE_ACTION_BUTTON_CLASS}
                                        onClick={() => {
                                            setDiscountInput(String(initialPriceBreakdown.discountAmount || 0));
                                            setEditingDiscount(false);
                                        }}
                                        disabled={savingDiscount}
                                    >
                                        Batal
                                    </Button>
                                </div>
                            ) : (
                                <div className={RESPONSIVE_INLINE_ACTION_CLASS}>
                                    <span>- {formatCurrency(initialPriceBreakdown.discountAmount)}</span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className={`${RESPONSIVE_ACTION_BUTTON_CLASS} h-8 px-2.5`}
                                        onClick={() => {
                                            setDiscountInput(String(initialPriceBreakdown.discountAmount || 0));
                                            setEditingDiscount(true);
                                        }}
                                    >
                                        Edit Diskon
                                    </Button>
                                </div>
                            )}
                        />
                    ) : null}
                    <InfoRow
                        label="DP Dibayar"
                        value={editingDp ? (
                            <div className={RESPONSIVE_INLINE_ACTION_CLASS}>
                                <input
                                    type="number"
                                    min={0}
                                    value={dpInput}
                                    onChange={(e) => setDpInput(e.target.value)}
                                    className={RESPONSIVE_MONEY_INPUT_CLASS}
                                />
                                <Button size="sm" className={RESPONSIVE_ACTION_BUTTON_CLASS} onClick={() => { void handleSaveDp(); }} disabled={savingDp}>
                                    {savingDp ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan"}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={RESPONSIVE_ACTION_BUTTON_CLASS}
                                    onClick={() => {
                                        setDpInput(String(booking.dp_paid || 0));
                                        setEditingDp(false);
                                    }}
                                    disabled={savingDp}
                                >
                                    Batal
                                </Button>
                            </div>
                        ) : (
                            <div className={RESPONSIVE_INLINE_ACTION_CLASS}>
                                <span>{formatCurrency(booking.dp_paid)}</span>
                                <Button variant="outline" size="sm" className={`${RESPONSIVE_ACTION_BUTTON_CLASS} h-8 px-2.5`} onClick={() => setEditingDp(true)}>
                                    Edit DP
                                </Button>
                                {verifiedDpAmount > 0 ? (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className={`${RESPONSIVE_ACTION_BUTTON_CLASS} h-8 px-2.5`}
                                        onClick={handleMarkDpUnverified}
                                        disabled={markingDpUnverified}
                                    >
                                        {markingDpUnverified ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Batal Tandai Lunas DP"}
                                    </Button>
                                ) : (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className={`${RESPONSIVE_ACTION_BUTTON_CLASS} h-8 px-2.5`}
                                        onClick={handleMarkDpVerified}
                                        disabled={markingDpVerified || booking.dp_paid <= 0}
                                    >
                                        {markingDpVerified ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Tandai Lunas DP"}
                                    </Button>
                                )}
                            </div>
                        )}
                    />
                    <InfoRow label="DP Terverifikasi" value={formatCurrency(verifiedDpAmount)} />
                    <InfoRow label="Refund DP" value={formatCurrency(dpRefundAmount)} />
                    <InfoRow
                        label="Total Awal"
                        value={
                            <span className="font-semibold text-green-700 dark:text-green-400">
                                {formatCurrency(booking.total_price)}
                            </span>
                        }
                    />
                </div>
                <div className="border-t pt-3 space-y-3">
                    <InfoRow label="Addon Akhir" value={formatCurrency(finalAdjustmentsTotal)} />
                    <InfoRow
                        label="Total Final"
                        value={
                            <span className="font-semibold text-green-700 dark:text-green-400">
                                {formatCurrency(finalInvoiceTotal)}
                            </span>
                        }
                    />
                </div>
                <div className="border-t pt-3 space-y-3">
                    <InfoRow label={tBookingDetail("verifiedSettlementLabel")} value={formatCurrency(verifiedFinalPayment)} />
                    <InfoRow
                        label="Total Terverifikasi"
                        value={
                            <span className="font-semibold text-green-700 dark:text-green-400">
                                {formatCurrency(netVerifiedRevenue)}
                            </span>
                        }
                    />
                    {isCurrentUserAdmin && (
                        <>
                            <InfoRow label="Biaya Operasional" value={`- ${formatCurrency(operationalCostsTotal)}`} />
                            <InfoRow
                                label="Pemasukan Bersih"
                                value={
                                    <span className="font-semibold text-green-700 dark:text-green-400">
                                        {formatCurrency(netRevenueAfterOperationalCosts)}
                                    </span>
                                }
                            />
                        </>
                    )}
                </div>
                {isCurrentUserAdmin && (
                    <div className="border-t pt-3 space-y-3">
                        <InfoRow
                            label="Rincian Biaya Operasional"
                            value={
                                operationalCosts.length > 0 ? (
                                    <div className="space-y-2">
                                        {operationalCosts.map((item) => (
                                            <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2">
                                                <span>{item.label}</span>
                                                <span className="font-medium">- {formatCurrency(item.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    "-"
                                )
                            }
                        />
                    </div>
                )}
                <div className="border-t pt-3 space-y-3">
                    <InfoRow label="Metode Pembayaran" value={formatPaymentMethod(booking.payment_method)} />
                    <InfoRow label="Sumber Pembayaran" value={formatPaymentSource(booking.payment_source)} />
                    <InfoRow label="Sisa" value={
                        <span className={remaining > 0 ? "font-semibold text-amber-600 dark:text-amber-400" : "font-semibold text-green-600 dark:text-green-400"}>
                            {formatCurrency(remaining)}
                        </span>
                    } />
                </div>
                {(customFieldsBySection.payment_details || []).map((field) => (
                    <InfoRow key={field.id} label={field.label} value={field.value} />
                ))}
            </div>

            <div className="rounded-xl border bg-card p-4 space-y-4 sm:p-6">
                <div className={RESPONSIVE_SECTION_HEADER_CLASS}>
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Pelunasan Final</h3>
                        <SettlementBadge status={settlementStatus} />
                    </div>
                    <div className={RESPONSIVE_SECTION_ACTIONS_CLASS}>
                        <Link href="/invoice-pelunasan" className={RESPONSIVE_ACTION_LINK_CLASS}>
                            <Button variant="outline" size="sm" className={`${RESPONSIVE_ACTION_BUTTON_CLASS} gap-1.5`}>
                                <ExternalLink className="w-4 h-4" />
                                Invoice & Pelunasan
                            </Button>
                        </Link>
                        <Button
                            variant="outline"
                            size="sm"
                            className={`${RESPONSIVE_ACTION_BUTTON_CLASS} gap-1.5`}
                            onClick={() => window.open(`/api/public/invoice?code=${encodeURIComponent(booking.booking_code)}&lang=${locale}&stage=final`, "_blank")}
                        >
                            <FileText className="w-4 h-4" />
                            Invoice Final
                        </Button>
                        {booking.tracking_uuid && (
                            <Button
                                variant="outline"
                                size="sm"
                                className={`${RESPONSIVE_ACTION_BUTTON_CLASS} gap-1.5`}
                                onClick={() => window.open(settlementLink, "_blank")}
                            >
                                <ExternalLink className="w-4 h-4" />
                                Form Pelunasan
                            </Button>
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    {adjustmentItems.length === 0 ? (
                        <div className="rounded-lg border border-dashed px-4 py-4 text-sm text-muted-foreground">
                            Belum ada add-on akhir. Pilih add-on dari katalog paket atau buat add-on custom yang otomatis masuk ke katalog.
                        </div>
                    ) : (
                        adjustmentItems.map((item) => (
                            <div key={item.id} className="grid gap-3 rounded-xl border p-3 sm:p-4">
                                <div className="grid gap-3 md:grid-cols-[1.6fr_0.6fr_0.8fr_auto]">
                                    <select
                                        value={item.service_id || ""}
                                        onChange={(e) => handleSelectAdjustmentService(item.id, e.target.value)}
                                        className={`${adminNativeSelectClass} h-10 text-sm`}
                                    >
                                        <option value="">Pilih add-on katalog...</option>
                                        {filteredAddonServices.map((service) => (
                                            <option key={service.id} value={service.id}>
                                                {service.name} - {formatCurrency(service.price)}
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        min={1}
                                        value={item.quantity}
                                        onChange={(e) => updateAdjustmentItem(item.id, "quantity", e.target.value)}
                                        placeholder="Qty"
                                        className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                                    />
                                    <input
                                        type="number"
                                        min={0}
                                        value={item.unit_price}
                                        onChange={(e) => updateAdjustmentItem(item.id, "unit_price", e.target.value)}
                                        placeholder="Harga"
                                        className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                                    />
                                    <Button variant="ghost" size="icon" onClick={() => removeAdjustmentItem(item.id)}>
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </Button>
                                </div>
                                <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
                                    <input
                                        value={item.label}
                                        onChange={(e) => updateAdjustmentItem(item.id, "label", e.target.value)}
                                        placeholder="Nama add-on"
                                        className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                                    />
                                    <input
                                        value={item.reason}
                                        onChange={(e) => updateAdjustmentItem(item.id, "reason", e.target.value)}
                                        placeholder="Alasan / catatan"
                                        className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                                    />
                                </div>
                                <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                                    <span>{item.service_id ? "Sumber: katalog add-on" : "Sumber: item manual lama / custom"}</span>
                                    <span>Total item: {formatCurrency(Number(item.amount) || 0)}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className={RESPONSIVE_ACTION_GROUP_CLASS}>
                    <Button
                        variant="outline"
                        size="sm"
                        className={`${RESPONSIVE_ACTION_BUTTON_CLASS} gap-1.5`}
                        onClick={() => addAdjustmentItem(filteredAddonServices[0])}
                        disabled={filteredAddonServices.length === 0}
                    >
                        <Upload className="w-4 h-4" />
                        Tambah Add-on
                    </Button>
                    <Button variant="outline" size="sm" className={`${RESPONSIVE_ACTION_BUTTON_CLASS} gap-1.5`} onClick={() => setCustomAddonOpen(true)}>
                        <FileText className="w-4 h-4" />
                        Add-on Custom
                    </Button>
                    <Button size="sm" className={`${RESPONSIVE_ACTION_BUTTON_CLASS} gap-1.5`} onClick={() => { void saveFinalAdjustments(); }} disabled={savingAdjustments}>
                        {savingAdjustments ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Simpan Add-on
                    </Button>
                </div>

                <div className="rounded-xl bg-muted/30 border p-3 space-y-2 text-sm sm:p-4">
                    <div className="flex justify-between gap-4"><span className="text-muted-foreground">Total Awal</span><span className="font-medium">{formatCurrency(booking.total_price)}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-muted-foreground">Total Add-on Akhir</span><span className="font-medium">{formatCurrency(finalAdjustmentsTotal)}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-muted-foreground">Total Final</span><span className="font-medium">{formatCurrency(finalInvoiceTotal)}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-muted-foreground">DP Dibayar</span><span className="font-medium">- {formatCurrency(booking.dp_paid)}</span></div>
                    <div className="flex justify-between gap-4 border-t pt-2"><span className="font-semibold">Sisa Pelunasan</span><span className="font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(remaining)}</span></div>
                </div>

                <div className={RESPONSIVE_ACTION_GROUP_CLASS}>
                    <Button size="sm" className={`${RESPONSIVE_ACTION_BUTTON_CLASS} gap-1.5`} onClick={handleSendFinalInvoice} disabled={sendingFinalInvoice || !booking.client_whatsapp || !canWriteBookings}>
                        {sendingFinalInvoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                        Kirim Invoice Final
                    </Button>
                    {booking.is_fully_paid ? (
                        <Button variant="outline" size="sm" className={`${RESPONSIVE_ACTION_BUTTON_CLASS} gap-1.5`} onClick={handleMarkFinalUnpaid} disabled={markingFinalUnpaid || !canWriteBookings}>
                            {markingFinalUnpaid ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                            Batal Tandai Lunas
                        </Button>
                    ) : (
                        <Button variant="outline" size="sm" className={`${RESPONSIVE_ACTION_BUTTON_CLASS} gap-1.5`} onClick={handleMarkFinalPaid} disabled={markingFinalPaid || !canWriteBookings}>
                            {markingFinalPaid ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                            Tandai Lunas
                        </Button>
                    )}
                </div>

                {booking.final_invoice_sent_at && (
                    <p className="text-xs text-muted-foreground">
                        Invoice final terakhir dikirim pada {formatDate(booking.final_invoice_sent_at)}.
                    </p>
                )}

                {booking.tracking_uuid && (
                    <div className="grid gap-2 text-xs text-muted-foreground">
                        <div className="rounded-md bg-muted/50 px-3 py-2 break-all">Tracking: {trackingLink}</div>
                        <div className="rounded-md bg-muted/50 px-3 py-2 break-all">Pelunasan: {settlementLink}</div>
                    </div>
                )}

                {(booking.final_payment_method || booking.final_payment_source) && (
                    <div className="rounded-lg border p-3 space-y-2 text-sm sm:p-4">
                        <p className="font-medium">Data Pelunasan Masuk</p>
                        <InfoRow label="Metode" value={formatPaymentMethod(booking.final_payment_method)} />
                        <InfoRow label="Sumber" value={formatPaymentSource(booking.final_payment_source)} />
                        <InfoRow label="Nominal" value={formatCurrency(booking.final_payment_amount || 0)} />
                        <InfoRow label="Status" value={getSettlementLabel(settlementStatus)} />
                    </div>
                )}
            </div>

            {showInitialProofSection && (
                <PaymentProofManager
                    title="Bukti Pembayaran Awal"
                    url={booking.payment_proof_url}
                    driveFileId={booking.payment_proof_drive_file_id}
                    alt="Bukti Pembayaran Awal"
                    linkLabel="Buka bukti pembayaran awal"
                    emptyLabel={tBookingDetail("initialPaymentProofEmpty")}
                    helperText="Upload atau ganti bukti pembayaran awal dari admin."
                    uploadLabel={booking.payment_proof_url ? "Ganti Bukti Awal" : "Upload Bukti Awal"}
                    uploading={uploadingProofStage === "initial"}
                    deleting={deletingProofStage === "initial"}
                    canUpload={proofUploadsEnabled && canWriteBookings}
                    canDelete={Boolean(booking.payment_proof_url) && canWriteBookings}
                    deleteLabel={tBookingDetail("deleteInitialProof")}
                    onUpload={(file) => handleAdminPaymentProofUpload("initial", file)}
                    onDelete={() => requestDeletePaymentProof("initial")}
                    onError={(message) => showFeedback(message, warningTitle)}
                />
            )}

            {showFinalProofSection && (
                <PaymentProofManager
                    title={tBookingDetail("finalPaymentProofTitle")}
                    url={booking.final_payment_proof_url}
                    driveFileId={booking.final_payment_proof_drive_file_id}
                    alt={tBookingDetail("finalPaymentProofAlt")}
                    linkLabel={tBookingDetail("finalPaymentProofLinkLabel")}
                    emptyLabel={tBookingDetail("finalPaymentProofEmpty")}
                    helperText={tBookingDetail("finalPaymentProofHelper")}
                    uploadLabel={booking.final_payment_proof_url ? "Ganti Bukti Final" : "Upload Bukti Final"}
                    uploading={uploadingProofStage === "final"}
                    deleting={deletingProofStage === "final"}
                    canUpload={proofUploadsEnabled && canWriteBookings}
                    canDelete={Boolean(booking.final_payment_proof_url) && canWriteBookings}
                    deleteLabel={tBookingDetail("deleteFinalProof")}
                    onUpload={(file) => handleAdminPaymentProofUpload("final", file)}
                    onDelete={() => requestDeletePaymentProof("final")}
                    onError={(message) => showFeedback(message, warningTitle)}
                />
            )}
            </>
            )}

            {/* Catatan */}
            {activeDetailTab === "informasi" && booking.notes && (
                <div className="rounded-xl border bg-card p-4 space-y-2 sm:p-6">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Catatan</h3>
                    <p className="text-sm whitespace-pre-wrap">{booking.notes}</p>
                </div>
            )}
            {activeDetailTab === "informasi" && booking.admin_notes && (
                <div className="rounded-xl border bg-card p-4 space-y-2 sm:p-6">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Catatan Admin</h3>
                    <p className="text-sm whitespace-pre-wrap">{booking.admin_notes}</p>
                </div>
            )}

            {/* Link Pilih Foto (mengikuti mode tampilan link Fastpik) */}
            {activeDetailTab === "hasil-jadi" && (
                <div className="rounded-xl border bg-card p-4 space-y-3 sm:p-6">
                    <div className={RESPONSIVE_SECTION_HEADER_CLASS}>
                        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                            <Folder className="w-4 h-4" /> Link Pilih Foto
                        </h3>
                        <div className={RESPONSIVE_SECTION_ACTIONS_CLASS}>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className={`${RESPONSIVE_ACTION_BUTTON_CLASS} gap-1.5`}
                                onClick={() => void handleSyncFastpikManual()}
                                disabled={syncingFastpik || !canWriteBookings}
                            >
                                {syncingFastpik ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <RefreshCcw className="w-4 h-4" />
                                )}
                                Sync Fastpik
                            </Button>
                            {booking.fastpik_project_edit_link ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className={`${RESPONSIVE_ACTION_BUTTON_CLASS} gap-1.5`}
                                    onClick={() => window.open(booking.fastpik_project_edit_link!, "_blank", "noopener,noreferrer")}
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    Edit Project di Fastpik
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className={`${RESPONSIVE_ACTION_BUTTON_CLASS} gap-1.5`}
                                    onClick={handleOpenFastpikDashboard}
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    Buka Dashboard Fastpik
                                </Button>
                            )}
                        </div>
                    </div>

                    {fastpikLinkVisibility.showFastpik &&
                        fastpikLinkVisibility.fastpikUrl &&
                        renderGalleryLinkCard(
                            fastpikLinkVisibility.mode === "both"
                                ? "Fastpik"
                                : "Fastpik (utama)",
                            fastpikLinkVisibility.fastpikUrl,
                            "text-emerald-500",
                        )}

                    {fastpikLinkVisibility.showDrive &&
                        fastpikLinkVisibility.driveUrl &&
                        renderGalleryLinkCard(
                            fastpikLinkVisibility.mode === "both"
                                ? "Google Drive"
                                : fastpikLinkVisibility.mode === "drive_only"
                                  ? "Google Drive (utama)"
                                  : "Google Drive (fallback)",
                            fastpikLinkVisibility.driveUrl,
                            "text-blue-500",
                            fastpikLinkVisibility.mode === "both" &&
                              fastpikLinkVisibility.showFastpik,
                        )}
                    {!fastpikLinkVisibility.showFastpik &&
                        !fastpikLinkVisibility.showDrive &&
                        !booking.video_drive_folder_url && (
                            <p className="text-xs text-muted-foreground">
                                Link Fastpik atau Google Drive belum tersedia untuk booking ini.
                            </p>
                        )}

                    {booking.video_drive_folder_url &&
                        renderGalleryLinkCard(
                            "Video Hasil",
                            booking.video_drive_folder_url,
                            "text-red-500",
                            true,
                        )}

                    <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Sumber data: {fastpikSyncMeta.source}</span>
                        {" · "}
                        <span className="font-medium text-foreground">Sinkron terakhir: {fastpikSyncMeta.syncedAt}</span>
                        {fastpikDataMessage && fastpikDataSource === "fallback" ? (
                            <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                                {fastpikDataMessage}
                            </p>
                        ) : null}
                    </div>

                    {fastpikProjectInfo && (
                        <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Informasi Project Fastpik
                            </p>
                            <InfoRow
                                label="Password"
                                value={
                                    fastpikProjectInfo.password ? (
                                        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                                            <span>{fastpikProjectInfo.password}</span>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className={`${RESPONSIVE_ACTION_BUTTON_CLASS} h-7 px-2`}
                                                onClick={copyFastpikPassword}
                                            >
                                                Salin
                                            </Button>
                                        </div>
                                    ) : (
                                        "-"
                                    )
                                }
                            />
                            <InfoRow
                                label={tBookingDetail("selectionLinkDurationLabel")}
                                value={
                                    fastpikProjectInfo.selection_days !== null
                                        ? `${fastpikProjectInfo.selection_days} hari`
                                        : "Selamanya"
                                }
                            />
                            <InfoRow
                                label="Durasi Link Download"
                                value={
                                    fastpikProjectInfo.download_days !== null
                                        ? `${fastpikProjectInfo.download_days} hari`
                                        : "Selamanya"
                                }
                            />
                            <InfoRow
                                label={tBookingDetail("maxPhotoCountLabel")}
                                value={
                                    fastpikProjectInfo.max_photos !== null
                                        ? `${fastpikProjectInfo.max_photos} foto`
                                        : "-"
                                }
                            />
                        </div>
                    )}

                    {!fastpikLinkVisibility.showFastpik &&
                        !fastpikLinkVisibility.showDrive &&
                        fastpikLinkVisibility.mode === "drive_only" && (
                            <p className="text-xs text-muted-foreground">
                                Mode &quot;Google Drive saja&quot; aktif, tetapi link Google Drive belum tersedia.
                            </p>
                        )}
                </div>
            )}

            {/* Link Portofolio IG */}
            {activeDetailTab === "hasil-jadi" && booking.portfolio_url && (
                <div className="rounded-xl border bg-card p-4 space-y-3 sm:p-6">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Link2 className="w-4 h-4" /> Portofolio Instagram</h3>
                    <div className="flex min-w-0 flex-col gap-2 rounded-lg border bg-muted/30 p-3 text-sm sm:flex-row sm:items-center">
                        <div className="flex min-w-0 items-start gap-2">
                            <Link2 className="mt-0.5 w-4 h-4 text-pink-500 shrink-0" />
                            <a href={booking.portfolio_url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 break-all text-xs text-primary hover:underline sm:truncate">{booking.portfolio_url}</a>
                        </div>
                        <div className="flex shrink-0 justify-end gap-1">
                            <button onClick={() => handleCopyPortfolioLink(booking.portfolio_url!)} className="p-1.5 rounded hover:bg-muted transition-colors cursor-pointer" title="Salin Link">
                                <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => window.open(booking.portfolio_url!, "_blank")} className="p-1.5 rounded hover:bg-muted transition-colors cursor-pointer" title="Buka di Tab Baru">
                                <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* File Klien — Upload ke Google Drive */}
            {activeDetailTab === "hasil-jadi" && isDriveConnected && (
                <div className="rounded-xl border bg-card p-4 space-y-4 sm:p-6">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <FileText className="w-4 h-4" /> File Klien
                    </h3>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <p className="min-w-0 text-xs text-muted-foreground break-words">
                            📁 {driveFolderPathHint}
                        </p>
                        <div className={RESPONSIVE_SECTION_ACTIONS_CLASS}>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className={`${RESPONSIVE_ACTION_BUTTON_CLASS} gap-1.5`}
                                onClick={() => void handleRefreshDrivePathHint()}
                                disabled={refreshingDrivePathHint}
                                title="Refresh path preview dari setting Drive terbaru"
                            >
                                {refreshingDrivePathHint ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                                Re-sync Path
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className={`${RESPONSIVE_ACTION_BUTTON_CLASS} gap-1.5`}
                                onClick={() => window.open(booking.drive_folder_url!, "_blank", "noopener,noreferrer")}
                                disabled={!booking.drive_folder_url}
                            >
                                <ExternalLink className="w-4 h-4" />
                                Buka Folder Google Drive
                            </Button>
                        </div>
                    </div>
                    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                        <input
                            ref={fileInputRef}
                            type="file"
                            onChange={handleUploadClientFile}
                            className="hidden"
                            id="client-file-upload"
                        />
                        <Button
                            variant="outline" size="sm" className={`${RESPONSIVE_ACTION_BUTTON_CLASS} gap-1.5`}
                            disabled={uploadingFile || !canWriteBookings}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            {uploadingFile ? "Mengupload..." : "Upload File"}
                        </Button>
                        <span className="text-[10px] text-muted-foreground">Moodboard, referensi, dll.</span>
                    </div>
                    {uploadedFiles.length > 0 && (
                        <div className="space-y-1">
                            {uploadedFiles.map((f, i) => (
                                <div key={i} className="flex min-w-0 items-center gap-2 p-2 rounded-lg bg-muted/30 border text-xs">
                                    <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 break-all text-primary hover:underline sm:truncate">{f.name}</a>
                                    <button onClick={() => window.open(f.url, "_blank")} className="p-1 rounded hover:bg-muted cursor-pointer" title="Buka">
                                        <ExternalLink className="w-3 h-3" />
                                    </button>
                                    {f.fileId && (
                                        <button
                                            onClick={() => setDeleteFileModal({ open: true, idx: i })}
                                            disabled={deletingFileIdx === i}
                                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 cursor-pointer disabled:opacity-50"
                                            title={tBookingDetail("deleteFileTitle")}
                                        >
                                            {deletingFileIdx === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Status Klien / Tracking */}
            {activeDetailTab === "status-klien" && (
            <div className="rounded-xl border bg-card p-4 space-y-4 sm:p-6">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><ListOrdered className="w-4 h-4" /> Status Klien</h3>

                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Status Booking & Klien</label>
                        <select
                            value={clientStatus}
                            onChange={e => setClientStatus(e.target.value)}
                            disabled={!canWriteBookings}
                            className={`${adminNativeSelectClass} text-sm`}
                        >
                            <option value="">Pilih status...</option>
                            {bookingStatuses.map((statusOption) => (
                                <option key={statusOption} value={statusOption}>{statusOption}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Posisi Antrian (Otomatis)</label>
                        <div className="min-h-9 rounded-md border border-input bg-muted/20 px-3 py-2 text-sm">
                            {queuePositionDisplay}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            Trigger antrian: {normalizedQueueTriggerStatus}
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Deadline Project</label>
                        <input
                            type="date"
                            value={projectDeadlineDate}
                            onChange={event => setProjectDeadlineDate(event.target.value)}
                            disabled={!canWriteBookings}
                            className={adminNativeSelectClass}
                        />
                        {effectiveProjectDeadlineDate ? (
                            <div className="space-y-1">
                                {projectDeadlineCountdown ? (
                                    <span className={getAdminDeadlineBadgeClassName(effectiveProjectDeadlineDate)}>
                                        {projectDeadlineCountdown}
                                    </span>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <Button
                        size="sm"
                        onClick={() => { void handleSaveClientStatus(); }}
                        disabled={savingStatus || !canWriteBookings}
                        className={`${RESPONSIVE_ACTION_BUTTON_CLASS} gap-1.5`}
                    >
                        {savingStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        Simpan Status & Deadline
                    </Button>
                    {statusSaved && <span className="text-xs text-green-600 dark:text-green-400">Tersimpan!</span>}
                </div>

                {booking.tracking_uuid && (
                    <div className="flex min-w-0 flex-col gap-2 rounded-lg border bg-muted/30 p-3 text-sm sm:flex-row sm:items-center">
                        <div className="flex min-w-0 items-start gap-2">
                            <Link2 className="mt-0.5 w-4 h-4 shrink-0 text-emerald-500" />
                            <span className="min-w-0 flex-1 break-all text-xs text-muted-foreground sm:truncate">{trackingLink}</span>
                        </div>
                        <div className="flex shrink-0 justify-end gap-1">
                            <button
                                type="button"
                                onClick={() => { void copyTrackingLink(); }}
                                className="p-1.5 rounded hover:bg-muted transition-colors cursor-pointer"
                                title="Salin Link"
                            >
                                <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => window.open(trackingLink, "_blank", "noopener,noreferrer")}
                                className="p-1.5 rounded hover:bg-muted transition-colors cursor-pointer"
                                title="Buka di Tab Baru"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
            )}
        </div>

            {/* Delete File Confirmation Modal */}
            <Dialog open={deleteFileModal.open} onOpenChange={(o) => !o && setDeleteFileModal({ open: false, idx: null })}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader className="items-center text-center">
                        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-2">
                            <AlertCircle className="w-6 h-6 text-red-600" />
                        </div>
                        <DialogTitle className="text-xl">{tBookingDetail("deleteFileTitle")}</DialogTitle>
                        <DialogDescription>
                            Yakin ingin menghapus file <strong>&quot;{deleteFileModal.idx != null ? uploadedFiles[deleteFileModal.idx!]?.name : ""}&quot;</strong> dari Google Drive? Tindakan ini tidak dapat dibatalkan.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="sm:justify-center gap-2 pt-2">
                        <Button variant="outline" className="flex-1" onClick={() => setDeleteFileModal({ open: false, idx: null })}>Batal</Button>
                        <Button variant="destructive" className="flex-1" onClick={() => { if (deleteFileModal.idx !== null) handleDeleteClientFile(deleteFileModal.idx); }}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            {tBookingDetail("deleteFileConfirm")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* WA Freelance Popup */}
            <Dialog open={waFreelancePopup} onOpenChange={setWaFreelancePopup}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Pilih Freelance</DialogTitle>
                        <DialogDescription>
                            Pilih freelance untuk dikirim pesan WhatsApp.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        {booking.booking_freelancers.map(f => (
                            <button
                                key={f.id}
                                onClick={() => {
                                    setWaFreelancePopup(false);
                                    sendWAFreelance(f.whatsapp_number, f.name);
                                }}
                                className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left cursor-pointer"
                            >
                                <Phone className="w-4 h-4 text-blue-600 shrink-0" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium">{f.name}</p>
                                    <p className="text-xs text-muted-foreground">{f.whatsapp_number || "No WA"}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={customAddonOpen} onOpenChange={setCustomAddonOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Tambah Add-on Custom</DialogTitle>
                        <DialogDescription>
                            Add-on custom akan otomatis disimpan ke katalog Layanan / Paket sebagai add-on aktif.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Nama Add-on</label>
                            <input
                                value={customAddonName}
                                onChange={(e) => setCustomAddonName(e.target.value)}
                                placeholder={tBookingDetail("customAddonNameExample")}
                                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Harga</label>
                            <input
                                type="number"
                                min={0}
                                value={customAddonPrice}
                                onChange={(e) => setCustomAddonPrice(e.target.value)}
                                placeholder="250000"
                                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Deskripsi / Catatan</label>
                            <textarea
                                value={customAddonDescription}
                                onChange={(e) => setCustomAddonDescription(e.target.value)}
                                rows={3}
                                placeholder={tBookingDetail("customAddonDescriptionExample")}
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCustomAddonOpen(false)}>Batal</Button>
                        <Button onClick={() => { void handleCreateCustomAddon(); }} disabled={creatingCustomAddon}>
                            {creatingCustomAddon ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Simpan ke Katalog
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <CancelStatusPaymentDialog
                open={cancelStatusConfirmOpen}
                onOpenChange={setCancelStatusConfirmOpen}
                bookingName={booking.client_name}
                maxRefundAmount={Math.max(booking.dp_verified_amount || 0, 0)}
                loading={savingStatus}
                onConfirm={({ policy, refundAmount }) => {
                    void handleSaveClientStatus({
                        skipCancelConfirmation: true,
                        cancelPayment: { policy, refundAmount },
                    });
                }}
            />

            <ActionFeedbackDialog
                open={feedbackDialog.open}
                onOpenChange={(open) => {
                    setFeedbackDialog((prev) => ({ ...prev, open }));
                    if (!open && pendingRedirect) {
                        const targetPath = pendingRedirect;
                        setPendingRedirect(null);
                        router.push(targetPath);
                        router.refresh();
                    }
                }}
                title={feedbackDialog.title}
                message={feedbackDialog.message}
                confirmLabel="OK"
            />

            <ActionConfirmDialog
                open={deleteProofDialog.open}
                onOpenChange={(open) =>
                    setDeleteProofDialog((prev) => ({
                        open,
                        stage: open ? prev.stage : null,
                    }))
                }
                title={tBookingDetail("deleteProofConfirmTitle")}
                message={
                    deleteProofDialog.stage === "final"
                        ? tBookingDetail("deleteFinalProofConfirmMessage")
                        : tBookingDetail("deleteInitialProofConfirmMessage")
                }
                cancelLabel={tBookingDetail("cancelAction")}
                confirmLabel={
                    deletingProofStage
                        ? tBookingDetail("deletingProof")
                        : tBookingDetail("confirmDeleteProof")
                }
                onConfirm={() => { void handleDeletePaymentProof(); }}
                confirmVariant="destructive"
                loading={deletingProofStage !== null}
            />

            <ActionConfirmDialog
                open={archiveBookingDialogOpen}
                onOpenChange={setArchiveBookingDialogOpen}
                title={isArchivedBooking(booking)
                    ? (locale === "en" ? "Restore this booking?" : "Kembalikan booking ini?")
                    : (locale === "en" ? "Archive this booking?" : "Arsipkan booking ini?")}
                message={isArchivedBooking(booking)
                    ? (locale === "en"
                        ? "This booking will appear again in the active Booking, Booking Status, and Invoice & Settlement lists."
                        : "Booking ini akan muncul lagi di daftar aktif Booking, Status Booking, dan Invoice & Pelunasan.")
                    : (locale === "en"
                        ? "This booking will be removed from the active Booking, Booking Status, and Invoice & Settlement lists. Public tracking, invoice, and settlement links will stay active."
                        : "Booking ini akan hilang dari daftar aktif Booking, Status Booking, dan Invoice & Pelunasan. Link tracking, invoice, dan pelunasan tetap aktif.")}
                cancelLabel={tCommon("batal")}
                confirmLabel={archivingBooking
                    ? (locale === "en" ? "Saving..." : "Menyimpan...")
                    : isArchivedBooking(booking)
                        ? tCommon("kembalikan")
                        : tCommon("arsipkan")}
                onConfirm={() => { void handleArchiveBookingToggle(); }}
                loading={archivingBooking}
            />

            <ActionConfirmDialog
                open={deleteBookingModalOpen}
                onOpenChange={setDeleteBookingModalOpen}
                title={locale === "en" ? "Delete Booking" : tBookingDetail("deleteBookingTitle")}
                message={locale === "en"
                    ? `Delete booking for ${booking.client_name}? Related Google Calendar event(s) and Fastpik project will also be deleted if available.`
                    : `Yakin ingin menghapus booking ${booking.client_name}? Event Google Calendar terkait dan project Fastpik (jika ada) juga akan ikut dihapus.`}
                cancelLabel={locale === "en" ? "Cancel" : "Batal"}
                confirmLabel={deletingBooking ? (locale === "en" ? "Deleting..." : "Menghapus...") : (locale === "en" ? "Yes, Delete" : tBookingDetail("deleteBookingConfirm"))}
                onConfirm={() => { void handleDeleteBooking(); }}
                confirmVariant="destructive"
                loading={deletingBooking}
            />
        </>
    );
}
