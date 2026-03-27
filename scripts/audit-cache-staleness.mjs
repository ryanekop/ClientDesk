#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const SCAN_ROOTS = ["src/app", "src/components", "src/lib"];
const EXTENSIONS = new Set([".ts", ".tsx"]);

const PROFILE_UPDATE_RE = /\.from\((["'`])profiles\1\)\s*\.update\s*\(/g;
const BOOKING_UPDATE_RE = /\.from\((["'`])bookings\1\)\s*\.update\s*\(/g;

const PROFILE_INVALIDATION_SIGNALS = [
  /invalidatePublicCachesForProfile/,
  /invalidateProfilePublicCache/,
  /\/api\/internal\/cache\/invalidate/,
  /scope\s*:\s*(["'`])profile\1/,
];

const BOOKING_INVALIDATION_SIGNALS = [
  /invalidatePublicCachesForBooking/,
  /invalidateBookingPublicCache/,
  /\/api\/internal\/cache\/invalidate/,
  /scope\s*:\s*(["'`])booking\1/,
];

function walk(dirPath, out = []) {
  if (!fs.existsSync(dirPath)) return out;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(abs, out);
      continue;
    }
    if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) {
      out.push(abs);
    }
  }
  return out;
}

function findMatchLines(content, regex) {
  const matches = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const line = content.slice(0, match.index).split("\n").length;
    matches.push(line);
  }
  return matches;
}

function hasAnySignal(content, signals) {
  return signals.some((signal) => signal.test(content));
}

const allFiles = SCAN_ROOTS.flatMap((root) => walk(path.join(REPO_ROOT, root)));
const findings = [];

for (const filePath of allFiles) {
  const content = fs.readFileSync(filePath, "utf8");
  const profileUpdateLines = findMatchLines(content, PROFILE_UPDATE_RE);
  const bookingUpdateLines = findMatchLines(content, BOOKING_UPDATE_RE);

  if (profileUpdateLines.length === 0 && bookingUpdateLines.length === 0) {
    continue;
  }

  const hasProfileInvalidationSignal = hasAnySignal(
    content,
    PROFILE_INVALIDATION_SIGNALS,
  );
  const hasBookingInvalidationSignal = hasAnySignal(
    content,
    BOOKING_INVALIDATION_SIGNALS,
  );

  findings.push({
    path: path.relative(REPO_ROOT, filePath),
    profileUpdateLines,
    bookingUpdateLines,
    hasProfileInvalidationSignal,
    hasBookingInvalidationSignal,
    potentialProfileGap:
      profileUpdateLines.length > 0 && !hasProfileInvalidationSignal,
    potentialBookingGap:
      bookingUpdateLines.length > 0 && !hasBookingInvalidationSignal,
  });
}

const sorted = findings.sort((a, b) => a.path.localeCompare(b.path));
const potentialGaps = sorted.filter(
  (item) => item.potentialProfileGap || item.potentialBookingGap,
);

const useJson = process.argv.includes("--json");
const strictMode = process.argv.includes("--strict");

if (useJson) {
  console.log(
    JSON.stringify(
      {
        scannedFiles: allFiles.length,
        touchedFiles: sorted.length,
        potentialGapFiles: potentialGaps.length,
        findings: sorted,
      },
      null,
      2,
    ),
  );
} else {
  console.log("ClientDesk Cache Staleness Audit");
  console.log("===============================");
  console.log(`Scanned files       : ${allFiles.length}`);
  console.log(`Files with updates  : ${sorted.length}`);
  console.log(`Potential gap files : ${potentialGaps.length}`);
  console.log("");

  if (potentialGaps.length === 0) {
    console.log("No potential gap detected by static scan.");
  } else {
    console.log("Potential gaps:");
    for (const item of potentialGaps) {
      const gapKinds = [];
      if (item.potentialProfileGap) gapKinds.push("profiles");
      if (item.potentialBookingGap) gapKinds.push("bookings");
      console.log(`- ${item.path} [${gapKinds.join(", ")}]`);
      if (item.profileUpdateLines.length > 0) {
        console.log(
          `  profiles.update() lines: ${item.profileUpdateLines.join(", ")}`,
        );
      }
      if (item.bookingUpdateLines.length > 0) {
        console.log(
          `  bookings.update() lines: ${item.bookingUpdateLines.join(", ")}`,
        );
      }
    }
  }

  console.log("");
  console.log("Notes:");
  console.log(
    "- This is a static scan. 'Potential gap' means invalidation signal was not found in the same file.",
  );
  console.log(
    "- Confirm with runtime audit (DB updated_at + normal URL vs cache-bust URL).",
  );
}

if (strictMode && potentialGaps.length > 0) {
  process.exitCode = 1;
}

