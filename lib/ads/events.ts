export interface AdsServiceSelected {
  event: "ads_service_selected";
  service_id: string;
  service_name: string;
  value: number;
  currency: "EUR";
}

export interface AdsDatetimeSelected {
  event: "ads_datetime_selected";
  service_id: string;
  service_name: string;
  datetime: string;
}

export interface AdsContactSubmitted {
  event: "ads_contact_submitted";
  service_id: string;
  service_name: string;
}

export interface AdsCheckoutStarted {
  event: "ads_checkout_started";
  service_id: string;
  service_name: string;
  value: number;
  currency: "EUR";
  payment_method: "online" | "onsite";
}

export interface AdsPaymentMethodSelected {
  event: "ads_payment_method_selected";
  service_id: string;
  payment_method: "online" | "onsite";
}

export interface AdsBookingConfirmed {
  event: "ads_booking_confirmed";
  event_id: string;
  event_key: string;
  service_id: string;
  service_name: string;
  value: number;
  currency: "EUR";
  payment_method: "online" | "onsite";
  datetime: string;
}

export interface AdsPaymentCompleted {
  event: "ads_payment_completed";
  event_id: string;
  event_key: string;
  service_id: string;
  service_name: string;
  value: number;
  currency: "EUR";
  datetime: string;
}

export type AdsEvent =
  | AdsServiceSelected
  | AdsDatetimeSelected
  | AdsContactSubmitted
  | AdsCheckoutStarted
  | AdsPaymentMethodSelected
  | AdsBookingConfirmed
  | AdsPaymentCompleted;

export type AdsEventName = AdsEvent["event"];
