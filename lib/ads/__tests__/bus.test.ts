import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { AdsEvent } from "../events";

vi.mock("@/lib/consent", () => ({
  getConsent: vi.fn(),
}));

vi.mock("../config", () => ({
  getAdsConfig: vi.fn(),
  getAdsConfigSync: vi.fn(),
}));

import { trackAds, _testReset, _testGetQueue, _testGetSentIds } from "../bus";
import { getConsent } from "@/lib/consent";
import { getAdsConfigSync, getAdsConfig } from "../config";

const mockedGetConsent = vi.mocked(getConsent);
const mockedGetAdsConfigSync = vi.mocked(getAdsConfigSync);
const mockedGetAdsConfig = vi.mocked(getAdsConfig);

const BASE_CONFIG = {
  meta_pixel_id: "123456789012345",
  meta_pixel_enabled: true,
  tiktok_pixel_id: null,
  tiktok_pixel_enabled: false,
  ga4_measurement_id: null,
  ga4_enabled: false,
  google_ads_id: null,
  google_ads_enabled: false,
};

const SERVICE_SELECTED: AdsEvent = {
  event: "ads_service_selected",
  service_id: "svc-1",
  service_name: "Massage",
  value: 5000,
  currency: "EUR",
};

const BOOKING_CONFIRMED: AdsEvent = {
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

describe("bus", () => {
  beforeEach(() => {
    _testReset();
    vi.useFakeTimers();
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      localStorage: { getItem: () => null },
    });
    mockedGetAdsConfig.mockResolvedValue(BASE_CONFIG);
    mockedGetAdsConfigSync.mockReturnValue(null);
    mockedGetConsent.mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("queueing before readiness", () => {
    it("queues events when config is not yet loaded", () => {
      mockedGetAdsConfigSync.mockReturnValue(null);
      trackAds(SERVICE_SELECTED);
      expect(_testGetQueue()).toHaveLength(1);
      expect(_testGetQueue()[0].event).toBe(SERVICE_SELECTED);
    });

    it("queues events when platforms are not ready", () => {
      mockedGetAdsConfigSync.mockReturnValue(BASE_CONFIG);
      mockedGetConsent.mockReturnValue({ analytics: true, marketing: true });
      // fbq not defined on window
      trackAds(SERVICE_SELECTED);
      expect(_testGetQueue()).toHaveLength(1);
    });

    it("respects max queue size of 50", () => {
      mockedGetAdsConfigSync.mockReturnValue(null);
      for (let i = 0; i < 60; i++) {
        trackAds({ ...SERVICE_SELECTED, service_id: `svc-${i}` });
      }
      expect(_testGetQueue()).toHaveLength(50);
    });

    it("drops oldest events when queue overflows", () => {
      mockedGetAdsConfigSync.mockReturnValue(null);
      for (let i = 0; i < 55; i++) {
        trackAds({ ...SERVICE_SELECTED, service_id: `svc-${i}` });
      }
      const queue = _testGetQueue();
      const firstEvent = queue[0].event as typeof SERVICE_SELECTED;
      expect(firstEvent.service_id).toBe("svc-5");
    });
  });

  describe("flush on readiness", () => {
    it("flushes queue when platform becomes ready", () => {
      const mockFbq = vi.fn();
      vi.stubGlobal("window", {
        addEventListener: vi.fn(),
        localStorage: { getItem: () => null },
        fbq: mockFbq,
      });

      mockedGetAdsConfigSync.mockReturnValue(null);
      trackAds(SERVICE_SELECTED);
      expect(_testGetQueue()).toHaveLength(1);

      mockedGetAdsConfigSync.mockReturnValue(BASE_CONFIG);
      mockedGetConsent.mockReturnValue({ analytics: true, marketing: true });

      vi.advanceTimersByTime(200);
      expect(_testGetQueue()).toHaveLength(0);
      expect(mockFbq).toHaveBeenCalled();
    });
  });

  describe("consent gating", () => {
    it("does not dispatch when consent is absent", () => {
      const mockFbq = vi.fn();
      vi.stubGlobal("window", {
        addEventListener: vi.fn(),
        localStorage: { getItem: () => null },
        fbq: mockFbq,
      });

      mockedGetAdsConfigSync.mockReturnValue(BASE_CONFIG);
      mockedGetConsent.mockReturnValue(null);

      trackAds(SERVICE_SELECTED);
      expect(mockFbq).not.toHaveBeenCalled();
      expect(_testGetQueue()).toHaveLength(1);
    });

    it("drops queued events if consent is refused at flush time", () => {
      mockedGetAdsConfigSync.mockReturnValue(null);
      trackAds(SERVICE_SELECTED);

      mockedGetAdsConfigSync.mockReturnValue(BASE_CONFIG);
      mockedGetConsent.mockReturnValue(null);

      vi.stubGlobal("window", {
        addEventListener: vi.fn(),
        localStorage: { getItem: () => null },
        fbq: vi.fn(),
      });

      vi.advanceTimersByTime(200);
      expect(_testGetQueue()).toHaveLength(0);
    });
  });

  describe("deduplication", () => {
    it("deduplicates by event_id", () => {
      const mockFbq = vi.fn();
      vi.stubGlobal("window", {
        addEventListener: vi.fn(),
        localStorage: { getItem: () => null },
        fbq: mockFbq,
      });
      mockedGetAdsConfigSync.mockReturnValue(BASE_CONFIG);
      mockedGetConsent.mockReturnValue({ analytics: true, marketing: true });

      trackAds(BOOKING_CONFIRMED);
      trackAds(BOOKING_CONFIRMED);

      expect(mockFbq).toHaveBeenCalledTimes(1);
    });

    it("does not deduplicate funnel events without event_id", () => {
      const mockFbq = vi.fn();
      vi.stubGlobal("window", {
        addEventListener: vi.fn(),
        localStorage: { getItem: () => null },
        fbq: mockFbq,
      });
      mockedGetAdsConfigSync.mockReturnValue(BASE_CONFIG);
      mockedGetConsent.mockReturnValue({ analytics: true, marketing: true });

      trackAds(SERVICE_SELECTED);
      trackAds(SERVICE_SELECTED);

      expect(mockFbq).toHaveBeenCalledTimes(2);
    });
  });

  describe("queue purge by age", () => {
    it("purges events older than 10 minutes", () => {
      mockedGetAdsConfigSync.mockReturnValue(null);
      trackAds(SERVICE_SELECTED);

      vi.advanceTimersByTime(11 * 60 * 1000);

      mockedGetAdsConfigSync.mockReturnValue(BASE_CONFIG);
      mockedGetConsent.mockReturnValue({ analytics: true, marketing: true });

      const mockFbq = vi.fn();
      vi.stubGlobal("window", {
        addEventListener: vi.fn(),
        localStorage: { getItem: () => null },
        fbq: mockFbq,
      });

      vi.advanceTimersByTime(200);
      expect(mockFbq).not.toHaveBeenCalled();
      expect(_testGetQueue()).toHaveLength(0);
    });
  });

  describe("no-op in dev mode", () => {
    it("does not track in development without debug flag", () => {
      vi.stubEnv("NODE_ENV", "development");

      mockedGetAdsConfigSync.mockReturnValue(BASE_CONFIG);
      mockedGetConsent.mockReturnValue({ analytics: true, marketing: true });

      trackAds(SERVICE_SELECTED);
      expect(_testGetQueue()).toHaveLength(0);

      vi.unstubAllEnvs();
    });
  });
});
