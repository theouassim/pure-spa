import { supabaseAdmin } from "./supabase-admin";
import {
  computeAvailableSlots,
  findFreeSlotNumbers,
  getDayBoundsUTC,
  type AvailableSlot,
} from "./availability";
import type { AdminSettings, Service } from "./types";
import { getSlotForCalendarSource, getAllMappedSlots } from "./salle-mapping";

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

  const resolvedBattement = service.battement_min ?? settings.battement_minutes;
  const bounds = getDayBoundsUTC(date, settings.timezone, resolvedBattement);

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
    serviceBattementMinutes: service.battement_min,
    sallesRequises: service.salles_requises,
  });
}

/**
 * Attribue N slot_numbers pour un nouveau booking.
 * Retourne null si pas assez de slots libres (créneau plein).
 *
 * Lit booking_slots (actif=true) pour déterminer les slots occupés.
 * Le filtre statut via join est redondant (le trigger garantit actif=false sur cancelled)
 * mais conservé en ceinture-bretelles.
 */
export async function assignSlotNumbers(
  startAt: Date,
  endAt: Date,
  sallesRequises: number = 1
): Promise<number[] | null> {
  const settings = await fetchSettings();
  if (!settings) return null;

  const marginMs = settings.battement_minutes * 60_000;
  const queryStart = new Date(startAt.getTime() - marginMs);
  const queryEnd = new Date(endAt.getTime() + marginMs);

  const [{ data: bookingSlots }, { data: externals }] = await Promise.all([
    supabaseAdmin
      .from("booking_slots")
      .select("slot_number, booking:bookings!inner(start_at, end_at, statut)")
      .eq("actif", true)
      .in("booking.statut", ["pending", "confirmed"]),
    supabaseAdmin
      .from("external_bookings")
      .select("start_at, end_at, calendar_source")
      .lt("start_at", endAt.toISOString())
      .gt("end_at", startAt.toISOString()),
  ]);

  // Filtrer côté applicatif sur la fenêtre temporelle (avec marge battement)
  const relevantSlots = (bookingSlots ?? [])
    .filter((s) => {
      const b = s.booking as unknown as { start_at: string; end_at: string };
      return b.start_at < queryEnd.toISOString() && b.end_at > queryStart.toISOString();
    })
    .map((s) => {
      const b = s.booking as unknown as { start_at: string; end_at: string };
      return {
        start: new Date(b.start_at),
        end: new Date(b.end_at),
        slot_number: s.slot_number,
      };
    });

  const allMappedSlots = getAllMappedSlots();
  const externalWithSlots = (externals ?? []).flatMap((e) => {
    const slot = getSlotForCalendarSource(e.calendar_source);
    if (slot === null) {
      console.warn(
        `[assignSlotNumbers] calendar_source inconnu "${e.calendar_source}" — traité comme occupant tous les slots`
      );
      return allMappedSlots.map((s) => ({
        start: new Date(e.start_at),
        end: new Date(e.end_at),
        slot_number: s,
      }));
    }
    return [{ start: new Date(e.start_at), end: new Date(e.end_at), slot_number: slot }];
  });

  return findFreeSlotNumbers(
    { start: startAt, end: endAt },
    relevantSlots,
    settings.nb_salles,
    settings.battement_minutes,
    externalWithSlots,
    sallesRequises
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
