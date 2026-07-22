import { NextResponse, NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireOwner } from "@/lib/require-owner";

const VALID_TYPES = ["ga4", "gtm", "meta_pixel"] as const;

const FORMAT_PATTERNS: Record<string, RegExp> = {
  ga4: /^G-[A-Z0-9]{4,12}$/,
  gtm: /^GTM-[A-Z0-9]{4,12}$/,
  meta_pixel: /^\d{10,20}$/,
};

export async function GET() {
  const auth = await requireOwner();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await supabaseAdmin
    .from("tracking_connectors")
    .select("*")
    .order("connector_type");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ connectors: data });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireOwner();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { connector_type, connector_id, enabled } = body;

  if (!VALID_TYPES.includes(connector_type)) {
    return NextResponse.json({ error: "Type de connecteur invalide." }, { status: 400 });
  }

  if (connector_id !== undefined && connector_id !== "") {
    const pattern = FORMAT_PATTERNS[connector_type];
    if (pattern && !pattern.test(connector_id)) {
      return NextResponse.json(
        { error: `Format invalide pour ${connector_type}. Attendu : ${getFormatHint(connector_type)}` },
        { status: 400 }
      );
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (connector_id !== undefined) updates.connector_id = connector_id;
  if (enabled !== undefined) updates.enabled = Boolean(enabled);

  const { error } = await supabaseAdmin
    .from("tracking_connectors")
    .update(updates)
    .eq("connector_type", connector_type);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

function getFormatHint(type: string): string {
  switch (type) {
    case "ga4": return "G-XXXXXXXXXX";
    case "gtm": return "GTM-XXXXXXX";
    case "meta_pixel": return "Un nombre de 10 à 20 chiffres";
    default: return "";
  }
}
