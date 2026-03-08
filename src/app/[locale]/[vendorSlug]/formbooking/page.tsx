"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Loader2, CheckCircle2, Upload, CalendarDays, MapPin, Camera, MessageCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const EVENT_TYPES = ["Umum", "Wedding", "Akad", "Resepsi", "Wisuda", "Maternity", "Newborn", "Family", "Komersil", "Lainnya"];

const EXTRA_FIELDS: Record<string, { key: string; label: string }[]> = {
    Wisuda: [{ key: "universitas", label: "Universitas" }],
    Wedding: [
        { key: "nama_pasangan", label: "Nama Pasangan" },
        { key: "jumlah_tamu", label: "Estimasi Tamu" },
    ],
    Akad: [{ key: "nama_pasangan", label: "Nama Pasangan" }],
    Resepsi: [
        { key: "nama_pasangan", label: "Nama Pasangan" },
        { key: "jumlah_tamu", label: "Estimasi Tamu" },
    ],
    Maternity: [{ key: "usia_kandungan", label: "Usia Kandungan (bulan)" }],
    Newborn: [{ key: "nama_bayi", label: "Nama Bayi" }],
    Komersil: [{ key: "tipe_konten", label: "Tipe Konten" }],
    Family: [{ key: "jumlah_anggota", label: "Jumlah Anggota" }],
};

const COUNTRY_CODES = [
    { code: "+62", flag: "🇮🇩", name: "Indonesia" },
    { code: "+60", flag: "🇲🇾", name: "Malaysia" },
    { code: "+65", flag: "🇸🇬", name: "Singapore" },
    { code: "+66", flag: "🇹🇭", name: "Thailand" },
    { code: "+63", flag: "🇵🇭", name: "Philippines" },
    { code: "+84", flag: "🇻🇳", name: "Vietnam" },
    { code: "+95", flag: "🇲🇲", name: "Myanmar" },
    { code: "+856", flag: "🇱🇦", name: "Laos" },
    { code: "+855", flag: "🇰🇭", name: "Cambodia" },
    { code: "+673", flag: "🇧🇳", name: "Brunei" },
];

type Service = { id: string; name: string; price: number; description: string | null };
type Vendor = {
    id: string;
    studio_name: string | null;
    whatsapp_number: string | null;
    min_dp_percent: number | null;
    avatar_url: string | null;
};

function formatCurrency(n: number) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

function formatNumber(n: number | ""): string {
    if (n === "" || n === 0) return "";
    return new Intl.NumberFormat("id-ID").format(n);
}

function parseFormatted(s: string): number | "" {
    const cleaned = s.replace(/\./g, "").replace(/,/g, "");
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? "" : num;
}

export default function PublicBookingForm() {
    const params = useParams();
    const slug = params?.vendorSlug as string;
    const supabase = createClient();

    const [vendor, setVendor] = React.useState<Vendor | null>(null);
    const [services, setServices] = React.useState<Service[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [notFound, setNotFound] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    const [submitted, setSubmitted] = React.useState(false);
    const [resultData, setResultData] = React.useState<any>(null);

    // Form state
    const [clientName, setClientName] = React.useState("");
    const [countryCode, setCountryCode] = React.useState("+62");
    const [phone, setPhone] = React.useState("");
    const [eventType, setEventType] = React.useState("");
    const [sessionDate, setSessionDate] = React.useState("");
    const [serviceId, setServiceId] = React.useState("");
    const [selectedService, setSelectedService] = React.useState<Service | null>(null);
    const [dpDisplay, setDpDisplay] = React.useState("");
    const [location, setLocation] = React.useState("");
    const [notes, setNotes] = React.useState("");
    const [extraData, setExtraData] = React.useState<Record<string, string>>({});
    const [proofFile, setProofFile] = React.useState<File | null>(null);
    const [proofPreview, setProofPreview] = React.useState<string | null>(null);
    const [uploadingProof, setUploadingProof] = React.useState(false);
    const [error, setError] = React.useState("");

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        async function load() {
            // Get vendor by slug
            const { data: v } = await supabase
                .from("profiles")
                .select("id, studio_name, whatsapp_number, min_dp_percent, avatar_url")
                .eq("vendor_slug", slug)
                .single();

            if (!v) { setNotFound(true); setLoading(false); return; }
            setVendor(v as Vendor);

            // Get vendor's services
            const { data: svcs } = await supabase
                .from("services")
                .select("id, name, price, description")
                .eq("user_id", v.id)
                .order("name");
            setServices((svcs || []) as Service[]);
            setLoading(false);
        }
        if (slug) load();
    }, [slug]);

    function handleServiceChange(id: string) {
        setServiceId(id);
        const svc = services.find(s => s.id === id) || null;
        setSelectedService(svc);
        if (svc) {
            const minDP = vendor?.min_dp_percent ?? 50;
            const minAmount = Math.ceil((svc.price * minDP) / 100);
            setDpDisplay(formatNumber(minAmount));
        } else {
            setDpDisplay("");
        }
    }

    function handleProofFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setProofFile(file);
        const reader = new FileReader();
        reader.onload = () => setProofPreview(reader.result as string);
        reader.readAsDataURL(file);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");

        if (!clientName || !phone || !sessionDate || !serviceId) {
            setError("Mohon lengkapi semua field yang wajib.");
            return;
        }

        const fullPhone = `${countryCode}${phone}`.replace(/[^0-9+]/g, "");
        const dpValue = parseFormatted(dpDisplay) || 0;

        setSubmitting(true);

        // Upload proof if exists
        let paymentProofUrl: string | null = null;
        if (proofFile) {
            setUploadingProof(true);
            const ext = proofFile.name.split(".").pop();
            const path = `payment-proofs/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
            const { error: uploadErr } = await supabase.storage
                .from("payment-proofs")
                .upload(path, proofFile, { upsert: false });

            if (uploadErr) {
                setError("Gagal upload bukti pembayaran: " + uploadErr.message);
                setSubmitting(false);
                setUploadingProof(false);
                return;
            }
            const { data: publicUrl } = supabase.storage.from("payment-proofs").getPublicUrl(path);
            paymentProofUrl = publicUrl.publicUrl;
            setUploadingProof(false);
        }

        try {
            const res = await fetch("/api/public/booking", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    vendorSlug: slug,
                    clientName,
                    clientWhatsapp: fullPhone,
                    eventType: eventType || null,
                    sessionDate,
                    serviceId,
                    totalPrice: selectedService?.price || 0,
                    dpPaid: dpValue,
                    location: location || null,
                    notes: notes || null,
                    extraData: Object.keys(extraData).length > 0 ? extraData : null,
                    paymentProofUrl,
                }),
            });

            const data = await res.json();
            if (data.success) {
                setSubmitted(true);
                setResultData(data);
            } else {
                setError(data.error || "Gagal mengirim booking.");
            }
        } catch {
            setError("Terjadi kesalahan. Silakan coba lagi.");
        }
        setSubmitting(false);
    }

    function openWhatsAppConfirmation() {
        if (!resultData?.vendorWhatsapp) return;
        const wa = resultData.vendorWhatsapp.replace(/^0/, "62").replace(/[^0-9]/g, "");
        const svcName = selectedService?.name || "-";
        const dateStr = sessionDate ? new Date(sessionDate).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
        const dpVal = parseFormatted(dpDisplay) || 0;

        const msg = `Halo ${resultData.vendorName || "Admin"}, saya baru saja booking melalui form online.

📋 *Detail Booking*
Kode: *${resultData.bookingCode}*
Nama: ${clientName}
Paket: ${svcName}
Jadwal: ${dateStr}
${location ? `Lokasi: ${location}\n` : ""}
💰 Total: ${formatCurrency(selectedService?.price || 0)}
✅ DP: ${formatCurrency(dpVal)}
${proofFile ? "📎 Bukti transfer sudah diupload." : ""}

Mohon konfirmasi booking saya. Terima kasih! 🙏`;

        window.open(`https://api.whatsapp.com/send?phone=${wa}&text=${encodeURIComponent(msg)}`, "_blank");
    }

    const inputClass = "placeholder:text-muted-foreground h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] transition-all";
    const selectClass = inputClass + " cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23999%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat pr-8";

    const minDP = vendor?.min_dp_percent ?? 50;
    const currentExtraFields = EXTRA_FIELDS[eventType] || [];

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (notFound) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
                <div className="text-center space-y-4 max-w-md mx-auto px-6">
                    <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto text-4xl">🔍</div>
                    <h2 className="text-2xl font-bold">Vendor Tidak Ditemukan</h2>
                    <p className="text-muted-foreground">URL yang Anda akses tidak valid atau vendor belum terdaftar.</p>
                </div>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 px-4">
                <div className="text-center space-y-6 max-w-md mx-auto">
                    <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-500/10 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-10 h-10 text-green-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold mb-2">Booking Berhasil! 🎉</h2>
                        <p className="text-muted-foreground text-sm">Kode Booking Anda:</p>
                        <p className="text-3xl font-bold text-primary mt-1 font-mono">{resultData?.bookingCode}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Silakan konfirmasi booking Anda ke admin melalui WhatsApp untuk proses lebih lanjut.
                    </p>
                    <button
                        onClick={openWhatsAppConfirmation}
                        className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20 cursor-pointer text-base"
                    >
                        <MessageCircle className="w-5 h-5" /> Konfirmasi via WhatsApp
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 py-8 sm:py-12 px-4">
            <div className="max-w-xl mx-auto space-y-6">
                {/* Vendor Header */}
                <div className="text-center space-y-3">
                    <div className="w-20 h-20 bg-background border-2 rounded-full mx-auto flex items-center justify-center font-bold text-2xl shadow-sm overflow-hidden">
                        {vendor?.avatar_url ? (
                            <img src={vendor.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            vendor?.studio_name?.charAt(0)?.toUpperCase() || "V"
                        )}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{vendor?.studio_name || "Studio"}</h1>
                        <p className="text-muted-foreground text-sm">Silakan isi formulir di bawah ini untuk booking.</p>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-background rounded-2xl shadow-lg border p-6 sm:p-8 space-y-5">
                    {/* Client Info */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Informasi Klien</h3>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Nama Lengkap <span className="text-red-500">*</span></label>
                            <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nama lengkap Anda" className={inputClass} required />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Nomor WhatsApp <span className="text-red-500">*</span></label>
                            <div className="flex gap-2">
                                <select value={countryCode} onChange={e => setCountryCode(e.target.value)} className={selectClass + " !w-28 shrink-0"}>
                                    {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                                </select>
                                <input
                                    value={phone}
                                    onChange={e => {
                                        const val = e.target.value.replace(/[^0-9]/g, "");
                                        setPhone(val.startsWith("0") ? val.slice(1) : val.startsWith("62") ? val.slice(2) : val);
                                    }}
                                    placeholder="8123456789"
                                    className={inputClass}
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Session Details */}
                    <div className="space-y-4 pt-2">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5" /> Detail Sesi
                        </h3>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Tipe Acara <span className="text-red-500">*</span></label>
                                <select value={eventType} onChange={e => { setEventType(e.target.value); setExtraData({}); }} className={selectClass} required>
                                    <option value="">Pilih tipe...</option>
                                    {EVENT_TYPES.map(et => <option key={et} value={et}>{et}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Jadwal Sesi <span className="text-red-500">*</span></label>
                                <input type="datetime-local" value={sessionDate} onChange={e => setSessionDate(e.target.value)} className={inputClass} required />
                            </div>
                        </div>

                        {/* Extra event fields */}
                        {currentExtraFields.length > 0 && (
                            <div className={`grid gap-4 ${currentExtraFields.length === 1 ? "" : "sm:grid-cols-2"}`}>
                                {currentExtraFields.map(f => (
                                    <div key={f.key} className={`space-y-1.5 ${currentExtraFields.length === 1 ? "col-span-full" : ""}`}>
                                        <label className="text-sm font-medium">{f.label}</label>
                                        <input
                                            value={extraData[f.key] || ""}
                                            onChange={e => setExtraData(prev => ({ ...prev, [f.key]: e.target.value }))}
                                            placeholder={f.label}
                                            className={inputClass}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Lokasi</label>
                            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Lokasi acara (opsional)" className={inputClass} />
                        </div>
                    </div>

                    {/* Package & Payment */}
                    <div className="space-y-4 pt-2">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Paket & Pembayaran</h3>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Paket / Layanan <span className="text-red-500">*</span></label>
                            <select value={serviceId} onChange={e => handleServiceChange(e.target.value)} className={selectClass} required>
                                <option value="">Pilih paket...</option>
                                {services.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} — {formatCurrency(s.price)}</option>
                                ))}
                            </select>
                        </div>

                        {selectedService && (
                            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium">{selectedService.name}</span>
                                    <span className="text-lg font-bold text-primary">{formatCurrency(selectedService.price)}</span>
                                </div>
                                {selectedService.description && (
                                    <p className="text-xs text-muted-foreground">{selectedService.description}</p>
                                )}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">
                                DP (Minimal {minDP}%) <span className="text-red-500">*</span>
                            </label>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-muted-foreground shrink-0">Rp</span>
                                <input
                                    value={dpDisplay}
                                    onChange={e => {
                                        const val = parseFormatted(e.target.value);
                                        setDpDisplay(val === "" ? "" : formatNumber(val));
                                    }}
                                    placeholder={selectedService ? formatNumber(Math.ceil(selectedService.price * minDP / 100)) : "0"}
                                    className={inputClass}
                                    required
                                />
                            </div>
                            {selectedService && (
                                <p className="text-xs text-muted-foreground">
                                    Minimum: {formatCurrency(Math.ceil(selectedService.price * minDP / 100))}
                                </p>
                            )}
                        </div>

                        {/* Payment Proof Upload */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium flex items-center gap-1.5"><Camera className="w-3.5 h-3.5" /> Bukti Pembayaran</label>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer"
                            >
                                {proofPreview ? (
                                    <img src={proofPreview} alt="Bukti" className="max-h-40 rounded-lg object-contain" />
                                ) : (
                                    <>
                                        <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                                        <p className="text-sm text-muted-foreground">Klik untuk upload bukti transfer</p>
                                        <p className="text-xs text-muted-foreground mt-1">JPG, PNG, atau PDF (max 5MB)</p>
                                    </>
                                )}
                            </div>
                            <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleProofFile} />
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5 pt-2">
                        <label className="text-sm font-medium">Catatan</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={3}
                            placeholder="Catatan tambahan (opsional)..."
                            className="placeholder:text-muted-foreground w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-none transition-all"
                        />
                    </div>

                    {/* Error / Submit */}
                    {error && (
                        <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-3 text-sm text-red-600 dark:text-red-400">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="flex items-center justify-center gap-2 w-full h-12 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 cursor-pointer disabled:opacity-50 text-base"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                {uploadingProof ? "Mengupload bukti..." : "Mengirim..."}
                            </>
                        ) : (
                            <>Kirim Booking</>
                        )}
                    </button>
                </form>

                <p className="text-center text-xs text-muted-foreground pb-4">
                    Powered by <span className="font-semibold">Client Desk</span>
                </p>
            </div>
        </div>
    );
}
