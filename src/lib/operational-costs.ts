import { getNetVerifiedRevenueAmount } from "@/lib/final-settlement";

export type OperationalCost = {
  id: string;
  label: string;
  amount: number;
  created_at: string;
};

type NetRevenueAfterOperationalCostsInput = Parameters<
  typeof getNetVerifiedRevenueAmount
>[0] & {
  operational_costs?: unknown;
};

export function normalizeOperationalCosts(value: unknown): OperationalCost[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      id:
        typeof item.id === "string" && item.id.trim().length > 0
          ? item.id
          : crypto.randomUUID(),
      label: typeof item.label === "string" ? item.label.trim() : "",
      amount:
        typeof item.amount === "number"
          ? item.amount
          : Math.max(Number(item.amount) || 0, 0),
      created_at:
        typeof item.created_at === "string" && item.created_at.trim().length > 0
          ? item.created_at
          : new Date().toISOString(),
    }))
    .filter((item) => item.label.length > 0 && item.amount > 0);
}

export function getOperationalCostsTotal(value: unknown): number {
  return normalizeOperationalCosts(value).reduce((sum, item) => sum + item.amount, 0);
}

export function getNetRevenueAfterOperationalCosts(
  input: NetRevenueAfterOperationalCostsInput,
): number {
  return getNetVerifiedRevenueAmount(input) - getOperationalCostsTotal(input.operational_costs);
}
