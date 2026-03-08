"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { ArrowLeft, Save, Sparkles, UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { Link } from "@/i18n/routing";
import { LocationAutocomplete } from "@/components/ui/location-autocomplete";
import { cn } from "@/lib/utils";

const inputClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";
const textareaClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-none";
const selectClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const EVENT_TYPES = ["Umum", "Wedding", "Akad", "Resepsi", "Wisuda", "Maternity", "Newborn", "Family", "Komersil", "Lainnya"];

const EXTRA_FIELDS: Record<string, { key: string; label: string; labelEn: string; isLocation?: boolean }[]> = {
    Wisuda: [
        { key: "universitas", label: "Universitas", labelEn: "University" },
        { key: "fakultas", label: "Fakultas", labelEn: "Faculty" },
        { key: "angkatan", label: "Angkatan", labelEn: "Class Year" },
    ],
    Wedding: [
        { key: "nama_pasangan", label: "Nama Pasangan", labelEn: "Partner's Name" },
        { key: "tempat_akad", label: "Lokasi Akad", labelEn: "Akad Venue", isLocation: true },
        { key: "tempat_resepsi", label: "Lokasi Resepsi", labelEn: "Reception Venue", isLocation: true },
    ],
    Maternity: [
        { key: "usia_kehamilan", label: "Usia Kehamilan", labelEn: "Pregnancy Age" },
        { key: "gender_bayi", label: "Gender Bayi", labelEn: "Baby Gender" },
    ],
    Newborn: [
        { key: "nama_bayi", label: "Nama Bayi", labelEn: "Baby Name" },
        { key: "tanggal_lahir", label: "Tanggal Lahir", labelEn: "Date of Birth" },
    ],
    Komersil: [
        { key: "nama_brand", label: "Nama Brand", labelEn: "Brand Name" },
        { key: "tipe_konten", label: "Tipe Konten", labelEn: "Content Type" },
    ],
    Family: [
        { key: "jumlah_anggota", label: "Jumlah Anggota", labelEn: "Number of Members" },
    ],
};

type Service = { id: string; name: string; price: number };
type Freelance = { id: string; name: string };

export default function NewBookingPage() {
    const router = useRouter();
    const locale = useLocale();
    const supabase = createClient();
    const [saving, setSaving] = React.useState(false);
    const [services, setServices] = React.useState<Service[]>([]);
    const [freelancers, setFreelancers] = React.useState<Freelance[]>([]);

    const [eventType, setEventType] = React.useState("Umum");
    const [extraFields, setExtraFields] = React.useState<Record<string, string>>({});
    const [location, setLocation] = React.useState("");
    const [totalPrice, setTotalPrice] = React.useState<number | "">("");

    const [isCustomService, setIsCustomService] = React.useState(false);
    const [isCustomFreelancer, setIsCustomFreelancer] = React.useState(false);

    React.useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const [{ data: svcs }, { data: frees }] = await Promise.all([
                supabase.from("services").select("id, name, price").eq("user_id", user.id).eq("is_active", true),
                supabase.from("freelancers").select("id, name").eq("user_id", user.id).eq("status", "active"),
            ]);
            setServices((svcs || []) as Service[]);
            setFreelancers((frees || []) as Freelance[]);
        }
        load();
    }, []);

    const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        const selected = services.find(s => s.id === id);
        if (selected) {
            setTotalPrice(selected.price);
        } else {
            setTotalPrice("");
        }
    };

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSaving(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const fd = new FormData(e.currentTarget);
        const { count } = await supabase.from("bookings").select("*", { count: "exact", head: true }).eq("user_id", user.id);
        const code = `BKG-${String((count || 0) + 1).padStart(3, "0")}`;

        // Handle Custom Service/Freelancer if needed (simplified for now by just taking the value)
        const serviceVal = isCustomService ? fd.get("custom_service") : fd.get("service_id");
        const freelancerVal = isCustomFreelancer ? fd.get("custom_freelancer") : fd.get("freelancer_id");

        const { data: booking, error } = await supabase.from("bookings").insert({
            user_id: user.id,
            booking_code: code,
            client_name: fd.get("client_name") as string,
            client_whatsapp: (fd.get("client_whatsapp") as string) || null,
            session_date: (fd.get("session_date") as string) || null,
            location: location || null,
            instagram: (fd.get("instagram") as string) || null,
            event_type: eventType,
            service_id: !isCustomService ? (serviceVal as string) || null : null,
            freelancer_id: !isCustomFreelancer ? (freelancerVal as string) || null : null,
            // If custom, we might want to store the name somewhere, but for now let's use notes or a specific field if it existed.
            // Since the schema doesn't have custom name fields, we'll append to notes if custom.
            total_price: parseFloat(totalPrice.toString()) || 0,
            dp_paid: parseFloat(fd.get("dp_paid") as string) || 0,
            status: (fd.get("status") as string) || "Pending",
            notes: (fd.get("notes") as string) || "" + (isCustomService ? `\n[Paket Custom: ${fd.get("custom_service")}]` : "") + (isCustomFreelancer ? `\n[Freelance Custom: ${fd.get("custom_freelancer")}]` : ""),
            extra_fields: Object.keys(extraFields).length > 0 ? extraFields : null,
        }).select("id").single();

        setSaving(false);
        if (!error && booking) {
            router.push(`/${locale}/bookings/${booking.id}`);
        } else {
            console.error(error);
            alert("Gagal menyimpan booking.");
        }
    }

    const currentExtraFields = EXTRA_FIELDS[eventType] || [];

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            <div className="flex items-center gap-3">
                <Link href="/bookings">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Tambah Klien Baru</h2>
                    <p className="text-muted-foreground text-sm">Isi detail booking klien baru.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
                    <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground/80 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Informasi Klien
                    </h3>
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Nama <span className="text-red-500">*</span></label>
                            <input name="client_name" required placeholder="Nama lengkap klien" className={inputClass} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Nomor WhatsApp</label>
                            <input name="client_whatsapp" type="tel" placeholder="08..." className={inputClass} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Instagram</label>
                            <input name="instagram" placeholder="@username" className={inputClass} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Tipe Acara</label>
                            <select value={eventType} onChange={e => { setEventType(e.target.value); setExtraFields({}); }} className={selectClass}>
                                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                    {currentExtraFields.length > 0 && (
                        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 pt-2 border-t border-dashed">
                            {currentExtraFields.map(f => (
                                <div key={f.key} className={`space-y-1.5 ${f.isLocation ? "col-span-full" : ""}`}>
                                    <label className="text-xs font-medium text-muted-foreground">{locale === "id" ? f.label : f.labelEn}</label>
                                    {f.isLocation ? (
                                        <LocationAutocomplete
                                            value={extraFields[f.key] || ""}
                                            onChange={v => setExtraFields(prev => ({ ...prev, [f.key]: v }))}
                                            placeholder={`Cari lokasi ${f.label.toLowerCase()}...`}
                                        />
                                    ) : (
                                        <input
                                            placeholder={f.label}
                                            value={extraFields[f.key] || ""}
                                            onChange={e => setExtraFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                                            className={inputClass}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
                    <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground/80 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> Detail Sesi
                    </h3>
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Jadwal Sesi</label>
                            <input name="session_date" type="datetime-local" className={cn(inputClass, "block")} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Status Awal</label>
                            <select name="status" className={selectClass}>
                                {["Pending", "DP", "Terjadwal", "Selesai", "Edit", "Batal"].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="col-span-full space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Lokasi Utama</label>
                            <LocationAutocomplete value={location} onChange={setLocation} placeholder="Cari lokasi sesi foto..." />
                        </div>

                        {/* Package Selection with Custom Toggle */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-muted-foreground">Paket / Layanan</label>
                                <button type="button" onClick={() => setIsCustomService(!isCustomService)} className="text-[10px] flex items-center gap-1 text-blue-500 hover:text-blue-600">
                                    <Sparkles className="w-3 h-3" /> {isCustomService ? "Paket Terdaftar" : "Custom Paket"}
                                </button>
                            </div>
                            {isCustomService ? (
                                <input name="custom_service" placeholder="Ketik nama paket manual..." className={inputClass} autoFocus />
                            ) : (
                                <select name="service_id" className={selectClass} onChange={handleServiceChange}>
                                    <option value="">-- Pilih Paket --</option>
                                    {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            )}
                        </div>

                        {/* Freelancer Selection with Custom Toggle */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-muted-foreground">Freelance</label>
                                <button type="button" onClick={() => setIsCustomFreelancer(!isCustomFreelancer)} className="text-[10px] flex items-center gap-1 text-blue-500 hover:text-blue-600">
                                    <UserPlus className="w-3 h-3" /> {isCustomFreelancer ? "Freelance Terdaftar" : "Custom Freelance"}
                                </button>
                            </div>
                            {isCustomFreelancer ? (
                                <input name="custom_freelancer" placeholder="Ketik nama freelance manual..." className={inputClass} autoFocus />
                            ) : (
                                <select name="freelancer_id" className={selectClass}>
                                    <option value="">-- Pilih Freelance --</option>
                                    {freelancers.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                            )}
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
                    <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground/80 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Keuangan
                    </h3>
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Harga Total (Rp)</label>
                            <input
                                name="total_price"
                                type="number"
                                value={totalPrice}
                                onChange={e => setTotalPrice(e.target.value ? parseFloat(e.target.value) : "")}
                                placeholder="0"
                                className={inputClass}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">DP Dibayar (Rp)</label>
                            <input name="dp_paid" type="number" min="0" step="1000" placeholder="0" className={inputClass} />
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Catatan</label>
                    <textarea name="notes" rows={3} placeholder="Permintaan khusus, detail tambahan..." className={textareaClass} />
                </div>

                <div className="flex gap-3 justify-end pt-4">
                    <Link href="/bookings">
                        <Button type="button" variant="ghost" className="text-muted-foreground hover:text-foreground">Batal</Button>
                    </Link>
                    <Button type="submit" disabled={saving} className="gap-2 bg-foreground text-background hover:bg-foreground/90 px-8">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin text-background" /> : <Save className="w-4 h-4" />}
                        Simpan Booking
                    </Button>
                </div>
            </form>
        </div>
    );
}

