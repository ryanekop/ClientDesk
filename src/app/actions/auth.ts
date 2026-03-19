"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { normalizeAuthLocale } from "@/lib/auth/public-origin";

export async function login(formData: FormData) {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const locale = normalizeAuthLocale(formData.get("locale") as string | null);

    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        return { error: error.message };
    }

    // Redirect on success
    redirect(`/${locale}/dashboard`);
}

export async function signOut(localeInput?: string) {
    const locale = normalizeAuthLocale(localeInput);
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect(`/${locale}/login`);
}
