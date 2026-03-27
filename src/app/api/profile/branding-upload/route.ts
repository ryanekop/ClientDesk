import { NextRequest, NextResponse } from "next/server";
import { apiText } from "@/lib/i18n/api-errors";
import { invalidatePublicCachesForProfile } from "@/lib/public-cache-invalidation";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/utils/supabase/server";

type BrandingAssetType = "avatar" | "invoice_logo";

type ProfileRow = {
  id: string;
  vendor_slug: string | null;
  avatar_url: string | null;
  invoice_logo_url: string | null;
};

const BRANDING_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_BRANDING_BUCKET || "branding-assets";

const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

const MAX_SIZE_BY_ASSET: Record<BrandingAssetType, number> = {
  avatar: 1024 * 1024,
  invoice_logo: 500 * 1024,
};

const PROFILE_FIELD_BY_ASSET: Record<BrandingAssetType, "avatar_url" | "invoice_logo_url"> = {
  avatar: "avatar_url",
  invoice_logo: "invoice_logo_url",
};

function parseAssetType(value: unknown): BrandingAssetType | null {
  if (typeof value !== "string") return null;
  if (value === "avatar" || value === "invoice_logo") return value;
  return null;
}

function normalizeExtension(file: File) {
  const mimeType = (file.type || "").toLowerCase();
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return "jpg";

  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName === "png" || fromName === "webp" || fromName === "jpg" || fromName === "jpeg") {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  return "jpg";
}

function extractObjectPathFromPublicUrl(url: string | null | undefined) {
  const raw = (url || "").trim();
  if (!raw || raw.startsWith("data:")) return null;

  try {
    const parsed = new URL(raw);
    const marker = `/storage/v1/object/public/${BRANDING_BUCKET}/`;
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex < 0) return null;

    const objectPath = parsed.pathname.slice(markerIndex + marker.length);
    return decodeURIComponent(objectPath);
  } catch {
    return null;
  }
}

async function ensureBrandingBucket() {
  const service = createServiceClient();
  const { data: existing, error: existingError } = await service.storage.getBucket(
    BRANDING_BUCKET,
  );

  if (existing) {
    return;
  }

  if (existingError && !/not\s*found/i.test(existingError.message || "")) {
    throw existingError;
  }

  const { error: createError } = await service.storage.createBucket(
    BRANDING_BUCKET,
    {
      public: true,
      fileSizeLimit: 2 * 1024 * 1024,
      allowedMimeTypes: [...ALLOWED_MIME_TYPES],
    },
  );

  if (
    createError &&
    !/already\s+exists|duplicate/i.test(createError.message || "")
  ) {
    throw createError;
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: apiText(request, "unauthorized") },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const assetType = parseAssetType(formData.get("assetType"));
    const file = formData.get("file");

    if (!assetType) {
      return NextResponse.json(
        { success: false, error: apiText(request, "invalidAssetType") },
        { status: 400 },
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: apiText(request, "fileNotFound") },
        { status: 400 },
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
      return NextResponse.json(
        { success: false, error: apiText(request, "invalidImageMimePngJpgWebp") },
        { status: 400 },
      );
    }

    if (assetType === "invoice_logo" && file.type === "image/webp") {
      return NextResponse.json(
        { success: false, error: apiText(request, "invoiceLogoPngJpgOnly") },
        { status: 400 },
      );
    }

    const maxSize = MAX_SIZE_BY_ASSET[assetType];
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          success: false,
          error:
            assetType === "invoice_logo"
              ? apiText(request, "invoiceLogoTooLarge")
              : apiText(request, "avatarTooLarge"),
        },
        { status: 400 },
      );
    }

    const service = createServiceClient();
    const fallbackFullName = String(
      user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
    );

    await service.from("profiles").upsert(
      {
        id: user.id,
        full_name: fallbackFullName,
      },
      { onConflict: "id" },
    );

    const { data: profile } = await service
      .from("profiles")
      .select("id, vendor_slug, avatar_url, invoice_logo_url")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>();

    await ensureBrandingBucket();

    const extension = normalizeExtension(file);
    const objectPath = `${user.id}/${assetType}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await service.storage
      .from(BRANDING_BUCKET)
      .upload(objectPath, file, {
        contentType: file.type,
        upsert: false,
        cacheControl: "31536000",
      });

    if (uploadError) {
      return NextResponse.json(
        { success: false, error: uploadError.message || apiText(request, "uploadFailed") },
        { status: 500 },
      );
    }

    const { data: publicUrlData } = service.storage
      .from(BRANDING_BUCKET)
      .getPublicUrl(objectPath);
    const publicUrl = publicUrlData.publicUrl;

    const field = PROFILE_FIELD_BY_ASSET[assetType];
    const oldUrl = profile?.[field] || null;

    const { error: updateError } = await service
      .from("profiles")
      .update({ [field]: publicUrl })
      .eq("id", user.id);

    if (updateError) {
      await service.storage.from(BRANDING_BUCKET).remove([objectPath]);
      return NextResponse.json(
        { success: false, error: updateError.message || apiText(request, "failedSaveProfile") },
        { status: 500 },
      );
    }

    const oldObjectPath = extractObjectPathFromPublicUrl(oldUrl);
    if (oldObjectPath && oldObjectPath !== objectPath) {
      await service.storage.from(BRANDING_BUCKET).remove([oldObjectPath]);
    }

    invalidatePublicCachesForProfile({
      userId: user.id,
      vendorSlug: profile?.vendor_slug || null,
    });

    return NextResponse.json({
      success: true,
      url: publicUrl,
      field,
      bucket: BRANDING_BUCKET,
      objectPath,
    });
  } catch (error) {
    console.error("branding upload failed:", error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : apiText(request, "uploadFailed");
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
