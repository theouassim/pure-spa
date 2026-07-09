-- Flag is_test pour identifier les données de test purgeables (Phase 6.7d)

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE funnel_events ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_bookings_is_test ON bookings (is_test) WHERE is_test = true;
CREATE INDEX IF NOT EXISTS idx_funnel_events_is_test ON funnel_events (is_test) WHERE is_test = true;
