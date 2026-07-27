-- Flag d'idempotence pour le rappel 24h avant
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS email_rappel_sent boolean DEFAULT false;
