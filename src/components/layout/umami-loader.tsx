"use client";

import * as React from "react";

const UMAMI_SCRIPT_URL = "https://cloud.umami.is/script.js";
const UMAMI_WEBSITE_ID = "50dbf632-4580-45e9-a67e-a651da1e4d42";

declare global {
  interface Window {
    __clientDeskUmamiLoaded?: boolean;
  }
}

function injectUmamiScript() {
  if (typeof window === "undefined") return;
  if (window.__clientDeskUmamiLoaded) return;

  const existingScript = document.querySelector<HTMLScriptElement>(
    `script[src="${UMAMI_SCRIPT_URL}"]`,
  );
  if (existingScript) {
    window.__clientDeskUmamiLoaded = true;
    return;
  }

  const script = document.createElement("script");
  script.src = UMAMI_SCRIPT_URL;
  script.async = true;
  script.defer = true;
  script.setAttribute("data-website-id", UMAMI_WEBSITE_ID);
  script.addEventListener("load", () => {
    window.__clientDeskUmamiLoaded = true;
  });
  script.addEventListener("error", () => {
    console.warn("[analytics] Umami script failed to load");
  });

  document.head.appendChild(script);
}

export function UmamiLoader() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    const run = () => {
      try {
        injectUmamiScript();
      } catch (error) {
        console.warn("[analytics] Umami bootstrap failed:", error);
      }
    };

    if (document.readyState === "complete") {
      run();
      return;
    }

    window.addEventListener("load", run, { once: true });
    return () => window.removeEventListener("load", run);
  }, []);

  return null;
}
