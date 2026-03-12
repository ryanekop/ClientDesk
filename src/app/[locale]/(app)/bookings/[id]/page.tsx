"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Edit2, MessageSquare, Phone, Folder, FolderPlus, Loader2, MapPin, Instagram, Navigation, Link2, Copy, ClipboardCheck, ListOrdered, ExternalLink, Upload, FileText, Trash2, AlertCircle, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { Link } from "@/i18n/routing";
import { useLocale } from "next-intl";
import { formatSessionDate } from "@/utils/format-date";

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

type Booking = {
    id: string;
    booking_code: string;
    client_name: string;
    client_whatsapp: string | null;
    session_date: string | null;
    status: string;
    total_price: number;
    dp_paid: number;
    drive_folder_url: string | null;
    portfolio_url: string | null;
    location: string | null;
    location_detail: string | null;
    instagram: string | null;
    event_type: string | null;
    notes: string | null;
    extra_fields: Record<string, string> | null;
    services: { name: string; price: number } | null;
    freelancers: FreelancerDetail | null; // old single FK
    booking_freelancers: FreelancerDetail[]; // new junction
    tracking_uuid: string | null;
    client_status: string | null;
    queue_position: number | null;
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

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3 text-sm">
            <span className="text-muted-foreground w-40 shrink-0">{label}</span>
            <span className="flex-1">{value}</span>
        </div>
    );
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
    const [copiedTrack, setCopiedTrack] = React.useState(false);
    const [studioName, setStudioName] = React.useState("");
    const [savedTemplates, setSavedTemplates] = React.useState<{ id: string; type: string; content: string; content_en: string; event_type: string | null }[]>([]);

    // File upload states
    const [uploadingFile, setUploadingFile] = React.useState(false);
    const [uploadedFiles, setUploadedFiles] = React.useState<{ name: string; url: string; fileId?: string }[]>([]);
    const [deletingFileIdx, setDeletingFileIdx] = React.useState<number | null>(null);
    const [deleteFileModal, setDeleteFileModal] = React.useState<{ open: boolean; idx: number | null }>({ open: false, idx: null });
    const [waFreelancePopup, setWaFreelancePopup] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [{ data }, { data: profile }] = await Promise.all([
                supabase.from("bookings")
                    .select("id, booking_code, client_name, client_whatsapp, session_date, status, total_price, dp_paid, drive_folder_url, portfolio_url, payment_proof_url, location, location_detail, instagram, event_type, notes, extra_fields, tracking_uuid, client_status, queue_position, services(name, price), freelance(id, name, whatsapp_number), booking_freelance(freelance_id, freelance(id, name, whatsapp_number))")
                    .eq("id", id).single(),
                supabase.from("profiles").select("google_drive_access_token, studio_name").eq("id", user.id).single(),
            ]);
            // Normalize freelancers from junction table
            const normalized = data ? {
                ...data,
                booking_freelancers: (() => {
                    const jf = (data as any).booking_freelance?.map((bf: any) => bf.freelance).filter(Boolean) || [];
                    return jf.length > 0 ? jf : (data as any).freelance ? [(data as any).freelance] : [];
                })()
            } : data;
            setBooking(normalized as unknown as Booking);
            if (data) {
                setClientStatus((data as any).client_status || "");
                setQueuePos((data as any).queue_position || "");
                // Generate tracking_uuid if not set
                if (!(data as any).tracking_uuid) {
                    const uuid = crypto.randomUUID();
                    await supabase.from("bookings").update({ tracking_uuid: uuid }).eq("id", id);
                    setBooking(prev => prev ? { ...prev, tracking_uuid: uuid } : prev);
                }
            }
            if (profile?.google_drive_access_token) setIsDriveConnected(true);
            if (profile?.studio_name) setStudioName(profile.studio_name);
            setLoading(false);
        }

        async function fetchTemplates() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase.from("templates").select("id, type, content, content_en, event_type").eq("user_id", user.id);
            setSavedTemplates((data || []) as any[]);
        }
        load();
        fetchTemplates();
    }, [id]);

    async function handleSaveClientStatus() {
        if (!booking) return;
        setSavingStatus(true);
        await supabase.from("bookings").update({
            client_status: clientStatus || null,
            queue_position: queuePos === "" ? null : Number(queuePos),
        }).eq("id", booking.id);
        setStatusSaved(true);
        setTimeout(() => setStatusSaved(false), 2000);
        setSavingStatus(false);
    }

    function copyTrackingLink() {
        if (!booking?.tracking_uuid) return;
        const url = `${window.location.origin}/id/track/${booking.tracking_uuid}`;
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
        const cleaned = phone.replace(/^0/, "62").replace(/[^0-9]/g, "");
        // Use client template if available
        const template = savedTemplates.find(t => t.type === "whatsapp_client");
        let msg: string;
        if (template) {
            const content = locale === "en" ? (template.content_en || template.content) : template.content;
            if (content.trim()) {
                const vars: Record<string, string> = {
                    client_name: booking?.client_name || name,
                    booking_code: booking?.booking_code || "",
                    session_date: booking?.session_date ? formatDate(booking.session_date) : "-",
                    service_name: booking?.services?.name || "-",
                    total_price: formatCurrency(booking?.total_price || 0),
                    dp_paid: formatCurrency(booking?.dp_paid || 0),
                    studio_name: studioName || "",
                    event_type: booking?.event_type || "-",
                    location: booking?.location || "-",
                    location_maps_url: booking?.location ? `https://maps.google.com/maps?q=${encodeURIComponent(booking.location)}` : "-",
                    detail_location: (booking as any)?.location_detail || "-",
                    notes: booking?.notes || "-",
                    tracking_link: booking?.tracking_uuid ? `${window.location.origin}/id/track/${booking.tracking_uuid}` : "-",
                    invoice_url: `${window.location.origin}/api/public/invoice?code=${encodeURIComponent(booking?.booking_code || "")}`,
                };
                msg = content.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`);
            } else {
                msg = `Halo ${name}, terima kasih telah booking di studio kami!`;
            }
        } else {
            msg = `Halo ${name}, terima kasih telah booking di studio kami!`;
        }
        window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${encodeURIComponent(msg)}`, "_blank");
    }

    function sendWAFreelance(phone: string | null, fname: string) {
        if (!phone) { alert("Nomor Whatsapp freelance tidak tersedia."); return; }
        const cleaned = phone.replace(/^0/, "62").replace(/[^0-9]/g, "");
        const sessionStr = booking?.session_date ? formatDate(booking.session_date) : "-";
        // Use freelancer template if available
        const template = savedTemplates.find(t => t.type === "whatsapp_freelancer");
        let msg: string;
        if (template) {
            const content = locale === "en" ? (template.content_en || template.content) : template.content;
            if (content.trim()) {
                const vars: Record<string, string> = {
                    freelancer_name: fname,
                    client_name: booking?.client_name || "",
                    client_whatsapp: booking?.client_whatsapp || "",
                    booking_code: booking?.booking_code || "",
                    session_date: sessionStr,
                    service_name: booking?.services?.name || "-",
                    studio_name: studioName || "",
                    event_type: booking?.event_type || "-",
                    location: booking?.location || "-",
                    location_maps_url: booking?.location ? `https://maps.google.com/maps?q=${encodeURIComponent(booking.location)}` : "-",
                    detail_location: (booking as any)?.location_detail || "-",
                    notes: booking?.notes || "-",
                };
                msg = content.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`);
            } else {
                msg = `Halo ${fname}, kamu dijadwalkan sesi foto bersama klien ${booking?.client_name} (${booking?.booking_code}) pada ${sessionStr}. Mohon konfirmasi kehadiranmu. Terima kasih!`;
            }
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

    if (loading) return (
        <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
    );

    if (!booking) return (
        <div className="text-center py-24 text-muted-foreground">Booking tidak ditemukan.</div>
    );

    const remaining = booking.total_price - booking.dp_paid;
    const extraEntries = booking.extra_fields ? Object.entries(booking.extra_fields).filter(([, v]) => v) : [];

    // Separate nama_pasangan from other extra fields (show right after Nama for Wedding)
    const namaPasangan = booking.extra_fields?.nama_pasangan;
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
                <InfoRow label="Paket" value={booking.services?.name || "-"} />
                <InfoRow label="Freelance" value={
                    booking.booking_freelancers.length > 0
                        ? booking.booking_freelancers.map(f => f.name).join(", ")
                        : "-"
                } />
            </div>

            {/* Keuangan */}
            <div className="rounded-xl border bg-card p-6 space-y-3">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Keuangan</h3>
                <InfoRow label="Harga Total" value={<span className="font-semibold">{formatCurrency(booking.total_price)}</span>} />
                <InfoRow label="DP Dibayar" value={formatCurrency(booking.dp_paid)} />
                <InfoRow label="Sisa" value={
                    <span className={remaining > 0 ? "font-semibold text-amber-600 dark:text-amber-400" : "font-semibold text-green-600 dark:text-green-400"}>
                        {formatCurrency(remaining)}
                    </span>
                } />
            </div>

            {/* Bukti Pembayaran */}
            {(booking as any).payment_proof_url && (
                <div className="rounded-xl border bg-card p-6 space-y-3">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4" /> Bukti Pembayaran
                    </h3>
                    {(booking as any).payment_proof_url.startsWith("http") ? (
                        <a href={(booking as any).payment_proof_url} target="_blank" rel="noopener noreferrer" className="block">
                            <img
                                src={(booking as any).payment_proof_url}
                                alt="Bukti Pembayaran"
                                className="max-w-sm w-full rounded-lg border shadow-sm"
                            />
                        </a>
                    ) : (
                        <a href={(booking as any).payment_proof_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1.5">
                            <ExternalLink className="w-3.5 h-3.5" /> Lihat Bukti Pembayaran
                        </a>
                    )}
                </div>
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
                        📁 Data Booking Client Desk &gt; {booking.client_name} &gt; File Client
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
                        <label className="text-xs font-medium text-muted-foreground">Progress</label>
                        <select
                            value={clientStatus}
                            onChange={e => setClientStatus(e.target.value)}
                            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] cursor-pointer"
                        >
                            <option value="">Pilih status...</option>
                            <option value="Booking Confirmed">Booking Confirmed</option>
                            <option value="Sesi Foto / Acara">Sesi Foto / Acara</option>
                            <option value="Antrian Edit">Antrian Edit</option>
                            <option value="Proses Edit">Proses Edit</option>
                            <option value="Revisi">Revisi</option>
                            <option value="File Siap">File Siap</option>
                            <option value="Selesai">Selesai</option>
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
                        Link klien: {window.location.origin}/id/track/{booking.tracking_uuid}
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
        </>
    );
}
