import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendMetaServerEvent } from "./adapters/meta.server";
import { sendTikTokServerEvent } from "./adapters/tiktok.server";
import { bookingEventId, paymentEventId } from "./ids";

interface AdsColumnsFromBooking {
  ads_fbp: string | null;
  ads_fbc: string | null;
  ads_ttclid: string | null;
  ads_ttp: string | null;
  ads_gclid: string | null;
  ads_client_ua: string | null;
  ads_client_ip: string | null;
  ads_event_source_url: string | null;
  ads_event_key: string | null;
}

interface SendConversionInput {
  bookingId: string;
  eventKey: string;
  serviceName: string;
  valueCents: number;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  adsData: AdsColumnsFromBooking;
}

export async function sendBookingConfirmedEvent(input: SendConversionInput): Promise<void> {
  if (await isTestBooking(input.bookingId)) return;

  const claimed = await claimSentAt(input.bookingId, "ads_booking_sent_at");
  if (!claimed) return;

  const eventId = bookingEventId(input.eventKey);
  const eventTime = Math.floor(Date.now() / 1000);

  const baseUserData = {
    email: input.email,
    phone: input.phone ?? undefined,
    firstName: input.firstName,
    lastName: input.lastName.length > 0 ? input.lastName : undefined,
    fbp: input.adsData.ads_fbp,
    fbc: input.adsData.ads_fbc,
    clientIpAddress: input.adsData.ads_client_ip,
    clientUserAgent: input.adsData.ads_client_ua,
  };

  try {
    await sendMetaServerEvent({
      eventName: "Schedule",
      eventId,
      eventTime,
      eventSourceUrl: input.adsData.ads_event_source_url ?? "",
      actionSource: "website",
      userData: baseUserData,
      customData: {
        value: input.valueCents / 100,
        currency: "EUR",
        content_name: input.serviceName,
      },
    });
  } catch (err) {
    console.error("[ads] Meta CAPI Schedule failed:", err);
  }

  try {
    await sendTikTokServerEvent({
      eventName: "PlaceAnOrder",
      eventId,
      eventTime,
      eventSourceUrl: input.adsData.ads_event_source_url ?? "",
      userData: {
        email: input.email,
        phone: input.phone ?? undefined,
        ttclid: input.adsData.ads_ttclid,
        ttp: input.adsData.ads_ttp,
        clientIpAddress: input.adsData.ads_client_ip,
        clientUserAgent: input.adsData.ads_client_ua,
      },
      properties: {
        value: input.valueCents / 100,
        currency: "EUR",
        content_name: input.serviceName,
      },
    });
  } catch (err) {
    console.error("[ads] TikTok Events API PlaceAnOrder failed:", err);
  }
}

export async function sendPaymentCompletedEvent(input: SendConversionInput): Promise<void> {
  if (await isTestBooking(input.bookingId)) return;

  const claimed = await claimSentAt(input.bookingId, "ads_payment_sent_at");
  if (!claimed) return;

  const eventId = paymentEventId(input.eventKey);
  const eventTime = Math.floor(Date.now() / 1000);

  const baseUserData = {
    email: input.email,
    phone: input.phone ?? undefined,
    firstName: input.firstName,
    lastName: input.lastName.length > 0 ? input.lastName : undefined,
    fbp: input.adsData.ads_fbp,
    fbc: input.adsData.ads_fbc,
    clientIpAddress: input.adsData.ads_client_ip,
    clientUserAgent: input.adsData.ads_client_ua,
  };

  try {
    await sendMetaServerEvent({
      eventName: "Purchase",
      eventId,
      eventTime,
      eventSourceUrl: input.adsData.ads_event_source_url ?? "",
      actionSource: "website",
      userData: baseUserData,
      customData: {
        value: input.valueCents / 100,
        currency: "EUR",
        content_name: input.serviceName,
      },
    });
  } catch (err) {
    console.error("[ads] Meta CAPI Purchase failed:", err);
  }

  try {
    await sendTikTokServerEvent({
      eventName: "CompletePayment",
      eventId,
      eventTime,
      eventSourceUrl: input.adsData.ads_event_source_url ?? "",
      userData: {
        email: input.email,
        phone: input.phone ?? undefined,
        ttclid: input.adsData.ads_ttclid,
        ttp: input.adsData.ads_ttp,
        clientIpAddress: input.adsData.ads_client_ip,
        clientUserAgent: input.adsData.ads_client_ua,
      },
      properties: {
        value: input.valueCents / 100,
        currency: "EUR",
        content_name: input.serviceName,
      },
    });
  } catch (err) {
    console.error("[ads] TikTok Events API CompletePayment failed:", err);
  }
}

async function isTestBooking(bookingId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("bookings")
    .select("is_test")
    .eq("id", bookingId)
    .single();

  return data?.is_test === true;
}

/**
 * Atomic claim: sets the sent_at timestamp only if currently NULL.
 * Returns true if this call claimed the slot (i.e., we should send).
 * Returns false if already sent (idempotency guard).
 */
async function claimSentAt(
  bookingId: string,
  column: "ads_booking_sent_at" | "ads_payment_sent_at"
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("bookings")
    .update({ [column]: new Date().toISOString() })
    .eq("id", bookingId)
    .is(column, null)
    .select("id");

  return (data?.length ?? 0) > 0;
}
