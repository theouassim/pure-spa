"use client";

import { useCallback, useRef } from "react";
import { trackAds } from "@/lib/ads/bus";
import type { AdsEvent } from "@/lib/ads/events";

export function useAdsTracking() {
  const firedOnce = useRef(new Set<string>());

  const fireAds = useCallback((event: AdsEvent) => {
    trackAds(event);
  }, []);

  const fireAdsOnce = useCallback((key: string, event: AdsEvent) => {
    if (firedOnce.current.has(key)) return;
    firedOnce.current.add(key);
    trackAds(event);
  }, []);

  return { fireAds, fireAdsOnce };
}
