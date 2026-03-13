"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  CreditCard,
  Download,
  Loader2,
  QrCode,
  Upload,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { compressImage } from "@/utils/compress-image";
import {
  getEnabledBankAccounts,
  getPaymentMethodLabel,
  normalizePaymentMethods,
  type BankAccount,
  type PaymentMethod,
  type PaymentSource,
} from "@/lib/payment-config";
import {
  getFinalAdjustmentsTotal,
  getFinalInvoiceTotal,
  getRemainingFinalPayment,
  getSettlementStatus,
} from "@/lib/final-settlement";

type BookingData = {
  bookingCode: string;
  trackingUuid: string | null;
  clientName: string;
  sessionDate: string | null;
  eventType: string | null;
  totalPrice: number;
  dpPaid: number;
  isFullyPaid: boolean;
  status: string;
  settlementStatus: string;
  finalAdjustments: Array<{
    id: string;
    label: string;
    amount: number;
    reason: string;
    created_at: string;
  }>;
  finalPaymentAmount: number;
  finalPaymentMethod: string | null;
  finalPaymentSource: PaymentSource | null;
  finalPaymentProofUrl: string | null;
  finalPaidAt: string | null;
  finalInvoiceSentAt: string | null;
  serviceName: string | null;
};

type VendorData = {
  studioName: string;
  brandColor: string;
  greeting: string | null;
  formLang: string;
  formPaymentMethods: PaymentMethod[];
  qrisImageUrl: string | null;
  bankAccounts: BankAccount[];
};

type PreviewVendorPayload = Partial<
  Pick<VendorData, "studioName" | "brandColor" | "greeting" | "formPaymentMethods">
>;

type PreviewMessage = {
  type: "clientdesk:settlement-preview-update";
  previewKey: string;
  payload: PreviewVendorPayload;
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n || 0);
}

function createPaymentProofPath(ext?: string) {
  const safeExt = ext && ext.length > 0 ? ext : "bin";
  return `final-payment-proofs/${crypto.randomUUID()}.${safeExt}`;
}

export default function SettlementClient({
  booking,
  vendor,
}: {
  booking: BookingData;
  vendor: VendorData;
}) {
  const t = useTranslations("Settlement");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const previewMode = searchParams.get("preview") === "1";
  const previewStorageKey = searchParams.get("previewKey") || "";
  const supabase = React.useMemo(() => createClient(), []);
  const [previewVendor, setPreviewVendor] = React.useState<PreviewVendorPayload | null>(null);

  React.useEffect(() => {
    if (!previewMode || !previewStorageKey || typeof window === "undefined") return;

    function loadPreviewVendor() {
      const raw = window.localStorage.getItem(previewStorageKey);
      if (!raw) return;
      try {
        setPreviewVendor(JSON.parse(raw) as PreviewVendorPayload);
      } catch {
        setPreviewVendor(null);
      }
    }

    function handlePreviewMessage(event: MessageEvent<PreviewMessage>) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "clientdesk:settlement-preview-update") return;
      if (event.data.previewKey !== previewStorageKey) return;
      setPreviewVendor(event.data.payload);
    }

    loadPreviewVendor();
    window.addEventListener("storage", loadPreviewVendor);
    window.addEventListener("message", handlePreviewMessage);
    return () => {
      window.removeEventListener("storage", loadPreviewVendor);
      window.removeEventListener("message", handlePreviewMessage);
    };
  }, [previewMode, previewStorageKey]);

  const effectiveVendor = React.useMemo<VendorData>(
    () => ({
      ...vendor,
      studioName:
        typeof previewVendor?.studioName === "string"
          ? previewVendor.studioName
          : vendor.studioName,
      brandColor:
        typeof previewVendor?.brandColor === "string"
          ? previewVendor.brandColor
          : vendor.brandColor,
      greeting:
        typeof previewVendor?.greeting === "string"
          ? previewVendor.greeting
          : vendor.greeting,
      formPaymentMethods: normalizePaymentMethods(
        previewVendor?.formPaymentMethods ?? vendor.formPaymentMethods,
      ),
    }),
    [previewVendor, vendor],
  );

  const enabledBankAccounts = React.useMemo(
    () => getEnabledBankAccounts(effectiveVendor.bankAccounts || []),
    [effectiveVendor.bankAccounts],
  );
  const totalAdjustments = React.useMemo(
    () => getFinalAdjustmentsTotal(booking.finalAdjustments),
    [booking.finalAdjustments],
  );
  const finalInvoiceTotal = React.useMemo(
    () => getFinalInvoiceTotal(booking.totalPrice, booking.finalAdjustments),
    [booking.totalPrice, booking.finalAdjustments],
  );
  const remaining = React.useMemo(
    () =>
      getRemainingFinalPayment({
        total_price: booking.totalPrice,
        dp_paid: booking.dpPaid,
        final_adjustments: booking.finalAdjustments,
        final_payment_amount: booking.finalPaymentAmount,
        final_paid_at: booking.finalPaidAt,
        settlement_status: booking.settlementStatus,
        is_fully_paid: booking.isFullyPaid,
      }),
    [booking],
  );
  const settlementStatus = getSettlementStatus(booking.settlementStatus);
  const canSubmit = settlementStatus === "sent" || settlementStatus === "submitted";
  const [selectedPaymentMethod, setSelectedPaymentMethod] = React.useState<PaymentMethod | null>(
    effectiveVendor.formPaymentMethods[0] || null,
  );
  const [selectedPaymentSource, setSelectedPaymentSource] =
    React.useState<PaymentSource | null>(null);
  const [proofFile, setProofFile] = React.useState<File | null>(null);
  const [proofPreview, setProofPreview] = React.useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(settlementStatus === "submitted");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setSelectedPaymentMethod((current) => {
      if (current && effectiveVendor.formPaymentMethods.includes(current)) return current;
      return effectiveVendor.formPaymentMethods[0] || null;
    });
  }, [effectiveVendor.formPaymentMethods]);

  React.useEffect(() => {
    if (!selectedPaymentMethod) {
      setSelectedPaymentSource(null);
      return;
    }

    if (selectedPaymentMethod === "bank") {
      setSelectedPaymentSource((current) => {
        if (current?.type === "bank") {
          const matched = enabledBankAccounts.find(
            (bank) => bank.id === current.bank_id,
          );
          if (matched) return current;
        }

        const firstBank = enabledBankAccounts[0];
        return firstBank
          ? {
              type: "bank",
              bank_id: firstBank.id,
              bank_name: firstBank.bank_name,
              account_name: firstBank.account_name,
              account_number: firstBank.account_number,
              label: firstBank.bank_name,
            }
          : null;
      });
      return;
    }

    if (selectedPaymentMethod === "qris") {
      setSelectedPaymentSource({ type: "qris", label: "QRIS" });
      return;
    }

    setSelectedPaymentSource({ type: "cash", label: "Cash" });
  }, [enabledBankAccounts, selectedPaymentMethod]);

  function handleProofFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = () => setProofPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!selectedPaymentMethod) {
      setError(t("errorMethod"));
      return;
    }

    if (selectedPaymentMethod === "bank" && !selectedPaymentSource) {
      setError(t("errorSource"));
      return;
    }

    if (selectedPaymentMethod !== "cash" && !proofFile) {
      setError(t("errorProof"));
      return;
    }

    setSubmitting(true);

    let paymentProofUrl: string | null = null;
    if (proofFile && selectedPaymentMethod !== "cash") {
      setUploadingProof(true);
      try {
        const compressed = proofFile.type.startsWith("image/")
          ? await compressImage(proofFile, 1200, 0.7)
          : proofFile;
        const ext = proofFile.type.startsWith("image/")
          ? "jpg"
          : proofFile.name.split(".").pop();
        const path = createPaymentProofPath(ext);
        const { error: uploadErr } = await supabase.storage
          .from("payment-proofs")
          .upload(path, compressed, {
            upsert: false,
            contentType: proofFile.type.startsWith("image/")
              ? "image/jpeg"
              : proofFile.type,
          });

        if (uploadErr) {
          setError(`${t("errorUpload")}${uploadErr.message}`);
          setSubmitting(false);
          setUploadingProof(false);
          return;
        }

        const { data: publicUrl } = supabase.storage
          .from("payment-proofs")
          .getPublicUrl(path);
        paymentProofUrl = publicUrl.publicUrl;
      } catch {
        setError(t("errorCompress"));
        setSubmitting(false);
        setUploadingProof(false);
        return;
      }
      setUploadingProof(false);
    }

    try {
      const res = await fetch("/api/public/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingUuid: booking.trackingUuid,
          paymentMethod: selectedPaymentMethod,
          paymentSource: selectedPaymentSource,
          paymentProofUrl,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || t("submitFailed"));
      } else {
        setSubmitted(true);
      }
    } catch {
      setError(t("submitFailed"));
    }

    setSubmitting(false);
  }

  const brandColor = effectiveVendor.brandColor || "#10b981";
  const topGreeting =
    effectiveVendor.greeting?.trim() || t("defaultGreeting");

  return (
    <div
      className="min-h-screen px-4 py-8 sm:py-12"
      style={{
        backgroundImage: `linear-gradient(135deg, ${brandColor}18 0%, #ffffff 40%, #ecfdf5 100%)`,
      }}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="text-center space-y-3">
          <div
            className="mx-auto inline-flex rounded-full px-4 py-1 text-xs font-semibold"
            style={{ backgroundColor: `${brandColor}20`, color: brandColor }}
          >
            {t("title")}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {effectiveVendor.studioName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("title")} - {booking.clientName}
          </p>
          <p className="mx-auto max-w-xl text-sm text-foreground/80">
            {topGreeting}
          </p>
        </div>

        <div className="rounded-2xl border bg-background p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
            <div>
              <h2 className="text-lg font-bold">{t("finalInvoice")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("bookingCode")}{" "}
                <span className="font-semibold" style={{ color: brandColor }}>
                  {booking.bookingCode}
                </span>
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                settlementStatus === "paid"
                  ? "bg-green-100 text-green-700"
                  : settlementStatus === "submitted"
                    ? "bg-blue-100 text-blue-700"
                    : settlementStatus === "sent"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-700"
              }`}
            >
              {settlementStatus === "paid"
                ? t("statusPaid")
                : settlementStatus === "submitted"
                  ? t("statusSubmitted")
                  : settlementStatus === "sent"
                    ? t("statusSent")
                    : t("statusDraft")}
            </span>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t("clientName")}</span>
              <span className="font-medium text-right">{booking.clientName}</span>
            </div>
            {booking.serviceName ? (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t("service")}</span>
                <span className="font-medium text-right">{booking.serviceName}</span>
              </div>
            ) : null}
            {booking.eventType ? (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t("eventType")}</span>
                <span className="font-medium text-right">{booking.eventType}</span>
              </div>
            ) : null}
            {booking.sessionDate ? (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t("schedule")}</span>
                <span className="font-medium text-right">
                  {new Date(booking.sessionDate).toLocaleString(
                    locale === "en" ? "en-US" : "id-ID",
                  )}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t("baseTotal")}</span>
              <span className="font-medium">{formatCurrency(booking.totalPrice)}</span>
            </div>
          </div>

          <div className="rounded-xl border border-dashed bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">{t("adjustmentsTitle")}</h3>
              <span className="text-xs text-muted-foreground">
                {booking.finalAdjustments.length} {t("items")}
              </span>
            </div>
            {booking.finalAdjustments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noAdjustments")}</p>
            ) : (
              <div className="space-y-2">
                {booking.finalAdjustments.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border bg-background px-3 py-2 text-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium">{item.label}</p>
                        {item.reason ? (
                          <p className="text-xs text-muted-foreground">{item.reason}</p>
                        ) : null}
                      </div>
                      <span className="font-semibold">{formatCurrency(item.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t("adjustmentsTotal")}</span>
              <span className="font-medium">{formatCurrency(totalAdjustments)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t("finalTotal")}</span>
              <span className="font-medium">{formatCurrency(finalInvoiceTotal)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t("dpPaid")}</span>
              <span className="font-medium">- {formatCurrency(booking.dpPaid)}</span>
            </div>
            <div className="flex justify-between gap-4 border-t pt-2">
              <span className="font-semibold">{t("remaining")}</span>
              <span className="text-lg font-bold text-amber-600">
                {formatCurrency(remaining)}
              </span>
            </div>
          </div>

          <button
            onClick={() =>
              window.open(
                `/api/public/invoice?code=${encodeURIComponent(
                  booking.bookingCode,
                )}&lang=${locale}&stage=final`,
                "_blank",
              )
            }
            className="inline-flex items-center gap-2 text-sm hover:underline"
            style={{ color: brandColor }}
          >
            <Download className="h-4 w-4" />
            {t("downloadInvoice")}
          </button>
        </div>

        {settlementStatus === "draft" && !booking.isFullyPaid ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{t("notOpened")}</p>
            </div>
          </div>
        ) : null}

        {(submitted || settlementStatus === "submitted") && !booking.isFullyPaid ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-800">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{t("submittedInfo")}</p>
            </div>
          </div>
        ) : null}

        {(booking.isFullyPaid || settlementStatus === "paid") ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-sm text-green-800">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{t("paidInfo")}</p>
            </div>
          </div>
        ) : null}

        {!submitted && !booking.isFullyPaid && canSubmit && remaining > 0 ? (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border bg-background p-6 shadow-sm space-y-5"
          >
            <div>
              <h2 className="text-lg font-bold">{t("paymentFormTitle")}</h2>
              <p className="text-sm text-muted-foreground">{t("paymentFormDesc")}</p>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">{t("paymentMethod")}</label>
              <div className="grid gap-3 sm:grid-cols-3">
                {effectiveVendor.formPaymentMethods.map((method) => {
                  const Icon =
                    method === "bank"
                      ? CreditCard
                      : method === "qris"
                        ? QrCode
                        : Banknote;
                  const disabled =
                    (method === "bank" && enabledBankAccounts.length === 0) ||
                    (method === "qris" && !effectiveVendor.qrisImageUrl);

                  return (
                    <button
                      key={method}
                      type="button"
                      disabled={disabled}
                      onClick={() => setSelectedPaymentMethod(method)}
                      className={`rounded-xl border p-4 text-left transition-colors ${
                        selectedPaymentMethod === method
                          ? "shadow-sm"
                          : "hover:bg-muted/50"
                      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                      style={
                        selectedPaymentMethod === method
                          ? { borderColor: brandColor, backgroundColor: `${brandColor}10` }
                          : undefined
                      }
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="font-medium">{getPaymentMethodLabel(method)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedPaymentMethod === "bank" && enabledBankAccounts.length > 0 ? (
              <div className="space-y-3">
                <label className="text-sm font-medium">{t("bankAccount")}</label>
                <div className="space-y-2">
                  {enabledBankAccounts.map((bank) => {
                    const selected =
                      selectedPaymentSource?.type === "bank" &&
                      selectedPaymentSource.bank_id === bank.id;
                    return (
                      <button
                        key={bank.id}
                        type="button"
                        onClick={() =>
                          setSelectedPaymentSource({
                            type: "bank",
                            bank_id: bank.id,
                            bank_name: bank.bank_name,
                            account_number: bank.account_number,
                            account_name: bank.account_name,
                            label: bank.bank_name,
                          })
                        }
                        className="w-full rounded-xl border p-3 text-left hover:bg-muted/50"
                        style={
                          selected
                            ? { borderColor: brandColor, backgroundColor: `${brandColor}10` }
                            : undefined
                        }
                      >
                        <p className="font-medium">{bank.bank_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {bank.account_number} a.n. {bank.account_name}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {selectedPaymentMethod === "qris" && effectiveVendor.qrisImageUrl ? (
              <div className="space-y-3">
                <label className="text-sm font-medium">{t("qris")}</label>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={effectiveVendor.qrisImageUrl}
                  alt="QRIS"
                  className="max-w-xs rounded-xl border"
                />
              </div>
            ) : null}

            {selectedPaymentMethod !== "cash" ? (
              <div className="space-y-3">
                <label className="text-sm font-medium">{t("paymentProof")}</label>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-4 text-sm hover:bg-muted/50">
                  <Upload className="h-4 w-4" />
                  <span>{t("uploadProof")}</span>
                  <input type="file" className="hidden" onChange={handleProofFile} />
                </label>
                {proofPreview ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={proofPreview}
                      alt="Preview bukti pembayaran"
                      className="max-w-xs rounded-xl border"
                    />
                  </>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("cashInfo")}</p>
            )}

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting || uploadingProof}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              style={{ backgroundColor: brandColor }}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitting ? t("sending") : t("submit")}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
