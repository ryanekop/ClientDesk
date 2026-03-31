type SupabaseLike = {
  from: (table: string) => {
    update: (patch: Record<string, unknown>) => {
      eq: (column: string, value: string) => unknown;
    };
  };
};

async function clearGoogleConnection(
  supabase: SupabaseLike,
  userId: string,
  patch: Record<string, unknown>,
) {
  try {
    await supabase.from("profiles").update(patch).eq("id", userId);
  } catch {
    // Best effort token cleanup.
  }
}

export async function clearGoogleCalendarConnection(
  supabase: SupabaseLike,
  userId: string,
) {
  await clearGoogleConnection(supabase, userId, {
    google_access_token: null,
    google_refresh_token: null,
    google_token_expiry: null,
  });
}

export async function clearGoogleDriveConnection(
  supabase: SupabaseLike,
  userId: string,
) {
  await clearGoogleConnection(supabase, userId, {
    google_drive_access_token: null,
    google_drive_refresh_token: null,
    google_drive_token_expiry: null,
  });
}
