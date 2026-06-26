-- 013_external_bookings_calendar_source.sql
-- Ajout du champ calendar_source pour distinguer les salles Planity.

ALTER TABLE external_bookings ADD COLUMN calendar_source text NOT NULL DEFAULT 'salle_1';

-- L'index d'unicité doit inclure la source pour éviter qu'un même UID
-- partagé entre deux salles n'écrase l'autre.
DROP INDEX idx_external_bookings_uid;
CREATE UNIQUE INDEX idx_external_bookings_uid ON external_bookings (calendar_source, raw_uid);
