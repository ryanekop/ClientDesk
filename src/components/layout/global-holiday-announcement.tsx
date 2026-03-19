"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

type AnnouncementSegment = {
  text: string;
  bold?: boolean;
};

const ANNOUNCEMENT_SEGMENTS: AnnouncementSegment[] = [
  { text: "Admin sedang libur lebaran dulu ygy mulai tanggal " },
  { text: "20-27 Maret", bold: true },
  {
    text: ". Segala konsultasi dan masalah akan dijawab slow respon di DM Instagram. Admin tidak akan mengupdate website (fitur & bug fixing) selama periode itu. ",
  },
  {
    text: "✨🌙 Taqabbalallahu Minna wa minkum. Minal Aidzin Wal Faidzin, Mohon maaf lahir dan batin 🌙✨",
    bold: true,
  },
];

const HOLIDAY_ANNOUNCEMENT_TEXT = ANNOUNCEMENT_SEGMENTS.map((segment) => segment.text).join("");

const MARQUEE_ITEM_GAP_PX = 40;
const MARQUEE_SPEED_PX_PER_SECOND = 44;

const EXCLUDED_PATTERNS = [
  /^\/(?:id|en)\/formbooking(?:\/|$)/i,
  /^\/(?:id|en)\/track(?:\/|$)/i,
  /^\/(?:id|en)\/settlement(?:\/|$)/i,
];

function shouldHideAnnouncement(pathname: string): boolean {
  return EXCLUDED_PATTERNS.some((pattern) => pattern.test(pathname));
}

function renderAnnouncementMessage(keyPrefix: string) {
  return ANNOUNCEMENT_SEGMENTS.map((segment, index) => {
    if (segment.bold) {
      return (
        <strong key={`${keyPrefix}-segment-${index}`} className="font-bold">
          {segment.text}
        </strong>
      );
    }

    return (
      <React.Fragment key={`${keyPrefix}-segment-${index}`}>
        {segment.text}
      </React.Fragment>
    );
  });
}

export function GlobalHolidayAnnouncement() {
  const pathname = usePathname();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLSpanElement>(null);
  const firstMarqueeItemRef = React.useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = React.useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);
  const [marqueeDistancePx, setMarqueeDistancePx] = React.useState(1200);
  const [marqueeDurationSec, setMarqueeDurationSec] = React.useState(30);

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

  const shouldAnimate = isOverflowing && !prefersReducedMotion;

  const marqueeStyle = React.useMemo(
    () =>
      ({
        "--announcement-marquee-distance": `${marqueeDistancePx}px`,
        "--announcement-marquee-duration": `${marqueeDurationSec}s`,
      }) as React.CSSProperties,
    [marqueeDistancePx, marqueeDurationSec],
  );

  React.useEffect(() => {
    if (!isVisible) {
      setIsOverflowing(false);
      return;
    }

    const container = containerRef.current;
    const measureText = measureRef.current;
    if (!container || !measureText) return;

    const updateMeasurements = () => {
      const nextOverflow = measureText.scrollWidth > container.clientWidth + 1;
      setIsOverflowing((prev) => (prev === nextOverflow ? prev : nextOverflow));

      const measuredItemWidth = firstMarqueeItemRef.current?.offsetWidth ?? 0;
      const fallbackDistance = measureText.scrollWidth + MARQUEE_ITEM_GAP_PX;
      const nextDistance = Math.max(measuredItemWidth || fallbackDistance, 1);
      const rawDuration = nextDistance / MARQUEE_SPEED_PX_PER_SECOND;
      const nextDuration = Math.min(42, Math.max(24, rawDuration));

      setMarqueeDistancePx((prev) =>
        Math.abs(prev - nextDistance) < 0.5 ? prev : nextDistance,
      );
      setMarqueeDurationSec((prev) =>
        Math.abs(prev - nextDuration) < 0.05 ? prev : nextDuration,
      );
    };

    updateMeasurements();

    const observer = new ResizeObserver(() => updateMeasurements());
    observer.observe(container);
    observer.observe(measureText);
    if (firstMarqueeItemRef.current) {
      observer.observe(firstMarqueeItemRef.current);
    }
    window.addEventListener("resize", updateMeasurements);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateMeasurements);
    };
  }, [isVisible, shouldAnimate]);

  if (!isVisible) return null;

  return (
    <div className="sticky top-0 z-[60] h-10 border-b border-emerald-700 bg-emerald-600 text-emerald-50 shadow-sm">
      <div
        ref={containerRef}
        className="relative flex h-full items-center overflow-hidden px-3 sm:px-4"
      >
        <span
          ref={measureRef}
          className="pointer-events-none absolute -z-10 whitespace-nowrap text-sm font-medium opacity-0"
          aria-hidden="true"
        >
          {renderAnnouncementMessage("measure")}
        </span>

        {shouldAnimate ? (
          <div
            className="announcement-marquee-track text-sm font-medium"
            style={marqueeStyle}
          >
            <span ref={firstMarqueeItemRef} className="announcement-marquee-item">
              {renderAnnouncementMessage("marquee-primary")}
            </span>
            <span className="announcement-marquee-item" aria-hidden="true">
              {renderAnnouncementMessage("marquee-duplicate")}
            </span>
          </div>
        ) : (
          <p className="w-full truncate whitespace-nowrap text-center text-sm font-medium">
            {renderAnnouncementMessage("static")}
          </p>
        )}
      </div>
    </div>
  );
}
