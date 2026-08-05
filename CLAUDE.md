# CLAUDE.md — Pure Spa × Clickway

Contexte et règles pour le développement de la plateforme de réservation Pure Spa Institut.
Ce fichier est la source de vérité pour Claude Code. Le respecter à chaque étape.

---

## 1. Objectif du projet

Plateforme de réservation sur-mesure pour un institut de spa.
- **Côté cliente** : réserver et payer un soin en ligne en quelques clics.
- **Côté admin** : gérer toutes les réservations depuis un dashboard centralisé.
- **Contrainte clé** : éviter le surbooking en tenant compte des RDV pris sur Planity (agenda externe).

---

## 2. Stack technique

- **Framework** : Next.js (App Router)
- **Base de données / Auth** : Supabase (Postgres + RLS)
- **Paiement** : Stripe (Checkout + webhooks)
- **Emails transactionnels** : Resend
- **Hébergement** : Vercel
- **Intégration externe** : flux iCal Planity (lecture seule)

---

## 3. Conventions

- **Langue UI** : français.
- **Workflow Git** : branche `staging` → PR vers `main`. Jamais de commit direct sur `main`.
- **Migrations SQL** : versionnées dans `/supabase-changes/`, nommées `NNN_description.sql`.
- **RLS** : activée sur toutes les tables. Aucune table exposée sans policy.
- **Secrets** : variables d'environnement uniquement, jamais en dur dans le code.
- **Commits** : un commit clair par fonctionnalité, PR par phase.
- Composants UI réutilisables, states gérés (loading / error / empty).

---

## 4. Modèle de données (cible)

- `services` : id, nom, durée (min), prix, description, actif.
- `clients` : id, nom, email, téléphone, created_at.
- `bookings` : id, service_id, client_id, start_at, end_at, statut (pending/confirmed/cancelled), stripe_payment_id, created_at.
- `slots` (ou calcul à la volée) : disponibilités dérivées des horaires + durées + bookings + external_bookings.
- `external_bookings` : id, source ("planity"), start_at, end_at, raw_uid, synced_at. (Cache du flux iCal.)
- `admin_settings` : horaires d'ouverture, jours travaillés, pauses, nb praticiens, délai mini, battement, conditions d'annulation.

> Le schéma exact des règles métier (durées, battements, nb praticiens) sera fourni par le client. Ne pas inventer de valeurs : utiliser des placeholders configurables.

---

## 5. Règles métier critiques

### Moteur de réservation (le cœur — zone à risque)
- Un créneau est disponible si : dans les horaires d'ouverture, hors pauses/congés, ET aucun chevauchement avec un `booking` actif OU un `external_booking` (Planity), dans la limite du nombre de praticiens en parallèle.
- La durée du créneau dépend de la prestation choisie.
- Respecter le délai minimum avant RDV et le temps de battement entre prestations.
- **Empêcher tout conflit de réservation.** C'est un critère de réussite non négociable.

### Intégration Planity (zone à risque n°2)
- Le flux iCal Planity est en **lecture seule** et **non temps réel** (refresh géré par Planity).
- Fetch périodique (cron edge function, toutes les 5-10 min) → parse (`node-ical`) → stockage dans `external_bookings`.
- Les créneaux Planity **bloquent** la réservation côté site.
- **CRITIQUE — refetch live au checkout** : avant de valider un paiement, re-récupérer le flux Planity et revérifier que le créneau est toujours libre. Si pris entre-temps → bloquer la résa et prévenir la cliente.
- RDV Planity affichés dans le dashboard admin, visuellement distincts.
- Synchro **unidirectionnelle** : le site ne renvoie rien vers Planity.

### Battement et durée Planity (décision métier validée le 28/07/2026)
- Les VEVENT Planity incluent déjà le temps de séchage dans leur durée. **Aucun battement ni turnover n'est appliqué entre un créneau Planity et une réservation interne** : la salle est considérée physiquement libre dès la fin du VEVENT.
- Le battement par prestation (`battement_min` ou global `battement_minutes`) reste appliqué **uniquement entre deux réservations internes**.
- Code : `countOverlaps` utilise `rangesOverlap` (sans battement) pour les externals, `overlapsWithBattement` pour les internes.

### Mapping salle physique ↔ slot_number
- `slot_number` correspond à une salle physique : **slot 1 = Salle 1, slot 2 = Salle 2**.
- Mapping `calendar_source → slot_number` défini dans `lib/salle-mapping.ts` (source unique de vérité) :
  - `salle_1` → 1
  - `salle_2` → 2
- `assignSlotNumbers` tient compte des `external_bookings` pour ne jamais attribuer un slot occupé par Planity.
- Un `calendar_source` inconnu est traité comme occupant **tous** les slots (fail-safe).

### Prestations DUO et booking_slots
- `services.salles_requises` : nombre de salles occupées simultanément (1 = solo, 2 = DUO). Distinct de `admin_settings.nb_salles` (capacité totale de l'institut).
- **`booking_slots`** = source de vérité de l'occupation physique. Chaque booking y a N lignes (1 par salle occupée). Colonne `actif` = soft-disable (pas de DELETE).
- `bookings.slot_number` = salle principale (MIN des slot_numbers), conservée pour affichage et second filet de sécurité.
- **Deux contraintes EXCLUDE coexistent** :
  - `booking_slots_no_overlap` (sur `booking_slots`) : empêche toute collision entre slots actifs. C'est la source de vérité.
  - `bookings_no_overlap` (sur `bookings`) : défense en profondeur sur le slot principal. Ne produit aucun faux positif.
- `booking_slots.periode` = `tstzrange(start_at, end_at, '[)')` **brute, sans battement**. Le battement reste appliqué uniquement au moment du calcul de disponibilité par `overlapsWithBattement`.
- **Triggers** sur `bookings` :
  - Changement de statut → `actif = false` (annulation) ou `actif = true` (réactivation, échoue si créneau repris).
  - Changement de `start_at`/`end_at` → mise à jour de `periode` (échoue si nouveau créneau occupé).
- **Toute création de booking passe OBLIGATOIREMENT par la RPC `create_booking_with_slots`**, jamais par un INSERT direct. Garantit l'atomicité booking + slots.
- Limitation connue : déplacer un DUO sur un créneau où une seule salle est libre → rejet (les slot_number ne changent pas, seule la periode est mise à jour).

---

## 6. Phases de développement

Avancer **phase par phase**, commit + PR à chaque phase validée. Ne pas tout générer d'un bloc.

- **Phase 1 — Setup & schema** : init Next.js, Supabase, auth admin, tables + migrations, RLS.
- **Phase 2 — Moteur de réservation** : calcul des créneaux dispo, gestion des conflits. *Tester tôt et à fond.*
- **Phase 3 — Parcours client** : prestation → calendrier → coordonnées → page de confirmation.
- **Phase 4 — Paiement Stripe** : Checkout + webhooks (initié/validé/abandonné) + **refetch Planity au checkout**.
- **Phase 5 — Intégration Planity** : cron iCal, parsing, fusion avec les dispos. *Tester avec un vrai lien iCal au plus tôt.*
- **Phase 6 — Dashboard admin** : vue calendrier (lib FullCalendar, PAS de calendrier from scratch), CRUD résa, recherche client, fiches + historique.
- **Phase 7 — Notifications email** : templates Resend (confirmation/modif/annulation, client + admin).
- **Phase 8 — Tracking & responsive** : GA4, GTM, Meta Pixel, events Stripe, responsive mobile/tablette/desktop.
- **Phase 9 — Sécurité, recette & déploiement** : audit RLS, RGPD, sauvegarde, recette end-to-end, doc, mise en ligne domaine.

---

## 7. Pièges connus à éviter

- **Ne pas coder la vue calendrier admin from scratch** → utiliser FullCalendar ou react-big-calendar.
- **Ne pas faire confiance au cache Planity au moment du paiement** → toujours refetch live au checkout.
- **Ne pas exposer de table sans RLS.**
- **Ne pas mettre de données client/perso dans des paramètres d'URL.**
- Le compte Stripe appartient au **client**, jamais à l'agence.
- Tester la logique anti-conflit et Planity **tôt**, pas en fin de projet.

---

## 8. Critères de réussite (définition de "terminé")

- Une cliente peut réserver et payer sans intervention manuelle.
- Les conflits de réservation sont empêchés automatiquement, Planity inclus.
- Les notifications email fonctionnent (client + admin).
- Le tracking remonte les données essentielles.
- L'admin gère tout depuis une interface unique.
- Le site est responsive, conforme RGPD, en ligne sur le domaine du client.
