# Tracking publicitaire — Pure Spa

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  CLIENT (navigateur)                                             │
│                                                                  │
│  BookingFunnel / BookingSummary                                   │
│       │                                                          │
│       ▼                                                          │
│  trackAds(event)  ──→  bus.ts (queue + consent gate)             │
│       │                     │                                    │
│       │         ┌───────────┼───────────┐                        │
│       │         ▼           ▼           ▼                        │
│       │    meta.client  tiktok.client  google.client             │
│       │      fbq()        ttq.track()    gtag()                  │
│       │                                                          │
│  ConfirmationAdsTracking (page confirmation)                     │
│       └─ mêmes event_id que le serveur → déduplication           │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  SERVEUR (Vercel Edge / Serverless)                              │
│                                                                  │
│  /api/book-onsite  ou  webhook Stripe                            │
│       │                                                          │
│       ▼                                                          │
│  send-server-events.ts                                           │
│       │  claimSentAt() → idempotence                             │
│       │  isTestBooking() → skip si test                          │
│       │                                                          │
│       ├──→ meta.server.ts → Conversions API (HTTPS)              │
│       └──→ tiktok.server.ts → Events API (HTTPS)                │
│                                                                  │
│  Credentials depuis : tracking_server_credentials (service_role) │
│  JAMAIS depuis /api/tracking-config (route publique)             │
└──────────────────────────────────────────────────────────────────┘
```

## Tableau des événements

| Étape funnel | Event interne | Event ads | Meta Pixel | TikTok Pixel | GA4 / Google Ads |
|---|---|---|---|---|---|
| Choix prestation | service_selected | ads_service_selected | ServiceSelected (custom) | ViewContent | view_item |
| Choix date/heure | slot_selected | ads_datetime_selected | DateTimeSelected (custom) | DateTimeSelected (custom) | select_item |
| Formulaire validé | booking_submitted | ads_contact_submitted | ContactDetailsSubmitted (custom) | SubmitForm | generate_lead |
| Récap affiché | — | ads_checkout_started | InitiateCheckout | InitiateCheckout | begin_checkout |
| Choix mode paiement | payment_initiated | ads_payment_method_selected | PaymentMethodSelected (custom) | AddPaymentInfo | add_payment_info |
| Booking confirmé (serveur) | booking_confirmed / payment_confirmed | ads_booking_confirmed | Schedule | PlaceAnOrder | purchase (onsite) + `payment_method: "onsite"` |
| Paiement réussi (serveur) | payment_confirmed | ads_payment_completed | Purchase | CompletePayment | purchase (online) + `payment_method: "online"` |

## Mécanisme d'event_key

Le problème : dans le flux "payer en ligne", le booking n'existe qu'au webhook Stripe.
La page de confirmation ne connaît que le `session_id` Stripe.

Solution :
- **Flux "sur place"** : `event_key = booking_id` (le booking existe dès le retour de `/api/book-onsite`)
- **Flux "en ligne"** : `event_key = session_id` Stripe (connu à la fois du serveur au webhook ET de la page de confirmation via `?session_id=`)

Les event_id sont dérivés déterministement :
- `booking_{event_key}` → pour Schedule / PlaceAnOrder
- `payment_{event_key}` → pour Purchase / CompletePayment

Le serveur et le client envoient le MÊME event_id → Meta/TikTok dédupliquent automatiquement.

## Idempotence serveur

```sql
UPDATE bookings
SET ads_booking_sent_at = now()
WHERE id = $bookingId
  AND ads_booking_sent_at IS NULL
RETURNING id;
```

- Si 1 ligne retournée → on envoie (premier passage)
- Si 0 lignes → déjà envoyé → on ne fait rien
- Atomique au niveau Postgres (pas de race condition possible entre deux webhooks)
- Colonnes séparées pour chaque type d'event

## Idempotence client

`sessionStorage` indexé par `pure_spa_ads_confirmation_{event_key}` → un refresh ne re-tire pas.

## Consentement

- Marketing = Meta Pixel, TikTok Pixel
- Analytics = GA4, GTM, Google Ads
- Géré par `lib/consent.ts` + cookie `pure_spa_consent`
- Le bus vérifie le consent AVANT chaque dispatch et à chaque flush de queue
- Si refusé → l'event est jeté, jamais envoyé
- Les envois CAPI serveur ne sont PAS soumis au consent client (donnée first-party légitime)
- **File d'attente (queue)** : les événements non dispatchés sont conservés max **3 minutes** (`MAX_QUEUE_AGE_MS`). Au-delà, ils sont purgés — le consentement n'étant pas rétroactif au sens RGPD, un rattrapage tardif n'est pas acceptable.

## Credentials à saisir

### Table `tracking_connectors` (admin UI /admin/connecteurs)

| connector_type | Exemple d'ID | Source |
|---|---|---|
| meta_pixel | 123456789012345 | Events Manager → Data Sources |
| tiktok_pixel | CP1A2B3C4D5E6F | TikTok Events Manager → Pixel ID |
| ga4 | G-XXXXXXXXXX | GA4 Admin → Data Streams |
| google_ads | AW-123456789 | Google Ads → Tools → Conversions |
| gtm | GTM-XXXXXXX | GTM → Container ID |

### Table `tracking_server_credentials` (SQL uniquement, pas d'UI)

| provider | access_token | dataset_id | test_event_code |
|---|---|---|---|
| meta | System User Token (EAA...) avec perm `ads_management` | Pixel ID (même que tracking_connectors.meta_pixel) | Code temporaire Meta Test Events (vide en prod) |
| tiktok | App Token depuis TikTok Business Center | Pixel ID (même que tracking_connectors.tiktok_pixel) | Code temporaire TikTok Test Events (vide en prod) |

```sql
UPDATE tracking_server_credentials
SET access_token = 'EAA...', dataset_id = '123456789012345', test_event_code = ''
WHERE provider = 'meta';

UPDATE tracking_server_credentials
SET access_token = 'tt_token_xxx', dataset_id = 'CP1A2B3C4D5E6F', test_event_code = ''
WHERE provider = 'tiktok';
```

## Mode debug

Activé en posant dans le localStorage du navigateur :
```js
localStorage.setItem('PURE_SPA_ADS_DEBUG', '1')
```

Logge dans la console chaque événement avec :
- Action : dispatched / queued / flushed / dropped_no_consent / dropped_dedup
- Event name
- Event ID
- Queue size
- Plateformes prêtes (si dispatched)

Désactiver :
```js
localStorage.removeItem('PURE_SPA_ADS_DEBUG')
```

## Couper une plateforme en urgence

1. Aller dans /admin/connecteurs
2. Désactiver le toggle de la plateforme concernée
3. Effet immédiat (cache 60s côté client, mais le bus vérifie `enabled` à chaque dispatch)
4. Les envois CAPI serveur s'arrêtent si `access_token` est vidé dans `tracking_server_credentials`

## Ajouter une nouvelle plateforme

1. Ajouter une entrée dans `tracking_connectors` (migration SQL)
2. Mettre à jour le CHECK constraint sur `connector_type`
3. Ajouter le cas dans `/api/tracking-config` + `lib/ads/config.ts`
4. Créer un adapter client dans `lib/ads/adapters/{platform}.client.ts`
5. Si CAPI nécessaire : créer `lib/ads/adapters/{platform}.server.ts` + ajouter entry dans `tracking_server_credentials`
6. Ajouter le dispatch dans `bus.ts` → `dispatchEvent()`
7. Ajouter le mapping d'events dans l'adapter (quel event pub pour quel event business)
8. Écrire les tests

## Fichiers

| Fichier | Rôle |
|---|---|
| `lib/ads/events.ts` | Types des 7 événements pub |
| `lib/ads/ids.ts` | Génération event_id déterministes |
| `lib/ads/identity.ts` | Capture _fbp, _fbc, ttclid, _ttp, gclid |
| `lib/ads/hash.ts` | SHA-256 server-only (email, phone, name) |
| `lib/ads/config.ts` | Config pixels depuis BDD |
| `lib/ads/bus.ts` | Queue, consent gate, dispatch, debug |
| `lib/ads/send-server-events.ts` | Envoi CAPI idempotent |
| `lib/ads/adapters/meta.client.ts` | Adapter Meta client |
| `lib/ads/adapters/tiktok.client.ts` | Adapter TikTok client |
| `lib/ads/adapters/google.client.ts` | Adapter GA4/GAds client |
| `lib/ads/adapters/meta.server.ts` | Conversions API Meta |
| `lib/ads/adapters/tiktok.server.ts` | Events API TikTok |
| `hooks/useAdsTracking.ts` | Hook React (fireAds, fireAdsOnce) |
| `components/ConfirmationAdsTracking.tsx` | Tracking sur page confirmation |
| `components/TrackingScripts.tsx` | Injection pixels (modifié: autoConfig) |
| `supabase-changes/026_ads_tracking.sql` | Migration BDD |
