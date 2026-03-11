"use client";

import * as React from "react";
import { Plus, Folder, Edit2, Trash2, Link2, Loader2, Info, Search, MapPin, RefreshCcw, CheckCircle2, AlertCircle, MessageCircle, Copy, ClipboardCheck, AlertTriangle, X, Download, ExternalLink, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { BatchImportButton } from "@/components/batch-import";
import { TablePagination, paginateArray } from "@/components/ui/table-pagination";
import * as XLSX from "xlsx";

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
    event_type: string | null;
    freelancers: FreelancerInfo | null; // old single FK (backward compat)
    booking_freelancers: FreelancerInfo[]; // new junction data
    payment_proof_url: string | null;
    tracking_uuid: string | null;
    location_detail: string | null;
};

const DEFAULT_STATUS_OPTS = ["Pending", "DP", "Terjadwal", "Selesai", "Edit", "Batal"];
const TABLE_CELL = "px-4 py-3 whitespace-nowrap text-sm";
const TRUNCATE_CELL = "px-4 py-3 text-sm max-w-[160px] truncate";

type SavedTemplate = {
    id: string;
    type: string;
    content: string;
    content_en: string;
    event_type: string | null;
};

function generateWATemplate(booking: Booking, locale: string, savedTemplates: SavedTemplate[], studioName: string, freelancerName?: string) {
    const sessionStr = booking.session_date ? new Date(booking.session_date).toLocaleDateString(locale === "en" ? "en-US" : "id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
    const serviceName = booking.services?.name || "-";

    // Build replacement map
    const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
    const vars: Record<string, string> = {
        client_name: booking.client_name,
        booking_code: booking.booking_code,
        session_date: sessionStr,
        service_name: serviceName,
        total_price: new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(booking.total_price || 0),
        dp_paid: new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(booking.dp_paid || 0),
        studio_name: studioName || "",
        freelancer_name: freelancerName || "",
        event_type: booking.event_type || "-",
        location: booking.location || "-",
        location_maps_url: booking.location ? `https://maps.google.com/maps?q=${encodeURIComponent(booking.location)}` : "-",
        detail_location: (booking as any).location_detail || "-",
        notes: booking.notes || "-",
        tracking_link: (booking as any).tracking_uuid ? `${siteUrl}/id/track/${(booking as any).tracking_uuid}` : "-",
        invoice_url: `${siteUrl}/api/public/invoice?code=${encodeURIComponent(booking.booking_code)}`,
    };

    function applyVars(tpl: string) {
        return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`);
    }

    if (freelancerName) {
        // Look for whatsapp_freelancer template
        const template = savedTemplates.find(t => t.type === "whatsapp_freelancer");
        if (template) {
            const content = locale === "en" ? (template.content_en || template.content) : template.content;
            if (content.trim()) return applyVars(content);
        }
        // Fallback
        return `Halo ${freelancerName}, kamu dijadwalkan untuk sesi foto bersama klien ${booking.client_name} (${booking.booking_code}) pada ${sessionStr}. Mohon konfirmasi kehadiranmu. Terima kasih!`;
    }

    // Look for whatsapp_client template
    const template = savedTemplates.find(t => t.type === "whatsapp_client");
    if (template) {
        const content = locale === "en" ? (template.content_en || template.content) : template.content;
        if (content.trim()) return applyVars(content);
    }
    // Fallback
    return `Halo ${booking.client_name}, terima kasih telah booking di studio kami! Detail booking Anda:\n\nKode: ${booking.booking_code}\nJadwal: ${sessionStr}\nPaket: ${serviceName}\n\nTerima kasih!`;
}

export default function BookingsPage() {
    const supabase = createClient();
    const t = useTranslations("Bookings");
    const tb = useTranslations("BookingsPage");
    const locale = useLocale();
    const [bookings, setBookings] = React.useState<Booking[]>([]);
    const [savedTemplates, setSavedTemplates] = React.useState<SavedTemplate[]>([]);
    const [packages, setPackages] = React.useState<string[]>([]);
    const [freelancerNames, setFreelancerNames] = React.useState<string[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [copiedId, setCopiedId] = React.useState<string | null>(null);
    const [studioName, setStudioName] = React.useState("");
    const [statusOpts, setStatusOpts] = React.useState<string[]>(DEFAULT_STATUS_OPTS);
    const [defaultWaTarget, setDefaultWaTarget] = React.useState<"client" | "freelancer">("client");

    // Filters & Search
    const [searchQuery, setSearchQuery] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState("All");
    const [packageFilter, setPackageFilter] = React.useState("All");
    const [freelanceFilter, setFreelanceFilter] = React.useState("All");
    const [monthFilter, setMonthFilter] = React.useState("All");
    const [currentPage, setCurrentPage] = React.useState(1);
    const [itemsPerPage, setItemsPerPage] = React.useState(10);

    // Modals
    const [statusModal, setStatusModal] = React.useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });
    const [newStatus, setNewStatus] = React.useState("");
    const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);

    const [deleteModal, setDeleteModal] = React.useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });
    const [isDeleting, setIsDeleting] = React.useState(false);

    // Drive link popup
    const [driveLinkPopup, setDriveLinkPopup] = React.useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });
    const [driveLinkInput, setDriveLinkInput] = React.useState("");
    const [savingDriveLink, setSavingDriveLink] = React.useState(false);

    // WA Freelancer popup
    const [waPopup, setWaPopup] = React.useState<{ open: boolean; freelancers: FreelancerInfo[]; booking: Booking | null }>({ open: false, freelancers: [], booking: null });

    React.useEffect(() => {
        fetchData();
        fetchTemplates();
        const handleMessage = (event: MessageEvent) => {
        };
        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    async function fetchTemplates() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from("templates").select("id, type, content, content_en, event_type").eq("user_id", user.id);
        setSavedTemplates((data || []) as SavedTemplate[]);
    }




    async function fetchData() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch studio name for WA templates
        const { data: profile } = await supabase.from("profiles").select("studio_name, custom_statuses, default_wa_target").eq("id", user.id).single();
        if (profile?.studio_name) setStudioName(profile.studio_name);
        if (profile?.custom_statuses) setStatusOpts(profile.custom_statuses as string[]);
        if ((profile as any)?.default_wa_target) setDefaultWaTarget((profile as any).default_wa_target);

        const { data } = await supabase
            .from("bookings")
            .select("id, booking_code, client_name, client_whatsapp, session_date, status, total_price, dp_paid, drive_folder_url, location, location_detail, notes, payment_proof_url, event_type, tracking_uuid, services(name), freelance(id, name, whatsapp_number), booking_freelance(freelance_id, freelance(id, name, whatsapp_number))")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        // Normalize: merge booking_freelancers into a flat array
        const bgs = (data || []).map((b: any) => {
            const junctionFreelancers = (b.booking_freelance || []).map((bf: any) => bf.freelance).filter(Boolean);
            return { ...b, booking_freelancers: junctionFreelancers.length > 0 ? junctionFreelancers : b.freelance ? [b.freelance] : [] };
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
        } else { alert(tb("failedUpdateStatus")); }
        setIsUpdatingStatus(false);
    }

    async function confirmDelete() {
        if (!deleteModal.booking) return;
        setIsDeleting(true);
        const { error } = await supabase.from("bookings").delete().eq("id", deleteModal.booking.id);
        if (!error) {
            setBookings(prev => prev.filter(b => b.id !== deleteModal.booking?.id));
            setDeleteModal({ open: false, booking: null });
        } else { alert(tb("failedDeleteBooking")); }
        setIsDeleting(false);
    }

    function sendWhatsAppClient(booking: Booking) {
        if (!booking.client_whatsapp) { alert(tb("waNotAvailable")); return; }
        const cleaned = booking.client_whatsapp.replace(/^0/, "62").replace(/[^0-9]/g, "");
        const msg = encodeURIComponent(generateWATemplate(booking, locale, savedTemplates, studioName));
        window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${msg}`, "_blank");
    }

    function copyTemplate(booking: Booking) {
        const template = generateWATemplate(booking, locale, savedTemplates, studioName);
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
        const matchesMonth = monthFilter === "All" || (() => {
            if (!b.session_date) return false;
            const d = new Date(b.session_date);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === monthFilter;
        })();
        return matchesSearch && matchesStatus && matchesPackage && matchesFreelance && matchesMonth;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h2>
                    <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="gap-2 h-9" onClick={() => {
                        const exportData = filteredBookings.map((b: Booking) => ({
                            [tb("exportBookingCode")]: b.booking_code,
                            [tb("exportClientName")]: b.client_name,
                            [tb("exportWhatsApp")]: b.client_whatsapp || "",
                            [tb("exportSessionDate")]: b.session_date ? new Date(b.session_date).toLocaleDateString("id-ID") : "",
                            [tb("exportLocation")]: b.location || "",
                            [tb("exportPackage")]: b.services?.name || "",
                            [tb("exportTotalPrice")]: b.total_price || 0,
                            [tb("exportDPPaid")]: b.dp_paid || 0,
                            [tb("exportStatus")]: b.status,
                        }));
                        const ws = XLSX.utils.json_to_sheet(exportData);
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, "Bookings");
                        XLSX.writeFile(wb, `bookings_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
                    }}>
                        <Download className="w-4 h-4" /> {tb("export")}
                    </Button>
                    <BatchImportButton onImported={() => fetchData()} />
                    <Link href="/bookings/new">
                        <Button className="gap-2 h-9 bg-foreground text-background hover:bg-foreground/90">
                            <Plus className="w-4 h-4" /> {tb("addClient")}
                        </Button>
                    </Link>
                </div>
            </div>


            {/* Filters Row (top) + Search Row (bottom) */}
            <div className="space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectFilterClass}>
                        <option value="All">{tb("allStatus")}</option>
                        {statusOpts.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={packageFilter} onChange={e => setPackageFilter(e.target.value)} className={selectFilterClass}>
                        <option value="All">{tb("allPackages")}</option>
                        {packages.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select value={freelanceFilter} onChange={e => setFreelanceFilter(e.target.value)} className={selectFilterClass}>
                        <option value="All">{tb("allFreelance")}</option>
                        {freelancerNames.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className={selectFilterClass}>
                        <option value="All">{tb("allMonths")}</option>
                        {Array.from(new Set(bookings.filter(b => b.session_date).map(b => { const d = new Date(b.session_date!); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }))).sort().reverse().map(m => {
                            const [y, mo] = m.split("-");
                            const label = new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
                            return <option key={m} value={m}>{label}</option>;
                        })}
                    </select>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder={tb("searchPlaceholder")}
                        className="h-9 w-full rounded-md border border-input bg-background/50 pl-9 pr-3 text-sm focus-visible:ring-1 focus-visible:ring-ring outline-none transition-all"
                    />
                </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
                {loading ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : filteredBookings.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">{tb("noDataFound")}</div>
                ) : (
                    paginateArray(filteredBookings, currentPage, itemsPerPage).map((booking) => (
                        <div key={booking.id} className="rounded-xl border bg-card shadow-sm p-4 space-y-3">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="font-semibold">{booking.client_name}</p>
                                    <p className="text-xs text-muted-foreground">{booking.booking_code}</p>
                                </div>
                                <StatusBadge status={booking.status} />
                            </div>
                            <div className="border-t pt-2 space-y-1 text-sm text-muted-foreground">
                                <div className="flex justify-between"><span>{t("paket")}</span><span className="text-foreground font-medium">{booking.services?.name || "-"}</span></div>
                                <div className="flex justify-between"><span>{t("jadwal")}</span><span>{formatDate(booking.session_date)}</span></div>
                                {booking.location && <div className="flex justify-between"><span>{tb("location")}</span><span className="truncate max-w-[180px]">{booking.location}</span></div>}
                                <div className="flex justify-between"><span>Total</span><span className="text-foreground font-semibold">{formatCurrency(booking.total_price)}</span></div>
                            </div>
                            <div className="flex items-center gap-1 pt-1 border-t flex-wrap">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-violet-500" title={tb("copyTemplate")} onClick={() => copyTemplate(booking)}>
                                    {copiedId === booking.id ? <ClipboardCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500" title={tb("whatsapp")}
                                    disabled={booking.booking_freelancers.length === 0 && !booking.client_whatsapp}
                                    onClick={() => {
                                        if (defaultWaTarget === "client" || booking.booking_freelancers.length === 0) {
                                            if (booking.client_whatsapp) sendWhatsAppClient(booking);
                                            else if (booking.booking_freelancers.length === 1 && booking.booking_freelancers[0].whatsapp_number) {
                                                const f = booking.booking_freelancers[0];
                                                const cleaned = f.whatsapp_number!.replace(/^0/, "62").replace(/[^0-9]/g, "");
                                                const msg = encodeURIComponent(generateWATemplate(booking, locale, savedTemplates, studioName, f.name));
                                                window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${msg}`, "_blank");
                                            }
                                        } else {
                                            if (booking.booking_freelancers.length > 1) { setWaPopup({ open: true, freelancers: booking.booking_freelancers, booking }); }
                                            else if (booking.booking_freelancers.length === 1 && booking.booking_freelancers[0].whatsapp_number) {
                                                const f = booking.booking_freelancers[0];
                                                const cleaned = f.whatsapp_number!.replace(/^0/, "62").replace(/[^0-9]/g, "");
                                                const msg = encodeURIComponent(generateWATemplate(booking, locale, savedTemplates, studioName, f.name));
                                                window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${msg}`, "_blank");
                                            } else { sendWhatsAppClient(booking); }
                                        }
                                    }}>
                                    <MessageCircle className="w-4 h-4" />
                                </Button>
                                {booking.payment_proof_url && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500" title="Bukti Transfer" onClick={() => window.open(booking.payment_proof_url!, "_blank")}>
                                        <Receipt className="w-4 h-4" />
                                    </Button>
                                )}
                                <Link href={`/bookings/${booking.id}`}><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500"><Info className="w-4 h-4" /></Button></Link>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-500" onClick={() => { setNewStatus(booking.status); setStatusModal({ open: true, booking }); }}>
                                    <RefreshCcw className="w-4 h-4" />
                                </Button>
                                <Link href={`/bookings/${booking.id}/edit`}><Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500"><Edit2 className="w-4 h-4" /></Button></Link>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setDeleteModal({ open: true, booking })}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Desktop Table */}
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden hidden md:block">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="text-[11px] uppercase bg-muted/30 border-b">
                            <tr>
                                <th className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{t("namaKlien")}</th>
                                <th className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{tb("invoice")}</th>
                                <th className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{t("paket")}</th>
                                <th className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{t("jadwal")}</th>
                                <th className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{tb("location")}</th>
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
                                <tr><td colSpan={9} className="px-6 py-12 text-center text-muted-foreground text-xs italic">{tb("noDataFound")}</td></tr>
                            ) : (
                                paginateArray(filteredBookings, currentPage, itemsPerPage).map((booking) => (
                                    <tr key={booking.id} className="hover:bg-muted/30 transition-colors group">
                                        <td className="px-4 py-3 max-w-[140px]">
                                            <div className="font-medium text-foreground truncate">{booking.client_name}</div>
                                            {booking.client_whatsapp && (
                                                <div className="text-[11px] text-muted-foreground truncate">{booking.client_whatsapp}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="text-[10px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded border border-border/50">
                                                {booking.booking_code}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 max-w-[150px] truncate text-muted-foreground" title={booking.services?.name || "-"}>{booking.services?.name || "-"}</td>
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
                                        <td className="px-4 py-3 max-w-[130px] truncate text-muted-foreground" title={booking.booking_freelancers.length > 0 ? booking.booking_freelancers.map(f => f.name).join(", ") : "-"}>
                                            {booking.booking_freelancers.length > 0
                                                ? booking.booking_freelancers.map(f => f.name).join(", ")
                                                : "-"}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap font-medium text-foreground">{formatCurrency(booking.total_price)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end">
                                                {/* 1. Copy Template */}
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-violet-500 hover:text-violet-600" title={tb("copyTemplate")}
                                                    onClick={() => copyTemplate(booking)}>
                                                    {copiedId === booking.id ? <ClipboardCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                </Button>
                                                {/* 2. WA Freelancer (default) / Client fallback */}
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500 hover:text-green-600"
                                                    title={booking.booking_freelancers.length > 0 ? `${tb("waFreelance")} (${booking.booking_freelancers.length})` : tb("whatsapp")}
                                                    disabled={booking.booking_freelancers.length === 0 && !booking.client_whatsapp}
                                                    onClick={() => {
                                                        if (defaultWaTarget === "client" || booking.booking_freelancers.length === 0) {
                                                            if (booking.client_whatsapp) sendWhatsAppClient(booking);
                                                            else if (booking.booking_freelancers.length === 1 && booking.booking_freelancers[0].whatsapp_number) {
                                                                const f = booking.booking_freelancers[0];
                                                                const cleaned = f.whatsapp_number!.replace(/^0/, "62").replace(/[^0-9]/g, "");
                                                                const msg = encodeURIComponent(generateWATemplate(booking, locale, savedTemplates, studioName, f.name));
                                                                window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${msg}`, "_blank");
                                                            }
                                                        } else {
                                                            if (booking.booking_freelancers.length > 1) {
                                                                setWaPopup({ open: true, freelancers: booking.booking_freelancers, booking });
                                                            } else if (booking.booking_freelancers.length === 1 && booking.booking_freelancers[0].whatsapp_number) {
                                                                const f = booking.booking_freelancers[0];
                                                                const cleaned = f.whatsapp_number!.replace(/^0/, "62").replace(/[^0-9]/g, "");
                                                                const msg = encodeURIComponent(generateWATemplate(booking, locale, savedTemplates, studioName, f.name));
                                                                window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${msg}`, "_blank");
                                                            } else {
                                                                sendWhatsAppClient(booking);
                                                            }
                                                        }
                                                    }}>
                                                    <MessageCircle className="w-4 h-4" />
                                                </Button>
                                                {/* Bukti Transfer */}
                                                {booking.payment_proof_url && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500 hover:text-amber-600" title="Bukti Transfer" onClick={() => window.open(booking.payment_proof_url!, "_blank")}>
                                                        <Receipt className="w-4 h-4" />
                                                    </Button>
                                                )}
                                                {/* 3. Drive Folder */}
                                                {booking.drive_folder_url ? (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-600" title={tb("openDrive")} onClick={() => window.open(booking.drive_folder_url!, "_blank")}>
                                                        <Folder className="w-4 h-4" />
                                                    </Button>
                                                ) : (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400 hover:text-blue-500" title="Set Link Drive"
                                                        onClick={() => { setDriveLinkInput(""); setDriveLinkPopup({ open: true, booking }); }}>
                                                        <Link2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                                {/* 4. Detail */}
                                                <Link href={`/bookings/${booking.id}`}>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-700" title={tb("detail")}>
                                                        <Info className="w-4 h-4" />
                                                    </Button>
                                                </Link>
                                                {/* 5. Status */}
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-500 hover:text-orange-600" title={tb("changeStatusBtn")}
                                                    onClick={() => { setNewStatus(booking.status); setStatusModal({ open: true, booking }); }}>
                                                    <RefreshCcw className="w-4 h-4" />
                                                </Button>
                                                {/* 6. Edit */}
                                                <Link href={`/bookings/${booking.id}/edit`}>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-600" title={tb("editBtn")}>
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                </Link>
                                                {/* 7. Hapus */}
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" title={tb("deleteBtn")}
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
                <TablePagination totalItems={filteredBookings.length} currentPage={currentPage} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} />
            </div>

            {/* Status Change Modal */}
            <Dialog open={statusModal.open} onOpenChange={(o) => !o && setStatusModal({ open: false, booking: null })}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{tb("changeStatus")}</DialogTitle>
                        <DialogDescription>
                            {tb("changeStatusDesc")} <strong>{statusModal.booking?.client_name}</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2 grid grid-cols-3 gap-2">
                        {statusOpts.map((opt) => (
                            <button key={opt} onClick={() => setNewStatus(opt)}
                                className={cn("flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-all hover:bg-muted/50",
                                    newStatus === opt ? "border-foreground bg-foreground/5 dark:bg-foreground/10" : "border-border text-muted-foreground")}>
                                <StatusBadge status={opt} className="scale-110 mb-0.5" />
                                {opt}
                            </button>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setStatusModal({ open: false, booking: null })} disabled={isUpdatingStatus}>{tb("cancel")}</Button>
                        <Button onClick={handleUpdateStatus} disabled={isUpdatingStatus || newStatus === statusModal.booking?.status}>
                            {isUpdatingStatus ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                            {tb("saveChanges")}
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
                        <DialogTitle className="text-xl">{tb("deleteBooking")}</DialogTitle>
                        <DialogDescription>
                            {tb("deleteBookingDesc", { name: deleteModal.booking?.client_name || "" })}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="sm:justify-center gap-2 pt-2">
                        <Button variant="outline" className="flex-1" onClick={() => setDeleteModal({ open: false, booking: null })} disabled={isDeleting}>{tb("cancel")}</Button>
                        <Button variant="destructive" className="flex-1" onClick={confirmDelete} disabled={isDeleting}>
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                            {tb("yesDelete")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* WA Freelancer Selection Popup */}
            <Dialog open={waPopup.open} onOpenChange={(o) => !o && setWaPopup({ open: false, freelancers: [], booking: null })}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{tb("waFreelance")}</DialogTitle>
                        <DialogDescription>{tb("selectFreelance")}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2 py-2">
                        {waPopup.freelancers.map((f) => (
                            <button
                                key={f.id}
                                disabled={!f.whatsapp_number}
                                onClick={() => {
                                    if (!f.whatsapp_number) return;
                                    const cleaned = f.whatsapp_number.replace(/^0/, "62").replace(/[^0-9]/g, "");
                                    const msg = waPopup.booking ? encodeURIComponent(generateWATemplate(waPopup.booking, locale, savedTemplates, studioName, f.name)) : encodeURIComponent(`Halo ${f.name}!`);
                                    window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${msg}`, "_blank");
                                    setWaPopup({ open: false, freelancers: [], booking: null });
                                }}
                                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-500/10 flex items-center justify-center shrink-0">
                                    <MessageCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">{f.name}</p>
                                    <p className="text-xs text-muted-foreground">{f.whatsapp_number || tb("numberNotAvailable")}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Drive Link Popup */}
            <Dialog open={driveLinkPopup.open} onOpenChange={(o) => { if (!o) setDriveLinkPopup({ open: false, booking: null }); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{tb("setDriveLink")}</DialogTitle>
                        <DialogDescription>{tb("setDriveLinkDesc")}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <input
                            type="url"
                            value={driveLinkInput}
                            onChange={e => setDriveLinkInput(e.target.value)}
                            placeholder="https://drive.google.com/drive/folders/..."
                            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDriveLinkPopup({ open: false, booking: null })}>{tb("cancel")}</Button>
                        <Button disabled={!driveLinkInput || savingDriveLink} className="gap-2" onClick={async () => {
                            if (!driveLinkPopup.booking || !driveLinkInput) return;
                            setSavingDriveLink(true);
                            await supabase.from("bookings").update({ drive_folder_url: driveLinkInput }).eq("id", driveLinkPopup.booking.id);
                            setBookings(prev => prev.map(b => b.id === driveLinkPopup.booking?.id ? { ...b, drive_folder_url: driveLinkInput } : b));
                            setSavingDriveLink(false);
                            setDriveLinkPopup({ open: false, booking: null });
                        }}>
                            {savingDriveLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                            {tb("save")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
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
