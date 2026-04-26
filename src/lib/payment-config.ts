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

export function normalizeInvoicePaymentBankAccountIds(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  value.forEach((item) => {
    if (typeof item !== "string") return;
    const id = item.trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    normalized.push(id);
  });

  return normalized;
}

export function getInvoicePaymentBankAccounts(
  bankAccounts: BankAccount[],
  selectedIds: string[],
): BankAccount[] {
  const selected = new Set(normalizeInvoicePaymentBankAccountIds(selectedIds));
  if (selected.size === 0) return [];

  return getValidBankAccounts(bankAccounts).filter((bank) => selected.has(bank.id));
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

export function getPaymentSourceLabel(source: unknown) {
  if (!source || typeof source !== "object") return "";

  const record = source as Record<string, unknown>;
  const label = record.label;
  if (typeof label === "string" && label.trim()) return label.trim();

  const bankName = record.bank_name;
  if (typeof bankName === "string" && bankName.trim()) return bankName.trim();

  const type = record.type;
  return typeof type === "string" ? type : "";
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

export function buildDriveImageUrl(fileId: string) {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`;
}

type PublicQrisImageOptions = {
  vendorSlug?: string | null;
  trackingUuid?: string | null;
};

export function isLegacyDriveImageUrl(url: string | null | undefined) {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    const pathAndQuery = `${parsed.pathname}${parsed.search}`.toLowerCase();

    if (host.endsWith("googleusercontent.com")) {
      // Drive thumbnailLink API often returns low-res variants (=s220, =s400, etc).
      // Treat these as legacy so we can refresh to the HD URL at runtime.
      return /=s\d+/i.test(pathAndQuery);
    }

    if (!host.endsWith("drive.google.com")) return false;
    if (path === "/uc") return true;

    if (path === "/thumbnail") {
      return !parsed.searchParams.get("resourcekey");
    }

    return false;
  } catch {
    return /https:\/\/(drive\.google\.com\/(thumbnail\?|uc\?)|lh3\.googleusercontent\.com\/.*=s\d+)/i.test(
      url,
    );
  }
}

export function buildPublicQrisImageUrl(options: PublicQrisImageOptions) {
  const params = new URLSearchParams();

  if (options.vendorSlug?.trim()) {
    params.set("vendorSlug", options.vendorSlug.trim());
  }

  if (options.trackingUuid?.trim()) {
    params.set("trackingUuid", options.trackingUuid.trim());
  }

  const query = params.toString();
  return query ? `/api/public/qris?${query}` : null;
}

export function resolveDriveImageUrl(
  imageUrl: string | null | undefined,
  fileId: string | null | undefined,
  options: PublicQrisImageOptions = {},
) {
  const normalizedImageUrl = imageUrl?.trim() || null;
  const normalizedFileId = fileId?.trim() || null;
  const redirectUrl = normalizedFileId
    ? buildPublicQrisImageUrl(options)
    : null;

  if (normalizedImageUrl && !isLegacyDriveImageUrl(normalizedImageUrl)) {
    return normalizedImageUrl;
  }

  if (redirectUrl) {
    return redirectUrl;
  }

  if (normalizedImageUrl) {
    return normalizedImageUrl;
  }

  if (normalizedFileId) {
    return buildDriveImageUrl(normalizedFileId);
  }

  return null;
}
