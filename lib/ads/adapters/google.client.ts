import type { AdsEvent, AdsEventName } from "../events";
import { funnelEventId } from "../ids";

interface GtagEventPayload {
  gtagEventName: string;
  params: Record<string, unknown>;
}

const FUNNEL_EVENT_MAP: Record<AdsEventName, string | null> = {
  ads_service_selected: "view_item",
  ads_datetime_selected: "select_item",
  ads_contact_submitted: "generate_lead",
  ads_checkout_started: "begin_checkout",
  ads_payment_method_selected: "add_payment_info",
  ads_booking_confirmed: null,
  ads_payment_completed: null,
};

function shouldFirePurchase(event: AdsEvent): boolean {
  if (event.event === "ads_booking_confirmed" && event.payment_method === "onsite") return true;
  if (event.event === "ads_payment_completed") return true;
  return false;
}

export function buildGtagPayload(event: AdsEvent): GtagEventPayload | null {
  if (shouldFirePurchase(event)) {
    if (!("value" in event)) return null;
    const eventKey = "event_key" in event ? event.event_key : funnelEventId();
    const paymentMethod = "payment_method" in event ? event.payment_method : undefined;
    return {
      gtagEventName: "purchase",
      params: {
        transaction_id: eventKey,
        value: event.value / 100,
        currency: "EUR",
        ...(paymentMethod && { payment_method: paymentMethod }),
        items: [
          {
            item_id: event.service_id,
            item_name: "service_name" in event ? event.service_name : undefined,
            price: event.value / 100,
            quantity: 1,
          },
        ],
      },
    };
  }

  const gtagEventName = FUNNEL_EVENT_MAP[event.event];
  if (!gtagEventName) return null;

  const params: Record<string, unknown> = {};

  if ("service_id" in event) params.item_id = event.service_id;
  if ("service_name" in event) params.item_name = event.service_name;
  if ("value" in event) {
    params.value = event.value / 100;
    params.currency = "EUR";
  }
  if ("payment_method" in event) params.payment_type = event.payment_method;

  const eventId = "event_id" in event ? event.event_id : funnelEventId();
  params.transaction_id = eventId;

  return { gtagEventName, params };
}

export function fireGtagClient(event: AdsEvent): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;

  const payload = buildGtagPayload(event);
  if (!payload) return;

  window.gtag("event", payload.gtagEventName, payload.params);
}
