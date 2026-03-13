export const PAYMENT_METHODS = ["bank", "qris", "cash"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type BankAccount = {
  id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  enabled: boolean;
};

export type PaymentSource =
  | {
      type: "bank";
      bank_id: string;
      bank_name: string;
      account_number: string;
      account_name: string;
      label: string;
    }
  | {
      type: "qris" | "cash";
      label: string;
    };

export function createBankAccountId() {
  return `bank_${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyBankAccount(): BankAccount {
  return {
    id: createBankAccountId(),
    bank_name: "",
    account_number: "",
    account_name: "",
    enabled: true,
  };
}

export function normalizePaymentMethods(value: unknown): PaymentMethod[] {
  if (!Array.isArray(value)) return ["bank"];

  const next = value.filter(
    (item): item is PaymentMethod =>
      typeof item === "string" &&
      PAYMENT_METHODS.includes(item as PaymentMethod),
  );

  return next.length > 0 ? next : ["bank"];
}

export function normalizeBankAccounts(value: unknown): BankAccount[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === "object",
    )
    .map((item) => ({
      id:
        typeof item.id === "string" && item.id.length > 0
          ? item.id
          : createBankAccountId(),
      bank_name: typeof item.bank_name === "string" ? item.bank_name : "",
      account_number:
        typeof item.account_number === "string" ? item.account_number : "",
      account_name:
        typeof item.account_name === "string" ? item.account_name : "",
      enabled: typeof item.enabled === "boolean" ? item.enabled : true,
    }));
}

export function getValidBankAccounts(bankAccounts: BankAccount[]): BankAccount[] {
  return bankAccounts.filter(
    (bank) => bank.bank_name.trim() && bank.account_number.trim(),
  );
}

export function getEnabledBankAccounts(
  bankAccounts: BankAccount[],
): BankAccount[] {
  return getValidBankAccounts(bankAccounts).filter((bank) => bank.enabled);
}

export function getPaymentMethodLabel(method: PaymentMethod) {
  switch (method) {
    case "bank":
      return "Transfer Bank";
    case "qris":
      return "QRIS";
    case "cash":
      return "Cash";
    default:
      return method;
  }
}

export function createPaymentSourceFromBank(bank: BankAccount): PaymentSource {
  return {
    type: "bank",
    bank_id: bank.id,
    bank_name: bank.bank_name,
    account_number: bank.account_number,
    account_name: bank.account_name,
    label: bank.bank_name,
  };
}
