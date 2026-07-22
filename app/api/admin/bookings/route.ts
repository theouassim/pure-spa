import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createBooking } from "@/lib/create-booking";
import type { StatutPaiement } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const statut = searchParams.get("statut");
  const statutPaiement = searchParams.get("statut_paiement");
  const serviceId = searchParams.get("service_id");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabaseAdmin
    .from("bookings")
    .select("id, start_at, end_at, statut, montant, statut_paiement, stripe_payment_id, verification_requise, service:services(id, nom, duree_minutes), client:clients(id, nom, email, telephone)")
    .order("start_at", { ascending: true });

  if (statut) query = query.eq("statut", statut);
  if (statutPaiement) query = query.eq("statut_paiement", statutPaiement);
  if (serviceId) query = query.eq("service_id", serviceId);
  if (from) query = query.gte("start_at", from);
  if (to) query = query.lte("start_at", to);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ bookings: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { serviceId, start, end, client, statutPaiement, allowOverride } = body;

  if (!serviceId || !start || !end || !client?.nom) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  const slotStart = new Date(start);
  const slotEnd = new Date(end);

  if (isNaN(slotStart.getTime()) || isNaN(slotEnd.getTime())) {
    return NextResponse.json({ error: "Dates invalides" }, { status: 400 });
  }

  // Résoudre ou créer le client
  let clientId: string;

  if (client.id) {
    clientId = client.id;
  } else {
    // Chercher doublon par téléphone
    if (client.telephone) {
      const { data: existing } = await supabaseAdmin
        .from("clients")
        .select("id")
        .eq("telephone", client.telephone)
        .limit(1)
        .single();
      if (existing) {
        clientId = existing.id;
      } else {
        const { data: newClient } = await supabaseAdmin
          .from("clients")
          .insert({ nom: client.nom, email: client.email ?? null, telephone: client.telephone })
          .select("id")
          .single();
        if (!newClient) {
          return NextResponse.json({ error: "Erreur création client" }, { status: 500 });
        }
        clientId = newClient.id;
      }
    } else {
      const { data: newClient } = await supabaseAdmin
        .from("clients")
        .insert({ nom: client.nom, email: client.email ?? null, telephone: client.telephone ?? null })
        .select("id")
        .single();
      if (!newClient) {
        return NextResponse.json({ error: "Erreur création client" }, { status: 500 });
      }
      clientId = newClient.id;
    }
  }

  const paiement: StatutPaiement = statutPaiement === "paye_sur_place" ? "paye_sur_place" : "en_attente";

  const result = await createBooking({
    serviceId,
    clientId,
    startAt: slotStart.toISOString(),
    endAt: slotEnd.toISOString(),
    stripePaymentId: null,
    statutPaiement: paiement,
    allowOverride: allowOverride === true,
  });

  if (!result.success) {
    if (result.reason === "slot_expired" || result.reason === "no_slot") {
      return NextResponse.json(
        { error: "slot_unavailable", message: "Ce créneau n'est plus disponible." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: result.reason }, { status: 500 });
  }

  return NextResponse.json({ success: true, bookingId: result.bookingId });
}
