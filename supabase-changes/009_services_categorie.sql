-- 009_services_categorie.sql
-- Ajout d'une catégorie pour le regroupement dans le tunnel de réservation.

alter table services add column categorie text not null default 'Soins';
