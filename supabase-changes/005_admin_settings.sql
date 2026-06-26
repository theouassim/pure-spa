-- 005_admin_settings.sql
-- Configuration de l'institut (une seule ligne attendue)

create table admin_settings (
  id uuid primary key default gen_random_uuid(),

  -- Horaires d'ouverture par jour (lundi=1 à dimanche=7)
  -- Format JSONB : [{"jour": 1, "ouverture": "09:00", "fermeture": "19:00"}]
  horaires_ouverture jsonb not null default '[]'::jsonb,

  -- Jours travaillés (tableau d'entiers 1-7)
  jours_travailles integer[] not null default '{}',

  -- Pauses récurrentes
  -- Format JSONB : [{"debut": "12:00", "fin": "13:00"}]
  pauses jsonb not null default '[]'::jsonb,

  -- Nombre de praticiens pouvant travailler en parallèle
  nb_praticiens integer not null default 1 check (nb_praticiens > 0),

  -- Délai minimum avant un RDV (en minutes)
  delai_min_avant_rdv integer not null default 60 check (delai_min_avant_rdv >= 0),

  -- Temps de battement entre deux prestations (en minutes)
  battement_minutes integer not null default 15 check (battement_minutes >= 0),

  -- Conditions d'annulation (texte libre affiché à la cliente)
  conditions_annulation text not null default '',

  updated_at timestamptz not null default now()
);

-- RLS : accès admin uniquement
alter table admin_settings enable row level security;

create policy "admin_settings_admin_all"
  on admin_settings for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Insertion des valeurs placeholder — À REMPLACER par les données réelles du client
insert into admin_settings (
  horaires_ouverture,
  jours_travailles,
  pauses,
  nb_praticiens,
  delai_min_avant_rdv,
  battement_minutes,
  conditions_annulation
) values (
  -- À REMPLACER — données client
  '[
    {"jour": 1, "ouverture": "09:00", "fermeture": "19:00"},
    {"jour": 2, "ouverture": "09:00", "fermeture": "19:00"},
    {"jour": 3, "ouverture": "09:00", "fermeture": "19:00"},
    {"jour": 4, "ouverture": "09:00", "fermeture": "19:00"},
    {"jour": 5, "ouverture": "09:00", "fermeture": "19:00"},
    {"jour": 6, "ouverture": "09:00", "fermeture": "17:00"}
  ]'::jsonb,
  -- À REMPLACER — jours travaillés (1=lundi à 6=samedi)
  '{1, 2, 3, 4, 5, 6}',
  -- À REMPLACER — pauses
  '[{"debut": "12:00", "fin": "13:00"}]'::jsonb,
  -- À REMPLACER — nombre de praticiens
  1,
  -- À REMPLACER — délai minimum en minutes
  60,
  -- À REMPLACER — battement en minutes
  15,
  -- À REMPLACER — conditions d'annulation
  'Annulation gratuite jusqu''à 24h avant le rendez-vous.'
);
