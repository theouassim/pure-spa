import { supabaseAdmin } from "./supabase-admin";
import ical, { VEvent } from "node-ical";

interface SalleConfig {
  source: string;
  url: string;
}

interface SyncResult {
  source: string;
  upserted: number;
  deleted: number;
  error?: string;
}

export type SyncStatus = "ok" | "partial" | "failed";

export interface SyncAllResult {
  status: SyncStatus;
  results: SyncResult[];
}

const SALLES: SalleConfig[] = [
  { source: "salle_1", url: process.env.PLANITY_ICAL_SALLE_1 ?? "" },
  { source: "salle_2", url: process.env.PLANITY_ICAL_SALLE_2 ?? "" },
];

const SYNC_HORIZON_DAYS = 90;
const TIMEOUT_MS = 7_000;
const MAX_RETRIES = 2;

export async function syncAllSalles(): Promise<SyncAllResult> {
  const results = await Promise.all(
    SALLES.map((salle) => syncOneSalleWithRetry(salle))
  );

  const successCount = results.filter((r) => !r.error).length;

  let status: SyncStatus;
  if (successCount === SALLES.length) {
    status = "ok";
  } else if (successCount > 0) {
    status = "partial";
    const failed = results.filter((r) => r.error);
    for (const f of failed) {
      console.warn(`[planity-sync] Échec sync ${f.source}: ${f.error}`);
    }
  } else {
    status = "failed";
    for (const f of results) {
      console.error(`[planity-sync] Échec total sync ${f.source}: ${f.error}`);
    }
  }

  // Dédupliquer : si un même raw_uid existe dans plusieurs salles,
  // ne garder que la première (salle_1 prioritaire)
  if (successCount > 0) {
    await deduplicateCrossSalle();
  }

  return { status, results };
}

async function deduplicateCrossSalle() {
  const { data: all } = await supabaseAdmin
    .from("external_bookings")
    .select("id, raw_uid, calendar_source")
    .order("calendar_source", { ascending: true });

  if (!all || all.length === 0) return;

  const seen = new Map<string, string>();
  const toDelete: string[] = [];

  for (const row of all) {
    const key = `${row.raw_uid}__${row.calendar_source}`;
    const dedupKey = row.raw_uid;

    if (seen.has(dedupKey)) {
      // Doublon — supprimer celui-ci (salle_1 est gardé car order ascending)
      toDelete.push(row.id);
    } else {
      seen.set(dedupKey, key);
    }
  }

  if (toDelete.length > 0) {
    await supabaseAdmin
      .from("external_bookings")
      .delete()
      .in("id", toDelete);
  }
}

async function syncOneSalleWithRetry(salle: SalleConfig): Promise<SyncResult> {
  let lastError: string = "";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await syncOneSalle(salle);
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < MAX_RETRIES) {
        await sleep(500);
      }
    }
  }

  return { source: salle.source, upserted: 0, deleted: 0, error: lastError };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function syncOneSalle(salle: SalleConfig): Promise<SyncResult> {
  if (!salle.url) {
    throw new Error(`URL manquante pour ${salle.source}`);
  }

  const response = await fetch(salle.url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} pour ${salle.source}`);
  }

  const icsText = await response.text();
  const parsed = ical.sync.parseICS(icsText);

  const now = new Date();
  const horizon = new Date(now.getTime() + SYNC_HORIZON_DAYS * 24 * 3600_000);

  const events: { raw_uid: string; start_at: string; end_at: string }[] = [];

  for (const [key, component] of Object.entries(parsed)) {
    if (!component || component.type !== "VEVENT") continue;
    const event = component as VEvent;
    if (!event.start || !event.end) continue;

    const uid = event.uid ?? key;
    if (!uid) continue;

    const durationMs = new Date(event.end).getTime() - new Date(event.start).getTime();

    if (event.rrule) {
      const occurrences = event.rrule.between(now, horizon);
      for (const occ of occurrences) {
        const startAt = occ.toISOString();
        const endAt = new Date(occ.getTime() + durationMs).toISOString();
        events.push({ raw_uid: `${uid}__${startAt}`, start_at: startAt, end_at: endAt });
      }
    } else {
      const startAt = new Date(event.start).toISOString();
      const endAt = new Date(event.end).toISOString();
      if (isNaN(Date.parse(startAt)) || isNaN(Date.parse(endAt))) continue;
      events.push({ raw_uid: uid, start_at: startAt, end_at: endAt });
    }
  }

  // Suppression complète de la salle puis réinsertion — évite les doublons
  // si le format des UIDs change entre deux syncs Planity
  const { data: deletedRows } = await supabaseAdmin
    .from("external_bookings")
    .delete()
    .eq("calendar_source", salle.source)
    .select("id");

  const deleted = deletedRows?.length ?? 0;

  let upserted = 0;
  const batchSize = 50;

  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    const rows = batch.map((e) => ({
      source: "planity",
      calendar_source: salle.source,
      raw_uid: e.raw_uid,
      start_at: e.start_at,
      end_at: e.end_at,
      synced_at: new Date().toISOString(),
    }));

    const { error } = await supabaseAdmin
      .from("external_bookings")
      .insert(rows);

    if (error) {
      console.error(`[planity-sync] Insert error ${salle.source}:`, error.message);
    } else {
      upserted += batch.length;
    }
  }

  return { source: salle.source, upserted, deleted };
}
