"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Edit2, MessageSquare, Phone, Folder, FolderPlus, Loader2, MapPin, Instagram, Navigation, Link2, Copy, ClipboardCheck, ListOrdered, ExternalLink, Upload, FileText, Trash2, AlertCircle, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { Link } from "@/i18n/routing";
import { useLocale } from "next-intl";
import { formatSessionDate, formatSessionTime, formatTemplateSessionDate } from "@/utils/format-date";
import {
    buildCustomFieldTemplateVars,
    extractBuiltInExtraFieldValues,
    extractCustomFieldSnapshots,
    type CustomFieldSnapshot,
} from "@/components/form-builder/booking-form-layout";
import { buildExtraFieldTemplateVars } from "@/utils/form-extra-fields";
import { buildDriveImageUrl, type PaymentSource } from "@/lib/payment-config";
import {
    getFinalAdjustmentsTotal,
    getFinalInvoiceTotal,
    getInvoiceStage,
    getRemainingFinalPayment,
    getSettlementLabel,
    getSettlementStatus,
    normalizeFinalAdjustments,
    type FinalAdjustment,
    type SettlementStatus,
} from "@/lib/final-settlement";
import {
    fillWhatsAppTemplate,
    getWhatsAppTemplateContent,
    normalizeWhatsAppNumber,
} from "@/lib/whatsapp-template";
import {
    getBookingServiceLabel,
    normalizeBookingServiceSelections,
    type BookingServiceSelection,
} from "@/lib/booking-services";
import { buildDriveFolderPathSegments } from "@/lib/drive-folder-structure";

const EXTRA_FIELD_LABELS: Record<string, string> = {
    universitas: "Universitas",
    fakultas: "Fakultas",
    nama_pasangan: "Nama Pasangan",
    instagram_pasangan: "Instagram Pasangan",
    tempat_akad: "Lokasi Akad",
    tempat_resepsi: "Lokasi Resepsi",
    tanggal_akad: "Tanggal Akad",
    tanggal_resepsi: "Tanggal Resepsi",
    usia_kehamilan: "Usia Kehamilan",
    gender_bayi: "Gender Bayi",
    nama_bayi: "Nama Bayi",
    tanggal_lahir: "Tanggal Lahir",
    nama_brand: "Nama Brand",
    tipe_konten: "Tipe Konten",
    jumlah_anggota: "Jumlah Anggota",
    jumlah_tamu: "Estimasi Tamu",
};

const LOCATION_FIELDS = new Set(["tempat_akad", "tempat_resepsi"]);

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
    is_fully_paid: boolean;
    payment_proof_url: string | null;
    payment_proof_drive_file_id: string | null;
    drive_folder_url: string | null;
    portfolio_url: string | null;
    location: string | null;
    location_detail: string | null;
    instagram: string | null;
    event_type: string | null;
    notes: string | null;
    extra_fields: Record<string, unknown> | null;
    payment_method: string | null;
    payment_source: PaymentSource | null;
    settlement_status: string | null;
    final_adjustments: unknown;
    final_payment_proof_url: string | null;
    final_payment_proof_drive_file_id: string | null;
    final_payment_amount: number;
    final_payment_method: string | null;
    final_payment_source: PaymentSource | null;
    final_paid_at: string | null;
    final_invoice_sent_at: string | null;
    services: { id: string; name: string; price: number; is_addon?: boolean | null } | null;
    freelancers: FreelancerDetail | null; // old single FK
    booking_freelancers: FreelancerDetail[]; // new junction
    tracking_uuid: string | null;
    client_status: string | null;
    queue_position: number | null;
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
        <div className="flex items-start gap-3 text-sm">
            <span className="text-muted-foreground w-40 shrink-0">{label}</span>
            <span className="flex-1">{value}</span>
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

function LocationValue({ address }: { address: string }) {
    const mapsUrl = `https://maps.google.com/maps?q=${encodeURIComponent(address)}`;
    const dirUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    return (
        <span className="flex items-start gap-1.5">
            <span className="flex-1">{address}</span>
            <span className="flex gap-1 shrink-0 mt-0.5">
                <button type="button" onClick={() => window.open(mapsUrl, "_blank")} title="Buka di Google Maps"
                    className="text-blue-600 hover:text-blue-700 transition-colors inline-flex items-center justify-center w-6 h-6 rounded hover:bg-blue-50 dark:hover:bg-blue-500/10">
                    <MapPin className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => window.open(dirUrl, "_blank")} title="Direction"
                    className="text-green-600 hover:text-green-700 transition-colors inline-flex items-center justify-center w-6 h-6 rounded hover:bg-green-50 dark:hover:bg-green-500/10">
                    <Navigation className="w-3.5 h-3.5" />
                </button>
            </span>
        </span>
    );
}

function PaymentProofPanel({
    title,
    url,
    driveFileId,
    alt,
    linkLabel,
}: {
    title: string;
    url: string;
    driveFileId: string | null;
    alt: string;
    linkLabel: string;
}) {
    const previewSrc = driveFileId ? buildDriveImageUrl(driveFileId) : url;
    const [previewFailed, setPreviewFailed] = React.useState(false);

    React.useEffect(() => {
        setPreviewFailed(false);
    }, [previewSrc]);

    return (
        <div className="rounded-xl border bg-card p-6 space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4" /> {title}
            </h3>
            {!previewFailed ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={previewSrc}
                        alt={alt}
                        onError={() => setPreviewFailed(true)}
                        className="max-w-sm w-full rounded-lg border bg-muted/20 shadow-sm"
                    />
                </a>
            ) : (
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                    <div className="min-w-0">
                        <p className="text-sm font-medium">{linkLabel}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{url}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 shrink-0 text-muted-foreground" />
                </a>
            )}
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
    return service.event_types.includes(eventType);
}

export default function BookingDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const supabase = createClient();
    const locale = useLocale();
    const [booking, setBooking] = React.useState<Booking | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [creatingFolder, setCreatingFolder] = React.useState(false);
    const [isDriveConnected, setIsDriveConnected] = React.useState(false);
    const [clientStatus, setClientStatus] = React.useState("");
    const [queuePos, setQueuePos] = React.useState<number | "">(0);
    const [savingStatus, setSavingStatus] = React.useState(false);
    const [statusSaved, setStatusSaved] = React.useState(false);
    const [bookingStatuses, setBookingStatuses] = React.useState<string[]>(["Pending", "DP", "Terjadwal", "Selesai", "Edit", "Batal"]);
    const [copiedTrack, setCopiedTrack] = React.useState(false);
    const [studioName, setStudioName] = React.useState("");
    const [driveFolderPathHint, setDriveFolderPathHint] = React.useState("Data Booking Client Desk > {client_name} > File Client");
    const [savedTemplates, setSavedTemplates] = React.useState<{ id: string; type: string; content: string; content_en: string; event_type: string | null }[]>([]);
    const [adjustmentItems, setAdjustmentItems] = React.useState<EditableAdjustment[]>([]);
    const [addonServices, setAddonServices] = React.useState<AddonService[]>([]);
    const [savingAdjustments, setSavingAdjustments] = React.useState(false);
    const [sendingFinalInvoice, setSendingFinalInvoice] = React.useState(false);
    const [markingFinalPaid, setMarkingFinalPaid] = React.useState(false);
    const [markingFinalUnpaid, setMarkingFinalUnpaid] = React.useState(false);
    const [editingDp, setEditingDp] = React.useState(false);
    const [dpInput, setDpInput] = React.useState("");
    const [savingDp, setSavingDp] = React.useState(false);
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
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const currentDpValue = booking?.dp_paid ?? 0;

    React.useEffect(() => {
        setDpInput(String(currentDpValue));
    }, [currentDpValue]);

    React.useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [{ data }, { data: profile }, { data: addonServiceRows }] = await Promise.all([
                supabase.from("bookings")
                    .select("id, booking_code, client_name, client_whatsapp, session_date, status, total_price, dp_paid, drive_folder_url, portfolio_url, payment_proof_url, payment_proof_drive_file_id, payment_method, payment_source, settlement_status, final_adjustments, final_payment_proof_url, final_payment_proof_drive_file_id, final_payment_amount, final_payment_method, final_payment_source, final_paid_at, final_invoice_sent_at, location, location_detail, instagram, event_type, notes, extra_fields, tracking_uuid, client_status, queue_position, services(id, name, price, is_addon), booking_services(id, kind, sort_order, service:services(id, name, price, is_addon)), freelance(id, name, whatsapp_number), booking_freelance(freelance_id, freelance(id, name, whatsapp_number))")
                    .eq("id", id).single(),
                supabase.from("profiles").select("google_drive_access_token, studio_name, custom_statuses, drive_folder_format, drive_folder_format_map, drive_folder_structure_map").eq("id", user.id).single(),
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
            const normalized = rawBooking ? {
                ...rawBooking,
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
            setAdjustmentItems(
                toEditableAdjustments(
                    normalizeFinalAdjustments(rawBooking?.final_adjustments),
                ),
            );
            setAddonServices((addonServiceRows || []) as AddonService[]);
            if (rawBooking) {
                const syncedStatus = rawBooking.status || rawBooking.client_status || "";
                setClientStatus(syncedStatus);
                setQueuePos(rawBooking.queue_position || "");
                if (rawBooking.client_status !== syncedStatus) {
                    await supabase.from("bookings").update({ client_status: syncedStatus }).eq("id", id);
                }
                // Generate tracking_uuid if not set
                if (!rawBooking.tracking_uuid) {
                    const uuid = crypto.randomUUID();
                    await supabase.from("bookings").update({ tracking_uuid: uuid }).eq("id", id);
                    setBooking(prev => prev ? { ...prev, tracking_uuid: uuid } : prev);
                }
            }
            if (profile?.google_drive_access_token) setIsDriveConnected(true);
            if (profile?.studio_name) setStudioName(profile.studio_name);
            if (profile?.custom_statuses) {
                setBookingStatuses(profile.custom_statuses as string[]);
            }
            if (rawBooking) {
                const folderPathSegments = buildDriveFolderPathSegments({
                    structureMap: (profile as any)?.drive_folder_structure_map,
                    legacyFormat: (profile as any)?.drive_folder_format,
                    legacyFormatMap: (profile as any)?.drive_folder_format_map,
                    studioName: profile?.studio_name,
                    bookingCode: rawBooking.booking_code,
                    clientName: rawBooking.client_name,
                    eventType: rawBooking.event_type,
                    sessionDate: rawBooking.session_date,
                    extraFields: rawBooking.extra_fields,
                });
                setDriveFolderPathHint(
                    ["Data Booking Client Desk", ...folderPathSegments, "File Client"].join(" > "),
                );
            }
            setLoading(false);
        }

        async function fetchTemplates() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase.from("templates").select("id, type, name, content, content_en, event_type").eq("user_id", user.id);
            setSavedTemplates((data || []) as { id: string; type: string; content: string; content_en: string; event_type: string | null }[]);
        }
        load();
        fetchTemplates();
    }, [id, supabase]);

    async function handleSaveClientStatus() {
        if (!booking) return;
        setSavingStatus(true);
        await supabase.from("bookings").update({
            status: clientStatus || booking.status,
            client_status: clientStatus || booking.status,
            queue_position: queuePos === "" ? null : Number(queuePos),
        }).eq("id", booking.id);
        setBooking((prev) =>
            prev
                ? {
                    ...prev,
                    status: clientStatus || prev.status,
                    client_status: clientStatus || prev.status,
                    queue_position: queuePos === "" ? null : Number(queuePos),
                }
                : prev,
        );
        setStatusSaved(true);
        setTimeout(() => setStatusSaved(false), 2000);
        setSavingStatus(false);
    }

    async function handleSaveDp() {
        if (!booking) return;
        const nextDp = Number(dpInput);
        if (!Number.isFinite(nextDp) || nextDp < 0) {
            alert("Nominal DP harus 0 atau lebih.");
            return;
        }

        setSavingDp(true);
        const nextFinalPaymentAmount = booking.is_fully_paid
            ? Math.max(getFinalInvoiceTotal(booking.total_price, booking.final_adjustments) - nextDp, 0)
            : booking.final_payment_amount;

        const { error } = await supabase
            .from("bookings")
            .update({
                dp_paid: nextDp,
                final_payment_amount: nextFinalPaymentAmount,
            })
            .eq("id", booking.id);

        if (error) {
            alert("Gagal menyimpan DP.");
            setSavingDp(false);
            return;
        }

        setBooking((prev) => prev ? {
            ...prev,
            dp_paid: nextDp,
            final_payment_amount: nextFinalPaymentAmount,
        } : prev);
        setEditingDp(false);
        setSavingDp(false);
    }

    function copyTrackingLink() {
        if (!booking?.tracking_uuid) return;
        const url = `${window.location.origin}/${locale}/track/${booking.tracking_uuid}`;
        navigator.clipboard.writeText(url);
        setCopiedTrack(true);
        setTimeout(() => setCopiedTrack(false), 2000);
    }

    const formatDate = (d: string | null) => {
        if (!d) return "-";
        return formatSessionDate(d, { locale: locale === "en" ? "en" : "id" });
    };

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);

    function sendWA(phone: string | null, name: string) {
        if (!phone) return;
        const cleaned = normalizeWhatsAppNumber(phone);
        // Use client template if available
        const content = getWhatsAppTemplateContent(
            savedTemplates,
            "whatsapp_client",
            locale,
        );
        let msg: string;
        if (content.trim()) {
            const vars: Record<string, string> = {
                client_name: booking?.client_name || name,
                booking_code: booking?.booking_code || "",
                session_date: booking?.session_date ? formatTemplateSessionDate(booking.session_date, { locale: locale === "en" ? "en" : "id" }) : "-",
                service_name: booking?.service_label || booking?.services?.name || "-",
                total_price: formatCurrency(finalInvoiceTotal || booking?.total_price || 0),
                dp_paid: formatCurrency(booking?.dp_paid || 0),
                studio_name: studioName || "",
                event_type: booking?.event_type || "-",
                location: booking?.location || "-",
                location_maps_url: booking?.location ? `https://maps.google.com/maps?q=${encodeURIComponent(booking.location)}` : "-",
                detail_location: booking?.location_detail || "-",
                notes: booking?.notes || "-",
                tracking_link: trackingLink || "-",
                invoice_url: `${window.location.origin}/api/public/invoice?code=${encodeURIComponent(booking?.booking_code || "")}&lang=${locale}&stage=${activeInvoiceStage}`,
            };
            msg = fillWhatsAppTemplate(content, vars);
        } else {
            msg = `Halo ${name}, terima kasih telah booking di studio kami!`;
        }
        window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${encodeURIComponent(msg)}`, "_blank");
    }

    function sendWAFreelance(phone: string | null, fname: string) {
        if (!phone) { alert("Nomor Whatsapp freelance tidak tersedia."); return; }
        const cleaned = normalizeWhatsAppNumber(phone);
        const sessionStr = booking?.session_date ? formatTemplateSessionDate(booking.session_date, { locale: locale === "en" ? "en" : "id" }) : "-";
        const sessionTime = booking?.session_date ? formatSessionTime(booking.session_date) : "-";
        // Use freelancer template if available
        const content = getWhatsAppTemplateContent(
            savedTemplates,
            "whatsapp_freelancer",
            locale,
            booking?.event_type,
        );
        let msg: string;
        if (content.trim()) {
            const vars: Record<string, string> = {
                freelancer_name: fname,
                client_name: booking?.client_name || "",
                client_whatsapp: booking?.client_whatsapp || "",
                booking_code: booking?.booking_code || "",
                session_date: sessionStr,
                session_time: sessionTime,
                service_name: booking?.service_label || booking?.services?.name || "-",
                studio_name: studioName || "",
                event_type: booking?.event_type || "-",
                location: booking?.location || "-",
                location_maps_url: booking?.location ? `https://maps.google.com/maps?q=${encodeURIComponent(booking.location)}` : "-",
                detail_location: booking?.location_detail || "-",
                notes: booking?.notes || "-",
                ...buildExtraFieldTemplateVars(booking?.extra_fields),
                ...buildCustomFieldTemplateVars(booking?.extra_fields),
            };
            msg = fillWhatsAppTemplate(content, vars);
        } else {
            msg = `Halo ${fname}, kamu dijadwalkan sesi foto bersama klien ${booking?.client_name} (${booking?.booking_code}) pada ${sessionStr}. Mohon konfirmasi kehadiranmu. Terima kasih!`;
        }
        window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${encodeURIComponent(msg)}`, "_blank");
    }

    async function handleCreateFolder() {
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
            alert(result.error || "Gagal membuat folder.");
        }
        setCreatingFolder(false);
    }

    async function handleUploadClientFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !booking) return;
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
            const result = await res.json();
            if (result.success && result.fileUrl) {
                setUploadedFiles(prev => [...prev, { name: result.fileName, url: result.fileUrl, fileId: result.fileId }]);
                // Update drive_folder_url if it was set by the API
                if (!booking.drive_folder_url && result.folderUrl) {
                    setBooking(prev => prev ? { ...prev, drive_folder_url: result.folderUrl } : prev);
                }
            } else {
                alert(result.error || "Gagal upload file.");
            }
        } catch {
            alert("Gagal upload file.");
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
                alert(result.error || "Gagal hapus file.");
            }
        } catch {
            alert("Gagal hapus file.");
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
            alert("Gagal menyimpan add-on pelunasan.");
            return null;
        }

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
        if (!booking || !customAddonName.trim() || Number(customAddonPrice) <= 0) {
            alert("Isi nama dan harga add-on custom terlebih dahulu.");
            return;
        }

        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) {
            alert("Sesi login tidak ditemukan.");
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
                event_types: booking.event_type ? [booking.event_type] : null,
            })
            .select("id, name, price, description, event_types")
            .single();
        setCreatingCustomAddon(false);

        if (error || !data) {
            alert("Gagal membuat add-on custom.");
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
        if (!booking?.tracking_uuid || !booking.client_whatsapp) {
            alert("Booking ini belum punya tracking link atau nomor WhatsApp klien.");
            return;
        }

        setSendingFinalInvoice(true);
        const normalizedAdjustments = await saveFinalAdjustments("sent");
        if (!normalizedAdjustments) {
            setSendingFinalInvoice(false);
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
            alert("Gagal mengirim invoice final.");
            return;
        }

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
        const templateContent = getWhatsAppTemplateContent(
            savedTemplates,
            "whatsapp_settlement_client",
            locale,
        );
        const message = templateContent.trim()
            ? fillWhatsAppTemplate(templateContent, {
                client_name: booking.client_name,
                booking_code: booking.booking_code,
                session_date: booking.session_date ? formatTemplateSessionDate(booking.session_date, { locale: locale === "en" ? "en" : "id" }) : "-",
                service_name: booking.service_label || booking.services?.name || "-",
                total_price: formatCurrency(booking.total_price),
                dp_paid: formatCurrency(booking.dp_paid),
                final_total: formatCurrency(finalTotal),
                adjustments_total: formatCurrency(getFinalAdjustmentsTotal(normalizedAdjustments)),
                remaining_payment: formatCurrency(remainingFinal),
                studio_name: studioName || "",
                event_type: booking.event_type || "-",
                location: booking.location || "-",
                tracking_link: booking.tracking_uuid ? `${window.location.origin}/${locale}/track/${booking.tracking_uuid}` : "-",
                invoice_url: invoiceUrl,
                settlement_link: settlementUrl,
            })
            : `Halo ${booking.client_name}, invoice final untuk booking ${booking.booking_code} sudah kami siapkan.\n\n` +
                `Paket: ${booking.service_label || booking.services?.name || "-"}\n` +
                `Total awal: ${formatCurrency(booking.total_price)}\n` +
                `Add-on akhir: ${formatCurrency(getFinalAdjustmentsTotal(normalizedAdjustments))}\n` +
                `Total final: ${formatCurrency(finalTotal)}\n` +
                `DP terbayar: ${formatCurrency(booking.dp_paid)}\n` +
                `Sisa pelunasan: ${formatCurrency(remainingFinal)}\n\n` +
                `Invoice final: ${invoiceUrl}\n` +
                `Form pelunasan: ${settlementUrl}\n\n` +
                `Silakan lakukan pelunasan dan upload bukti bayar melalui link di atas. Terima kasih.`;

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

        window.open(
            `https://api.whatsapp.com/send?phone=${cleaned}&text=${encodeURIComponent(message)}`,
            "_blank",
        );
    }

    async function handleMarkFinalPaid() {
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
            alert("Gagal menandai booking sebagai lunas.");
            return;
        }

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
            alert("Gagal membatalkan status lunas.");
            return;
        }

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
    const finalInvoiceTotal = getFinalInvoiceTotal(booking.total_price, finalAdjustments);
    const verifiedFinalPayment = booking.final_paid_at ? booking.final_payment_amount || 0 : 0;
    const initialPaymentStatus = booking.is_fully_paid
        ? "Lunas"
        : booking.dp_paid > 0
            ? "DP Dibayar"
            : "Belum Dibayar";
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
    const trackingLink = booking.tracking_uuid ? `${window.location.origin}/${locale}/track/${booking.tracking_uuid}` : "";
    const settlementLink = booking.tracking_uuid ? `${window.location.origin}/${locale}/settlement/${booking.tracking_uuid}` : "";
    const builtInExtraFields = extractBuiltInExtraFieldValues(booking.extra_fields);
    const extraEntries = Object.entries(builtInExtraFields);
    const customFieldSnapshots = extractCustomFieldSnapshots(booking.extra_fields);
    const customFieldsBySection = groupCustomSnapshotsBySection(customFieldSnapshots);

    // Separate nama_pasangan from other extra fields (show right after Nama for Wedding)
    const namaPasangan = builtInExtraFields.nama_pasangan;
    const otherExtraEntries = extraEntries.filter(([key]) => key !== "nama_pasangan");

    return (
        <>
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Link href="/bookings">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </Link>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-2xl font-bold tracking-tight">{booking.client_name}</h2>
                            <StatusBadge status={booking.status} />
                        </div>
                        <p className="text-muted-foreground text-sm">
                            {booking.booking_code}
                            {booking.event_type && booking.event_type !== "Umum" ? ` · ${booking.event_type}` : ""}
                        </p>
                    </div>
                </div>
                <Link href={`/bookings/${booking.id}/edit`}>
                    <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
                        <Edit2 className="w-4 h-4" /> Edit
                    </Button>
                </Link>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => sendWA(booking.client_whatsapp, booking.client_name)}>
                    <MessageSquare className="w-4 h-4 text-green-600" /> Whatsapp Klien
                </Button>
                {booking.booking_freelancers.length > 0 && (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
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
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.open(booking.drive_folder_url!, "_blank")}>
                        <Folder className="w-4 h-4 text-yellow-600" /> Buka Drive Folder
                    </Button>
                ) : (
                    <Button variant="outline" size="sm" className="gap-1.5" disabled={!isDriveConnected || creatingFolder} onClick={handleCreateFolder}>
                        {creatingFolder ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4 text-yellow-600" />}
                        Buat Drive Folder
                    </Button>
                )}
            </div>

            {/* Informasi Klien */}
            <div className="rounded-xl border bg-card p-6 space-y-3">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Informasi Klien</h3>
                <InfoRow label="Nama" value={booking.client_name} />
                {namaPasangan && (
                    <InfoRow label="Nama Pasangan" value={namaPasangan} />
                )}
                <InfoRow label="WhatsApp" value={booking.client_whatsapp || "-"} />
                {booking.instagram && (
                    <InfoRow label="Instagram" value={
                        <a href={`https://instagram.com/${booking.instagram.replace("@", "")}`} target="_blank" rel="noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1">
                            <Instagram className="w-3.5 h-3.5" /> {booking.instagram}
                        </a>
                    } />
                )}
                {booking.event_type && booking.event_type !== "Umum" && (
                    <InfoRow label="Tipe Acara" value={booking.event_type} />
                )}
                {otherExtraEntries.map(([key, val]) => (
                    <InfoRow key={key} label={EXTRA_FIELD_LABELS[key] || key} value={
                        LOCATION_FIELDS.has(key) ? <LocationValue address={val} /> : val
                    } />
                ))}
                {(customFieldsBySection.client_info || []).map((field) => (
                    <InfoRow key={field.id} label={field.label} value={field.value} />
                ))}
            </div>

            {/* Detail Sesi */}
            <div className="rounded-xl border bg-card p-6 space-y-3">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Detail Sesi</h3>
                <InfoRow label="Jadwal" value={formatDate(booking.session_date)} />
                {booking.location && (
                    <InfoRow label="Lokasi" value={<LocationValue address={booking.location} />} />
                )}
                {booking.location_detail && (
                    <InfoRow label="Detail Lokasi" value={booking.location_detail} />
                )}
                <InfoRow label="Paket" value={booking.service_label || booking.services?.name || "-"} />
                <InfoRow label="Freelance" value={
                    booking.booking_freelancers.length > 0
                        ? booking.booking_freelancers.map(f => f.name).join(", ")
                        : "-"
                } />
                {(customFieldsBySection.session_details || []).map((field) => (
                    <InfoRow key={field.id} label={field.label} value={field.value} />
                ))}
            </div>

            {/* Keuangan */}
            <div className="rounded-xl border bg-card p-6 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Keuangan</h3>
                    <Link href="/finance">
                        <Button variant="outline" size="sm" className="gap-1.5">
                            <ExternalLink className="w-4 h-4" />
                            Buka Keuangan
                        </Button>
                    </Link>
                </div>
                <InfoRow label="Status Pembayaran Awal" value={initialPaymentStatus} />
                <InfoRow label="Status Pelunasan" value={getSettlementLabel(settlementStatus)} />
                <InfoRow label="Total Awal" value={<span className="font-semibold">{formatCurrency(booking.total_price)}</span>} />
                <InfoRow label="Addon Akhir" value={formatCurrency(finalAdjustmentsTotal)} />
                <InfoRow label="Total Final" value={<span className="font-semibold">{formatCurrency(finalInvoiceTotal)}</span>} />
                <InfoRow
                    label="DP Dibayar"
                    value={editingDp ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <input
                                type="number"
                                min={0}
                                value={dpInput}
                                onChange={(e) => setDpInput(e.target.value)}
                                className="h-9 w-40 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                            />
                            <Button size="sm" onClick={() => { void handleSaveDp(); }} disabled={savingDp}>
                                {savingDp ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan"}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
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
                        <div className="flex flex-wrap items-center gap-2">
                            <span>{formatCurrency(booking.dp_paid)}</span>
                            <Button variant="outline" size="sm" className="h-8 px-2.5" onClick={() => setEditingDp(true)}>
                                Edit DP
                            </Button>
                        </div>
                    )}
                />
                <InfoRow label="Pelunasan Terverifikasi" value={formatCurrency(verifiedFinalPayment)} />
                <InfoRow label="Metode Pembayaran" value={formatPaymentMethod(booking.payment_method)} />
                <InfoRow label="Sumber Pembayaran" value={formatPaymentSource(booking.payment_source)} />
                <InfoRow label="Sisa" value={
                    <span className={remaining > 0 ? "font-semibold text-amber-600 dark:text-amber-400" : "font-semibold text-green-600 dark:text-green-400"}>
                        {formatCurrency(remaining)}
                    </span>
                } />
                {(customFieldsBySection.payment_details || []).map((field) => (
                    <InfoRow key={field.id} label={field.label} value={field.value} />
                ))}
            </div>

            <div className="rounded-xl border bg-card p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Pelunasan Final</h3>
                        <SettlementBadge status={settlementStatus} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link href="/finance">
                            <Button variant="outline" size="sm" className="gap-1.5">
                                <ExternalLink className="w-4 h-4" />
                                Keuangan
                            </Button>
                        </Link>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => window.open(`/api/public/invoice?code=${encodeURIComponent(booking.booking_code)}&lang=${locale}&stage=final`, "_blank")}
                        >
                            <FileText className="w-4 h-4" />
                            Invoice Final
                        </Button>
                        {booking.tracking_uuid && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
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
                            <div key={item.id} className="grid gap-3 rounded-xl border p-4">
                                <div className="grid gap-3 md:grid-cols-[1.6fr_0.6fr_0.8fr_auto]">
                                    <select
                                        value={item.service_id || ""}
                                        onChange={(e) => handleSelectAdjustmentService(item.id, e.target.value)}
                                        className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
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
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>{item.service_id ? "Sumber: katalog add-on" : "Sumber: item manual lama / custom"}</span>
                                    <span>Total item: {formatCurrency(Number(item.amount) || 0)}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => addAdjustmentItem(filteredAddonServices[0])}
                        disabled={filteredAddonServices.length === 0}
                    >
                        <Upload className="w-4 h-4" />
                        Tambah Add-on
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCustomAddonOpen(true)}>
                        <FileText className="w-4 h-4" />
                        Add-on Custom
                    </Button>
                    <Button size="sm" className="gap-1.5" onClick={() => { void saveFinalAdjustments(); }} disabled={savingAdjustments}>
                        {savingAdjustments ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Simpan Add-on
                    </Button>
                </div>

                <div className="rounded-xl bg-muted/30 border p-4 space-y-2 text-sm">
                    <div className="flex justify-between gap-4"><span className="text-muted-foreground">Total Awal</span><span className="font-medium">{formatCurrency(booking.total_price)}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-muted-foreground">Total Add-on Akhir</span><span className="font-medium">{formatCurrency(finalAdjustmentsTotal)}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-muted-foreground">Total Final</span><span className="font-medium">{formatCurrency(finalInvoiceTotal)}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-muted-foreground">DP Dibayar</span><span className="font-medium">- {formatCurrency(booking.dp_paid)}</span></div>
                    <div className="flex justify-between gap-4 border-t pt-2"><span className="font-semibold">Sisa Pelunasan</span><span className="font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(remaining)}</span></div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button size="sm" className="gap-1.5" onClick={handleSendFinalInvoice} disabled={sendingFinalInvoice || !booking.client_whatsapp}>
                        {sendingFinalInvoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                        Kirim Invoice Final
                    </Button>
                    {booking.is_fully_paid ? (
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleMarkFinalUnpaid} disabled={markingFinalUnpaid}>
                            {markingFinalUnpaid ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                            Batal Tandai Lunas
                        </Button>
                    ) : (
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleMarkFinalPaid} disabled={markingFinalPaid}>
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
                    <div className="rounded-lg border p-4 space-y-2 text-sm">
                        <p className="font-medium">Data Pelunasan Masuk</p>
                        <InfoRow label="Metode" value={formatPaymentMethod(booking.final_payment_method)} />
                        <InfoRow label="Sumber" value={formatPaymentSource(booking.final_payment_source)} />
                        <InfoRow label="Nominal" value={formatCurrency(booking.final_payment_amount || 0)} />
                        <InfoRow label="Status" value={getSettlementLabel(settlementStatus)} />
                    </div>
                )}
            </div>

            {/* Bukti Pembayaran Awal */}
            {booking.payment_proof_url && (
                <PaymentProofPanel
                    title="Bukti Pembayaran Awal"
                    url={booking.payment_proof_url}
                    driveFileId={booking.payment_proof_drive_file_id}
                    alt="Bukti Pembayaran Awal"
                    linkLabel="Buka bukti pembayaran awal"
                />
            )}

            {booking.final_payment_proof_url && (
                <PaymentProofPanel
                    title="Bukti Pelunasan Final"
                    url={booking.final_payment_proof_url}
                    driveFileId={booking.final_payment_proof_drive_file_id}
                    alt="Bukti Pelunasan Final"
                    linkLabel="Buka bukti pelunasan final"
                />
            )}

            {/* Catatan */}
            {booking.notes && (
                <div className="rounded-xl border bg-card p-6 space-y-2">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Catatan</h3>
                    <p className="text-sm whitespace-pre-wrap">{booking.notes}</p>
                </div>
            )}

            {/* Link Google Drive */}
            {booking.drive_folder_url && (
                <div className="rounded-xl border bg-card p-6 space-y-3">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Folder className="w-4 h-4" /> Google Drive</h3>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border text-sm">
                        <Link2 className="w-4 h-4 text-blue-500 shrink-0" />
                        <span className="flex-1 truncate text-xs text-muted-foreground">{booking.drive_folder_url}</span>
                        <button onClick={() => { navigator.clipboard.writeText(booking.drive_folder_url!); }} className="p-1.5 rounded hover:bg-muted transition-colors cursor-pointer" title="Salin Link">
                            <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => window.open(booking.drive_folder_url!, "_blank")} className="p-1.5 rounded hover:bg-muted transition-colors cursor-pointer" title="Buka di Tab Baru">
                            <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Link Portofolio IG */}
            {booking.portfolio_url && (
                <div className="rounded-xl border bg-card p-6 space-y-3">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Link2 className="w-4 h-4" /> Portofolio Instagram</h3>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border text-sm">
                        <Link2 className="w-4 h-4 text-pink-500 shrink-0" />
                        <a href={booking.portfolio_url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-xs text-primary hover:underline">{booking.portfolio_url}</a>
                        <button onClick={() => { navigator.clipboard.writeText(booking.portfolio_url!); }} className="p-1.5 rounded hover:bg-muted transition-colors cursor-pointer" title="Salin Link">
                            <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => window.open(booking.portfolio_url!, "_blank")} className="p-1.5 rounded hover:bg-muted transition-colors cursor-pointer" title="Buka di Tab Baru">
                            <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}

            {/* File Klien — Upload ke Google Drive */}
            {isDriveConnected && (
                <div className="rounded-xl border bg-card p-6 space-y-4">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <FileText className="w-4 h-4" /> File Klien
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        📁 {driveFolderPathHint}
                    </p>
                    <div className="flex items-center gap-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            onChange={handleUploadClientFile}
                            className="hidden"
                            id="client-file-upload"
                        />
                        <Button
                            variant="outline" size="sm" className="gap-1.5"
                            disabled={uploadingFile}
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
                                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border text-xs">
                                    <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-primary hover:underline">{f.name}</a>
                                    <button onClick={() => window.open(f.url, "_blank")} className="p-1 rounded hover:bg-muted cursor-pointer" title="Buka">
                                        <ExternalLink className="w-3 h-3" />
                                    </button>
                                    {f.fileId && (
                                        <button
                                            onClick={() => setDeleteFileModal({ open: true, idx: i })}
                                            disabled={deletingFileIdx === i}
                                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 cursor-pointer disabled:opacity-50"
                                            title="Hapus file"
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
            <div className="rounded-xl border bg-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><ListOrdered className="w-4 h-4" /> Status Klien</h3>
                    {booking.tracking_uuid && (
                        <button onClick={copyTrackingLink} className="flex items-center gap-1.5 text-xs text-primary hover:underline cursor-pointer">
                            {copiedTrack ? <ClipboardCheck className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                            {copiedTrack ? "Tersalin!" : "Salin Link Tracking"}
                        </button>
                    )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Status Booking & Klien</label>
                        <select
                            value={clientStatus}
                            onChange={e => setClientStatus(e.target.value)}
                            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] cursor-pointer"
                        >
                            <option value="">Pilih status...</option>
                            {bookingStatuses.map((statusOption) => (
                                <option key={statusOption} value={statusOption}>{statusOption}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Posisi Antrian</label>
                        <input
                            type="number"
                            min={0}
                            value={queuePos}
                            onChange={e => setQueuePos(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                            placeholder="Misal: 3"
                            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button size="sm" onClick={handleSaveClientStatus} disabled={savingStatus} className="gap-1.5">
                        {savingStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        Simpan Status
                    </Button>
                    {statusSaved && <span className="text-xs text-green-600 dark:text-green-400">Tersimpan!</span>}
                </div>

                {booking.tracking_uuid && (
                    <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md break-all">
                        Link klien: {trackingLink}
                    </div>
                )}
            </div>
        </div>

            {/* Delete File Confirmation Modal */}
            <Dialog open={deleteFileModal.open} onOpenChange={(o) => !o && setDeleteFileModal({ open: false, idx: null })}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader className="items-center text-center">
                        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-2">
                            <AlertCircle className="w-6 h-6 text-red-600" />
                        </div>
                        <DialogTitle className="text-xl">Hapus File</DialogTitle>
                        <DialogDescription>
                            Yakin ingin menghapus file <strong>&quot;{deleteFileModal.idx != null ? uploadedFiles[deleteFileModal.idx!]?.name : ""}&quot;</strong> dari Google Drive? Tindakan ini tidak dapat dibatalkan.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="sm:justify-center gap-2 pt-2">
                        <Button variant="outline" className="flex-1" onClick={() => setDeleteFileModal({ open: false, idx: null })}>Batal</Button>
                        <Button variant="destructive" className="flex-1" onClick={() => { if (deleteFileModal.idx !== null) handleDeleteClientFile(deleteFileModal.idx); }}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Ya, Hapus
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
                                placeholder="Contoh: Extra Time 2 Jam"
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
                                placeholder="Contoh: Tambahan album mini atau transport"
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
        </>
    );
}
