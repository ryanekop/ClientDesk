import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function Layout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/id/login");
    }

    return <DashboardLayout>{children}</DashboardLayout>;
}
