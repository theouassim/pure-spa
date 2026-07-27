-- Ajout du TikTok Pixel dans les connecteurs de tracking
ALTER TABLE tracking_connectors
  DROP CONSTRAINT IF EXISTS tracking_connectors_connector_type_check;

ALTER TABLE tracking_connectors
  ADD CONSTRAINT tracking_connectors_connector_type_check
  CHECK (connector_type IN ('ga4', 'gtm', 'meta_pixel', 'tiktok_pixel'));

INSERT INTO tracking_connectors (connector_type, connector_id, enabled)
VALUES ('tiktok_pixel', '', false)
ON CONFLICT (connector_type) DO NOTHING;
