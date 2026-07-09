-- Agrégats analytics funnel (Phase 6.6)
-- Rattachement période : events dont created_at est dans [p_from, p_to)
-- Comptage par sessions UNIQUES (COUNT DISTINCT session_id)

CREATE OR REPLACE FUNCTION get_funnel_steps(
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS TABLE (
  event_name TEXT,
  sessions_uniques BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    e.event_name,
    COUNT(DISTINCT e.session_id) AS sessions_uniques
  FROM funnel_events e
  WHERE e.created_at >= p_from
    AND e.created_at < p_to
    AND e.event_name IN (
      'funnel_start', 'service_selected', 'calendar_viewed',
      'slot_selected', 'details_started', 'booking_submitted'
    )
  GROUP BY e.event_name;
$$;

-- slot_expired : sessions touchées + à quelle étape (dernier event avant le slot_expired)
CREATE OR REPLACE FUNCTION get_slot_expired_stats(
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS TABLE (
  total_sessions BIGINT,
  last_step_before TEXT,
  count_at_step BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH expired_sessions AS (
    SELECT DISTINCT session_id
    FROM funnel_events
    WHERE event_name = 'slot_expired'
      AND created_at >= p_from
      AND created_at < p_to
  ),
  last_step AS (
    SELECT DISTINCT ON (e.session_id)
      e.session_id,
      e.event_name AS last_event
    FROM funnel_events e
    INNER JOIN expired_sessions es ON es.session_id = e.session_id
    WHERE e.event_name != 'slot_expired'
      AND e.created_at >= p_from
      AND e.created_at < p_to
    ORDER BY e.session_id, e.created_at DESC
  )
  SELECT
    (SELECT COUNT(*) FROM expired_sessions) AS total_sessions,
    ls.last_event AS last_step_before,
    COUNT(*) AS count_at_step
  FROM last_step ls
  GROUP BY ls.last_event;
$$;

-- Top services sélectionnés (depuis service_selected events)
CREATE OR REPLACE FUNCTION get_top_services_funnel(
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  service_id UUID,
  service_nom TEXT,
  selections BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    e.service_id,
    COALESCE(s.nom, 'Service supprimé') AS service_nom,
    COUNT(DISTINCT e.session_id) AS selections
  FROM funnel_events e
  LEFT JOIN services s ON s.id = e.service_id
  WHERE e.event_name = 'service_selected'
    AND e.service_id IS NOT NULL
    AND e.created_at >= p_from
    AND e.created_at < p_to
  GROUP BY e.service_id, s.nom
  ORDER BY selections DESC
  LIMIT p_limit;
$$;
