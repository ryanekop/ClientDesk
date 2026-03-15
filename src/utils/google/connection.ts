function hasNonEmptyToken(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasOAuthTokenPair(
  accessToken: unknown,
  refreshToken: unknown,
): boolean {
  return hasNonEmptyToken(accessToken) && hasNonEmptyToken(refreshToken);
}

export function isGoogleCalendarConnected(
  profile:
    | {
        google_access_token?: unknown;
        google_refresh_token?: unknown;
      }
    | null
    | undefined,
): boolean {
  return hasOAuthTokenPair(
    profile?.google_access_token,
    profile?.google_refresh_token,
  );
}

export function isGoogleDriveConnected(
  profile:
    | {
        google_drive_access_token?: unknown;
        google_drive_refresh_token?: unknown;
      }
    | null
    | undefined,
): boolean {
  return hasOAuthTokenPair(
    profile?.google_drive_access_token,
    profile?.google_drive_refresh_token,
  );
}
