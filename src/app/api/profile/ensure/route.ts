import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { apiText } from "@/lib/i18n/api-errors";
import { createClient } from "@/utils/supabase/server";

const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json(
            { success: false, error: apiText(request, "unauthorized") },
            { status: 401 },
        );
    }

    const fullName = String(user.user_metadata?.full_name || user.email?.split("@")[0] || "User");
    const { error } = await supabaseAdmin.from("profiles").upsert(
        {
            id: user.id,
            full_name: fullName,
        },
        { onConflict: "id" },
    );

    if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
