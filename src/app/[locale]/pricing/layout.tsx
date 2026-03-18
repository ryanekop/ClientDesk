import type { Metadata } from "next";
import { getTenantConfig } from "@/lib/tenant-config";

export async function generateMetadata(): Promise<Metadata> {
    const tenant = await getTenantConfig();
    return {
        title: `Pricing — ${tenant.name}`,
        description: `Pilih paket ${tenant.name} yang sesuai kebutuhan Anda.`,
    };
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
    return children;
}
