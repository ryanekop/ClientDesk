"use client";

import * as React from "react";
import { Plus, Edit2, Trash2, Package, ToggleLeft, ToggleRight, Loader2, Clock, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import { TablePagination, paginateArray } from "@/components/ui/table-pagination";


type Service = {
    id: string;
    name: string;
    description: string | null;
    price: number;
    original_price: number | null;
    duration_minutes: number | null;
    is_active: boolean;
    created_at: string;
    event_types: string[] | null;
};

const EVENT_TYPES = ["Umum", "Wedding", "Akad", "Resepsi", "Lamaran", "Prewedding", "Wisuda", "Maternity", "Newborn", "Family", "Komersil", "Lainnya"];

export default function ServicesPage() {
    const supabase = createClient();
    const t = useTranslations("Services");
    const ts = useTranslations("ServicesPage");
    const [services, setServices] = React.useState<Service[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [editingService, setEditingService] = React.useState<Service | null>(null);
    const [isAddOpen, setIsAddOpen] = React.useState(false);
    const [isEditOpen, setIsEditOpen] = React.useState(false);
    const [currentPage, setCurrentPage] = React.useState(1);
    const [itemsPerPage, setItemsPerPage] = React.useState(10);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [selectedEventFilter, setSelectedEventFilter] = React.useState("");

    React.useEffect(() => { fetchServices(); }, []);

    async function fetchServices() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from("services")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        setServices((data || []) as Service[]);
        setLoading(false);
    }

    async function handleAdd(formData: FormData) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase.from("services").insert({
            user_id: user.id,
            name: formData.get("name") as string,
            description: formData.get("description") as string || null,
            price: parseFloat(formData.get("price") as string) || 0,
            original_price: parseFloat(formData.get("original_price") as string) || null,
            duration_minutes: parseInt(formData.get("duration_hours") as string || "0") * 60 + parseInt(formData.get("duration_mins") as string || "0"),
            is_active: true,
            event_types: formData.getAll("event_types").length > 0 ? formData.getAll("event_types") as string[] : null,
        });

        if (!error) {
            setIsAddOpen(false);
            fetchServices();
        }
    }

    async function handleEdit(formData: FormData) {
        if (!editingService) return;

        const { error } = await supabase
            .from("services")
            .update({
                name: formData.get("name") as string,
                description: formData.get("description") as string || null,
                price: parseFloat(formData.get("price") as string) || 0,
                original_price: parseFloat(formData.get("original_price") as string) || null,
                duration_minutes: parseInt(formData.get("duration_hours") as string || "0") * 60 + parseInt(formData.get("duration_mins") as string || "0"),
                event_types: formData.getAll("event_types").length > 0 ? formData.getAll("event_types") as string[] : null,
            })
            .eq("id", editingService.id);

        if (!error) {
            setIsEditOpen(false);
            setEditingService(null);
            fetchServices();
        }
    }

    async function handleToggleActive(service: Service) {
        await supabase
            .from("services")
            .update({ is_active: !service.is_active })
            .eq("id", service.id);
        fetchServices();
    }

    async function handleDelete(id: string) {
        if (!confirm(ts("deleteConfirm"))) return;
        await supabase.from("services").delete().eq("id", id);
        fetchServices();
    }

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

    // ── Filter & search logic ──
    const filteredServices = React.useMemo(() => {
        let result = services;
        // Filter by event type category
        if (selectedEventFilter) {
            result = result.filter(s =>
                s.event_types && s.event_types.includes(selectedEventFilter)
            );
        }
        // Filter by search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(s =>
                s.name.toLowerCase().includes(q) ||
                (s.description && s.description.toLowerCase().includes(q))
            );
        }
        return result;
    }, [services, searchQuery, selectedEventFilter]);

    // Reset to page 1 when filters change
    React.useEffect(() => { setCurrentPage(1); }, [searchQuery, selectedEventFilter]);

    // Collect unique event types that actually exist in services
    const usedEventTypes = React.useMemo(() => {
        const set = new Set<string>();
        services.forEach(s => s.event_types?.forEach(et => set.add(et)));
        return EVENT_TYPES.filter(et => set.has(et));
    }, [services]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
                    <p className="text-muted-foreground">{t("subtitle")}</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="w-4 h-4" /> {t("tambah")}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>{t("tambahTitle")}</DialogTitle>
                            <DialogDescription>{t("tambahDesc")}</DialogDescription>
                        </DialogHeader>
                        <form action={(fd) => handleAdd(fd)} className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t("namaLayanan")}</label>
                                <input name="name" required placeholder="e.g.: Wedding Photography"
                                    className="placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t("deskripsi")}</label>
                                <textarea name="description" rows={3} placeholder={ts("descPlaceholder")}
                                    className="placeholder:text-muted-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t("harga")}</label>
                                <input name="price" type="number" min="0" step="1000" required placeholder="2500000"
                                    className="placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Harga Coret <span className="text-xs text-muted-foreground font-normal">(opsional)</span></label>
                                <input name="original_price" type="number" min="0" step="1000" placeholder="3500000"
                                    className="placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{ts("duration")}</label>
                                <div className="flex items-center gap-2">
                                    <input name="duration_hours" type="number" min="0" max="24" defaultValue={2} placeholder="0"
                                        className="placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-20 min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" />
                                    <span className="text-sm text-muted-foreground">{ts("hours")}</span>
                                    <input name="duration_mins" type="number" min="0" max="59" step="5" defaultValue={0} placeholder="0"
                                        className="placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-20 min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" />
                                    <span className="text-sm text-muted-foreground">{ts("minutes")}</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Jenis Acara</label>
                                <p className="text-[11px] text-muted-foreground -mt-1">Kosongkan jika paket ini untuk semua jenis acara.</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {EVENT_TYPES.map(et => (
                                        <label key={et} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs cursor-pointer hover:bg-muted/50 transition-colors has-[:checked]:border-foreground has-[:checked]:bg-foreground/5">
                                            <input type="checkbox" name="event_types" value={et} className="accent-foreground w-3 h-3" />
                                            {et}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit">{t("simpan")}</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Search + Filter */}
            {!loading && services.length > 0 && (
                <div className="space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={ts("searchPlaceholder")}
                            className="placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent pl-9 pr-8 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    {usedEventTypes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            <button
                                onClick={() => setSelectedEventFilter("")}
                                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${!selectedEventFilter ? "bg-foreground text-background border-foreground" : "bg-transparent text-muted-foreground border-input hover:bg-muted/50"}`}
                            >
                                {ts("allCategories")}
                            </button>
                            {usedEventTypes.map(et => (
                                <button
                                    key={et}
                                    onClick={() => setSelectedEventFilter(selectedEventFilter === et ? "" : et)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${selectedEventFilter === et ? "bg-foreground text-background border-foreground" : "bg-transparent text-muted-foreground border-input hover:bg-muted/50"}`}
                                >
                                    {et}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : services.length === 0 ? (
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-12 text-center">
                    <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="font-semibold text-lg mb-1">{t("belumAda")}</h3>
                    <p className="text-muted-foreground text-sm">{t("belumAdaDesc")}</p>
                </div>
            ) : filteredServices.length === 0 ? (
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-12 text-center">
                    <Search className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="font-semibold text-lg mb-1">{ts("noResults")}</h3>
                    <p className="text-muted-foreground text-sm">{ts("noResultsDesc")}</p>
                </div>
            ) : (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {paginateArray(filteredServices, currentPage, itemsPerPage).map((service) => (
                            <div key={service.id} className="rounded-xl border bg-card text-card-foreground shadow-sm p-5 flex flex-col relative">
                                {/* Active badge */}
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-base">{service.name}</h3>
                                        {service.description && (
                                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{service.description}</p>
                                        )}
                                    </div>
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ml-2 ${service.is_active
                                        ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                                        : "bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                                        }`}>
                                        {service.is_active ? t("aktif") : t("nonaktif")}
                                    </span>
                                </div>

                                {service.event_types && service.event_types.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {service.event_types.map(et => (
                                            <span key={et} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">{et}</span>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center gap-3 mt-3">
                                    <div className="text-xl font-bold">{formatCurrency(service.price)}</div>
                                    {service.original_price && service.original_price > service.price && (
                                        <div className="text-sm text-muted-foreground line-through">{formatCurrency(service.original_price)}</div>
                                    )}
                                    {service.duration_minutes && (
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {service.duration_minutes >= 60 ? `${Math.floor(service.duration_minutes / 60)} ${ts("hourShort")}${service.duration_minutes % 60 ? ` ${service.duration_minutes % 60} ${ts("minuteShort")}` : ""}` : `${service.duration_minutes} ${ts("minuteShort")}`}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 pt-2 border-t mt-auto">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1.5 flex-1"
                                        onClick={() => {
                                            setEditingService(service);
                                            setIsEditOpen(true);
                                        }}
                                    >
                                        <Edit2 className="w-3.5 h-3.5" /> Edit
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1.5"
                                        onClick={() => handleToggleActive(service)}
                                        title={service.is_active ? t("nonaktif") : t("aktif")}
                                    >
                                        {service.is_active
                                            ? <ToggleRight className="w-4 h-4 text-green-600" />
                                            : <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                                        }
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1.5"
                                        onClick={() => handleDelete(service.id)}
                                    >
                                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <TablePagination totalItems={filteredServices.length} currentPage={currentPage} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} />
                </>
            )}

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) setEditingService(null); }}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{t("editTitle")}</DialogTitle>
                        <DialogDescription>{ts("editDesc")}</DialogDescription>
                    </DialogHeader>
                    {editingService && (
                        <form action={(fd) => handleEdit(fd)} className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t("namaLayanan")}</label>
                                <input name="name" required defaultValue={editingService.name}
                                    className="placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t("deskripsi")}</label>
                                <textarea name="description" rows={3} defaultValue={editingService.description || ""}
                                    className="placeholder:text-muted-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t("harga")}</label>
                                <input name="price" type="number" min="0" step="1000" required defaultValue={editingService.price}
                                    className="placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Harga Coret <span className="text-xs text-muted-foreground font-normal">(opsional)</span></label>
                                <input name="original_price" type="number" min="0" step="1000" defaultValue={editingService.original_price || ""}
                                    className="placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{ts("duration")}</label>
                                <div className="flex items-center gap-2">
                                    <input name="duration_hours" type="number" min="0" max="24" defaultValue={Math.floor((editingService.duration_minutes || 120) / 60)}
                                        className="placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-20 min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" />
                                    <span className="text-sm text-muted-foreground">{ts("hours")}</span>
                                    <input name="duration_mins" type="number" min="0" max="59" step="5" defaultValue={(editingService.duration_minutes || 120) % 60}
                                        className="placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-20 min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" />
                                    <span className="text-sm text-muted-foreground">{ts("minutes")}</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Jenis Acara</label>
                                <p className="text-[11px] text-muted-foreground -mt-1">Kosongkan jika paket ini untuk semua jenis acara.</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {EVENT_TYPES.map(et => (
                                        <label key={et} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs cursor-pointer hover:bg-muted/50 transition-colors has-[:checked]:border-foreground has-[:checked]:bg-foreground/5">
                                            <input type="checkbox" name="event_types" value={et} defaultChecked={editingService.event_types?.includes(et)} className="accent-foreground w-3 h-3" />
                                            {et}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit">{t("perbarui")}</Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
