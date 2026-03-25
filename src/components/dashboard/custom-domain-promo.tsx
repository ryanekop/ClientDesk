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
      <DialogContent className="max-h-[88vh] max-w-[680px] rounded-[1.5rem] p-4 sm:p-6 [&>button]:right-3 [&>button]:top-3 [&>button]:rounded-full [&>button]:p-1.5 sm:[&>button]:right-4 sm:[&>button]:top-4">
        <DialogHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-foreground shadow-lg sm:h-20 sm:w-20 sm:rounded-[1.5rem]">
            <Globe className="h-8 w-8 text-background sm:h-10 sm:w-10" />
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight sm:text-[2rem]">
            🌐 {t("promo.popupTitle")}
          </DialogTitle>
          <DialogDescription className="mx-auto max-w-2xl text-base leading-snug text-muted-foreground sm:text-lg">
            {t("promo.popupDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-1 space-y-3 px-0.5 text-base leading-snug text-foreground/90 sm:text-lg">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="text-base sm:text-lg">🏷️</span>
            <p>{t("promo.benefit1")}</p>
          </div>
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="text-base sm:text-lg">🔗</span>
            <p>{t("promo.benefit2")}</p>
          </div>
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="text-base sm:text-lg">💼</span>
            <p>{t("promo.benefit3")}</p>
          </div>
        </div>

        <div className="mt-1 rounded-2xl border bg-muted/40 px-4 py-4 text-center sm:px-6 sm:py-5">
          <p className="text-base text-muted-foreground sm:text-lg">{t("promo.startingFrom")}</p>
          <p className="text-xl text-muted-foreground line-through sm:text-2xl">Rp 200.000</p>
          <p className="text-4xl font-bold tracking-tight sm:text-5xl">Rp 150.000</p>
          <p className="mt-1.5 text-xs font-semibold text-foreground/85 sm:text-sm">
            {t("promo.oneTimeAppliesBoth")}
          </p>
          <span className="mt-3 inline-flex items-center rounded-full bg-red-500 px-3.5 py-1 text-xs font-semibold text-white sm:text-sm">
            {t("promo.limitedBadge")}
          </span>
          <p className="mt-2 text-xs text-muted-foreground sm:text-sm">{t("promo.setupFee")}</p>
        </div>

        <div className="mt-0.5 flex items-center gap-2.5 px-0.5 text-sm text-muted-foreground sm:text-base">
          <AppCheckbox
            id="clientdesk-domain-promo-dismiss"
            checked={dontShowAgain}
            onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            className="mt-0.5 h-4 w-4 rounded-md sm:h-[18px] sm:w-[18px]"
          />
          <label
            htmlFor="clientdesk-domain-promo-dismiss"
            className="cursor-pointer"
          >
            {t("promo.dontShowAgain")}
          </label>
        </div>

        <DialogFooter className="mt-1 gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={closePopup}
            className="h-11 w-full rounded-xl px-6 text-sm font-medium sm:h-11 sm:w-auto sm:text-base"
          >
            {t("promo.closeButton")}
          </Button>
          <Button
            type="button"
            onClick={viewDetail}
            className="h-11 w-full rounded-xl px-6 text-sm font-medium sm:h-11 sm:w-auto sm:text-base"
          >
            {t("promo.viewDetail")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
