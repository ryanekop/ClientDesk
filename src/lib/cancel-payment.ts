export type CancelPaymentPolicy = "forfeit" | "refund";

type CancelPaymentPatchInput = {
  policy: CancelPaymentPolicy;
  refundAmount?: number | null;
  verifiedAmount?: number | null;
  nowIso?: string;
};

export function getSafeVerifiedAmount(value?: number | null): number {
  return Math.max(Number(value) || 0, 0);
}

export function clampRefundAmount(refundAmount: number | null | undefined, verifiedAmount: number | null | undefined): number {
  const safeVerified = getSafeVerifiedAmount(verifiedAmount);
  const safeRefund = Math.max(Number(refundAmount) || 0, 0);
  return Math.min(safeRefund, safeVerified);
}

export function buildCancelPaymentPatch({
  policy,
  refundAmount,
  verifiedAmount,
  nowIso,
}: CancelPaymentPatchInput): {
  dp_refund_amount: number;
  dp_refunded_at: string | null;
} {
  if (policy === "refund") {
    const safeRefund = clampRefundAmount(refundAmount, verifiedAmount);
    return {
      dp_refund_amount: safeRefund,
      dp_refunded_at: safeRefund > 0 ? nowIso || new Date().toISOString() : null,
    };
  }

  return {
    dp_refund_amount: 0,
    dp_refunded_at: null,
  };
}
