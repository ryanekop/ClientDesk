"use client";

import * as React from "react";
import { Plus, Folder, FolderPlus, Edit2, Trash2, Link2, Loader2, Info, Search, MapPin, RefreshCcw, CheckCircle2, AlertCircle, MessageCircle, Copy, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { DriveBrowser } from "@/components/drive-browser";
import { BatchImportButton } from "@/components/batch-import";

const selectFilterClass = "h-9 rounded-md border border-input bg-background/50 px-3 pr-8 text-sm outline-none cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23999%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

type FreelancerInfo = { id: string; name: string; whatsapp_number: string | null };

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
    notes: string | null;
    services: { name: string } | null;
    freelancers: FreelancerInfo | null; // old single FK (backward compat)
    booking_freelancers: FreelancerInfo[]; // new junction data
};

const STATUS_OPTS = ["Pending", "DP", "Terjadwal", "Selesai", "Edit", "Batal"];

function generateWATemplate(booking: Booking, freelancerName?: string) {
    const sessionStr = booking.session_date ? new Date(booking.session_date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
    if (freelancerName) {
        return `Halo ${freelancerName}, kamu dijadwalkan untuk sesi foto bersama klien ${booking.client_name} (${booking.booking_code}) pada ${sessionStr}. Mohon konfirmasi kehadiranmu. Terima kasih!`;
    }
    return `Halo ${booking.client_name}, terima kasih telah booking di studio kami! Detail booking Anda:\n\nKode: ${booking.booking_code}\nJadwal: ${sessionStr}\nPaket: ${booking.services?.name || "-"}\n\nTerima kasih!`;
}

export default function BookingsPage() {
    const supabase = createClient();
    const t = useTranslations("Bookings");
    const [bookings, setBookings] = React.useState<Booking[]>([]);
    const [packages, setPackages] = React.useState<string[]>([]);
    const [freelancerNames, setFreelancerNames] = React.useState<string[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [isDriveConnected, setIsDriveConnected] = React.useState(false);
    const [copiedId, setCopiedId] = React.useState<string | null>(null);

    // Filters & Search
    const [searchQuery, setSearchQuery] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState("All");
    const [packageFilter, setPackageFilter] = React.useState("All");
    const [freelanceFilter, setFreelanceFilter] = React.useState("All");

    // Modals
    const [statusModal, setStatusModal] = React.useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });
    const [newStatus, setNewStatus] = React.useState("");
    const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);

    const [deleteModal, setDeleteModal] = React.useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });
    const [isDeleting, setIsDeleting] = React.useState(false);

    // Drive browser
    const [driveBrowser, setDriveBrowser] = React.useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });

    // WA Freelancer popup
    const [waPopup, setWaPopup] = React.useState<{ open: boolean; freelancers: FreelancerInfo[] }>({ open: false, freelancers: [] });

    React.useEffect(() => {
        fetchData();
        checkDriveConnection();
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === "GOOGLE_DRIVE_SUCCESS") setIsDriveConnected(true);
        };
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    async function checkDriveConnection() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase.from("profiles").select("google_drive_access_token").eq("id", user.id).single();
        if (profile?.google_drive_access_token) setIsDriveConnected(true);
    }

    function handleConnectDrive() {
        const w = 500, h = 600;
        const left = window.screenX + (window.outerWidth - w) / 2;
        const top = window.screenY + (window.outerHeight - h) / 2;
        window.open("/api/google/drive/auth", "google-drive-auth", `width=${w},height=${h},left=${left},top=${top},popup=yes`);
    }


    async function fetchData() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from("bookings")
            .select("id, booking_code, client_name, client_whatsapp, session_date, status, total_price, dp_paid, drive_folder_url, location, notes, services(name), freelancers(id, name, whatsapp_number), booking_freelancers(freelancer_id, freelancers(id, name, whatsapp_number))")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        // Normalize: merge booking_freelancers into a flat array
        const bgs = (data || []).map((b: any) => {
            const junctionFreelancers = (b.booking_freelancers || []).map((bf: any) => bf.freelancers).filter(Boolean);
            return { ...b, booking_freelancers: junctionFreelancers.length > 0 ? junctionFreelancers : b.freelancers ? [b.freelancers] : [] };
        }) as unknown as Booking[];
        setBookings(bgs);
        setPackages(Array.from(new Set(bgs.map(b => b.services?.name).filter(Boolean))) as string[]);
        setFreelancerNames(Array.from(new Set(bgs.flatMap(b => b.booking_freelancers.map(f => f.name)).filter(Boolean))) as string[]);
        setLoading(false);
    }

    async function handleUpdateStatus() {
        if (!statusModal.booking || !newStatus) return;
        setIsUpdatingStatus(true);
        const { error } = await supabase.from("bookings").update({ status: newStatus }).eq("id", statusModal.booking.id);
        if (!error) {
            setBookings(prev => prev.map(b => b.id === statusModal.booking?.id ? { ...b, status: newStatus } : b));
            setStatusModal({ open: false, booking: null });
        } else { alert("Gagal update status."); }
        setIsUpdatingStatus(false);
    }

    async function confirmDelete() {
        if (!deleteModal.booking) return;
        setIsDeleting(true);
        const { error } = await supabase.from("bookings").delete().eq("id", deleteModal.booking.id);
        if (!error) {
            setBookings(prev => prev.filter(b => b.id !== deleteModal.booking?.id));
            setDeleteModal({ open: false, booking: null });
        } else { alert("Gagal menghapus booking."); }
        setIsDeleting(false);
    }

    function sendWhatsAppClient(booking: Booking) {
        if (!booking.client_whatsapp) { alert("Nomor WhatsApp klien tidak tersedia."); return; }
        const cleaned = booking.client_whatsapp.replace(/^0/, "62").replace(/[^0-9]/g, "");
        const msg = encodeURIComponent(generateWATemplate(booking));
        window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${msg}`, "_blank");
    }

    function copyTemplate(booking: Booking) {
        const template = generateWATemplate(booking);
        navigator.clipboard.writeText(template);
        setCopiedId(booking.id);
        setTimeout(() => setCopiedId(null), 2000);
    }

    const formatDate = (d: string | null) => {
        if (!d) return "-";
        return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    };

    const formatCurrency = (n: number) =>
        n ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n) : "-";

    const filteredBookings = bookings.filter(b => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = !searchQuery || (
            b.client_name.toLowerCase().includes(q) ||
            b.booking_code.toLowerCase().includes(q) ||
            (b.location && b.location.toLowerCase().includes(q))
        );
        const matchesStatus = statusFilter === "All" || b.status === statusFilter;
        const matchesPackage = packageFilter === "All" || b.services?.name === packageFilter;
        const matchesFreelance = freelanceFilter === "All" || b.booking_freelancers.some(f => f.name === freelanceFilter);
        return matchesSearch && matchesStatus && matchesPackage && matchesFreelance;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h2>
                    <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    {!isDriveConnected && (
                        <Button variant="outline" className="gap-2 h-9" onClick={handleConnectDrive}>
                            <Link2 className="w-4 h-4" /> {t("hubungkanDrive")}
                        </Button>
                    )}
                    <BatchImportButton onImported={() => fetchData()} />
                    <Link href="/bookings/new">
                        <Button className="gap-2 h-9 bg-foreground text-background hover:bg-foreground/90">
                            <Plus className="w-4 h-4" /> Tambah Klien Baru
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Filters Row (top) + Search Row (bottom) */}
            <div className="space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectFilterClass}>
                        <option value="All">Semua Status</option>
                        {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={packageFilter} onChange={e => setPackageFilter(e.target.value)} className={selectFilterClass}>
                        <option value="All">Semua Paket</option>
                        {packages.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select value={freelanceFilter} onChange={e => setFreelanceFilter(e.target.value)} className={selectFilterClass}>
                        <option value="All">Semua Freelance</option>
                        {freelancerNames.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Cari nama klien, invoice, lokasi..."
                        className="h-9 w-full rounded-md border border-input bg-background/50 pl-9 pr-3 text-sm focus-visible:ring-1 focus-visible:ring-ring outline-none transition-all"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="text-[11px] uppercase bg-muted/30 border-b">
                            <tr>
                                <th className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{t("namaKlien")}</th>
                                <th className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Invoice</th>
                                <th className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{t("paket")}</th>
                                <th className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{t("jadwal")}</th>
                                <th className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">Lokasi</th>
                                <th className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{t("status")}</th>
                                <th className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{t("freelancer")}</th>
                                <th className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{t("harga")}</th>
                                <th className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap text-right">{t("aksi")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {loading ? (
                                <tr><td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">{t("memuat")}</td></tr>
                            ) : filteredBookings.length === 0 ? (
                                <tr><td colSpan={9} className="px-6 py-12 text-center text-muted-foreground text-xs italic">Data tidak ditemukan.</td></tr>
                            ) : (
                                filteredBookings.map((booking) => (
                                    <tr key={booking.id} className="hover:bg-muted/30 transition-colors group">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-foreground">{booking.client_name}</div>
                                            {booking.client_whatsapp && (
                                                <div className="text-[11px] text-muted-foreground">{booking.client_whatsapp}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="text-[10px] font-mono bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded border border-border/50">
                                                {booking.booking_code}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{booking.services?.name || "-"}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground font-light">{formatDate(booking.session_date)}</td>
                                        <td className="px-4 py-3 max-w-[180px]">
                                            {booking.location ? (
                                                <div className="flex items-center gap-1">
                                                    <span className="truncate text-xs text-muted-foreground" title={booking.location}>{booking.location}</span>
                                                    <button type="button" onClick={() => window.open(`https://maps.google.com/maps?q=${encodeURIComponent(booking.location!)}`, "_blank")}
                                                        className="text-blue-500 hover:text-blue-600 transition-colors shrink-0">
                                                        <MapPin className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : <span className="text-muted-foreground">-</span>}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={booking.status} /></td>
                                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                            {booking.booking_freelancers.length > 0
                                                ? booking.booking_freelancers.map(f => f.name).join(", ")
                                                : "-"}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap font-medium text-foreground">{formatCurrency(booking.total_price)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end">
                                                {/* 1. Copy Template */}
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-violet-500 hover:text-violet-600" title="Salin Template"
                                                    onClick={() => copyTemplate(booking)}>
                                                    {copiedId === booking.id ? <ClipboardCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                </Button>
                                                {/* 2. WA Freelancer (default) / Client fallback */}
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500 hover:text-green-600"
                                                    title={booking.booking_freelancers.length > 0 ? `WA Freelance (${booking.booking_freelancers.length})` : "WA Klien"}
                                                    disabled={booking.booking_freelancers.length === 0 && !booking.client_whatsapp}
                                                    onClick={() => {
                                                        if (booking.booking_freelancers.length > 1) {
                                                            setWaPopup({ open: true, freelancers: booking.booking_freelancers });
                                                        } else if (booking.booking_freelancers.length === 1 && booking.booking_freelancers[0].whatsapp_number) {
                                                            const f = booking.booking_freelancers[0];
                                                            const cleaned = f.whatsapp_number!.replace(/^0/, "62").replace(/[^0-9]/g, "");
                                                            const msg = encodeURIComponent(generateWATemplate(booking, f.name));
                                                            window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${msg}`, "_blank");
                                                        } else {
                                                            sendWhatsAppClient(booking);
                                                        }
                                                    }}>
                                                    <MessageCircle className="w-4 h-4" />
                                                </Button>
                                                {/* 3. Drive Folder */}
                                                {booking.drive_folder_url ? (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-600" title="Buka Folder" onClick={() => window.open(booking.drive_folder_url!, "_blank")}>
                                                        <Folder className="w-4 h-4" />
                                                    </Button>
                                                ) : (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400 hover:text-blue-500" title="Buat Folder"
                                                        disabled={!isDriveConnected}
                                                        onClick={() => setDriveBrowser({ open: true, booking })}>
                                                        <FolderPlus className="w-4 h-4" />
                                                    </Button>
                                                )}
                                                {/* 4. Detail */}
                                                <Link href={`/bookings/${booking.id}`}>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-700" title="Detail">
                                                        <Info className="w-4 h-4" />
                                                    </Button>
                                                </Link>
                                                {/* 5. Status */}
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-500 hover:text-orange-600" title="Ganti Status"
                                                    onClick={() => { setNewStatus(booking.status); setStatusModal({ open: true, booking }); }}>
                                                    <RefreshCcw className="w-4 h-4" />
                                                </Button>
                                                {/* 6. Edit */}
                                                <Link href={`/bookings/${booking.id}/edit`}>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-600" title="Edit">
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                </Link>
                                                {/* 7. Hapus */}
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" title="Hapus"
                                                    onClick={() => setDeleteModal({ open: true, booking })}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Status Change Modal */}
            <Dialog open={statusModal.open} onOpenChange={(o) => !o && setStatusModal({ open: false, booking: null })}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Ganti Status Booking</DialogTitle>
                        <DialogDescription>
                            Ubah status untuk klien <strong>{statusModal.booking?.client_name}</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2 grid grid-cols-3 gap-2">
                        {STATUS_OPTS.map((opt) => (
                            <button key={opt} onClick={() => setNewStatus(opt)}
                                className={cn("flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-all hover:bg-muted/50",
                                    newStatus === opt ? "border-foreground bg-foreground/5 dark:bg-foreground/10" : "border-border text-muted-foreground")}>
                                <StatusBadge status={opt} className="scale-110 mb-0.5" />
                                {opt}
                            </button>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setStatusModal({ open: false, booking: null })} disabled={isUpdatingStatus}>Batal</Button>
                        <Button onClick={handleUpdateStatus} disabled={isUpdatingStatus || newStatus === statusModal.booking?.status}>
                            {isUpdatingStatus ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                            Simpan Perubahan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Modal */}
            <Dialog open={deleteModal.open} onOpenChange={(o) => !o && setDeleteModal({ open: false, booking: null })}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader className="items-center text-center">
                        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-2">
                            <AlertCircle className="w-6 h-6 text-red-600" />
                        </div>
                        <DialogTitle className="text-xl">Hapus Booking?</DialogTitle>
                        <DialogDescription>
                            Tindakan ini tidak dapat dibatalkan. Booking klien <strong>{deleteModal.booking?.client_name}</strong> akan dihapus permanen.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="sm:justify-center gap-2 pt-2">
                        <Button variant="outline" className="flex-1" onClick={() => setDeleteModal({ open: false, booking: null })} disabled={isDeleting}>Batal</Button>
                        <Button variant="destructive" className="flex-1" onClick={confirmDelete} disabled={isDeleting}>
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                            Ya, Hapus
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* WA Freelancer Selection Popup */}
            <Dialog open={waPopup.open} onOpenChange={(o) => !o && setWaPopup({ open: false, freelancers: [] })}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>WhatsApp Freelancer</DialogTitle>
                        <DialogDescription>Pilih freelancer yang ingin dihubungi</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2 py-2">
                        {waPopup.freelancers.map((f) => (
                            <button
                                key={f.id}
                                disabled={!f.whatsapp_number}
                                onClick={() => {
                                    if (!f.whatsapp_number) return;
                                    const cleaned = f.whatsapp_number.replace(/^0/, "62").replace(/[^0-9]/g, "");
                                    window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${encodeURIComponent(`Halo ${f.name}!`)}`, "_blank");
                                    setWaPopup({ open: false, freelancers: [] });
                                }}
                                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-500/10 flex items-center justify-center shrink-0">
                                    <MessageCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">{f.name}</p>
                                    <p className="text-xs text-muted-foreground">{f.whatsapp_number || "Nomor tidak tersedia"}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Drive Browser */}
            {driveBrowser.booking && (
                <DriveBrowser
                    open={driveBrowser.open}
                    onOpenChange={o => { if (!o) setDriveBrowser({ open: false, booking: null }); }}
                    bookingId={driveBrowser.booking.id}
                    defaultFolderName={`${driveBrowser.booking.booking_code} - ${driveBrowser.booking.client_name}`}
                    onFolderCreated={(url) => {
                        setBookings(prev => prev.map(b => b.id === driveBrowser.booking?.id ? { ...b, drive_folder_url: url } : b));
                        window.open(url, "_blank");
                    }}
                    onFolderSelected={(url) => {
                        // Save selected folder URL to booking
                        supabase.from("bookings").update({ drive_folder_url: url }).eq("id", driveBrowser.booking!.id).then(() => {
                            setBookings(prev => prev.map(b => b.id === driveBrowser.booking?.id ? { ...b, drive_folder_url: url } : b));
                        });
                        window.open(url, "_blank");
                    }}
                />
            )}
        </div>
    );
}

function StatusBadge({ status, className }: { status: string; className?: string }) {
    let variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" = "default";
    let customClass = "";
    switch (status.toLowerCase()) {
        case "pending": variant = "secondary"; customClass = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-none"; break;
        case "dp": variant = "warning"; break;
        case "terjadwal": variant = "default"; customClass = "bg-blue-500 text-white hover:bg-blue-600 border-none shadow-sm"; break;
        case "edit": case "cetak": variant = "outline"; customClass = "border-blue-200 text-blue-600 dark:border-blue-900/50 dark:text-blue-400"; break;
        case "selesai": variant = "success"; break;
        case "batal": variant = "destructive"; break;
    }
    return <Badge variant={variant} className={cn("text-[10px] px-2 py-0.5 font-medium rounded-full whitespace-nowrap", customClass, className)}>{status}</Badge>;
}
