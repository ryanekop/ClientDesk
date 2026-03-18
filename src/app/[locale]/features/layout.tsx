import type { Metadata } from "next";
import { getTenantConfig } from "@/lib/tenant-config";

export async function generateMetadata(): Promise<Metadata> {
    const tenant = await getTenantConfig();
    return {
        title: `Features — ${tenant.name}`,
        description: `Semua fitur ${tenant.name} untuk mengelola klien, booking, invoice, dan jadwal vendor.`,
    };
}

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
    return children;
}
