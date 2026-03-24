import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";

export async function requireRouteUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      errorResponse: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      ),
      supabase,
      user: null,
    };
  }

  return {
    errorResponse: null,
    supabase,
    user,
  };
}

