"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { ArrowLeft, Save, Loader2, Users, CalendarClock, Wallet, StickyNote, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { Link } from "@/i18n/routing";
import { LocationAutocomplete } from "@/components/ui/location-autocomplete";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const inputClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";
const textareaClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-none";
const selectClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23999%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat pr-8";

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
    Akad: [
        { key: "nama_pasangan", label: "Nama Pasangan", labelEn: "Partner's Name" },
    ],
    Resepsi: [
        { key: "nama_pasangan", label: "Nama Pasangan", labelEn: "Partner's Name" },
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

function generateBookingCode(): string {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    const rand = String(Math.floor(Math.random() * 900) + 100);
    return `${dd}${mm}${yyyy}${rand}`;
}

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
    const [dpPaid, setDpPaid] = React.useState<number | "">("");
    const [selectedServiceId, setSelectedServiceId] = React.useState("");
    const [selectedFreelancerId, setSelectedFreelancerId] = React.useState("");

    // Custom Service Popup
    const [showCustomServicePopup, setShowCustomServicePopup] = React.useState(false);
    const [customServiceName, setCustomServiceName] = React.useState("");
    const [customServicePrice, setCustomServicePrice] = React.useState<number | "">("");
    const [savingCustomService, setSavingCustomService] = React.useState(false);

    // Custom Freelancer Popup
    const [showCustomFreelancerPopup, setShowCustomFreelancerPopup] = React.useState(false);
    const [customFreelancerName, setCustomFreelancerName] = React.useState("");
    const [customFreelancerWa, setCustomFreelancerWa] = React.useState("");
    const [savingCustomFreelancer, setSavingCustomFreelancer] = React.useState(false);

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
        const val = e.target.value;
        if (val === "__custom__") {
            e.target.value = selectedServiceId;
            setShowCustomServicePopup(true);
            return;
        }
        setSelectedServiceId(val);
        const selected = services.find(s => s.id === val);
        if (selected) setTotalPrice(selected.price);
    };

    const handleFreelancerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val === "__custom__") {
            e.target.value = selectedFreelancerId;
            setShowCustomFreelancerPopup(true);
            return;
        }
        setSelectedFreelancerId(val);
    };

    async function saveCustomService() {
        if (!customServiceName.trim()) return;
        setSavingCustomService(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase.from("services").insert({
            user_id: user.id,
            name: customServiceName.trim(),
            price: parseFloat(customServicePrice.toString()) || 0,
            is_active: true,
        }).select("id, name, price").single();

        if (!error && data) {
            const newSvc = data as Service;
            setServices(prev => [...prev, newSvc]);
            setSelectedServiceId(newSvc.id);
            setTotalPrice(newSvc.price);
            setCustomServiceName("");
            setCustomServicePrice("");
            setShowCustomServicePopup(false);
        } else {
            alert("Gagal menyimpan paket baru.");
        }
        setSavingCustomService(false);
    }

    async function saveCustomFreelancer() {
        if (!customFreelancerName.trim()) return;
        setSavingCustomFreelancer(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase.from("freelancers").insert({
            user_id: user.id,
            name: customFreelancerName.trim(),
            whatsapp_number: customFreelancerWa || null,
            status: "active",
        }).select("id, name").single();

        if (!error && data) {
            const newFree = data as Freelance;
            setFreelancers(prev => [...prev, newFree]);
            setSelectedFreelancerId(newFree.id);
            setCustomFreelancerName("");
            setCustomFreelancerWa("");
            setShowCustomFreelancerPopup(false);
        } else {
            alert("Gagal menyimpan freelance baru.");
        }
        setSavingCustomFreelancer(false);
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSaving(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const fd = new FormData(e.currentTarget);
        const bookingCode = generateBookingCode();
        const invoiceCode = `INV-${bookingCode}`;

        const { data: booking, error } = await supabase.from("bookings").insert({
            user_id: user.id,
            booking_code: invoiceCode,
            client_name: fd.get("client_name") as string,
            client_whatsapp: (fd.get("client_whatsapp") as string) || null,
            session_date: (fd.get("session_date") as string) || null,
            location: location || null,
            instagram: (fd.get("instagram") as string) || null,
            event_type: eventType,
            service_id: selectedServiceId || null,
            freelancer_id: selectedFreelancerId || null,
            total_price: parseFloat(totalPrice.toString()) || 0,
            dp_paid: parseFloat(dpPaid.toString()) || 0,
            status: (fd.get("status") as string) || "Pending",
            notes: (fd.get("notes") as string) || null,
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
    const reqMark = <span className="text-red-500">*</span>;

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
                {/* Informasi Klien */}
                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
                    <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Users className="w-4 h-4" /> Informasi Klien
                    </h3>
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Nama {reqMark}</label>
                            <input name="client_name" required placeholder="Nama lengkap klien" className={inputClass} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Nomor WhatsApp {reqMark}</label>
                            <input name="client_whatsapp" required type="tel" placeholder="08..." className={inputClass} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Instagram</label>
                            <input name="instagram" placeholder="@username" className={inputClass} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Tipe Acara {reqMark}</label>
                            <select value={eventType} onChange={e => { setEventType(e.target.value); setExtraFields({}); }} className={selectClass} required>
                                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                    {currentExtraFields.length > 0 && (
                        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 pt-3 border-t border-dashed">
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

                {/* Detail Sesi */}
                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
                    <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <CalendarClock className="w-4 h-4" /> Detail Sesi
                    </h3>
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Jadwal Sesi {reqMark}</label>
                            <input name="session_date" required type="datetime-local" className={cn(inputClass, "block")} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Status {reqMark}</label>
                            <select name="status" required className={selectClass}>
                                {["Pending", "DP", "Terjadwal", "Selesai", "Edit", "Batal"].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="col-span-full space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Lokasi Utama</label>
                            <LocationAutocomplete value={location} onChange={setLocation} placeholder="Cari lokasi sesi foto..." />
                        </div>

                        {/* Package Selection */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Paket / Layanan {reqMark}</label>
                            <select value={selectedServiceId} onChange={handleServiceChange} className={selectClass} required>
                                <option value="">-- Pilih Paket --</option>
                                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                <option value="__custom__">＋ Tambah Paket Baru...</option>
                            </select>
                        </div>

                        {/* Freelancer Selection */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Freelance</label>
                            <select value={selectedFreelancerId} onChange={handleFreelancerChange} className={selectClass}>
                                <option value="">-- Pilih Freelance --</option>
                                {freelancers.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                <option value="__custom__">＋ Tambah Freelance Baru...</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Keuangan */}
                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
                    <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Wallet className="w-4 h-4" /> Keuangan
                    </h3>
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Harga Total (Rp) {reqMark}</label>
                            <input
                                name="total_price"
                                type="number"
                                required
                                value={totalPrice}
                                onChange={e => setTotalPrice(e.target.value ? parseFloat(e.target.value) : "")}
                                placeholder="0"
                                className={inputClass}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">DP Dibayar (Rp) {reqMark}</label>
                            <input
                                name="dp_paid"
                                type="number"
                                required
                                value={dpPaid}
                                onChange={e => setDpPaid(e.target.value ? parseFloat(e.target.value) : "")}
                                placeholder="0"
                                className={inputClass}
                            />
                        </div>
                    </div>
                </div>

                {/* Catatan */}
                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-3">
                    <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <StickyNote className="w-4 h-4" /> Catatan
                    </h3>
                    <textarea name="notes" rows={3} placeholder="Permintaan khusus, detail tambahan..." className={textareaClass} />
                </div>

                <div className="flex gap-3 justify-end pt-4">
                    <Link href="/bookings">
                        <Button type="button" variant="ghost" className="text-muted-foreground hover:text-foreground">Batal</Button>
                    </Link>
                    <Button type="submit" disabled={saving} className="gap-2 bg-foreground text-background hover:bg-foreground/90 px-8">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Simpan Booking
                    </Button>
                </div>
            </form>

            {/* Custom Service Popup */}
            <Dialog open={showCustomServicePopup} onOpenChange={setShowCustomServicePopup}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> Tambah Paket Baru</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Nama Paket <span className="text-red-500">*</span></label>
                            <input value={customServiceName} onChange={e => setCustomServiceName(e.target.value)} placeholder="Contoh: Paket Gold 2 Jam" className={inputClass} autoFocus />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Harga (Rp)</label>
                            <input type="number" value={customServicePrice} onChange={e => setCustomServicePrice(e.target.value ? parseFloat(e.target.value) : "")} placeholder="0" className={inputClass} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCustomServicePopup(false)} disabled={savingCustomService}>Batal</Button>
                        <Button onClick={saveCustomService} disabled={savingCustomService || !customServiceName.trim()}>
                            {savingCustomService ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                            Simpan & Pilih
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Custom Freelancer Popup */}
            <Dialog open={showCustomFreelancerPopup} onOpenChange={setShowCustomFreelancerPopup}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> Tambah Freelance Baru</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Nama Freelance <span className="text-red-500">*</span></label>
                            <input value={customFreelancerName} onChange={e => setCustomFreelancerName(e.target.value)} placeholder="Nama lengkap" className={inputClass} autoFocus />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Nomor WhatsApp</label>
                            <input value={customFreelancerWa} onChange={e => setCustomFreelancerWa(e.target.value)} placeholder="08..." className={inputClass} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCustomFreelancerPopup(false)} disabled={savingCustomFreelancer}>Batal</Button>
                        <Button onClick={saveCustomFreelancer} disabled={savingCustomFreelancer || !customFreelancerName.trim()}>
                            {savingCustomFreelancer ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                            Simpan & Pilih
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
