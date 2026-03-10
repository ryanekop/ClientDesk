import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "FAQ — Client Desk",
    description: "Pertanyaan yang sering ditanyakan tentang Client Desk.",
};

export default function FAQLayout({ children }: { children: React.ReactNode }) {
    return children;
}
