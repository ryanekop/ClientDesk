"use client";

import * as React from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "@/i18n/routing";
import { ChangelogReleaseCard } from "@/components/changelog-list";
import { createClient } from "@/utils/supabase/client";
import {
  CHANGELOG_PREFERENCE_EVENT,
  type ChangelogEntry,
  groupChangelogEntries,
  isChangelogDismissed,
  saveChangelogPreference,
} from "@/lib/changelog";

export function DashboardChangelogPopup({
  entries,
  locale,
}: {
  entries: ChangelogEntry[];
  locale: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [persistInBrowser, setPersistInBrowser] = React.useState(false);
  const releases = React.useMemo(() => groupChangelogEntries(entries), [entries]);
  const latestRelease = releases[0];
  const latestVersion = latestRelease?.version;

  React.useEffect(() => {
    if (!latestVersion) {
      return;
    }

    if (!isChangelogDismissed(latestVersion)) {
      setOpen(true);
    }
  }, [latestVersion]);

  const closePopup = React.useCallback(() => {
    if (!latestVersion) {
      setOpen(false);
      return;
    }

    saveChangelogPreference(latestVersion, persistInBrowser);
    setOpen(false);
  }, [latestVersion, persistInBrowser]);

  if (!latestRelease) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closePopup();
          return;
        }

        setOpen(nextOpen);
      }}
    >
      <DialogContent className="max-w-[min(780px,calc(100vw-1.5rem))] border-0 bg-transparent p-0 shadow-none sm:max-h-[85vh] [&>button]:right-5 [&>button]:top-5 [&>button]:rounded-full [&>button]:bg-background [&>button]:p-2 [&>button]:opacity-100 [&>button]:shadow-sm">
        <div className="rounded-[1.75rem] border border-border/70 bg-background/95 p-4 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur sm:p-5">
          <DialogHeader className="px-2 pb-4 pt-2 text-left">
            <div className="flex items-center gap-3 text-primary">
              <BellRing className="h-5 w-5" />
              <DialogTitle>
                {locale === "en" ? "What’s new in Client Desk" : "Log perubahan terbaru"}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="max-h-[58vh] overflow-y-auto pr-1">
            <ChangelogReleaseCard
              release={latestRelease}
              locale={locale}
              isLatest
              compact
            />
          </div>

          <div className="mt-4 flex flex-col gap-4 border-t border-border/70 px-2 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <button
                type="button"
                role="checkbox"
                aria-checked={persistInBrowser}
                data-state={persistInBrowser ? "checked" : "unchecked"}
                onClick={() => setPersistInBrowser((current) => !current)}
                className="peer mt-0.5 size-4 shrink-0 rounded-[4px] border border-input shadow-xs outline-none transition-shadow dark:bg-input/30 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {persistInBrowser && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="grid place-content-center text-current"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={() => setPersistInBrowser((current) => !current)}
                className="text-left"
              >
                {locale === "en"
                  ? "Don’t show this popup again for this version."
                  : "Jangan tampilkan lagi popup ini untuk versi ini."}
              </button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" asChild>
                <Link
                  href="/changelog"
                  onClick={() => {
                    closePopup();
                  }}
                >
                  {locale === "en" ? "View full log" : "Lihat log lengkap"}
                </Link>
              </Button>
              <Button onClick={closePopup}>
                {locale === "en" ? "Close" : "Tutup"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook to check if there are unread changelog entries.
 * Returns { hasUnread, checkUnread }
 */
export function useChangelogUnread() {
  const [hasUnread, setHasUnread] = React.useState(false);
  const supabase = React.useMemo(() => createClient(), []);

  const checkUnread = React.useCallback(async () => {
    try {
      const { data } = await supabase
        .from("changelog")
        .select("version")
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data?.version) {
        setHasUnread(false);
        return;
      }

      setHasUnread(!isChangelogDismissed(data.version));
    } catch {
      setHasUnread(false);
    }
  }, [supabase]);

  React.useEffect(() => {
    checkUnread();

    const syncState = () => {
      checkUnread();
    };

    window.addEventListener("storage", syncState);
    window.addEventListener(CHANGELOG_PREFERENCE_EVENT, syncState);

    return () => {
      window.removeEventListener("storage", syncState);
      window.removeEventListener(CHANGELOG_PREFERENCE_EVENT, syncState);
    };
  }, [checkUnread]);

  return { hasUnread, checkUnread };
}
