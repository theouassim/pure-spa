import type { AdsEvent, AdsEventName } from "../events";
import { funnelEventId } from "../ids";

interface MetaEventPayload {
  fbEventName: string;
  isCustom: boolean;
  params: Record<string, unknown>;
  eventId: string;
}

const EVENT_MAP: Record<AdsEventName, { name: string; custom: boolean } | null> = {
  ads_service_selected: { name: "ServiceSelected", custom: true },
  ads_datetime_selected: { name: "DateTimeSelected", custom: true },
  ads_contact_submitted: { name: "ContactDetailsSubmitted", custom: true },
  ads_checkout_started: { name: "InitiateCheckout", custom: false },
  ads_payment_method_selected: { name: "PaymentMethodSelected", custom: true },
  ads_booking_confirmed: { name: "Schedule", custom: false },
  ads_payment_completed: { name: "Purchase", custom: false },
};

export function buildMetaPayload(event: AdsEvent): MetaEventPayload | null {
  const mapping = EVENT_MAP[event.event];
  if (!mapping) return null;

  const params: Record<string, unknown> = {};

  if ("service_id" in event) params.content_ids = [event.service_id];
  if ("service_name" in event) params.content_name = event.service_name;
  if ("value" in event) {
    params.value = event.value / 100;
    params.currency = "EUR";
  }
  if ("payment_method" in event) params.payment_method = event.payment_method;
  if ("datetime" in event) params.datetime = event.datetime;

  const eventId = "event_id" in event ? event.event_id : funnelEventId();

  return {
    fbEventName: mapping.name,
    isCustom: mapping.custom,
    params,
    eventId,
  };
}

export function fireMetaClient(event: AdsEvent): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;

  const payload = buildMetaPayload(event);
  if (!payload) return;

  if (payload.isCustom) {
    window.fbq("trackCustom", payload.fbEventName, payload.params, { eventID: payload.eventId });
  } else {
    window.fbq("track", payload.fbEventName, payload.params, { eventID: payload.eventId });
  }
}
