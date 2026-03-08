"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { Link } from "@/i18n/routing";
import { LocationAutocomplete } from "@/components/ui/location-autocomplete";

const inputClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";
const textareaClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-none";
const selectClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const EVENT_TYPES = ["Umum", "Wedding", "Wisuda", "Maternity", "Newborn", "Family", "Komersil", "Lainnya"];

// isLocation flag marks fields that should use LocationAutocomplete
const EXTRA_FIELDS: Record<string, { key: string; label: string; labelEn: string; isLocation?: boolean }[]> = {
    Wisuda: [
        { key: "universitas", label: "Universitas", labelEn: "University" },
        { key: "fakultas", label: "Fakultas", labelEn: "Faculty" },
        { key: "angkatan", label: "Angkatan", labelEn: "Class Year" },
    ],
    Wedding: [
        { key: "nama_pasangan", label: "Nama Pasangan", labelEn: "Partner's Name" },
        { key: "tempat_akad", label: "Tempat Akad", labelEn: "Akad Venue", isLocation: true },
        { key: "tempat_resepsi", label: "Tempat Resepsi", labelEn: "Reception Venue", isLocation: true },
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

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSaving(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const fd = new FormData(e.currentTarget);
        const { count } = await supabase.from("bookings").select("*", { count: "exact", head: true }).eq("user_id", user.id);
        const code = `BKG-${String((count || 0) + 1).padStart(3, "0")}`;
        const selectedService = services.find(s => s.id === fd.get("service_id"));

        const { data: booking, error } = await supabase.from("bookings").insert({
            user_id: user.id,
            booking_code: code,
            client_name: fd.get("client_name") as string,
            client_whatsapp: (fd.get("client_whatsapp") as string) || null,
            session_date: (fd.get("session_date") as string) || null,
            location: location || null,
            instagram: (fd.get("instagram") as string) || null,
            event_type: eventType,
            service_id: (fd.get("service_id") as string) || null,
            freelancer_id: (fd.get("freelancer_id") as string) || null,
            total_price: parseFloat(fd.get("total_price") as string) || selectedService?.price || 0,
            dp_paid: parseFloat(fd.get("dp_paid") as string) || 0,
            status: (fd.get("status") as string) || "Pending",
            notes: (fd.get("notes") as string) || null,
            extra_fields: Object.keys(extraFields).length > 0 ? extraFields : null,
        }).select("id").single();

        setSaving(false);
        if (!error && booking) {
            router.push(`/${locale}/bookings/${booking.id}`);
        } else {
            alert("Gagal menyimpan booking.");
        }
    }

    const currentExtraFields = EXTRA_FIELDS[eventType] || [];

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <Link href="/bookings">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Tambah Klien Baru</h2>
                    <p className="text-muted-foreground text-sm">Isi detail booking klien baru.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="rounded-xl border bg-card p-6 space-y-4">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Informasi Klien</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nama <span className="text-red-500">*</span></label>
                            <input name="client_name" required placeholder="Misal: Siti Rahayu" className={inputClass} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nomor WhatsApp</label>
                            <input name="client_whatsapp" type="tel" placeholder="08123456789" className={inputClass} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Instagram</label>
                            <input name="instagram" placeholder="@username" className={inputClass} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Tipe Acara</label>
                            <select value={eventType} onChange={e => { setEventType(e.target.value); setExtraFields({}); }} className={selectClass}>
                                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                    {currentExtraFields.length > 0 && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {currentExtraFields.map(f => (
                                <div key={f.key} className={`space-y-2 ${f.isLocation ? "col-span-full" : ""}`}>
                                    <label className="text-sm font-medium">{locale === "id" ? f.label : f.labelEn}</label>
                                    {f.isLocation ? (
                                        <LocationAutocomplete
                                            value={extraFields[f.key] || ""}
                                            onChange={v => setExtraFields(prev => ({ ...prev, [f.key]: v }))}
                                            placeholder={`Cari ${f.label.toLowerCase()}...`}
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

                <div className="rounded-xl border bg-card p-6 space-y-4">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Detail Sesi</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Jadwal Sesi</label>
                            <input name="session_date" type="datetime-local" className={inputClass} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Status</label>
                            <select name="status" className={selectClass}>
                                {["Pending", "DP", "Terjadwal", "Selesai", "Batal"].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="col-span-full space-y-2">
                            <label className="text-sm font-medium">Lokasi</label>
                            <LocationAutocomplete value={location} onChange={setLocation} placeholder="Cari lokasi sesi foto..." />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Paket / Layanan</label>
                            <select name="service_id" className={selectClass}>
                                <option value="">-- Pilih Paket --</option>
                                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Freelance</label>
                            <select name="freelancer_id" className={selectClass}>
                                <option value="">-- Pilih Freelance --</option>
                                {freelancers.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border bg-card p-6 space-y-4">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Keuangan</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Harga Total (Rp)</label>
                            <input name="total_price" type="number" min="0" step="1000" placeholder="0" className={inputClass} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">DP Dibayar (Rp)</label>
                            <input name="dp_paid" type="number" min="0" step="1000" placeholder="0" className={inputClass} />
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border bg-card p-6 space-y-4">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Catatan</h3>
                    <textarea name="notes" rows={3} placeholder="Catatan tambahan, permintaan khusus, dll..." className={textareaClass} />
                </div>

                <div className="flex gap-3 justify-end">
                    <Link href="/bookings">
                        <Button type="button" variant="outline">Batal</Button>
                    </Link>
                    <Button type="submit" disabled={saving} className="gap-2">
                        {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                        Simpan Booking
                    </Button>
                </div>
            </form>
        </div>
    );
}
