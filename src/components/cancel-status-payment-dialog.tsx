"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { CancelPaymentPolicy } from "@/lib/cancel-payment";

type CancelStatusPaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingName: string;
  maxRefundAmount: number;
  loading?: boolean;
  onConfirm: (payload: { policy: CancelPaymentPolicy; refundAmount: number }) => void;
};

function formatCurrency(amount: number, locale: string) {
  return new Intl.NumberFormat(locale.startsWith("en") ? "en-US" : "id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount || 0);
}

export function CancelStatusPaymentDialog({
  open,
  onOpenChange,
  bookingName,
  maxRefundAmount,
  loading = false,
  onConfirm,
}: CancelStatusPaymentDialogProps) {
  const t = useTranslations("CancelStatusDialog");
  const locale = useLocale();
  const [policy, setPolicy] = React.useState<CancelPaymentPolicy>("forfeit");
  const [refundInput, setRefundInput] = React.useState("0");
  const [errorMessage, setErrorMessage] = React.useState("");

  const safeMaxRefund = Math.max(maxRefundAmount || 0, 0);

  React.useEffect(() => {
    if (!open) return;
    setPolicy("forfeit");
    setRefundInput(String(safeMaxRefund));
    setErrorMessage("");
  }, [open, safeMaxRefund]);

  function handleConfirm() {
    if (policy === "forfeit") {
      onConfirm({ policy, refundAmount: 0 });
      return;
    }

    const parsedRefund = Number(refundInput);
    if (!Number.isFinite(parsedRefund) || parsedRefund < 0) {
      setErrorMessage(t("validationInvalid"));
      return;
    }

    if (parsedRefund > safeMaxRefund) {
      setErrorMessage(t("validationExceed", { max: formatCurrency(safeMaxRefund, locale) }));
      return;
    }

    setErrorMessage("");
    onConfirm({ policy, refundAmount: parsedRefund });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { name: bookingName || "-" })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            {t("calendarImpactNote")}
          </div>

          <button
            type="button"
            onClick={() => {
              setPolicy("forfeit");
              setErrorMessage("");
            }}
            className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${policy === "forfeit"
              ? "border-foreground bg-foreground/5 dark:bg-foreground/10"
              : "border-border hover:bg-muted/50"
              }`}
          >
            <p className="text-sm font-medium">{t("forfeitTitle")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("forfeitDesc")}</p>
          </button>

          <button
            type="button"
            onClick={() => {
              setPolicy("refund");
              setErrorMessage("");
            }}
            className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${policy === "refund"
              ? "border-foreground bg-foreground/5 dark:bg-foreground/10"
              : "border-border hover:bg-muted/50"
              }`}
          >
            <p className="text-sm font-medium">{t("refundTitle")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("refundDesc")}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("maxRefund", { amount: formatCurrency(safeMaxRefund, locale) })}
            </p>
          </button>

          {policy === "refund" && (
            <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
              <label className="text-xs font-medium text-muted-foreground">{t("refundAmountLabel")}</label>
              <input
                type="number"
                min={0}
                max={safeMaxRefund}
                value={refundInput}
                onChange={(event) => {
                  setRefundInput(event.target.value);
                  if (errorMessage) setErrorMessage("");
                }}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              />
              <p className="text-[11px] text-muted-foreground">
                {t("refundAmountHelp", { amount: formatCurrency(safeMaxRefund, locale) })}
              </p>
              {errorMessage ? (
                <p className="text-[11px] text-red-600 dark:text-red-400">{errorMessage}</p>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t("cancel")}
          </Button>
          <Button type="button" variant="destructive" onClick={handleConfirm} disabled={loading}>
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
