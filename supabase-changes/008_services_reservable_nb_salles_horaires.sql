-- 008_services_reservable_nb_salles_horaires.sql
-- Ajustements schema suite aux données réelles de Pure Spa.

-- 1. Certaines prestations ne sont pas réservables en ligne
alter table services add column reservable_en_ligne boolean not null default true;

-- 2. Numéro de téléphone de l'institut (affiché quand réservation en ligne indisponible)
alter table admin_settings add column telephone_contact text not null default '';

-- 3. Renommage nb_praticiens → nb_salles (la capacité parallèle = nombre de salles)
alter table admin_settings rename column nb_praticiens to nb_salles;

-- 4. Mise à jour avec les vrais horaires de Pure Spa
update admin_settings set
  horaires_ouverture = '[
    {"jour": 2, "ouverture": "10:00", "fermeture": "19:00"},
    {"jour": 3, "ouverture": "10:00", "fermeture": "19:00"},
    {"jour": 4, "ouverture": "10:00", "fermeture": "19:00"},
    {"jour": 5, "ouverture": "10:00", "fermeture": "19:00"},
    {"jour": 6, "ouverture": "10:00", "fermeture": "19:00"},
    {"jour": 7, "ouverture": "13:00", "fermeture": "19:00"}
  ]'::jsonb,
  jours_travailles = '{2, 3, 4, 5, 6, 7}',
  pauses = '[]'::jsonb,
  timezone = 'Europe/Paris';
