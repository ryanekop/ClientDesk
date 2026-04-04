export const CLIENTDESK_SESSION_ONLY_KEY = "clientdesk_session_only";
export const CLIENTDESK_SESSION_ONLY_MODE_KEY = "clientdesk_session_only_mode";
export const CLIENTDESK_SESSION_ONLY_USER_KEY = "clientdesk_session_only_user";
export const CLIENTDESK_SESSION_LOGIN_TIME_KEY = "clientdesk_session_login_time";
export const CLIENTDESK_SESSION_ONLY_TTL_MS = 2 * 60 * 60 * 1000;

function canUseBrowserStorage() {
  return typeof window !== "undefined";
}

function getSafeSessionStorage() {
  if (!canUseBrowserStorage()) return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getSafeLocalStorage() {
  if (!canUseBrowserStorage()) return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function clearClientDeskSessionOnlyState() {
  const sessionStorage = getSafeSessionStorage();
  const localStorage = getSafeLocalStorage();
  sessionStorage?.removeItem(CLIENTDESK_SESSION_ONLY_KEY);
  localStorage?.removeItem(CLIENTDESK_SESSION_ONLY_MODE_KEY);
  localStorage?.removeItem(CLIENTDESK_SESSION_ONLY_USER_KEY);
  localStorage?.removeItem(CLIENTDESK_SESSION_LOGIN_TIME_KEY);
}

export function applyClientDeskRememberMeSelection(rememberMe: boolean) {
  const sessionStorage = getSafeSessionStorage();
  const localStorage = getSafeLocalStorage();
  if (!sessionStorage || !localStorage) return;

  if (rememberMe) {
    clearClientDeskSessionOnlyState();
    return;
  }

  localStorage.setItem(CLIENTDESK_SESSION_ONLY_MODE_KEY, "true");
  sessionStorage.setItem(CLIENTDESK_SESSION_ONLY_KEY, "true");
  localStorage.setItem(
    CLIENTDESK_SESSION_LOGIN_TIME_KEY,
    Date.now().toString(),
  );
}

export function evaluateClientDeskSessionOnlyState(userId: string): {
  shouldSignOut: boolean;
  sessionOnlyActive: boolean;
} {
  const sessionStorage = getSafeSessionStorage();
  const localStorage = getSafeLocalStorage();
  if (!sessionStorage || !localStorage) {
    return { shouldSignOut: false, sessionOnlyActive: false };
  }

  const sessionOnlyFlag =
    sessionStorage.getItem(CLIENTDESK_SESSION_ONLY_KEY) === "true";
  const sessionOnlyModeFlag =
    localStorage.getItem(CLIENTDESK_SESSION_ONLY_MODE_KEY) === "true";
  const trackedUserId = localStorage.getItem(
    CLIENTDESK_SESSION_ONLY_USER_KEY,
  );
  const loginTimeRaw = localStorage.getItem(
    CLIENTDESK_SESSION_LOGIN_TIME_KEY,
  );
  if (!sessionOnlyModeFlag) {
    if (sessionOnlyFlag) {
      sessionStorage.removeItem(CLIENTDESK_SESSION_ONLY_KEY);
    }
    localStorage.removeItem(CLIENTDESK_SESSION_ONLY_USER_KEY);
    localStorage.removeItem(CLIENTDESK_SESSION_LOGIN_TIME_KEY);
    return { shouldSignOut: false, sessionOnlyActive: false };
  }

  const now = Date.now();
  let loginTime = Number.parseInt(loginTimeRaw || "0", 10);
  let hasLoginTime = Number.isFinite(loginTime) && loginTime > 0;

  // Keep session-only active across tab changes by restoring the tab marker.
  if (!sessionOnlyFlag) {
    sessionStorage.setItem(CLIENTDESK_SESSION_ONLY_KEY, "true");
  }

  if (trackedUserId !== userId) {
    localStorage.setItem(CLIENTDESK_SESSION_ONLY_USER_KEY, userId);
    localStorage.setItem(CLIENTDESK_SESSION_LOGIN_TIME_KEY, now.toString());
    loginTime = now;
    hasLoginTime = true;
  } else if (!hasLoginTime) {
    localStorage.setItem(CLIENTDESK_SESSION_LOGIN_TIME_KEY, now.toString());
    loginTime = now;
    hasLoginTime = true;
  }

  const isExpired =
    hasLoginTime && now - loginTime > CLIENTDESK_SESSION_ONLY_TTL_MS;

  if (isExpired) {
    return { shouldSignOut: true, sessionOnlyActive: true };
  }

  return { shouldSignOut: false, sessionOnlyActive: true };
}
