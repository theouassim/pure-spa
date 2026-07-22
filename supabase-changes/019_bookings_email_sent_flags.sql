-- Flags d'idempotence pour éviter les doublons d'emails
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS email_confirmation_sent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_annulation_sent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_modification_sent boolean DEFAULT false;
