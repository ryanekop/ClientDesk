import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { testFastpikIntegrationConnection } from "@/lib/fastpik-integration/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Tidak terautentikasi." },
        { status: 401 },
      );
    }

    const result = await testFastpikIntegrationConnection(supabase, user.id);
    return NextResponse.json({
      success: result.success,
      status: result.status,
      message: result.message,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        status: "failed",
        message: error?.message || "Gagal menguji koneksi Fastpik.",
      },
      { status: 500 },
    );
  }
}
