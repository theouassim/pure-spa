-- 012_bookings_montant_statut_paiement.sql
-- Suivi facturation : montant figé + statut de paiement.
-- On utilise text au lieu d'un enum PG pour éviter les soucis de cast avec Supabase.

-- Montant en centimes, figé à la création (historique même si le prix change)
ALTER TABLE bookings ADD COLUMN montant integer;

-- Statut de paiement : 'paye_en_ligne', 'en_attente', 'paye_sur_place'
ALTER TABLE bookings ADD COLUMN statut_paiement text;

-- Migration des bookings existants
UPDATE bookings SET statut_paiement = 'paye_en_ligne'
  WHERE stripe_payment_id IS NOT NULL;
UPDATE bookings SET statut_paiement = 'en_attente'
  WHERE stripe_payment_id IS NULL;

-- Rendre NOT NULL après migration des données existantes
ALTER TABLE bookings ALTER COLUMN statut_paiement SET NOT NULL;
ALTER TABLE bookings ALTER COLUMN statut_paiement SET DEFAULT 'en_attente';

-- Contrainte CHECK pour valider les valeurs autorisées
ALTER TABLE bookings ADD CONSTRAINT chk_statut_paiement
  CHECK (statut_paiement IN ('paye_en_ligne', 'en_attente', 'paye_sur_place'));
