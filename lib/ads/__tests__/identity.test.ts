import { describe, it, expect, beforeEach, vi } from "vitest";
import { captureAdsIdentifiers, getAdsIdentifiers } from "../identity";

function setCookie(name: string, value: string) {
  Object.defineProperty(document, "cookie", {
    writable: true,
    value: `${name}=${encodeURIComponent(value)}`,
  });
}

function clearCookies() {
  Object.defineProperty(document, "cookie", {
    writable: true,
    value: "",
  });
}

describe("identity", () => {
  beforeEach(() => {
    clearCookies();
    vi.stubGlobal("location", { search: "" });
  });

  it("captureAdsIdentifiers reads _fbp cookie", () => {
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "_fbp=fb.1.1234567890.1234567890",
    });
    const ids = captureAdsIdentifiers();
    expect(ids.fbp).toBe("fb.1.1234567890.1234567890");
  });

  it("captureAdsIdentifiers builds fbc from fbclid URL param", () => {
    vi.stubGlobal("location", { search: "?fbclid=test_click_123" });
    const ids = captureAdsIdentifiers();
    expect(ids.fbc).toMatch(/^fb\.1\.\d+\.test_click_123$/);
  });

  it("captureAdsIdentifiers reads gclid from URL", () => {
    vi.stubGlobal("location", { search: "?gclid=EAIaIQob" });
    const ids = captureAdsIdentifiers();
    expect(ids.gclid).toBe("EAIaIQob");
  });

  it("captureAdsIdentifiers reads ttclid from URL", () => {
    vi.stubGlobal("location", { search: "?ttclid=tt_click_456" });
    const ids = captureAdsIdentifiers();
    expect(ids.ttclid).toBe("tt_click_456");
  });

  it("captureAdsIdentifiers returns nulls when nothing present", () => {
    const ids = captureAdsIdentifiers();
    expect(ids.fbp).toBeNull();
    expect(ids.fbc).toBeNull();
    expect(ids.ttclid).toBeNull();
    expect(ids.ttp).toBeNull();
    expect(ids.gclid).toBeNull();
  });

  it("getAdsIdentifiers returns stored cookie value", () => {
    const stored = JSON.stringify({ fbp: "test", fbc: null, ttclid: null, ttp: null, gclid: null });
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: `pure_spa_ads_ids=${encodeURIComponent(stored)}`,
    });
    const ids = getAdsIdentifiers();
    expect(ids.fbp).toBe("test");
  });

  it("getAdsIdentifiers recollects if cookie is corrupted", () => {
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "pure_spa_ads_ids=not_json_at_all",
    });
    const ids = getAdsIdentifiers();
    expect(ids).toHaveProperty("fbp");
  });
});
