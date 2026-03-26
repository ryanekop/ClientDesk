"use client";

import * as React from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppCheckbox } from "@/components/ui/app-checkbox";
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
  const persistInBrowserId = "persist-changelog-in-browser";
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
      <DialogContent className="top-[calc(var(--global-announcement-height,0px)+env(safe-area-inset-top,0px)+0.5rem)] w-[calc(100vw-1rem)] max-w-[min(780px,calc(100vw-1rem))] max-h-[calc(100dvh-var(--global-announcement-height,0px)-env(safe-area-inset-top,0px)-1rem)] translate-y-0 overflow-hidden border-0 bg-transparent p-0 shadow-none sm:top-[50%] sm:max-h-[85vh] sm:translate-y-[-50%] [&>button]:right-3 [&>button]:top-3 [&>button]:rounded-full [&>button]:bg-background [&>button]:p-2 [&>button]:opacity-100 [&>button]:shadow-sm sm:[&>button]:right-5 sm:[&>button]:top-5">
        <div className="flex max-h-full flex-col rounded-[1.5rem] border border-border/70 bg-background/95 p-3 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur sm:rounded-[1.75rem] sm:p-5">
          <DialogHeader className="px-1 pb-3 pt-1 text-left sm:px-2 sm:pb-4 sm:pt-2">
            <div className="flex items-center gap-3 text-primary">
              <BellRing className="h-5 w-5" />
              <DialogTitle>
                {locale === "en" ? "What’s new in Client Desk" : "Log perubahan terbaru"}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <ChangelogReleaseCard
              release={latestRelease}
              locale={locale}
              isLatest
              compact
            />
          </div>

          <div className="mt-3 flex flex-col gap-3 border-t border-border/70 px-1 pt-3 sm:mt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-2 sm:pt-4">
            <div className="flex items-start gap-3 text-xs text-muted-foreground sm:text-sm">
              <AppCheckbox
                id={persistInBrowserId}
                checked={persistInBrowser}
                onCheckedChange={(checked) => setPersistInBrowser(checked === true)}
                className="mt-0.5"
              />
              <label htmlFor={persistInBrowserId} className="cursor-pointer text-left">
                {locale === "en"
                  ? "Don’t show this popup again for this version."
                  : "Jangan tampilkan lagi popup ini untuk versi ini."}
              </label>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
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
