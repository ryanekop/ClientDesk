import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthEmailBlocklistRow = {
  id: string;
  email: string;
  reason: string | null;
  is_active: boolean;
  suspended_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export function normalizeBlocklistEmail(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

export function isValidBlocklistEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function findAuthUserByNormalizedEmail(
  supabase: SupabaseClient,
  normalizedEmail: string,
) {
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw error;
    }

    const users = data?.users || [];
    const existingUser = users.find(
      (user) => user.email?.trim().toLowerCase() === normalizedEmail,
    );
    if (existingUser) {
      return existingUser;
    }

    if (users.length < 1000) {
      return null;
    }

    page += 1;
  }
}

export async function findActiveBlockForEmail(
  supabase: SupabaseClient,
  email: string,
) {
  const normalizedEmail = normalizeBlocklistEmail(email);
  if (!normalizedEmail) return null;

  const { data, error } = await supabase
    .from("auth_email_blocklist")
    .select("id, email, reason, is_active, suspended_user_id, created_at, updated_at")
    .eq("email", normalizedEmail)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data || null) as AuthEmailBlocklistRow | null;
}

export async function findActiveBlockForUser(
  supabase: SupabaseClient,
  args: { userId: string; email?: string | null },
) {
  const normalizedEmail = normalizeBlocklistEmail(args.email);
  const clauses = [`suspended_user_id.eq.${args.userId}`];
  if (normalizedEmail) {
    clauses.push(`email.eq.${normalizedEmail}`);
  }

  const { data, error } = await supabase
    .from("auth_email_blocklist")
    .select("id, email, reason, is_active, suspended_user_id, created_at, updated_at")
    .eq("is_active", true)
    .or(clauses.join(","))
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data || null) as AuthEmailBlocklistRow | null;
}
