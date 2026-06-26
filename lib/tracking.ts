type TrackingPayload = Record<string, unknown>;

interface TrackingEvent {
  name: string;
  payload: TrackingPayload;
  timestamp: string;
}

type TrackingProvider = (event: TrackingEvent) => void;

const providers: TrackingProvider[] = [];

let sessionId: string | null = null;

export function getSessionId(): string {
  if (!sessionId) {
    sessionId = crypto.randomUUID();
  }
  return sessionId;
}

export function registerProvider(provider: TrackingProvider) {
  providers.push(provider);
}

export function track(name: string, payload: TrackingPayload = {}) {
  const event: TrackingEvent = {
    name,
    payload,
    timestamp: new Date().toISOString(),
  };

  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    console.log(`[tracking] ${name}`, payload);
  }

  if (typeof window !== "undefined") {
    const sid = getSessionId();
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sid,
        event_name: name,
        payload,
        service_id: payload.service_id ?? null,
      }),
    }).catch(() => {});
  }

  for (const provider of providers) {
    try {
      provider(event);
    } catch {
      // never break UX for tracking
    }
  }
}
