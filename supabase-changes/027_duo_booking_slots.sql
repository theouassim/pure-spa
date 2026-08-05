-- 027_duo_booking_slots.sql
-- Support des prestations DUO : un booking peut occuper N salles simultanément.
--
-- Changements :
-- a) services.salles_requises : nombre de salles occupées par la prestation
-- b) booking_slots : table d'occupation physique (source de vérité)
--    Colonne `actif` : soft-disable au lieu de DELETE (cohérent avec soft-delete bookings)
-- c) Backfill depuis bookings existants
-- d) Contrainte EXCLUDE partielle sur booking_slots WHERE (actif)
-- e) Triggers :
--    - Changement de statut → actif = true/false
--    - Changement de start_at/end_at → mise à jour de periode
--
-- LIMITATION CONNUE : déplacer un DUO sur un créneau où une seule salle est libre
-- changera la periode mais pas les slot_number. Le DUO gardera ses slots d'origine,
-- ce qui peut violer la contrainte EXCLUDE. C'est acceptable : l'erreur est explicite.

-- ============================================================
-- a) services.salles_requises
-- ============================================================
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS salles_requises smallint NOT NULL DEFAULT 1
  CONSTRAINT services_salles_requises_positive CHECK (salles_requises >= 1);

-- ============================================================
-- b) booking_slots
-- ============================================================
CREATE TABLE IF NOT EXISTS booking_slots (
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  slot_number integer NOT NULL CHECK (slot_number >= 1),
  periode tstzrange NOT NULL,
  actif boolean NOT NULL DEFAULT true,
  PRIMARY KEY (booking_id, slot_number)
);

-- Index GIST partiel : seules les lignes actives participent aux requêtes de dispo
CREATE INDEX IF NOT EXISTS idx_booking_slots_periode_actif
  ON booking_slots USING gist (periode)
  WHERE (actif);

-- ============================================================
-- c) Backfill : une ligne par booking actif avec son slot_number actuel
-- ============================================================
INSERT INTO booking_slots (booking_id, slot_number, periode, actif)
SELECT id, slot_number, tstzrange(start_at, end_at, '[)'), true
FROM bookings
WHERE statut != 'cancelled'
ON CONFLICT (booking_id, slot_number) DO NOTHING;

-- ============================================================
-- d) Contrainte EXCLUDE partielle (après backfill)
-- ============================================================
-- Si cette étape échoue, il y a des collisions dans les données existantes.
-- NE PAS forcer : investiguer les lignes en collision avec :
--   SELECT a.booking_id, a.slot_number, a.periode, b.booking_id, b.periode
--   FROM booking_slots a JOIN booking_slots b
--     ON a.slot_number = b.slot_number AND a.booking_id < b.booking_id
--     AND a.periode && b.periode AND a.actif AND b.actif;
ALTER TABLE booking_slots
  ADD CONSTRAINT booking_slots_no_overlap
  EXCLUDE USING gist (slot_number WITH =, periode WITH &&)
  WHERE (actif);

-- ============================================================
-- e) Triggers
-- ============================================================

-- Trigger 1 : changement de statut → soft-disable/enable des slots
CREATE OR REPLACE FUNCTION trg_booking_status_sync_slots()
RETURNS trigger AS $$
BEGIN
  -- Annulation : désactiver les slots
  IF NEW.statut = 'cancelled' AND OLD.statut != 'cancelled' THEN
    UPDATE booking_slots SET actif = false WHERE booking_id = NEW.id;
    RETURN NEW;
  END IF;

  -- Réactivation : réactiver les slots
  -- Si la contrainte EXCLUDE refuse (créneau repris), l'UPDATE échoue.
  IF OLD.statut = 'cancelled' AND NEW.statut != 'cancelled' THEN
    UPDATE booking_slots SET actif = true WHERE booking_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_booking_status_change ON bookings;
CREATE TRIGGER trg_booking_status_change
  AFTER UPDATE OF statut ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION trg_booking_status_sync_slots();

-- Trigger 2 : reprogrammation (start_at ou end_at change) → mise à jour periode
-- La contrainte EXCLUDE rejettera si le nouveau créneau est occupé.
CREATE OR REPLACE FUNCTION trg_booking_reschedule_sync_slots()
RETURNS trigger AS $$
BEGIN
  IF NEW.start_at IS DISTINCT FROM OLD.start_at OR NEW.end_at IS DISTINCT FROM OLD.end_at THEN
    UPDATE booking_slots
    SET periode = tstzrange(NEW.start_at, NEW.end_at, '[)')
    WHERE booking_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_booking_reschedule ON bookings;
CREATE TRIGGER trg_booking_reschedule
  AFTER UPDATE OF start_at, end_at ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION trg_booking_reschedule_sync_slots();
