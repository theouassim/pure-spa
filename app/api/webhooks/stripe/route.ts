import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createBooking } from "@/lib/create-booking";
import { sendBookingConfirmation } from "@/lib/emails";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;

    case "checkout.session.expired":
      await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
      break;
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const meta = session.metadata;
  if (!meta?.service_id || !meta?.client_id || !meta?.start_at || !meta?.end_at) {
    return;
  }

  const result = await createBooking({
    serviceId: meta.service_id,
    clientId: meta.client_id,
    startAt: meta.start_at,
    endAt: meta.end_at,
    stripePaymentId: (session.payment_intent as string) ?? null,
    statutPaiement: "paye_en_ligne",
  });

  if (!result.success) {
    // Créneau pris ou plus de slot — rembourser automatiquement
    if (session.payment_intent) {
      await stripe.refunds.create({
        payment_intent: session.payment_intent as string,
        reason: "requested_by_customer",
      });
    }

    await supabaseAdmin.from("funnel_events").insert({
      session_id: session.id,
      event_name: "slot_expired",
      payload: { service_id: meta.service_id, start: meta.start_at, stage: "webhook" },
      service_id: meta.service_id,
    });
    return;
  }

  await supabaseAdmin.from("funnel_events").insert({
    session_id: session.id,
    event_name: "payment_confirmed",
    payload: {
      service_id: meta.service_id,
      start: meta.start_at,
      amount: session.amount_total,
    },
    service_id: meta.service_id,
  });

  // Email confirmation client + admin
  const { data: service } = await supabaseAdmin
    .from("services")
    .select("nom, duree_minutes")
    .eq("id", meta.service_id)
    .single();
  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("nom, email")
    .eq("id", meta.client_id)
    .single();

  if (service && client) {
    await sendBookingConfirmation(
      { start_at: meta.start_at, montant: session.amount_total, statut_paiement: "paye_en_ligne" },
      client,
      service
    );
  }
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  const meta = session.metadata;

  await supabaseAdmin.from("funnel_events").insert({
    session_id: session.id,
    event_name: "payment_abandoned",
    payload: {
      service_id: meta?.service_id ?? null,
      start: meta?.start_at ?? null,
    },
    service_id: meta?.service_id ?? null,
  });
}
