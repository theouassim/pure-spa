-- 028_rpc_create_booking_with_slots.sql
-- RPC transactionnelle : crée un booking + ses N lignes booking_slots atomiquement.
-- En cas de violation EXCLUDE (slot occupé), lève SQLSTATE 'PS001'.

CREATE OR REPLACE FUNCTION create_booking_with_slots(
  p_service_id uuid,
  p_client_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_slot_numbers integer[],
  p_statut text DEFAULT 'confirmed',
  p_montant integer DEFAULT NULL,
  p_statut_paiement text DEFAULT 'en_attente',
  p_stripe_payment_id text DEFAULT NULL,
  p_verification_requise boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id uuid;
  v_slot integer;
  v_primary_slot integer;
BEGIN
  -- Le slot principal = MIN des slots attribués
  v_primary_slot := (SELECT min(unnest) FROM unnest(p_slot_numbers));

  -- 1. Insérer le booking
  INSERT INTO bookings (
    service_id, client_id, start_at, end_at, slot_number,
    statut, montant, statut_paiement, stripe_payment_id, verification_requise
  ) VALUES (
    p_service_id, p_client_id, p_start_at, p_end_at, v_primary_slot,
    p_statut, p_montant, p_statut_paiement, p_stripe_payment_id, p_verification_requise
  )
  RETURNING id INTO v_booking_id;

  -- 2. Insérer les booking_slots (une ligne par salle occupée)
  BEGIN
    FOREACH v_slot IN ARRAY p_slot_numbers LOOP
      INSERT INTO booking_slots (booking_id, slot_number, periode, actif)
      VALUES (v_booking_id, v_slot, tstzrange(p_start_at, p_end_at, '[)'), true);
    END LOOP;
  EXCEPTION
    WHEN exclusion_violation THEN
      RAISE EXCEPTION 'Slot occupé : un créneau chevauche une réservation existante'
        USING ERRCODE = 'PS001';
  END;

  RETURN v_booking_id;
END;
$$;
