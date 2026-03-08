"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

// Basic dummy layout for booking form
export default function BookingFormPage() {
    return (
        <div className="min-h-screen bg-muted/30 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto space-y-8">

                <div className="text-center">
                    <div className="w-20 h-20 bg-background border rounded-full mx-auto flex items-center justify-center font-bold text-2xl shadow-sm">
                        D
                    </div>
                    <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground">Detranium Photography</h2>
                    <p className="mt-2 text-muted-foreground text-sm">Silakan isi formulir di bawah ini untuk memulai booking layanan kami.</p>
                </div>

                <div className="bg-background rounded-xl shadow-md p-6 sm:p-8">
                    <form className="space-y-6">

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nama Lengkap</label>
                            <input
                                type="text"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="John Doe"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nomor WhatsApp</label>
                            <input
                                type="tel"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="08123456789"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Paket Pilihan</label>
                            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                                <option value="">Pilih Paket...</option>
                                <option value="wedding">Wedding - All In</option>
                                <option value="personal">Personal - Gold</option>
                                <option value="event">Event - Standard</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Tanggal / Waktu Acara</label>
                            <input
                                type="datetime-local"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Catatan Tambahan</label>
                            <textarea
                                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Lokasi acara, referensi khusus..."
                            />
                        </div>

                        <Button className="w-full h-12 text-base">
                            Kirim via WhatsApp
                        </Button>

                    </form>
                </div>
            </div>
        </div>
    );
}
