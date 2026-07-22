-- Marge de temps (battement) configurable par service
-- NULL = utilise le battement global d'admin_settings (fallback)
ALTER TABLE services ADD COLUMN IF NOT EXISTS battement_min INTEGER DEFAULT NULL;

COMMENT ON COLUMN services.battement_min IS 'Battement spécifique au service (minutes). NULL = utilise le battement global.';
