import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAvailableSlots } from "@/lib/availability-service";
import { syncAllSalles } from "@/lib/planity-sync";
import type { AdminSettings, Service } from "@/lib/types";

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

  // Fetch service
  const { data: service } = await supabaseAdmin
    .from("services")
    .select("*")
    .eq("id", serviceId)
    .single();

  if (!service) {
    return NextResponse.json({ error: "Prestation introuvable" }, { status: 404 });
  }

  // Fetch settings for payment mode
  const { data: settings } = await supabaseAdmin
    .from("admin_settings")
    .select("*")
    .limit(1)
    .single();

  if (!settings) {
    return NextResponse.json({ error: "Erreur configuration" }, { status: 500 });
  }

  // POINT CRITIQUE — refetch Planity live puis revérification du créneau
  // skipDelayCheck: le créneau a déjà été validé côté affichage,
  // on ne re-filtre pas par delai_min (la cliente est dans le tunnel)
  await syncAllSalles();
  const availableSlots = await getAvailableSlots(serviceId, slotStart, { skipDelayCheck: true });
  const stillAvailable = availableSlots.some(
    (s) => s.start.getTime() === slotStart.getTime()
  );

  if (!stillAvailable) {
    return NextResponse.json(
      { error: "slot_expired", message: "Ce créneau n'est plus disponible." },
      { status: 409 }
    );
  }

  // Calcul du montant à payer
  const typedSettings = settings as AdminSettings;
  const typedService = service as Service;
  let amountCents = typedService.prix;

  if (typedSettings.mode_paiement === "acompte") {
    amountCents = Math.ceil(typedService.prix * typedSettings.acompte_pourcentage / 100);
  }

  // Créer ou récupérer le client en base
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

  // Création session Stripe Checkout
  const origin = request.nextUrl.origin;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: contact.email,
    line_items: [
      {
        price_data: {
          currency: "eur",
          unit_amount: amountCents,
          product_data: {
            name: typedService.nom,
            description: `${typedService.duree_minutes} min — ${new Date(start).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" })} à ${new Date(start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      service_id: serviceId,
      client_id: clientId,
      start_at: slotStart.toISOString(),
      end_at: slotEnd.toISOString(),
      mode_paiement: typedSettings.mode_paiement,
      montant_total: String(typedService.prix),
    },
    success_url: `${origin}/reserver/confirmation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/reserver?cancelled=1`,
    expires_at: Math.floor(Date.now() / 1000) + 1800,
  });

  return NextResponse.json({ url: session.url });
}
