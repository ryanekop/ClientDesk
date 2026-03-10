import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Features — Client Desk",
    description: "Semua fitur Client Desk untuk mengelola klien, booking, invoice, dan jadwal vendor.",
};

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
    return children;
}
