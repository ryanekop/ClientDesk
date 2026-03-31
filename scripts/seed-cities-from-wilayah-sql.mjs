import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SOURCE_URL =
  process.env.CITY_REFERENCE_SOURCE_URL ||
  "https://raw.githubusercontent.com/cahyadsn/wilayah/master/db/wilayah_level_1_2.sql";
const SOURCE_LABEL = "cahyadsn/wilayah";
const UPSERT_BATCH_SIZE = 500;
const DELETE_BATCH_SIZE = 200;

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

function cleanSqlText(value) {
  return String(value || "")
    .replace(/''/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSourceUpdatedAt(sqlText) {
  const match = sqlText.match(
    /last\s+edit\s*:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})\s+([0-9]{2}:[0-9]{2}:[0-9]{2})/i,
  );
  if (!match) return null;
  const isoLike = `${match[1]}T${match[2]}+07:00`;
  const parsed = new Date(isoLike);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function parseRows(sqlText) {
  const provinceByCode = new Map();
  const cityByCode = new Map();
  const rowRegex = /\('([0-9]{2}(?:\.[0-9]{2})?)','((?:''|[^'])*)','/g;

  let match = rowRegex.exec(sqlText);
  while (match) {
    const code = match[1];
    const name = cleanSqlText(match[2]);

    if (name.length > 0) {
      if (/^[0-9]{2}$/.test(code)) {
        provinceByCode.set(code, name);
      } else if (/^[0-9]{2}\.[0-9]{2}$/.test(code)) {
        const provinceCode = code.slice(0, 2);
        const cityCode = code.replace(".", "");
        cityByCode.set(cityCode, {
          city_code: cityCode,
          city_name: name,
          province_code: provinceCode,
        });
      }
    }

    match = rowRegex.exec(sqlText);
  }

  const rows = Array.from(cityByCode.values())
    .map((row) => ({
      ...row,
      province_name: provinceByCode.get(row.province_code) || "",
      source: SOURCE_LABEL,
    }))
    .filter(
      (row) =>
        row.city_code.length === 4 &&
        row.province_code.length === 2 &&
        row.city_name.length > 0 &&
        row.province_name.length > 0,
    )
    .sort((left, right) => {
      const provinceDiff = left.province_code.localeCompare(right.province_code);
      if (provinceDiff !== 0) return provinceDiff;
      return left.city_name.localeCompare(right.city_name);
    });

  return rows;
}

function splitChunks(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function fetchSqlText() {
  const response = await fetch(SOURCE_URL, {
    headers: {
      "user-agent": "clientdesk-city-seeder",
      accept: "text/plain",
    },
  });

  if (!response.ok) {
    throw new Error(`Gagal mengambil sumber wilayah (${response.status}).`);
  }

  return response.text();
}

async function upsertRows(rows, sourceUpdatedAt) {
  let totalUpserted = 0;
  for (const chunk of splitChunks(rows, UPSERT_BATCH_SIZE)) {
    const payload = chunk.map((row) => ({
      ...row,
      source_updated_at: sourceUpdatedAt,
    }));

    const { error } = await supabase.from("region_city_references").upsert(payload, {
      onConflict: "city_code",
    });

    if (error) {
      throw new Error(error.message || "Gagal menyimpan referensi kota/kabupaten.");
    }

    totalUpserted += chunk.length;
  }

  return totalUpserted;
}

async function removeStaleRows(currentCityCodes) {
  const { data: existingRows, error: existingError } = await supabase
    .from("region_city_references")
    .select("city_code")
    .eq("source", SOURCE_LABEL);

  if (existingError) {
    throw new Error(
      existingError.message || "Gagal membaca data referensi kota/kabupaten saat ini.",
    );
  }

  const nextCodes = new Set(currentCityCodes);
  const staleCodes = (existingRows || [])
    .map((row) => row.city_code)
    .filter((cityCode) => typeof cityCode === "string" && !nextCodes.has(cityCode));

  let deleted = 0;
  for (const chunk of splitChunks(staleCodes, DELETE_BATCH_SIZE)) {
    const { error } = await supabase
      .from("region_city_references")
      .delete()
      .in("city_code", chunk);

    if (error) {
      throw new Error(error.message || "Gagal menghapus data wilayah yang sudah stale.");
    }

    deleted += chunk.length;
  }

  return deleted;
}

async function main() {
  const sqlText = await fetchSqlText();
  const sourceUpdatedAt = parseSourceUpdatedAt(sqlText);
  const rows = parseRows(sqlText);

  if (rows.length === 0) {
    throw new Error("Tidak ada data kota/kabupaten yang bisa diproses dari sumber wilayah.");
  }

  const upserted = await upsertRows(rows, sourceUpdatedAt);
  const deleted = await removeStaleRows(rows.map((row) => row.city_code));

  console.log(
    [
      "Seed kota/kabupaten selesai.",
      `Sumber: ${SOURCE_URL}.`,
      `Data aktif: ${rows.length}.`,
      `Upsert: ${upserted}.`,
      `Hapus stale: ${deleted}.`,
      `Last edit sumber: ${sourceUpdatedAt || "tidak terdeteksi"}.`,
    ].join(" "),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
