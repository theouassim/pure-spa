import { supabaseAdmin } from "./supabase-admin";
import {
  computeAvailableSlots,
  findFreeSlotNumber,
  getDayBoundsUTC,
  type AvailableSlot,
} from "./availability";
import type { AdminSettings, Service } from "./types";

/**
 * Récupère les créneaux disponibles pour un service donné à une date donnée.
 * Orchestre les appels DB puis délègue le calcul à la logique pure.
 */
export async function getAvailableSlots(
  serviceId: string,
  date: Date,
  options?: { skipDelayCheck?: boolean }
): Promise<AvailableSlot[]> {
  const settings = await fetchSettings();
  if (!settings) return [];

  const service = await fetchService(serviceId);
  if (!service) return [];

  // Bornes de la journée en UTC (heure locale institut → UTC) + marge battement
  const bounds = getDayBoundsUTC(date, settings.timezone, settings.battement_minutes);

  const [bookings, externals] = await Promise.all([
    fetchActiveBookingsInRange(bounds.start, bounds.end),
    fetchExternalBookingsInRange(bounds.start, bounds.end),
  ]);

  return computeAvailableSlots({
    date,
    serviceDurationMinutes: service.duree_minutes,
    settings,
    existingBookings: bookings.map((b) => ({
      start: new Date(b.start_at),
      end: new Date(b.end_at),
    })),
    externalBookings: externals.map((e) => ({
      start: new Date(e.start_at),
      end: new Date(e.end_at),
    })),
    now: new Date(),
    skipDelayCheck: options?.skipDelayCheck,
  });
}

/**
 * Attribue un slot_number pour un nouveau booking.
 * Retourne null si aucun slot libre (créneau plein).
 */
export async function assignSlotNumber(
  startAt: Date,
  endAt: Date
): Promise<number | null> {
  const settings = await fetchSettings();
  if (!settings) return null;

  const marginMs = settings.battement_minutes * 60_000;
  const queryStart = new Date(startAt.getTime() - marginMs);
  const queryEnd = new Date(endAt.getTime() + marginMs);

  const { data: bookings } = await supabaseAdmin
    .from("bookings")
    .select("start_at, end_at, slot_number")
    .in("statut", ["pending", "confirmed"])
    .lt("start_at", queryEnd.toISOString())
    .gt("end_at", queryStart.toISOString());

  return findFreeSlotNumber(
    { start: startAt, end: endAt },
    (bookings ?? []).map((b) => ({
      start: new Date(b.start_at),
      end: new Date(b.end_at),
      slot_number: b.slot_number,
    })),
    settings.nb_salles,
    settings.battement_minutes
  );
}

async function fetchSettings(): Promise<AdminSettings | null> {
  const { data } = await supabaseAdmin.from("admin_settings").select("*").limit(1).single();
  return data as AdminSettings | null;
}

async function fetchService(serviceId: string): Promise<Service | null> {
  const { data } = await supabaseAdmin.from("services").select("*").eq("id", serviceId).single();
  return data as Service | null;
}

async function fetchActiveBookingsInRange(start: Date, end: Date) {
  const { data } = await supabaseAdmin
    .from("bookings")
    .select("start_at, end_at")
    .in("statut", ["pending", "confirmed"])
    .lt("start_at", end.toISOString())
    .gt("end_at", start.toISOString());

  return data ?? [];
}

async function fetchExternalBookingsInRange(start: Date, end: Date) {
  const { data } = await supabaseAdmin
    .from("external_bookings")
    .select("start_at, end_at")
    .lt("start_at", end.toISOString())
    .gt("end_at", start.toISOString());

  return data ?? [];
}
