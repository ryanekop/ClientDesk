"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { Link } from "@/i18n/routing";
import { LocationAutocomplete } from "@/components/ui/location-autocomplete";

const inputClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";
const textareaClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-none";
const selectClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const EVENT_TYPES = ["Umum", "Wedding", "Wisuda", "Maternity", "Newborn", "Family", "Komersil", "Lainnya"];
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
    const [totalPrice, setTotalPrice] = React.useState("");
    const [dpPaid, setDpPaid] = React.useState("");
    const [status, setStatus] = React.useState("Pending");
    const [notes, setNotes] = React.useState("");
    const [extraFields, setExtraFields] = React.useState<Record<string, string>>({});

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
                setTotalPrice(booking.total_price?.toString() || "");
                setDpPaid(booking.dp_paid?.toString() || "");
                setStatus(booking.status || "Pending");
                setNotes(booking.notes || "");
                setExtraFields(booking.extra_fields || {});
            }
            setServices((svcs || []) as Service[]);
            setFreelancers((frees || []) as Freelance[]);
            setLoading(false);
        }
        load();
    }, [id]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        const { error } = await supabase.from("bookings").update({
            client_name: clientName,
            client_whatsapp: clientWa || null,
            instagram: instagram || null,
            event_type: eventType,
            session_date: sessionDate || null,
            location: location || null,
            service_id: serviceId || null,
            freelancer_id: freelancerId || null,
            total_price: parseFloat(totalPrice) || 0,
            dp_paid: parseFloat(dpPaid) || 0,
            status,
            notes: notes || null,
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
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <Link href={`/bookings/${id}`}>
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Edit Booking</h2>
                    <p className="text-muted-foreground text-sm">{clientName}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="rounded-xl border bg-card p-6 space-y-4">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Informasi Klien</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nama <span className="text-red-500">*</span></label>
                            <input required value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nama klien" className={inputClass} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nomor WhatsApp</label>
                            <input type="tel" value={clientWa} onChange={e => setClientWa(e.target.value)} placeholder="08123456789" className={inputClass} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Instagram</label>
                            <input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@username" className={inputClass} />
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
                            <input type="datetime-local" value={sessionDate} onChange={e => setSessionDate(e.target.value)} className={inputClass} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Status</label>
                            <select value={status} onChange={e => setStatus(e.target.value)} className={selectClass}>
                                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="col-span-full space-y-2">
                            <label className="text-sm font-medium">Lokasi</label>
                            <LocationAutocomplete value={location} onChange={setLocation} placeholder="Cari lokasi sesi foto..." />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Paket / Layanan</label>
                            <select value={serviceId} onChange={e => setServiceId(e.target.value)} className={selectClass}>
                                <option value="">-- Pilih Paket --</option>
                                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Freelance</label>
                            <select value={freelancerId} onChange={e => setFreelancerId(e.target.value)} className={selectClass}>
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
                            <input type="number" min="0" step="1000" value={totalPrice} onChange={e => setTotalPrice(e.target.value)} placeholder="0" className={inputClass} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">DP Dibayar (Rp)</label>
                            <input type="number" min="0" step="1000" value={dpPaid} onChange={e => setDpPaid(e.target.value)} placeholder="0" className={inputClass} />
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border bg-card p-6 space-y-4">
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Catatan</h3>
                    <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Catatan tambahan..." className={textareaClass} />
                </div>

                <div className="flex gap-3 justify-end">
                    <Link href={`/bookings/${id}`}>
                        <Button type="button" variant="outline">Batal</Button>
                    </Link>
                    <Button type="submit" disabled={saving} className="gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Simpan Perubahan
                    </Button>
                </div>
            </form>
        </div>
    );
}
