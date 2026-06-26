import type { AdminSettings, HoraireOuverture, Pause } from "./types";

// ============================================================
// MOTEUR DE DISPONIBILITÉ — Pure Spa
// ============================================================
//
// PRINCIPE : la disponibilité se détermine en COMPTANT les chevauchements.
// Un créneau est dispo si :
//   (bookings actifs qui chevauchent) + (external_bookings qui chevauchent) < nb_praticiens
//
// Le slot_number est une attribution greedy (first-fit) + filet de sécurité DB.
// Il n'est JAMAIS la source de vérité pour la disponibilité.
//
// LIMITE DOCUMENTÉE : l'attribution de slot (greedy first-fit) est une heuristique.
// Avec des durées de prestation variables, elle peut fragmenter l'espace et refuser
// un créneau qu'un bin-packing optimal aurait accepté. Pour 2-4 praticiennes,
// le risque est négligeable mais la logique ne suppose jamais que le slotting est parfait.
// ============================================================

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface AvailabilityInput {
  date: Date;
  serviceDurationMinutes: number;
  settings: AdminSettings;
  existingBookings: TimeRange[];
  externalBookings: TimeRange[];
  now: Date;
  granularityMinutes?: number; // pas de génération des créneaux candidats (défaut: 15)
}

export interface AvailableSlot {
  start: Date;
  end: Date;
}

/**
 * Calcule les créneaux disponibles pour un jour donné.
 * Logique pure — aucun appel DB.
 */
export function computeAvailableSlots(input: AvailabilityInput): AvailableSlot[] {
  const {
    date,
    serviceDurationMinutes,
    settings,
    existingBookings,
    externalBookings,
    now,
    granularityMinutes = 15,
  } = input;

  const dayOfWeek = getISODayOfWeek(date);

  if (!settings.jours_travailles.includes(dayOfWeek)) {
    return [];
  }

  const horaire = settings.horaires_ouverture.find((h) => h.jour === dayOfWeek);
  if (!horaire) {
    return [];
  }

  const candidates = generateCandidates(date, horaire, serviceDurationMinutes, granularityMinutes);
  const available: AvailableSlot[] = [];

  for (const candidate of candidates) {
    if (isBeforeMinDelay(candidate.start, now, settings.delai_min_avant_rdv)) {
      continue;
    }

    if (overlapsPause(candidate, settings.pauses, date)) {
      continue;
    }

    // Chevauchement avec battement : on étend chaque booking/external existant
    // de battement_minutes de chaque côté pour le calcul de conflit.
    // Un créneau candidat est en conflit s'il empiète, même partiellement,
    // sur une plage [booking.start - battement, booking.end + battement].
    const occupationCount = countOverlaps(
      candidate,
      existingBookings,
      externalBookings,
      settings.battement_minutes
    );

    if (occupationCount >= settings.nb_praticiens) {
      continue;
    }

    available.push(candidate);
  }

  return available;
}

/**
 * Trouve le premier slot_number libre (greedy first-fit) pour une plage donnée.
 * Utilisée au moment de créer un booking — PAS pour déterminer la disponibilité.
 *
 * HEURISTIQUE : le plus petit slot libre peut ne pas être optimal avec des durées
 * variables (fragmentation possible). Pour 2-4 praticiennes, le risque est négligeable.
 *
 * @returns slot_number (1-based) ou null si aucun slot libre
 */
export function findFreeSlotNumber(
  candidateRange: TimeRange,
  existingBookings: Array<TimeRange & { slot_number: number }>,
  nbPraticiens: number,
  battementMinutes: number
): number | null {
  const occupiedSlots = new Set<number>();

  for (const booking of existingBookings) {
    if (overlapsWithBattement(candidateRange, booking, battementMinutes)) {
      occupiedSlots.add(booking.slot_number);
    }
  }

  for (let slot = 1; slot <= nbPraticiens; slot++) {
    if (!occupiedSlots.has(slot)) {
      return slot;
    }
  }

  return null;
}

// ============================================================
// Fonctions internes
// ============================================================

/**
 * Génère les créneaux candidats selon les horaires d'ouverture.
 * Chaque créneau = [start, start + durée).
 */
function generateCandidates(
  date: Date,
  horaire: HoraireOuverture,
  durationMinutes: number,
  granularityMinutes: number
): TimeRange[] {
  const candidates: TimeRange[] = [];
  const openTime = parseTimeOnDate(date, horaire.ouverture);
  const closeTime = parseTimeOnDate(date, horaire.fermeture);

  let current = openTime.getTime();
  const durationMs = durationMinutes * 60_000;
  const stepMs = granularityMinutes * 60_000;

  while (current + durationMs <= closeTime.getTime()) {
    candidates.push({
      start: new Date(current),
      end: new Date(current + durationMs),
    });
    current += stepMs;
  }

  return candidates;
}

/**
 * Vérifie si un créneau tombe avant le délai minimum avant RDV.
 */
function isBeforeMinDelay(slotStart: Date, now: Date, delayMinutes: number): boolean {
  const minTime = now.getTime() + delayMinutes * 60_000;
  return slotStart.getTime() < minTime;
}

/**
 * Vérifie si un créneau candidat chevauche une pause.
 */
function overlapsPause(candidate: TimeRange, pauses: Pause[], date: Date): boolean {
  for (const pause of pauses) {
    const pauseStart = parseTimeOnDate(date, pause.debut);
    const pauseEnd = parseTimeOnDate(date, pause.fin);
    if (rangesOverlap(candidate, { start: pauseStart, end: pauseEnd })) {
      return true;
    }
  }
  return false;
}

/**
 * Compte le nombre total d'occupations (bookings + external) qui chevauchent
 * un créneau candidat, en tenant compte du battement.
 *
 * Le battement s'applique de chaque côté d'un booking existant :
 * un booking [14h-15h] avec 15min de battement "occupe" effectivement [13h45-15h15]
 * du point de vue de la disponibilité.
 */
function countOverlaps(
  candidate: TimeRange,
  bookings: TimeRange[],
  externals: TimeRange[],
  battementMinutes: number
): number {
  let count = 0;

  for (const booking of bookings) {
    if (overlapsWithBattement(candidate, booking, battementMinutes)) {
      count++;
    }
  }

  for (const ext of externals) {
    if (overlapsWithBattement(candidate, ext, battementMinutes)) {
      count++;
    }
  }

  return count;
}

/**
 * Vérifie si un créneau candidat chevauche un booking existant,
 * en incluant le battement de chaque côté du booking existant.
 *
 * Booking effectif avec battement = [booking.start - battement, booking.end + battement)
 * Chevauchement semi-ouvert : [A.start, A.end) ∩ [B.start, B.end) ≠ ∅
 *   ⟺ A.start < B.end AND B.start < A.end
 */
function overlapsWithBattement(
  candidate: TimeRange,
  booking: TimeRange,
  battementMinutes: number
): boolean {
  const battementMs = battementMinutes * 60_000;
  const effectiveStart = booking.start.getTime() - battementMs;
  const effectiveEnd = booking.end.getTime() + battementMs;

  return candidate.start.getTime() < effectiveEnd && effectiveStart < candidate.end.getTime();
}

/**
 * Chevauchement semi-ouvert entre deux ranges.
 * [A.start, A.end) ∩ [B.start, B.end) ≠ ∅ ⟺ A.start < B.end AND B.start < A.end
 */
function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

/**
 * Parse "HH:mm" en une Date UTC sur un jour donné.
 */
function parseTimeOnDate(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const d = new Date(date);
  d.setUTCHours(hours, minutes, 0, 0);
  return d;
}

/**
 * Retourne le jour ISO (1=lundi, 7=dimanche) pour une date UTC.
 */
function getISODayOfWeek(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}
