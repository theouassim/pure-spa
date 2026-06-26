-- 007_admin_settings_timezone.sql
-- Ajout du fuseau horaire de l'institut.
-- Le moteur de disponibilité interprète les horaires (ouverture, pauses)
-- dans ce fuseau puis convertit en UTC pour le stockage/comparaison.

alter table admin_settings
  add column timezone text not null default 'Europe/Paris';
