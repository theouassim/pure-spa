import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const [servicesRes, settingsRes, categoriesRes] = await Promise.all([
    supabaseAdmin
      .from("services")
      .select("id, nom, duree_minutes, prix, description, categorie, reservable_en_ligne")
      .eq("actif", true)
      .order("categorie")
      .order("prix"),
    supabaseAdmin
      .from("admin_settings")
      .select("telephone_contact")
      .limit(1)
      .single(),
    supabaseAdmin
      .from("service_categories")
      .select("nom, ouverte_par_defaut, position")
      .order("position"),
  ]);

  if (servicesRes.error) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  return NextResponse.json({
    services: servicesRes.data,
    telephone_contact: settingsRes.data?.telephone_contact ?? "",
    categories: categoriesRes.data ?? [],
  });
}
