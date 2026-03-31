import { NextRequest, NextResponse } from "next/server";
import { getDriveAuthUrl } from "@/utils/google/drive";
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
        service: "drive",
        origin: request.nextUrl.origin,
        returnPath,
      })
    : null;

  const url = getDriveAuthUrl({ state });
  return NextResponse.redirect(url);
}
