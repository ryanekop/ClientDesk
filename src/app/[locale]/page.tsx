import { useTranslations } from "next-intl";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, CalendarCheck, Zap, Shield } from "lucide-react";

export default function Home() {
  const t = useTranslations("Index");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 h-16 flex items-center justify-between font-medium">
        <div className="font-bold text-xl tracking-tight">Client Desk</div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href="/id/dashboard">Masuk</Link>
          </Button>
          <Button asChild className="shadow-sm">
            <Link href="/id/dashboard">Mulai Gratis</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col pt-24 pb-16 px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto space-y-8">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground">
            Kelola Klien Vendor Anda Lebih Ringkas
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            Sistem manajemen booking, faktur, dan konfirmasi WhatsApp. Dirancang secara modern dan minimalis khusus untuk vendor freelance, fotografer, videografer, dan MUA.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base shadow-md gap-2" asChild>
              <Link href="/id/dashboard">Pergi ke Dashboard <ArrowRight className="w-4 h-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-8 text-base shadow-sm border-0 bg-muted/50 hover:bg-muted" asChild>
              <Link href="/id/book/detranium">Lihat Demo Booking</Link>
            </Button>
          </div>
        </div>

        <div className="mt-32 grid sm:grid-cols-3 gap-8 text-center max-w-4xl mx-auto">
          <div className="flex flex-col items-center space-y-4 p-6 rounded-2xl shadow-sm bg-muted/20">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-xl">Booking Mudah</h3>
            <p className="text-muted-foreground text-sm">Integrasi form pemesanan langsung dengan validasi Google Calendar.</p>
          </div>
          <div className="flex flex-col items-center space-y-4 p-6 rounded-2xl shadow-sm bg-muted/20">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-xl">Auto Drive & WA</h3>
            <p className="text-muted-foreground text-sm">Sekali klik generate folder kerja di Google Drive dan kirim pesan WA.</p>
          </div>
          <div className="flex flex-col items-center space-y-4 p-6 rounded-2xl shadow-sm bg-muted/20">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-xl">Invoice & Finance</h3>
            <p className="text-muted-foreground text-sm">Catatan invoice profesional dan pantau antrian pendapatan DP.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
