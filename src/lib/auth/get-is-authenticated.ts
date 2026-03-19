import { createClient } from "@/utils/supabase/server";

export async function getIsAuthenticated() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return Boolean(user);
}
