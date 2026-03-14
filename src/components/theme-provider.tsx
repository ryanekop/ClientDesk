"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ThemeProviderProps } from "next-themes";

export function ThemeProvider({
  children,
  forcedTheme,
  enableSystem,
  ...props
}: ThemeProviderProps) {
  const pathname = usePathname();

  const shouldForcePublicLight = React.useMemo(() => {
    if (!pathname) return false;
    const normalized = pathname.toLowerCase();
    return normalized.includes("/formbooking/") || normalized.includes("/settlement/");
  }, [pathname]);

  const resolvedForcedTheme = forcedTheme ?? (shouldForcePublicLight ? "light" : undefined);
  const resolvedEnableSystem = shouldForcePublicLight ? false : enableSystem;

  return (
    <NextThemesProvider
      {...props}
      forcedTheme={resolvedForcedTheme}
      enableSystem={resolvedEnableSystem}
    >
      {children}
    </NextThemesProvider>
  );
}
