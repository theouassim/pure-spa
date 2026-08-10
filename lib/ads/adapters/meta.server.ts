import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { hashEmail, hashPhone, hashName } from "../hash";

interface MetaServerEventInput {
  eventName: string;
  eventId: string;
  eventTime: number;
  eventSourceUrl: string;
  actionSource: "website";
  userData: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    fbp?: string | null;
    fbc?: string | null;
    clientIpAddress?: string | null;
    clientUserAgent?: string | null;
  };
  customData?: Record<string, unknown>;
}

interface MetaCredentials {
  access_token: string;
  dataset_id: string;
  test_event_code: string;
}

async function getCredentials(): Promise<MetaCredentials | null> {
  const { data, error } = await supabaseAdmin
    .from("tracking_server_credentials")
    .select("access_token, dataset_id, test_event_code")
    .eq("provider", "meta")
    .single();

  if (error || !data || !data.access_token || !data.dataset_id) return null;
  return data as MetaCredentials;
}

function buildUserData(input: MetaServerEventInput["userData"]): Record<string, unknown> {
  const ud: Record<string, unknown> = {};

  if (input.email) ud.em = [hashEmail(input.email)];
  if (input.phone) ud.ph = [hashPhone(input.phone)];
  if (input.firstName) ud.fn = [hashName(input.firstName)];
  if (input.lastName) ud.ln = [hashName(input.lastName)];
  if (input.fbp) ud.fbp = input.fbp;
  if (input.fbc) ud.fbc = input.fbc;
  if (input.clientIpAddress) ud.client_ip_address = input.clientIpAddress;
  if (input.clientUserAgent) ud.client_user_agent = input.clientUserAgent;

  return ud;
}

export async function sendMetaServerEvent(input: MetaServerEventInput): Promise<void> {
  const creds = await getCredentials();
  if (!creds) return;

  const payload = {
    data: [
      {
        event_name: input.eventName,
        event_time: input.eventTime,
        event_id: input.eventId,
        event_source_url: input.eventSourceUrl,
        action_source: input.actionSource,
        user_data: buildUserData(input.userData),
        custom_data: input.customData,
      },
    ],
    ...(creds.test_event_code ? { test_event_code: creds.test_event_code } : {}),
  };

  const url = `https://graph.facebook.com/v21.0/${creds.dataset_id}/events?access_token=${creds.access_token}`;

  await fetchWithRetry(url, payload);
}

async function fetchWithRetry(url: string, body: unknown, retries = 1): Promise<void> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) return;

      const text = await res.text().catch(() => "");
      console.error(`[meta-capi] HTTP ${res.status} attempt ${attempt + 1}:`, text);
    } catch (err) {
      console.error(`[meta-capi] Network error attempt ${attempt + 1}:`, err instanceof Error ? err.message : err);
    }
  }
}

export type { MetaServerEventInput };
