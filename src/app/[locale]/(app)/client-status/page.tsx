"use client";

import * as React from "react";
import { createClient } from "@/utils/supabase/client";
import { Activity, Copy, ClipboardCheck, Loader2, ExternalLink, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { TablePagination, paginateArray } from "@/components/ui/table-pagination";
import { useTranslations, useLocale } from "next-intl";

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

const DEFAULT_CLIENT_STATUSES = [
    "Booking Confirmed", "Sesi Foto / Acara", "Antrian Edit", "Proses Edit", "Revisi", "File Siap", "Selesai",
];

const STATUS_COLOR_PALETTE = [
    "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
    "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400",
    "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
    "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
    "bg-pink-100 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400",
    "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400",
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400",
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400",
    "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
];

export default function ClientStatusPage() {
    const supabase = createClient();
    const t = useTranslations("ClientStatus");
    const locale = useLocale(); const [bookings, setBookings] = React.useState<BookingStatus[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [filter, setFilter] = React.useState("");
    const [search, setSearch] = React.useState("");
    const [copiedId, setCopiedId] = React.useState<string | null>(null);
    const [savingId, setSavingId] = React.useState<string | null>(null);
    const [currentPage, setCurrentPage] = React.useState(1);
    const [itemsPerPage, setItemsPerPage] = React.useState(10);
    const [clientStatuses, setClientStatuses] = React.useState<string[]>(DEFAULT_CLIENT_STATUSES);

    const statusColors = React.useMemo(() => {
        const map: Record<string, string> = {};
        clientStatuses.forEach((s, i) => { map[s] = STATUS_COLOR_PALETTE[i % STATUS_COLOR_PALETTE.length]; });
        return map;
    }, [clientStatuses]);

    React.useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Load custom client statuses from profile
            const { data: profile } = await supabase.from("profiles").select("custom_client_statuses").eq("id", user.id).single();
            if (profile?.custom_client_statuses) {
                setClientStatuses(profile.custom_client_statuses as string[]);
            }

            const { data } = await supabase
                .from("bookings")
                .select("id, booking_code, client_name, client_whatsapp, session_date, status, client_status, queue_position, tracking_uuid, services(name)")
                .eq("user_id", user.id)
                .neq("status", "Batal")
                .order("created_at", { ascending: false });

            setBookings((data || []) as unknown as BookingStatus[]);
            setLoading(false);
        }
        load();
    }, []);

    async function updateStatus(id: string, clientStatus: string) {
        setSavingId(id);
        const oldBooking = bookings.find(b => b.id === id);
        const wasQueue = oldBooking?.client_status === "Antrian Edit";
        const isQueue = clientStatus === "Antrian Edit";

        if (isQueue && !wasQueue) {
            // Auto-assign: get max queue_position for current "Antrian Edit" bookings
            const maxPos = bookings
                .filter(b => b.client_status === "Antrian Edit" && b.queue_position != null)
                .reduce((max, b) => Math.max(max, b.queue_position!), 0);
            const newPos = maxPos + 1;
            await supabase.from("bookings").update({ client_status: clientStatus, queue_position: newPos }).eq("id", id);
            setBookings(prev => prev.map(b => b.id === id ? { ...b, client_status: clientStatus, queue_position: newPos } : b));
        } else if (wasQueue && !isQueue) {
            // Auto-clear: remove position and re-number remaining
            await supabase.from("bookings").update({ client_status: clientStatus || null, queue_position: null }).eq("id", id);
            const remaining = bookings
                .filter(b => b.client_status === "Antrian Edit" && b.id !== id && b.queue_position != null)
                .sort((a, b) => (a.queue_position || 0) - (b.queue_position || 0));
            for (let i = 0; i < remaining.length; i++) {
                await supabase.from("bookings").update({ queue_position: i + 1 }).eq("id", remaining[i].id);
            }
            setBookings(prev => {
                let updated = prev.map(b => b.id === id ? { ...b, client_status: clientStatus || null, queue_position: null } : b);
                remaining.forEach((r, i) => {
                    updated = updated.map(b => b.id === r.id ? { ...b, queue_position: i + 1 } : b);
                });
                return updated;
            });
        } else {
            await supabase.from("bookings").update({ client_status: clientStatus || null }).eq("id", id);
            setBookings(prev => prev.map(b => b.id === id ? { ...b, client_status: clientStatus || null } : b));
        }
        setSavingId(null);
    }

    async function updateQueue(id: string, pos: number | null) {
        await supabase.from("bookings").update({ queue_position: pos }).eq("id", id);
        setBookings(prev => prev.map(b => b.id === id ? { ...b, queue_position: pos } : b));
    }

    function copyTrackLink(uuid: string, id: string) {
        const url = `${window.location.origin}/${locale}/track/${uuid}`;
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
                    <Activity className="w-6 h-6" /> {t("title")}
                </h2>
                <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={t("cariPlaceholder")}
                        className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    />
                </div>
                <select
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    className="h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring cursor-pointer"
                >
                    <option value="">Semua</option>
                    {clientStatuses.map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
                {filtered.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">{bookings.length === 0 ? t("belumAdaBooking") : t("tidakAdaHasil")}</div>
                ) : paginateArray(filtered, currentPage, itemsPerPage).map(b => (
                    <div key={b.id} className="rounded-xl border bg-card shadow-sm p-4 space-y-3">
                        <div className="flex items-start justify-between">
                            <Link href={`/bookings/${b.id}`} className="hover:underline">
                                <p className="font-semibold">{b.client_name}</p>
                                <p className="text-xs text-muted-foreground">{b.booking_code}</p>
                            </Link>
                            {b.client_status && (
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColors[b.client_status] || "bg-muted text-muted-foreground"}`}>
                                    {b.client_status}
                                </span>
                            )}
                        </div>
                        <div className="border-t pt-2 space-y-2">
                            <div className="flex items-center gap-3">
                                <label className="text-xs text-muted-foreground shrink-0 w-14">Status</label>
                                <select value={b.client_status || ""} onChange={e => updateStatus(b.id, e.target.value)} disabled={savingId === b.id} className={`${selectClass} flex-1`}>
                                    <option value="">{t("belumDiset")}</option>
                                    {clientStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="text-xs text-muted-foreground shrink-0 w-14">{t("antrian")}</label>
                                <input type="number" min={0} value={b.queue_position ?? ""} onChange={e => updateQueue(b.id, e.target.value === "" ? null : parseInt(e.target.value, 10))} placeholder="-" className={`${inputClass} flex-1`} />
                            </div>
                        </div>
                        <div className="flex items-center gap-1 pt-1 border-t">
                            {b.tracking_uuid && (
                                <>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500" title={t("bukaLink")} onClick={() => window.open(`${window.location.origin}/${locale}/track/${b.tracking_uuid}`, "_blank")}>
                                        <ExternalLink className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-violet-500" title={t("salinLink")} onClick={() => copyTrackLink(b.tracking_uuid!, b.id)}>
                                        {copiedId === b.id ? <ClipboardCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Desktop Table */}
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden hidden md:block">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="text-[11px] uppercase bg-muted/30 border-b">
                            <tr>
                                <th className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{locale === "en" ? "Client" : "Klien"}</th>
                                <th className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap hidden sm:table-cell">{locale === "en" ? "Package" : "Paket"}</th>
                                <th className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap">{locale === "en" ? "Status" : "Status"}</th>
                                <th className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap text-center hidden sm:table-cell">{t("antrian")}</th>
                                <th className="px-4 py-3 font-semibold text-muted-foreground whitespace-nowrap text-right">{t("aksi")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-sm text-muted-foreground">
                                        {bookings.length === 0 ? t("belumAdaBooking") : t("tidakAdaHasil")}
                                    </td>
                                </tr>
                            ) : (
                                paginateArray(filtered, currentPage, itemsPerPage).map(b => (
                                    <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <Link href={`/bookings/${b.id}`} className="hover:underline">
                                                <p className="text-sm font-medium leading-tight">{b.client_name}</p>
                                                <p className="text-[11px] text-muted-foreground">{b.booking_code}</p>
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-sm hidden sm:table-cell text-muted-foreground">
                                            {(b.services as any)?.name || "-"}
                                        </td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={b.client_status || ""}
                                                onChange={e => updateStatus(b.id, e.target.value)}
                                                disabled={savingId === b.id}
                                                className={selectClass}
                                            >
                                                <option value="">{t("belumDiset")}</option>
                                                {clientStatuses.map(s => (
                                                    <option key={s} value={s}>{s}</option>
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
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {b.tracking_uuid && (
                                                    <>
                                                        <Button
                                                            variant="ghost" size="icon"
                                                            className={`h-8 w-8 ${copiedId === b.id ? "text-green-500" : "text-slate-500 hover:text-slate-700"}`}
                                                            title={t("salinLinkTracking")}
                                                            onClick={() => copyTrackLink(b.tracking_uuid!, b.id)}
                                                        >
                                                            {copiedId === b.id ? <ClipboardCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                        </Button>
                                                        <Button
                                                            variant="ghost" size="icon"
                                                            className="h-8 w-8 text-blue-500 hover:text-blue-600"
                                                            title={t("bukaTracking")}
                                                            onClick={() => window.open(`/${locale}/track/${b.tracking_uuid}`, "_blank")}
                                                        >
                                                            <ExternalLink className="w-4 h-4" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <TablePagination totalItems={filtered.length} currentPage={currentPage} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} />
            </div>
        </div>
    );
}
