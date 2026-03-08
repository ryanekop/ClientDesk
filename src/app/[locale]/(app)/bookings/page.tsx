"use client";

import * as React from "react";
import { Plus, Upload, Folder, FolderPlus, Edit2, Trash2, Link2, Loader2, Info, Phone, Search, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

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
    services: { name: string } | null;
    freelancers: { id: string; name: string; whatsapp_number: string | null } | null;
};

export default function BookingsPage() {
    const supabase = createClient();
    const t = useTranslations("Bookings");
    const [bookings, setBookings] = React.useState<Booking[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [isDriveConnected, setIsDriveConnected] = React.useState(false);
    const [creatingFolder, setCreatingFolder] = React.useState<string | null>(null);
    const [searchQuery, setSearchQuery] = React.useState("");

    React.useEffect(() => {
        fetchBookings();
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
        const { data: profile } = await supabase
            .from("profiles")
            .select("google_drive_access_token")
            .eq("id", user.id)
            .single();
        if (profile?.google_drive_access_token) setIsDriveConnected(true);
    }

    function handleConnectDrive() {
        const w = 500, h = 600;
        const left = window.screenX + (window.outerWidth - w) / 2;
        const top = window.screenY + (window.outerHeight - h) / 2;
        window.open("/api/google/drive/auth", "google-drive-auth", `width=${w},height=${h},left=${left},top=${top},popup=yes`);
    }

    async function handleCreateFolder(booking: Booking) {
        setCreatingFolder(booking.id);
        try {
            const res = await fetch("/api/google/drive/create-folder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bookingId: booking.id, bookingCode: booking.booking_code, clientName: booking.client_name }),
            });
            const result = await res.json();
            if (result.success && result.folderUrl) {
                window.open(result.folderUrl, "_blank");
                fetchBookings();
            } else {
                alert(result.error || "Gagal membuat folder.");
            }
        } catch { alert("Terjadi kesalahan."); }
        setCreatingFolder(null);
    }

    async function fetchBookings() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from("bookings")
            .select("id, booking_code, client_name, client_whatsapp, session_date, status, total_price, dp_paid, drive_folder_url, location, services(name), freelancers(id, name, whatsapp_number)")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        setBookings((data || []) as unknown as Booking[]);
        setLoading(false);
    }

    async function handleDelete(id: string) {
        if (!confirm("Hapus booking ini?")) return;
        await supabase.from("bookings").delete().eq("id", id);
        fetchBookings();
    }

    function sendWhatsAppFreelancer(phone: string | null, freelancerName: string, booking: Booking) {
        if (!phone) { alert("Nomor WhatsApp freelancer tidak tersedia."); return; }
        const cleaned = phone.replace(/^0/, "62").replace(/[^0-9]/g, "");
        const sessionStr = booking.session_date ? formatDate(booking.session_date) : "-";
        const msg = encodeURIComponent(`Halo ${freelancerName}, kamu dijadwalkan untuk sesi foto bersama klien ${booking.client_name} (${booking.booking_code}) pada ${sessionStr}. Mohon konfirmasi kehadiranmu. Terima kasih!`);
        window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${msg}`, "_blank");
    }

    const formatDate = (d: string | null) => {
        if (!d) return "-";
        return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    };

    const formatCurrency = (n: number) =>
        n ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n) : "-";

    // Filter bookings by search query
    const filteredBookings = bookings.filter(b => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            b.client_name.toLowerCase().includes(q) ||
            b.booking_code.toLowerCase().includes(q) ||
            (b.client_whatsapp && b.client_whatsapp.includes(q)) ||
            (b.services?.name && b.services.name.toLowerCase().includes(q)) ||
            (b.freelancers?.name && b.freelancers.name.toLowerCase().includes(q)) ||
            (b.location && b.location.toLowerCase().includes(q)) ||
            b.status.toLowerCase().includes(q)
        );
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
                    <p className="text-muted-foreground">{t("subtitle")}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                    {!isDriveConnected && (
                        <Button variant="outline" className="gap-2" onClick={handleConnectDrive}>
                            <Link2 className="w-4 h-4" /> {t("hubungkanDrive")}
                        </Button>
                    )}
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="gap-2">
                                <Upload className="w-4 h-4" /> {t("importExcel")}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>{t("importTitle")}</DialogTitle>
                                <DialogDescription>
                                    {t("importDesc")}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-center text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer">
                                    <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                                    <p className="text-sm font-medium">{t("klikPilih")}</p>
                                    <p className="text-xs mt-1">{t("seretLepas")}</p>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button className="w-full">{t("uploadProses")}</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Link href="/bookings/new">
                        <Button className="gap-2">
                            <Plus className="w-4 h-4" /> Tambah Klien Baru
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Cari nama klien, invoice, lokasi, freelance..."
                    className="placeholder:text-muted-foreground dark:bg-input/30 border-input h-10 w-full rounded-lg border bg-transparent pl-10 pr-4 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                />
            </div>

            <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase bg-muted/50 border-b">
                            <tr>
                                <th className="px-4 py-4 font-medium text-muted-foreground whitespace-nowrap">{t("namaKlien")}</th>
                                <th className="px-4 py-4 font-medium text-muted-foreground whitespace-nowrap">Invoice</th>
                                <th className="px-4 py-4 font-medium text-muted-foreground whitespace-nowrap">{t("paket")}</th>
                                <th className="px-4 py-4 font-medium text-muted-foreground whitespace-nowrap">{t("jadwal")}</th>
                                <th className="px-4 py-4 font-medium text-muted-foreground whitespace-nowrap">Lokasi</th>
                                <th className="px-4 py-4 font-medium text-muted-foreground whitespace-nowrap">{t("status")}</th>
                                <th className="px-4 py-4 font-medium text-muted-foreground whitespace-nowrap">{t("freelancer")}</th>
                                <th className="px-4 py-4 font-medium text-muted-foreground whitespace-nowrap">{t("harga")}</th>
                                <th className="px-4 py-4 font-medium text-muted-foreground whitespace-nowrap text-right">{t("aksi")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">{t("memuat")}</td>
                                </tr>
                            ) : filteredBookings.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">
                                        {searchQuery ? "Tidak ada hasil pencarian." : t("belumAda")}
                                    </td>
                                </tr>
                            ) : (
                                filteredBookings.map((booking) => (
                                    <tr key={booking.id} className="hover:bg-muted/50 transition-colors">
                                        {/* Nama Klien */}
                                        <td className="px-4 py-4">
                                            <div className="font-medium">{booking.client_name}</div>
                                            {booking.client_whatsapp && (
                                                <div className="text-xs text-muted-foreground">{booking.client_whatsapp}</div>
                                            )}
                                        </td>
                                        {/* Invoice */}
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{booking.booking_code}</span>
                                        </td>
                                        {/* Paket */}
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            {booking.services?.name || <span className="text-muted-foreground">-</span>}
                                        </td>
                                        {/* Jadwal */}
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            {formatDate(booking.session_date)}
                                        </td>
                                        {/* Lokasi */}
                                        <td className="px-4 py-4 max-w-[200px]">
                                            {booking.location ? (
                                                <div className="flex items-start gap-1">
                                                    <span className="truncate text-xs" title={booking.location}>{booking.location}</span>
                                                    <button type="button" onClick={() => window.open(`https://maps.google.com/maps?q=${encodeURIComponent(booking.location!)}`, "_blank")}
                                                        className="text-blue-600 hover:text-blue-700 shrink-0">
                                                        <MapPin className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </td>
                                        {/* Status */}
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <StatusBadge status={booking.status} />
                                        </td>
                                        {/* Freelancer */}
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            {booking.freelancers?.name || <span className="text-muted-foreground">-</span>}
                                        </td>
                                        {/* Harga */}
                                        <td className="px-4 py-4 whitespace-nowrap font-medium">
                                            {formatCurrency(booking.total_price)}
                                        </td>
                                        {/* Aksi */}
                                        <td className="px-4 py-4 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <Link href={`/bookings/${booking.id}`}>
                                                    <Button variant="outline" size="icon" title="Detail Booking">
                                                        <Info className="w-4 h-4 text-muted-foreground" />
                                                    </Button>
                                                </Link>
                                                <Button variant="outline" size="icon" title="WhatsApp ke Freelancer"
                                                    disabled={!booking.freelancers}
                                                    onClick={() => sendWhatsAppFreelancer((booking.freelancers as any)?.whatsapp_number, booking.freelancers?.name || "", booking)}>
                                                    <Phone className="w-4 h-4 text-green-600 dark:text-green-400" />
                                                </Button>
                                                {booking.drive_folder_url ? (
                                                    <Button variant="outline" size="icon" title={t("bukaFolderDrive")} onClick={() => window.open(booking.drive_folder_url!, "_blank")}>
                                                        <Folder className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                    </Button>
                                                ) : (
                                                    <Button variant="outline" size="icon" title={isDriveConnected ? t("buatFolderDrive") : t("hubungkanDriveFirst")} disabled={!isDriveConnected || creatingFolder === booking.id} onClick={() => handleCreateFolder(booking)}>
                                                        {creatingFolder === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                                                    </Button>
                                                )}
                                                <Link href={`/bookings/${booking.id}/edit`}>
                                                    <Button variant="outline" size="icon" title="Edit Booking">
                                                        <Edit2 className="w-4 h-4 text-muted-foreground" />
                                                    </Button>
                                                </Link>
                                                <Button variant="outline" size="icon" title="Hapus" onClick={() => handleDelete(booking.id)}>
                                                    <Trash2 className="w-4 h-4 text-red-500" />
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

        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    let variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" = "default";

    switch (status.toLowerCase()) {
        case "pending":
            variant = "secondary";
            break;
        case "dp":
            variant = "warning";
            break;
        case "terjadwal":
            variant = "default";
            break;
        case "edit":
        case "cetak":
            variant = "outline";
            break;
        case "selesai":
            variant = "success";
            break;
        case "batal":
            variant = "destructive";
            break;
    }

    return <Badge variant={variant}>{status}</Badge>;
}
