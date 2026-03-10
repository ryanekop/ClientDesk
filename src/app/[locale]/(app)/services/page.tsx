"use client";

import * as React from "react";
import { Plus, Edit2, Trash2, Package, ToggleLeft, ToggleRight, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";

type Service = {
    id: string;
    name: string;
    description: string | null;
    price: number;
    duration_minutes: number | null;
    is_active: boolean;
    created_at: string;
};

export default function ServicesPage() {
    const supabase = createClient();
    const t = useTranslations("Services");
    const [services, setServices] = React.useState<Service[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [editingService, setEditingService] = React.useState<Service | null>(null);
    const [isAddOpen, setIsAddOpen] = React.useState(false);
    const [isEditOpen, setIsEditOpen] = React.useState(false);

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
            duration_minutes: parseInt(formData.get("duration_minutes") as string) || 120,
            is_active: true,
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
                duration_minutes: parseInt(formData.get("duration_minutes") as string) || 120,
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
        if (!confirm("Hapus layanan ini? Booking yang sudah terhubung akan kehilangan referensi layanan.")) return;
        await supabase.from("services").delete().eq("id", id);
        fetchServices();
    }

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

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
                                <input name="name" required placeholder="Misal: Wedding Photography"
                                    className="placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t("deskripsi")}</label>
                                <textarea name="description" rows={3} placeholder="Deskripsi singkat layanan..."
                                    className="placeholder:text-muted-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t("harga")}</label>
                                <input name="price" type="number" min="0" step="1000" required placeholder="2500000"
                                    className="placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Durasi (menit)</label>
                                <input name="duration_minutes" type="number" min="15" step="15" defaultValue={120} placeholder="120"
                                    className="placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" />
                                <p className="text-xs text-muted-foreground">Durasi sesi yang akan digunakan di kalender</p>
                            </div>
                            <DialogFooter>
                                <Button type="submit">{t("simpan")}</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

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
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {services.map((service) => (
                        <div key={service.id} className="rounded-xl border bg-card text-card-foreground shadow-sm p-5 flex flex-col gap-3 relative">
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

                            <div className="flex items-center gap-3">
                                <div className="text-xl font-bold">{formatCurrency(service.price)}</div>
                                {service.duration_minutes && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {service.duration_minutes >= 60 ? `${Math.floor(service.duration_minutes / 60)} jam${service.duration_minutes % 60 ? ` ${service.duration_minutes % 60} mnt` : ""}` : `${service.duration_minutes} mnt`}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t">
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
            )}

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) setEditingService(null); }}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{t("editTitle")}</DialogTitle>
                        <DialogDescription>Perubahan akan langsung tersimpan.</DialogDescription>
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
                                <label className="text-sm font-medium">Durasi (menit)</label>
                                <input name="duration_minutes" type="number" min="15" step="15" defaultValue={editingService.duration_minutes || 120}
                                    className="placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" />
                                <p className="text-xs text-muted-foreground">Durasi sesi yang akan digunakan di kalender</p>
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
