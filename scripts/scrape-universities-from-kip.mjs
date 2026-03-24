import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KIP_BASE_URL = "https://kip-kuliah.kemdiktisaintek.go.id";
const PAGE_SIZE = 100;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_FILE = path.resolve(__dirname, "../data/university-references.json");

function cleanUniversityName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeUniversityName(value) {
  return cleanUniversityName(value).toLowerCase();
}

function mergeCookies(existingCookies, response) {
  const cookieMap = new Map(existingCookies);
  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];

  for (const cookie of setCookies) {
    const [pair] = cookie.split(";");
    const dividerIndex = pair.indexOf("=");
    if (dividerIndex <= 0) continue;
    const name = pair.slice(0, dividerIndex).trim();
    const value = pair.slice(dividerIndex + 1).trim();
    if (!name) continue;
    cookieMap.set(name, value);
  }

  return cookieMap;
}

function stringifyCookies(cookieMap) {
  return Array.from(cookieMap.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function buildDataTablePayload(token, start, length) {
  const params = new URLSearchParams();
  params.set("_token", token);
  params.set("draw", String(Math.floor(start / length) + 1));
  params.set("start", String(start));
  params.set("length", String(length));
  params.set("search[value]", "");
  params.set("search[regex]", "false");
  params.set("order[0][column]", "1");
  params.set("order[0][dir]", "asc");

  const columns = [
    "no",
    "nama_pt",
    "nama_prodi",
    "jenjang",
    "akreditasi_prodi",
    "options",
  ];

  columns.forEach((columnName, index) => {
    params.set(`columns[${index}][data]`, columnName);
    params.set(`columns[${index}][name]`, "");
    params.set(`columns[${index}][searchable]`, "true");
    params.set(`columns[${index}][orderable]`, "true");
    params.set(`columns[${index}][search][value]`, "");
    params.set(`columns[${index}][search][regex]`, "false");
  });

  return params;
}

async function fetchKipSession() {
  const response = await fetch(`${KIP_BASE_URL}/`, {
    headers: {
      "User-Agent": "ClientDesk University Snapshot Generator/1.0",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Gagal memuat homepage KIP Kuliah (HTTP ${response.status}).`);
  }

  const html = await response.text();
  const tokenMatch = html.match(/_token:\s*"([^"]+)"/);
  const token = tokenMatch?.[1]?.trim() || "";
  if (!token) {
    throw new Error("CSRF token KIP Kuliah tidak ditemukan.");
  }

  return {
    token,
    cookies: mergeCookies(new Map(), response),
  };
}

async function fetchKipPage({ token, cookies, start, length }) {
  const response = await fetch(`${KIP_BASE_URL}/prodijson`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Origin: KIP_BASE_URL,
      Referer: `${KIP_BASE_URL}/`,
      Cookie: stringifyCookies(cookies),
      "User-Agent": "ClientDesk University Snapshot Generator/1.0",
      Accept: "application/json,text/plain,*/*",
    },
    body: buildDataTablePayload(token, start, length),
  });

  if (!response.ok) {
    throw new Error(`Gagal mengambil data universitas KIP Kuliah (HTTP ${response.status}).`);
  }

  const payload = await response.json();
  if (!payload || !Array.isArray(payload.data)) {
    throw new Error("Response KIP Kuliah tidak valid.");
  }

  return payload;
}

async function main() {
  const { token, cookies } = await fetchKipSession();
  const deduped = new Map();
  const generatedAt = new Date().toISOString();

  for (let start = 0; ; start += PAGE_SIZE) {
    const payload = await fetchKipPage({
      token,
      cookies,
      start,
      length: PAGE_SIZE,
    });

    const rows = Array.isArray(payload.data) ? payload.data : [];
    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const name = cleanUniversityName(row?.nama_pt);
      if (!name) continue;
      deduped.set(normalizeUniversityName(name), name);
    }

    const totalFiltered = Number(payload.recordsFiltered || payload.recordsTotal || 0);
    if (start + rows.length >= totalFiltered) {
      break;
    }
  }

  const items = Array.from(deduped.entries())
    .sort((left, right) => left[1].localeCompare(right[1], "id"))
    .map(([normalizedName, name]) => ({
      name,
      normalized_name: normalizedName,
      source: "kip_kuliah",
      last_seen_at: generatedAt,
    }));

  const snapshot = {
    generatedAt,
    source: "kip_kuliah",
    totalUnique: items.length,
    items,
  };

  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  console.log(
    `Snapshot universitas berhasil dibuat di ${OUTPUT_FILE}. Total universitas unik: ${items.length}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
