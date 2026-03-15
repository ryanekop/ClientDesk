"use client";

import * as React from "react";
import { Plus, Edit2, Trash2, Users, MessageCircle, Loader2, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionConfirmDialog } from "@/components/ui/action-confirm-dialog";
import { ActionIconButton } from "@/components/ui/action-icon-button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import { TablePagination, paginateArray } from "@/components/ui/table-pagination";
import { TableColumnManager } from "@/components/ui/table-column-manager";
import {
    lockBoundaryColumns,
    mergeTableColumnPreferences,
    updateTableColumnPreferenceMap,
    type TableColumnPreference,
} from "@/lib/table-column-prefs";
import { buildWhatsAppUrl, openWhatsAppUrl } from "@/utils/whatsapp-link";


type Freelancer = {
    id: string;
    name: string;
    role: string;
    whatsapp_number: string | null;
    google_email: string | null;
    status: string;
    tags: string[];
    created_at: string;
};

type TagInputProps = {
    tags: string[];
    setTags: (tags: string[]) => void;
    input: string;
    setInput: (value: string) => void;
    inputClass: string;
};

const roleOptions = ["Photographer", "Videographer", "MUA", "WCC", "Editor", "Asisten", "Lainnya"];

const COUNTRY_CODES = [
    { code: "+62", flag: "🇮🇩" },
    { code: "+60", flag: "🇲🇾" },
    { code: "+65", flag: "🇸🇬" },
    { code: "+66", flag: "🇹🇭" },
    { code: "+1", flag: "🇺🇸" },
    { code: "+44", flag: "🇬🇧" },
    { code: "+81", flag: "🇯🇵" },
    { code: "+82", flag: "🇰🇷" },
    { code: "+61", flag: "🇦🇺" },
];

const TEAM_COLUMN_DEFAULTS: TableColumnPreference[] = lockBoundaryColumns([
    { id: "name", label: "Nama", visible: true, locked: true },
    { id: "role", label: "Peran", visible: true },
    { id: "whatsapp", label: "Whatsapp", visible: true },
    { id: "status", label: "Status", visible: true },
    { id: "actions", label: "Aksi", visible: true, locked: true },
]);

function TagInput({ tags, setTags, input, setInput, inputClass }: TagInputProps) {
    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">Tag</label>
            <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                {tags.map((tag, i) => (
                    <span key={i} className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {tag}
                        <button type="button" onClick={() => setTags(tags.filter((_, j) => j !== i))} className="hover:text-red-500 cursor-pointer"><X className="w-3 h-3" /></button>
                    </span>
                ))}
            </div>
            <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
                        e.preventDefault();
                        if (!tags.includes(input.trim())) setTags([...tags, input.trim()]);
                        setInput("");
                    }
                }}
                placeholder="Ketik tag lalu Enter..."
                className={inputClass}
            />
        </div>
    );
}

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
    const [addCountryCode, setAddCountryCode] = React.useState("+62");
    const [editCountryCode, setEditCountryCode] = React.useState("+62");
    const [addTags, setAddTags] = React.useState<string[]>([]);
    const [editTags, setEditTags] = React.useState<string[]>([]);
    const [tagInput, setTagInput] = React.useState("");
    const [editTagInput, setEditTagInput] = React.useState("");
    const [searchQuery, setSearchQuery] = React.useState("");
    const [tagFilter, setTagFilter] = React.useState("All");
    const [columns, setColumns] = React.useState<TableColumnPreference[]>(TEAM_COLUMN_DEFAULTS);
    const [columnManagerOpen, setColumnManagerOpen] = React.useState(false);
    const [savingColumns, setSavingColumns] = React.useState(false);
    const [deleteConfirmDialog, setDeleteConfirmDialog] = React.useState<{
        open: boolean;
        member: Freelancer | null;
    }>({ open: false, member: null });

    const fetchMembers = React.useCallback(async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from("freelance")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        const { data: profile } = await supabase
            .from("profiles")
            .select("table_column_preferences")
            .eq("id", user.id)
            .single();
        const profilePrefs = (profile as { table_column_preferences?: { team?: TableColumnPreference[] } | null } | null)?.table_column_preferences?.team;

        setColumns(
            mergeTableColumnPreferences(
                TEAM_COLUMN_DEFAULTS,
                profilePrefs,
            ),
        );
        setMembers(((data || []) as Freelancer[]).map((d) => ({ ...d, tags: d.tags || [] })));
        setLoading(false);
    }, [supabase]);

    React.useEffect(() => { void fetchMembers(); }, [fetchMembers]);

    async function handleAdd(formData: FormData) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const rawWa = formData.get("whatsapp_number") as string;
        const fullWa = rawWa ? `${addCountryCode}${rawWa}`.replace(/[^0-9+]/g, "") : null;

        const { error } = await supabase.from("freelance").insert({
            user_id: user.id,
            name: formData.get("name") as string,
            role: formData.get("role") as string,
            whatsapp_number: fullWa || null,
            google_email: formData.get("google_email") as string || null,
            status: "active",
            tags: addTags,
        });

        if (!error) { setIsAddOpen(false); setAddTags([]); setTagInput(""); fetchMembers(); }
    }

    async function handleEdit(formData: FormData) {
        if (!editingMember) return;

        const rawWa = formData.get("whatsapp_number") as string;
        const fullWa = rawWa ? `${editCountryCode}${rawWa}`.replace(/[^0-9+]/g, "") : null;

        const { error } = await supabase
            .from("freelance")
            .update({
                name: formData.get("name") as string,
                role: formData.get("role") as string,
                whatsapp_number: fullWa || null,
                google_email: formData.get("google_email") as string || null,
                tags: editTags,
            })
            .eq("id", editingMember.id);

        if (!error) { setIsEditOpen(false); setEditingMember(null); setEditTags([]); setEditTagInput(""); fetchMembers(); }
    }

    async function handleToggleStatus(member: Freelancer) {
        await supabase
            .from("freelance")
            .update({ status: member.status === "active" ? "inactive" : "active" })
            .eq("id", member.id);
        fetchMembers();
    }

    function handleDelete(id: string) {
        const member = members.find((item) => item.id === id);
        if (!member) return;
        setDeleteConfirmDialog({ open: true, member });
    }

    async function confirmDeleteMember() {
        const member = deleteConfirmDialog.member;
        if (!member) return;
        setDeleteConfirmDialog({ open: false, member: null });
        await supabase.from("freelance").delete().eq("id", member.id);
        fetchMembers();
    }

    function sendWhatsApp(phone: string | null) {
        if (!phone) return;
        const cleaned = phone.replace(/^0/, "62").replace(/[^0-9]/g, "");
        openWhatsAppUrl(buildWhatsAppUrl(cleaned));
    }

    const selectFilterClass = "h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring cursor-pointer";
    const inputClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

    const allTags = React.useMemo(() => Array.from(new Set(members.flatMap(m => m.tags))).sort(), [members]);

    const filteredMembers = React.useMemo(() => {
        return members.filter(m => {
            const q = searchQuery.toLowerCase();
            const matchSearch = !searchQuery || m.name.toLowerCase().includes(q) || m.role.toLowerCase().includes(q);
            const matchTag = tagFilter === "All" || m.tags.includes(tagFilter);
            return matchSearch && matchTag;
        });
    }, [members, searchQuery, tagFilter]);

    const orderedVisibleColumns = React.useMemo(
        () => columns.filter((column) => column.visible),
        [columns],
    );

    async function saveColumnPreferences(nextColumns: TableColumnPreference[]) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setSavingColumns(true);
        const { data: profile } = await supabase
            .from("profiles")
            .select("table_column_preferences")
            .eq("id", user.id)
            .single();
        const payload = updateTableColumnPreferenceMap(
            profile?.table_column_preferences,
            "team",
            nextColumns,
        );
        await supabase
            .from("profiles")
            .update({ table_column_preferences: payload })
            .eq("id", user.id);
        setColumns(nextColumns);
        setSavingColumns(false);
        setColumnManagerOpen(false);
    }

    function renderDesktopHeader(column: TableColumnPreference) {
        switch (column.id) {
            case "name":
                return <th key={column.id} className="px-6 py-4 font-medium text-muted-foreground">{t("nama")}</th>;
            case "role":
                return <th key={column.id} className="px-6 py-4 font-medium text-muted-foreground">{t("peran")}</th>;
            case "whatsapp":
                return <th key={column.id} className="px-6 py-4 font-medium text-muted-foreground">{t("whatsapp")}</th>;
            case "status":
                return <th key={column.id} className="px-6 py-4 font-medium text-muted-foreground">{t("status")}</th>;
            case "actions":
                return <th key={column.id} className="min-w-[120px] px-4 py-4 font-medium text-muted-foreground text-right">{t("aksi")}</th>;
            default:
                return null;
        }
    }

    function renderDesktopCell(member: Freelancer, column: TableColumnPreference) {
        switch (column.id) {
            case "name":
                return (
                    <td key={column.id} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium text-sm shrink-0">
                                {member.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium">{member.name}</span>
                        </div>
                    </td>
                );
            case "role":
                return (
                    <td key={column.id} className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {member.role}
                        </span>
                        {member.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                                {member.tags.map((tag, i) => (
                                    <span key={i} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{tag}</span>
                                ))}
                            </div>
                        )}
                    </td>
                );
            case "whatsapp":
                return <td key={column.id} className="px-6 py-4 whitespace-nowrap">{member.whatsapp_number || "-"}</td>;
            case "status":
                return (
                    <td key={column.id} className="px-6 py-4 whitespace-nowrap">
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
                );
            case "actions":
                return (
                    <td key={column.id} className="min-w-[120px] px-4 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2.5 pr-2">
                            <ActionIconButton tone="green" title={tt("sendWA")} onClick={() => sendWhatsApp(member.whatsapp_number)}>
                                <MessageCircle className="w-4 h-4" />
                            </ActionIconButton>
                            <ActionIconButton tone="indigo" title="Edit" onClick={() => {
                                setEditingMember(member);
                                setEditTags(member.tags || []);
                                const wa = member.whatsapp_number || "";
                                const match = COUNTRY_CODES.find(c => wa.startsWith(c.code));
                                setEditCountryCode(match ? match.code : "+62");
                                setIsEditOpen(true);
                            }}>
                                <Edit2 className="w-4 h-4" />
                            </ActionIconButton>
                            <ActionIconButton tone="red" title="Hapus" onClick={() => handleDelete(member.id)}>
                                <Trash2 className="w-4 h-4" />
                            </ActionIconButton>
                        </div>
                    </td>
                );
            default:
                return null;
        }
    }

    function renderMobileValue(member: Freelancer, column: TableColumnPreference) {
        switch (column.id) {
            case "role":
                return member.role;
            case "whatsapp":
                return member.whatsapp_number || "-";
            case "status":
                return member.status === "active" ? t("aktif") : t("nonaktif");
            default:
                return "-";
        }
    }

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
                                <div className="flex gap-2">
                                    <select value={addCountryCode} onChange={e => setAddCountryCode(e.target.value)} className={inputClass + " !w-28 shrink-0 cursor-pointer"}>
                                        {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                                    </select>
                                    <input name="whatsapp_number" type="tel" placeholder="8123456789"
                                        onChange={e => {
                                            const val = e.target.value.replace(/[^0-9]/g, "");
                                            e.target.value = val.startsWith("0") ? val.slice(1) : val.startsWith("62") ? val.slice(2) : val;
                                        }}
                                        className={inputClass} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Google Email</label>
                                <input name="google_email" type="email" placeholder={tt("googleEmailPlaceholder")} className={inputClass} />
                            </div>
                            <TagInput tags={addTags} setTags={setAddTags} input={tagInput} setInput={setTagInput} inputClass={inputClass} />
                            <DialogFooter><Button type="submit">{t("simpan")}</Button></DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Search + Filter */}
            {!loading && members.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Cari nama atau peran..."
                            className="placeholder:text-muted-foreground dark:bg-input/30 border-input h-10 w-full min-w-0 rounded-lg border bg-transparent pl-9 pr-8 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    {allTags.length > 0 && (
                        <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} className={selectFilterClass}>
                            <option value="All">Semua Tag</option>
                            {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
                        </select>
                    )}
                    <TableColumnManager
                        title="Kelola Kolom Tim/Freelance"
                        description="Atur kolom yang tampil di tabel tim atau freelance. Kolom Nama dan Aksi selalu terkunci."
                        columns={columns}
                        open={columnManagerOpen}
                        onOpenChange={setColumnManagerOpen}
                        onChange={setColumns}
                        onSave={() => saveColumnPreferences(columns)}
                        saving={savingColumns}
                    />
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : members.length === 0 ? (
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-12 text-center">
                    <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="font-semibold text-lg mb-1">{members.length === 0 ? t("belumAda") : "Tidak ada hasil"}</h3>
                    <p className="text-muted-foreground text-sm">{members.length === 0 ? t("belumAdaDesc") : "Coba ubah kata kunci pencarian atau filter tag."}</p>
                </div>
            ) : filteredMembers.length === 0 ? (
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-12 text-center">
                    <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="font-semibold text-lg mb-1">{members.length === 0 ? t("belumAda") : "Tidak ada hasil"}</h3>
                    <p className="text-muted-foreground text-sm">{members.length === 0 ? t("belumAdaDesc") : "Coba ubah kata kunci pencarian atau filter tag."}</p>
                </div>
            ) : (
                <>
                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-3">
                        {paginateArray(filteredMembers, currentPage, itemsPerPage).map((member) => (
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
                                {member.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {member.tags.map((tag, i) => (
                                            <span key={i} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{tag}</span>
                                        ))}
                                    </div>
                                )}
                                <div className="space-y-1 text-sm">
                                    {orderedVisibleColumns
                                        .filter((column) => column.id !== "name" && column.id !== "actions")
                                        .map((column) => (
                                            <div key={column.id} className="flex items-start justify-between gap-3">
                                                <span className="text-muted-foreground">{column.label}</span>
                                                <span className="max-w-[180px] truncate text-right text-foreground" title={String(renderMobileValue(member, column) ?? "-")}>
                                                    {renderMobileValue(member, column)}
                                                </span>
                                            </div>
                                        ))}
                                </div>
                                <div className="flex items-center gap-2.5 pt-1 border-t">
                                    <ActionIconButton tone="green" title={tt("sendWA")} onClick={() => sendWhatsApp(member.whatsapp_number)}>
                                        <MessageCircle className="w-4 h-4" />
                                    </ActionIconButton>
                                    <ActionIconButton tone="indigo" title="Edit" onClick={() => {
                                        setEditingMember(member);
                                        setEditTags(member.tags || []);
                                        const wa = member.whatsapp_number || "";
                                        const match = COUNTRY_CODES.find(c => wa.startsWith(c.code));
                                        setEditCountryCode(match ? match.code : "+62");
                                        setIsEditOpen(true);
                                    }}>
                                        <Edit2 className="w-4 h-4" />
                                    </ActionIconButton>
                                    <ActionIconButton tone="red" title="Hapus" onClick={() => handleDelete(member.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </ActionIconButton>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop Table */}
                    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden hidden md:block">
                        <div className="relative overflow-x-auto">
                            <table className="min-w-[860px] w-full text-sm text-left">
                                <thead className="text-xs uppercase bg-card border-b">
                                    <tr>
                                        {orderedVisibleColumns.map((column) => renderDesktopHeader(column))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {paginateArray(filteredMembers, currentPage, itemsPerPage).map((member) => (
                                        <tr key={member.id} className="group hover:bg-muted/50 transition-colors">
                                            {orderedVisibleColumns.map((column) => renderDesktopCell(member, column))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <TablePagination totalItems={filteredMembers.length} currentPage={currentPage} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} />
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
                                <div className="flex gap-2">
                                    <select value={editCountryCode} onChange={e => setEditCountryCode(e.target.value)} className={inputClass + " !w-28 shrink-0 cursor-pointer"}>
                                        {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                                    </select>
                                    <input name="whatsapp_number" type="tel" placeholder="8123456789"
                                        defaultValue={(() => {
                                            const wa = editingMember?.whatsapp_number || "";
                                            const match = COUNTRY_CODES.find(c => wa.startsWith(c.code));
                                            return match ? wa.slice(match.code.length) : wa.replace(/^0/, "");
                                        })()}
                                        onChange={e => {
                                            const val = e.target.value.replace(/[^0-9]/g, "");
                                            e.target.value = val.startsWith("0") ? val.slice(1) : val.startsWith("62") ? val.slice(2) : val;
                                        }}
                                        className={inputClass} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Google Email</label>
                                <input name="google_email" type="email" defaultValue={editingMember.google_email || ""} placeholder={tt("googleEmailPlaceholder")} className={inputClass} />
                            </div>
                            <TagInput tags={editTags} setTags={setEditTags} input={editTagInput} setInput={setEditTagInput} inputClass={inputClass} />
                            <DialogFooter><Button type="submit">{t("perbarui")}</Button></DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            <ActionConfirmDialog
                open={deleteConfirmDialog.open}
                onOpenChange={(open) =>
                    setDeleteConfirmDialog((prev) => ({
                        ...prev,
                        open,
                        member: open ? prev.member : null,
                    }))
                }
                title="Konfirmasi"
                message={tt("deleteConfirm")}
                cancelLabel="Batal"
                confirmLabel="Hapus"
                confirmVariant="destructive"
                onConfirm={confirmDeleteMember}
            />
        </div>
    );
}
