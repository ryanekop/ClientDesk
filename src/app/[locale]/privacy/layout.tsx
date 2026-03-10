import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Privacy Policy — Client Desk",
    description: "Kebijakan privasi Client Desk.",
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
    return children;
}
