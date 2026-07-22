import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = {};

  if (body.nom !== undefined) {
    const nom = (body.nom as string).trim();
    if (!nom) return NextResponse.json({ error: "Le nom est obligatoire." }, { status: 400 });
    updates.nom = nom;
  }
  if (body.categorie !== undefined) {
    updates.categorie = (body.categorie as string).trim() || "Soins";
  }
  if (body.duree_minutes !== undefined) {
    const duree = Number(body.duree_minutes);
    if (!Number.isInteger(duree) || duree <= 0) {
      return NextResponse.json({ error: "Durée invalide." }, { status: 400 });
    }
    updates.duree_minutes = duree;
  }
  if (body.prix !== undefined) {
    const prix = Number(body.prix);
    if (!Number.isInteger(prix) || prix < 0) {
      return NextResponse.json({ error: "Prix invalide." }, { status: 400 });
    }
    updates.prix = prix;
  }
  if (body.description !== undefined) {
    updates.description = body.description ? (body.description as string).trim() : null;
  }
  if (body.reservable_en_ligne !== undefined) {
    updates.reservable_en_ligne = Boolean(body.reservable_en_ligne);
  }
  if (body.actif !== undefined) {
    updates.actif = Boolean(body.actif);
  }
  if (body.battement_min !== undefined) {
    const val = body.battement_min === null || body.battement_min === "" ? null : Number(body.battement_min);
    if (val !== null && (!Number.isInteger(val) || val < 0)) {
      return NextResponse.json({ error: "Battement invalide." }, { status: 400 });
    }
    updates.battement_min = val;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Aucune modification." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("services")
    .update(updates)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
