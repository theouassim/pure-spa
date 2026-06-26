-- 006_slot_number_exclusion_constraint.sql
-- Contrainte anti-chevauchement au niveau base de données (filet de sécurité).
--
-- Modèle : capacité simple (N praticiennes anonymes, mêmes horaires).
-- Approche : slot virtuel — chaque booking se voit attribuer un slot_number (1..N).
-- La contrainte d'exclusion empêche physiquement deux bookings actifs
-- d'occuper le même slot sur une plage horaire qui se chevauche.
--
-- LOGIQUE D'ATTRIBUTION DU SLOT (côté applicatif) :
-- 1. Récupérer nb_praticiens depuis admin_settings.
-- 2. Pour la plage [start_at, end_at) demandée, chercher les slots déjà occupés
--    par des bookings actifs (pending ou confirmed) qui chevauchent cette plage.
-- 3. Attribuer le plus petit slot_number (1..N) qui n'apparaît PAS dans l'ensemble
--    des slots occupés.
-- 4. Si tous les slots (1..N) sont occupés → créneau indisponible, refuser.
--
-- Risque de fragmentation : inexistant avec cette approche. Le "plus petit slot libre"
-- est optimal car la contrainte est par slot indépendamment — un booking sur le slot 2
-- ne bloque jamais un booking sur le slot 1. Il n'y a pas de "répartition" à optimiser,
-- chaque slot est un canal indépendant. Pour 2-4 praticiennes, c'est parfaitement adapté.

-- Extension requise pour les contraintes d'exclusion avec des opérateurs non-GiST natifs
create extension if not exists btree_gist;

-- Ajout de la colonne slot_number
alter table bookings add column slot_number integer not null default 1;

-- Contrainte : slot_number doit être >= 1
alter table bookings add constraint bookings_slot_number_positive
  check (slot_number >= 1);

-- Contrainte d'exclusion : deux bookings actifs ne peuvent pas occuper
-- le même slot sur des plages qui se chevauchent.
-- WHERE (statut != 'cancelled') : les bookings annulés sont exclus de la contrainte.
-- Le range est semi-ouvert [start_at, end_at) : un soin qui finit à 10h00
-- ne bloque pas un soin qui commence à 10h00 (le battement est géré côté applicatif).
alter table bookings add constraint bookings_no_overlap
  exclude using gist (
    slot_number with =,
    tstzrange(start_at, end_at, '[)') with &&
  )
  where (statut != 'cancelled');
