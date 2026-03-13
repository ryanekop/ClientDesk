export type FinalAdjustment = {
  id: string;
  label: string;
  amount: number;
  reason: string;
  created_at: string;
};

export type SettlementStatus = "draft" | "sent" | "submitted" | "paid";

type SettlementInput = {
  total_price: number;
  dp_paid: number;
  final_adjustments?: unknown;
  final_payment_amount?: number | null;
  final_paid_at?: string | null;
  settlement_status?: string | null;
  is_fully_paid?: boolean | null;
};

export function normalizeFinalAdjustments(value: unknown): FinalAdjustment[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      id: typeof item.id === "string" && item.id.trim() ? item.id : crypto.randomUUID(),
      label: typeof item.label === "string" ? item.label.trim() : "",
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
