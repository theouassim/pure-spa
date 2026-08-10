import type { AdsEvent, AdsEventName } from "../events";
import { funnelEventId } from "../ids";

interface TikTokEventPayload {
  ttEventName: string;
  params: Record<string, unknown>;
  eventId: string;
}

const EVENT_MAP: Record<AdsEventName, string | null> = {
  ads_service_selected: "ViewContent",
  ads_datetime_selected: "DateTimeSelected",
  ads_contact_submitted: "SubmitForm",
  ads_checkout_started: "InitiateCheckout",
  ads_payment_method_selected: "AddPaymentInfo",
  ads_booking_confirmed: "PlaceAnOrder",
  ads_payment_completed: "CompletePayment",
};

export function buildTikTokPayload(event: AdsEvent): TikTokEventPayload | null {
  const ttEventName = EVENT_MAP[event.event];
  if (!ttEventName) return null;

  const params: Record<string, unknown> = {};

  if ("service_id" in event) params.content_id = event.service_id;
  if ("service_name" in event) params.content_name = event.service_name;
  if ("value" in event) {
    params.value = event.value / 100;
    params.currency = "EUR";
  }
  if ("payment_method" in event) params.payment_method = event.payment_method;
  if ("datetime" in event) params.datetime = event.datetime;

  const eventId = "event_id" in event ? event.event_id : funnelEventId();

  return { ttEventName, params, eventId };
}

export function fireTikTokClient(event: AdsEvent): void {
  if (typeof window === "undefined" || !window.ttq || typeof window.ttq.track !== "function") return;

  const payload = buildTikTokPayload(event);
  if (!payload) return;

  window.ttq.track(payload.ttEventName, payload.params, { event_id: payload.eventId });
}
