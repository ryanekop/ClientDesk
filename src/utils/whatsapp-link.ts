export type OpenWhatsAppUrlOptions = {
  preOpenedWindow?: Window | null;
  fallbackToSameTab?: boolean;
};

function sanitizeWhatsAppPhone(phone: string) {
  return phone.replace(/^0/, "62").replace(/[^0-9]/g, "");
}

export function buildWhatsAppUrl(phone: string, message?: string) {
  const params = new URLSearchParams({ phone: sanitizeWhatsAppPhone(phone) });
  if (message != null) {
    params.set("text", message);
  }
  return `https://api.whatsapp.com/send?${params.toString()}`;
}

export function preopenWindowForDeferredNavigation() {
  if (typeof window === "undefined") return null;
  const preOpenedWindow = window.open("about:blank", "_blank", "noopener,noreferrer");
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
  { preOpenedWindow = null, fallbackToSameTab = true }: OpenWhatsAppUrlOptions = {},
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

  if (fallbackToSameTab) {
    window.location.assign(url);
    return true;
  }

  return false;
}
