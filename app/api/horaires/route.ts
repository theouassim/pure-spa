import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const { data: settings, error } = await supabaseAdmin
    .from("admin_settings")
    .select("horaires_ouverture, jours_travailles, pauses")
    .limit(1)
    .single();

  if (error || !settings) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  return NextResponse.json(settings);
}
