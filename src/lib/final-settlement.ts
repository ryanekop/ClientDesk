export type FinalAdjustment = {
  id: string;
  service_id?: string | null;
  source?: "service_addon" | "manual";
  label: string;
  unit_price?: number;
  quantity?: number;
  amount: number;
  reason: string;
  created_at: string;
};

export type SettlementStatus = "draft" | "sent" | "submitted" | "paid";

type SettlementInput = {
  total_price: number;
  dp_paid: number;
  dp_verified_amount?: number | null;
  dp_verified_at?: string | null;
  dp_refund_amount?: number | null;
  dp_refunded_at?: string | null;
  final_adjustments?: unknown;
  final_payment_amount?: number | null;
  final_paid_at?: string | null;
  settlement_status?: string | null;
  is_fully_paid?: boolean | null;
};

type AutoDpVerificationInput = {
  previousStatus?: string | null;
  nextStatus?: string | null;
  triggerStatus?: string | null;
  dpPaid?: number | null;
  dpVerifiedAt?: string | null;
  nowIso?: string;
};

type AutoDpVerificationPatch = {
  dp_verified_amount: number;
  dp_verified_at: string;
  dp_refund_amount: number;
  dp_refunded_at: null;
};

export function normalizeFinalAdjustments(value: unknown): FinalAdjustment[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      id: typeof item.id === "string" && item.id.trim() ? item.id : crypto.randomUUID(),
      service_id:
        typeof item.service_id === "string" && item.service_id.trim()
          ? item.service_id
          : null,
      source:
        item.source === "service_addon" || item.source === "manual"
          ? (item.source as "service_addon" | "manual")
          : "manual",
      label: typeof item.label === "string" ? item.label.trim() : "",
      unit_price:
        typeof item.unit_price === "number"
          ? item.unit_price
          : Number(item.unit_price) || 0,
      quantity:
        typeof item.quantity === "number"
          ? item.quantity
          : Math.max(Number(item.quantity) || 1, 1),
      amount:
        typeof item.amount === "number"
          ? item.amount
          : Number(item.amount) || 0,
      reason: typeof item.reason === "string" ? item.reason.trim() : "",
      created_at:
        typeof item.created_at === "string" && item.created_at.trim()
          ? item.created_at
          : new Date().toISOString(),
    }))
    .map((item) => ({
      ...item,
      amount:
        item.amount > 0
          ? item.amount
          : Math.max(item.unit_price || 0, 0) * Math.max(item.quantity || 1, 1),
      unit_price:
        item.unit_price && item.unit_price > 0
          ? item.unit_price
          : item.amount > 0
            ? item.amount / Math.max(item.quantity || 1, 1)
            : 0,
    }))
    .filter((item) => item.label && item.amount > 0);
}

export function getFinalAdjustmentsTotal(value: unknown): number {
  return normalizeFinalAdjustments(value).reduce((sum, item) => sum + item.amount, 0);
}

export function getFinalInvoiceTotal(totalPrice: number, adjustments: unknown): number {
  return (totalPrice || 0) + getFinalAdjustmentsTotal(adjustments);
}

export function getVerifiedFinalPaymentAmount(input: SettlementInput): number {
  if (input.final_paid_at) return input.final_payment_amount || 0;

  if (input.is_fully_paid && (input.final_payment_amount || 0) > 0) {
    return input.final_payment_amount || 0;
  }

  return 0;
}

export function getVerifiedDpAmount(input: SettlementInput): number {
  return Math.max(input.dp_verified_amount || 0, 0);
}

export function getDpRefundAmount(input: SettlementInput): number {
  const refund = Math.max(input.dp_refund_amount || 0, 0);
  const verifiedDp = getVerifiedDpAmount(input);
  return refund > verifiedDp ? verifiedDp : refund;
}

export function buildAutoDpVerificationPatch({
  previousStatus,
  nextStatus,
  triggerStatus,
  dpPaid,
  dpVerifiedAt,
  nowIso,
}: AutoDpVerificationInput): AutoDpVerificationPatch | null {
  const trigger = (triggerStatus || "").trim();
  if (!trigger) return null;

  if (previousStatus === trigger || nextStatus !== trigger) {
    return null;
  }

  const safeDpPaid = Math.max(Number(dpPaid) || 0, 0);
  if (safeDpPaid <= 0) return null;
  if (dpVerifiedAt) return null;

  return {
    dp_verified_amount: safeDpPaid,
    dp_verified_at: nowIso || new Date().toISOString(),
    dp_refund_amount: 0,
    dp_refunded_at: null,
  };
}

export function getNetVerifiedRevenueAmount(input: SettlementInput): number {
  return getVerifiedDpAmount(input) + getVerifiedFinalPaymentAmount(input) - getDpRefundAmount(input);
}

export function getTotalPaidAmount(input: SettlementInput): number {
  return (input.dp_paid || 0) + getVerifiedFinalPaymentAmount(input);
}

export function getRemainingFinalPayment(input: SettlementInput): number {
  if (input.is_fully_paid) return 0;

  const remaining = getFinalInvoiceTotal(input.total_price || 0, input.final_adjustments) - getTotalPaidAmount(input);
  return remaining > 0 ? remaining : 0;
}

export function getSettlementStatus(value: unknown): SettlementStatus {
  if (value === "sent" || value === "submitted" || value === "paid") return value;
  return "draft";
}

export function hasFinalInvoice(value: SettlementInput): boolean {
  return (
    getSettlementStatus(value.settlement_status) !== "draft" ||
    normalizeFinalAdjustments(value.final_adjustments).length > 0 ||
    (value.final_payment_amount || 0) > 0
  );
}

export function getInvoiceStage(value: SettlementInput): "initial" | "final" {
  return hasFinalInvoice(value) ? "final" : "initial";
}

export function getSettlementLabel(status: SettlementStatus): string {
  switch (status) {
    case "sent":
      return "Invoice final dikirim";
    case "submitted":
      return "Menunggu verifikasi";
    case "paid":
      return "Lunas";
    default:
      return "Draft";
  }
}
