import { createHmac, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type BridgePayload = {
    jti: string;
    source_app: "clientdesk";
    source_user_id: string;
    email: string;
    name: string | null;
    avatar_url: string | null;
    target_board: "clientdesk";
    exp: number;
};

const base64UrlEncode = (value: Buffer | string) =>
    Buffer.from(value)
        .toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

const signBridgeToken = (payload: BridgePayload, secret: string) => {
    const header = { alg: "HS256", typ: "JWT" };
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = base64UrlEncode(
        createHmac("sha256", secret)
            .update(`${encodedHeader}.${encodedPayload}`)
            .digest()
    );

    return `${encodedHeader}.${encodedPayload}.${signature}`;
};

export async function GET() {
    const quackbackUrl =
        process.env.QUACKBACK_AUTH_BROKER_URL || process.env.QUACKBACK_URL;
    const bridgeSecret = process.env.QUACKBACK_BRIDGE_SECRET_CLIENTDESK;

    if (!quackbackUrl || !bridgeSecret) {
        return NextResponse.json(
            { error: "Feedback bridge is not configured" },
            { status: 500 }
        );
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id || !user.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .single();

    const payload: BridgePayload = {
        jti: randomUUID(),
        source_app: "clientdesk",
        source_user_id: user.id,
        email: user.email,
        name:
            profile?.full_name ||
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            null,
        avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || null,
        target_board: "clientdesk",
        exp: Math.floor(Date.now() / 1000) + 120,
    };
    const token = signBridgeToken(payload, bridgeSecret);
    const redirectUrl = new URL("/api/bridge/launch", quackbackUrl);

    redirectUrl.searchParams.set("token", token);

    return NextResponse.redirect(redirectUrl);
}
