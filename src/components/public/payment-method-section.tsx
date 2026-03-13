"use client";

import * as React from "react";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
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
    cashNote: string;
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
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <label className="text-sm font-medium">{labels.methodLabel}</label>
        <div className="grid gap-3 md:grid-cols-3">
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
                className={`rounded-2xl border p-4 text-left transition-all ${
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
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                        active ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-semibold">
                        {getPaymentMethodLabel(method)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {labels.bankDescriptions[method]}
                      </p>
                    </div>
                  </div>
                  {active ? (
                    <CheckCircle2
                      className="mt-1 h-5 w-5 shrink-0"
                      style={{ color: brandColor || "currentColor" }}
                    />
                  ) : (
                    <div className="mt-1 h-5 w-5 rounded-full border border-muted-foreground/30" />
                  )}
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
                      {active ? (
                        <CheckCircle2
                          className="h-5 w-5 shrink-0"
                          style={{ color: brandColor || "currentColor" }}
                        />
                      ) : null}
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
                  <div className="rounded-xl bg-background/90 p-4">
                    <p className="font-mono text-2xl font-bold tracking-wide">
                      {selectedSource.account_number}
                    </p>
                    {selectedSource.account_name ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        a.n. {selectedSource.account_name}
                      </p>
                    ) : null}
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
              {qrisImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrisImageUrl}
                  alt="QRIS"
                  className="max-h-[22rem] w-full object-contain"
                />
              ) : (
                <p className="text-sm text-muted-foreground">{labels.bankEmpty}</p>
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
