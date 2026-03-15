const BOOKING_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
} | null | undefined;

function randomInt(max: number): number {
  if (max <= 0) return 0;

  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint32Array(1);
    cryptoObj.getRandomValues(bytes);
    return bytes[0] % max;
  }

  return Math.floor(Math.random() * max);
}

function randomSuffix(length: number): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += BOOKING_CODE_ALPHABET[randomInt(BOOKING_CODE_ALPHABET.length)];
  }
  return result;
}

export function createBookingCode(date: Date = new Date()): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `INV-${dd}${mm}${yyyy}${randomSuffix(4)}`;
}

export function isDuplicateBookingCodeError(error: SupabaseErrorLike): boolean {
  if (!error) return false;

  const message = String(error.message || "").toLowerCase();
  if (message.includes("bookings_booking_code_key")) return true;

  return (
    message.includes("duplicate key") &&
    message.includes("booking_code")
  );
}
