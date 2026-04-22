"use client";

import * as React from "react";
import {
  ArrowRight,
  Globe,
  PanelsTopLeft,
  RefreshCcw,
  Star,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AppCheckbox } from "@/components/ui/app-checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DISMISS_KEY = "clientdesk_studio_plan_promo_dismissed";
const KANBAN_VIDEO_URL = "https://www.youtube.com/watch?v=aBiabxOg9Zo";
const FEATURE_KEYS = [
  "featureKanban",
  "featureMidtrans",
  "featureSpreadsheet",
  "featureMiniWebsite",
  "featureReview",
] as const;
const FEATURE_ICONS = [
  PanelsTopLeft,
  Wallet,
  RefreshCcw,
  Globe,
  Star,
] as const;

export function StudioPlanPromo() {
  const t = useTranslations("StudioPlanPromo");
  const [open, setOpen] = React.useState(false);
  const [dontShowAgain, setDontShowAgain] = React.useState(false);

  React.useEffect(() => {
    const dismissed = window.localStorage.getItem(DISMISS_KEY);
    if (dismissed === "true") return;

    const timer = window.setTimeout(() => setOpen(true), 500);
    return () => window.clearTimeout(timer);
  }, []);

  const persistDismissPreference = React.useCallback((shouldPersist: boolean) => {
    if (!shouldPersist) return;
    window.localStorage.setItem(DISMISS_KEY, "true");
  }, []);

  const closePopup = React.useCallback(() => {
    persistDismissPreference(dontShowAgain);
    setOpen(false);
  }, [dontShowAgain, persistDismissPreference]);

  const openVideo = React.useCallback(() => {
    persistDismissPreference(dontShowAgain);
    setOpen(false);
    window.open(KANBAN_VIDEO_URL, "_blank", "noopener,noreferrer");
  }, [dontShowAgain, persistDismissPreference]);

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
      <DialogContent className="top-[calc(var(--global-announcement-height,0px)+env(safe-area-inset-top,0px)+0.5rem)] flex h-[calc(100dvh-var(--global-announcement-height,0px)-env(safe-area-inset-top,0px)-1rem)] max-h-[calc(100dvh-var(--global-announcement-height,0px)-env(safe-area-inset-top,0px)-1rem)] flex-col gap-0 translate-y-0 overflow-hidden p-4 sm:top-[50%] sm:h-auto sm:max-h-[85vh] sm:max-w-lg sm:translate-y-[-50%] sm:p-6 [&>button]:right-3 [&>button]:top-3 sm:[&>button]:right-4 sm:[&>button]:top-4">
        <div className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="shrink-0">
            <div className="mb-2 flex items-center justify-center sm:mb-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground shadow-lg sm:h-16 sm:w-16">
                <PanelsTopLeft className="h-7 w-7 text-background sm:h-8 sm:w-8" />
              </div>
            </div>
            <DialogTitle className="text-center text-lg sm:text-xl">
              {t("popupTitle")}
            </DialogTitle>
            <DialogDescription className="text-center text-sm sm:text-base">
              {t("popupDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-1 pr-1 sm:space-y-4 sm:py-2">
            <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <p className="text-center text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                {t("featureListTitle")}
              </p>
            </div>

            <div className="space-y-2.5">
              {FEATURE_KEYS.map((featureKey, index) => {
                const FeatureIcon = FEATURE_ICONS[index];

                return (
                  <div
                    key={featureKey}
                    className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/30 px-3 py-3 text-sm"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background shadow-sm">
                      <FeatureIcon className="h-4 w-4 text-foreground/75" />
                    </div>
                    <span className="leading-relaxed text-foreground/85">
                      {t(featureKey)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 shrink-0 border-t border-border/70 pt-3 sm:mt-4 sm:pt-4">
            <div className="flex items-center space-x-2 py-0.5 sm:py-1">
              <AppCheckbox
                id="clientdesk-studio-plan-promo-dismiss"
                checked={dontShowAgain}
                onCheckedChange={(checked) => setDontShowAgain(checked === true)}
                className="h-4 w-4 rounded-sm"
              />
              <label
                htmlFor="clientdesk-studio-plan-promo-dismiss"
                className="cursor-pointer text-xs font-normal text-muted-foreground sm:text-sm"
              >
                {t("dontShowAgain")}
              </label>
            </div>

            <DialogFooter className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={closePopup}
                className="w-full sm:w-auto"
              >
                {t("closeButton")}
              </Button>
              <Button
                type="button"
                onClick={openVideo}
                className="w-full gap-2 sm:w-auto"
              >
                {t("viewVideo")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
