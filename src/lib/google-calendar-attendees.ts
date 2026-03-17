import type { createClient } from "@/utils/supabase/server";

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

export async function resolveBookingFreelancerAttendeeEmails({
  supabase,
  userId,
  bookingIds,
}: ResolveBookingFreelancerAttendeeEmailsArgs): Promise<
  Record<string, string[]>
> {
  const normalizedBookingIds = normalizeUniqueIds(bookingIds);
  const attendeeByBookingId: Record<string, string[]> = {};

  for (const bookingId of normalizedBookingIds) {
    attendeeByBookingId[bookingId] = [];
  }

  if (normalizedBookingIds.length === 0) {
    return attendeeByBookingId;
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

  const freelanceEmailById: Record<string, string> = {};
  if (freelanceIdsFromJunction.size > 0) {
    const { data: freelanceRows, error: freelanceError } = await supabase
      .from("freelance")
      .select("id, google_email")
      .eq("user_id", userId)
      .in("id", Array.from(freelanceIdsFromJunction));

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

  const unresolvedBookingIds = normalizedBookingIds.filter((bookingId) => {
    const hasEmails = (attendeeByBookingId[bookingId] || []).length > 0;
    if (hasEmails) return false;
    // If booking already has junction rows, do not fallback to legacy column.
    return !bookingIdsWithJunctionRow.has(bookingId);
  });

  if (unresolvedBookingIds.length === 0) {
    return attendeeByBookingId;
  }

  const legacyBookingFreelanceIdMap = await fetchLegacyBookingFreelanceIds({
    supabase,
    userId,
    bookingIds: unresolvedBookingIds,
  });

  const legacyFreelanceIds = normalizeUniqueIds(
    Object.values(legacyBookingFreelanceIdMap),
  );
  if (legacyFreelanceIds.length === 0) {
    return attendeeByBookingId;
  }

  const { data: legacyFreelanceRows, error: legacyFreelanceError } =
    await supabase
      .from("freelance")
      .select("id, google_email")
      .eq("user_id", userId)
      .in("id", legacyFreelanceIds);

  if (legacyFreelanceError) {
    throw new Error(
      `Gagal membaca email freelancer legacy: ${legacyFreelanceError.message || "Unknown error"}`,
    );
  }

  const legacyFreelanceEmailById: Record<string, string> = {};
  const rows = (legacyFreelanceRows || []) as Array<{
    id?: string | null;
    google_email?: string | null;
  }>;
  for (const row of rows) {
    const freelanceId = typeof row.id === "string" ? row.id.trim() : "";
    const email = normalizeEmail(row.google_email);
    if (!freelanceId || !email) continue;
    legacyFreelanceEmailById[freelanceId] = email;
  }

  for (const bookingId of unresolvedBookingIds) {
    const legacyFreelanceId = legacyBookingFreelanceIdMap[bookingId];
    if (!legacyFreelanceId) continue;
    const email = legacyFreelanceEmailById[legacyFreelanceId];
    attendeeByBookingId[bookingId] = email ? [email] : [];
  }

  return attendeeByBookingId;
}
