-- Fonction RPC pour lister les clients avec agrégats serveur
-- Utilisée par le dashboard admin (Phase 6.4)

CREATE OR REPLACE FUNCTION get_clients_with_stats(
  search_query TEXT DEFAULT NULL,
  sort_by TEXT DEFAULT 'dernier_rdv',
  sort_dir TEXT DEFAULT 'desc',
  page_limit INT DEFAULT 50,
  page_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  nom TEXT,
  email TEXT,
  telephone TEXT,
  created_at TIMESTAMPTZ,
  nb_rdv BIGINT,
  total_depense BIGINT,
  montant_en_attente BIGINT,
  dernier_rdv TIMESTAMPTZ,
  premier_rdv TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    c.id,
    c.nom,
    c.email,
    c.telephone,
    c.created_at,
    COUNT(b.id) FILTER (WHERE b.statut != 'cancelled') AS nb_rdv,
    COALESCE(SUM(b.montant) FILTER (WHERE b.statut_paiement IN ('paye_en_ligne', 'paye_sur_place') AND b.statut != 'cancelled'), 0) AS total_depense,
    COALESCE(SUM(b.montant) FILTER (WHERE b.statut_paiement = 'en_attente' AND b.statut != 'cancelled'), 0) AS montant_en_attente,
    MAX(b.start_at) FILTER (WHERE b.statut != 'cancelled') AS dernier_rdv,
    MIN(b.start_at) FILTER (WHERE b.statut != 'cancelled') AS premier_rdv
  FROM clients c
  LEFT JOIN bookings b ON b.client_id = c.id
  WHERE
    CASE WHEN search_query IS NOT NULL AND search_query != '' THEN
      c.nom ILIKE '%' || search_query || '%'
      OR c.email ILIKE '%' || search_query || '%'
      OR c.telephone ILIKE '%' || search_query || '%'
    ELSE TRUE END
  GROUP BY c.id
  ORDER BY
    CASE WHEN sort_by = 'dernier_rdv' AND sort_dir = 'desc' THEN MAX(b.start_at) END DESC NULLS LAST,
    CASE WHEN sort_by = 'dernier_rdv' AND sort_dir = 'asc' THEN MAX(b.start_at) END ASC NULLS LAST,
    CASE WHEN sort_by = 'total_depense' AND sort_dir = 'desc' THEN COALESCE(SUM(b.montant) FILTER (WHERE b.statut_paiement IN ('paye_en_ligne', 'paye_sur_place') AND b.statut != 'cancelled'), 0) END DESC,
    CASE WHEN sort_by = 'total_depense' AND sort_dir = 'asc' THEN COALESCE(SUM(b.montant) FILTER (WHERE b.statut_paiement IN ('paye_en_ligne', 'paye_sur_place') AND b.statut != 'cancelled'), 0) END ASC,
    CASE WHEN sort_by = 'nom' AND sort_dir = 'asc' THEN c.nom END ASC,
    CASE WHEN sort_by = 'nom' AND sort_dir = 'desc' THEN c.nom END DESC,
    c.nom ASC
  LIMIT page_limit
  OFFSET page_offset;
$$;

-- Fonction pour obtenir l'historique bookings d'un client
CREATE OR REPLACE FUNCTION get_client_bookings(
  p_client_id UUID
)
RETURNS TABLE (
  id UUID,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  statut TEXT,
  montant BIGINT,
  statut_paiement TEXT,
  service_nom TEXT,
  service_duree_minutes INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    b.id,
    b.start_at,
    b.end_at,
    b.statut,
    b.montant,
    b.statut_paiement,
    s.nom AS service_nom,
    s.duree_minutes AS service_duree_minutes
  FROM bookings b
  LEFT JOIN services s ON s.id = b.service_id
  WHERE b.client_id = p_client_id
  ORDER BY b.start_at DESC;
$$;
