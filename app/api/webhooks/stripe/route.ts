import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createBooking } from "@/lib/create-booking";
import { sendBookingConfirmation } from "@/lib/emails";
import { sendBookingConfirmedEvent, sendPaymentCompletedEvent } from "@/lib/ads/send-server-events";
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

  await supabaseAdmin.from("bookings").update({
    ads_fbp: meta.ads_fbp || null,
    ads_fbc: meta.ads_fbc || null,
    ads_ttclid: meta.ads_ttclid || null,
    ads_ttp: meta.ads_ttp || null,
    ads_gclid: meta.ads_gclid || null,
    ads_client_ua: meta.ads_client_ua || null,
    ads_client_ip: meta.ads_client_ip || null,
    ads_event_source_url: meta.ads_event_source_url || null,
    ads_event_key: session.id,
  }).eq("id", result.bookingId);

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

  const { data: service } = await supabaseAdmin
    .from("services")
    .select("nom, duree_minutes, prix")
    .eq("id", meta.service_id)
    .single();
  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("nom, email, telephone")
    .eq("id", meta.client_id)
    .single();

  if (service && client) {
    const nameParts = client.nom.trim().split(/\s+/);
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.slice(1).join(" ");
    const adsData = {
      ads_fbp: meta.ads_fbp || null,
      ads_fbc: meta.ads_fbc || null,
      ads_ttclid: meta.ads_ttclid || null,
      ads_ttp: meta.ads_ttp || null,
      ads_gclid: meta.ads_gclid || null,
      ads_client_ua: meta.ads_client_ua || null,
      ads_client_ip: meta.ads_client_ip || null,
      ads_event_source_url: meta.ads_event_source_url || null,
      ads_event_key: session.id,
    };

    const conversionInput = {
      bookingId: result.bookingId,
      eventKey: session.id,
      serviceName: service.nom,
      valueCents: service.prix,
      email: client.email,
      phone: client.telephone ?? null,
      firstName,
      lastName,
      adsData,
    };

    await Promise.all([
      sendBookingConfirmation(
        { id: result.bookingId, start_at: meta.start_at, montant: session.amount_total, statut_paiement: "paye_en_ligne" },
        client,
        service
      ).catch((err) => console.error("[stripe-webhook] email failed:", err)),
      sendPaymentCompletedEvent(conversionInput)
        .catch((err) => console.error("[stripe-webhook] ads Purchase failed:", err)),
      sendBookingConfirmedEvent(conversionInput)
        .catch((err) => console.error("[stripe-webhook] ads Schedule failed:", err)),
    ]);
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
