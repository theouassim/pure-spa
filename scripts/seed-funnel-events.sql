-- Seeds funnel_events réalistes pour juillet 2026
-- ~100 sessions, déperdition décroissante, 4 services répartis, quelques slot_expired
-- À exécuter dans le SQL Editor Supabase

-- Nettoyage des anciens seeds (optionnel)
-- DELETE FROM funnel_events WHERE created_at >= '2026-07-01' AND created_at < '2026-08-01';

DO $$
DECLARE
  service_ids UUID[] := ARRAY[
    'bdd8296a-347e-432c-9968-b9e5127e670f'::UUID,  -- Massage Relaxant
    '82b307f5-9bbc-44ea-b6a2-a657d3b0828d'::UUID,  -- Soin Visage Éclat
    '136208ba-4f42-4ae5-a024-d33f4dc1bf36'::UUID,  -- Forfait Duo Relaxation
    'e7be7fc3-a813-46ac-bc6c-c48a06b314f6'::UUID   -- Épilation Jambes
  ];
  service_weights INT[] := ARRAY[40, 25, 20, 15]; -- distribution pondérée
  total_sessions INT := 100;
  sess_id TEXT;
  svc_id UUID;
  base_time TIMESTAMPTZ;
  step_time TIMESTAMPTZ;
  rand_val FLOAT;
  svc_index INT;
  i INT;
BEGIN
  FOR i IN 1..total_sessions LOOP
    sess_id := 'seed_' || lpad(i::TEXT, 4, '0') || '_' || md5(random()::TEXT);
    -- Répartir sur les jours 1-6 juillet
    base_time := '2026-07-01 08:00:00+02'::TIMESTAMPTZ
                 + (floor(random() * 5) || ' days')::INTERVAL
                 + (floor(random() * 12) || ' hours')::INTERVAL
                 + (floor(random() * 60) || ' minutes')::INTERVAL;

    -- Choix service pondéré
    rand_val := random() * 100;
    IF rand_val < 40 THEN svc_index := 1;
    ELSIF rand_val < 65 THEN svc_index := 2;
    ELSIF rand_val < 85 THEN svc_index := 3;
    ELSE svc_index := 4;
    END IF;
    svc_id := service_ids[svc_index];

    -- Étape 1: funnel_start (100%)
    step_time := base_time;
    INSERT INTO funnel_events (session_id, event_name, payload, service_id, created_at)
    VALUES (sess_id, 'funnel_start', '{}', NULL, step_time);

    -- Étape 2: service_selected (~72%)
    IF random() > 0.28 THEN
      step_time := step_time + '15 seconds'::INTERVAL + (floor(random() * 30) || ' seconds')::INTERVAL;
      INSERT INTO funnel_events (session_id, event_name, payload, service_id, created_at)
      VALUES (sess_id, 'service_selected', jsonb_build_object('service_nom',
        CASE svc_index WHEN 1 THEN 'Massage Relaxant' WHEN 2 THEN 'Soin Visage Éclat' WHEN 3 THEN 'Forfait Duo Relaxation' ELSE 'Épilation Jambes' END
      ), svc_id, step_time);
    ELSE
      CONTINUE;
    END IF;

    -- Étape 3: calendar_viewed (~76% des service_selected)
    IF random() > 0.24 THEN
      step_time := step_time + '5 seconds'::INTERVAL + (floor(random() * 20) || ' seconds')::INTERVAL;
      INSERT INTO funnel_events (session_id, event_name, payload, service_id, created_at)
      VALUES (sess_id, 'calendar_viewed', '{}', svc_id, step_time);
    ELSE
      CONTINUE;
    END IF;

    -- Étape 4: slot_selected (~73% des calendar_viewed)
    IF random() > 0.27 THEN
      step_time := step_time + '20 seconds'::INTERVAL + (floor(random() * 45) || ' seconds')::INTERVAL;
      INSERT INTO funnel_events (session_id, event_name, payload, service_id, created_at)
      VALUES (sess_id, 'slot_selected', '{}', svc_id, step_time);
    ELSE
      CONTINUE;
    END IF;

    -- slot_expired pour ~15% des sessions qui ont slot_selected
    IF random() < 0.15 THEN
      step_time := step_time + '30 seconds'::INTERVAL;
      INSERT INTO funnel_events (session_id, event_name, payload, service_id, created_at)
      VALUES (sess_id, 'slot_expired', '{}', svc_id, step_time);
      CONTINUE; -- session terminée par expiration
    END IF;

    -- Étape 5: details_started (~70% des slot_selected restants)
    IF random() > 0.30 THEN
      step_time := step_time + '10 seconds'::INTERVAL + (floor(random() * 30) || ' seconds')::INTERVAL;
      INSERT INTO funnel_events (session_id, event_name, payload, service_id, created_at)
      VALUES (sess_id, 'details_started', '{}', svc_id, step_time);
    ELSE
      CONTINUE;
    END IF;

    -- Étape 6: booking_submitted (~65% des details_started)
    IF random() > 0.35 THEN
      step_time := step_time + '30 seconds'::INTERVAL + (floor(random() * 60) || ' seconds')::INTERVAL;
      INSERT INTO funnel_events (session_id, event_name, payload, service_id, created_at)
      VALUES (sess_id, 'booking_submitted', '{}', svc_id, step_time);
    END IF;
  END LOOP;
END $$;
