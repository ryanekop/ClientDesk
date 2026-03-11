"use client";

import * as React from "react";
import { Plus, Edit2, Trash2, Users, MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import { TablePagination, paginateArray } from "@/components/ui/table-pagination";


type Freelancer = {
    id: string;
    name: string;
    role: string;
    whatsapp_number: string | null;
    google_email: string | null;
    status: string;
    created_at: string;
};

const roleOptions = ["Photographer", "Videographer", "MUA", "WCC", "Editor", "Asisten", "Lainnya"];

export default function TeamPage() {
    const supabase = createClient();
    const t = useTranslations("Team");
    const tt = useTranslations("TeamPage");
    const [members, setMembers] = React.useState<Freelancer[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [editingMember, setEditingMember] = React.useState<Freelancer | null>(null);
    const [isAddOpen, setIsAddOpen] = React.useState(false);
    const [isEditOpen, setIsEditOpen] = React.useState(false);
    const [currentPage, setCurrentPage] = React.useState(1);
    const [itemsPerPage, setItemsPerPage] = React.useState(10);

    React.useEffect(() => { fetchMembers(); }, []);

    async function fetchMembers() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from("freelance")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        setMembers((data || []) as Freelancer[]);
        setLoading(false);
    }

    async function handleAdd(formData: FormData) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase.from("freelance").insert({
            user_id: user.id,
            name: formData.get("name") as string,
            role: formData.get("role") as string,
            whatsapp_number: formData.get("whatsapp_number") as string || null,
            google_email: formData.get("google_email") as string || null,
            status: "active",
        });

        if (!error) { setIsAddOpen(false); fetchMembers(); }
    }

    async function handleEdit(formData: FormData) {
        if (!editingMember) return;

        const { error } = await supabase
            .from("freelance")
            .update({
                name: formData.get("name") as string,
                role: formData.get("role") as string,
                whatsapp_number: formData.get("whatsapp_number") as string || null,
                google_email: formData.get("google_email") as string || null,
            })
            .eq("id", editingMember.id);

        if (!error) { setIsEditOpen(false); setEditingMember(null); fetchMembers(); }
    }

    async function handleToggleStatus(member: Freelancer) {
        await supabase
            .from("freelance")
            .update({ status: member.status === "active" ? "inactive" : "active" })
            .eq("id", member.id);
        fetchMembers();
    }

    async function handleDelete(id: string) {
        if (!confirm(tt("deleteConfirm"))) return;
        await supabase.from("freelance").delete().eq("id", id);
        fetchMembers();
    }

    function sendWhatsApp(phone: string | null, name: string) {
        if (!phone) return;
        const cleaned = phone.replace(/^0/, "62").replace(/[^0-9]/g, "");
        window.open(`https://api.whatsapp.com/send?phone=${cleaned}&text=${encodeURIComponent(`${tt("hello")} ${name}!`)}`, "_blank");
    }

    const inputClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
                    <p className="text-muted-foreground">{t("subtitle")}</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2"><Plus className="w-4 h-4" /> {t("tambah")}</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>{t("tambahTitle")}</DialogTitle>
                            <DialogDescription>{t("tambahDesc")}</DialogDescription>
                        </DialogHeader>
                        <form action={(fd) => handleAdd(fd)} className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t("nama")}</label>
                                <input name="name" required placeholder={tt("namePlaceholder")} className={inputClass} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t("peran")}</label>
                                <select name="role" required className={inputClass}>
                                    <option value="">{t("pilihPeran")}</option>
                                    {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t("whatsapp")}</label>
                                <input name="whatsapp_number" type="tel" placeholder="08123456789" className={inputClass} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Google Email</label>
                                <input name="google_email" type="email" placeholder={tt("googleEmailPlaceholder")} className={inputClass} />
                            </div>
                            <DialogFooter><Button type="submit">{t("simpan")}</Button></DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : members.length === 0 ? (
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-12 text-center">
                    <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="font-semibold text-lg mb-1">{t("belumAda")}</h3>
                    <p className="text-muted-foreground text-sm">{t("belumAdaDesc")}</p>
                </div>
            ) : (
                <>
                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-3">
                        {paginateArray(members, currentPage, itemsPerPage).map((member) => (
                            <div key={member.id} className="rounded-xl border bg-card shadow-sm p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium shrink-0">
                                        {member.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold">{member.name}</p>
                                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{member.role}</span>
                                    </div>
                                    <button onClick={() => handleToggleStatus(member)}
                                        className={`text-xs font-medium px-2 py-0.5 rounded-full cursor-pointer ${member.status === "active"
                                            ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                                            : "bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400"}`}>
                                        {member.status === "active" ? t("aktif") : t("nonaktif")}
                                    </button>
                                </div>
                                {member.whatsapp_number && <p className="text-xs text-muted-foreground">{member.whatsapp_number}</p>}
                                <div className="flex items-center gap-1 pt-1 border-t">
                                    <button title={tt("sendWA")} onClick={() => sendWhatsApp(member.whatsapp_number, member.name)} className="p-1.5 rounded-md hover:bg-muted/50 cursor-pointer">
                                        <MessageCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                                    </button>
                                    <button title="Edit" onClick={() => { setEditingMember(member); setIsEditOpen(true); }} className="p-1.5 rounded-md hover:bg-muted/50 cursor-pointer">
                                        <Edit2 className="w-4 h-4 text-blue-500" />
                                    </button>
                                    <button title="Hapus" onClick={() => handleDelete(member.id)} className="p-1.5 rounded-md hover:bg-muted/50 cursor-pointer">
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop Table */}
                    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden hidden md:block">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs uppercase bg-muted/50 border-b">
                                    <tr>
                                        <th className="px-6 py-4 font-medium text-muted-foreground">{t("nama")}</th>
                                        <th className="px-6 py-4 font-medium text-muted-foreground">{t("peran")}</th>
                                        <th className="px-6 py-4 font-medium text-muted-foreground">{t("whatsapp")}</th>
                                        <th className="px-6 py-4 font-medium text-muted-foreground">{t("status")}</th>
                                        <th className="px-6 py-4 font-medium text-muted-foreground text-right">{t("aksi")}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {paginateArray(members, currentPage, itemsPerPage).map((member) => (
                                        <tr key={member.id} className="hover:bg-muted/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium text-sm shrink-0">
                                                        {member.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="font-medium">{member.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                                    {member.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">{member.whatsapp_number || "-"}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <button
                                                    onClick={() => handleToggleStatus(member)}
                                                    className={`text-xs font-medium px-2 py-0.5 rounded-full cursor-pointer transition-colors ${member.status === "active"
                                                        ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-500/20"
                                                        : "bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/20"
                                                        }`}
                                                >
                                                    {member.status === "active" ? t("aktif") : t("nonaktif")}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button title={tt("sendWA")} onClick={() => sendWhatsApp(member.whatsapp_number, member.name)} className="p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer">
                                                        <MessageCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                                                    </button>
                                                    <button title="Edit" onClick={() => { setEditingMember(member); setIsEditOpen(true); }} className="p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer">
                                                        <Edit2 className="w-4 h-4 text-muted-foreground" />
                                                    </button>
                                                    <button title="Hapus" onClick={() => handleDelete(member.id)} className="p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-pointer">
                                                        <Trash2 className="w-4 h-4 text-red-500" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <TablePagination totalItems={members.length} currentPage={currentPage} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} />
                    </div>
                </>
            )}

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) setEditingMember(null); }}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{t("editTitle")}</DialogTitle>
                        <DialogDescription>{tt("editDesc")}</DialogDescription>
                    </DialogHeader>
                    {editingMember && (
                        <form action={(fd) => handleEdit(fd)} className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t("nama")}</label>
                                <input name="name" required defaultValue={editingMember.name} className={inputClass} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t("peran")}</label>
                                <select name="role" required defaultValue={editingMember.role} className={inputClass}>
                                    {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t("whatsapp")}</label>
                                <input name="whatsapp_number" type="tel" defaultValue={editingMember.whatsapp_number || ""} className={inputClass} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Google Email</label>
                                <input name="google_email" type="email" defaultValue={editingMember.google_email || ""} placeholder={tt("googleEmailPlaceholder")} className={inputClass} />
                            </div>
                            <DialogFooter><Button type="submit">{t("perbarui")}</Button></DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
