-- 029_backfill_booking_slots_orphans.sql
-- Rattrapage : bookings créés entre l'exécution de 027 et le déploiement du nouveau code.
-- Idempotent : ON CONFLICT DO NOTHING.
-- À exécuter APRÈS le déploiement du code, AVANT de considérer le système cohérent.

INSERT INTO booking_slots (booking_id, slot_number, periode, actif)
SELECT
  b.id,
  b.slot_number,
  tstzrange(b.start_at, b.end_at, '[)'),
  true
FROM bookings b
LEFT JOIN booking_slots bs ON bs.booking_id = b.id
WHERE b.statut != 'cancelled'
  AND bs.booking_id IS NULL
ON CONFLICT (booking_id, slot_number) DO NOTHING;

-- Vérification : doit retourner 0 ligne
SELECT b.id, b.start_at, b.slot_number
FROM bookings b
LEFT JOIN booking_slots bs ON bs.booking_id = b.id
WHERE b.statut != 'cancelled' AND bs.booking_id IS NULL;
