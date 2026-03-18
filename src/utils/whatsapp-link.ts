export type OpenWhatsAppUrlOptions = {
  preOpenedWindow?: Window | null;
};

function sanitizeWhatsAppPhone(phone: string) {
  return phone.replace(/^0/, "62").replace(/[^0-9]/g, "");
}

function isMobileDevice() {
  if (typeof window === "undefined") return false;

  const ua = window.navigator.userAgent || "";
  if (/Android|iPhone|iPad|iPod|IEMobile|Opera Mini|webOS|BlackBerry/i.test(ua)) {
    return true;
  }

  // iPadOS may report as Mac; touch points disambiguate tablets.
  return window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
}

export function buildWhatsAppUrl(phone: string, message?: string) {
  const normalizedPhone = sanitizeWhatsAppPhone(phone);
  const phoneQuery = `phone=${encodeURIComponent(normalizedPhone)}`;
  if (message == null) {
    return `https://api.whatsapp.com/send?${phoneQuery}`;
  }
  return `https://api.whatsapp.com/send?${phoneQuery}&text=${encodeURIComponent(message)}`;
}

export function preopenWindowForDeferredNavigation() {
  if (typeof window === "undefined") return null;
  // Avoid `noopener,noreferrer` at pre-open time because some browsers may still
  // open the tab but return `null`, which can cause a second tab to open later.
  const preOpenedWindow = window.open("about:blank", "_blank");
  if (preOpenedWindow) {
    try {
      preOpenedWindow.opener = null;
    } catch {
      // Ignore cross-origin/opener assignment failures.
    }
  }
  return preOpenedWindow;
}

export function closePreopenedWindow(preOpenedWindow?: Window | null) {
  if (!preOpenedWindow || preOpenedWindow.closed) return;
  try {
    preOpenedWindow.close();
  } catch {
    // Ignore close failures.
  }
}

export function openWhatsAppUrl(
  url: string,
  { preOpenedWindow = null }: OpenWhatsAppUrlOptions = {},
) {
  if (typeof window === "undefined") return false;

  if (preOpenedWindow && !preOpenedWindow.closed) {
    try {
      preOpenedWindow.location.href = url;
      preOpenedWindow.focus?.();
      return true;
    } catch {
      closePreopenedWindow(preOpenedWindow);
    }
  }

  const popup = window.open(url, "_blank", "noopener,noreferrer");
  if (popup) {
    try {
      popup.opener = null;
    } catch {
      // Ignore cross-origin/opener assignment failures.
    }
    return true;
  }

  if (isMobileDevice()) {
    window.location.assign(url);
    return true;
  }

  return false;
}
