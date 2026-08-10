import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { hashEmail, hashPhone } from "../hash";

interface TikTokServerEventInput {
  eventName: string;
  eventId: string;
  eventTime: number;
  eventSourceUrl: string;
  userData: {
    email?: string;
    phone?: string;
    ttclid?: string | null;
    ttp?: string | null;
    clientIpAddress?: string | null;
    clientUserAgent?: string | null;
  };
  properties?: Record<string, unknown>;
}

interface TikTokCredentials {
  access_token: string;
  dataset_id: string;
  test_event_code: string;
}

async function getCredentials(): Promise<TikTokCredentials | null> {
  const { data, error } = await supabaseAdmin
    .from("tracking_server_credentials")
    .select("access_token, dataset_id, test_event_code")
    .eq("provider", "tiktok")
    .single();

  if (error || !data || !data.access_token || !data.dataset_id) return null;
  return data as TikTokCredentials;
}

function buildUserData(input: TikTokServerEventInput["userData"]): Record<string, unknown> {
  const ud: Record<string, unknown> = {};

  if (input.email) ud.email = hashEmail(input.email);
  if (input.phone) ud.phone_number = hashPhone(input.phone);
  if (input.ttclid) ud.ttclid = input.ttclid;
  if (input.ttp) ud.ttp = input.ttp;
  if (input.clientIpAddress) ud.ip = input.clientIpAddress;
  if (input.clientUserAgent) ud.user_agent = input.clientUserAgent;

  return ud;
}

export async function sendTikTokServerEvent(input: TikTokServerEventInput): Promise<void> {
  const creds = await getCredentials();
  if (!creds) return;

  const payload = {
    event_source: "web",
    event_source_id: creds.dataset_id,
    data: [
      {
        event: input.eventName,
        event_time: input.eventTime,
        event_id: input.eventId,
        page: { url: input.eventSourceUrl },
        user: buildUserData(input.userData),
        properties: input.properties ?? {},
      },
    ],
    ...(creds.test_event_code ? { test_event_code: creds.test_event_code } : {}),
  };

  const url = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

  await fetchWithRetry(url, payload, creds.access_token);
}

async function fetchWithRetry(url: string, body: unknown, accessToken: string, retries = 1): Promise<void> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Access-Token": accessToken,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) return;

      const text = await res.text().catch(() => "");
      console.error(`[tiktok-events-api] HTTP ${res.status} attempt ${attempt + 1}:`, text);
    } catch (err) {
      console.error(`[tiktok-events-api] Network error attempt ${attempt + 1}:`, err instanceof Error ? err.message : err);
    }
  }
}

export type { TikTokServerEventInput };
