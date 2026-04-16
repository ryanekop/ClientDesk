import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  getTelegramTestMessage,
} from "@/lib/telegram-notifications";
import { sendTelegramMessage } from "@/utils/telegram";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Sesi login tidak ditemukan." },
        { status: 401 },
      );
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, studio_name, telegram_chat_id, telegram_language")
      .eq("id", user.id)
      .single();

    if (error || !profile) {
      return NextResponse.json(
        { success: false, message: error?.message || "Profil tidak ditemukan." },
        { status: 404 },
      );
    }

    const chatId =
      typeof profile.telegram_chat_id === "string"
        ? profile.telegram_chat_id.trim()
        : "";
    if (!chatId) {
      return NextResponse.json(
        { success: false, message: "Telegram Chat ID belum diisi." },
        { status: 400 },
      );
    }

    const result = await sendTelegramMessage(
      chatId,
      getTelegramTestMessage(profile),
    );
    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          message: result.description || "Telegram test gagal dikirim.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Test Telegram berhasil dikirim.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Telegram test gagal dikirim.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
