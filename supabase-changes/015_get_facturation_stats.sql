-- Agrégats facturation (Phase 6.5)
-- Même règle que 6.4 : cancelled exclu de tout, en_attente != encaissé

CREATE OR REPLACE FUNCTION get_facturation_kpis(
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS TABLE (
  ca_encaisse BIGINT,
  ca_en_ligne BIGINT,
  ca_sur_place BIGINT,
  montant_en_attente BIGINT,
  nb_rdv BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    COALESCE(SUM(montant) FILTER (WHERE statut_paiement IN ('paye_en_ligne', 'paye_sur_place')), 0) AS ca_encaisse,
    COALESCE(SUM(montant) FILTER (WHERE statut_paiement = 'paye_en_ligne'), 0) AS ca_en_ligne,
    COALESCE(SUM(montant) FILTER (WHERE statut_paiement = 'paye_sur_place'), 0) AS ca_sur_place,
    COALESCE(SUM(montant) FILTER (WHERE statut_paiement = 'en_attente'), 0) AS montant_en_attente,
    COUNT(*) AS nb_rdv
  FROM bookings
  WHERE statut != 'cancelled'
    AND start_at >= p_from
    AND start_at < p_to;
$$;

-- CA par semaine pour le graphique (barres empilées en ligne / sur place)
CREATE OR REPLACE FUNCTION get_facturation_par_semaine(
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS TABLE (
  semaine_debut DATE,
  ca_en_ligne BIGINT,
  ca_sur_place BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    DATE_TRUNC('week', start_at)::DATE AS semaine_debut,
    COALESCE(SUM(montant) FILTER (WHERE statut_paiement = 'paye_en_ligne'), 0) AS ca_en_ligne,
    COALESCE(SUM(montant) FILTER (WHERE statut_paiement = 'paye_sur_place'), 0) AS ca_sur_place
  FROM bookings
  WHERE statut != 'cancelled'
    AND statut_paiement IN ('paye_en_ligne', 'paye_sur_place')
    AND start_at >= p_from
    AND start_at < p_to
  GROUP BY DATE_TRUNC('week', start_at)
  ORDER BY semaine_debut;
$$;

-- Liste des bookings en attente de paiement (bloc actionnable)
CREATE OR REPLACE FUNCTION get_bookings_en_attente(
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  montant BIGINT,
  client_nom TEXT,
  client_telephone TEXT,
  service_nom TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    b.id,
    b.start_at,
    b.end_at,
    b.montant,
    c.nom AS client_nom,
    c.telephone AS client_telephone,
    s.nom AS service_nom
  FROM bookings b
  LEFT JOIN clients c ON c.id = b.client_id
  LEFT JOIN services s ON s.id = b.service_id
  WHERE b.statut != 'cancelled'
    AND b.statut_paiement = 'en_attente'
    AND (p_from IS NULL OR b.start_at >= p_from)
    AND (p_to IS NULL OR b.start_at < p_to)
  ORDER BY b.start_at DESC;
$$;
