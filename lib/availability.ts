import { fromZonedTime, toZonedTime } from "date-fns-tz";
import type { AdminSettings, HoraireOuverture, Pause } from "./types";

// ============================================================
// MOTEUR DE DISPONIBILITÉ — Pure Spa
// ============================================================
//
// PRINCIPE : la disponibilité se détermine en COMPTANT les chevauchements.
// Un créneau est dispo si :
//   (bookings actifs qui chevauchent) + (external_bookings qui chevauchent) < nb_salles
//
// Le slot_number est une attribution greedy (first-fit) + filet de sécurité DB.
// Il n'est JAMAIS la source de vérité pour la disponibilité.
//
// FUSEAU HORAIRE :
// Les horaires d'ouverture et pauses sont exprimés en heure locale de l'institut
// (settings.timezone, ex: "Europe/Paris"). Le moteur les convertit en instants UTC
// pour comparaison avec les bookings stockés en timestamptz.
// La détermination du jour de la semaine se fait en heure locale de l'institut.
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
  date: Date; // un jour dans le fuseau de l'institut (seule la date compte, pas l'heure)
  serviceDurationMinutes: number;
  settings: AdminSettings;
  existingBookings: TimeRange[];
  externalBookings: TimeRange[];
  now: Date;
  granularityMinutes?: number;
  skipDelayCheck?: boolean;
  serviceBattementMinutes?: number | null;
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
    skipDelayCheck = false,
    serviceBattementMinutes,
  } = input;

  const resolvedBattement = serviceBattementMinutes ?? settings.battement_minutes;

  const tz = settings.timezone;

  // Déterminer le jour de la semaine EN HEURE LOCALE de l'institut
  const localDate = toZonedTime(date, tz);
  const dayOfWeek = getISODayOfWeek(localDate);

  if (!settings.jours_travailles.includes(dayOfWeek)) {
    return [];
  }

  const horaire = settings.horaires_ouverture.find((h) => h.jour === dayOfWeek);
  if (!horaire) {
    return [];
  }

  const candidates = generateCandidates(date, horaire, serviceDurationMinutes, granularityMinutes, tz);
  const available: AvailableSlot[] = [];

  for (const candidate of candidates) {
    if (!skipDelayCheck && isBeforeMinDelay(candidate.start, now, settings.delai_min_avant_rdv)) {
      continue;
    }

    if (overlapsPause(candidate, settings.pauses, date, tz)) {
      continue;
    }

    const occupationCount = countOverlaps(
      candidate,
      existingBookings,
      externalBookings,
      resolvedBattement
    );

    if (occupationCount >= settings.nb_salles) {
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
  nbSalles: number,
  battementMinutes: number
): number | null {
  const occupiedSlots = new Set<number>();

  for (const booking of existingBookings) {
    if (overlapsWithBattement(candidateRange, booking, battementMinutes)) {
      occupiedSlots.add(booking.slot_number);
    }
  }

  for (let slot = 1; slot <= nbSalles; slot++) {
    if (!occupiedSlots.has(slot)) {
      return slot;
    }
  }

  return null;
}

/**
 * Calcule les bornes UTC d'une journée dans le fuseau de l'institut.
 * Utilisé pour les requêtes DB (fetch bookings/externals du jour).
 * Élargit de `marginMinutes` de chaque côté pour ne pas rater un booking à cheval
 * sur la frontière (battement inclus).
 */
export function getDayBoundsUTC(
  date: Date,
  timezone: string,
  marginMinutes: number = 0
): { start: Date; end: Date } {
  // Construire 00:00:00 et 23:59:59.999 en heure locale de l'institut
  const localDate = toZonedTime(date, timezone);
  const year = localDate.getFullYear();
  const month = localDate.getMonth();
  const day = localDate.getDate();

  // 00:00:00 heure locale → UTC
  const dayStartLocal = new Date(year, month, day, 0, 0, 0, 0);
  const dayStartUTC = fromZonedTime(dayStartLocal, timezone);

  // 00:00:00 du jour suivant heure locale → UTC (fin exclusive)
  const dayEndLocal = new Date(year, month, day + 1, 0, 0, 0, 0);
  const dayEndUTC = fromZonedTime(dayEndLocal, timezone);

  const marginMs = marginMinutes * 60_000;
  return {
    start: new Date(dayStartUTC.getTime() - marginMs),
    end: new Date(dayEndUTC.getTime() + marginMs),
  };
}

// ============================================================
// Fonctions internes
// ============================================================

/**
 * Génère les créneaux candidats selon les horaires d'ouverture.
 * Les heures "HH:mm" sont interprétées dans le fuseau de l'institut
 * puis converties en instants UTC.
 */
function generateCandidates(
  date: Date,
  horaire: HoraireOuverture,
  durationMinutes: number,
  granularityMinutes: number,
  timezone: string
): TimeRange[] {
  const candidates: TimeRange[] = [];
  const openTime = parseTimeOnDate(date, horaire.ouverture, timezone);
  const closeTime = parseTimeOnDate(date, horaire.fermeture, timezone);

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

function isBeforeMinDelay(slotStart: Date, now: Date, delayMinutes: number): boolean {
  const minTime = now.getTime() + delayMinutes * 60_000;
  return slotStart.getTime() < minTime;
}

function overlapsPause(candidate: TimeRange, pauses: Pause[], date: Date, timezone: string): boolean {
  for (const pause of pauses) {
    const pauseStart = parseTimeOnDate(date, pause.debut, timezone);
    const pauseEnd = parseTimeOnDate(date, pause.fin, timezone);
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

function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

/**
 * Interprète "HH:mm" comme une heure locale dans le fuseau de l'institut,
 * sur le jour spécifié, puis retourne l'instant UTC correspondant.
 */
function parseTimeOnDate(date: Date, time: string, timezone: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  // Déterminer l'année/mois/jour dans le fuseau de l'institut
  const localDate = toZonedTime(date, timezone);
  const year = localDate.getFullYear();
  const month = localDate.getMonth();
  const day = localDate.getDate();

  // Construire la date locale (HH:mm dans le fuseau) puis convertir en UTC
  const localTime = new Date(year, month, day, hours, minutes, 0, 0);
  return fromZonedTime(localTime, timezone);
}

/**
 * Retourne le jour ISO (1=lundi, 7=dimanche).
 * Attend une date déjà exprimée en heure locale (via toZonedTime).
 */
function getISODayOfWeek(localDate: Date): number {
  const day = localDate.getDay();
  return day === 0 ? 7 : day;
}
