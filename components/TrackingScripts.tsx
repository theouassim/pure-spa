"use client";

import { useEffect, useState } from "react";
import { getConsent, type ConsentCategories } from "@/lib/consent";

interface TrackingConfig {
  ga4_measurement_id: string | null;
  ga4_enabled: boolean;
  gtm_container_id: string | null;
  gtm_enabled: boolean;
  meta_pixel_id: string | null;
  meta_pixel_enabled: boolean;
}

export function TrackingScripts() {
  const [config, setConfig] = useState<TrackingConfig | null>(null);
  const [consent, setConsentState] = useState<ConsentCategories | null>(null);
  const [injected, setInjected] = useState({ ga4: false, gtm: false, pixel: false });

  useEffect(() => {
    fetch("/api/tracking-config")
      .then((r) => r.json())
      .then((data) => setConfig(data.config ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function updateConsent() {
      setConsentState(getConsent());
    }
    updateConsent();
    window.addEventListener("consent-updated", updateConsent);
    return () => window.removeEventListener("consent-updated", updateConsent);
  }, []);

  useEffect(() => {
    if (!config || !consent) return;

    if (config.ga4_enabled && config.ga4_measurement_id && consent.analytics && !injected.ga4) {
      injectGA4(config.ga4_measurement_id);
      setInjected((p) => ({ ...p, ga4: true }));
    }

    if (config.gtm_enabled && config.gtm_container_id && consent.analytics && !injected.gtm) {
      injectGTM(config.gtm_container_id);
      setInjected((p) => ({ ...p, gtm: true }));
    }

    if (config.meta_pixel_enabled && config.meta_pixel_id && consent.marketing && !injected.pixel) {
      injectMetaPixel(config.meta_pixel_id);
      setInjected((p) => ({ ...p, pixel: true }));
    }
  }, [config, consent, injected]);

  return null;
}

function injectGA4(id: string) {
  const script = document.createElement("script");
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  script.async = true;
  document.head.appendChild(script);

  const inline = document.createElement("script");
  inline.textContent = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${id}');
  `;
  document.head.appendChild(inline);
}

function injectGTM(id: string) {
  const script = document.createElement("script");
  script.textContent = `
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','${id}');
  `;
  document.head.appendChild(script);
}

function injectMetaPixel(id: string) {
  const script = document.createElement("script");
  script.textContent = `
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${id}');
    fbq('track', 'PageView');
  `;
  document.head.appendChild(script);
}
