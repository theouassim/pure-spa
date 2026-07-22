import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const includeArchived = searchParams.get("all") === "true";

  let query = supabaseAdmin
    .from("services")
    .select("id, nom, categorie, duree_minutes, prix, description, actif, reservable_en_ligne, battement_min, created_at")
    .order("categorie")
    .order("nom");

  if (!includeArchived) {
    query = query.eq("actif", true);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ services: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const validationError = validateService(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const insertData: Record<string, unknown> = {
    nom: body.nom.trim(),
    categorie: body.categorie?.trim() || "Soins",
    duree_minutes: body.duree_minutes,
    prix: body.prix,
    description: body.description?.trim() || null,
    reservable_en_ligne: body.reservable_en_ligne ?? true,
    actif: true,
  };

  if (body.battement_min !== undefined) {
    const val = body.battement_min === null || body.battement_min === "" ? null : Number(body.battement_min);
    if (val !== null && (!Number.isInteger(val) || val < 0)) {
      return NextResponse.json({ error: "Battement invalide." }, { status: 400 });
    }
    insertData.battement_min = val;
  }

  const { data, error } = await supabaseAdmin
    .from("services")
    .insert(insertData)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data.id });
}

function validateService(body: Record<string, unknown>): string | null {
  if (!body.nom || (body.nom as string).trim().length === 0) {
    return "Le nom du service est obligatoire.";
  }
  const duree = Number(body.duree_minutes);
  if (!Number.isInteger(duree) || duree <= 0) {
    return "La durée doit être supérieure à 0 minutes.";
  }
  const prix = Number(body.prix);
  if (!Number.isInteger(prix) || prix < 0) {
    return "Le prix doit être un nombre positif (en centimes).";
  }
  return null;
}
