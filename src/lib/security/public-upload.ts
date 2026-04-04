export const MAX_PUBLIC_UPLOAD_BYTES = 5 * 1024 * 1024;

export const ALLOWED_PUBLIC_UPLOAD_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);

export function validatePublicPaymentProofFile(file: File) {
  if (file.size > MAX_PUBLIC_UPLOAD_BYTES) {
    return {
      valid: false as const,
      code: "FILE_TOO_LARGE" as const,
      status: 413,
      message: "Ukuran file maksimal 5MB.",
    };
  }

  const normalizedType = (file.type || "").toLowerCase();
  if (!ALLOWED_PUBLIC_UPLOAD_MIME_TYPES.has(normalizedType)) {
    return {
      valid: false as const,
      code: "UNSUPPORTED_FILE_TYPE" as const,
      status: 400,
      message: "Format file tidak didukung. Gunakan PNG, JPG, WEBP, atau PDF.",
    };
  }

  return {
    valid: true as const,
  };
}
