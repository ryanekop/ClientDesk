import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  FASTPIK_SYNC_CHUNK_SIZE,
  syncBookingsToFastpikInChunks,
} from "@/lib/fastpik-integration/server";

export const dynamic = "force-dynamic";

type SyncBatchPayload = {
  locale?: string;
  chunkSize?: number;
};

function sanitizeChunkSize(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return FASTPIK_SYNC_CHUNK_SIZE;
  if (parsed <= 0) return FASTPIK_SYNC_CHUNK_SIZE;
  return Math.floor(parsed);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Tidak terautentikasi." },
        { status: 401 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as SyncBatchPayload;
    const locale = typeof body.locale === "string" ? body.locale : "id";
    const chunkSize = sanitizeChunkSize(body.chunkSize);

    const result = await syncBookingsToFastpikInChunks({
      supabase,
      userId: user.id,
      locale,
      chunkSize,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Gagal batch sync ke Fastpik.",
      },
      { status: 500 },
    );
  }
}
