import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const { data: services, error } = await supabaseAdmin
    .from("services")
    .select("id, nom, duree_minutes, prix, description, categorie, reservable_en_ligne")
    .eq("actif", true)
    .order("categorie")
    .order("prix");

  if (error) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  const { data: settings } = await supabaseAdmin
    .from("admin_settings")
    .select("telephone_contact")
    .limit(1)
    .single();

  return NextResponse.json({
    services,
    telephone_contact: settings?.telephone_contact ?? "",
  });
}
