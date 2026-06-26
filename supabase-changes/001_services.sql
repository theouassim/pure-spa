-- 001_services.sql
-- Table des prestations proposées par l'institut

create table services (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  duree_minutes integer not null check (duree_minutes > 0),
  prix integer not null check (prix >= 0), -- en centimes d'euros
  description text,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

-- RLS : lecture publique uniquement sur les services actifs
alter table services enable row level security;

create policy "services_public_read"
  on services for select
  using (actif = true);

create policy "services_admin_all"
  on services for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
