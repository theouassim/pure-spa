import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { HoraireOuverture, Pause } from "@/lib/types";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("admin_settings")
    .select("*")
    .limit(1)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();

  const validationError = validateSettings(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (body.horaires_ouverture !== undefined) {
    updates.horaires_ouverture = body.horaires_ouverture;
    updates.jours_travailles = (body.horaires_ouverture as HoraireOuverture[])
      .filter((h) => h.ouverture && h.fermeture)
      .map((h) => h.jour);
  }
  if (body.pauses !== undefined) updates.pauses = body.pauses;
  if (body.nb_salles !== undefined) updates.nb_salles = body.nb_salles;
  if (body.delai_min_avant_rdv !== undefined) updates.delai_min_avant_rdv = body.delai_min_avant_rdv;
  if (body.battement_minutes !== undefined) updates.battement_minutes = body.battement_minutes;
  if (body.telephone_contact !== undefined) updates.telephone_contact = body.telephone_contact;

  const { error } = await supabaseAdmin
    .from("admin_settings")
    .update(updates)
    .not("id", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

function validateSettings(body: Record<string, unknown>): string | null {
  if (body.horaires_ouverture) {
    const horaires = body.horaires_ouverture as HoraireOuverture[];
    for (const h of horaires) {
      if (h.ouverture && h.fermeture && h.fermeture <= h.ouverture) {
        const jourNom = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"][h.jour] ?? `Jour ${h.jour}`;
        return `${jourNom} : l'heure de fermeture doit être après l'ouverture.`;
      }
    }
  }

  if (body.pauses && body.horaires_ouverture) {
    const pauses = body.pauses as Pause[];
    const horaires = body.horaires_ouverture as HoraireOuverture[];
    for (const p of pauses) {
      if (p.debut >= p.fin) {
        return `Pause invalide : la fin doit être après le début (${p.debut} → ${p.fin}).`;
      }
      const openDays = horaires.filter((h) => h.ouverture && h.fermeture);
      const fits = openDays.some((h) => p.debut >= h.ouverture && p.fin <= h.fermeture);
      if (!fits && openDays.length > 0) {
        return `Pause ${p.debut}–${p.fin} hors des horaires d'ouverture.`;
      }
    }
  }

  if (body.nb_salles !== undefined) {
    const nb = Number(body.nb_salles);
    if (!Number.isInteger(nb) || nb < 1 || nb > 10) {
      return "Le nombre de salles doit être entre 1 et 10.";
    }
  }

  if (body.delai_min_avant_rdv !== undefined) {
    const d = Number(body.delai_min_avant_rdv);
    if (!Number.isInteger(d) || d < 0 || d > 1440) {
      return "Le délai minimum doit être entre 0 et 1440 minutes.";
    }
  }

  if (body.battement_minutes !== undefined) {
    const b = Number(body.battement_minutes);
    if (!Number.isInteger(b) || b < 0 || b > 120) {
      return "Le battement doit être entre 0 et 120 minutes.";
    }
  }

  return null;
}
