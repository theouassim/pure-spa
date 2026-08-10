export interface AdsConfig {
  meta_pixel_id: string | null;
  meta_pixel_enabled: boolean;
  tiktok_pixel_id: string | null;
  tiktok_pixel_enabled: boolean;
  ga4_measurement_id: string | null;
  ga4_enabled: boolean;
  google_ads_id: string | null;
  google_ads_enabled: boolean;
}

const EMPTY_CONFIG: AdsConfig = {
  meta_pixel_id: null,
  meta_pixel_enabled: false,
  tiktok_pixel_id: null,
  tiktok_pixel_enabled: false,
  ga4_measurement_id: null,
  ga4_enabled: false,
  google_ads_id: null,
  google_ads_enabled: false,
};

let cachedConfig: AdsConfig | null = null;
let fetchPromise: Promise<AdsConfig> | null = null;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 60_000;

async function fetchConfig(): Promise<AdsConfig> {
  try {
    const res = await fetch("/api/tracking-config");
    if (!res.ok) return EMPTY_CONFIG;
    const data = await res.json();
    const c = data.config;
    if (!c) return EMPTY_CONFIG;
    return {
      meta_pixel_id: c.meta_pixel_id ?? null,
      meta_pixel_enabled: c.meta_pixel_enabled ?? false,
      tiktok_pixel_id: c.tiktok_pixel_id ?? null,
      tiktok_pixel_enabled: c.tiktok_pixel_enabled ?? false,
      ga4_measurement_id: c.ga4_measurement_id ?? null,
      ga4_enabled: c.ga4_enabled ?? false,
      google_ads_id: c.google_ads_id ?? null,
      google_ads_enabled: c.google_ads_enabled ?? false,
    };
  } catch {
    return EMPTY_CONFIG;
  }
}

export function getAdsConfig(): Promise<AdsConfig> {
  const now = Date.now();
  if (cachedConfig && now - lastFetchedAt < CACHE_TTL_MS) {
    return Promise.resolve(cachedConfig);
  }
  if (!fetchPromise) {
    fetchPromise = fetchConfig().then((config) => {
      cachedConfig = config;
      lastFetchedAt = Date.now();
      fetchPromise = null;
      return config;
    });
  }
  return fetchPromise;
}

export function getAdsConfigSync(): AdsConfig | null {
  return cachedConfig;
}
