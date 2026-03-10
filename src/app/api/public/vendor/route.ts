import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
    const slug = request.nextUrl.searchParams.get("slug");
    if (!slug) {
        return NextResponse.json({ success: false, error: "slug required" }, { status: 400 });
    }

    // Get vendor info — use select("*") so it doesn't fail if form customization columns don't exist yet
    const { data: vendor, error } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("vendor_slug", slug)
        .single();

    if (!vendor || error) {
        return NextResponse.json({ success: false, error: "Vendor not found" }, { status: 404 });
    }

    // Get vendor's services
    const { data: services } = await supabaseAdmin
        .from("services")
        .select("id, name, price, description")
        .eq("user_id", vendor.id)
        .order("name");

    return NextResponse.json({
        success: true,
        vendor: {
            studio_name: vendor.studio_name,
            whatsapp_number: vendor.whatsapp_number,
            min_dp_percent: vendor.min_dp_percent,
            min_dp_map: vendor.min_dp_map || {},
            avatar_url: vendor.avatar_url,
            form_brand_color: vendor.form_brand_color || '#000000',
            form_greeting: vendor.form_greeting || null,
            form_event_types: vendor.form_event_types || null,
            form_show_location: vendor.form_show_location ?? true,
            form_show_notes: vendor.form_show_notes ?? true,
            form_show_proof: vendor.form_show_proof ?? true,
            bank_accounts: vendor.bank_accounts || [],
        },
        services: services || [],
    });
}
