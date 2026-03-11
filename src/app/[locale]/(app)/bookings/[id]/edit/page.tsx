"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { ArrowLeft, Save, Loader2, Users, CalendarClock, Wallet, StickyNote, Plus, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { Link } from "@/i18n/routing";
import { LocationAutocomplete } from "@/components/ui/location-autocomplete";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const inputClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";
const textareaClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-none";
const selectClass = "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23999%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat pr-8";

const EVENT_TYPES = ["Umum", "Wedding", "Akad", "Resepsi", "Lamaran", "Prewedding", "Wisuda", "Maternity", "Newborn", "Family", "Komersil", "Lainnya"];
const DEFAULT_STATUSES = ["Pending", "DP", "Terjadwal", "Selesai", "Edit", "Batal"];

const COUNTRY_CODES = [
    { code: "+62", flag: "🇮🇩", name: "Indonesia" },
    { code: "+60", flag: "🇲🇾", name: "Malaysia" },
    { code: "+65", flag: "🇸🇬", name: "Singapore" },
    { code: "+66", flag: "🇹🇭", name: "Thailand" },
    { code: "+84", flag: "🇻🇳", name: "Vietnam" },
    { code: "+63", flag: "🇵🇭", name: "Philippines" },
    { code: "+95", flag: "🇲🇲", name: "Myanmar" },
    { code: "+856", flag: "🇱🇦", name: "Laos" },
    { code: "+855", flag: "🇰🇭", name: "Cambodia" },
    { code: "+673", flag: "🇧🇳", name: "Brunei" },
    { code: "+670", flag: "🇹🇱", name: "Timor Leste" },
];

const EXTRA_FIELDS_DEF: Record<string, { key: string; label: string; labelEn: string; isLocation?: boolean; fullWidth?: boolean; required?: boolean; isNumeric?: boolean }[]> = {
    Wisuda: [
        { key: "universitas", label: "Universitas", labelEn: "University" },
        { key: "fakultas", label: "Fakultas", labelEn: "Faculty" },
    ],
    Wedding: [
        { key: "nama_pasangan", label: "Nama Pasangan", labelEn: "Partner's Name", fullWidth: true, required: true },
        { key: "jumlah_tamu", label: "Estimasi Tamu", labelEn: "Estimated Guests", fullWidth: true, isNumeric: true },
        { key: "tempat_akad", label: "Lokasi Akad", labelEn: "Akad Venue", isLocation: true, required: true },
        { key: "tempat_resepsi", label: "Lokasi Resepsi", labelEn: "Reception Venue", isLocation: true, required: true },
    ],
    Akad: [
        { key: "nama_pasangan", label: "Nama Pasangan", labelEn: "Partner's Name", fullWidth: true, required: true },
        { key: "jumlah_tamu", label: "Estimasi Tamu", labelEn: "Estimated Guests", fullWidth: true, isNumeric: true },
    ],
    Resepsi: [
        { key: "nama_pasangan", label: "Nama Pasangan", labelEn: "Partner's Name", fullWidth: true, required: true },
        { key: "jumlah_tamu", label: "Estimasi Tamu", labelEn: "Estimated Guests", fullWidth: true, isNumeric: true },
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
    Family: [{ key: "jumlah_anggota", label: "Jumlah Anggota", labelEn: "Members" }],
    Lamaran: [
        { key: "nama_pasangan", label: "Nama Pasangan", labelEn: "Partner's Name", fullWidth: true, required: true },
        { key: "jumlah_tamu", label: "Estimasi Tamu", labelEn: "Estimated Guests", fullWidth: true, isNumeric: true },
    ],
    Prewedding: [
        { key: "nama_pasangan", label: "Nama Pasangan", labelEn: "Partner's Name", fullWidth: true, required: true },
    ],
};

type Service = { id: string; name: string; price: number };
type Freelance = { id: string; name: string };

function formatNumber(n: number | ""): string {
    if (n === "" || n === 0) return "";
    return new Intl.NumberFormat("id-ID").format(n);
}
function parseFormattedNumber(s: string): number | "" {
    const cleaned = s.replace(/\./g, "").replace(/,/g, "");
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? "" : num;
}
function sanitizePhone(raw: string): string {
    let cleaned = raw.replace(/[^0-9]/g, "");
    if (cleaned.startsWith("62")) cleaned = cleaned.slice(2);
    if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
    return cleaned;
}
function parseExistingPhone(full: string | null): { code: string; number: string } {
    if (!full) return { code: "+62", number: "" };
    const cleaned = full.replace(/[^0-9+]/g, "");
    for (const c of COUNTRY_CODES) {
        if (cleaned.startsWith(c.code)) return { code: c.code, number: cleaned.slice(c.code.length) };
        const numericCode = c.code.replace("+", "");
        if (cleaned.startsWith(numericCode)) return { code: c.code, number: cleaned.slice(numericCode.length) };
    }
    if (cleaned.startsWith("0")) return { code: "+62", number: cleaned.slice(1) };
    return { code: "+62", number: cleaned };
}

export default function EditBookingPage() {
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();
    const locale = useLocale();
    const supabase = createClient();

    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [calendarWarning, setCalendarWarning] = React.useState<string | null>(null);
    const [services, setServices] = React.useState<Service[]>([]);
    const [freelancers, setFreelancers] = React.useState<Freelance[]>([]);

    const [clientName, setClientName] = React.useState("");
    const [countryCode, setCountryCode] = React.useState("+62");
    const [phoneNumber, setPhoneNumber] = React.useState("");
    const [instagram, setInstagram] = React.useState("");
    const [eventType, setEventType] = React.useState("Umum");
    const [sessionDate, setSessionDate] = React.useState("");
    const [location, setLocation] = React.useState("");
    const [locationDetail, setLocationDetail] = React.useState("");
    const [serviceId, setServiceId] = React.useState("");
    const [freelancerIds, setFreelancerIds] = React.useState<string[]>([]);
    const [totalPrice, setTotalPrice] = React.useState<number | "">("");
    const [dpPaid, setDpPaid] = React.useState<number | "">("");
    const [status, setStatus] = React.useState("Pending");
    const [notes, setNotes] = React.useState("");
    const [driveFolderUrl, setDriveFolderUrl] = React.useState("");
    const [extraFields, setExtraFields] = React.useState<Record<string, string>>({});

    const [showCustomServicePopup, setShowCustomServicePopup] = React.useState(false);
    const [customServiceName, setCustomServiceName] = React.useState("");
    const [customServicePrice, setCustomServicePrice] = React.useState<number | "">("");
    const [customServiceDesc, setCustomServiceDesc] = React.useState("");
    const [savingCustomService, setSavingCustomService] = React.useState(false);

    const [showCustomFreelancerPopup, setShowCustomFreelancerPopup] = React.useState(false);
    const [customFreelancerName, setCustomFreelancerName] = React.useState("");
    const [customFreelancerWa, setCustomFreelancerWa] = React.useState("");
    const [customFreelancerRole, setCustomFreelancerRole] = React.useState("Photographer");
    const [savingCustomFreelancer, setSavingCustomFreelancer] = React.useState(false);
    const [customStatuses, setCustomStatuses] = React.useState<string[]>(DEFAULT_STATUSES);
    const [customFreelancerCountryCode, setCustomFreelancerCountryCode] = React.useState("+62");

    React.useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const [{ data: booking }, { data: svcs }, { data: frees }, { data: bfRows }, { data: prof }] = await Promise.all([
                supabase.from("bookings").select("*").eq("id", id).single(),
                supabase.from("services").select("id, name, price").eq("user_id", user.id).eq("is_active", true),
                supabase.from("freelance").select("id, name, google_email").eq("user_id", user.id).eq("status", "active"),
                supabase.from("booking_freelance").select("freelance_id").eq("booking_id", id),
                supabase.from("profiles").select("custom_statuses").eq("id", user.id).single(),
            ]);
            if (prof?.custom_statuses) setCustomStatuses(prof.custom_statuses as string[]);
            if (booking) {
                setClientName(booking.client_name || "");
                const parsed = parseExistingPhone(booking.client_whatsapp);
                setCountryCode(parsed.code);
                setPhoneNumber(parsed.number);
                setInstagram(booking.instagram || "");
                setEventType(booking.event_type || "Umum");
                setSessionDate(booking.session_date ? booking.session_date.slice(0, 16) : "");
                setLocation(booking.location || "");
                setLocationDetail(booking.location_detail || "");
                setServiceId(booking.service_id || "");
                // Load multi-freelancer from junction table, fallback to old column
                const junctionIds = (bfRows || []).map((r: any) => r.freelance_id);
                setFreelancerIds(junctionIds.length > 0 ? junctionIds : booking.freelance_id ? [booking.freelance_id] : []);
                setTotalPrice(booking.total_price || "");
                setDpPaid(booking.dp_paid || "");
                setStatus(booking.status || "Pending");
                setNotes(booking.notes || "");
                setDriveFolderUrl(booking.drive_folder_url || "");
                setExtraFields(booking.extra_fields || {});
            }
            setServices((svcs || []) as Service[]);
            setFreelancers((frees || []) as Freelance[]);
            setLoading(false);
        }
        load();
    }, [id]);

    const handleServiceChange = (val: string) => {
        if (val === "__custom__") { setShowCustomServicePopup(true); return; }
        setServiceId(val);
        const selected = services.find(s => s.id === val);
        if (selected) setTotalPrice(selected.price);
    };
    const toggleFreelancer = (fid: string) => {
        setFreelancerIds(prev => {
            if (prev.includes(fid)) return prev.filter(f => f !== fid);
            if (prev.length >= 5) return prev;
            return [...prev, fid];
        });
    };

    async function saveCustomService() {
        if (!customServiceName.trim()) return;
        setSavingCustomService(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase.from("services").insert({
            user_id: user.id, name: customServiceName.trim(),
            description: customServiceDesc.trim() || null,
            price: parseFloat(customServicePrice.toString()) || 0, is_active: true,
        }).select("id, name, price").single();
        if (!error && data) {
            const s = data as Service;
            setServices(prev => [...prev, s]);
            setServiceId(s.id);
            setTotalPrice(s.price);
            setCustomServiceName(""); setCustomServicePrice(""); setCustomServiceDesc("");
            setShowCustomServicePopup(false);
        } else { alert("Gagal menyimpan paket."); }
        setSavingCustomService(false);
    }

    async function saveCustomFreelancer() {
        if (!customFreelancerName.trim()) return;
        setSavingCustomFreelancer(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase.from("freelance").insert({
            user_id: user.id, name: customFreelancerName.trim(),
            role: customFreelancerRole || "Photographer",
            whatsapp_number: customFreelancerWa ? `${customFreelancerCountryCode}${customFreelancerWa}`.replace(/[^0-9+]/g, "") : null, status: "active",
        }).select("id, name").single();
        if (!error && data) {
            const f = data as Freelance;
            setFreelancers(prev => [...prev, f]);
            setFreelancerIds(prev => prev.length < 5 ? [...prev, f.id] : prev);
            setCustomFreelancerName(""); setCustomFreelancerWa(""); setCustomFreelancerRole("Photographer"); setCustomFreelancerCountryCode("+62");
            setShowCustomFreelancerPopup(false);
        } else { console.error(error); alert("Gagal menyimpan freelance."); }
        setSavingCustomFreelancer(false);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        const fullPhone = phoneNumber ? `${countryCode}${sanitizePhone(phoneNumber)}` : null;
        const tPrice = parseFloat(totalPrice.toString()) || 0;
        const dPaid = parseFloat(dpPaid.toString()) || 0;
        const { error } = await supabase.from("bookings").update({
            client_name: clientName,
            client_whatsapp: fullPhone,
            instagram: instagram || null,
            event_type: eventType,
            session_date: sessionDate || null,
            location: (eventType === "Wedding" ? (extraFields.tempat_akad || extraFields.tempat_resepsi || location) : location) || null,
            location_detail: locationDetail || null,
            service_id: serviceId || null,
            freelance_id: freelancerIds[0] || null,
            total_price: tPrice,
            dp_paid: dPaid,
            is_fully_paid: dPaid >= tPrice && tPrice > 0,
            status,
            notes: notes || null,
            drive_folder_url: driveFolderUrl || null,
            extra_fields: Object.keys(extraFields).length > 0 ? extraFields : null,
            updated_at: new Date().toISOString(),
        }).eq("id", id);
        setSaving(false);
        if (!error) {
            // Sync junction table
            await supabase.from("booking_freelance").delete().eq("booking_id", id);
            if (freelancerIds.length > 0) {
                await supabase.from("booking_freelance").insert(
                    freelancerIds.map(fid => ({ booking_id: id, freelance_id: fid }))
                );

                // Send calendar invites to assigned freelancers
                try {
                    const selectedFreelancerEmails = freelancers
                        .filter(f => freelancerIds.includes(f.id))
                        .map(f => (f as any).google_email)
                        .filter(Boolean);
                    if (!sessionDate) {
                        setCalendarWarning("⚠️ Calendar invite tidak terkirim: jadwal sesi belum diisi");
                        setTimeout(() => setCalendarWarning(null), 5000);
                    } else if (selectedFreelancerEmails.length === 0) {
                        const noEmailNames = freelancers
                            .filter(f => freelancerIds.includes(f.id) && !(f as any).google_email)
                            .map(f => f.name);
                        if (noEmailNames.length > 0) {
                            setCalendarWarning(`⚠️ Calendar invite tidak terkirim: ${noEmailNames.join(", ")} belum punya Google Email`);
                            setTimeout(() => setCalendarWarning(null), 5000);
                        }
                    } else {
                        const res = await fetch("/api/google/calendar-invite", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                bookingId: id,
                                attendeeEmails: selectedFreelancerEmails,
                            }),
                        });
                        if (!res.ok) {
                            const err = await res.json().catch(() => ({}));
                            setCalendarWarning(`⚠️ Calendar invite gagal: ${err.error || "Google Calendar belum terkoneksi"}`);
                            setTimeout(() => setCalendarWarning(null), 5000);
                        }
                    }
                } catch {
                    setCalendarWarning("⚠️ Calendar invite gagal terkirim");
                    setTimeout(() => setCalendarWarning(null), 5000);
                }
            }
            router.push(`/${locale}/bookings/${id}`);
        }
        else { alert("Gagal menyimpan perubahan."); }
    }

    const currentExtraFields = EXTRA_FIELDS_DEF[eventType] || [];
    const reqMark = <span className="text-red-500 ml-0.5">*</span>;

    if (loading) return (
        <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
    );

    return (
        <>
            {calendarWarning && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 px-4 py-3 shadow-lg text-sm text-amber-800 dark:text-amber-200 max-w-md">
                        <span>{calendarWarning}</span>
                        <button onClick={() => setCalendarWarning(null)} className="ml-2 text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 shrink-0 cursor-pointer">✕</button>
                    </div>
                </div>
            )}
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            <div className="flex items-center gap-3">
                <Link href={`/bookings/${id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="w-4 h-4" /></Button>
                </Link>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Edit Booking</h2>
                    <p className="text-muted-foreground text-sm">{clientName}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
                    <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Users className="w-4 h-4" /> Informasi Klien
                    </h3>
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Nama{reqMark}</label>
                            <input required value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nama klien" className={inputClass} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Nomor WhatsApp{reqMark}</label>
                            <div className="flex gap-1.5">
                                <select value={countryCode} onChange={e => setCountryCode(e.target.value)} className={cn(selectClass, "w-[110px] shrink-0 text-xs")}>
                                    {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                                </select>
                                <input required type="tel" value={phoneNumber} onChange={e => setPhoneNumber(sanitizePhone(e.target.value))} placeholder="812345678" className={cn(inputClass, "flex-1")} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Instagram</label>
                            <input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@username" className={inputClass} />
                        </div>
                    </div>
                    {currentExtraFields.length > 0 && (
                        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 pt-3 border-t border-dashed">
                            {currentExtraFields.map(f => (
                                <div key={f.key} className={`space-y-1.5 ${f.isLocation || f.fullWidth || currentExtraFields.length === 1 ? "col-span-full" : ""}`}>
                                    <label className="text-xs font-medium text-muted-foreground">{locale === "id" ? f.label : f.labelEn}{f.required && <span className="text-red-500 ml-0.5">*</span>}</label>
                                    {f.isLocation ? (
                                        <LocationAutocomplete value={extraFields[f.key] || ""} onChange={v => setExtraFields(prev => ({ ...prev, [f.key]: v }))} placeholder={`Cari lokasi ${f.label.toLowerCase()}...`} />
                                    ) : f.isNumeric ? (
                                        <input placeholder={f.label} value={extraFields[f.key] || ""} onChange={e => {
                                            const raw = e.target.value.replace(/[^0-9]/g, "");
                                            const num = parseInt(raw, 10);
                                            setExtraFields(prev => ({ ...prev, [f.key]: raw === "" ? "" : new Intl.NumberFormat("id-ID").format(num) }));
                                        }} className={inputClass} required={f.required} inputMode="numeric" />
                                    ) : (
                                        <input placeholder={f.label} value={extraFields[f.key] || ""} onChange={e => setExtraFields(prev => ({ ...prev, [f.key]: e.target.value }))} className={inputClass} required={f.required} />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
                    <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <CalendarClock className="w-4 h-4" /> Detail Sesi
                    </h3>
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                        <div className="col-span-full space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Tipe Acara{reqMark}</label>
                            <select value={eventType} onChange={e => { setEventType(e.target.value); setExtraFields({}); }} className={selectClass} required>
                                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Tanggal{reqMark}</label>
                            <input type="date" value={sessionDate ? sessionDate.split("T")[0] : ""} onChange={e => {
                                const timePart = sessionDate?.split("T")[1] || "10:00";
                                setSessionDate(e.target.value ? `${e.target.value}T${timePart}` : "");
                            }} required className={cn(inputClass, "block")} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Jam{reqMark}</label>
                            <input type="time" value={sessionDate ? sessionDate.split("T")[1] || "10:00" : ""} onChange={e => {
                                const datePart = sessionDate?.split("T")[0] || "";
                                if (datePart) setSessionDate(`${datePart}T${e.target.value}`);
                            }} className={cn(inputClass, "block")} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Status{reqMark}</label>
                            <select value={status} onChange={e => setStatus(e.target.value)} className={selectClass} required>
                                {customStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        {eventType !== "Wedding" && (
                            <div className="col-span-full space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Lokasi Utama</label>
                                <LocationAutocomplete value={location} onChange={setLocation} placeholder="Cari lokasi sesi foto..." />
                            </div>
                        )}
                        <div className="col-span-full space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Detail Lokasi</label>
                            <input value={locationDetail} onChange={e => setLocationDetail(e.target.value)} placeholder="Contoh: Gedung Utama, Lt. 3, Ruang Ballroom A" className={inputClass} />
                        </div>
                        <div className="col-span-full space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Paket / Layanan{reqMark}</label>
                            <select value={serviceId} onChange={e => handleServiceChange(e.target.value)} className={selectClass} required>
                                <option value="">-- Pilih Paket --</option>
                                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                <option value="__custom__">＋ Tambah Paket Baru...</option>
                            </select>
                        </div>
                        <div className="col-span-full space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Freelance (max 5)</label>
                            <div className="flex flex-wrap gap-2">
                                {freelancers.map(f => (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => toggleFreelancer(f.id)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer",
                                            freelancerIds.includes(f.id)
                                                ? "border-foreground bg-foreground/5 dark:bg-foreground/10 text-foreground"
                                                : "border-input text-muted-foreground hover:bg-muted/50"
                                        )}
                                    >
                                        {f.name}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setShowCustomFreelancerPopup(true)}
                                    className="px-3 py-1.5 rounded-lg border border-dashed border-input text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer"
                                >
                                    ＋ Tambah Baru
                                </button>
                            </div>
                            {freelancerIds.length > 0 && (
                                <p className="text-[10px] text-muted-foreground">{freelancerIds.length}/5 dipilih</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
                    <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Wallet className="w-4 h-4" /> Keuangan
                    </h3>
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Harga Total{reqMark}</label>
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-muted-foreground shrink-0">Rp</span>
                                <input required type="text" inputMode="numeric" value={formatNumber(totalPrice)} onChange={e => setTotalPrice(parseFormattedNumber(e.target.value))} placeholder="0" className={cn(inputClass, "flex-1")} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">DP Dibayar{reqMark}</label>
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-muted-foreground shrink-0">Rp</span>
                                <input required type="text" inputMode="numeric" value={formatNumber(dpPaid)} onChange={e => setDpPaid(parseFormattedNumber(e.target.value))} placeholder="0" className={cn(inputClass, "flex-1")} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-3">
                    <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <StickyNote className="w-4 h-4" /> Catatan
                    </h3>
                    <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Detail tambahan..." className={textareaClass} />
                </div>

                {/* Link Google Drive */}
                <div className="rounded-xl border bg-card p-6 shadow-sm space-y-3">
                    <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Link2 className="w-4 h-4" /> Link Google Drive
                    </h3>
                    <input type="url" value={driveFolderUrl} onChange={e => setDriveFolderUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/..." className={inputClass} />
                    <p className="text-[11px] text-muted-foreground">Tempelkan link folder Google Drive klien di sini (opsional).</p>
                </div>

                <div className="flex gap-3 justify-end pt-4">
                    <Link href={`/bookings/${id}`}><Button type="button" variant="ghost" className="text-muted-foreground hover:text-foreground">Batal</Button></Link>
                    <Button type="submit" disabled={saving} className="gap-2 bg-foreground text-background hover:bg-foreground/90 px-8">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Simpan Perubahan
                    </Button>
                </div>
            </form>

            <Dialog open={showCustomServicePopup} onOpenChange={setShowCustomServicePopup}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> Tambah Paket Baru</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Nama Paket <span className="text-red-500">*</span></label>
                            <input value={customServiceName} onChange={e => setCustomServiceName(e.target.value)} placeholder="Contoh: Paket Gold" className={inputClass} autoFocus />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Deskripsi</label>
                            <textarea value={customServiceDesc} onChange={e => setCustomServiceDesc(e.target.value)} placeholder="Deskripsi singkat paket..." rows={2} className={textareaClass} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Harga (Rp)</label>
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-muted-foreground shrink-0">Rp</span>
                                <input type="text" inputMode="numeric" value={formatNumber(customServicePrice)} onChange={e => setCustomServicePrice(parseFormattedNumber(e.target.value))} placeholder="0" className={cn(inputClass, "flex-1")} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCustomServicePopup(false)} disabled={savingCustomService}>Batal</Button>
                        <Button onClick={saveCustomService} disabled={savingCustomService || !customServiceName.trim()}>
                            {savingCustomService ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />} Simpan & Pilih
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showCustomFreelancerPopup} onOpenChange={setShowCustomFreelancerPopup}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> Tambah Freelance Baru</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Nama <span className="text-red-500">*</span></label>
                            <input value={customFreelancerName} onChange={e => setCustomFreelancerName(e.target.value)} placeholder="Nama lengkap" className={inputClass} autoFocus />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Role <span className="text-red-500">*</span></label>
                            <select value={customFreelancerRole} onChange={e => setCustomFreelancerRole(e.target.value)} className={selectClass}>
                                <option value="Photographer">Photographer</option>
                                <option value="Videographer">Videographer</option>
                                <option value="MUA">MUA</option>
                                <option value="Editor">Editor</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">WhatsApp</label>
                            <div className="flex gap-2">
                                <select value={customFreelancerCountryCode} onChange={e => setCustomFreelancerCountryCode(e.target.value)} className={selectClass + " !w-28 shrink-0"}>
                                    {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                                </select>
                                <input value={customFreelancerWa} onChange={e => {
                                    const val = e.target.value.replace(/[^0-9]/g, "");
                                    setCustomFreelancerWa(val.startsWith("0") ? val.slice(1) : val.startsWith("62") ? val.slice(2) : val);
                                }} placeholder="8123456789" className={inputClass} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCustomFreelancerPopup(false)} disabled={savingCustomFreelancer}>Batal</Button>
                        <Button onClick={saveCustomFreelancer} disabled={savingCustomFreelancer || !customFreelancerName.trim()}>
                            {savingCustomFreelancer ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />} Simpan & Pilih
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
        </>
    );
}
