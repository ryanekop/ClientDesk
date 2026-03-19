export const CLIENTDESK_SESSION_ONLY_KEY = "clientdesk_session_only";
export const CLIENTDESK_SESSION_ONLY_USER_KEY = "clientdesk_session_only_user";
export const CLIENTDESK_SESSION_LOGIN_TIME_KEY = "clientdesk_session_login_time";
export const CLIENTDESK_SESSION_ONLY_TTL_MS = 2 * 60 * 60 * 1000;

function canUseBrowserStorage() {
  return typeof window !== "undefined";
}

export function clearClientDeskSessionOnlyState() {
  if (!canUseBrowserStorage()) return;

  window.sessionStorage.removeItem(CLIENTDESK_SESSION_ONLY_KEY);
  window.localStorage.removeItem(CLIENTDESK_SESSION_ONLY_USER_KEY);
  window.localStorage.removeItem(CLIENTDESK_SESSION_LOGIN_TIME_KEY);
}

export function applyClientDeskRememberMeSelection(rememberMe: boolean) {
  if (!canUseBrowserStorage()) return;

  if (rememberMe) {
    clearClientDeskSessionOnlyState();
    return;
  }

  window.sessionStorage.setItem(CLIENTDESK_SESSION_ONLY_KEY, "true");
  window.localStorage.setItem(
    CLIENTDESK_SESSION_LOGIN_TIME_KEY,
    Date.now().toString(),
  );
}

export function evaluateClientDeskSessionOnlyState(userId: string): {
  shouldSignOut: boolean;
  sessionOnlyActive: boolean;
} {
  if (!canUseBrowserStorage()) {
    return { shouldSignOut: false, sessionOnlyActive: false };
  }

  const sessionOnlyFlag =
    window.sessionStorage.getItem(CLIENTDESK_SESSION_ONLY_KEY) === "true";
  const trackedUserId = window.localStorage.getItem(
    CLIENTDESK_SESSION_ONLY_USER_KEY,
  );
  const loginTimeRaw = window.localStorage.getItem(
    CLIENTDESK_SESSION_LOGIN_TIME_KEY,
  );
  const loginTime = Number.parseInt(loginTimeRaw || "0", 10);
  const hasLoginTime = Number.isFinite(loginTime) && loginTime > 0;
  const isExpired =
    hasLoginTime && Date.now() - loginTime > CLIENTDESK_SESSION_ONLY_TTL_MS;

  if (trackedUserId === userId && (!sessionOnlyFlag || isExpired)) {
    return { shouldSignOut: true, sessionOnlyActive: true };
  }

  if (sessionOnlyFlag) {
    window.localStorage.setItem(CLIENTDESK_SESSION_ONLY_USER_KEY, userId);
    if (!hasLoginTime) {
      window.localStorage.setItem(
        CLIENTDESK_SESSION_LOGIN_TIME_KEY,
        Date.now().toString(),
      );
    }
    return { shouldSignOut: false, sessionOnlyActive: true };
  }

  if (trackedUserId === userId) {
    window.localStorage.removeItem(CLIENTDESK_SESSION_ONLY_USER_KEY);
    window.localStorage.removeItem(CLIENTDESK_SESSION_LOGIN_TIME_KEY);
  }

  return { shouldSignOut: false, sessionOnlyActive: false };
}
