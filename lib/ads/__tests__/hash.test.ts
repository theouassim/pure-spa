import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { hashEmail, hashPhone, hashName } from "../hash";

describe("hash", () => {
  it("hashEmail normalizes and hashes", () => {
    const h1 = hashEmail("Alice@Example.COM");
    const h2 = hashEmail("alice@example.com");
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });

  it("hashEmail trims whitespace", () => {
    expect(hashEmail("  test@test.com  ")).toBe(hashEmail("test@test.com"));
  });

  it("hashPhone converts 06 to +33", () => {
    const h1 = hashPhone("0612345678");
    const h2 = hashPhone("+33612345678");
    expect(h1).toBe(h2);
  });

  it("hashPhone strips spaces and dots", () => {
    const h1 = hashPhone("06 12 34 56 78");
    const h2 = hashPhone("06.12.34.56.78");
    expect(h1).toBe(h2);
  });

  it("hashPhone keeps existing international prefix", () => {
    const h = hashPhone("+33612345678");
    expect(h).toHaveLength(64);
  });

  it("hashName normalizes to lowercase and trims", () => {
    const h1 = hashName("  Marie ");
    const h2 = hashName("marie");
    expect(h1).toBe(h2);
  });

  it("output is a valid hex SHA-256", () => {
    const h = hashEmail("test@test.com");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});
