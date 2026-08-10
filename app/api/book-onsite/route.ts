import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createBooking } from "@/lib/create-booking";
import { sendBookingConfirmation } from "@/lib/emails";
import { sendBookingConfirmedEvent } from "@/lib/ads/send-server-events";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { serviceId, start, end, contact, ads } = body;

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
    console.error("[book-onsite] createBooking failed:", result.reason);
    if (result.reason === "slot_expired") {
      return NextResponse.json(
        { error: "slot_expired", message: "Ce créneau n'est plus disponible." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Erreur serveur", reason: result.reason }, { status: 500 });
  }

  if (ads) {
    await supabaseAdmin.from("bookings").update({
      ads_fbp: ads.fbp ?? null,
      ads_fbc: ads.fbc ?? null,
      ads_ttclid: ads.ttclid ?? null,
      ads_ttp: ads.ttp ?? null,
      ads_gclid: ads.gclid ?? null,
      ads_client_ua: request.headers.get("user-agent") ?? null,
      ads_client_ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      ads_event_source_url: ads.event_source_url ?? null,
      ads_event_key: result.bookingId,
    }).eq("id", result.bookingId);
  }

  const { data: service } = await supabaseAdmin
    .from("services")
    .select("nom, duree_minutes, prix")
    .eq("id", serviceId)
    .single();

  if (service) {
    await sendBookingConfirmation(
      { id: result.bookingId, start_at: slotStart.toISOString(), montant: service.prix, statut_paiement: "en_attente" },
      { nom: contact.nom, email: contact.email },
      service
    );
  }

  if (ads && service) {
    const nameParts = contact.nom.trim().split(/\s+/);
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.slice(1).join(" ");

    try {
      await sendBookingConfirmedEvent({
        bookingId: result.bookingId,
        eventKey: result.bookingId,
        serviceName: service.nom,
        valueCents: service.prix,
        email: contact.email,
        phone: contact.telephone,
        firstName,
        lastName,
        adsData: {
          ads_fbp: ads.fbp ?? null,
          ads_fbc: ads.fbc ?? null,
          ads_ttclid: ads.ttclid ?? null,
          ads_ttp: ads.ttp ?? null,
          ads_gclid: ads.gclid ?? null,
          ads_client_ua: request.headers.get("user-agent") ?? null,
          ads_client_ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
          ads_event_source_url: ads.event_source_url ?? null,
          ads_event_key: result.bookingId,
        },
      });
    } catch (err) {
      console.error("[book-onsite] ads send failed:", err);
    }
  }

  return NextResponse.json({ success: true, bookingId: result.bookingId });
}
