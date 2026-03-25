"use client";

import * as React from "react";
import {
  Banknote,
  Check,
  ClipboardCheck,
  Copy,
  CreditCard,
  ImageOff,
  QrCode,
} from "lucide-react";
import {
  createPaymentSourceFromBank,
  getPaymentMethodLabel,
  type BankAccount,
  type PaymentMethod,
  type PaymentSource,
} from "@/lib/payment-config";

type PaymentMethodSectionProps = {
  methods: PaymentMethod[];
  selectedMethod: PaymentMethod | null;
  selectedSource: PaymentSource | null;
  onSelectMethod: (method: PaymentMethod) => void;
  onSelectSource: (source: PaymentSource) => void;
  bankAccounts: BankAccount[];
  qrisImageUrl?: string | null;
  brandColor?: string;
  labels: {
    methodLabel: string;
    bankLabel: string;
    bankEmpty: string;
    qrisLabel: string;
    qrisEmpty: string;
    qrisLoadError: string;
    cashNote: string;
    accountNumberLabel: string;
    copyLabel: string;
    copiedLabel: string;
    bankDescriptions: Record<PaymentMethod, string>;
  };
};

export function PaymentMethodSection({
  methods,
  selectedMethod,
  selectedSource,
  onSelectMethod,
  onSelectSource,
  bankAccounts,
  qrisImageUrl,
  brandColor,
  labels,
}: PaymentMethodSectionProps) {
  const [copiedAccount, setCopiedAccount] = React.useState<string | null>(null);
  const [qrisImageFailed, setQrisImageFailed] = React.useState(false);
  const desktopGridClass =
    methods.length <= 1
      ? "md:grid-cols-1"
      : methods.length === 2
        ? "md:grid-cols-2"
        : "md:grid-cols-3";

  async function handleCopyAccountNumber(accountNumber: string) {
    try {
      await navigator.clipboard.writeText(accountNumber);
      setCopiedAccount(accountNumber);
      window.setTimeout(() => {
        setCopiedAccount((current) =>
          current === accountNumber ? null : current,
        );
      }, 1500);
    } catch {
      setCopiedAccount(null);
    }
  }

  React.useEffect(() => {
    setQrisImageFailed(false);
  }, [qrisImageUrl]);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <label className="text-sm font-medium">{labels.methodLabel}</label>
        <div className={`grid grid-cols-1 gap-3 ${desktopGridClass}`}>
          {methods.map((method) => {
            const Icon =
              method === "bank"
                ? CreditCard
                : method === "qris"
                  ? QrCode
                  : Banknote;
            const active = selectedMethod === method;
            const disabled =
              (method === "bank" && bankAccounts.length === 0) ||
              (method === "qris" && !qrisImageUrl);

            return (
              <button
                key={method}
                type="button"
                disabled={disabled}
                onClick={() => onSelectMethod(method)}
                className={`rounded-2xl border p-4 text-left transition-all md:h-full ${
                  active ? "shadow-sm" : "hover:bg-muted/40"
                } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                style={
                  active
                    ? {
                        borderColor: brandColor || "currentColor",
                        backgroundColor: `${brandColor || "#000000"}10`,
                      }
                    : undefined
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Icon
                      className={`mt-0.5 h-5 w-5 shrink-0 ${
                        active ? "text-foreground" : "text-muted-foreground"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-base font-semibold">
                        {getPaymentMethodLabel(method)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {labels.bankDescriptions[method]}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                      active ? "border-transparent" : "border-muted-foreground/30"
                    }`}
                    style={active ? { backgroundColor: brandColor || "#000000" } : undefined}
                  >
                    {active ? <Check className="h-3.5 w-3.5 text-white" /> : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedMethod === "bank" ? (
        <div className="space-y-3">
          <label className="text-sm font-medium">{labels.bankLabel}</label>
          {bankAccounts.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
              {labels.bankEmpty}
            </div>
          ) : (
            <div className="space-y-3">
              {bankAccounts.map((bank) => {
                const active =
                  selectedSource?.type === "bank" &&
                  selectedSource.bank_id === bank.id;

                return (
                  <button
                    key={bank.id}
                    type="button"
                    onClick={() => onSelectSource(createPaymentSourceFromBank(bank))}
                    className="w-full rounded-2xl border p-4 text-left transition-all hover:bg-muted/40"
                    style={
                      active
                        ? {
                            borderColor: brandColor || "currentColor",
                            backgroundColor: `${brandColor || "#000000"}10`,
                          }
                        : undefined
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold">{bank.bank_name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Transfer via {bank.bank_name}
                        </p>
                      </div>
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                          active ? "border-transparent" : "border-muted-foreground/30"
                        }`}
                        style={active ? { backgroundColor: brandColor || "#000000" } : undefined}
                      >
                        {active ? <Check className="h-3.5 w-3.5 text-white" /> : null}
                      </div>
                    </div>
                  </button>
                );
              })}

              {selectedSource?.type === "bank" ? (
                <div
                  className="rounded-2xl border p-4"
                  style={{
                    borderColor: `${brandColor || "#000000"}33`,
                    backgroundColor: `${brandColor || "#000000"}10`,
                  }}
                >
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <CreditCard className="h-4 w-4" />
                    {selectedSource.bank_name}
                  </div>
                  <div className="rounded-xl bg-background/90 p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          {labels.accountNumberLabel}
                        </p>
                        <p className="mt-1 break-all text-lg font-semibold tracking-[0.04em] sm:text-xl">
                          {selectedSource.account_number}
                        </p>
                        {selectedSource.account_name ? (
                          <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
                            a.n. {selectedSource.account_name}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyAccountNumber(selectedSource.account_number)}
                        className="inline-flex items-center justify-center gap-1.5 self-start rounded-xl border px-4 py-2.5 text-sm font-medium hover:bg-muted"
                      >
                        {copiedAccount === selectedSource.account_number ? (
                          <ClipboardCheck className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        {copiedAccount === selectedSource.account_number
                          ? labels.copiedLabel
                          : labels.copyLabel}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {selectedMethod === "qris" ? (
        <div className="space-y-3">
          <label className="text-sm font-medium">{labels.qrisLabel}</label>
          <div
            className="rounded-2xl border p-4"
            style={{
              borderColor: `${brandColor || "#000000"}33`,
              backgroundColor: `${brandColor || "#000000"}10`,
            }}
          >
            <div className="flex min-h-64 items-center justify-center rounded-xl bg-background/90 p-6">
              {qrisImageUrl && !qrisImageFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrisImageUrl}
                  alt="QRIS"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  onError={() => setQrisImageFailed(true)}
                  className="max-h-[22rem] w-full object-contain"
                />
              ) : (
                <div className="max-w-sm space-y-2 text-center text-sm text-muted-foreground">
                  {qrisImageUrl ? (
                    <ImageOff className="mx-auto h-5 w-5" aria-hidden="true" />
                  ) : null}
                  <p>{qrisImageUrl ? labels.qrisLoadError : labels.qrisEmpty}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {selectedMethod === "cash" ? (
        <div className="rounded-2xl border bg-muted/20 p-4 text-sm text-muted-foreground">
          {labels.cashNote}
        </div>
      ) : null}
    </div>
  );
}
