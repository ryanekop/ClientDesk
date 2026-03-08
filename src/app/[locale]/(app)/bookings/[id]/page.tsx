"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Edit2, MessageSquare, Phone, Folder, FolderPlus, Loader2, MapPin, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { Link } from "@/i18n/routing";

const EXTRA_FIELD_LABELS: Record<string, string> = {
    universitas: "Universitas",
    fakultas: "Fakultas",
    angkatan: "Angkatan",
    nama_pasangan: "Nama Pasangan",
    tempat_akad: "Tempat Akad",
    tempat_resepsi: "Tempat Resepsi",
    usia_kehamilan: "Usia Kehamilan",
    gender_bayi: "Gender Bayi",
    nama_bayi: "Nama Bayi",
    tanggal_lahir: "Tanggal Lahir",
    nama_brand: "Nama Brand",
    tipe_konten: "Tipe Konten",
    jumlah_anggota: "Jumlah Anggota",
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
    drive_folder_url: string | null;
    location: string | null;
    instagram: string | null;
    event_type: string | null;
    notes: string | null;
    extra_fields: Record<string, string> | null;
    services: { name: string; price: number } | null;
    freelancers: { name: string; whatsapp_number: string | null } | null;
};

function StatusBadge({ status }: { status: string }) {
    const variants: Record<string, string> = {
        pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
        dp: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
        terjadwal: "bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400",
        selesai: "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400",
        batal: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
    };
    const cls = variants[status.toLowerCase()] || "bg-muted text-muted-foreground";
    return <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cls}`}>{status}</span>;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3 text-sm">
            <span className="text-muted-foreground w-36 shrink-0">{label}</span>
            <span className="flex-1">{value}</span>
        </div>
    );
}

export default function BookingDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const supabase = createClient();
    const [booking, setBooking] = React.useState<Booking | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [creatingFolder, setCreatingFolder] = React.useState(false);
    const [isDriveConnected, setIsDriveConnected] = React.useState(false);

    React.useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [{ data }, { data: profile }] = await Promise.all([
                supabase.from("bookings")
                    .select("id, booking_code, client_name, client_whatsapp, session_date, status, total_price, dp_paid, drive_folder_url, location, instagram, event_type, notes, extra_fields, services(name, price), freelancers(name, whatsapp_number)")
                    .eq("id", id).single(),
                supabase.from("profiles").select("google_drive_access_token").eq("id", user.id).single(),
            ]);
            setBooking(data as unknown as Booking);
            if (profile?.google_drive_access_token) setIsDriveConnected(true);
            setLoading(false);
        }
        load();
    }, [id]);

    const formatDate = (d: string | null) => {
        if (!d) return "-";
        return new Date(d).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    };

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);

    function sendWA(phone: string | null, name: string) {
        if (!phone) return;
        const cleaned = phone.replace(/^0/, "62").replace(/[^0-9]/g, "");
        const msg = encodeURIComponent(`Halo ${name}, terima kasih telah booking di studio kami!`);
        window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${msg}`, "_blank");
    }

    function sendWAFreelance(phone: string | null, fname: string) {
        if (!phone) { alert("Nomor WA freelance tidak tersedia."); return; }
        const cleaned = phone.replace(/^0/, "62").replace(/[^0-9]/g, "");
        const sessionStr = booking?.session_date ? formatDate(booking.session_date) : "-";
        const msg = encodeURIComponent(`Halo ${fname}, kamu dijadwalkan sesi foto bersama klien ${booking?.client_name} (${booking?.booking_code}) pada ${sessionStr}. Mohon konfirmasi kehadiranmu. Terima kasih!`);
        window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${msg}`, "_blank");
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

    return (
        <div className="max-w-2xl mx-auto space-y-6">
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
                        <p className="text-muted-foreground text-sm font-mono">
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
                    <MessageSquare className="w-4 h-4 text-green-600" /> WA Klien
                </Button>
                {booking.freelancers && (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => sendWAFreelance((booking.freelancers as any)?.whatsapp_number, booking.freelancers?.name || "")}>
                        <Phone className="w-4 h-4 text-blue-600" /> WA Freelance
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
                {extraEntries.map(([key, val]) => (
                    <InfoRow key={key} label={EXTRA_FIELD_LABELS[key] || key} value={val} />
                ))}
            </div>

            {/* Detail Sesi */}
            <div className="rounded-xl border bg-card p-6 space-y-3">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Detail Sesi</h3>
                <InfoRow label="Jadwal" value={formatDate(booking.session_date)} />
                {booking.location && (
                    <InfoRow label="Lokasi" value={
                        <span className="flex items-center gap-1">
                            {booking.location}
                            <button onClick={() => window.open(`https://maps.google.com/maps?q=${encodeURIComponent(booking.location!)}`, "_blank")}
                                className="text-blue-600 hover:text-blue-700 ml-1 inline-flex">
                                <MapPin className="w-3.5 h-3.5" />
                            </button>
                        </span>
                    } />
                )}
                <InfoRow label="Paket" value={booking.services?.name || "-"} />
                <InfoRow label="Freelance" value={booking.freelancers?.name || "-"} />
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

            {/* Catatan */}
            {booking.notes && (
                <div className="rounded-xl border bg-card p-6 space-y-2">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Catatan</h3>
                    <p className="text-sm whitespace-pre-wrap">{booking.notes}</p>
                </div>
            )}
        </div>
    );
}
