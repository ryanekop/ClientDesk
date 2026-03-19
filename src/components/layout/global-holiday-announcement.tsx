"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

const HOLIDAY_ANNOUNCEMENT_TEXT =
  "Admin sedang libur lebaran dulu ygy mulai tanggal 20-27 Maret. Segala konsultasi dan masalah akan dijawab slow respon di DM Instagram. Admin tidak akan mengupdate website (fitur & bug fixing) selama periode itu. ✨🌙 Taqabbalallahu Minna wa minkum. Minal Aidzin Wal Faidzin, Mohon maaf lahir dan batin 🌙✨";

const EXCLUDED_PATTERNS = [
  /^\/(?:id|en)\/formbooking(?:\/|$)/i,
  /^\/(?:id|en)\/track(?:\/|$)/i,
  /^\/(?:id|en)\/settlement(?:\/|$)/i,
];

function shouldHideAnnouncement(pathname: string): boolean {
  return EXCLUDED_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function GlobalHolidayAnnouncement() {
  const pathname = usePathname();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = React.useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  const isVisible = React.useMemo(() => {
    if (!pathname) return true;
    return !shouldHideAnnouncement(pathname.toLowerCase());
  }, [pathname]);

  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      "--global-announcement-height",
      isVisible ? "40px" : "0px",
    );

    return () => {
      root.style.setProperty("--global-announcement-height", "0px");
    };
  }, [isVisible]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(media.matches);
    updatePreference();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", updatePreference);
      return () => media.removeEventListener("change", updatePreference);
    }

    media.addListener(updatePreference);
    return () => media.removeListener(updatePreference);
  }, []);

  React.useEffect(() => {
    if (!isVisible) {
      setIsOverflowing(false);
      return;
    }

    const container = containerRef.current;
    const measureText = measureRef.current;
    if (!container || !measureText) return;

    const checkOverflow = () => {
      setIsOverflowing(measureText.scrollWidth > container.clientWidth + 1);
    };

    checkOverflow();

    const observer = new ResizeObserver(() => checkOverflow());
    observer.observe(container);
    observer.observe(measureText);
    window.addEventListener("resize", checkOverflow);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", checkOverflow);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  const shouldAnimate = isOverflowing && !prefersReducedMotion;

  return (
    <div className="sticky top-0 z-[60] h-10 border-b border-emerald-700 bg-emerald-600 text-emerald-50 shadow-sm">
      <div
        ref={containerRef}
        className="relative flex h-full items-center overflow-hidden px-3 sm:px-4"
      >
        <span
          ref={measureRef}
          className="pointer-events-none absolute -z-10 whitespace-nowrap opacity-0"
          aria-hidden="true"
        >
          {HOLIDAY_ANNOUNCEMENT_TEXT}
        </span>

        {shouldAnimate ? (
          <div className="announcement-marquee-track text-sm font-medium">
            <span className="announcement-marquee-item">
              {HOLIDAY_ANNOUNCEMENT_TEXT}
            </span>
            <span className="announcement-marquee-item" aria-hidden="true">
              {HOLIDAY_ANNOUNCEMENT_TEXT}
            </span>
          </div>
        ) : (
          <p className="w-full truncate text-center text-sm font-medium">
            {HOLIDAY_ANNOUNCEMENT_TEXT}
          </p>
        )}
      </div>
    </div>
  );
}
