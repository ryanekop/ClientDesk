#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TARGET_DIRS = [
  "src/app/[locale]/(app)",
  "src/app/api",
  "src/components",
];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

const EXCLUDED_PREFIXES = [
  "src/app/[locale]/formbooking/",
  "src/app/[locale]/settlement/",
  "src/app/[locale]/track/",
  "src/app/api/public/",
  "src/components/public/",
  "src/components/landing/",
];

const INDONESIAN_KEYWORD_RE =
  /\b(gagal|berhasil|memuat|simpan|hapus|pilih|tutup|selesai|silakan|belum|tidak(?:\s+ada)?|terhubung|terautentikasi|pengaturan|pelunasan|lokasi|tanggal|jam|contoh|daftar|klien|wajib|ditemukan|kembali|minimal|maksimal|unggah)\b/i;

const QUOTED_STRING_RE =
  /(["'`])((?:\\.|(?!\1).)*)\1/g;

function isExcluded(relativePath) {
  return EXCLUDED_PREFIXES.some((prefix) => relativePath.startsWith(prefix));
}

async function walk(directory, output = []) {
  const absolute = path.join(ROOT, directory);
  let entries = [];
  try {
    entries = await fs.readdir(absolute, { withFileTypes: true });
  } catch {
    return output;
  }

  for (const entry of entries) {
    const rel = path.posix.join(directory, entry.name);
    if (isExcluded(rel)) continue;

    if (entry.isDirectory()) {
      await walk(rel, output);
      continue;
    }

    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;
    output.push(rel);
  }

  return output;
}

function hasLikelyUiSentence(value) {
  const normalized = value.trim();
  if (!normalized) return false;
  if (/^https?:\/\//i.test(normalized)) return false;
  if (normalized.startsWith("/")) return false;
  if (!/[a-zA-Z]/.test(normalized)) return false;

  // Skip likely internal keys/constants.
  if (/^[A-Za-z0-9_.:-]+$/.test(normalized)) return false;

  // Prefer phrases to reduce false positives from enum-like values.
  return normalized.includes(" ") || normalized.length >= 14;
}

function collectFindings(content, filePath) {
  const findings = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const match of line.matchAll(QUOTED_STRING_RE)) {
      const candidate = (match[2] || "").trim();
      if (!hasLikelyUiSentence(candidate)) continue;
      if (!INDONESIAN_KEYWORD_RE.test(candidate)) continue;

      findings.push({
        file: filePath,
        line: index + 1,
        text: candidate,
      });
    }
  });

  return findings;
}

async function main() {
  const files = (
    await Promise.all(TARGET_DIRS.map((dir) => walk(dir)))
  ).flat();

  const findings = [];

  for (const file of files) {
    const absolute = path.join(ROOT, file);
    const content = await fs.readFile(absolute, "utf8");
    findings.push(...collectFindings(content, file));
  }

  if (findings.length === 0) {
    console.log("i18n-audit-internal: 0 findings");
    process.exit(0);
  }

  console.log(`i18n-audit-internal: ${findings.length} findings`);
  findings.forEach((item) => {
    console.log(`${item.file}:${item.line} -> ${item.text}`);
  });
  process.exit(1);
}

main().catch((error) => {
  console.error("i18n-audit-internal: failed to run audit");
  console.error(error);
  process.exit(1);
});
