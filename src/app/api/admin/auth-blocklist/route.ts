import { NextRequest, NextResponse } from "next/server";
import {
  findAuthUserByNormalizedEmail,
  isValidBlocklistEmail,
  normalizeBlocklistEmail,
  type AuthEmailBlocklistRow,
} from "@/lib/auth/email-blocklist";
import { createServiceClient } from "@/lib/supabase/service";
import { buildAdminCorsHeaders, isAdminCorsOriginAllowed } from "@/lib/security/admin-cors";

const ADMIN_CORS_METHODS = "GET, POST, PUT, DELETE, OPTIONS";

function corsResponse(
  request: NextRequest,
  data: unknown,
  init?: { status?: number },
) {
  return NextResponse.json(data, {
    ...init,
    headers: buildAdminCorsHeaders(request, ADMIN_CORS_METHODS),
  });
}

function verifyAdmin(request: NextRequest) {
  const apiKey = request.headers.get("x-admin-api-key");
  const isValid = Boolean(apiKey && apiKey === process.env.ADMIN_API_KEY);
  if (!isValid) {
    const ip = request.headers.get("cf-connecting-ip")
      || request.headers.get("x-forwarded-for")
      || request.headers.get("x-real-ip")
      || "unknown";
    console.warn(`[Admin API] Unauthorized access attempt on ${request.nextUrl.pathname} from ${ip}`);
  }
  return isValid;
}

async function resolveSuspendedUserId(email: string) {
  const supabase = createServiceClient();
  const user = await findAuthUserByNormalizedEmail(supabase, email);
  return user?.id || null;
}

export async function OPTIONS(request: NextRequest) {
  if (!isAdminCorsOriginAllowed(request)) {
    return NextResponse.json(
      { error: "Origin not allowed" },
      { status: 403, headers: buildAdminCorsHeaders(request, ADMIN_CORS_METHODS) },
    );
  }

  return new NextResponse(null, {
    status: 204,
    headers: buildAdminCorsHeaders(request, ADMIN_CORS_METHODS),
  });
}

export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return corsResponse(request, { error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const search = normalizeBlocklistEmail(request.nextUrl.searchParams.get("search"));

    let query = supabase
      .from("auth_email_blocklist")
      .select("id, email, reason, is_active, suspended_user_id, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (search) {
      query = query.ilike("email", `%${search}%`);
    }

    const { data, error } = await query;
    if (error) {
      return corsResponse(request, { error: error.message }, { status: 500 });
    }

    return corsResponse(request, {
      success: true,
      blocklist: (data || []) as AuthEmailBlocklistRow[],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list blocklist";
    return corsResponse(request, { error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return corsResponse(request, { error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({})) as {
      email?: string;
      reason?: string;
    };
    const email = normalizeBlocklistEmail(body.email);
    const reason = typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim()
      : null;

    if (!email) {
      return corsResponse(request, { error: "Email is required" }, { status: 400 });
    }
    if (!isValidBlocklistEmail(email)) {
      return corsResponse(request, { error: "Invalid email format" }, { status: 400 });
    }

    const suspendedUserId = await resolveSuspendedUserId(email);
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("auth_email_blocklist")
      .upsert({
        email,
        reason,
        is_active: true,
        suspended_user_id: suspendedUserId,
      }, { onConflict: "email" })
      .select("id, email, reason, is_active, suspended_user_id, created_at, updated_at")
      .single();

    if (error) {
      return corsResponse(request, { error: error.message }, { status: 500 });
    }

    return corsResponse(request, {
      success: true,
      block: data as AuthEmailBlocklistRow,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add blocklist entry";
    return corsResponse(request, { error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return corsResponse(request, { error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({})) as {
      id?: string;
      email?: string;
      reason?: string | null;
      is_active?: boolean;
    };
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const email = normalizeBlocklistEmail(body.email);

    if (!id && !email) {
      return corsResponse(request, { error: "id or email is required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const updates: Record<string, string | boolean | null> = {};

    if (typeof body.reason === "string") {
      updates.reason = body.reason.trim() || null;
    } else if (body.reason === null) {
      updates.reason = null;
    }

    if (typeof body.is_active === "boolean") {
      updates.is_active = body.is_active;
      if (body.is_active) {
        const emailForLookup = email || await (async () => {
          const { data, error } = await supabase
            .from("auth_email_blocklist")
            .select("email")
            .eq("id", id)
            .maybeSingle();
          if (error) throw error;
          return normalizeBlocklistEmail(data?.email);
        })();
        updates.suspended_user_id = emailForLookup
          ? await resolveSuspendedUserId(emailForLookup)
          : null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return corsResponse(request, { error: "No updates provided" }, { status: 400 });
    }

    let query = supabase
      .from("auth_email_blocklist")
      .update(updates)
      .select("id, email, reason, is_active, suspended_user_id, created_at, updated_at");

    query = id ? query.eq("id", id) : query.eq("email", email);

    const { data, error } = await query.single();
    if (error) {
      return corsResponse(request, { error: error.message }, { status: 500 });
    }

    return corsResponse(request, {
      success: true,
      block: data as AuthEmailBlocklistRow,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update blocklist entry";
    return corsResponse(request, { error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return corsResponse(request, { error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({})) as {
      id?: string;
      email?: string;
    };
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const email = normalizeBlocklistEmail(body.email);

    if (!id && !email) {
      return corsResponse(request, { error: "id or email is required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    let query = supabase.from("auth_email_blocklist").delete();
    query = id ? query.eq("id", id) : query.eq("email", email);

    const { error } = await query;
    if (error) {
      return corsResponse(request, { error: error.message }, { status: 500 });
    }

    return corsResponse(request, { success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete blocklist entry";
    return corsResponse(request, { error: message }, { status: 500 });
  }
}
