import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createBooking } from "@/lib/create-booking";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { serviceId, start, end, contact } = body;

  if (!serviceId || !start || !end || !contact?.nom || !contact?.email || !contact?.telephone) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  const slotStart = new Date(start);
  const slotEnd = new Date(end);

  if (isNaN(slotStart.getTime()) || isNaN(slotEnd.getTime())) {
    return NextResponse.json({ error: "Dates invalides" }, { status: 400 });
  }

  // Upsert client
  const { data: existingClient } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("email", contact.email)
    .limit(1)
    .single();

  let clientId: string;
  if (existingClient) {
    clientId = existingClient.id;
  } else {
    const { data: newClient } = await supabaseAdmin
      .from("clients")
      .insert({ nom: contact.nom, email: contact.email, telephone: contact.telephone })
      .select("id")
      .single();
    if (!newClient) {
      return NextResponse.json({ error: "Erreur création client" }, { status: 500 });
    }
    clientId = newClient.id;
  }

  // Même fonction commune : revérification + slot + booking
  const result = await createBooking({
    serviceId,
    clientId,
    startAt: slotStart.toISOString(),
    endAt: slotEnd.toISOString(),
    stripePaymentId: null,
    statutPaiement: "en_attente",
  });

  if (!result.success) {
    if (result.reason === "slot_expired") {
      return NextResponse.json(
        { error: "slot_expired", message: "Ce créneau n'est plus disponible." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  return NextResponse.json({ success: true, bookingId: result.bookingId });
}
