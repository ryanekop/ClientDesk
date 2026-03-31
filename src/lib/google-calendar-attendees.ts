import type { createClient } from "@/utils/supabase/server";
import { readSessionFreelancerAssignmentsFromExtraFields } from "@/lib/freelancer-session-assignments";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

type SupabaseErrorLike = {
  message?: string;
  details?: string;
  hint?: string;
} | null;

type ResolveBookingFreelancerAttendeeEmailsArgs = {
  supabase: ServerSupabaseClient;
  userId: string;
  bookingIds: string[];
};

export type BookingFreelancerAttendeeResolution = {
  attendeeEmailsByBooking: Record<string, string[]>;
  attendeeEmailsByBookingSession: Record<string, Record<string, string[]>>;
};

function normalizeUniqueIds(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  );
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return null;
  return normalized;
}

function extractMissingColumnFromSupabaseError(error: SupabaseErrorLike) {
  const messages = [error?.message, error?.details, error?.hint].filter(
    (value): value is string => Boolean(value),
  );

  for (const message of messages) {
    const schemaCacheMatch = message.match(
      /Could not find the '([^']+)' column/i,
    );
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

async function fetchLegacyBookingFreelanceIds({
  supabase,
  userId,
  bookingIds,
}: {
  supabase: ServerSupabaseClient;
  userId: string;
  bookingIds: string[];
}) {
  if (bookingIds.length === 0) return {};

  const columnsToTry = ["freelance_id", "freelancer_id"] as const;
  for (const columnName of columnsToTry) {
    const { data, error } = await supabase
      .from("bookings")
      .select(`id, ${columnName}`)
      .eq("user_id", userId)
      .in("id", bookingIds);

    if (error) {
      const missingColumn = extractMissingColumnFromSupabaseError(error);
      if (missingColumn && missingColumn === columnName) {
        continue;
      }

      throw new Error(
        `Gagal membaca fallback assignment freelancer: ${error.message || "Unknown error"}`,
      );
    }

    const map: Record<string, string> = {};
    const rows = (data || []) as Array<{
      id?: string | null;
      freelance_id?: string | null;
      freelancer_id?: string | null;
    }>;

    for (const row of rows) {
      const bookingId = typeof row.id === "string" ? row.id.trim() : "";
      const rawFreelancerId =
        columnName === "freelance_id" ? row.freelance_id : row.freelancer_id;
      const freelancerId =
        typeof rawFreelancerId === "string" ? rawFreelancerId.trim() : "";

      if (!bookingId || !freelancerId) continue;
      map[bookingId] = freelancerId;
    }

    return map;
  }

  return {};
}

export async function resolveBookingFreelancerAttendeeEmailsWithSessions({
  supabase,
  userId,
  bookingIds,
}: ResolveBookingFreelancerAttendeeEmailsArgs): Promise<
  BookingFreelancerAttendeeResolution
> {
  const normalizedBookingIds = normalizeUniqueIds(bookingIds);
  const attendeeByBookingId: Record<string, string[]> = {};
  const attendeeByBookingSession: Record<string, Record<string, string[]>> = {};

  for (const bookingId of normalizedBookingIds) {
    attendeeByBookingId[bookingId] = [];
    attendeeByBookingSession[bookingId] = {};
  }

  if (normalizedBookingIds.length === 0) {
    return {
      attendeeEmailsByBooking: attendeeByBookingId,
      attendeeEmailsByBookingSession: attendeeByBookingSession,
    };
  }

  const { data: bookingRows, error: bookingRowsError } = await supabase
    .from("bookings")
    .select("id, extra_fields")
    .eq("user_id", userId)
    .in("id", normalizedBookingIds);

  if (bookingRowsError) {
    throw new Error(
      `Gagal membaca detail booking untuk assignment sesi freelancer: ${bookingRowsError.message || "Unknown error"}`,
    );
  }

  const bookingSessionAssignmentsById: Record<string, Record<string, string[]>> =
    {};
  const freelanceIdsFromSessionAssignments = new Set<string>();

  const typedBookingRows = (bookingRows || []) as Array<{
    id?: string | null;
    extra_fields?: unknown;
  }>;
  for (const row of typedBookingRows) {
    const bookingId = typeof row.id === "string" ? row.id.trim() : "";
    if (!bookingId) continue;

    const assignments = readSessionFreelancerAssignmentsFromExtraFields(
      row.extra_fields,
      {
        preserveEmpty: true,
      },
    );
    bookingSessionAssignmentsById[bookingId] = assignments;
    for (const freelancerIds of Object.values(assignments)) {
      for (const freelancerId of freelancerIds) {
        freelanceIdsFromSessionAssignments.add(freelancerId);
      }
    }
  }

  const { data: bookingFreelanceRows, error: bookingFreelanceError } =
    await supabase
      .from("booking_freelance")
      .select("booking_id, freelance_id")
      .in("booking_id", normalizedBookingIds);

  if (bookingFreelanceError) {
    throw new Error(
      `Gagal membaca assignment freelancer: ${bookingFreelanceError.message || "Unknown error"}`,
    );
  }

  const junctionRows = (bookingFreelanceRows || []) as Array<{
    booking_id?: string | null;
    freelance_id?: string | null;
  }>;
  const bookingToFreelanceIds: Record<string, string[]> = {};
  const bookingIdsWithJunctionRow = new Set<string>();
  const freelanceIdsFromJunction = new Set<string>();

  for (const row of junctionRows) {
    const bookingId =
      typeof row.booking_id === "string" ? row.booking_id.trim() : "";
    const freelanceId =
      typeof row.freelance_id === "string" ? row.freelance_id.trim() : "";
    if (!bookingId || !freelanceId) continue;

    bookingIdsWithJunctionRow.add(bookingId);
    if (!bookingToFreelanceIds[bookingId]) {
      bookingToFreelanceIds[bookingId] = [];
    }
    bookingToFreelanceIds[bookingId].push(freelanceId);
    freelanceIdsFromJunction.add(freelanceId);
  }

  const unresolvedBookingIds = normalizedBookingIds.filter(
    (bookingId) => !bookingIdsWithJunctionRow.has(bookingId),
  );
  const legacyBookingFreelanceIdMap = await fetchLegacyBookingFreelanceIds({
    supabase,
    userId,
    bookingIds: unresolvedBookingIds,
  });
  const legacyFreelanceIds = normalizeUniqueIds(
    Object.values(legacyBookingFreelanceIdMap),
  );

  const allFreelanceIds = normalizeUniqueIds([
    ...Array.from(freelanceIdsFromJunction),
    ...Array.from(freelanceIdsFromSessionAssignments),
    ...legacyFreelanceIds,
  ]);

  const freelanceEmailById: Record<string, string> = {};
  if (allFreelanceIds.length > 0) {
    const { data: freelanceRows, error: freelanceError } = await supabase
      .from("freelance")
      .select("id, google_email")
      .eq("user_id", userId)
      .in("id", allFreelanceIds);

    if (freelanceError) {
      throw new Error(
        `Gagal membaca email freelancer: ${freelanceError.message || "Unknown error"}`,
      );
    }

    const rows = (freelanceRows || []) as Array<{
      id?: string | null;
      google_email?: string | null;
    }>;
    for (const row of rows) {
      const freelanceId = typeof row.id === "string" ? row.id.trim() : "";
      const email = normalizeEmail(row.google_email);
      if (!freelanceId || !email) continue;
      freelanceEmailById[freelanceId] = email;
    }
  }

  for (const [bookingId, freelanceIds] of Object.entries(bookingToFreelanceIds)) {
    const emails = Array.from(
      new Set(
        freelanceIds
          .map((freelanceId) => freelanceEmailById[freelanceId])
          .filter((email): email is string => Boolean(email)),
      ),
    );
    attendeeByBookingId[bookingId] = emails;
  }

  const unresolvedBookingIdsForLegacy = normalizedBookingIds.filter((bookingId) => {
    const hasEmails = (attendeeByBookingId[bookingId] || []).length > 0;
    if (hasEmails) return false;
    // If booking already has junction rows, do not fallback to legacy column.
    return !bookingIdsWithJunctionRow.has(bookingId);
  });

  for (const bookingId of unresolvedBookingIdsForLegacy) {
    const legacyFreelanceId = legacyBookingFreelanceIdMap[bookingId];
    if (!legacyFreelanceId) continue;
    const email = freelanceEmailById[legacyFreelanceId];
    attendeeByBookingId[bookingId] = email ? [email] : [];
  }

  for (const bookingId of normalizedBookingIds) {
    const sessionAssignments = bookingSessionAssignmentsById[bookingId] || {};
    const nextBySession: Record<string, string[]> = {};
    for (const [sessionKey, freelancerIds] of Object.entries(sessionAssignments)) {
      const emails = Array.from(
        new Set(
          freelancerIds
            .map((freelancerId) => freelanceEmailById[freelancerId])
            .filter((email): email is string => Boolean(email)),
        ),
      );
      nextBySession[sessionKey] = emails;
    }
    attendeeByBookingSession[bookingId] = nextBySession;
  }

  return {
    attendeeEmailsByBooking: attendeeByBookingId,
    attendeeEmailsByBookingSession: attendeeByBookingSession,
  };
}

export async function resolveBookingFreelancerAttendeeEmails({
  supabase,
  userId,
  bookingIds,
}: ResolveBookingFreelancerAttendeeEmailsArgs): Promise<
  Record<string, string[]>
> {
  const resolved = await resolveBookingFreelancerAttendeeEmailsWithSessions({
    supabase,
    userId,
    bookingIds,
  });
  return resolved.attendeeEmailsByBooking;
}
