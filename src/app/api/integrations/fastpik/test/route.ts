import { NextRequest, NextResponse } from "next/server";
import { apiText } from "@/lib/i18n/api-errors";
import { createClient } from "@/utils/supabase/server";
import { testFastpikIntegrationConnection } from "@/lib/fastpik-integration/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: apiText(request, "unauthorized") },
        { status: 401 },
      );
    }

    const result = await testFastpikIntegrationConnection(supabase, user.id);
    return NextResponse.json({
      success: result.success,
      status: result.status,
      message: result.message,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        status: "failed",
        message:
          error instanceof Error
            ? error.message
            : apiText(request, "failedFastpikConnectionTest"),
      },
      { status: 500 },
    );
  }
}
