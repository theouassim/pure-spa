"use client";

import { useEffect } from "react";
import { trackAds } from "@/lib/ads/bus";
import { bookingEventId, paymentEventId } from "@/lib/ads/ids";

interface Props {
  eventKey: string;
  value: number;
  serviceName: string;
  paymentMethod: "online" | "onsite";
}

const STORAGE_PREFIX = "pure_spa_ads_confirmation_";

export function ConfirmationAdsTracking({ eventKey, value, serviceName, paymentMethod }: Props) {
  useEffect(() => {
    const storageKey = `${STORAGE_PREFIX}${eventKey}`;

    if (typeof window === "undefined") return;

    try {
      if (sessionStorage.getItem(storageKey)) return;
      sessionStorage.setItem(storageKey, "1");
    } catch {
      return;
    }

    if (paymentMethod === "onsite") {
      trackAds({
        event: "ads_booking_confirmed",
        event_id: bookingEventId(eventKey),
        event_key: eventKey,
        service_id: "",
        service_name: serviceName,
        value,
        currency: "EUR",
        payment_method: "onsite",
        datetime: "",
      });
    } else {
      trackAds({
        event: "ads_payment_completed",
        event_id: paymentEventId(eventKey),
        event_key: eventKey,
        service_id: "",
        service_name: serviceName,
        value,
        currency: "EUR",
        datetime: "",
      });

      trackAds({
        event: "ads_booking_confirmed",
        event_id: bookingEventId(eventKey),
        event_key: eventKey,
        service_id: "",
        service_name: serviceName,
        value,
        currency: "EUR",
        payment_method: "online",
        datetime: "",
      });
    }
  }, [eventKey, value, serviceName, paymentMethod]);

  return null;
}
