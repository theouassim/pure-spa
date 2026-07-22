const CONSENT_COOKIE = "pure_spa_consent";
const CONSENT_DURATION_DAYS = 180;

export type ConsentCategories = {
  analytics: boolean;
  marketing: boolean;
};

export function getConsent(): ConsentCategories | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw.split("=")[1]));
  } catch {
    return null;
  }
}

export function setConsent(categories: ConsentCategories) {
  const expires = new Date();
  expires.setDate(expires.getDate() + CONSENT_DURATION_DAYS);
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(categories))};path=/;expires=${expires.toUTCString()};SameSite=Lax`;
}

export function hasConsent(): boolean {
  return getConsent() !== null;
}
