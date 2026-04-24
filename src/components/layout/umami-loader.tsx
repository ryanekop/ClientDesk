"use client";

import * as React from "react";

const UMAMI_SCRIPT_URL = "https://umami.ryanekoapp.web.id/script.js";
const UMAMI_RECORDER_URL = "https://umami.ryanekoapp.web.id/recorder.js";
const UMAMI_WEBSITE_ID = "50dbf632-4580-45e9-a67e-a651da1e4d42";

declare global {
  interface Window {
    __clientDeskUmamiLoaded?: boolean;
    __clientDeskUmamiRecorderLoaded?: boolean;
  }
}

function injectScript(
  src: string,
  loadedKey: "__clientDeskUmamiLoaded" | "__clientDeskUmamiRecorderLoaded",
  attributes: Record<string, string> = {},
) {
  if (typeof window === "undefined") return;
  if (window[loadedKey]) return;

  const existingScript = document.querySelector<HTMLScriptElement>(
    `script[src="${src}"]`,
  );
  if (existingScript) {
    window[loadedKey] = true;
    return;
  }

  const script = document.createElement("script");
  script.src = src;
  script.async = true;
  script.defer = true;
  script.setAttribute("data-website-id", UMAMI_WEBSITE_ID);
  Object.entries(attributes).forEach(([key, value]) => {
    script.setAttribute(key, value);
  });
  script.addEventListener("load", () => {
    window[loadedKey] = true;
  });
  script.addEventListener("error", () => {
    console.warn(`[analytics] Umami script failed to load: ${src}`);
  });

  document.head.appendChild(script);
}

function injectUmamiScripts() {
  injectScript(UMAMI_SCRIPT_URL, "__clientDeskUmamiLoaded");
  injectScript(UMAMI_RECORDER_URL, "__clientDeskUmamiRecorderLoaded", {
    "data-sample-rate": "0.15",
    "data-mask-level": "moderate",
    "data-max-duration": "300000",
  });
}

export function UmamiLoader() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    const run = () => {
      try {
        injectUmamiScripts();
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
