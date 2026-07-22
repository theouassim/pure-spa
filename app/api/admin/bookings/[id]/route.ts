import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendBookingCancellation, sendBookingModification } from "@/lib/emails";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = {};

  if (body.statut) updates.statut = body.statut;
  if (body.statut_paiement) updates.statut_paiement = body.statut_paiement;
  if (body.start_at) updates.start_at = body.start_at;
  if (body.end_at) updates.end_at = body.end_at;
  if (body.service_id) updates.service_id = body.service_id;
  if (body.verification_requise === false) updates.verification_requise = false;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Aucune modification" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .update(updates)
    .eq("id", id)
    .select("id, start_at, montant, statut_paiement, statut, service_id, client_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: service } = await supabaseAdmin
    .from("services")
    .select("nom, duree_minutes")
    .eq("id", data.service_id)
    .single();
  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("nom, email")
    .eq("id", data.client_id)
    .single();

  if (service && client) {
    if (body.statut === "cancelled") {
      await sendBookingCancellation(
        { id: data.id, start_at: data.start_at, montant: data.montant, statut_paiement: data.statut_paiement },
        client,
        service
      );
    } else if (body.start_at || body.end_at || body.service_id) {
      await sendBookingModification(
        { id: data.id, start_at: data.start_at, montant: data.montant, statut_paiement: data.statut_paiement },
        client,
        service
      );
    }
  }

  return NextResponse.json({ success: true, booking: data });
}
