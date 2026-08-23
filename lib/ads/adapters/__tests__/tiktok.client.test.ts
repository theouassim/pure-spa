import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildTikTokPayload, fireTikTokClient } from "../tiktok.client";
import type { AdsEvent } from "../../events";

describe("tiktok.client adapter", () => {
  describe("buildTikTokPayload", () => {
    it("maps ads_service_selected to ViewContent", () => {
      const event: AdsEvent = {
        event: "ads_service_selected",
        service_id: "svc-1",
        service_name: "Massage",
        value: 5000,
        currency: "EUR",
      };
      const payload = buildTikTokPayload(event);
      expect(payload!.ttEventName).toBe("ViewContent");
      expect(payload!.params.content_id).toBe("svc-1");
      expect(payload!.params.content_name).toBe("Massage");
      expect(payload!.params.value).toBe(50);
      expect(payload!.params.currency).toBe("EUR");
    });

    it("maps ads_datetime_selected to DateTimeSelected", () => {
      const event: AdsEvent = {
        event: "ads_datetime_selected",
        service_id: "svc-1",
        service_name: "Soin",
        datetime: "2026-08-10T14:00:00Z",
      };
      const payload = buildTikTokPayload(event);
      expect(payload!.ttEventName).toBe("DateTimeSelected");
      expect(payload!.params.datetime).toBe("2026-08-10T14:00:00Z");
    });

    it("maps ads_contact_submitted to SubmitForm", () => {
      const event: AdsEvent = {
        event: "ads_contact_submitted",
        service_id: "svc-1",
        service_name: "Massage",
      };
      const payload = buildTikTokPayload(event);
      expect(payload!.ttEventName).toBe("SubmitForm");
    });

    it("maps ads_checkout_started to InitiateCheckout", () => {
      const event: AdsEvent = {
        event: "ads_checkout_started",
        service_id: "svc-1",
        service_name: "Massage",
        value: 7500,
        currency: "EUR",
      };
      const payload = buildTikTokPayload(event);
      expect(payload!.ttEventName).toBe("InitiateCheckout");
      expect(payload!.params.value).toBe(75);
    });

    it("maps ads_payment_method_selected to AddPaymentInfo", () => {
      const event: AdsEvent = {
        event: "ads_payment_method_selected",
        service_id: "svc-1",
        payment_method: "onsite",
      };
      const payload = buildTikTokPayload(event);
      expect(payload!.ttEventName).toBe("AddPaymentInfo");
      expect(payload!.params.payment_method).toBe("onsite");
    });

    it("maps ads_booking_confirmed to PlaceAnOrder with deterministic event_id", () => {
      const event: AdsEvent = {
        event: "ads_booking_confirmed",
        event_id: "booking_abc",
        event_key: "abc",
        service_id: "svc-1",
        service_name: "Massage",
        value: 5000,
        currency: "EUR",
        payment_method: "onsite",
        datetime: "2026-08-10T10:00:00Z",
      };
      const payload = buildTikTokPayload(event);
      expect(payload!.ttEventName).toBe("PlaceAnOrder");
      expect(payload!.eventId).toBe("booking_abc");
    });

    it("maps ads_payment_completed to CompletePayment with value", () => {
      const event: AdsEvent = {
        event: "ads_payment_completed",
        event_id: "payment_cs_x",
        event_key: "cs_x",
        service_id: "svc-1",
        service_name: "Massage",
        value: 5000,
        currency: "EUR",
        datetime: "2026-08-10T10:00:00Z",
      };
      const payload = buildTikTokPayload(event);
      expect(payload!.ttEventName).toBe("CompletePayment");
      expect(payload!.params.value).toBe(50);
      expect(payload!.params.currency).toBe("EUR");
      expect(payload!.eventId).toBe("payment_cs_x");
    });
  });

  describe("fireTikTokClient", () => {
    beforeEach(() => {
      vi.stubGlobal("window", { ttq: { track: vi.fn() } });
    });

    it("calls ttq.track with event_id in options", () => {
      const event: AdsEvent = {
        event: "ads_booking_confirmed",
        event_id: "booking_123",
        event_key: "123",
        service_id: "svc-1",
        service_name: "Massage",
        value: 5000,
        currency: "EUR",
        payment_method: "onsite",
        datetime: "2026-08-10T10:00:00Z",
      };
      fireTikTokClient(event);
      expect(window.ttq!.track).toHaveBeenCalledWith(
        "PlaceAnOrder",
        expect.objectContaining({ value: 50 }),
        { event_id: "booking_123" }
      );
    });

    it("does nothing if ttq is not available", () => {
      vi.stubGlobal("window", {});
      const event: AdsEvent = {
        event: "ads_service_selected",
        service_id: "svc-1",
        service_name: "M",
        value: 1000,
        currency: "EUR",
      };
      expect(() => fireTikTokClient(event)).not.toThrow();
    });
  });
});
