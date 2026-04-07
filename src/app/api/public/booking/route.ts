import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
    assertBookingWriteAccessForUser,
    BookingWriteAccessDeniedError,
} from "@/lib/booking-write-access.server";
import { syncBookingCalendarEvent } from "@/lib/google-calendar-booking";
import { hasBookingCalendarSessions } from "@/lib/booking-calendar-sessions";
import {
    getGoogleCalendarSyncErrorCode,
    getGoogleCalendarSyncErrorMessage,
    isNoScheduleSyncError,
    NO_SCHEDULE_SYNC_MESSAGE,
    updateBookingCalendarSyncState,
} from "@/lib/google-calendar-sync";
import {
    DEFAULT_CALENDAR_EVENT_FORMAT,
} from "@/utils/google/template";
import { hasOAuthTokenPair } from "@/utils/google/connection";
import {
    createPaymentSourceFromBank,
    getEnabledBankAccounts,
    normalizeBankAccounts,
    normalizePaymentMethods,
    type PaymentMethod,
    type PaymentSource,
} from "@/lib/payment-config";
import { uploadPaymentProofToDrive } from "@/lib/payment-proof-drive";
import { getInitialBookingStatus } from "@/lib/client-status";
import {
    getWhatsAppTemplateContent,
    resolveWhatsAppTemplateMode,
    type WhatsAppTemplate,
} from "@/lib/whatsapp-template";
import {
    createBookingCode,
    isDuplicateBookingCodeError,
} from "@/lib/booking-code";
import { normalizeCoordinate } from "@/utils/location";
import {
    isShowAllPackagesEventType,
    LEGACY_PUBLIC_CUSTOM_EVENT_TYPE,
    normalizeEventTypeName,
    normalizeEventTypeList,
    PUBLIC_CUSTOM_EVENT_TYPE,
} from "@/lib/event-type-config";
import {
    buildSpecialOfferSnapshot,
    computeSpecialOfferTotal,
    isBookingSpecialLinkAvailable,
    normalizeBookingSpecialLinkRule,
    normalizeSpecialOfferToken,
    normalizeUuidList,
    SPECIAL_LINK_EXPIRED_ERROR_CODE,
    type BookingSpecialLinkRule,
} from "@/lib/booking-special-offer";
import {
    buildUniversityDisplayName,
    cleanUniversityName,
    isUniversityEventType,
    UNIVERSITY_EXTRA_FIELD_KEY,
    UNIVERSITY_REFERENCE_EXTRA_KEY,
} from "@/lib/university-references";
import {
    resolveUniversityReferenceSelection,
    type UniversityReferenceLookupRow,
} from "@/lib/university-reference-resolver";
import { invalidatePublicCachesForBooking } from "@/lib/public-cache-invalidation";
import { resolveNormalizedLayoutFromStoredSections } from "@/lib/form-sections";
import {
    resolveBuiltInFieldRequired,
    type BuiltInFieldId,
    type BuiltInFieldItem,
    type FormLayoutMode,
} from "@/components/form-builder/booking-form-layout";
import { clearGoogleCalendarConnection } from "@/lib/google-calendar-reauth";
import { apiText } from "@/lib/i18n/api-errors";
import { resolveApiLocale } from "@/lib/i18n/api-locale";
import { resolvePublicOrigin } from "@/lib/auth/public-origin";
import { buildBookingDetailLink } from "@/lib/booking-detail-link";
import { normalizeCityCode } from "@/lib/city-references";
import { isCityScopedBookingEventType } from "@/lib/service-availability";
import { securityErrorResponse } from "@/lib/security/error-response";
import { validatePublicPaymentProofFile } from "@/lib/security/public-upload";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { validateExternalHttpsUrl } from "@/lib/security/url-validation";
import {
    mergeBookingServicePayloadItems,
    normalizeBookingServicePayloadItems,
    normalizeBookingServiceQuantity,
    toBookingServicesPayload,
    type BookingServicePayloadItem,
} from "@/lib/booking-services";

type VendorRecord = {
    id: string;
    vendor_slug?: string | null;
    studio_name?: string | null;
    whatsapp_number?: string | null;
    min_dp_percent?: number | null;
    min_dp_map?: Record<string, number | { mode?: string; value?: number }> | null;
    google_access_token?: string | null;
    google_refresh_token?: string | null;
    google_drive_access_token?: string | null;
    google_drive_refresh_token?: string | null;
    drive_folder_format?: string | null;
    drive_folder_format_map?: Record<string, string> | null;
    drive_folder_structure_map?: Record<string, string[] | string> | null;
    calendar_event_format?: string | null;
    calendar_event_format_map?: Record<string, string> | null;
    calendar_event_description_map?: Record<string, string> | null;
    form_payment_methods?: PaymentMethod[] | null;
    form_show_addons?: boolean | null;
    form_allow_multiple_packages?: boolean | null;
    form_allow_multiple_addons?: boolean | null;
    form_show_wedding_split?: boolean | null;
    form_show_wisuda_split?: boolean | null;
    form_show_proof?: boolean | null;
    qris_image_url?: string | null;
    qris_drive_file_id?: string | null;
    bank_accounts?: unknown[] | null;
    custom_client_statuses?: string[] | null;
    form_sections?: unknown[] | Record<string, unknown> | null;
};

type AvailableServiceRow = {
    event_types?: string[] | null;
};

type BookingRequestBody = {
    vendorId?: string | null;
    vendorSlug: string;
    vendorSlugPath?: string | null;
    clientName: string;
    clientWhatsapp: string;
    eventType: string | null;
    sessionDate: string;
    serviceSelections?: unknown;
    serviceIds?: string[] | null;
    serviceId: string;
    cityCode?: string | null;
    cityName?: string | null;
    dpPaid: number;
    location: string | null;
    locationLat?: number | string | null;
    locationLng?: number | string | null;
    locationDetail: string | null;
    notes: string | null;
    extraData: Record<string, unknown> | null;
    paymentProofUrl: string | null;
    paymentMethod: PaymentMethod | null;
    paymentSource: PaymentSource | null;
    instagram: string | null;
    offerToken?: string | null;
};

function isValidUuid(value: string | null | undefined) {
    if (!value) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function normalizeSlugCandidate(value: string | null | undefined) {
    if (!value) return "";
    const trimmed = value.trim();
    if (!trimmed) return "";
    const withoutQuery = trimmed.split("?")[0];
    const sanitized = withoutQuery.replace(/^\/+|\/+$/g, "");
    if (!sanitized) return "";
    const segments = sanitized.split("/").filter(Boolean);
    return segments[segments.length - 1] || "";
}

function extractSlugCandidates(
    vendorSlugRaw: string | null | undefined,
    refererRaw: string | null,
) {
    const candidates = new Set<string>();
    const direct = normalizeSlugCandidate(vendorSlugRaw);
    if (direct) candidates.add(direct);

    if (refererRaw) {
        try {
            const ref = new URL(refererRaw);
            const parts = ref.pathname.split("/").filter(Boolean);
            const formbookingIndex = parts.findIndex((part) => part === "formbooking");
            if (formbookingIndex >= 0 && parts[formbookingIndex + 1]) {
                candidates.add(parts[formbookingIndex + 1]);
            }
            const last = parts[parts.length - 1];
            if (last) candidates.add(last);
        } catch {
            const fallback = normalizeSlugCandidate(refererRaw);
            if (fallback) candidates.add(fallback);
        }
    }

    const final = Array.from(candidates)
        .map((value) => value.trim())
        .filter(Boolean);
    return final;
}

function normalizeStoredDateTime(value: unknown): string {
    if (typeof value !== "string") return "";
    const trimmed = value.trim();
    if (!trimmed) return "";
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return "";
    return trimmed;
}

function hasDateTimeTimePart(value: string | null | undefined) {
    if (!value) return false;
    const normalized = value.trim();
    if (!normalized) return false;
    const [, timePart = ""] = normalized.split("T");
    return timePart.trim().length > 0;
}

function normalizeStoredCoordinate(value: unknown): number | null {
    return normalizeCoordinate(value);
}

function extractMissingColumnFromSupabaseError(
    error: { message?: string; details?: string; hint?: string } | null,
) {
    const messages = [error?.message, error?.details, error?.hint].filter(
        (value): value is string => Boolean(value),
    );

    for (const message of messages) {
        const schemaCacheMatch = message.match(/Could not find the '([^']+)' column/i);
        if (schemaCacheMatch?.[1]) {
            return schemaCacheMatch[1];
        }

        const postgresMatch = message.match(
            /column\s+["']?(?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)["']?\s+does not exist/i,
        );
        if (postgresMatch?.[1]) {
            return postgresMatch[1];
        }
    }

    return null;
}

function extractNestedErrorMessage(value: unknown): string | null {
    if (!value || typeof value !== "object") return null;

    const record = value as Record<string, unknown>;
    const directMessage = record.message;
    if (typeof directMessage === "string" && directMessage.trim()) {
        return directMessage.trim();
    }

    return (
        extractNestedErrorMessage(record.error) ||
        extractNestedErrorMessage(record.response) ||
        extractNestedErrorMessage(record.data)
    );
}

function getUnknownErrorMessage(error: unknown): string | null {
    if (error instanceof Error && error.message.trim()) {
        return error.message.trim();
    }

    return extractNestedErrorMessage(error);
}

function hasGoogleDriveErrorContext(error: unknown) {
    const parts: string[] = [];
    const rawMessage = getUnknownErrorMessage(error);
    if (rawMessage) parts.push(rawMessage);

    if (error && typeof error === "object") {
        const record = error as Record<string, unknown>;
        const config =
            record.config && typeof record.config === "object"
                ? (record.config as Record<string, unknown>)
                : null;
        const response =
            record.response && typeof record.response === "object"
                ? (record.response as Record<string, unknown>)
                : null;
        const responseConfig =
            response?.config && typeof response.config === "object"
                ? (response.config as Record<string, unknown>)
                : null;
        const urls = [
            config?.url,
            responseConfig?.url,
        ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
        parts.push(...urls);
    }

    if (error instanceof Error && typeof error.stack === "string") {
        parts.push(error.stack);
    }

    const combined = parts.join(" ").toLowerCase();
    return (
        combined.includes("googleapis.com/drive") ||
        combined.includes("google drive") ||
        combined.includes("google/drive")
    );
}

function getPublicBookingProcessingErrorMessage(error: unknown) {
    const rawMessage = getUnknownErrorMessage(error);

    if (hasGoogleDriveErrorContext(error)) {
        return "Terjadi kendala saat mengunggah bukti pembayaran. Silakan coba lagi beberapa saat atau hubungi admin.";
    }

    return rawMessage || "Terjadi kesalahan saat memproses booking.";
}

const VENDOR_SELECT_COLUMNS = [
    "id",
    "vendor_slug",
    "studio_name",
    "whatsapp_number",
    "min_dp_percent",
    "min_dp_map",
    "google_access_token",
    "google_refresh_token",
    "google_drive_access_token",
    "google_drive_refresh_token",
    "drive_folder_format",
    "drive_folder_format_map",
    "drive_folder_structure_map",
    "calendar_event_format",
    "calendar_event_format_map",
    "calendar_event_description_map",
    "form_payment_methods",
    "form_show_addons",
    "form_allow_multiple_packages",
    "form_allow_multiple_addons",
    "form_show_wedding_split",
    "form_show_wisuda_split",
    "form_show_proof",
    "qris_image_url",
    "qris_drive_file_id",
    "bank_accounts",
    "custom_client_statuses",
    "form_sections",
] as const;

function resolveBuiltInFieldStateFromStoredSections(
    rawFormSections: VendorRecord["form_sections"],
    eventType: string | null | undefined,
    options: { layoutMode?: FormLayoutMode } = {},
) {
    const visibleBuiltInFieldIds = new Set<BuiltInFieldId>();
    const requiredBuiltInFieldIds = new Set<BuiltInFieldId>();

    resolveNormalizedLayoutFromStoredSections(
        rawFormSections ?? null,
        eventType || "Umum",
        options,
    )
        .filter(
            (item): item is BuiltInFieldItem =>
                item.kind === "builtin_field" && item.hidden !== true,
        )
        .forEach((item) => {
            visibleBuiltInFieldIds.add(item.builtinId);
            if (resolveBuiltInFieldRequired(item)) {
                requiredBuiltInFieldIds.add(item.builtinId);
            }
        });

    return {
        visibleBuiltInFieldIds,
        requiredBuiltInFieldIds,
    };
}

async function fetchVendorByField(
    field: "id" | "vendor_slug",
    value: string,
): Promise<VendorRecord | null> {
    let selectColumns = [...VENDOR_SELECT_COLUMNS];

    while (selectColumns.length > 0) {
        const { data, error } = await supabaseAdmin
            .from("profiles")
            .select(selectColumns.join(", "))
            .eq(field, value)
            .maybeSingle();

        if (!error) {
            return (data as VendorRecord | null) || null;
        }

        const missingColumn = extractMissingColumnFromSupabaseError(error);
        if (missingColumn && selectColumns.includes(missingColumn as (typeof VENDOR_SELECT_COLUMNS)[number])) {
            selectColumns = selectColumns.filter((column) => column !== missingColumn);
            continue;
        }

        return null;
    }

    return null;
}

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

class PublicBookingProcessingError extends Error {
    alreadyLogged: boolean;

    constructor(message: string, options?: { alreadyLogged?: boolean }) {
        super(message);
        this.name = "PublicBookingProcessingError";
        this.alreadyLogged = options?.alreadyLogged ?? false;
    }
}

export async function POST(request: NextRequest) {
    const rateLimitedResponse = enforceRateLimit({
        request,
        namespace: "public-post-booking",
        maxRequests: 10,
        windowMs: 10 * 60 * 1000,
    });
    if (rateLimitedResponse) {
        return rateLimitedResponse;
    }

    try {
        const locale = resolveApiLocale(request);
        const publicOrigin = resolvePublicOrigin(request);
        const contentType = request.headers.get("content-type") || "";
        let body: BookingRequestBody;
        let paymentProofFile: File | null = null;

        if (contentType.includes("multipart/form-data")) {
            const formData = await request.formData();
            body = {
                vendorId: formData.get("vendorId") ? String(formData.get("vendorId")) : null,
                vendorSlug: String(formData.get("vendorSlug") || ""),
                vendorSlugPath: formData.get("vendorSlugPath") ? String(formData.get("vendorSlugPath")) : null,
                clientName: String(formData.get("clientName") || ""),
                clientWhatsapp: String(formData.get("clientWhatsapp") || ""),
                eventType: formData.get("eventType") ? String(formData.get("eventType")) : null,
                sessionDate: String(formData.get("sessionDate") || ""),
                serviceSelections: formData.get("serviceSelections")
                    ? JSON.parse(String(formData.get("serviceSelections")))
                    : null,
                serviceIds: formData.get("serviceIds")
                    ? JSON.parse(String(formData.get("serviceIds")))
                    : null,
                serviceId: String(formData.get("serviceId") || ""),
                cityCode: formData.get("cityCode")
                    ? String(formData.get("cityCode"))
                    : null,
                cityName: formData.get("cityName")
                    ? String(formData.get("cityName"))
                    : null,
                dpPaid: Number(formData.get("dpPaid") || 0),
                location: formData.get("location") ? String(formData.get("location")) : null,
                locationLat: formData.get("locationLat")
                    ? String(formData.get("locationLat"))
                    : null,
                locationLng: formData.get("locationLng")
                    ? String(formData.get("locationLng"))
                    : null,
                locationDetail: formData.get("locationDetail") ? String(formData.get("locationDetail")) : null,
                notes: formData.get("notes") ? String(formData.get("notes")) : null,
                extraData: formData.get("extraData")
                    ? JSON.parse(String(formData.get("extraData")))
                    : null,
                paymentProofUrl: formData.get("paymentProofUrl")
                    ? String(formData.get("paymentProofUrl"))
                    : null,
                paymentMethod: formData.get("paymentMethod")
                    ? (String(formData.get("paymentMethod")) as PaymentMethod)
                    : null,
                paymentSource: formData.get("paymentSource")
                    ? (JSON.parse(String(formData.get("paymentSource"))) as PaymentSource)
                    : null,
                instagram: formData.get("instagram") ? String(formData.get("instagram")) : null,
                offerToken: formData.get("offerToken")
                    ? String(formData.get("offerToken"))
                    : null,
            };
            const nextFile = formData.get("paymentProofFile");
            paymentProofFile = nextFile instanceof File && nextFile.size > 0 ? nextFile : null;
        } else {
            body = await request.json();
        }

        const {
            vendorId,
            vendorSlug,
            vendorSlugPath,
            clientName,
            clientWhatsapp,
            eventType,
            sessionDate,
            serviceSelections,
            serviceIds,
            serviceId,
            cityCode,
            cityName,
            dpPaid,
            location,
            locationLat,
            locationLng,
            locationDetail,
            notes,
            extraData,
            paymentProofUrl,
            paymentMethod,
            paymentSource,
            instagram,
            offerToken,
        } = body;

        if (paymentProofFile) {
            const fileValidation = validatePublicPaymentProofFile(paymentProofFile, {
                fileTooLargeMessage: apiText(request, "maxFile5mb"),
            });
            if (!fileValidation.valid) {
                return securityErrorResponse({
                    message: fileValidation.message,
                    code: fileValidation.code,
                    status: fileValidation.status,
                });
            }
        }

        const paymentProofUrlValidation = validateExternalHttpsUrl(
            typeof paymentProofUrl === "string" ? paymentProofUrl : null,
            { allowEmpty: true, maxLength: 2048 },
        );
        if (!paymentProofUrlValidation.valid) {
            return securityErrorResponse({
                message: paymentProofUrlValidation.error || "URL bukti pembayaran tidak valid.",
                code: "INVALID_URL",
                status: 400,
            });
        }
        const normalizedPaymentProofInputUrl = paymentProofUrlValidation.normalizedUrl;

        const trimmedClientName = (clientName || "").trim();
        const normalizedClientName = trimmedClientName || "Klien";
        const normalizedClientWhatsapp = (clientWhatsapp || "").trim();
        const normalizedEventType = normalizeEventTypeName(eventType);
        const normalizedCityCode = normalizeCityCode(cityCode);
        let resolvedCityCode: string | null = null;
        let resolvedCityName: string | null = null;
        let resolvedEventType = normalizedEventType;
        const normalizedLocationLat = normalizeStoredCoordinate(locationLat);
        const normalizedLocationLng = normalizeStoredCoordinate(locationLng);
        const rawExtraData =
            typeof extraData === "object" && extraData !== null
                ? extraData as Record<string, unknown>
                : {};
        const directSessionDate = normalizeStoredDateTime(sessionDate);
        const weddingAkadDate = normalizeStoredDateTime(rawExtraData.tanggal_akad);
        const weddingResepsiDate = normalizeStoredDateTime(rawExtraData.tanggal_resepsi);
        const wisudaSession1Date = normalizeStoredDateTime(
            rawExtraData.tanggal_wisuda_1,
        );
        const wisudaSession2Date = normalizeStoredDateTime(
            rawExtraData.tanggal_wisuda_2,
        );
        const hasWisudaSession1Date = Boolean(wisudaSession1Date);
        const hasWisudaSession2Date = Boolean(wisudaSession2Date);
        const hasCompleteWisudaSplitDates =
            hasWisudaSession1Date && hasWisudaSession2Date;
        const wisudaSession1Location =
            typeof rawExtraData.tempat_wisuda_1 === "string"
                ? rawExtraData.tempat_wisuda_1.trim()
                : "";
        const wisudaSession2Location =
            typeof rawExtraData.tempat_wisuda_2 === "string"
                ? rawExtraData.tempat_wisuda_2.trim()
                : "";
        const hasWeddingSplitFieldPayload =
            Object.prototype.hasOwnProperty.call(rawExtraData, "tanggal_akad") ||
            Object.prototype.hasOwnProperty.call(rawExtraData, "tanggal_resepsi") ||
            Object.prototype.hasOwnProperty.call(rawExtraData, "tempat_akad") ||
            Object.prototype.hasOwnProperty.call(rawExtraData, "tempat_resepsi");
        const hasWisudaSplitFieldPayload =
            Object.prototype.hasOwnProperty.call(rawExtraData, "tanggal_wisuda_1") ||
            Object.prototype.hasOwnProperty.call(rawExtraData, "tanggal_wisuda_2") ||
            Object.prototype.hasOwnProperty.call(rawExtraData, "tempat_wisuda_1") ||
            Object.prototype.hasOwnProperty.call(rawExtraData, "tempat_wisuda_2");
        const splitSessionCandidates = [
            weddingAkadDate,
            weddingResepsiDate,
            wisudaSession1Date,
            wisudaSession2Date,
        ].filter(Boolean);
        const resolvedSessionDate =
            directSessionDate ||
            splitSessionCandidates
                .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ||
            "";

        let vendor: VendorRecord | null = null;
        const referer = request.headers.get("referer");
        const slugCandidates = Array.from(
            new Set([
                ...extractSlugCandidates(vendorSlug, referer),
                ...extractSlugCandidates(vendorSlugPath, referer),
            ]),
        );

        if (isValidUuid(vendorId || "")) {
            vendor = await fetchVendorByField("id", vendorId!);
        }

        for (const candidate of slugCandidates) {
            if (vendor) break;
            const normalized = candidate.trim();
            if (!normalized) continue;

            vendor = await fetchVendorByField("vendor_slug", normalized);

            if (!vendor) {
                const lower = normalized.toLowerCase();
                if (lower !== normalized) {
                    vendor = await fetchVendorByField("vendor_slug", lower);
                }
            }
        }

        if (!vendor) {
            return NextResponse.json({ success: false, error: "Vendor tidak ditemukan. Pastikan link form adalah link terbaru." }, { status: 404 });
        }

        await assertBookingWriteAccessForUser(vendor.id, { publicFacing: true });

        const normalizedOfferToken = normalizeSpecialOfferToken(offerToken);
        let specialOfferRule: BookingSpecialLinkRule | null = null;
        if (normalizedOfferToken) {
            const { data: specialOfferRow, error: specialOfferError } = await supabaseAdmin
                .from("booking_special_links")
                .select(
                    "id, token, user_id, name, event_type_locked, event_types, package_locked, package_service_ids, addon_locked, addon_service_ids, accommodation_fee, discount_amount, is_active, consumed_at, consumed_booking_id",
                )
                .eq("token", normalizedOfferToken)
                .eq("user_id", vendor.id)
                .maybeSingle();

            if (specialOfferError || !specialOfferRow) {
                return NextResponse.json(
                    {
                        success: false,
                        code: SPECIAL_LINK_EXPIRED_ERROR_CODE,
                        error: "Link booking khusus tidak valid atau sudah kedaluwarsa.",
                    },
                    { status: 400 },
                );
            }

            specialOfferRule = normalizeBookingSpecialLinkRule(specialOfferRow);
            if (!isBookingSpecialLinkAvailable(specialOfferRule)) {
                return NextResponse.json(
                    {
                        success: false,
                        code: SPECIAL_LINK_EXPIRED_ERROR_CODE,
                        error: "Link booking khusus tidak aktif atau sudah digunakan.",
                    },
                    { status: 400 },
                );
            }
        }

        if (specialOfferRule) {
            const allowedEventTypes = normalizeEventTypeList(
                specialOfferRule.eventTypes,
            );
            if (specialOfferRule.eventTypeLocked) {
                if (allowedEventTypes.length === 0) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: "Tipe acara untuk link booking khusus belum dikonfigurasi.",
                        },
                        { status: 400 },
                    );
                }
                if (
                    !resolvedEventType ||
                    !allowedEventTypes.includes(resolvedEventType)
                ) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: "Tipe acara tidak sesuai whitelist link booking khusus.",
                        },
                        { status: 400 },
                    );
                }
            } else if (!resolvedEventType && allowedEventTypes.length > 0) {
                resolvedEventType = allowedEventTypes[0];
            }
        }

        const isWeddingEventType =
            (resolvedEventType || "").toLowerCase() === "wedding";
        const isWisudaEventType = (resolvedEventType || "").toLowerCase() === "wisuda";
        const usesSplitLayoutMode =
            (isWeddingEventType &&
                (hasWeddingSplitFieldPayload ||
                    Boolean(weddingAkadDate) ||
                    Boolean(weddingResepsiDate))) ||
            (isWisudaEventType &&
                (hasWisudaSplitFieldPayload ||
                    Boolean(wisudaSession1Date) ||
                    Boolean(wisudaSession2Date)));
        const resolvedFormLayoutMode: FormLayoutMode = usesSplitLayoutMode
            ? "split"
            : "normal";

        const {
            visibleBuiltInFieldIds: normalizedLayoutBuiltInFieldIds,
            requiredBuiltInFieldIds,
        } = resolveBuiltInFieldStateFromStoredSections(
            vendor.form_sections ?? null,
            resolvedEventType || "Umum",
            { layoutMode: resolvedFormLayoutMode },
        );
        const shouldRequireEventType =
            requiredBuiltInFieldIds.has("event_type");
        const shouldRequireClientName =
            requiredBuiltInFieldIds.has("client_name");
        const shouldRequireClientWhatsapp =
            requiredBuiltInFieldIds.has("client_whatsapp");
        const shouldRequireServicePackage =
            requiredBuiltInFieldIds.has("service_package");
        const shouldRequireSessionDate =
            requiredBuiltInFieldIds.has("session_date") ||
            requiredBuiltInFieldIds.has("akad_date") ||
            requiredBuiltInFieldIds.has("resepsi_date") ||
            requiredBuiltInFieldIds.has("wisuda_session1_date") ||
            requiredBuiltInFieldIds.has("wisuda_session2_date");
        const shouldRequireSessionTime =
            requiredBuiltInFieldIds.has("session_time") ||
            requiredBuiltInFieldIds.has("akad_time") ||
            requiredBuiltInFieldIds.has("resepsi_time") ||
            requiredBuiltInFieldIds.has("wisuda_session1_time") ||
            requiredBuiltInFieldIds.has("wisuda_session2_time");
        const shouldRequireUniversitySelection =
            isUniversityEventType(resolvedEventType) &&
            normalizedLayoutBuiltInFieldIds.has(
                `extra:${UNIVERSITY_EXTRA_FIELD_KEY}`,
            );

        if (shouldRequireClientName && !trimmedClientName) {
            return NextResponse.json(
                { success: false, error: "Silakan isi nama klien terlebih dahulu." },
                { status: 400 },
            );
        }
        if (shouldRequireClientWhatsapp && !normalizedClientWhatsapp.trim()) {
            return NextResponse.json(
                { success: false, error: "Silakan isi nomor WhatsApp terlebih dahulu." },
                { status: 400 },
            );
        }

        if (shouldRequireEventType && !resolvedEventType) {
            return NextResponse.json(
                { success: false, error: "Silakan pilih tipe acara terlebih dahulu." },
                { status: 400 },
            );
        }
        const isCityScopedEventType = isCityScopedBookingEventType(resolvedEventType);
        if (isCityScopedEventType) {
            if (!normalizedCityCode) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "Kota/kabupaten wajib dipilih sebelum memilih paket.",
                    },
                    { status: 400 },
                );
            }

            const { data: cityReference, error: cityReferenceError } =
                await supabaseAdmin
                    .from("region_city_references")
                    .select("city_code, city_name")
                    .eq("city_code", normalizedCityCode)
                    .maybeSingle();
            if (cityReferenceError || !cityReference) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "Kota/kabupaten tidak valid. Silakan pilih ulang.",
                    },
                    { status: 400 },
                );
            }
            resolvedCityCode = normalizedCityCode;
            resolvedCityName = (cityName || "").trim() || cityReference.city_name;
        }

        const splitWeddingAllowed = vendor.form_show_wedding_split ?? true;
        const splitWisudaAllowed = vendor.form_show_wisuda_split ?? true;
        if (isWeddingEventType && !splitWeddingAllowed) {
            if (hasWeddingSplitFieldPayload || weddingAkadDate || weddingResepsiDate) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            "Vendor tidak menerima split sesi Wedding (Akad/Resepsi beda hari).",
                    },
                    { status: 400 },
                );
            }
        }
        if (isWisudaEventType && !splitWisudaAllowed) {
            if (
                hasWisudaSplitFieldPayload ||
                wisudaSession1Date ||
                wisudaSession2Date ||
                wisudaSession1Location ||
                wisudaSession2Location
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        error:
                            "Vendor tidak menerima split sesi Wisuda (Sesi 1/2).",
                    },
                    { status: 400 },
                );
            }
        }
        if (isWisudaEventType && hasWisudaSession1Date !== hasWisudaSession2Date) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "Untuk Wisuda split, tanggal Sesi 1 dan Sesi 2 harus diisi lengkap.",
                },
                { status: 400 },
            );
        }
        if (
            isWisudaEventType &&
            hasCompleteWisudaSplitDates &&
            (!wisudaSession1Location || !wisudaSession2Location)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "Lokasi Sesi 1 dan Lokasi Sesi 2 wajib diisi untuk Wisuda split.",
                },
                { status: 400 },
            );
        }

        if (shouldRequireSessionDate && !resolvedSessionDate) {
            return NextResponse.json(
                { success: false, error: "Silakan isi tanggal sesi terlebih dahulu." },
                { status: 400 },
            );
        }

        if (shouldRequireSessionTime && !hasDateTimeTimePart(resolvedSessionDate)) {
            return NextResponse.json(
                { success: false, error: "Silakan isi jam sesi terlebih dahulu." },
                { status: 400 },
            );
        }

        let resolvedUniversityReference: UniversityReferenceLookupRow | null = null;
        if (shouldRequireUniversitySelection) {
            const submittedUniversityName = cleanUniversityName(
                typeof rawExtraData[UNIVERSITY_EXTRA_FIELD_KEY] === "string"
                    ? rawExtraData[UNIVERSITY_EXTRA_FIELD_KEY]
                    : "",
            );
            const submittedUniversityRefId =
                typeof rawExtraData[UNIVERSITY_REFERENCE_EXTRA_KEY] === "string"
                    ? rawExtraData[UNIVERSITY_REFERENCE_EXTRA_KEY].trim()
                    : "";

            const universityResolution = await resolveUniversityReferenceSelection({
                submittedValue: submittedUniversityName,
                submittedReferenceId: submittedUniversityRefId,
            });

            if (
                universityResolution.status === "missing-input" ||
                universityResolution.status === "missing-reference"
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "Silakan pilih universitas dari suggestion yang tersedia.",
                    },
                    { status: 400 },
                );
            }

            if (
                universityResolution.status === "not-found" ||
                universityResolution.status === "ambiguous" ||
                universityResolution.status === "mismatch"
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "Universitas yang dipilih tidak valid.",
                    },
                    { status: 400 },
                );
            }

            resolvedUniversityReference = universityResolution.reference;
        }

        const availablePaymentMethods = normalizePaymentMethods(vendor.form_payment_methods);
        const enabledBankAccounts = getEnabledBankAccounts(normalizeBankAccounts(vendor.bank_accounts));
        const selectedPaymentMethod = paymentMethod as PaymentMethod | null;
        let normalizedPaymentSource: PaymentSource | null = null;

        if (!selectedPaymentMethod || !availablePaymentMethods.includes(selectedPaymentMethod)) {
            return NextResponse.json({ success: false, error: "Metode pembayaran tidak valid." }, { status: 400 });
        }

        if (selectedPaymentMethod === "bank") {
            const requestedBankId =
                paymentSource &&
                typeof paymentSource === "object" &&
                paymentSource.type === "bank" &&
                typeof paymentSource.bank_id === "string"
                    ? paymentSource.bank_id
                    : "";
            const matchedBank = enabledBankAccounts.find((bank) => bank.id === requestedBankId);
            if (!matchedBank) {
                return NextResponse.json({ success: false, error: "Rekening bank tidak valid." }, { status: 400 });
            }
            normalizedPaymentSource = createPaymentSourceFromBank(matchedBank);
        } else if (selectedPaymentMethod === "qris") {
            if (!vendor.qris_image_url && !vendor.qris_drive_file_id) {
                return NextResponse.json({ success: false, error: "QRIS tidak tersedia." }, { status: 400 });
            }
            normalizedPaymentSource = {
                type: "qris",
                label: "QRIS",
            };
        } else {
            normalizedPaymentSource = {
                type: "cash",
                label: "Cash",
            };
        }

        const proofEnabled = vendor.form_show_proof ?? true;
        const normalizedPaymentProofUrl =
            selectedPaymentMethod === "cash" || !proofEnabled
                ? null
                : normalizedPaymentProofInputUrl || null;

        if (
            proofEnabled &&
            selectedPaymentMethod !== "cash" &&
            !normalizedPaymentProofUrl &&
            !paymentProofFile
        ) {
            return NextResponse.json(
                { success: false, error: "Bukti pembayaran wajib diupload." },
                { status: 400 },
            );
        }

        if (
            proofEnabled &&
            selectedPaymentMethod !== "cash" &&
            paymentProofFile &&
            (!vendor.google_drive_access_token || !vendor.google_drive_refresh_token)
        ) {
            return NextResponse.json(
                { success: false, error: "Google Drive admin belum terhubung." },
                { status: 400 },
            );
        }

        const payloadServiceSelections = mergeBookingServicePayloadItems(
            normalizeBookingServicePayloadItems(serviceSelections),
        );
        const legacyMainServiceIds = Array.isArray(serviceIds)
            ? serviceIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
            : [];
        let mainServiceSelections: BookingServicePayloadItem[] =
            payloadServiceSelections.filter((selection) => selection.kind === "main");

        if (mainServiceSelections.length === 0) {
            const normalizedMainServiceIds = normalizeUuidList(
                legacyMainServiceIds.length > 0 ? legacyMainServiceIds : (serviceId ? [serviceId] : []),
            );
            mainServiceSelections = normalizedMainServiceIds.map((id) => ({
                serviceId: id,
                kind: "main" as const,
                quantity: 1,
            }));
        }

        if (specialOfferRule) {
            if (specialOfferRule.packageLocked) {
                mainServiceSelections = normalizeUuidList(
                    specialOfferRule.packageServiceIds,
                ).map((id) => ({
                    serviceId: id,
                    kind: "main" as const,
                    quantity: 1,
                }));
            } else if (
                mainServiceSelections.length === 0 &&
                specialOfferRule.packageServiceIds.length > 0
            ) {
                mainServiceSelections = normalizeUuidList(
                    specialOfferRule.packageServiceIds,
                ).map((id) => ({
                    serviceId: id,
                    kind: "main" as const,
                    quantity: 1,
                }));
            }
        }

        const allowMultiplePackages = vendor.form_allow_multiple_packages ?? true;
        if (
            !allowMultiplePackages &&
            !specialOfferRule?.packageLocked &&
            mainServiceSelections.length > 1
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Paket utama hanya bisa dipilih satu.",
                },
                { status: 400 },
            );
        }

        if (mainServiceSelections.length === 0 && shouldRequireServicePackage) {
            return NextResponse.json(
                { success: false, error: "Silakan pilih paket layanan terlebih dahulu." },
                { status: 400 },
            );
        }

        if (mainServiceSelections.length === 0) {
            const { data: availableMainServices } = await supabaseAdmin
                .from("services")
                .select("id, event_types")
                .eq("user_id", vendor.id)
                .eq("is_active", true)
                .eq("is_public", true)
                .eq("is_addon", false)
                .order("sort_order", { ascending: true })
                .order("created_at", { ascending: true });

            const availableMainServiceRows = (availableMainServices || []) as Array<{
                id: string;
                event_types?: string[] | null;
            }>;
            const availableMainServiceIds = availableMainServiceRows
                .map((service) => service.id)
                .filter((serviceIdValue): serviceIdValue is string => Boolean(serviceIdValue));
            let cityFilteredAvailableMainServices = availableMainServiceRows;
            if (isCityScopedEventType && availableMainServiceIds.length > 0) {
                const { data: availableScopeRows } = await supabaseAdmin
                    .from("service_city_scopes")
                    .select("service_id, city_code")
                    .eq("user_id", vendor.id)
                    .in("service_id", availableMainServiceIds);
                const cityScopedByServiceId = new Map<string, string[]>();
                (availableScopeRows || []).forEach((row) => {
                    const serviceIdValue =
                        typeof row.service_id === "string" ? row.service_id : "";
                    const cityCodeValue = normalizeCityCode(row.city_code);
                    if (!serviceIdValue || !cityCodeValue) return;
                    const current = cityScopedByServiceId.get(serviceIdValue) || [];
                    if (!current.includes(cityCodeValue)) {
                        current.push(cityCodeValue);
                    }
                    cityScopedByServiceId.set(serviceIdValue, current);
                });
                cityFilteredAvailableMainServices = availableMainServiceRows.filter(
                    (service) => {
                        const scopedCityCodes = cityScopedByServiceId.get(service.id) || [];
                        if (scopedCityCodes.length === 0) {
                            return true;
                        }
                        return scopedCityCodes.includes(resolvedCityCode || "");
                    },
                );
            }

            const preferredService = resolvedEventType
                ? isShowAllPackagesEventType(resolvedEventType)
                    ? cityFilteredAvailableMainServices[0]
                    : cityFilteredAvailableMainServices.find((service) => {
                    const typedService = service as AvailableServiceRow;
                    const eventTypes = Array.isArray(typedService.event_types)
                        ? typedService.event_types
                        : [];
                    return eventTypes.length === 0 || eventTypes.some(
                        (type) => normalizeEventTypeName(type) === resolvedEventType,
                    );
                }) || cityFilteredAvailableMainServices[0]
                : cityFilteredAvailableMainServices[0];

            if (preferredService?.id) {
                mainServiceSelections = [{
                    serviceId: preferredService.id,
                    kind: "main",
                    quantity: 1,
                }];
            }
        }

        if (mainServiceSelections.length === 0) {
            return NextResponse.json({ success: false, error: "Paket utama tidak tersedia." }, { status: 400 });
        }

        const legacyAddonIds = Array.isArray(rawExtraData.addon_ids)
            ? rawExtraData.addon_ids.filter((value): value is string => typeof value === "string")
            : [];
        let addonSelections: BookingServicePayloadItem[] =
            payloadServiceSelections.filter((selection) => selection.kind === "addon");
        if (addonSelections.length === 0 && (vendor.form_show_addons ?? true)) {
            addonSelections = normalizeUuidList(legacyAddonIds).map((id) => ({
                serviceId: id,
                kind: "addon",
                quantity: 1,
            }));
        }
        if (!(vendor.form_show_addons ?? true)) {
            addonSelections = [];
        }

        if (specialOfferRule) {
            if (specialOfferRule.addonLocked) {
                addonSelections = normalizeUuidList(specialOfferRule.addonServiceIds).map((id) => ({
                    serviceId: id,
                    kind: "addon",
                    quantity: 1,
                }));
            } else if (addonSelections.length === 0 && specialOfferRule.addonServiceIds.length > 0) {
                addonSelections = normalizeUuidList(specialOfferRule.addonServiceIds).map((id) => ({
                    serviceId: id,
                    kind: "addon",
                    quantity: 1,
                }));
            }
        }

        const allowMultipleAddons = vendor.form_allow_multiple_addons ?? true;
        if (
            !allowMultipleAddons &&
            !specialOfferRule?.addonLocked &&
            addonSelections.length > 1
        ) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Add-on hanya bisa dipilih satu.",
                },
                { status: 400 },
            );
        }

        const requestedServiceIds = normalizeUuidList([
            ...mainServiceSelections.map((selection) => selection.serviceId),
            ...addonSelections.map((selection) => selection.serviceId),
        ]);
        const { data: selectedServices } = await supabaseAdmin
            .from("services")
            .select("id, name, price, duration_minutes, is_addon")
            .eq("user_id", vendor.id)
            .eq("is_active", true)
            .eq("is_public", true)
            .in("id", requestedServiceIds);
        const scopedCityCodesByServiceId = new Map<string, string[]>();
        if (isCityScopedEventType && requestedServiceIds.length > 0) {
            const { data: serviceScopeRows } = await supabaseAdmin
                .from("service_city_scopes")
                .select("service_id, city_code")
                .eq("user_id", vendor.id)
                .in("service_id", requestedServiceIds);
            (serviceScopeRows || []).forEach((row) => {
                const serviceIdValue =
                    typeof row.service_id === "string" ? row.service_id : "";
                const cityCodeValue = normalizeCityCode(row.city_code);
                if (!serviceIdValue || !cityCodeValue) return;
                const current = scopedCityCodesByServiceId.get(serviceIdValue) || [];
                if (!current.includes(cityCodeValue)) {
                    current.push(cityCodeValue);
                }
                scopedCityCodesByServiceId.set(serviceIdValue, current);
            });
            const hasDisallowedService = requestedServiceIds.some((serviceIdValue) => {
                const scopedCityCodes = scopedCityCodesByServiceId.get(serviceIdValue) || [];
                if (scopedCityCodes.length === 0) {
                    return false;
                }
                return !scopedCityCodes.includes(resolvedCityCode || "");
            });
            if (hasDisallowedService) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "Ada paket/add-on yang tidak tersedia untuk kota/kabupaten terpilih.",
                    },
                    { status: 400 },
                );
            }
        }

        const mainServiceSelectionMap = new Map(
            mainServiceSelections.map((selection) => [selection.serviceId, normalizeBookingServiceQuantity(selection.quantity)]),
        );
        const mainServices = mainServiceSelections
            .map((selection) => {
                const service = selectedServices?.find(
                    (candidate) =>
                        candidate.id === selection.serviceId && !candidate.is_addon,
                );
                if (!service) return null;
                return {
                    ...service,
                    quantity: mainServiceSelectionMap.get(selection.serviceId) || 1,
                };
            })
            .filter((service): service is NonNullable<typeof selectedServices>[number] & { quantity: number } => Boolean(service));
        if (mainServices.length === 0) {
            return NextResponse.json({ success: false, error: "Paket utama tidak ditemukan." }, { status: 400 });
        }

        const addonSelectionMap = new Map(
            addonSelections.map((selection) => [selection.serviceId, normalizeBookingServiceQuantity(selection.quantity)]),
        );
        const addonServices = addonSelections
            .map((selection) => {
                const service = selectedServices?.find(
                    (candidate) =>
                        candidate.id === selection.serviceId && candidate.is_addon,
                );
                if (!service) return null;
                return {
                    ...service,
                    quantity: addonSelectionMap.get(selection.serviceId) || 1,
                };
            })
            .filter((service): service is NonNullable<typeof selectedServices>[number] & { quantity: number } => Boolean(service));
        const resolvedMainServiceIds = mainServices.map((service) => service.id);
        const resolvedAddonServiceIds = addonServices.map((service) => service.id);
        const packageTotal =
            mainServices.reduce((sum, service) => sum + (service.price * service.quantity), 0);
        const addonTotal =
            addonServices.reduce((sum, service) => sum + (service.price * service.quantity), 0);
        const accommodationFee = specialOfferRule?.accommodationFee || 0;
        const discountAmount = specialOfferRule?.discountAmount || 0;
        const computedTotalPrice = computeSpecialOfferTotal({
            packageTotal,
            addonTotal,
            accommodationFee,
            discountAmount,
        });

        // Validate minimum DP (supports percent/fixed mode + backward compatibility)
        const dpMap =
            (typeof vendor.min_dp_map === "object" && vendor.min_dp_map !== null)
                ? vendor.min_dp_map as Record<string, number | { mode?: string; value?: number }>
                : {};
        const dpEntry = resolvedEventType
            ? (
                dpMap[resolvedEventType] ??
                (resolvedEventType === PUBLIC_CUSTOM_EVENT_TYPE
                    ? dpMap[LEGACY_PUBLIC_CUSTOM_EVENT_TYPE]
                    : undefined) ??
                (vendor.min_dp_percent ?? 50)
            )
            : (vendor.min_dp_percent ?? 50);
        const dpMode = typeof dpEntry === "number" ? "percent" : (dpEntry.mode || "percent");
        const dpValue = typeof dpEntry === "number" ? dpEntry : (dpEntry.value ?? (vendor.min_dp_percent ?? 50));
        const minDPAmount = dpMode === "fixed" ? dpValue : (computedTotalPrice * dpValue) / 100;
        if (dpPaid < minDPAmount) {
            return NextResponse.json({
                success: false,
                error: dpMode === "fixed"
                    ? `Minimum DP adalah Rp ${new Intl.NumberFormat("id-ID").format(minDPAmount)}.`
                    : `Minimum DP adalah ${dpValue}% (Rp ${new Intl.NumberFormat("id-ID").format(minDPAmount)}).`
            }, { status: 400 });
        }

        const sanitizedExtraData: Record<string, unknown> = { ...rawExtraData };
        delete sanitizedExtraData.wisuda_session_duration_minutes;
        if (!isWisudaEventType || !hasCompleteWisudaSplitDates) {
            delete sanitizedExtraData.tanggal_wisuda_1;
            delete sanitizedExtraData.tanggal_wisuda_2;
            delete sanitizedExtraData.tempat_wisuda_1;
            delete sanitizedExtraData.tempat_wisuda_2;
        }
        if (shouldRequireUniversitySelection && resolvedUniversityReference) {
            sanitizedExtraData[UNIVERSITY_EXTRA_FIELD_KEY] =
                buildUniversityDisplayName(
                    resolvedUniversityReference.name,
                    resolvedUniversityReference.abbreviation,
                );
            sanitizedExtraData[UNIVERSITY_REFERENCE_EXTRA_KEY] =
                resolvedUniversityReference.id;
        } else {
            delete sanitizedExtraData[UNIVERSITY_EXTRA_FIELD_KEY];
            delete sanitizedExtraData[UNIVERSITY_REFERENCE_EXTRA_KEY];
        }
        delete sanitizedExtraData.universitas_abbreviation_draft;
        if (addonServices.length > 0) {
            sanitizedExtraData.addon_ids = addonServices.map((service) => service.id);
            sanitizedExtraData.addon_names = addonServices.map((service) =>
                service.quantity > 1 ? `${service.name} x${service.quantity}` : service.name,
            );
        } else {
            delete sanitizedExtraData.addon_ids;
            delete sanitizedExtraData.addon_names;
        }

        if (specialOfferRule) {
            sanitizedExtraData.special_offer = buildSpecialOfferSnapshot({
                rule: specialOfferRule,
                selectedPackageServiceIds: resolvedMainServiceIds,
                selectedAddonServiceIds: resolvedAddonServiceIds,
                selectedEventType: resolvedEventType,
                packageTotal,
                addonTotal,
            });
        } else {
            delete sanitizedExtraData.special_offer;
        }

        const initialStatus = getInitialBookingStatus(vendor.custom_client_statuses);
        const bookingPayload = {
            user_id: vendor.id,
            client_name: normalizedClientName,
            client_whatsapp: normalizedClientWhatsapp || null,
            event_type: resolvedEventType || null,
            session_date: resolvedSessionDate || null,
            service_id: mainServices[0]?.id || null,
            city_code: resolvedCityCode,
            city_name: resolvedCityName,
            total_price: computedTotalPrice,
            dp_paid: dpPaid,
            location: location || null,
            location_lat: normalizedLocationLat,
            location_lng: normalizedLocationLng,
            location_detail: locationDetail || null,
            notes: notes || null,
            extra_fields: Object.keys(sanitizedExtraData).length > 0 ? sanitizedExtraData : null,
            payment_proof_url: normalizedPaymentProofUrl,
            payment_method: selectedPaymentMethod,
            payment_source: normalizedPaymentSource,
            instagram: instagram || null,
            status: initialStatus,
            client_status: initialStatus,
            is_fully_paid: dpPaid >= computedTotalPrice,
        };

        let booking: { id: string; booking_code: string } | null = null;
        let bookingInsertError: { code?: string | null; message?: string | null } | null = null;

        for (let attempt = 0; attempt < 5; attempt++) {
            const { data, error } = await supabaseAdmin
                .from("bookings")
                .insert({
                    ...bookingPayload,
                    booking_code: createBookingCode(),
                })
                .select("id, booking_code")
                .single();

            if (!error && data) {
                booking = data;
                bookingInsertError = null;
                break;
            }

            bookingInsertError = error;
            if (isDuplicateBookingCodeError(error)) {
                continue;
            }
            break;
        }

        if (!booking) {
            return NextResponse.json(
                {
                    success: false,
                    error: bookingInsertError?.message || "Gagal menyimpan booking.",
                },
                { status: 500 },
            );
        }

        const { error: bookingServicesError } = await supabaseAdmin.from("booking_services").insert(
            toBookingServicesPayload([
                ...mainServices.map((service) => ({
                    serviceId: service.id,
                    kind: "main" as const,
                    quantity: service.quantity,
                })),
                ...addonServices.map((service) => ({
                    serviceId: service.id,
                    kind: "addon" as const,
                    quantity: service.quantity,
                })),
            ]).map((item) => ({
                booking_id: booking.id,
                ...item,
            })),
        );
        if (bookingServicesError) {
            await supabaseAdmin.from("bookings").delete().eq("id", booking.id);
            return NextResponse.json(
                {
                    success: false,
                    error: bookingServicesError.message || "Gagal menyimpan layanan booking.",
                },
                { status: 500 },
            );
        }

        if (proofEnabled && selectedPaymentMethod !== "cash" && paymentProofFile) {
            try {
                if (!vendor.google_drive_access_token || !vendor.google_drive_refresh_token) {
                    throw new Error("Google Drive admin belum terhubung.");
                }

                const fileBuffer = Buffer.from(await paymentProofFile.arrayBuffer());
                const uploaded = await uploadPaymentProofToDrive({
                    accessToken: vendor.google_drive_access_token,
                    refreshToken: vendor.google_drive_refresh_token,
                    driveFolderFormat: vendor.drive_folder_format ?? null,
                    driveFolderFormatMap: vendor.drive_folder_format_map ?? null,
                    driveFolderStructureMap: vendor.drive_folder_structure_map,
                    studioName: vendor.studio_name ?? null,
                    bookingCode: booking.booking_code,
                    clientName: normalizedClientName,
                    eventType: resolvedEventType,
                    sessionDate: resolvedSessionDate,
                    extraFields: sanitizedExtraData,
                    fileName: paymentProofFile.name || `${booking.booking_code}_proof`,
                    mimeType: paymentProofFile.type || "application/octet-stream",
                    fileBuffer,
                    stage: "initial",
                });

                await supabaseAdmin
                    .from("bookings")
                    .update({
                        payment_proof_url: uploaded.fileUrl,
                        payment_proof_drive_file_id: uploaded.fileId,
                    })
                    .eq("id", booking.id);
            } catch (uploadError) {
                console.error("Public booking payment proof upload failed:", {
                    vendorId: vendor.id,
                    bookingId: booking.id,
                    bookingCode: booking.booking_code,
                    error: getUnknownErrorMessage(uploadError),
                }, uploadError);
                await supabaseAdmin.from("bookings").delete().eq("id", booking.id);
                throw new PublicBookingProcessingError(
                    "Terjadi kendala saat mengunggah bukti pembayaran. Silakan coba lagi beberapa saat atau hubungi admin.",
                    { alreadyLogged: true },
                );
            }
        }

        if (specialOfferRule) {
            const { data: consumeData, error: consumeError } = await supabaseAdmin
                .from("booking_special_links")
                .update({
                    consumed_at: new Date().toISOString(),
                    consumed_booking_id: booking.id,
                })
                .eq("id", specialOfferRule.id)
                .eq("user_id", vendor.id)
                .eq("token", specialOfferRule.token)
                .eq("is_active", true)
                .is("consumed_at", null)
                .is("consumed_booking_id", null)
                .select("id")
                .maybeSingle();

            if (consumeError || !consumeData) {
                await supabaseAdmin.from("bookings").delete().eq("id", booking.id);
                return NextResponse.json(
                    {
                        success: false,
                        code: SPECIAL_LINK_EXPIRED_ERROR_CODE,
                        error: "Link booking khusus sudah digunakan. Silakan minta link baru.",
                    },
                    { status: 409 },
                );
            }
        }

        const shouldSyncCalendar = hasBookingCalendarSessions({
            eventType: resolvedEventType,
            sessionDate: resolvedSessionDate || null,
            extraFields: sanitizedExtraData,
            defaultLocation: location,
        });

        if (!shouldSyncCalendar) {
            const updated = await updateBookingCalendarSyncState({
                supabase: supabaseAdmin,
                bookingId: booking.id,
                userId: vendor.id,
                status: "skipped",
                errorMessage: NO_SCHEDULE_SYNC_MESSAGE,
            });
            if (!updated.ok) {
                console.warn(
                    "Failed to update booking calendar sync status (skipped):",
                    updated.error,
                );
            }
        } else if (!hasOAuthTokenPair(vendor.google_access_token, vendor.google_refresh_token)) {
            await clearGoogleCalendarConnection(supabaseAdmin, vendor.id);
            const updated = await updateBookingCalendarSyncState({
                supabase: supabaseAdmin,
                bookingId: booking.id,
                userId: vendor.id,
                status: "failed",
                errorMessage: "Koneksi Google Calendar belum lengkap. Silakan hubungkan ulang di Pengaturan.",
            });
            if (!updated.ok) {
                console.warn(
                    "Failed to update booking calendar sync status (failed):",
                    updated.error,
                );
            }
        } else {
            const vendorAccessToken = typeof vendor.google_access_token === "string"
                ? vendor.google_access_token.trim()
                : "";
            const vendorRefreshToken = typeof vendor.google_refresh_token === "string"
                ? vendor.google_refresh_token.trim()
                : "";
            const bookingServicesForSync = [
                ...mainServices.map((service, index) => ({
                    id: `${booking.id}-main-${service.id}`,
                    kind: "main" as const,
                    sort_order: index,
                    service,
                })),
                ...addonServices.map((service, index) => ({
                    id: `${booking.id}-addon-${service.id}`,
                    kind: "addon" as const,
                    sort_order: index,
                    service,
                })),
            ];
            try {
                const syncedEvent = await syncBookingCalendarEvent({
                    profile: {
                        accessToken: vendorAccessToken,
                        refreshToken: vendorRefreshToken,
                        studioName: vendor.studio_name ?? null,
                        eventFormat: vendor.calendar_event_format || DEFAULT_CALENDAR_EVENT_FORMAT,
                        eventFormatMap: vendor.calendar_event_format_map,
                        eventDescription: null,
                        eventDescriptionMap: vendor.calendar_event_description_map ?? null,
                    },
                    booking: {
                        id: booking.id,
                        bookingCode: booking.booking_code,
                        bookingDetailLink: buildBookingDetailLink({
                            publicOrigin,
                            locale,
                            bookingId: booking.id,
                        }),
                        clientName: normalizedClientName,
                        clientWhatsapp: normalizedClientWhatsapp || null,
                        instagram: instagram || null,
                        sessionDate: resolvedSessionDate || null,
                        location: location ?? null,
                        locationLat: normalizedLocationLat,
                        locationLng: normalizedLocationLng,
                        locationDetail,
                        eventType: resolvedEventType,
                        notes,
                        extraFields: sanitizedExtraData,
                        freelancerNames: [],
                        googleCalendarEventIds: null,
                        services: mainServices[0] || null,
                        bookingServices: bookingServicesForSync,
                    },
                });

                const updated = await updateBookingCalendarSyncState({
                    supabase: supabaseAdmin,
                    bookingId: booking.id,
                    userId: vendor.id,
                    status: "success",
                    eventId: syncedEvent.eventId,
                    eventIds: syncedEvent.eventIds,
                });
                if (!updated.ok) {
                    console.warn(
                        "Failed to update booking calendar sync status (success):",
                        updated.error,
                    );
                }
            } catch (error) {
                const errorCode = getGoogleCalendarSyncErrorCode(error);
                const message = getGoogleCalendarSyncErrorMessage(error);
                const syncStatus = isNoScheduleSyncError(error) ? "skipped" : "failed";
                const updated = await updateBookingCalendarSyncState({
                    supabase: supabaseAdmin,
                    bookingId: booking.id,
                    userId: vendor.id,
                    status: syncStatus,
                    errorMessage: message,
                });
                if (!updated.ok) {
                    console.warn(
                        `Failed to update booking calendar sync status (${syncStatus}):`,
                        updated.error,
                    );
                }
                if (errorCode) {
                    await clearGoogleCalendarConnection(supabaseAdmin, vendor.id);
                }
            }
        }

        let bookingConfirmTemplate: string | null = null;
        try {
            const { data: templateRows } = await supabaseAdmin
                .from("templates")
                .select("type, name, content, content_en, event_type")
                .eq("user_id", vendor.id)
                .in("type", ["whatsapp_client", "whatsapp_booking_confirm"]);

            const normalizedTemplates: WhatsAppTemplate[] = Array.isArray(templateRows)
                ? templateRows
                    .map((row: Record<string, unknown>) => ({
                        type: String(row.type || ""),
                        name: typeof row.name === "string" ? row.name : null,
                        content: typeof row.content === "string" ? row.content : "",
                        content_en: typeof row.content_en === "string" ? row.content_en : "",
                        event_type: typeof row.event_type === "string" ? row.event_type : null,
                    }))
                : [];

            const content = getWhatsAppTemplateContent(
                normalizedTemplates,
                "whatsapp_booking_confirm",
                locale,
                resolvedEventType,
                resolveWhatsAppTemplateMode({
                    eventType: resolvedEventType,
                    extraFields: sanitizedExtraData,
                }),
            );
            bookingConfirmTemplate = content.trim() || null;
        } catch {
            bookingConfirmTemplate = null;
        }

        invalidatePublicCachesForBooking({
            bookingCode: booking.booking_code,
            trackingUuid: null,
            userId: vendor.id,
            vendorSlug: vendor.vendor_slug || null,
        });

        return NextResponse.json({
            success: true,
            bookingCode: booking.booking_code,
            bookingId: booking.id,
            vendorWhatsapp: vendor.whatsapp_number,
            vendorName: vendor.studio_name,
            bookingConfirmTemplate,
        });
    } catch (err: unknown) {
        if (err instanceof BookingWriteAccessDeniedError) {
            return NextResponse.json(
                { success: false, error: err.message },
                { status: err.status },
            );
        }

        if (!(err instanceof PublicBookingProcessingError && err.alreadyLogged)) {
            console.error("Public booking request failed:", err);
        }

        const message = err instanceof PublicBookingProcessingError
            ? err.message
            : getPublicBookingProcessingErrorMessage(err);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
