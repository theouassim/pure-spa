import { supabaseAdmin } from "./supabase-admin";
import ical, { VEvent } from "node-ical";

interface SalleConfig {
  source: string;
  url: string;
}

interface SyncResult {
  source: string;
  upserted: number;
  purged: number;
  skippedCancelled: number;
  veventTotal: number;
  veventRetained: number;
  rruleMasters: number;
  rruleExpanded: number;
  rowsFinal: number;
  durationMs: number;
  coherenceWarning: boolean;
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
const SYNC_LOOKBACK_DAYS = 30;
const TIMEOUT_MS = 7_000;
const MAX_RETRIES = 2;
const CIRCUIT_BREAKER_RATIO = 0.5;
const EPOCH_SENTINEL = "1970-01-01T00:00:00.000Z";

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

  for (const r of results) {
    const runStatus = r.error ? "failed" : "success";
    await recordSyncRun(r, runStatus);
  }

  return { status, results };
}

async function recordSyncRun(r: SyncResult, runStatus: string) {
  const { error } = await supabaseAdmin.from("sync_runs").insert({
    run_ts: new Date().toISOString(),
    calendar_source: r.source,
    vevent_total: r.veventTotal,
    vevent_cancelled: r.skippedCancelled,
    vevent_retained: r.veventRetained,
    rrule_masters: r.rruleMasters,
    rrule_expanded: r.rruleExpanded,
    rows_upserted: r.upserted,
    rows_purged: r.purged,
    rows_final: r.rowsFinal,
    duration_ms: r.durationMs,
    status: runStatus,
    error_message: r.error || null,
    coherence_warning: r.coherenceWarning,
  });
  if (error) {
    console.error(`[planity-sync] Failed to record sync_run for ${r.source}:`, error.message);
  }
}

async function getLastSuccessfulCount(source: string): Promise<number | null> {
  const { data } = await supabaseAdmin
    .from("sync_runs")
    .select("vevent_retained")
    .eq("calendar_source", source)
    .eq("status", "success")
    .order("run_ts", { ascending: false })
    .limit(1);

  if (data && data.length > 0) return data[0].vevent_retained;
  return null;
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

  return emptyResult(salle.source, lastError);
}

function emptyResult(source: string, error: string): SyncResult {
  return {
    source,
    upserted: 0,
    purged: 0,
    skippedCancelled: 0,
    veventTotal: 0,
    veventRetained: 0,
    rruleMasters: 0,
    rruleExpanded: 0,
    rowsFinal: 0,
    durationMs: 0,
    coherenceWarning: false,
    error,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getMidnightParis(): Date {
  const nowParis = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" })
  );
  nowParis.setHours(0, 0, 0, 0);
  const offset = new Date().getTime() - new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" })
  ).getTime();
  return new Date(nowParis.getTime() + offset);
}

async function syncOneSalle(salle: SalleConfig): Promise<SyncResult> {
  const startTime = Date.now();

  if (!salle.url) {
    throw new Error(`URL manquante pour ${salle.source}`);
  }

  const response = await fetch(salle.url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} pour ${salle.source}`);
  }

  const icsText = await response.text();
  const parsed = ical.sync.parseICS(icsText);

  const midnightParis = getMidnightParis();
  const lookback = new Date(midnightParis.getTime() - SYNC_LOOKBACK_DAYS * 24 * 3600_000);
  const horizon = new Date(midnightParis.getTime() + SYNC_HORIZON_DAYS * 24 * 3600_000);

  const runTs = new Date().toISOString();

  interface ParsedEvent {
    ical_uid: string;
    ical_recurrence_id: string;
    start_at: string;
    end_at: string;
  }

  const events: ParsedEvent[] = [];
  let skippedCancelled = 0;
  let veventTotal = 0;
  let rruleMasters = 0;
  let rruleExpanded = 0;

  for (const [key, component] of Object.entries(parsed)) {
    if (!component || component.type !== "VEVENT") continue;
    const event = component as VEvent;
    if (!event.start || !event.end) continue;

    veventTotal++;

    const uid = event.uid ?? key;
    if (!uid) continue;

    const eventStatus = ((event as Record<string, unknown>).status as string | undefined) ?? "";
    if (eventStatus.toUpperCase() === "CANCELLED") {
      skippedCancelled++;
      continue;
    }

    if ((event as Record<string, unknown>).recurrences) {
      console.warn(`[planity-sync] ${salle.source}: RECURRENCE-ID détecté sur UID ${uid} — non géré, occurrences potentiellement inexactes`);
    }

    const durationMs = new Date(event.end).getTime() - new Date(event.start).getTime();

    if (event.rrule) {
      rruleMasters++;
      const occurrences = event.rrule.between(lookback, horizon);
      for (const occ of occurrences) {
        const startAt = occ.toISOString();
        const endAt = new Date(occ.getTime() + durationMs).toISOString();
        events.push({
          ical_uid: uid,
          ical_recurrence_id: startAt,
          start_at: startAt,
          end_at: endAt,
        });
        rruleExpanded++;
      }
    } else {
      const startAt = new Date(event.start).toISOString();
      const endAt = new Date(event.end).toISOString();
      if (isNaN(Date.parse(startAt)) || isNaN(Date.parse(endAt))) continue;
      events.push({
        ical_uid: uid,
        ical_recurrence_id: EPOCH_SENTINEL,
        start_at: startAt,
        end_at: endAt,
      });
    }
  }

  if (skippedCancelled > 0) {
    console.log(`[planity-sync] ${salle.source}: ${skippedCancelled} VEVENT CANCELLED ignorés`);
  }

  const veventRetained = veventTotal - skippedCancelled;

  // Circuit breaker: abort if event count drops >50% vs last successful run
  const lastCount = await getLastSuccessfulCount(salle.source);
  if (lastCount !== null && veventRetained < lastCount * CIRCUIT_BREAKER_RATIO) {
    throw new Error(
      `Circuit breaker: ${salle.source} retient ${veventRetained} VEVENT vs ${lastCount} au dernier run réussi (< 50%). Sync avortée, données conservées.`
    );
  }

  // Upsert
  let upserted = 0;
  const batchSize = 50;

  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    const rows = batch.map((e) => ({
      source: "planity",
      calendar_source: salle.source,
      ical_uid: e.ical_uid,
      ical_recurrence_id: e.ical_recurrence_id,
      raw_uid: e.ical_recurrence_id !== EPOCH_SENTINEL
        ? `${e.ical_uid}__${e.ical_recurrence_id}`
        : e.ical_uid,
      start_at: e.start_at,
      end_at: e.end_at,
      synced_at: runTs,
      last_synced_at: runTs,
      ical_sequence: 0,
    }));

    const { error } = await supabaseAdmin
      .from("external_bookings")
      .upsert(rows, {
        onConflict: "calendar_source,ical_uid,ical_recurrence_id",
        ignoreDuplicates: false,
      });

    if (error) {
      console.error(`[planity-sync] Upsert error ${salle.source}:`, error.message);
    } else {
      upserted += batch.length;
    }
  }

  // Purge: delete rows not touched by this run
  const { data: purgedRows, error: purgeError } = await supabaseAdmin
    .from("external_bookings")
    .delete()
    .eq("calendar_source", salle.source)
    .lt("last_synced_at", runTs)
    .select("id");

  if (purgeError) {
    console.error(`[planity-sync] Purge error ${salle.source}:`, purgeError.message);
  }

  const purged = purgedRows?.length ?? 0;

  // Count final rows
  const { count: rowsFinal } = await supabaseAdmin
    .from("external_bookings")
    .select("id", { count: "exact", head: true })
    .eq("calendar_source", salle.source);

  const finalCount = rowsFinal ?? 0;

  // Coherence check
  const expectedRows = (veventRetained - rruleMasters) + rruleExpanded;
  const coherenceWarning = finalCount !== expectedRows;
  if (coherenceWarning) {
    console.warn(
      `[planity-sync] COHÉRENCE ${salle.source}: attendu=${expectedRows} (${veventRetained}-${rruleMasters}+${rruleExpanded}), obtenu=${finalCount}`
    );
  }

  const durationMs = Date.now() - startTime;

  return {
    source: salle.source,
    upserted,
    purged,
    skippedCancelled,
    veventTotal,
    veventRetained,
    rruleMasters,
    rruleExpanded,
    rowsFinal: finalCount,
    durationMs,
    coherenceWarning,
  };
}
