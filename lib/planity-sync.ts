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

const SALLES: SalleConfig[] = [
  { source: "salle_1", url: process.env.PLANITY_ICAL_SALLE_1 ?? "" },
  { source: "salle_2", url: process.env.PLANITY_ICAL_SALLE_2 ?? "" },
];

// Horizon de sync : occurrences récurrentes jusqu'à 3 mois dans le futur
const SYNC_HORIZON_DAYS = 90;

export async function syncAllSalles(): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  for (const salle of SALLES) {
    try {
      const result = await syncOneSalle(salle);
      results.push(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[planity-sync] Erreur salle ${salle.source}:`, message);
      results.push({ source: salle.source, upserted: 0, deleted: 0, error: message });
    }
  }

  return results;
}

async function syncOneSalle(salle: SalleConfig): Promise<SyncResult> {
  if (!salle.url) {
    throw new Error(`URL manquante pour ${salle.source}`);
  }

  const response = await fetch(salle.url, { signal: AbortSignal.timeout(15_000) });
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
      // Expand recurring event into individual occurrences
      const occurrences = event.rrule.between(now, horizon);
      for (const occ of occurrences) {
        const startAt = occ.toISOString();
        const endAt = new Date(occ.getTime() + durationMs).toISOString();
        events.push({ raw_uid: `${uid}__${startAt}`, start_at: startAt, end_at: endAt });
      }
    } else {
      // Single event
      const startAt = new Date(event.start).toISOString();
      const endAt = new Date(event.end).toISOString();
      if (isNaN(Date.parse(startAt)) || isNaN(Date.parse(endAt))) continue;
      events.push({ raw_uid: uid, start_at: startAt, end_at: endAt });
    }
  }

  let upserted = 0;
  const batchSize = 50;
  const allUids: string[] = [];

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
      .upsert(rows, { onConflict: "calendar_source,raw_uid" });

    if (error) {
      console.error(`[planity-sync] Upsert error ${salle.source}:`, error.message);
    } else {
      upserted += batch.length;
    }

    allUids.push(...batch.map((e) => e.raw_uid));
  }

  // Supprimer les events qui ont disparu du flux (annulés côté Planity)
  // Uniquement pour CETTE salle
  let deleted = 0;
  if (allUids.length > 0) {
    const { data: existing } = await supabaseAdmin
      .from("external_bookings")
      .select("raw_uid")
      .eq("calendar_source", salle.source);

    const toDelete = (existing ?? [])
      .map((r) => r.raw_uid)
      .filter((uid) => !allUids.includes(uid));

    if (toDelete.length > 0) {
      const { error } = await supabaseAdmin
        .from("external_bookings")
        .delete()
        .eq("calendar_source", salle.source)
        .in("raw_uid", toDelete);

      if (!error) deleted = toDelete.length;
    }
  }

  return { source: salle.source, upserted, deleted };
}
