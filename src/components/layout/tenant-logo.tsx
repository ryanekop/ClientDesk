"use client";

import * as React from "react";

type TenantLogoProps = {
  src?: string | null;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
};

const FALLBACK_LOGO_SRC = "/icon-192.png";

export function TenantLogo({
  src,
  alt,
  className,
  width = 32,
  height = 32,
}: TenantLogoProps) {
  const normalizedSrc = src && src.trim().length > 0 ? src : FALLBACK_LOGO_SRC;
  const [logoSrc, setLogoSrc] = React.useState(normalizedSrc);

  React.useEffect(() => {
    setLogoSrc(normalizedSrc);
  }, [normalizedSrc]);

  return (
    <img
      src={logoSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      onError={() => setLogoSrc(FALLBACK_LOGO_SRC)}
    />
  );
}
