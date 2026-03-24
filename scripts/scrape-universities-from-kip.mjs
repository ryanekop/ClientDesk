import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KIP_BASE_URL = "https://kip-kuliah.kemdiktisaintek.go.id";
const PAGE_SIZE = 100;
const USER_AGENT = "Mozilla/5.0 (compatible; ClientDesk/1.0; +https://clientdesk.app)";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_FILE = path.resolve(__dirname, "../data/university-references.json");
const WIKIPEDIA_RAW_URLS = {
  wikipedia_kedinasan:
    "https://id.wikipedia.org/w/index.php?title=Daftar_perguruan_tinggi_kementerian_dan_lembaga_di_Indonesia&action=raw",
  wikipedia_poltekkes:
    "https://id.wikipedia.org/w/index.php?title=Daftar_Politeknik_Kesehatan_Kementerian_Kesehatan_di_Indonesia&action=raw",
  wikipedia_ptn:
    "https://id.wikipedia.org/w/index.php?title=Daftar_perguruan_tinggi_negeri_di_Indonesia&action=raw",
  wikipedia_ptkn:
    "https://id.wikipedia.org/w/index.php?title=Daftar_perguruan_tinggi_keagamaan_negeri_di_Indonesia&action=raw",
};

function cleanUniversityName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeUniversityName(value) {
  return cleanUniversityName(value).toLowerCase();
}

function cleanUniversityAbbreviation(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeUniversityAbbreviation(value) {
  return cleanUniversityAbbreviation(value).toLowerCase();
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

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Gagal memuat ${url} (HTTP ${response.status}).`);
  }

  return response.text();
}

async function fetchKipSession() {
  const response = await fetch(`${KIP_BASE_URL}/`, {
    headers: {
      "User-Agent": USER_AGENT,
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
      "User-Agent": USER_AGENT,
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

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function splitWikiCells(input, delimiter) {
  const result = [];
  let current = "";
  let squareDepth = 0;
  let curlyDepth = 0;

  for (let index = 0; index < input.length; index += 1) {
    const nextTwo = input.slice(index, index + 2);
    if (nextTwo === "[[") {
      squareDepth += 1;
      current += nextTwo;
      index += 1;
      continue;
    }
    if (nextTwo === "]]") {
      squareDepth = Math.max(0, squareDepth - 1);
      current += nextTwo;
      index += 1;
      continue;
    }
    if (nextTwo === "{{") {
      curlyDepth += 1;
      current += nextTwo;
      index += 1;
      continue;
    }
    if (nextTwo === "}}") {
      curlyDepth = Math.max(0, curlyDepth - 1);
      current += nextTwo;
      index += 1;
      continue;
    }
    if (
      input.slice(index, index + delimiter.length) === delimiter &&
      squareDepth === 0 &&
      curlyDepth === 0
    ) {
      result.push(current);
      current = "";
      index += delimiter.length - 1;
      continue;
    }
    current += input[index];
  }

  result.push(current);
  return result;
}

function stripCellDecorators(value) {
  let result = String(value || "");
  const prefixPattern =
    /^\s*(?:style|class|align|data-sort-value|data-sort-type|width|rowspan|colspan|scope|bgcolor|valign|font-size|height)[^|]*\|/i;

  while (prefixPattern.test(result)) {
    result = result.replace(prefixPattern, "");
  }

  return result;
}

function stripTemplateWrappers(value) {
  let result = String(value || "");
  const wrapperPattern =
    /\{\{(?:small|Small|nowrap|Nowrap|nobr|Nobr|abbr|Abbr)\|([^{}]+)\}\}/g;
  let previous = "";
  while (previous !== result) {
    previous = result;
    result = result.replace(wrapperPattern, "$1");
  }

  return result.replace(/\{\{[^{}]*\}\}/g, " ");
}

function cleanWikiCell(value) {
  let result = stripCellDecorators(value);
  result = result.replace(/<!--[\s\S]*?-->/g, " ");
  result = result.replace(/<ref[^>]*\/>/gi, " ");
  result = result.replace(/<ref[\s\S]*?<\/ref>/gi, " ");
  result = result.replace(/<br\s*\/?>/gi, " ");
  result = stripTemplateWrappers(result);
  result = result.replace(
    /\[(https?:\/\/[^\s\]]+)\s+([^\]]+)\]/g,
    (_match, _url, label) => label,
  );
  result = result.replace(/\[(https?:\/\/[^\]]+)\]/g, " ");
  result = result.replace(
    /\[\[(?:[^[\]]*?\|)?([^[\]]+)\]\]/g,
    (_match, label) => label,
  );
  result = result.replace(/'''?/g, "");
  result = result.replace(/<\/?[^>]+>/g, " ");
  result = decodeHtmlEntities(result);
  result = result.replace(/[{}[\]]/g, " ");
  result = result.replace(/\s+/g, " ").trim();
  return result;
}

function normalizeHeader(value) {
  return cleanWikiCell(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function extractWikiTables(raw) {
  const tables = [];
  const lines = raw.split(/\r?\n/);
  let current = [];
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("{|")) {
      inTable = true;
      current = [line];
      continue;
    }
    if (!inTable) continue;

    current.push(line);
    if (trimmed.startsWith("|}")) {
      tables.push(current.join("\n"));
      current = [];
      inTable = false;
    }
  }

  return tables;
}

function parseWikiTable(tableText) {
  const headers = [];
  const rows = [];
  const lines = tableText.split(/\r?\n/);
  let currentRow = [];

  const finalizeRow = () => {
    if (currentRow.length === 0) return;
    rows.push(currentRow.map(cleanWikiCell));
    currentRow = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("{|") || trimmed.startsWith("|+")) {
      continue;
    }

    if (trimmed.startsWith("|-")) {
      finalizeRow();
      continue;
    }

    if (trimmed.startsWith("|}")) {
      finalizeRow();
      break;
    }

    if (trimmed.startsWith("!") && currentRow.length === 0) {
      headers.push(
        ...splitWikiCells(trimmed.slice(1), "!!").map((cell) => cleanWikiCell(cell)),
      );
      continue;
    }

    if (trimmed.startsWith("|")) {
      currentRow.push(...splitWikiCells(trimmed.slice(1), "||"));
      continue;
    }

    if (currentRow.length > 0) {
      currentRow[currentRow.length - 1] += ` ${trimmed}`;
    }
  }

  return {
    headers,
    rows,
  };
}

function findHeaderIndex(headers, candidates) {
  const normalizedHeaders = headers.map(normalizeHeader);
  return normalizedHeaders.findIndex((header) =>
    candidates.some((candidate) => header.includes(candidate)),
  );
}

function createSnapshotItem({
  name,
  abbreviation,
  source,
  lastSeenAt,
}) {
  const cleanedName = cleanUniversityName(name);
  const cleanedAbbreviation = cleanUniversityAbbreviation(abbreviation);
  if (!cleanedName) return null;

  return {
    name: cleanedName,
    normalized_name: normalizeUniversityName(cleanedName),
    abbreviation: cleanedAbbreviation || null,
    normalized_abbreviation: cleanedAbbreviation
      ? normalizeUniversityAbbreviation(cleanedAbbreviation)
      : null,
    source,
    last_seen_at: lastSeenAt,
  };
}

function abbreviationPriority(source, abbreviation) {
  if (!cleanUniversityAbbreviation(abbreviation)) return 0;
  if (
    source === "wikipedia_kedinasan" ||
    source === "wikipedia_ptn" ||
    source === "wikipedia_ptkn"
  ) {
    return 2;
  }
  if (source === "wikipedia_poltekkes") return 1;
  return 0;
}

function upsertSnapshotItem(store, item) {
  if (!item) return;

  const existing = store.get(item.normalized_name);
  if (!existing) {
    store.set(item.normalized_name, {
      ...item,
      _abbreviationPriority: abbreviationPriority(item.source, item.abbreviation),
    });
    return;
  }

  const next = { ...existing };
  if (!next.name && item.name) {
    next.name = item.name;
    next.normalized_name = item.normalized_name;
  }

  const currentPriority = existing._abbreviationPriority || 0;
  const incomingPriority = abbreviationPriority(item.source, item.abbreviation);
  if (
    cleanUniversityAbbreviation(item.abbreviation) &&
    (
      !cleanUniversityAbbreviation(existing.abbreviation) ||
      incomingPriority > currentPriority
    )
  ) {
    next.abbreviation = item.abbreviation;
    next.normalized_abbreviation = item.normalized_abbreviation;
    next._abbreviationPriority = incomingPriority;
  }

  next.last_seen_at = item.last_seen_at;
  store.set(item.normalized_name, next);
}

function parseUniversityTablesWithAbbreviation(raw, source, generatedAt) {
  const results = [];

  for (const table of extractWikiTables(raw)) {
    const parsed = parseWikiTable(table);
    const nameIndex = findHeaderIndex(parsed.headers, ["nama"]);
    const abbreviationIndex = findHeaderIndex(parsed.headers, [
      "akronim",
      "singkatan",
      "singkat",
    ]);
    if (nameIndex < 0 || abbreviationIndex < 0) {
      continue;
    }

    for (const row of parsed.rows) {
      const name = cleanUniversityName(row[nameIndex] || "");
      const abbreviation = cleanUniversityAbbreviation(row[abbreviationIndex] || "");
      if (!name || !abbreviation) continue;

      const item = createSnapshotItem({
        name,
        abbreviation,
        source,
        lastSeenAt: generatedAt,
      });
      if (item) results.push(item);
    }
  }

  return results;
}

function parsePoltekkesRows(raw, generatedAt) {
  const results = [];

  for (const table of extractWikiTables(raw)) {
    const parsed = parseWikiTable(table);
    const nameIndex = findHeaderIndex(parsed.headers, ["politeknikkesehatan"]);
    if (nameIndex < 0) {
      continue;
    }

    for (const row of parsed.rows) {
      const location = cleanUniversityName(row[nameIndex] || "");
      if (!location) continue;

      const item = createSnapshotItem({
        name: `Politeknik Kesehatan Kementerian Kesehatan ${location}`,
        abbreviation: `Poltekkes Kemenkes ${location}`,
        source: "wikipedia_poltekkes",
        lastSeenAt: generatedAt,
      });
      if (item) results.push(item);
    }
  }

  return results;
}

async function main() {
  const generatedAt = new Date().toISOString();
  const store = new Map();

  const { token, cookies } = await fetchKipSession();
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
      upsertSnapshotItem(
        store,
        createSnapshotItem({
          name: row?.nama_pt,
          abbreviation: null,
          source: "kip_kuliah",
          lastSeenAt: generatedAt,
        }),
      );
    }

    const totalFiltered = Number(payload.recordsFiltered || payload.recordsTotal || 0);
    if (start + rows.length >= totalFiltered) {
      break;
    }
  }

  const kedinasanRaw = await fetchText(WIKIPEDIA_RAW_URLS.wikipedia_kedinasan);
  parseUniversityTablesWithAbbreviation(
    kedinasanRaw,
    "wikipedia_kedinasan",
    generatedAt,
  ).forEach((item) => upsertSnapshotItem(store, item));

  const ptnRaw = await fetchText(WIKIPEDIA_RAW_URLS.wikipedia_ptn);
  parseUniversityTablesWithAbbreviation(
    ptnRaw,
    "wikipedia_ptn",
    generatedAt,
  ).forEach((item) => upsertSnapshotItem(store, item));

  const ptknRaw = await fetchText(WIKIPEDIA_RAW_URLS.wikipedia_ptkn);
  parseUniversityTablesWithAbbreviation(
    ptknRaw,
    "wikipedia_ptkn",
    generatedAt,
  ).forEach((item) => upsertSnapshotItem(store, item));

  const poltekkesRaw = await fetchText(WIKIPEDIA_RAW_URLS.wikipedia_poltekkes);
  parsePoltekkesRows(poltekkesRaw, generatedAt).forEach((item) =>
    upsertSnapshotItem(store, item),
  );

  const items = Array.from(store.values())
    .map((item) => {
      const next = { ...item };
      delete next._abbreviationPriority;
      return next;
    })
    .sort((left, right) => left.name.localeCompare(right.name, "id"));

  const snapshot = {
    generatedAt,
    sources: [
      "kip_kuliah",
      "wikipedia_kedinasan",
      "wikipedia_poltekkes",
      "wikipedia_ptn",
      "wikipedia_ptkn",
    ],
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
