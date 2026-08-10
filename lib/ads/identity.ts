const COOKIE_NAME = "pure_spa_ads_ids";
const COOKIE_MAX_AGE_DAYS = 90;

export interface AdsIdentifiers {
  fbp: string | null;
  fbc: string | null;
  ttclid: string | null;
  ttp: string | null;
  gclid: string | null;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function setCookie(name: string, value: string): void {
  const expires = new Date();
  expires.setDate(expires.getDate() + COOKIE_MAX_AGE_DAYS);
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;expires=${expires.toUTCString()};SameSite=Lax`;
}

function readMetaCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function buildFbc(fbclid: string): string {
  const version = "fb";
  const subdomainIndex = 1;
  const creationTime = Math.floor(Date.now() / 1000);
  return `${version}.${subdomainIndex}.${creationTime}.${fbclid}`;
}

function extractUrlParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function collectIdentifiers(): AdsIdentifiers {
  const fbp = readMetaCookie("_fbp");

  let fbc = readMetaCookie("_fbc");
  if (!fbc) {
    const fbclid = extractUrlParam("fbclid");
    if (fbclid) {
      fbc = buildFbc(fbclid);
    }
  }

  const ttclid = extractUrlParam("ttclid") ?? readMetaCookie("_ttp_ttclid");
  const ttp = readMetaCookie("_ttp");
  const gclid = extractUrlParam("gclid");

  return { fbp, fbc, ttclid, ttp, gclid };
}

export function captureAdsIdentifiers(): AdsIdentifiers {
  const ids = collectIdentifiers();
  setCookie(COOKIE_NAME, JSON.stringify(ids));
  return ids;
}

export function getAdsIdentifiers(): AdsIdentifiers {
  const stored = getCookie(COOKIE_NAME);
  if (stored) {
    try {
      return JSON.parse(stored) as AdsIdentifiers;
    } catch {
      // corrupted cookie, recollect
    }
  }
  return captureAdsIdentifiers();
}
