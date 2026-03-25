import type { NextRequest } from "next/server";
import { resolveApiLocale, type AppLocale } from "@/lib/i18n/api-locale";

type ApiErrorTemplateMap = Record<string, string>;

const API_ERROR_MESSAGES: Record<AppLocale, ApiErrorTemplateMap> = {
  id: {
    unauthorized: "Tidak terautentikasi.",
    bookingNotFound: "Booking tidak ditemukan.",
    invalidProofStage: "Stage bukti pembayaran tidak valid.",
    paymentProofRequired: "File bukti pembayaran wajib diupload.",
    maxFile5mb: "Ukuran file maksimal 5MB.",
    unsupportedProofFormat: "Format file tidak didukung. Gunakan JPG, PNG, atau PDF.",
    failedLoadBooking: "Gagal memuat booking.",
    failedLoadProfile: "Gagal memuat profil.",
    paymentProofDisabled: "Fitur bukti pembayaran sedang dinonaktifkan.",
    driveNotConnected: "Google Drive admin belum terhubung.",
    failedSavePaymentProof: "Gagal menyimpan bukti pembayaran.",
    failedUploadPaymentProof: "Gagal upload bukti pembayaran.",
    failedSaveProfile: "Gagal menyimpan profil.",
    invalidAssetType: "assetType tidak valid.",
    fileNotFound: "File tidak ditemukan.",
    invalidImageMimePngJpgWebp: "File harus berupa PNG, JPG, atau WEBP.",
    invoiceLogoPngJpgOnly: "Logo invoice gunakan PNG atau JPG.",
    invoiceLogoTooLarge: "Ukuran logo melebihi 500KB.",
    avatarTooLarge: "Ukuran avatar melebihi 1MB.",
    uploadFailed: "Upload gagal.",
    missingRequiredData: "Data tidak lengkap.",
    failedCreateFolder: "Gagal membuat folder.",
    folderNameRequired: "Nama folder wajib diisi.",
    fileIdRequired: "File ID wajib diisi.",
    failedDeleteFile: "Gagal menghapus file.",
    failedUploadFile: "Gagal upload file.",
    failedLoadFolder: "Gagal memuat folder.",
    qrisFileNotFound: "File QRIS tidak ditemukan.",
    qrisImageOnly: "File QRIS harus berupa gambar.",
    failedDeleteQris: "Terjadi kesalahan saat menghapus QRIS.",
    invalidXlsxFormat: "Format file harus .xlsx.",
    xlsxRequired: "File .xlsx wajib diupload.",
    failedLoadImportContext: "Gagal memuat context import.",
    failedBuildImportTemplate: "Gagal membuat template import.",
    failedValidateImport: "Gagal memvalidasi file import.",
    failedCommitImport: "Gagal melakukan commit import.",
    commitCancelledValidation: "File masih mengandung error validasi. Commit dibatalkan.",
    importCancelledRuntime: "Import dibatalkan: {reason}",
    failedSaveBooking: "Gagal menyimpan booking.",
    failedSaveBookingServices: "Gagal menyimpan relasi layanan booking.",
    failedSaveFreelanceAssignments: "Gagal menyimpan assignment freelance.",
    failedLoadCalendarProfile: "Gagal memuat profil Google Calendar. Silakan coba lagi.",
    incompleteCalendarConnection:
      "Koneksi Google Calendar belum lengkap. Silakan hubungkan ulang di Pengaturan.",
    failedLoadFreelanceAssignments:
      "Gagal memuat assignment freelancer untuk sinkronisasi kalender.",
    bookingIdRequired: "bookingId wajib diisi.",
    noEventsToSync: "Tidak ada event untuk disinkronkan.",
    calendarNotConnected: "Google Calendar belum terhubung.",
    emailParameterRequired: "Parameter email wajib diisi.",
    untitled: "(Tanpa Judul)",
    freelancerCalendarNotFound:
      "Kalender freelancer tidak ditemukan. Pastikan freelancer sudah share kalendernya ke email Anda.",
    scopeRequired: "scope wajib diisi.",
    bookingCodeOrTrackingRequired: "bookingCode atau trackingUuid wajib diisi.",
    unsupportedScope: "scope tidak didukung.",
    universityNameMin2: "Nama universitas minimal 2 karakter.",
    universityNameTooLong: "Nama universitas terlalu panjang.",
    failedCreateUniversity: "Gagal menambah universitas.",
    failedSendCalendarInvite: "Gagal mengirim undangan kalender.",
    failedDeleteFastpikProject: "Gagal menghapus project Fastpik.",
    failedSyncFastpikBooking: "Gagal sinkron booking ke Fastpik.",
    failedBatchSyncFastpik: "Gagal batch sync ke Fastpik.",
    failedFastpikConnectionTest: "Gagal menguji koneksi Fastpik.",
    failedFetchFastpikBooking: "Gagal mengambil data Fastpik terbaru untuk booking.",
  },
  en: {
    unauthorized: "Not authenticated.",
    bookingNotFound: "Booking not found.",
    invalidProofStage: "Invalid payment proof stage.",
    paymentProofRequired: "Payment proof file is required.",
    maxFile5mb: "Maximum file size is 5MB.",
    unsupportedProofFormat: "Unsupported file format. Use JPG, PNG, or PDF.",
    failedLoadBooking: "Failed to load booking.",
    failedLoadProfile: "Failed to load profile.",
    paymentProofDisabled: "Payment proof feature is currently disabled.",
    driveNotConnected: "Admin Google Drive is not connected.",
    failedSavePaymentProof: "Failed to save payment proof.",
    failedUploadPaymentProof: "Failed to upload payment proof.",
    failedSaveProfile: "Failed to save profile.",
    invalidAssetType: "Invalid assetType.",
    fileNotFound: "File not found.",
    invalidImageMimePngJpgWebp: "File must be PNG, JPG, or WEBP.",
    invoiceLogoPngJpgOnly: "Invoice logo must be PNG or JPG.",
    invoiceLogoTooLarge: "Logo size exceeds 500KB.",
    avatarTooLarge: "Avatar size exceeds 1MB.",
    uploadFailed: "Upload failed.",
    missingRequiredData: "Incomplete request data.",
    failedCreateFolder: "Failed to create folder.",
    folderNameRequired: "Folder name is required.",
    fileIdRequired: "File ID is required.",
    failedDeleteFile: "Failed to delete file.",
    failedUploadFile: "Failed to upload file.",
    failedLoadFolder: "Failed to load folder.",
    qrisFileNotFound: "QRIS file not found.",
    qrisImageOnly: "QRIS file must be an image.",
    failedDeleteQris: "An error occurred while deleting QRIS.",
    invalidXlsxFormat: "File format must be .xlsx.",
    xlsxRequired: "An .xlsx file is required.",
    failedLoadImportContext: "Failed to load import context.",
    failedBuildImportTemplate: "Failed to build import template.",
    failedValidateImport: "Failed to validate import file.",
    failedCommitImport: "Failed to commit import.",
    commitCancelledValidation:
      "File still contains validation errors. Commit cancelled.",
    importCancelledRuntime: "Import cancelled: {reason}",
    failedSaveBooking: "Failed to save booking.",
    failedSaveBookingServices: "Failed to save booking service relations.",
    failedSaveFreelanceAssignments: "Failed to save freelance assignments.",
    failedLoadCalendarProfile: "Failed to load Google Calendar profile. Please try again.",
    incompleteCalendarConnection:
      "Google Calendar connection is incomplete. Please reconnect it in Settings.",
    failedLoadFreelanceAssignments:
      "Failed to load freelance assignments for calendar sync.",
    bookingIdRequired: "bookingId is required.",
    noEventsToSync: "No events to sync.",
    calendarNotConnected: "Google Calendar is not connected.",
    emailParameterRequired: "Email parameter is required.",
    untitled: "(Untitled)",
    freelancerCalendarNotFound:
      "Freelancer calendar not found. Ensure the freelancer has shared their calendar with your email.",
    scopeRequired: "scope is required.",
    bookingCodeOrTrackingRequired: "bookingCode or trackingUuid is required.",
    unsupportedScope: "scope is not supported.",
    universityNameMin2: "University name must be at least 2 characters.",
    universityNameTooLong: "University name is too long.",
    failedCreateUniversity: "Failed to create university reference.",
    failedSendCalendarInvite: "Failed to send calendar invite.",
    failedDeleteFastpikProject: "Failed to delete Fastpik project.",
    failedSyncFastpikBooking: "Failed to sync booking to Fastpik.",
    failedBatchSyncFastpik: "Failed to run Fastpik batch sync.",
    failedFastpikConnectionTest: "Failed to test Fastpik connection.",
    failedFetchFastpikBooking: "Failed to fetch latest Fastpik data for booking.",
  },
};

function formatTemplate(template: string, params?: Record<string, string | number>) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

export function apiT(
  locale: AppLocale,
  key: keyof (typeof API_ERROR_MESSAGES)["id"],
  params?: Record<string, string | number>,
) {
  const template = API_ERROR_MESSAGES[locale][key] || API_ERROR_MESSAGES.id[key];
  return formatTemplate(template, params);
}

export function apiText(
  request: NextRequest,
  key: keyof (typeof API_ERROR_MESSAGES)["id"],
  params?: Record<string, string | number>,
) {
  const locale = resolveApiLocale(request);
  return apiT(locale, key, params);
}
