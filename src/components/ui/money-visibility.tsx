"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { useLocale } from "next-intl";
import { useMoneyVisibility } from "@/hooks/use-money-visibility";
import { cn } from "@/lib/utils";
import { Button } from "./button";

type MoneyVisibilityToggleProps = {
  className?: string;
  showLabel?: boolean;
};

export function MoneyVisibilityToggle({
  className,
  showLabel = true,
}: MoneyVisibilityToggleProps) {
  const locale = useLocale();
  const { isMoneyVisible, toggleMoneyVisibility } = useMoneyVisibility();

  const hideLabel = locale === "en" ? "Hide amounts" : "Sembunyikan nominal";
  const showLabelText =
    locale === "en" ? "Show amounts" : "Tampilkan nominal";
  const buttonLabel = isMoneyVisible ? hideLabel : showLabelText;

  return (
    <Button
      type="button"
      variant="outline"
      className={cn("gap-2", className)}
      onClick={toggleMoneyVisibility}
      aria-label={buttonLabel}
      title={buttonLabel}
    >
      {isMoneyVisible ? (
        <Eye className="h-4 w-4" />
      ) : (
        <EyeOff className="h-4 w-4" />
      )}
      {showLabel ? <span>{buttonLabel}</span> : null}
    </Button>
  );
}

type MaskedCurrencyTextProps = {
  amount: number;
  className?: string;
  hiddenPlaceholder?: string;
};

export function MaskedCurrencyText({
  amount,
  className,
  hiddenPlaceholder,
}: MaskedCurrencyTextProps) {
  const locale = useLocale();
  const { isMoneyVisible } = useMoneyVisibility();

  const formattedValue = React.useMemo(
    () =>
      new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
      }).format(amount),
    [amount],
  );

  const maskedValue =
    hiddenPlaceholder || (locale === "en" ? "IDR •••••••" : "Rp •••••••");

  return (
    <span className={className}>{isMoneyVisible ? formattedValue : maskedValue}</span>
  );
}
