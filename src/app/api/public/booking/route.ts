import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncBookingCalendarEvent } from "@/lib/google-calendar-booking";
import { hasBookingCalendarSessions } from "@/lib/booking-calendar-sessions";
import {
    DEFAULT_CALENDAR_EVENT_FORMAT,
} from "@/utils/google/template";
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

type VendorRecord = {
    id: string;
    studio_name: string | null;
    whatsapp_number: string | null;
    min_dp_percent: number | null;
    min_dp_map: Record<string, number | { mode?: string; value?: number }> | null;
    google_access_token: string | null;
    google_refresh_token: string | null;
    google_drive_access_token: string | null;
    google_drive_refresh_token: string | null;
    drive_folder_format: string | null;
    drive_folder_format_map: Record<string, string> | null;
    drive_folder_structure_map: Record<string, string[] | string> | null;
    calendar_event_format: string | null;
    calendar_event_format_map: Record<string, string> | null;
    calendar_event_description: string | null;
    calendar_event_description_map: Record<string, string> | null;
    form_payment_methods: PaymentMethod[] | null;
    form_show_proof: boolean | null;
    qris_image_url: string | null;
    qris_drive_file_id: string | null;
    bank_accounts: unknown[] | null;
    custom_client_statuses: string[] | null;
};

type BookingRequestBody = {
    vendorId?: string | null;
    vendorSlug: string;
    vendorSlugPath?: string | null;
    clientName: string;
    clientWhatsapp: string;
    eventType: string | null;
    sessionDate: string;
    serviceIds?: string[] | null;
    serviceId: string;
    dpPaid: number;
    location: string | null;
    locationDetail: string | null;
    notes: string | null;
    extraData: Record<string, unknown> | null;
    paymentProofUrl: string | null;
    paymentMethod: PaymentMethod | null;
    paymentSource: PaymentSource | null;
    instagram: string | null;
};

function isValidUuid(value: string | null | undefined) {
    if (!value) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
    try {
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
                serviceIds: formData.get("serviceIds")
                    ? JSON.parse(String(formData.get("serviceIds")))
                    : null,
                serviceId: String(formData.get("serviceId") || ""),
                dpPaid: Number(formData.get("dpPaid") || 0),
                location: formData.get("location") ? String(formData.get("location")) : null,
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
            serviceIds,
            serviceId,
            dpPaid,
            location,
            locationDetail,
            notes,
            extraData,
            paymentProofUrl,
            paymentMethod,
            paymentSource,
            instagram,
        } = body;

        if ((!vendorId && !vendorSlug) || !clientName || !clientWhatsapp || !sessionDate || (!serviceId && (!serviceIds || serviceIds.length === 0))) {
            return NextResponse.json({ success: false, error: "Data tidak lengkap." }, { status: 400 });
        }

        const vendorSelect =
            "id, studio_name, whatsapp_number, min_dp_percent, min_dp_map, google_access_token, google_refresh_token, google_drive_access_token, google_drive_refresh_token, drive_folder_format, drive_folder_format_map, drive_folder_structure_map, calendar_event_format, calendar_event_format_map, calendar_event_description, calendar_event_description_map, form_payment_methods, form_show_proof, qris_image_url, qris_drive_file_id, bank_accounts, custom_client_statuses";

        let vendor: VendorRecord | null = null;
        const referer = request.headers.get("referer");
        const slugCandidates = Array.from(
            new Set([
                ...extractSlugCandidates(vendorSlug, referer),
                ...extractSlugCandidates(vendorSlugPath, referer),
            ]),
        );

        if (isValidUuid(vendorId || "")) {
            const { data: byId } = await supabaseAdmin
                .from("profiles")
                .select(vendorSelect)
                .eq("id", vendorId)
                .maybeSingle();
            vendor = (byId as VendorRecord | null) || null;
        }

        for (const candidate of slugCandidates) {
            if (vendor) break;
            const normalized = candidate.trim();
            if (!normalized) continue;

            const { data: bySlug } = await supabaseAdmin
                .from("profiles")
                .select(vendorSelect)
                .eq("vendor_slug", normalized)
                .maybeSingle();
            vendor = (bySlug as VendorRecord | null) || null;

            if (!vendor) {
                const lower = normalized.toLowerCase();
                if (lower !== normalized) {
                    const { data: bySlugLower } = await supabaseAdmin
                        .from("profiles")
                        .select(vendorSelect)
                        .eq("vendor_slug", lower)
                        .maybeSingle();
                    vendor = (bySlugLower as VendorRecord | null) || null;
                }
            }
        }

        if (!vendor) {
            return NextResponse.json({ success: false, error: "Vendor tidak ditemukan. Pastikan link form adalah link terbaru." }, { status: 404 });
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
            selectedPaymentMethod === "cash" || !proofEnabled ? null : paymentProofUrl || null;

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

        const rawExtraData =
            typeof extraData === "object" && extraData !== null
                ? extraData as Record<string, unknown>
                : {};
        const mainServiceIds = Array.isArray(serviceIds)
            ? serviceIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
            : [];
        const normalizedMainServiceIds = Array.from(
            new Set(mainServiceIds.length > 0 ? mainServiceIds : (serviceId ? [serviceId] : [])),
        );
        const addonIds = Array.isArray(rawExtraData.addon_ids)
            ? rawExtraData.addon_ids.filter((value): value is string => typeof value === "string")
            : [];

        const requestedServiceIds = Array.from(new Set([...normalizedMainServiceIds, ...addonIds]));
        const { data: selectedServices } = await supabaseAdmin
            .from("services")
            .select("id, name, price, duration_minutes, is_addon")
            .eq("user_id", vendor.id)
            .eq("is_active", true)
            .in("id", requestedServiceIds);

        const mainServices = normalizedMainServiceIds
            .map((id) => selectedServices?.find((service) => service.id === id && !service.is_addon) ?? null)
            .filter((service): service is NonNullable<typeof selectedServices>[number] => Boolean(service));
        if (mainServices.length === 0) {
            return NextResponse.json({ success: false, error: "Paket utama tidak ditemukan." }, { status: 400 });
        }

        const addonServices = selectedServices?.filter(
            (service) => addonIds.includes(service.id) && service.is_addon,
        ) ?? [];
        const computedTotalPrice =
            mainServices.reduce((sum, service) => sum + service.price, 0) +
            addonServices.reduce((sum, service) => sum + service.price, 0);

        // Validate minimum DP (supports percent/fixed mode + backward compatibility)
        const dpMap =
            (typeof vendor.min_dp_map === "object" && vendor.min_dp_map !== null)
                ? vendor.min_dp_map as Record<string, number | { mode?: string; value?: number }>
                : {};
        const dpEntry = eventType && dpMap[eventType] !== undefined
            ? dpMap[eventType]
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
        if (addonServices.length > 0) {
            sanitizedExtraData.addon_ids = addonServices.map((service) => service.id);
            sanitizedExtraData.addon_names = addonServices.map((service) => service.name);
        } else {
            delete sanitizedExtraData.addon_ids;
            delete sanitizedExtraData.addon_names;
        }

        // Generate booking code with sequential number
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, "0");
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const yyyy = now.getFullYear();

        // Count existing bookings for this vendor to get sequential number
        const { count: bookingCount } = await supabaseAdmin
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .eq("user_id", vendor.id);
        const seq = String((bookingCount || 0) + 1).padStart(3, "0");
        const bookingCode = `INV-${dd}${mm}${yyyy}${seq}`;
        const initialStatus = getInitialBookingStatus(vendor.custom_client_statuses);

        const { data: booking, error } = await supabaseAdmin
            .from("bookings")
            .insert({
                user_id: vendor.id,
                booking_code: bookingCode,
                client_name: clientName,
                client_whatsapp: clientWhatsapp,
                event_type: eventType || null,
                session_date: sessionDate,
                service_id: mainServices[0]?.id || null,
                total_price: computedTotalPrice,
                dp_paid: dpPaid,
                location: location || null,
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
            })
            .select("id, booking_code")
            .single();

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        await supabaseAdmin.from("booking_services").insert([
            ...mainServices.map((service, index) => ({
                booking_id: booking.id,
                service_id: service.id,
                kind: "main",
                sort_order: index,
            })),
            ...addonServices.map((service, index) => ({
                booking_id: booking.id,
                service_id: service.id,
                kind: "addon",
                sort_order: index,
            })),
        ]);

        if (proofEnabled && selectedPaymentMethod !== "cash" && paymentProofFile) {
            try {
                if (!vendor.google_drive_access_token || !vendor.google_drive_refresh_token) {
                    throw new Error("Google Drive admin belum terhubung.");
                }

                const fileBuffer = Buffer.from(await paymentProofFile.arrayBuffer());
                const uploaded = await uploadPaymentProofToDrive({
                    accessToken: vendor.google_drive_access_token,
                    refreshToken: vendor.google_drive_refresh_token,
                    driveFolderFormat: vendor.drive_folder_format,
                    driveFolderFormatMap: vendor.drive_folder_format_map,
                    driveFolderStructureMap: vendor.drive_folder_structure_map,
                    studioName: vendor.studio_name,
                    bookingCode: booking.booking_code,
                    clientName,
                    eventType,
                    sessionDate,
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
                await supabaseAdmin.from("bookings").delete().eq("id", booking.id);
                throw uploadError;
            }
        }

        const shouldSyncCalendar = hasBookingCalendarSessions({
            eventType,
            sessionDate,
            extraFields: sanitizedExtraData,
            defaultLocation: location,
        });

        // Auto-sync to Google Calendar (fire-and-forget)
        if (vendor.google_access_token && vendor.google_refresh_token && shouldSyncCalendar) {
            try {
                const syncedEvent = await syncBookingCalendarEvent({
                    profile: {
                        accessToken: vendor.google_access_token,
                        refreshToken: vendor.google_refresh_token,
                        studioName: vendor.studio_name,
                        eventFormat: vendor.calendar_event_format || DEFAULT_CALENDAR_EVENT_FORMAT,
                        eventFormatMap: vendor.calendar_event_format_map,
                        eventDescription: vendor.calendar_event_description,
                        eventDescriptionMap: vendor.calendar_event_description_map,
                    },
                    booking: {
                        id: booking.id,
                        bookingCode,
                        clientName,
                        clientWhatsapp,
                        sessionDate,
                        location,
                        locationDetail,
                        eventType,
                        notes,
                        extraFields: sanitizedExtraData,
                        googleCalendarEventIds: null,
                        services: mainServices[0] || null,
                        bookingServices: mainServices.map((service, index) => ({
                            id: `${booking.id}-main-${service.id}`,
                            kind: "main",
                            sort_order: index,
                            service,
                        })),
                    },
                });

                if (syncedEvent.eventId) {
                    await supabaseAdmin
                        .from("bookings")
                        .update({
                            google_calendar_event_id: syncedEvent.eventId,
                            google_calendar_event_ids: syncedEvent.eventIds,
                        })
                        .eq("id", booking.id);
                }
            } catch {
                // Silently ignore — calendar may not be connected
            }
        }

        return NextResponse.json({
            success: true,
            bookingCode: booking.booking_code,
            bookingId: booking.id,
            vendorWhatsapp: vendor.whatsapp_number,
            vendorName: vendor.studio_name,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Terjadi kesalahan saat memproses booking.";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
