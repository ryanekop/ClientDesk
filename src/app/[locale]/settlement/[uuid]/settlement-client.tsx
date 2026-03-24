"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  CheckCircle2,
  Download,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { FileDropzone } from "@/components/public/file-dropzone";
import { PaymentMethodSection } from "@/components/public/payment-method-section";
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
import {
  fillWhatsAppTemplate,
  getDefaultWhatsAppTemplate,
  normalizeWhatsAppNumber,
} from "@/lib/whatsapp-template";
import { formatSessionDate, formatTemplateSessionDate } from "@/utils/format-date";
import { buildWhatsAppUrl, openWhatsAppUrl } from "@/utils/whatsapp-link";
import {
  buildExtraFieldTemplateVars,
  buildMultiSessionTemplateVars,
} from "@/utils/form-extra-fields";
import { buildCustomFieldTemplateVars } from "@/components/form-builder/booking-form-layout";

type BookingData = {
  bookingCode: string;
  trackingUuid: string | null;
  clientName: string;
  clientWhatsapp: string | null;
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
  extraFields?: Record<string, unknown> | null;
  initialBreakdown: {
    packageTotal: number;
    addonTotal: number;
    accommodationFee: number;
    discountAmount: number;
  } | null;
};

type VendorData = {
  studioName: string;
  whatsappNumber: string | null;
  brandColor: string;
  greeting: string | null;
  formLang: string;
  formShowProof: boolean;
  formPaymentMethods: PaymentMethod[];
  qrisImageUrl: string | null;
  bankAccounts: BankAccount[];
  settlementConfirmTemplate: string;
  settlementConfirmTemplateEn: string;
};

type PreviewVendorPayload = Partial<
  Pick<
    VendorData,
    "studioName" | "brandColor" | "greeting" | "formShowProof" | "formPaymentMethods"
  >
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

  React.useEffect(() => {
    if (!previewMode || typeof window === "undefined") return;

    function handlePreviewLinkClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");
      const href = anchor?.getAttribute("href");
      if (!anchor || !href) return;
      event.preventDefault();
      window.open(anchor.href, "_blank", "noopener,noreferrer");
    }

    document.addEventListener("click", handlePreviewLinkClick, true);
    return () => document.removeEventListener("click", handlePreviewLinkClick, true);
  }, [previewMode]);

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
      formShowProof:
        typeof previewVendor?.formShowProof === "boolean"
          ? previewVendor.formShowProof
          : vendor.formShowProof,
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
  const proofEnabled = effectiveVendor.formShowProof ?? true;
  const canSubmit = !booking.isFullyPaid && settlementStatus !== "paid" && remaining > 0;
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
  const [submittedPaymentMethod, setSubmittedPaymentMethod] = React.useState<PaymentMethod | null>(
    (booking.finalPaymentMethod as PaymentMethod | null) ?? null,
  );
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

  function handleProofFile(file: File | null) {
    setProofFile(file);
    if (!file) {
      setProofPreview(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t("errorFileTooLarge"));
      setProofFile(null);
      setProofPreview(null);
      return;
    }
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setProofPreview(reader.result as string);
      reader.readAsDataURL(file);
      return;
    }
    setProofPreview(null);
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

    if (proofEnabled && selectedPaymentMethod !== "cash" && !proofFile) {
      setError(t("errorProof"));
      return;
    }

    setSubmitting(true);

    if (proofEnabled && proofFile && selectedPaymentMethod !== "cash") {
      setUploadingProof(true);
    }

    try {
      const formData = new FormData();
      formData.append("trackingUuid", booking.trackingUuid || "");
      formData.append("paymentMethod", selectedPaymentMethod);
      if (selectedPaymentSource) {
        formData.append("paymentSource", JSON.stringify(selectedPaymentSource));
      }
      if (proofEnabled && proofFile && selectedPaymentMethod !== "cash") {
        formData.append("paymentProofFile", proofFile);
      }

      const res = await fetch("/api/public/settlement", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || t("submitFailed"));
      } else {
        setSubmitted(true);
        setSubmittedPaymentMethod(selectedPaymentMethod);
      }
    } catch {
      setError(t("submitFailed"));
    }

    setUploadingProof(false);
    setSubmitting(false);
  }

  const brandColor = effectiveVendor.brandColor || "#10b981";
  const topGreeting =
    effectiveVendor.greeting?.trim() || t("defaultGreeting");
  const normalizedAdminWhatsapp = normalizeWhatsAppNumber(
    effectiveVendor.whatsappNumber,
  );
  const showAdminWhatsAppButton =
    Boolean(normalizedAdminWhatsapp) &&
    (submitted || settlementStatus === "submitted") &&
    !booking.isFullyPaid;
  const showSubmittedSuccess =
    (submitted || settlementStatus === "submitted") && !booking.isFullyPaid;

  function openAdminWhatsAppConfirmation() {
    if (!normalizedAdminWhatsapp) return;

    const invoiceUrl = `${window.location.origin}/api/public/invoice?code=${encodeURIComponent(
      booking.bookingCode,
    )}&lang=${locale}&stage=final`;
    const settlementUrl = booking.trackingUuid
      ? `${window.location.origin}/${locale}/settlement/${booking.trackingUuid}`
      : window.location.href;
    const activePaymentMethod = submittedPaymentMethod || selectedPaymentMethod;
    const paymentMethodLabel = activePaymentMethod
      ? getPaymentMethodLabel(activePaymentMethod)
      : "-";
    const templateContent =
      locale === "en"
        ? effectiveVendor.settlementConfirmTemplateEn ||
          effectiveVendor.settlementConfirmTemplate
        : effectiveVendor.settlementConfirmTemplate ||
          effectiveVendor.settlementConfirmTemplateEn;

    const resolvedTemplate = templateContent.trim()
      ? templateContent
      : getDefaultWhatsAppTemplate("whatsapp_settlement_confirm", locale);
    const message = fillWhatsAppTemplate(resolvedTemplate, {
      client_name: booking.clientName,
      client_whatsapp: booking.clientWhatsapp || "-",
      booking_code: booking.bookingCode,
      service_name: booking.serviceName || "-",
      session_date: booking.sessionDate
        ? formatTemplateSessionDate(booking.sessionDate, {
            locale: locale === "en" ? "en" : "id",
          })
        : "-",
      payment_method: paymentMethodLabel,
      final_total: formatCurrency(finalInvoiceTotal),
      remaining_payment: formatCurrency(remaining),
      studio_name: effectiveVendor.studioName,
      invoice_url: invoiceUrl,
      settlement_link: settlementUrl,
      ...buildExtraFieldTemplateVars(booking.extraFields),
      ...buildMultiSessionTemplateVars(booking.extraFields, {
        locale: locale === "en" ? "en" : "id",
      }),
      ...buildCustomFieldTemplateVars(booking.extraFields),
    });

    openWhatsAppUrl(buildWhatsAppUrl(normalizedAdminWhatsapp, message));
  }

  if (showSubmittedSuccess) {
    return (
      <div className="public-light-theme min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 px-4">
        <div className="text-center space-y-6 max-w-md mx-auto">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">{t("statusSubmitted")}</h2>
            <p className="text-muted-foreground text-sm">{t("bookingCode")}</p>
            <p className="text-3xl font-bold text-primary mt-1">
              {booking.bookingCode}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">{t("submittedInfo")}</p>
          <p className="text-sm text-muted-foreground">
            {t("confirmAdminInstruction")}
          </p>
          {showAdminWhatsAppButton ? (
            <button
              type="button"
              onClick={openAdminWhatsAppConfirmation}
              className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20 cursor-pointer text-base"
            >
              <MessageCircle className="w-5 h-5" />
              {t("confirmViaWhatsApp")}
            </button>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {t("adminWhatsappNotAvailable")}
            </div>
          )}
          <button
            onClick={() =>
              window.open(
                `/api/public/invoice?code=${encodeURIComponent(
                  booking.bookingCode,
                )}&lang=${locale}&stage=final`,
                "_blank",
              )
            }
            className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-lg border border-border bg-background text-foreground font-medium hover:bg-muted transition-colors"
          >
            <Download className="h-4 w-4" />
            {t("downloadInvoice")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="public-light-theme min-h-screen px-4 py-8 sm:py-12"
      style={{
        backgroundImage: `linear-gradient(135deg, ${brandColor}18 0%, #ffffff 40%, #ecfdf5 100%)`,
        color: "#0f172a",
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {effectiveVendor.studioName}
          </h1>
          <p className="text-sm text-slate-600">
            {t("title")} - {booking.clientName}
          </p>
          <p className="mx-auto max-w-xl text-sm text-slate-700">
            {topGreeting}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 space-y-4 text-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-bold">{t("finalInvoice")}</h2>
              <p className="text-sm text-slate-600">
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
              <span className="text-slate-500">{t("clientName")}</span>
              <span className="font-medium text-right">{booking.clientName}</span>
            </div>
            {booking.serviceName ? (
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">{t("service")}</span>
                <span className="font-medium text-right">{booking.serviceName}</span>
              </div>
            ) : null}
            {booking.eventType ? (
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">{t("eventType")}</span>
                <span className="font-medium text-right">{booking.eventType}</span>
              </div>
            ) : null}
            {booking.sessionDate ? (
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">{t("schedule")}</span>
                <span className="font-medium text-right">
                  {formatSessionDate(booking.sessionDate, {
                    locale: locale === "en" ? "en" : "id",
                    withDay: false,
                  })}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">{t("baseTotal")}</span>
              <span className="font-medium">{formatCurrency(booking.totalPrice)}</span>
            </div>
            {booking.initialBreakdown ? (
              <>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">{t("initialPackage")}</span>
                  <span className="font-medium">{formatCurrency(booking.initialBreakdown.packageTotal)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">{t("initialAddon")}</span>
                  <span className="font-medium">{formatCurrency(booking.initialBreakdown.addonTotal)}</span>
                </div>
                {booking.initialBreakdown.accommodationFee > 0 ? (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">{t("accommodationFee")}</span>
                    <span className="font-medium">{formatCurrency(booking.initialBreakdown.accommodationFee)}</span>
                  </div>
                ) : null}
                {booking.initialBreakdown.discountAmount > 0 ? (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">{t("specialDiscount")}</span>
                    <span className="font-medium">- {formatCurrency(booking.initialBreakdown.discountAmount)}</span>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">{t("adjustmentsTitle")}</h3>
              <span className="text-xs text-slate-500">
                {booking.finalAdjustments.length} {t("items")}
              </span>
            </div>
            {booking.finalAdjustments.length === 0 ? (
              <p className="text-sm text-slate-500">{t("noAdjustments")}</p>
            ) : (
              <div className="space-y-2">
                {booking.finalAdjustments.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium">{item.label}</p>
                        {item.reason ? (
                          <p className="text-xs text-slate-500">{item.reason}</p>
                        ) : null}
                      </div>
                      <span className="font-semibold">{formatCurrency(item.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-4 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">{t("adjustmentsTotal")}</span>
              <span className="font-medium">{formatCurrency(totalAdjustments)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">{t("finalTotal")}</span>
              <span className="font-medium">{formatCurrency(finalInvoiceTotal)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">{t("dpPaid")}</span>
              <span className="font-medium">- {formatCurrency(booking.dpPaid)}</span>
            </div>
            <div className="flex justify-between gap-4 border-t border-slate-200 pt-2">
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

        {(booking.isFullyPaid || settlementStatus === "paid") ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-sm text-green-800 shadow-sm">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{t("paidInfo")}</p>
            </div>
          </div>
        ) : null}

        {!submitted && !booking.isFullyPaid && canSubmit && remaining > 0 ? (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 space-y-5 text-slate-900"
          >
            <div>
              <h2 className="text-lg font-bold">{t("paymentFormTitle")}</h2>
              <p className="text-sm text-slate-600">{t("paymentFormDesc")}</p>
            </div>

            <PaymentMethodSection
              methods={effectiveVendor.formPaymentMethods}
              selectedMethod={selectedPaymentMethod}
              selectedSource={selectedPaymentSource}
              onSelectMethod={setSelectedPaymentMethod}
              onSelectSource={setSelectedPaymentSource}
              bankAccounts={enabledBankAccounts}
              qrisImageUrl={effectiveVendor.qrisImageUrl}
              brandColor={brandColor}
              labels={{
                methodLabel: t("paymentMethod"),
                bankLabel: t("bankAccount"),
                bankEmpty: t("bankEmpty"),
                qrisLabel: t("qris"),
                cashNote: t("cashInfo"),
                accountNumberLabel: t("accountNumberLabel"),
                copyLabel: t("copyLabel"),
                copiedLabel: t("copiedLabel"),
                bankDescriptions: {
                  bank: t("paymentMethodBankDesc"),
                  qris: t("paymentMethodQrisDesc"),
                  cash: t("paymentMethodCashDesc"),
                },
              }}
            />

            {proofEnabled && selectedPaymentMethod !== "cash" ? (
              <FileDropzone
                file={proofFile}
                previewUrl={proofPreview}
                accept="image/*,.pdf"
                label={t("paymentProof")}
                helperText={
                  selectedPaymentMethod === "qris"
                    ? t("paymentProofQrisHint")
                    : t("paymentProofBankHint")
                }
                emptyText={t("uploadProof")}
                emptySubtext={t("dragDropHint")}
                removeLabel={t("removeFile")}
                onFileSelect={handleProofFile}
              />
            ) : null}

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
