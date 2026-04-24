import { NextResponse } from "next/server";

export async function GET() {
    const quackbackUrl = process.env.QUACKBACK_URL;

    if (!quackbackUrl) {
        return NextResponse.json(
            { error: "Feedback bridge is not configured" },
            { status: 500 }
        );
    }

    return NextResponse.redirect(quackbackUrl);
}
