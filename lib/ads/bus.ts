import type { AdsEvent } from "./events";
import { getAdsConfig, getAdsConfigSync, type AdsConfig } from "./config";
import { getConsent } from "@/lib/consent";
import { fireMetaClient } from "./adapters/meta.client";
import { fireTikTokClient } from "./adapters/tiktok.client";
import { fireGtagClient } from "./adapters/google.client";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    ttq?: { track: (event: string, params?: Record<string, unknown>, options?: Record<string, unknown>) => void };
    gtag?: (...args: unknown[]) => void;
  }
}

interface QueuedEvent {
  event: AdsEvent;
  timestamp: number;
}

const MAX_QUEUE_SIZE = 50;
// Durée max de rétention d'un événement en file (RGPD : pas de rattrapage rétroactif du consentement)
const MAX_QUEUE_AGE_MS = 3 * 60 * 1000;
const DEBUG_KEY = "PURE_SPA_ADS_DEBUG";

let queue: QueuedEvent[] = [];
let sentEventIds = new Set<string>();
let initialized = false;
let readinessCheckInterval: ReturnType<typeof setInterval> | null = null;

function isDebug(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

type DebugAction = "dispatched" | "queued" | "flushed" | "dropped_no_consent" | "dropped_dedup" | "dropped_expired";

function debugLog(action: DebugAction, event: AdsEvent, extra?: Record<string, unknown>): void {
  if (!isDebug()) return;
  const eventId = "event_id" in event ? event.event_id : null;
  console.log(
    `%c[ads-debug]%c ${action}`,
    "color:#8b5cf6;font-weight:bold",
    "color:inherit",
    { event: event.event, eventId, action, queueSize: queue.length, ...extra }
  );
}

function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}

function shouldFire(): boolean {
  if (isDev() && !isDebug()) return false;
  return true;
}

function getEventId(event: AdsEvent): string | null {
  if ("event_id" in event) return event.event_id;
  return null;
}

function hasMarketingConsent(): boolean {
  const consent = getConsent();
  return consent?.marketing === true;
}

function hasAnalyticsConsent(): boolean {
  const consent = getConsent();
  return consent?.analytics === true;
}

function isMetaReady(): boolean {
  return typeof window !== "undefined" && typeof window.fbq === "function";
}

function isTikTokReady(): boolean {
  return typeof window !== "undefined" && !!window.ttq && typeof window.ttq.track === "function";
}

function isGtagReady(): boolean {
  return typeof window !== "undefined" && typeof window.gtag === "function";
}

function fireToMeta(event: AdsEvent, config: AdsConfig): void {
  if (!config.meta_pixel_enabled || !config.meta_pixel_id) return;
  if (!hasMarketingConsent()) return;
  fireMetaClient(event);
}

function fireToTikTok(event: AdsEvent, config: AdsConfig): void {
  if (!config.tiktok_pixel_enabled || !config.tiktok_pixel_id) return;
  if (!hasMarketingConsent()) return;
  fireTikTokClient(event);
}

function fireToGtag(event: AdsEvent, config: AdsConfig): void {
  if (!config.ga4_enabled && !config.google_ads_enabled) return;
  if (!hasAnalyticsConsent()) return;
  fireGtagClient(event);
}

function dispatchEvent(event: AdsEvent, config: AdsConfig): void {
  try { fireToMeta(event, config); } catch { /* fire-and-forget */ }
  try { fireToTikTok(event, config); } catch { /* fire-and-forget */ }
  try { fireToGtag(event, config); } catch { /* fire-and-forget */ }
}

function isAnyPlatformReady(config: AdsConfig): boolean {
  if (config.meta_pixel_enabled && isMetaReady()) return true;
  if (config.tiktok_pixel_enabled && isTikTokReady()) return true;
  if ((config.ga4_enabled || config.google_ads_enabled) && isGtagReady()) return true;
  return false;
}

function getReadyPlatforms(config: AdsConfig): string[] {
  const platforms: string[] = [];
  if (config.meta_pixel_enabled && isMetaReady()) platforms.push("meta");
  if (config.tiktok_pixel_enabled && isTikTokReady()) platforms.push("tiktok");
  if ((config.ga4_enabled || config.google_ads_enabled) && isGtagReady()) platforms.push("google");
  return platforms;
}

function pruneQueue(): void {
  const now = Date.now();
  queue = queue.filter((q) => now - q.timestamp < MAX_QUEUE_AGE_MS);
}

function flushQueue(config: AdsConfig): void {
  pruneQueue();
  const pending = [...queue];
  queue = [];

  for (const item of pending) {
    const consent = getConsent();
    if (!consent) {
      debugLog("dropped_no_consent", item.event);
      continue;
    }

    const eventId = getEventId(item.event);
    if (eventId && sentEventIds.has(eventId)) {
      debugLog("dropped_dedup", item.event);
      continue;
    }
    if (eventId) sentEventIds.add(eventId);

    dispatchEvent(item.event, config);
    debugLog("flushed", item.event);
  }
}

function startReadinessCheck(): void {
  if (readinessCheckInterval) return;

  readinessCheckInterval = setInterval(async () => {
    const config = getAdsConfigSync();
    if (!config) return;

    if (isAnyPlatformReady(config) && queue.length > 0) {
      flushQueue(config);
    }

    if (queue.length === 0 && readinessCheckInterval) {
      clearInterval(readinessCheckInterval);
      readinessCheckInterval = null;
    }
  }, 200);
}

function init(): void {
  if (initialized) return;
  if (typeof window === "undefined") return;
  initialized = true;

  window.addEventListener("consent-updated", () => {
    const config = getAdsConfigSync();
    if (config && isAnyPlatformReady(config) && queue.length > 0) {
      flushQueue(config);
    }
  });

  getAdsConfig();
}

export function trackAds(event: AdsEvent): void {
  if (typeof window === "undefined") return;
  if (!shouldFire()) return;

  init();

  const eventId = getEventId(event);
  if (eventId && sentEventIds.has(eventId)) {
    debugLog("dropped_dedup", event);
    return;
  }

  const config = getAdsConfigSync();

  if (config && isAnyPlatformReady(config)) {
    const consent = getConsent();
    if (!consent) {
      enqueue(event);
      debugLog("queued", event, { reason: "no_consent_yet" });
      return;
    }
    if (eventId) sentEventIds.add(eventId);
    dispatchEvent(event, config);
    debugLog("dispatched", event, { platforms: getReadyPlatforms(config) });
  } else {
    enqueue(event);
    debugLog("queued", event, { reason: config ? "platforms_not_ready" : "config_not_loaded" });
  }
}

function enqueue(event: AdsEvent): void {
  if (queue.length >= MAX_QUEUE_SIZE) {
    queue.shift();
  }
  queue.push({ event, timestamp: Date.now() });
  startReadinessCheck();
}

export function _testReset(): void {
  queue = [];
  sentEventIds = new Set();
  initialized = false;
  if (readinessCheckInterval) {
    clearInterval(readinessCheckInterval);
    readinessCheckInterval = null;
  }
}

export function _testGetQueue(): QueuedEvent[] {
  return queue;
}

export function _testGetSentIds(): Set<string> {
  return sentEventIds;
}
