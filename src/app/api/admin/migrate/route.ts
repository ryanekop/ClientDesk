import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Temporary migration endpoint - DELETE after use
export async function GET() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const results: Record<string, string> = {};

    const migrations = [
        // Form customization
        `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS form_brand_color TEXT DEFAULT '#000000'`,
        `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS form_greeting TEXT`,
        `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS form_event_types TEXT[]`,
        `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS form_show_location BOOLEAN DEFAULT true`,
        `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS form_show_notes BOOLEAN DEFAULT true`,
        `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS form_show_proof BOOLEAN DEFAULT true`,
        `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invoice_logo_url TEXT`,
        // Bank accounts (JSONB array, replaces old separate columns)
        `ALTER TABLE profiles DROP COLUMN IF EXISTS bank_name`,
        `ALTER TABLE profiles DROP COLUMN IF EXISTS bank_account_number`,
        `ALTER TABLE profiles DROP COLUMN IF EXISTS bank_account_name`,
        `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_accounts JSONB DEFAULT '[]'::jsonb`,
    ];

    for (const sql of migrations) {
        const { error } = await supabase.rpc("exec_sql", { sql_query: sql }).single();
        results[sql.slice(0, 60)] = error ? `FAIL: ${error.message}` : "OK";
    }

    return NextResponse.json({ done: true, results });
}
