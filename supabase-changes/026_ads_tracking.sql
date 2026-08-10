-- Migration : infrastructure tracking publicitaire serveur (CAPI Meta, TikTok Events API, Google Ads)
-- Purement additif — aucun DROP, aucun NOT NULL, aucune modif de colonne existante.

-- =============================================================================
-- 1. Colonnes ads sur bookings
-- =============================================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ads_fbp TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ads_fbc TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ads_ttclid TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ads_ttp TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ads_gclid TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ads_client_ua TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ads_client_ip TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ads_event_source_url TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ads_event_key TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ads_booking_sent_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ads_payment_sent_at TIMESTAMPTZ;

-- =============================================================================
-- 2. Table tracking_server_credentials (secrets CAPI — jamais exposés en public)
-- =============================================================================

CREATE TABLE IF NOT EXISTS tracking_server_credentials (
  provider TEXT PRIMARY KEY CHECK (provider IN ('meta', 'tiktok')),
  access_token TEXT NOT NULL DEFAULT '',
  dataset_id TEXT NOT NULL DEFAULT '',
  test_event_code TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO tracking_server_credentials (provider)
VALUES ('meta'), ('tiktok')
ON CONFLICT (provider) DO NOTHING;

ALTER TABLE tracking_server_credentials ENABLE ROW LEVEL SECURITY;

-- Deny-all : aucune policy anon/authenticated. Accès uniquement via service_role.

-- =============================================================================
-- 3. Ajout google_ads dans tracking_connectors
-- =============================================================================

ALTER TABLE tracking_connectors
  DROP CONSTRAINT IF EXISTS tracking_connectors_connector_type_check;

ALTER TABLE tracking_connectors
  ADD CONSTRAINT tracking_connectors_connector_type_check
  CHECK (connector_type IN ('ga4', 'gtm', 'meta_pixel', 'tiktok_pixel', 'google_ads'));

INSERT INTO tracking_connectors (connector_type, connector_id, enabled)
VALUES ('google_ads', '', false)
ON CONFLICT (connector_type) DO NOTHING;
