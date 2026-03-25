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
    router.push(`/${locale}/settings/custom-domain`);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-3 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground shadow-lg">
              <Globe className="h-8 w-8 text-background" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            🌐 {t("promo.popupTitle")}
          </DialogTitle>
          <DialogDescription className="text-center">
            {t("promo.popupDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-start gap-3 text-sm">
            <span aria-hidden="true" className="shrink-0 text-base">🏷️</span>
            <span className="text-foreground/80">{t("promo.benefit1")}</span>
          </div>
          <div className="flex items-start gap-3 text-sm">
            <span aria-hidden="true" className="shrink-0 text-base">🔗</span>
            <span className="text-foreground/80">{t("promo.benefit2")}</span>
          </div>
          <div className="flex items-start gap-3 text-sm">
            <span aria-hidden="true" className="shrink-0 text-base">💼</span>
            <span className="text-foreground/80">{t("promo.benefit3")}</span>
          </div>
        </div>

        <div className="rounded-lg border bg-muted p-3 text-center">
          <p className="mb-1 text-xs text-muted-foreground">{t("promo.startingFrom")}</p>
          <p className="text-sm text-muted-foreground line-through">Rp 200.000</p>
          <p className="text-2xl font-bold text-foreground">Rp 150.000</p>
          <p className="mt-1 text-xs font-semibold text-foreground/85">
            {t("promo.oneTimeAppliesBoth")}
          </p>
          <span className="mt-1 inline-block rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
            {t("promo.limitedBadge")}
          </span>
          <p className="mt-1 text-xs text-muted-foreground">{t("promo.setupFee")}</p>
        </div>

        <div className="flex items-center space-x-2 py-1">
          <AppCheckbox
            id="clientdesk-domain-promo-dismiss"
            checked={dontShowAgain}
            onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            className="h-4 w-4 rounded-sm"
          />
          <label
            htmlFor="clientdesk-domain-promo-dismiss"
            className="cursor-pointer text-sm font-normal text-muted-foreground"
          >
            {t("promo.dontShowAgain")}
          </label>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={closePopup}
            className="w-full sm:w-auto"
          >
            {t("promo.closeButton")}
          </Button>
          <Button
            type="button"
            onClick={viewDetail}
            className="w-full gap-2 sm:w-auto"
          >
            {t("promo.viewDetail")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
