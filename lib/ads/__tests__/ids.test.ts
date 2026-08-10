import { describe, it, expect } from "vitest";
import { bookingEventId, paymentEventId, funnelEventId } from "../ids";

describe("ids", () => {
  it("bookingEventId prefixes with booking_", () => {
    expect(bookingEventId("abc-123")).toBe("booking_abc-123");
  });

  it("paymentEventId prefixes with payment_", () => {
    expect(paymentEventId("cs_test_xyz")).toBe("payment_cs_test_xyz");
  });

  it("funnelEventId returns a UUID", () => {
    const id = funnelEventId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("funnelEventId returns unique values", () => {
    const ids = new Set(Array.from({ length: 100 }, () => funnelEventId()));
    expect(ids.size).toBe(100);
  });

  it("bookingEventId is deterministic", () => {
    expect(bookingEventId("x")).toBe(bookingEventId("x"));
  });

  it("paymentEventId is deterministic", () => {
    expect(paymentEventId("x")).toBe(paymentEventId("x"));
  });
});
