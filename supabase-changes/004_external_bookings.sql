-- 004_external_bookings.sql
-- Cache des réservations externes (Planity via iCal)

create table external_bookings (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'planity',
  start_at timestamptz not null,
  end_at timestamptz not null,
  raw_uid text not null,
  synced_at timestamptz not null default now(),

  constraint external_bookings_time_order check (end_at > start_at)
);

-- Unicité sur raw_uid pour l'idempotence du sync Planity :
-- un même événement iCal ne doit jamais créer de doublon.
create unique index idx_external_bookings_uid on external_bookings (raw_uid);

-- Index pour le moteur de disponibilité
create index idx_external_bookings_time_range on external_bookings (start_at, end_at);

-- RLS : accès admin uniquement.
-- L'écriture se fait par le cron de sync (service_role).
alter table external_bookings enable row level security;

create policy "external_bookings_admin_all"
  on external_bookings for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
