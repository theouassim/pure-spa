-- 026: Ajout colonnes pour upsert idempotent + table sync_runs
-- Remplace la stratégie DELETE ALL + INSERT par UPSERT + PURGE

-- 1. Nouvelles colonnes sur external_bookings
ALTER TABLE external_bookings
  ADD COLUMN IF NOT EXISTS ical_uid text,
  ADD COLUMN IF NOT EXISTS ical_recurrence_id timestamptz NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  ADD COLUMN IF NOT EXISTS ical_sequence int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- 2. Backfill depuis raw_uid existants
-- Non-récurrents : ical_uid = raw_uid, ical_recurrence_id = epoch (sentinelle)
-- Récurrents (format uid__isodate) : split
UPDATE external_bookings
SET
  ical_uid = CASE
    WHEN raw_uid LIKE '%__20%' THEN split_part(raw_uid, '__', 1)
    ELSE raw_uid
  END,
  ical_recurrence_id = CASE
    WHEN raw_uid LIKE '%__20%' THEN split_part(raw_uid, '__', 2)::timestamptz
    ELSE '1970-01-01T00:00:00Z'::timestamptz
  END,
  last_synced_at = synced_at
WHERE ical_uid IS NULL;

-- 3. Contrainte unique pour upsert via PostgREST
-- calendar_source inclus : les DUO (même UID) existent légitimement sur 2 salles
ALTER TABLE external_bookings
  ADD CONSTRAINT uq_external_bookings_ical
  UNIQUE (calendar_source, ical_uid, ical_recurrence_id);

-- 4. Table sync_runs pour observabilité
CREATE TABLE IF NOT EXISTS sync_runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  run_ts timestamptz NOT NULL,
  calendar_source text NOT NULL,
  vevent_total int NOT NULL DEFAULT 0,
  vevent_cancelled int NOT NULL DEFAULT 0,
  vevent_retained int NOT NULL DEFAULT 0,
  rrule_masters int NOT NULL DEFAULT 0,
  rrule_expanded int NOT NULL DEFAULT 0,
  rows_upserted int NOT NULL DEFAULT 0,
  rows_purged int NOT NULL DEFAULT 0,
  rows_final int NOT NULL DEFAULT 0,
  duration_ms int NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  error_message text,
  coherence_warning boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- RLS : admin only
ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_runs_admin_all" ON sync_runs
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Service role bypass (pour le cron)
CREATE POLICY "sync_runs_service_role" ON sync_runs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
