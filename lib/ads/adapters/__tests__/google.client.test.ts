import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildGtagPayload, fireGtagClient } from "../google.client";
import type { AdsEvent } from "../../events";

describe("google.client adapter", () => {
  describe("buildGtagPayload", () => {
    it("maps ads_service_selected to view_item", () => {
      const event: AdsEvent = {
        event: "ads_service_selected",
        service_id: "svc-1",
        service_name: "Massage",
        value: 5000,
        currency: "EUR",
      };
      const payload = buildGtagPayload(event);
      expect(payload!.gtagEventName).toBe("view_item");
      expect(payload!.params.item_id).toBe("svc-1");
      expect(payload!.params.item_name).toBe("Massage");
      expect(payload!.params.value).toBe(50);
      expect(payload!.params.currency).toBe("EUR");
    });

    it("maps ads_datetime_selected to select_item", () => {
      const event: AdsEvent = {
        event: "ads_datetime_selected",
        service_id: "svc-1",
        service_name: "Soin",
        datetime: "2026-08-10T14:00:00Z",
      };
      const payload = buildGtagPayload(event);
      expect(payload!.gtagEventName).toBe("select_item");
    });

    it("maps ads_contact_submitted to generate_lead", () => {
      const event: AdsEvent = {
        event: "ads_contact_submitted",
        service_id: "svc-1",
        service_name: "Massage",
      };
      const payload = buildGtagPayload(event);
      expect(payload!.gtagEventName).toBe("generate_lead");
    });

    it("maps ads_checkout_started to begin_checkout", () => {
      const event: AdsEvent = {
        event: "ads_checkout_started",
        service_id: "svc-1",
        service_name: "Massage",
        value: 7500,
        currency: "EUR",
      };
      const payload = buildGtagPayload(event);
      expect(payload!.gtagEventName).toBe("begin_checkout");
    });

    it("maps ads_payment_method_selected to add_payment_info", () => {
      const event: AdsEvent = {
        event: "ads_payment_method_selected",
        service_id: "svc-1",
        payment_method: "onsite",
      };
      const payload = buildGtagPayload(event);
      expect(payload!.gtagEventName).toBe("add_payment_info");
      expect(payload!.params.payment_type).toBe("onsite");
    });

    it("fires purchase for ads_booking_confirmed with payment_method=onsite", () => {
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
      const payload = buildGtagPayload(event);
      expect(payload!.gtagEventName).toBe("purchase");
      expect(payload!.params.transaction_id).toBe("abc");
      expect(payload!.params.value).toBe(50);
      expect(payload!.params.items).toEqual([
        { item_id: "svc-1", item_name: "Massage", price: 50, quantity: 1 },
      ]);
    });

    it("does NOT fire purchase for ads_booking_confirmed with payment_method=online", () => {
      const event: AdsEvent = {
        event: "ads_booking_confirmed",
        event_id: "booking_abc",
        event_key: "abc",
        service_id: "svc-1",
        service_name: "Massage",
        value: 5000,
        currency: "EUR",
        payment_method: "online",
        datetime: "2026-08-10T10:00:00Z",
      };
      const payload = buildGtagPayload(event);
      expect(payload).toBeNull();
    });

    it("fires purchase for ads_payment_completed (online flow)", () => {
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
      const payload = buildGtagPayload(event);
      expect(payload!.gtagEventName).toBe("purchase");
      expect(payload!.params.transaction_id).toBe("cs_x");
    });
  });

  describe("fireGtagClient", () => {
    beforeEach(() => {
      vi.stubGlobal("window", { gtag: vi.fn() });
    });

    it("calls gtag event with correct params", () => {
      const event: AdsEvent = {
        event: "ads_payment_completed",
        event_id: "payment_y",
        event_key: "y",
        service_id: "svc-1",
        service_name: "Massage",
        value: 5000,
        currency: "EUR",
        datetime: "2026-08-10T10:00:00Z",
      };
      fireGtagClient(event);
      expect(window.gtag).toHaveBeenCalledWith(
        "event",
        "purchase",
        expect.objectContaining({ transaction_id: "y", value: 50 })
      );
    });

    it("does nothing if gtag is not available", () => {
      vi.stubGlobal("window", {});
      const event: AdsEvent = {
        event: "ads_service_selected",
        service_id: "svc-1",
        service_name: "M",
        value: 1000,
        currency: "EUR",
      };
      expect(() => fireGtagClient(event)).not.toThrow();
    });
  });
});
