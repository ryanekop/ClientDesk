import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/utils/google/calendar";
import { createClient } from "@/utils/supabase/server";
import {
  createSignedGoogleOAuthState,
  sanitizeGoogleOAuthReturnPath,
} from "@/lib/google-oauth-state";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const returnPath = sanitizeGoogleOAuthReturnPath(
    request.nextUrl.searchParams.get("returnPath"),
  );
  const state = user
    ? createSignedGoogleOAuthState({
        userId: user.id,
        service: "calendar",
        origin: request.nextUrl.origin,
        returnPath,
      })
    : null;

  const url = getAuthUrl({ state });
  return NextResponse.redirect(url);
}
