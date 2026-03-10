import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Pricing — Client Desk",
    description: "Pilih paket Client Desk yang sesuai kebutuhan Anda. Mulai dari Rp 39.000/bulan.",
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
    return children;
}
