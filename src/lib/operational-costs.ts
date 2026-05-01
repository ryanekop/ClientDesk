import { getNetVerifiedRevenueAmount } from "@/lib/final-settlement";

export type OperationalCost = {
  id: string;
  label: string;
  amount: number;
  created_at: string;
};

export type OperationalCostTemplateItem = {
  id: string;
  label: string;
  amount: number;
};

export type OperationalCostTemplate = {
  id: string;
  name: string;
  items: OperationalCostTemplateItem[];
  created_at: string;
  updated_at: string;
};

export type OperationalCostPricelistItem = {
  id: string;
  label: string;
  amount: number;
};

export type DefaultOperationalCostItem = {
  id: string;
  label: string;
  amount: number;
};

export type FixedOperationalCost = {
  id: string;
  label: string;
  amount: number;
  frequency: "monthly" | "yearly";
  starts_on: string;
  ends_on: string | null;
  is_active: boolean;
};

type NetRevenueAfterOperationalCostsInput = Parameters<
  typeof getNetVerifiedRevenueAmount
>[0] & {
  operational_costs?: unknown;
};

function createOperationalCostId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}

function toNonNegativeMoney(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value === "string") {
    const digitsOnly = value.replace(/\D+/g, "");
    if (!digitsOnly) return 0;
    const parsed = Number(digitsOnly);
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
  }

  return 0;
}

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

export function normalizeOperationalCostTemplates(value: unknown): OperationalCostTemplate[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((template): template is Record<string, unknown> => !!template && typeof template === "object")
    .map((template, templateIndex) => {
      const now = new Date().toISOString();
      const rawItems = Array.isArray(template.items) ? template.items : [];
      const itemSeen = new Set<string>();
      const items = rawItems
        .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
        .map((item, itemIndex) => {
          const rawId =
            typeof item.id === "string" && item.id.trim().length > 0
              ? item.id.trim()
              : createOperationalCostId("cost_item");
          const id = itemSeen.has(rawId) ? `${rawId}_${itemIndex + 1}` : rawId;
          itemSeen.add(id);

          return {
            id,
            label:
              typeof item.label === "string" && item.label.trim().length > 0
                ? item.label.trim()
                : typeof item.name === "string" && item.name.trim().length > 0
                  ? item.name.trim()
                  : "",
            amount: toNonNegativeMoney(item.amount ?? item.price),
          };
        })
        .filter((item) => item.label.length > 0 && item.amount > 0);

      return {
        id:
          typeof template.id === "string" && template.id.trim().length > 0
            ? template.id.trim()
            : createOperationalCostId("cost_template"),
        name:
          typeof template.name === "string" && template.name.trim().length > 0
            ? template.name.trim()
            : `Template ${templateIndex + 1}`,
        items,
        created_at:
          typeof template.created_at === "string" && template.created_at.trim().length > 0
            ? template.created_at
            : now,
        updated_at:
          typeof template.updated_at === "string" && template.updated_at.trim().length > 0
            ? template.updated_at
            : now,
      };
    })
    .filter((template) => template.name.length > 0);
}

export function normalizeOperationalCostPricelistItems(value: unknown): OperationalCostPricelistItem[] {
  if (!value || typeof value !== "object") return [];

  const typed = value as { items?: unknown[]; columns?: unknown[] };
  const firstColumnId =
    Array.isArray(typed.columns) &&
    typed.columns.length > 0 &&
    typed.columns[0] &&
    typeof typed.columns[0] === "object" &&
    typeof (typed.columns[0] as { id?: unknown }).id === "string"
      ? String((typed.columns[0] as { id: string }).id).trim()
      : "";
  const rawItems = Array.isArray(typed.items) ? typed.items : [];
  const seen = new Set<string>();

  return rawItems
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item, index) => {
      const rawPrices =
        item.prices && typeof item.prices === "object"
          ? (item.prices as Record<string, unknown>)
          : {};
      const firstColumnPrice =
        firstColumnId && rawPrices[firstColumnId] !== undefined
          ? rawPrices[firstColumnId]
          : null;
      const rawId =
        typeof item.id === "string" && item.id.trim().length > 0
          ? item.id.trim()
          : createOperationalCostId("pricelist_item");
      const id = seen.has(rawId) ? `${rawId}_${index + 1}` : rawId;
      seen.add(id);

      return {
        id,
        label:
          typeof item.label === "string" && item.label.trim().length > 0
            ? item.label.trim()
            : typeof item.name === "string" && item.name.trim().length > 0
              ? item.name.trim()
              : "",
        amount: toNonNegativeMoney(item.amount ?? item.price ?? firstColumnPrice),
      };
    })
    .filter((item) => item.label.length > 0 && item.amount > 0);
}

export function normalizeDefaultOperationalCosts(value: unknown): DefaultOperationalCostItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();

  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item, index) => {
      const rawId =
        typeof item.id === "string" && item.id.trim().length > 0
          ? item.id.trim()
          : createOperationalCostId("default_cost");
      const id = seen.has(rawId) ? `${rawId}_${index + 1}` : rawId;
      seen.add(id);

      return {
        id,
        label:
          typeof item.label === "string" && item.label.trim().length > 0
            ? item.label.trim()
            : typeof item.name === "string" && item.name.trim().length > 0
              ? item.name.trim()
              : "",
        amount: toNonNegativeMoney(item.amount ?? item.price),
      };
    })
    .filter((item) => item.label.length > 0 && item.amount > 0);
}

function normalizeDateString(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : "";
}

export function normalizeFixedOperationalCosts(value: unknown): FixedOperationalCost[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const today = new Date().toISOString().slice(0, 10);

  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item, index) => {
      const rawId =
        typeof item.id === "string" && item.id.trim().length > 0
          ? item.id.trim()
          : createOperationalCostId("fixed_cost");
      const id = seen.has(rawId) ? `${rawId}_${index + 1}` : rawId;
      seen.add(id);
      const frequency: FixedOperationalCost["frequency"] =
        item.frequency === "yearly" ? "yearly" : "monthly";
      const startsOn = normalizeDateString(item.starts_on ?? item.start_date) || today;
      const endsOn = normalizeDateString(item.ends_on ?? item.end_date) || null;

      return {
        id,
        label:
          typeof item.label === "string" && item.label.trim().length > 0
            ? item.label.trim()
            : typeof item.name === "string" && item.name.trim().length > 0
              ? item.name.trim()
              : "",
        amount: toNonNegativeMoney(item.amount ?? item.price),
        frequency,
        starts_on: startsOn,
        ends_on: endsOn && endsOn >= startsOn ? endsOn : null,
        is_active: item.is_active !== false,
      };
    })
    .filter((item) => item.label.length > 0 && item.amount > 0);
}

export function buildOperationalCostFromTemplateItem(
  item: Pick<OperationalCostTemplateItem, "label" | "amount">,
  options?: { labelPrefix?: string },
): OperationalCost {
  const labelPrefix = options?.labelPrefix?.trim();
  return {
    id: crypto.randomUUID(),
    label: labelPrefix ? `${labelPrefix} - ${item.label}` : item.label,
    amount: item.amount,
    created_at: new Date().toISOString(),
  };
}

export function buildOperationalCostFromDefaultItem(
  item: Pick<DefaultOperationalCostItem, "label" | "amount">,
  options?: { labelPrefix?: string; quantity?: number },
): OperationalCost {
  const quantity = Math.max(Math.floor(options?.quantity || 1), 1);
  return buildOperationalCostFromTemplateItem(
    {
      label: item.label,
      amount: item.amount * quantity,
    },
    options?.labelPrefix ? { labelPrefix: options.labelPrefix } : undefined,
  );
}

export function getOperationalCostDedupeKey(item: Pick<OperationalCost, "label" | "amount">) {
  return `${item.label.trim().toLowerCase()}::${Math.max(Number(item.amount) || 0, 0)}`;
}

export function appendUniqueOperationalCosts(
  currentItems: OperationalCost[],
  nextItems: OperationalCost[],
) {
  const seen = new Set(currentItems.map(getOperationalCostDedupeKey));
  const appended: OperationalCost[] = [];

  nextItems.forEach((item) => {
    const key = getOperationalCostDedupeKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    appended.push(item);
  });

  return [...currentItems, ...appended];
}

export function getOperationalCostsTotal(value: unknown): number {
  return normalizeOperationalCosts(value).reduce((sum, item) => sum + item.amount, 0);
}

export function getNetRevenueAfterOperationalCosts(
  input: NetRevenueAfterOperationalCostsInput,
): number {
  return getNetVerifiedRevenueAmount(input) - getOperationalCostsTotal(input.operational_costs);
}
