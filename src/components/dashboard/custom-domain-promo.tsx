"use client";

import * as React from "react";
import { ArrowRight, Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
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

const DISMISS_KEY = "clientdesk_domain_promo_dismissed";

export function CustomDomainPromo() {
  const t = useTranslations("CustomDomain");
  const locale = useLocale();
  const router = useRouter();
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

  const viewDetail = React.useCallback(() => {
    persistDismissPreference(dontShowAgain);
    setOpen(false);
    router.push(`/${locale}/dashboard/custom-domain`);
  }, [dontShowAgain, locale, persistDismissPreference, router]);

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
      <DialogContent className="max-w-[min(920px,calc(100vw-1.5rem))] rounded-[1.75rem] p-6 sm:p-8 [&>button]:right-5 [&>button]:top-5 [&>button]:rounded-full [&>button]:p-2">
        <DialogHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-foreground shadow-xl">
            <Globe className="h-12 w-12 text-background" />
          </div>
          <DialogTitle className="text-3xl font-bold tracking-tight">
            🌐 {t("promo.popupTitle")}
          </DialogTitle>
          <DialogDescription className="mx-auto max-w-3xl text-lg leading-snug text-muted-foreground sm:text-xl">
            {t("promo.popupDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-4 px-1 text-lg leading-snug text-foreground/90 sm:text-xl">
          <div className="flex items-start gap-4">
            <span aria-hidden="true">🏷️</span>
            <p>{t("promo.benefit1")}</p>
          </div>
          <div className="flex items-start gap-4">
            <span aria-hidden="true">🔗</span>
            <p>{t("promo.benefit2")}</p>
          </div>
          <div className="flex items-start gap-4">
            <span aria-hidden="true">💼</span>
            <p>{t("promo.benefit3")}</p>
          </div>
        </div>

        <div className="mt-2 rounded-3xl border bg-muted/40 px-4 py-6 text-center sm:px-8">
          <p className="text-lg text-muted-foreground sm:text-xl">{t("promo.startingFrom")}</p>
          <p className="text-2xl text-muted-foreground line-through sm:text-3xl">Rp 200.000</p>
          <p className="text-5xl font-bold tracking-tight sm:text-6xl">Rp 150.000</p>
          <p className="mt-2 text-sm font-semibold text-foreground/85 sm:text-base">
            {t("promo.oneTimeAppliesBoth")}
          </p>
          <span className="mt-4 inline-flex items-center rounded-full bg-red-500 px-4 py-1.5 text-sm font-semibold text-white sm:text-base">
            {t("promo.limitedBadge")}
          </span>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">{t("promo.setupFee")}</p>
        </div>

        <div className="mt-1 flex items-center gap-3 px-1 text-base text-muted-foreground sm:text-lg">
          <AppCheckbox
            id="clientdesk-domain-promo-dismiss"
            checked={dontShowAgain}
            onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            className="mt-0.5 h-5 w-5 rounded-md"
          />
          <label
            htmlFor="clientdesk-domain-promo-dismiss"
            className="cursor-pointer"
          >
            {t("promo.dontShowAgain")}
          </label>
        </div>

        <DialogFooter className="mt-2 gap-3 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={closePopup}
            className="h-12 rounded-2xl px-8 text-base font-medium sm:text-lg"
          >
            {t("promo.closeButton")}
          </Button>
          <Button
            type="button"
            onClick={viewDetail}
            className="h-12 rounded-2xl px-8 text-base font-medium sm:text-lg"
          >
            {t("promo.viewDetail")}
            <ArrowRight className="h-5 w-5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
