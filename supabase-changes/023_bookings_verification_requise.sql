-- Flag pour signaler les bookings créés sans vérification Planity à jour
-- (Planity injoignable au moment du checkout → vérification manuelle requise)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS verification_requise BOOLEAN NOT NULL DEFAULT false;
