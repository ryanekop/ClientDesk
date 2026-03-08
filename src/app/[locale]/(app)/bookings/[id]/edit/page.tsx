"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { ArrowLeft, Save, Loader2, Sparkles, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { Link } from "@/i18n/routing";
import { LocationAutocomplete } from "@/components/ui/location-autocomplete";
import { cn } from "@/lib/utils";

const inputClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";
const textareaClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-none";
const selectClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const EVENT_TYPES = ["Umum", "Wedding", "Akad", "Resepsi", "Wisuda", "Maternity", "Newborn", "Family", "Komersil", "Lainnya"];
const STATUSES = ["Pending", "DP", "Terjadwal", "Selesai", "Edit", "Batal"];

const EXTRA_FIELDS_DEF: Record<string, { key: string; label: string; labelEn: string; isLocation?: boolean }[]> = {
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
        { key: "jumlah_anggota", label: "Jumlah Anggota", labelEn: "Members" },
    ],
};

type Service = { id: string; name: string; price: number };
type Freelance = { id: string; name: string };

export default function EditBookingPage() {
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();
    const locale = useLocale();
    const supabase = createClient();

    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [services, setServices] = React.useState<Service[]>([]);
    const [freelancers, setFreelancers] = React.useState<Freelance[]>([]);

    const [clientName, setClientName] = React.useState("");
    const [clientWa, setClientWa] = React.useState("");
    const [instagram, setInstagram] = React.useState("");
    const [eventType, setEventType] = React.useState("Umum");
    const [sessionDate, setSessionDate] = React.useState("");
    const [location, setLocation] = React.useState("");
    const [serviceId, setServiceId] = React.useState("");
    const [freelancerId, setFreelancerId] = React.useState("");
    const [totalPrice, setTotalPrice] = React.useState<number | "">("");
    const [dpPaid, setDpPaid] = React.useState<number | "">("");
    const [status, setStatus] = React.useState("Pending");
    const [notes, setNotes] = React.useState("");
    const [extraFields, setExtraFields] = React.useState<Record<string, string>>({});
    
    const [isCustomService, setIsCustomService] = React.useState(false);
    const [isCustomFreelancer, setIsCustomFreelancer] = React.useState(false);

    React.useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [{ data: booking }, { data: svcs }, { data: frees }] = await Promise.all([
                supabase.from("bookings").select("*").eq("id", id).single(),
                supabase.from("services").select("id, name, price").eq("user_id", user.id).eq("is_active", true),
                supabase.from("freelancers").select("id, name").eq("user_id", user.id).eq("status", "active"),
            ]);

            if (booking) {
                setClientName(booking.client_name || "");
                setClientWa(booking.client_whatsapp || "");
                setInstagram(booking.instagram || "");
                setEventType(booking.event_type || "Umum");
                setSessionDate(booking.session_date ? booking.session_date.slice(0, 16) : "");
                setLocation(booking.location || "");
                setServiceId(booking.service_id || "");
                setFreelancerId(booking.freelancer_id || "");
                setTotalPrice(booking.total_price || "");
                setDpPaid(booking.dp_paid || "");
                setStatus(booking.status || "Pending");
                setNotes(booking.notes || "");
                setExtraFields(booking.extra_fields || {});
                
                // Check if custom (if id is null but notes has the tag)
                if (!booking.service_id && booking.notes?.includes("[Paket Custom:")) setIsCustomService(true);
                if (!booking.freelancer_id && booking.notes?.includes("[Freelance Custom:")) setIsCustomFreelancer(true);
            }
            setServices((svcs || []) as Service[]);
            setFreelancers((frees || []) as Freelance[]);
            setLoading(false);
        }
        load();
    }, [id]);

    const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const sid = e.target.value;
        setServiceId(sid);
        const selected = services.find(s => s.id === sid);
        if (selected) setTotalPrice(selected.price);
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        
        let finalNotes = notes;
        // Handle custom labels if toggle is on (this matches New form logic)
        // Note: For simplicity, we are just storing in notes if custom.
        
        const { error } = await supabase.from("bookings").update({
            client_name: clientName,
            client_whatsapp: clientWa || null,
            instagram: instagram || null,
            event_type: eventType,
            session_date: sessionDate || null,
            location: location || null,
            service_id: isCustomService ? null : (serviceId || null),
            freelancer_id: isCustomFreelancer ? null : (freelancerId || null),
            total_price: parseFloat(totalPrice.toString()) || 0,
            dp_paid: parseFloat(dpPaid.toString()) || 0,
            status,
            notes: finalNotes || null,
            extra_fields: Object.keys(extraFields).length > 0 ? extraFields : null,
            updated_at: new Date().toISOString(),
        }).eq("id", id);

        setSaving(false);
        if (!error) {
            router.push(`/${locale}/bookings/${id}`);
        } else {
            alert("Gagal menyimpan perubahan.");
        }
    }

    const currentExtraFields = EXTRA_FIELDS_DEF[eventType] || [];

    if (loading) return (
        <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            <div className="flex items-center gap-3">
                <Link href={`/bookings/${id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Edit Booking</h2>
                    <p className="text-muted-foreground text-sm">{clientName} • {id.slice(0, 8)}</p>
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
                            <input required value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nama klien" className={inputClass} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Nomor WhatsApp</label>
                            <input type="tel" value={clientWa} onChange={e => setClientWa(e.target.value)} placeholder="08..." className={inputClass} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Instagram</label>
                            <input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@username" className={inputClass} />
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
                            <input type="datetime-local" value={sessionDate} onChange={e => setSessionDate(e.target.value)} className={cn(inputClass, "block")} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Status</label>
                            <select value={status} onChange={e => setStatus(e.target.value)} className={selectClass}>
                                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="col-span-full space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Lokasi Utama</label>
                            <LocationAutocomplete value={location} onChange={setLocation} placeholder="Cari lokasi sesi foto..." />
                        </div>
                        
                        {/* Package Selection */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-muted-foreground">Paket / Layanan</label>
                                <button type="button" onClick={() => setIsCustomService(!isCustomService)} className="text-[10px] flex items-center gap-1 text-blue-500 hover:text-blue-600">
                                    <Sparkles className="w-3 h-3" /> {isCustomService ? "Paket Terdaftar" : "Custom Paket"}
                                </button>
                            </div>
                            {isCustomService ? (
                                <input placeholder="Info paket manual (simpan di catatan)" className={cn(inputClass, "bg-muted/30 italic opacity-70")} disabled defaultValue="Edit di catatan di bawah" />
                            ) : (
                                <select value={serviceId} onChange={handleServiceChange} className={selectClass}>
                                    <option value="">-- Pilih Paket --</option>
                                    {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            )}
                        </div>

                        {/* Freelancer Selection */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-muted-foreground">Freelance</label>
                                <button type="button" onClick={() => setIsCustomFreelancer(!isCustomFreelancer)} className="text-[10px] flex items-center gap-1 text-blue-500 hover:text-blue-600">
                                    <UserPlus className="w-3 h-3" /> {isCustomFreelancer ? "Freelance Terdaftar" : "Custom Freelance"}
                                </button>
                            </div>
                            {isCustomFreelancer ? (
                                <input placeholder="Info freelance manual (simpan di catatan)" className={cn(inputClass, "bg-muted/30 italic opacity-70")} disabled defaultValue="Edit di catatan di bawah" />
                            ) : (
                                <select value={freelancerId} onChange={e => setFreelancerId(e.target.value)} className={selectClass}>
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
                            <input type="number" value={totalPrice} onChange={e => setTotalPrice(e.target.value ? parseFloat(e.target.value) : "")} placeholder="0" className={inputClass} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">DP Dibayar (Rp)</label>
                            <input type="number" value={dpPaid} onChange={e => setDpPaid(e.target.value ? parseFloat(e.target.value) : "")} placeholder="0" className={inputClass} />
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest text-[10px]">Catatan</label>
                    <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Detail tambahan, catatan custom..." className={textareaClass} />
                </div>

                <div className="flex gap-3 justify-end pt-4">
                    <Link href={`/bookings/${id}`}>
                        <Button type="button" variant="ghost" className="text-muted-foreground hover:text-foreground">Batal</Button>
                    </Link>
                    <Button type="submit" disabled={saving} className="gap-2 bg-foreground text-background hover:bg-foreground/90 px-8">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin text-background" /> : <Save className="w-4 h-4" />}
                        Simpan Perubahan
                    </Button>
                </div>
            </form>
        </div>
    );
}

