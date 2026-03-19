import { createClient as createSupabaseClient } from "@supabase/supabase-js";

let implicitBrowserClient: ReturnType<typeof createSupabaseClient> | null = null;

export function createImplicitClient() {
  if (!implicitBrowserClient) {
    implicitBrowserClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { flowType: "implicit" } },
    );
  }

  return implicitBrowserClient;
}
