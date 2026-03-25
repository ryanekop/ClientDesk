import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BRANDING_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_BRANDING_BUCKET || "branding-assets";
const FETCH_BATCH_SIZE = 250;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum tersedia.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function toString(value) {
  return typeof value === "string" ? value : "";
}

function isDataImageUri(value) {
  return /^data:image\//i.test(toString(value).trim());
}

function parseImageDataUri(value) {
  const raw = toString(value).trim();
  const match = raw.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/s);
  if (!match) {
    return null;
  }

  const imageType = match[1].toLowerCase();
  const base64Payload = match[2].replace(/\s+/g, "");
  const mimeType = `image/${imageType}`;

  let extension = "jpg";
  if (imageType === "png") extension = "png";
  else if (imageType === "webp") extension = "webp";
  else if (imageType === "jpeg" || imageType === "jpg") extension = "jpg";
  else return null;

  return {
    mimeType,
    extension,
    buffer: Buffer.from(base64Payload, "base64"),
  };
}

async function ensureBrandingBucket() {
  const { data: bucket, error: bucketError } = await supabase.storage.getBucket(
    BRANDING_BUCKET,
  );

  if (bucket) return;

  if (bucketError && !/not\s*found/i.test(bucketError.message || "")) {
    throw new Error(bucketError.message || "Gagal membaca bucket branding.");
  }

  const { error: createError } = await supabase.storage.createBucket(
    BRANDING_BUCKET,
    {
      public: true,
      fileSizeLimit: 2 * 1024 * 1024,
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    },
  );

  if (
    createError &&
    !/already\s+exists|duplicate/i.test(createError.message || "")
  ) {
    throw new Error(createError.message || "Gagal membuat bucket branding.");
  }
}

function buildObjectPath(profileId, assetType, extension) {
  return `${profileId}/${assetType}/legacy-${Date.now()}-${crypto.randomUUID()}.${extension}`;
}

async function uploadDataUriToStorage(profileId, assetType, dataUriValue) {
  const parsed = parseImageDataUri(dataUriValue);
  if (!parsed) {
    return {
      ok: false,
      reason: "invalid-data-uri",
    };
  }

  if (assetType === "invoice_logo" && parsed.mimeType === "image/webp") {
    return {
      ok: false,
      reason: "unsupported-webp-invoice-logo",
    };
  }

  const objectPath = buildObjectPath(profileId, assetType, parsed.extension);
  const { error: uploadError } = await supabase.storage
    .from(BRANDING_BUCKET)
    .upload(objectPath, parsed.buffer, {
      contentType: parsed.mimeType,
      upsert: false,
      cacheControl: "31536000",
    });

  if (uploadError) {
    return {
      ok: false,
      reason: uploadError.message || "upload-error",
    };
  }

  const { data: publicUrlData } = supabase.storage
    .from(BRANDING_BUCKET)
    .getPublicUrl(objectPath);

  return {
    ok: true,
    publicUrl: publicUrlData.publicUrl,
  };
}

async function fetchProfilesBatch(start, end) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, avatar_url, invoice_logo_url")
    .order("id", { ascending: true })
    .range(start, end);

  if (error) {
    throw new Error(error.message || "Gagal membaca data profiles.");
  }

  return Array.isArray(data) ? data : [];
}

async function main() {
  await ensureBrandingBucket();

  let scanned = 0;
  let candidateRows = 0;
  let updatedRows = 0;
  let avatarMigrated = 0;
  let invoiceLogoMigrated = 0;
  let skippedUnsupportedInvoiceWebp = 0;
  const errors = [];

  for (let start = 0; ; start += FETCH_BATCH_SIZE) {
    const end = start + FETCH_BATCH_SIZE - 1;
    const rows = await fetchProfilesBatch(start, end);
    if (rows.length === 0) break;

    for (const row of rows) {
      scanned += 1;
      const avatarRaw = toString(row.avatar_url);
      const invoiceLogoRaw = toString(row.invoice_logo_url);

      const hasAvatarDataUri = isDataImageUri(avatarRaw);
      const hasInvoiceLogoDataUri = isDataImageUri(invoiceLogoRaw);

      if (!hasAvatarDataUri && !hasInvoiceLogoDataUri) {
        continue;
      }

      candidateRows += 1;
      const patch = {};

      if (hasAvatarDataUri) {
        const avatarUpload = await uploadDataUriToStorage(
          row.id,
          "avatar",
          avatarRaw,
        );
        if (avatarUpload.ok) {
          patch.avatar_url = avatarUpload.publicUrl;
          avatarMigrated += 1;
        } else {
          errors.push(`avatar ${row.id}: ${avatarUpload.reason}`);
        }
      }

      if (hasInvoiceLogoDataUri) {
        const logoUpload = await uploadDataUriToStorage(
          row.id,
          "invoice_logo",
          invoiceLogoRaw,
        );
        if (logoUpload.ok) {
          patch.invoice_logo_url = logoUpload.publicUrl;
          invoiceLogoMigrated += 1;
        } else if (logoUpload.reason === "unsupported-webp-invoice-logo") {
          skippedUnsupportedInvoiceWebp += 1;
        } else {
          errors.push(`invoice_logo ${row.id}: ${logoUpload.reason}`);
        }
      }

      if (Object.keys(patch).length === 0) {
        continue;
      }

      patch.updated_at = new Date().toISOString();

      const { error: updateError } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", row.id);

      if (updateError) {
        errors.push(`update ${row.id}: ${updateError.message || "unknown-error"}`);
        continue;
      }

      updatedRows += 1;
    }

    if (rows.length < FETCH_BATCH_SIZE) {
      break;
    }
  }

  console.log(
    [
      "Backfill branding selesai.",
      `Scanned profiles: ${scanned}.`,
      `Candidate rows: ${candidateRows}.`,
      `Updated rows: ${updatedRows}.`,
      `Avatar migrated: ${avatarMigrated}.`,
      `Invoice logo migrated: ${invoiceLogoMigrated}.`,
      `Skipped invoice WEBP: ${skippedUnsupportedInvoiceWebp}.`,
      `Errors: ${errors.length}.`,
    ].join(" "),
  );

  if (errors.length > 0) {
    console.log("Contoh error:");
    errors.slice(0, 10).forEach((entry) => console.log(`- ${entry}`));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
