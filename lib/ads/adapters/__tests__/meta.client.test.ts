import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildMetaPayload, fireMetaClient } from "../meta.client";
import type { AdsEvent } from "../../events";

describe("meta.client adapter", () => {
  describe("buildMetaPayload", () => {
    it("maps ads_service_selected to custom ServiceSelected", () => {
      const event: AdsEvent = {
        event: "ads_service_selected",
        service_id: "svc-1",
        service_name: "Massage",
        value: 5000,
        currency: "EUR",
      };
      const payload = buildMetaPayload(event);
      expect(payload).not.toBeNull();
      expect(payload!.fbEventName).toBe("ServiceSelected");
      expect(payload!.isCustom).toBe(true);
      expect(payload!.params.content_ids).toEqual(["svc-1"]);
      expect(payload!.params.content_name).toBe("Massage");
      expect(payload!.params.value).toBe(50);
      expect(payload!.params.currency).toBe("EUR");
      expect(payload!.eventId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("maps ads_datetime_selected to custom DateTimeSelected", () => {
      const event: AdsEvent = {
        event: "ads_datetime_selected",
        service_id: "svc-1",
        service_name: "Soin visage",
        datetime: "2026-08-10T14:00:00Z",
      };
      const payload = buildMetaPayload(event);
      expect(payload!.fbEventName).toBe("DateTimeSelected");
      expect(payload!.isCustom).toBe(true);
      expect(payload!.params.datetime).toBe("2026-08-10T14:00:00Z");
    });

    it("maps ads_contact_submitted to custom ContactDetailsSubmitted", () => {
      const event: AdsEvent = {
        event: "ads_contact_submitted",
        service_id: "svc-1",
        service_name: "Massage",
      };
      const payload = buildMetaPayload(event);
      expect(payload!.fbEventName).toBe("ContactDetailsSubmitted");
      expect(payload!.isCustom).toBe(true);
    });

    it("maps ads_checkout_started to standard InitiateCheckout", () => {
      const event: AdsEvent = {
        event: "ads_checkout_started",
        service_id: "svc-1",
        service_name: "Massage",
        value: 7500,
        currency: "EUR",
        payment_method: "online",
      };
      const payload = buildMetaPayload(event);
      expect(payload!.fbEventName).toBe("InitiateCheckout");
      expect(payload!.isCustom).toBe(false);
      expect(payload!.params.value).toBe(75);
      expect(payload!.params.payment_method).toBe("online");
    });

    it("maps ads_payment_method_selected to custom PaymentMethodSelected", () => {
      const event: AdsEvent = {
        event: "ads_payment_method_selected",
        service_id: "svc-1",
        payment_method: "onsite",
      };
      const payload = buildMetaPayload(event);
      expect(payload!.fbEventName).toBe("PaymentMethodSelected");
      expect(payload!.isCustom).toBe(true);
      expect(payload!.params.payment_method).toBe("onsite");
    });

    it("maps ads_booking_confirmed to standard Schedule with deterministic event_id", () => {
      const event: AdsEvent = {
        event: "ads_booking_confirmed",
        event_id: "booking_abc123",
        event_key: "abc123",
        service_id: "svc-1",
        service_name: "Massage",
        value: 5000,
        currency: "EUR",
        payment_method: "onsite",
        datetime: "2026-08-10T10:00:00Z",
      };
      const payload = buildMetaPayload(event);
      expect(payload!.fbEventName).toBe("Schedule");
      expect(payload!.isCustom).toBe(false);
      expect(payload!.eventId).toBe("booking_abc123");
    });

    it("maps ads_payment_completed to standard Purchase with deterministic event_id", () => {
      const event: AdsEvent = {
        event: "ads_payment_completed",
        event_id: "payment_cs_abc",
        event_key: "cs_abc",
        service_id: "svc-1",
        service_name: "Massage",
        value: 5000,
        currency: "EUR",
        datetime: "2026-08-10T10:00:00Z",
      };
      const payload = buildMetaPayload(event);
      expect(payload!.fbEventName).toBe("Purchase");
      expect(payload!.isCustom).toBe(false);
      expect(payload!.eventId).toBe("payment_cs_abc");
      expect(payload!.params.value).toBe(50);
      expect(payload!.params.currency).toBe("EUR");
    });
  });

  describe("fireMetaClient", () => {
    beforeEach(() => {
      vi.stubGlobal("window", { fbq: vi.fn() });
    });

    it("calls fbq track for standard events", () => {
      const event: AdsEvent = {
        event: "ads_payment_completed",
        event_id: "payment_x",
        event_key: "x",
        service_id: "svc-1",
        service_name: "Massage",
        value: 5000,
        currency: "EUR",
        datetime: "2026-08-10T10:00:00Z",
      };
      fireMetaClient(event);
      expect(window.fbq).toHaveBeenCalledWith(
        "track",
        "Purchase",
        expect.objectContaining({ value: 50, currency: "EUR" }),
        { eventID: "payment_x" }
      );
    });

    it("calls fbq trackCustom for custom events", () => {
      const event: AdsEvent = {
        event: "ads_service_selected",
        service_id: "svc-2",
        service_name: "Gommage",
        value: 3000,
        currency: "EUR",
      };
      fireMetaClient(event);
      expect(window.fbq).toHaveBeenCalledWith(
        "trackCustom",
        "ServiceSelected",
        expect.objectContaining({ content_name: "Gommage" }),
        expect.objectContaining({ eventID: expect.any(String) })
      );
    });

    it("does nothing if fbq is not available", () => {
      vi.stubGlobal("window", {});
      const event: AdsEvent = {
        event: "ads_service_selected",
        service_id: "svc-1",
        service_name: "M",
        value: 1000,
        currency: "EUR",
      };
      expect(() => fireMetaClient(event)).not.toThrow();
    });
  });
});
