import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FETCH_BATCH_SIZE = 500;
const UPDATE_BATCH_SIZE = 100;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum tersedia.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function cleanUniversityName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeUniversityName(value) {
  return cleanUniversityName(value).toLowerCase();
}

function cleanUniversityAbbreviation(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function buildUniversityDisplayName(name, abbreviation) {
  const cleanedName = cleanUniversityName(name);
  const cleanedAbbreviation = cleanUniversityAbbreviation(abbreviation);
  if (!cleanedName) return "";
  if (!cleanedAbbreviation) return cleanedName;
  return `${cleanedName} (${cleanedAbbreviation})`;
}

function toExtraFieldsRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return { ...value };
}

function getStringField(record, key) {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

async function fetchAllRows(table, select, queryBuilder) {
  const rows = [];

  for (let start = 0; ; start += FETCH_BATCH_SIZE) {
    let query = supabase
      .from(table)
      .select(select)
      .order("id", { ascending: true })
      .range(start, start + FETCH_BATCH_SIZE - 1);
    if (typeof queryBuilder === "function") {
      query = queryBuilder(query);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message || `Gagal membaca data dari ${table}.`);
    }

    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);

    if (batch.length < FETCH_BATCH_SIZE) {
      break;
    }
  }

  return rows;
}

async function main() {
  const bookings = await fetchAllRows(
    "bookings",
    "id, event_type, extra_fields",
    (query) => query.eq("event_type", "Wisuda").not("extra_fields", "is", null),
  );
  const references = await fetchAllRows(
    "university_references",
    "id, name, abbreviation, normalized_name",
  );

  const referenceByNormalizedName = new Map(
    references
      .filter(
        (row) =>
          row &&
          typeof row.id === "string" &&
          typeof row.name === "string" &&
          typeof row.normalized_name === "string" &&
          row.normalized_name.trim().length > 0,
      )
      .map((row) => [row.normalized_name, row]),
  );

  let skippedWithRefId = 0;
  let noMatchCount = 0;
  let resolvedCount = 0;
  const rowsToUpdate = [];

  for (const booking of bookings) {
    const extraFields = toExtraFieldsRecord(booking.extra_fields);
    const currentUniversityName = cleanUniversityName(
      getStringField(extraFields, "universitas"),
    );
    const currentUniversityRefId = getStringField(extraFields, "universitas_ref_id").trim();

    if (!currentUniversityName) {
      continue;
    }

    if (currentUniversityRefId) {
      skippedWithRefId += 1;
      continue;
    }

    const matchedReference = referenceByNormalizedName.get(
      normalizeUniversityName(currentUniversityName),
    );

    if (!matchedReference) {
      noMatchCount += 1;
      continue;
    }

    const nextExtraFields = {
      ...extraFields,
      universitas: buildUniversityDisplayName(
        matchedReference.name,
        matchedReference.abbreviation,
      ),
      universitas_ref_id: matchedReference.id,
    };

    rowsToUpdate.push({
      id: booking.id,
      extra_fields: nextExtraFields,
    });
  }

  for (let index = 0; index < rowsToUpdate.length; index += UPDATE_BATCH_SIZE) {
    const batch = rowsToUpdate.slice(index, index + UPDATE_BATCH_SIZE);

    await Promise.all(
      batch.map(async (row) => {
        const { error } = await supabase
          .from("bookings")
          .update({ extra_fields: row.extra_fields })
          .eq("id", row.id);

        if (error) {
          throw new Error(error.message || `Gagal memperbarui booking ${row.id}.`);
        }
      }),
    );

    resolvedCount += batch.length;
  }

  console.log(
    [
      "Backfill universitas selesai.",
      `Total kandidat: ${rowsToUpdate.length + noMatchCount}.`,
      `Berhasil di-resolve: ${resolvedCount}.`,
      `Dilewati karena sudah punya ref id: ${skippedWithRefId}.`,
      `Tidak match exact: ${noMatchCount}.`,
    ].join(" "),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
