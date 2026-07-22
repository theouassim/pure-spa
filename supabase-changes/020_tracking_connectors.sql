-- Table pour stocker les connecteurs de tracking (GA4, GTM, Meta Pixel)
CREATE TABLE IF NOT EXISTS tracking_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_type TEXT NOT NULL UNIQUE CHECK (connector_type IN ('ga4', 'gtm', 'meta_pixel')),
  connector_id TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pré-remplir les 3 connecteurs (désactivés par défaut)
INSERT INTO tracking_connectors (connector_type, connector_id, enabled)
VALUES
  ('ga4', '', false),
  ('gtm', '', false),
  ('meta_pixel', '', false)
ON CONFLICT (connector_type) DO NOTHING;

-- RLS : lecture publique (IDs publics), écriture réservée aux admins via service_role
ALTER TABLE tracking_connectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read tracking connectors"
  ON tracking_connectors FOR SELECT
  USING (true);

CREATE POLICY "Service role manages tracking connectors"
  ON tracking_connectors FOR ALL
  USING (auth.role() = 'service_role');
