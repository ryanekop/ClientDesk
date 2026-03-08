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

    // Get vendor info
    const { data: vendor } = await supabaseAdmin
        .from("profiles")
        .select("id, studio_name, whatsapp_number, min_dp_percent, avatar_url")
        .eq("vendor_slug", slug)
        .single();

    if (!vendor) {
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
            avatar_url: vendor.avatar_url,
        },
        services: services || [],
    });
}
