"use client";

import * as React from "react";
import { CheckCircle2, Clock, PlayCircle, HardDrive } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const timeline = [
    { step: "Booking Confirmed", date: "26 Feb 2026", done: true, icon: CheckCircle2 },
    { step: "Sesi Foto / Acara", date: "28 Feb 2026", done: true, icon: PlayCircle },
    { step: "Proses Edit Utama", date: "Estimasi 3 Mar 2026", done: false, icon: Clock, current: true },
    { step: "File Tersedia (Google Drive)", date: "-", done: false, icon: HardDrive },
];

export default function TrackingPage() {
    return (
        <div className="min-h-screen bg-muted/30 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto space-y-8">

                <div className="bg-background rounded-xl shadow-md p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-6 mb-6">
                        <div>
                            <h2 className="text-xl font-bold">Detail Antrian</h2>
                            <p className="text-muted-foreground text-sm">ID: BKG-002 • Avie Detranium</p>
                        </div>
                        <div className="mt-4 sm:mt-0">
                            <Badge variant="outline" className="text-sm py-1 bg-muted/50">Status: Diantrikan Edit</Badge>
                        </div>
                    </div>

                    <div className="space-y-8 py-4">
                        {timeline.map((item, idx) => (
                            <div key={idx} className="relative flex gap-6">
                                {/* Vertical Line */}
                                {idx !== timeline.length - 1 && (
                                    <div className={`absolute top-8 bottom-[-2rem] left-5 w-[2px] ${item.done ? "bg-primary" : "bg-border"}`} />
                                )}

                                <div className={`relative z-10 flex shrink-0 items-center justify-center w-10 h-10 rounded-full border-2 
                      ${item.done ? "bg-primary border-primary text-primary-foreground" :
                                        item.current ? "bg-background border-primary text-primary" : "bg-background border-border text-muted-foreground"}`
                                }>
                                    <item.icon className="w-5 h-5" />
                                </div>

                                <div className="flex flex-col pt-2">
                                    <p className={`font-semibold ${item.done || item.current ? "text-foreground" : "text-muted-foreground"}`}>
                                        {item.step}
                                    </p>
                                    <p className="text-sm text-muted-foreground">{item.date}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}
