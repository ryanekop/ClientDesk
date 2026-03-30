type SupabaseLike = {
  from: (table: string) => {
    update: (patch: Record<string, unknown>) => {
      eq: (column: string, value: string) => unknown;
    };
  };
};

export async function clearGoogleCalendarConnection(
  supabase: SupabaseLike,
  userId: string,
) {
  try {
    await supabase
      .from("profiles")
      .update({
        google_access_token: null,
        google_refresh_token: null,
        google_token_expiry: null,
      })
      .eq("id", userId);
  } catch {
    // Best effort token cleanup.
  }
}
