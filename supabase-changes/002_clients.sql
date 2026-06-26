-- 002_clients.sql
-- Table des clientes ayant réservé

create table clients (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  email text not null,
  telephone text,
  created_at timestamptz not null default now()
);

-- RLS : accès admin uniquement.
-- L'insertion d'un client lors d'une réservation publique se fait
-- côté serveur via la service_role key (bypass RLS), jamais via l'anon key.
alter table clients enable row level security;

create policy "clients_admin_all"
  on clients for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
