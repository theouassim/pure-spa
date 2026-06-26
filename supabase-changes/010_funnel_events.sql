-- 010_funnel_events.sql
-- Tracking propriétaire du funnel de réservation.
-- Données strictement anonymes (intérêt légitime, pas de consentement cookie requis).

CREATE TABLE funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  event_name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_funnel_events_name_created ON funnel_events (event_name, created_at);
CREATE INDEX idx_funnel_events_session ON funnel_events (session_id);

-- RLS : insertion via service_role uniquement (API route), lecture admin only
ALTER TABLE funnel_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_funnel_events" ON funnel_events
  FOR SELECT TO authenticated
  USING (true);

-- Pas de policy INSERT pour anon/authenticated : seul service_role peut insérer.
