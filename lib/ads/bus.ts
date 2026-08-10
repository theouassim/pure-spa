import type { AdsEvent, AdsEventName } from "./events";
import { getAdsConfig, getAdsConfigSync, type AdsConfig } from "./config";
import { getConsent, type ConsentCategories } from "@/lib/consent";

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
const MAX_QUEUE_AGE_MS = 10 * 60 * 1000;
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

function isConversionEvent(name: AdsEventName): boolean {
  return name === "ads_booking_confirmed" || name === "ads_payment_completed";
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
  if (!isMetaReady()) return;

  const params: Record<string, unknown> = {};
  if ("value" in event) params.value = event.value / 100;
  if ("currency" in event) params.currency = event.currency;
  if ("service_name" in event) params.content_name = event.service_name;
  if ("service_id" in event) params.content_ids = [event.service_id];

  const eventId = getEventId(event);
  const options: Record<string, unknown> = {};
  if (eventId) options.eventID = eventId;

  const fbEventName = mapToMetaEvent(event.event);
  if (!fbEventName) return;

  if (Object.keys(options).length > 0) {
    window.fbq!("track", fbEventName, params, options);
  } else {
    window.fbq!("trackCustom", fbEventName, params);
  }
}

function mapToMetaEvent(name: AdsEventName): string | null {
  switch (name) {
    case "ads_service_selected": return "ViewContent";
    case "ads_datetime_selected": return null;
    case "ads_contact_submitted": return "Lead";
    case "ads_checkout_started": return "InitiateCheckout";
    case "ads_payment_method_selected": return null;
    case "ads_booking_confirmed": return "Schedule";
    case "ads_payment_completed": return "Purchase";
  }
}

function fireToTikTok(event: AdsEvent, config: AdsConfig): void {
  if (!config.tiktok_pixel_enabled || !config.tiktok_pixel_id) return;
  if (!hasMarketingConsent()) return;
  if (!isTikTokReady()) return;

  const params: Record<string, unknown> = {};
  if ("value" in event) params.value = event.value / 100;
  if ("currency" in event) params.currency = event.currency;
  if ("service_id" in event) params.content_id = event.service_id;
  if ("service_name" in event) params.content_name = event.service_name;

  const eventId = getEventId(event);
  if (eventId) params.event_id = eventId;

  const ttEventName = mapToTikTokEvent(event.event);
  if (!ttEventName) return;

  window.ttq!.track(ttEventName, params);
}

function mapToTikTokEvent(name: AdsEventName): string | null {
  switch (name) {
    case "ads_service_selected": return "ViewContent";
    case "ads_datetime_selected": return null;
    case "ads_contact_submitted": return "SubmitForm";
    case "ads_checkout_started": return "InitiateCheckout";
    case "ads_payment_method_selected": return null;
    case "ads_booking_confirmed": return "CompleteRegistration";
    case "ads_payment_completed": return "CompletePayment";
  }
}

function fireToGtag(event: AdsEvent, config: AdsConfig): void {
  if (!config.ga4_enabled && !config.google_ads_enabled) return;
  if (!hasAnalyticsConsent()) return;
  if (!isGtagReady()) return;

  const params: Record<string, unknown> = {};
  if ("value" in event) params.value = event.value / 100;
  if ("currency" in event) params.currency = event.currency;
  if ("service_id" in event) params.item_id = event.service_id;
  if ("service_name" in event) params.item_name = event.service_name;
  if ("payment_method" in event) params.payment_type = event.payment_method;

  const eventId = getEventId(event);
  if (eventId) params.transaction_id = eventId;

  const gtagEventName = mapToGtagEvent(event.event);
  if (!gtagEventName) return;

  window.gtag!("event", gtagEventName, params);
}

function mapToGtagEvent(name: AdsEventName): string | null {
  switch (name) {
    case "ads_service_selected": return "view_item";
    case "ads_datetime_selected": return "add_to_cart";
    case "ads_contact_submitted": return "generate_lead";
    case "ads_checkout_started": return "begin_checkout";
    case "ads_payment_method_selected": return "add_payment_info";
    case "ads_booking_confirmed": return "purchase";
    case "ads_payment_completed": return "purchase";
  }
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
