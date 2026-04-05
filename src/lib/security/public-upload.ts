export const MAX_GOOGLE_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_PUBLIC_UPLOAD_BYTES = MAX_GOOGLE_UPLOAD_BYTES;

export const ALLOWED_PUBLIC_UPLOAD_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);

export function isGoogleUploadFileTooLarge(file: Pick<File, "size">) {
  return file.size > MAX_GOOGLE_UPLOAD_BYTES;
}

export function validatePublicPaymentProofFile(
  file: File,
  options?: {
    fileTooLargeMessage?: string;
    unsupportedTypeMessage?: string;
  },
) {
  if (isGoogleUploadFileTooLarge(file)) {
    return {
      valid: false as const,
      code: "FILE_TOO_LARGE" as const,
      status: 413,
      message: options?.fileTooLargeMessage || "Ukuran file maksimal 5MB.",
    };
  }

  const normalizedType = (file.type || "").toLowerCase();
  if (!ALLOWED_PUBLIC_UPLOAD_MIME_TYPES.has(normalizedType)) {
    return {
      valid: false as const,
      code: "UNSUPPORTED_FILE_TYPE" as const,
      status: 400,
      message:
        options?.unsupportedTypeMessage ||
        "Format file tidak didukung. Gunakan PNG, JPG, WEBP, atau PDF.",
    };
  }

  return {
    valid: true as const,
  };
}
