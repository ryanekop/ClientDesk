import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SNAPSHOT_FILE = path.resolve(__dirname, "../data/university-references.json");
const BATCH_SIZE = 500;

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

function isSnapshotItem(value) {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof value.name === "string" &&
    typeof value.normalized_name === "string"
  );
}

async function loadSnapshot() {
  const raw = await readFile(SNAPSHOT_FILE, "utf8");
  const parsed = JSON.parse(raw);

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.items)) {
    throw new Error("Format snapshot universitas tidak valid.");
  }

  const items = parsed.items
    .filter(isSnapshotItem)
    .map((item) => ({
      name: cleanUniversityName(item.name),
      normalized_name: normalizeUniversityName(item.name),
      source: "kip_kuliah",
      last_seen_at:
        typeof item.last_seen_at === "string" && item.last_seen_at.trim().length > 0
          ? item.last_seen_at
          : typeof parsed.generatedAt === "string"
            ? parsed.generatedAt
            : new Date().toISOString(),
    }))
    .filter((item) => item.name.length >= 2 && item.normalized_name.length >= 2);

  if (items.length === 0) {
    throw new Error("Snapshot universitas kosong.");
  }

  const deduped = new Map();
  for (const item of items) {
    if (!deduped.has(item.normalized_name)) {
      deduped.set(item.normalized_name, item);
    }
  }

  return Array.from(deduped.values());
}

async function main() {
  const items = await loadSnapshot();
  let insertedCount = 0;
  let updatedCount = 0;
  let skippedManualCount = 0;

  const { data: existingRows, error: existingError } = await supabase
    .from("university_references")
    .select("normalized_name, source");

  if (existingError) {
    throw new Error(
      existingError.message || "Gagal membaca referensi universitas yang sudah ada.",
    );
  }

  const existingByNormalizedName = new Map(
    (existingRows || []).map((row) => [row.normalized_name, row]),
  );

  for (let index = 0; index < items.length; index += BATCH_SIZE) {
    const batch = items.slice(index, index + BATCH_SIZE);

    const rowsToWrite = [];
    for (const item of batch) {
      const existing = existingByNormalizedName.get(item.normalized_name);
      if (!existing) {
        insertedCount += 1;
        rowsToWrite.push(item);
        existingByNormalizedName.set(item.normalized_name, {
          normalized_name: item.normalized_name,
          source: item.source,
        });
        continue;
      }

      if (existing.source === "manual") {
        skippedManualCount += 1;
        continue;
      }

      updatedCount += 1;
      rowsToWrite.push(item);
      existingByNormalizedName.set(item.normalized_name, {
        normalized_name: item.normalized_name,
        source: item.source,
      });
    }

    if (rowsToWrite.length === 0) {
      continue;
    }

    const { error } = await supabase.from("university_references").upsert(rowsToWrite, {
      onConflict: "normalized_name",
    });

    if (error) {
      throw new Error(error.message || "Gagal menyimpan batch universitas.");
    }
  }

  console.log(
    [
      "Seed universitas selesai.",
      `Total snapshot: ${items.length}.`,
      `Insert baru: ${insertedCount}.`,
      `Update kip_kuliah: ${updatedCount}.`,
      `Lewati row manual: ${skippedManualCount}.`,
    ].join(" "),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
