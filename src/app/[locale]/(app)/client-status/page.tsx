"use client";

import * as React from "react";
import { createClient } from "@/utils/supabase/client";
import { Activity, Copy, ClipboardCheck, Loader2, ExternalLink, Search } from "lucide-react";
import { Link } from "@/i18n/routing";

type BookingStatus = {
    id: string;
    booking_code: string;
    client_name: string;
    client_whatsapp: string | null;
    session_date: string | null;
    status: string;
    client_status: string | null;
    queue_position: number | null;
    tracking_uuid: string | null;
    services: { name: string } | null;
};

const CLIENT_STATUSES = [
    { value: "", label: "Semua" },
    { value: "Booking Confirmed", label: "Booking Confirmed" },
    { value: "Sesi Foto / Acara", label: "Sesi Foto / Acara" },
    { value: "Antrian Edit", label: "Antrian Edit" },
    { value: "Proses Edit", label: "Proses Edit" },
    { value: "Revisi", label: "Revisi" },
    { value: "File Siap", label: "File Siap" },
    { value: "Selesai", label: "Selesai" },
];

const statusColors: Record<string, string> = {
    "Booking Confirmed": "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
    "Sesi Foto / Acara": "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400",
    "Antrian Edit": "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
    "Proses Edit": "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
    "Revisi": "bg-pink-100 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400",
    "File Siap": "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400",
    "Selesai": "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
};

export default function ClientStatusPage() {
    const supabase = createClient();
    const [bookings, setBookings] = React.useState<BookingStatus[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [filter, setFilter] = React.useState("");
    const [search, setSearch] = React.useState("");
    const [copiedId, setCopiedId] = React.useState<string | null>(null);
    const [savingId, setSavingId] = React.useState<string | null>(null);

    React.useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from("bookings")
                .select("id, booking_code, client_name, client_whatsapp, session_date, status, client_status, queue_position, tracking_uuid, services(name)")
                .eq("user_id", user.id)
                .neq("status", "Batal")
                .order("created_at", { ascending: false });

            setBookings((data || []) as BookingStatus[]);
            setLoading(false);
        }
        load();
    }, []);

    async function updateStatus(id: string, clientStatus: string) {
        setSavingId(id);
        await supabase.from("bookings").update({ client_status: clientStatus || null }).eq("id", id);
        setBookings(prev => prev.map(b => b.id === id ? { ...b, client_status: clientStatus || null } : b));
        setSavingId(null);
    }

    async function updateQueue(id: string, pos: number | null) {
        await supabase.from("bookings").update({ queue_position: pos }).eq("id", id);
        setBookings(prev => prev.map(b => b.id === id ? { ...b, queue_position: pos } : b));
    }

    function copyTrackLink(uuid: string, id: string) {
        const url = `${window.location.origin}/id/track/${uuid}`;
        navigator.clipboard.writeText(url);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    }

    const filtered = bookings.filter(b => {
        if (filter && b.client_status !== filter) return false;
        if (search && !b.client_name.toLowerCase().includes(search.toLowerCase()) && !b.booking_code.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const selectClass = "h-8 rounded-md border border-input bg-background px-2 py-1 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] cursor-pointer";
    const inputClass = "h-8 rounded-md border border-input bg-background px-2 py-1 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] w-16 text-center";

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Activity className="w-6 h-6" /> Status Klien
                </h2>
                <p className="text-muted-foreground text-sm">Kelola progress dan antrian klien. Klien bisa tracking via link.</p>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Cari nama klien atau kode..."
                        className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    />
                </div>
                <select
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    className="h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring cursor-pointer"
                >
                    {CLIENT_STATUSES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b text-xs text-muted-foreground">
                                <th className="text-left font-medium px-4 py-3">Klien</th>
                                <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">Paket</th>
                                <th className="text-left font-medium px-4 py-3">Status</th>
                                <th className="text-center font-medium px-4 py-3 hidden sm:table-cell">Antrian</th>
                                <th className="text-center font-medium px-4 py-3">Link</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-sm text-muted-foreground">
                                        {bookings.length === 0 ? "Belum ada booking." : "Tidak ada hasil."}
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(b => (
                                    <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <Link href={`/bookings/${b.id}`} className="hover:underline">
                                                <p className="text-sm font-medium leading-tight">{b.client_name}</p>
                                                <p className="text-[11px] text-muted-foreground font-mono">{b.booking_code}</p>
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-sm hidden sm:table-cell">
                                            {(b.services as any)?.name || "-"}
                                        </td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={b.client_status || ""}
                                                onChange={e => updateStatus(b.id, e.target.value)}
                                                disabled={savingId === b.id}
                                                className={selectClass}
                                            >
                                                <option value="">Belum diset</option>
                                                {CLIENT_STATUSES.filter(s => s.value).map(s => (
                                                    <option key={s.value} value={s.value}>{s.label}</option>
                                                ))}
                                            </select>
                                            {b.client_status && (
                                                <span className={`ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColors[b.client_status] || "bg-muted text-muted-foreground"}`}>
                                                    {b.client_status}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center hidden sm:table-cell">
                                            <input
                                                type="number"
                                                min={0}
                                                value={b.queue_position ?? ""}
                                                onChange={e => {
                                                    const val = e.target.value === "" ? null : parseInt(e.target.value, 10);
                                                    updateQueue(b.id, val);
                                                }}
                                                placeholder="-"
                                                className={inputClass}
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {b.tracking_uuid ? (
                                                <button
                                                    onClick={() => copyTrackLink(b.tracking_uuid!, b.id)}
                                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
                                                    title="Salin link tracking klien"
                                                >
                                                    {copiedId === b.id ? (
                                                        <><ClipboardCheck className="w-3.5 h-3.5" /> Tersalin</>
                                                    ) : (
                                                        <><Copy className="w-3.5 h-3.5" /> Salin</>
                                                    )}
                                                </button>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">-</span>
                                            )}
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
