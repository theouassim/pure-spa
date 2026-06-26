-- 003_bookings.sql
-- Table des réservations

create type booking_status as enum ('pending', 'confirmed', 'cancelled');

create table bookings (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id) on delete restrict,
  client_id uuid not null references clients(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  statut booking_status not null default 'pending',
  stripe_payment_id text,
  created_at timestamptz not null default now(),

  constraint bookings_time_order check (end_at > start_at)
);

-- Index pour le moteur de disponibilité : requêtes fréquentes sur les plages horaires
create index idx_bookings_time_range on bookings (start_at, end_at);

-- RLS : accès admin uniquement.
-- La création de booking lors du parcours client se fait côté serveur
-- via la service_role key (bypass RLS). Le tunnel public n'a jamais accès
-- directement à cette table — cela évite toute manipulation côté client.
alter table bookings enable row level security;

create policy "bookings_admin_all"
  on bookings for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
