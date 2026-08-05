import { supabaseAdmin } from "./supabase-admin";
import { getAvailableSlots, assignSlotNumbers } from "./availability-service";
import { syncAllSalles } from "./planity-sync";
import { sendVerificationAlert } from "./emails";
import type { StatutPaiement } from "./types";
import { getSlotForCalendarSource, getAllMappedSlots } from "./salle-mapping";

export interface CreateBookingInput {
  serviceId: string;
  clientId: string;
  startAt: string;
  endAt: string;
  stripePaymentId: string | null;
  statutPaiement: StatutPaiement;
  allowOverride?: boolean;
}

export type CreateBookingResult =
  | { success: true; bookingId: string; verificationRequise: boolean }
  | { success: false; reason: "slot_expired" | "no_slot" | "db_error" | "service_not_found" };

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const { serviceId, clientId, startAt, endAt, stripePaymentId, statutPaiement, allowOverride } = input;

  const slotStart = new Date(startAt);
  const slotEnd = new Date(endAt);

  const { data: service } = await supabaseAdmin
    .from("services")
    .select("prix, salles_requises")
    .eq("id", serviceId)
    .single();

  if (!service) {
    return { success: false, reason: "service_not_found" };
  }

  const sallesRequises: number = service.salles_requises ?? 1;
  let verificationRequise = false;

  if (!allowOverride) {
    const { status } = await syncAllSalles();

    if (status === "failed") {
      verificationRequise = true;
    }

    const availableSlots = await getAvailableSlots(serviceId, slotStart, { skipDelayCheck: true });
    const stillAvailable = availableSlots.some(
      (s) => s.start.getTime() === slotStart.getTime()
    );

    if (!stillAvailable) {
      return { success: false, reason: "slot_expired" };
    }
  }

  let slotNumbers = await assignSlotNumbers(slotStart, slotEnd, sallesRequises);
  if (slotNumbers === null) {
    if (allowOverride) {
      slotNumbers = await firstFreeSlotNumbers(slotStart, slotEnd, sallesRequises);
    } else {
      console.error(
        `[create-booking] INCOHÉRENCE capacité/affectation : créneau ${startAt}→${endAt} proposé par getAvailableSlots mais aucun slot libre dans assignSlotNumbers. Possible divergence entre countOverlaps et slot mapping.`
      );
      return { success: false, reason: "no_slot" };
    }
  }

  const { data, error } = await supabaseAdmin.rpc("create_booking_with_slots", {
    p_service_id: serviceId,
    p_client_id: clientId,
    p_start_at: startAt,
    p_end_at: endAt,
    p_slot_numbers: slotNumbers,
    p_statut: "confirmed",
    p_montant: service.prix,
    p_statut_paiement: statutPaiement,
    p_stripe_payment_id: stripePaymentId,
    p_verification_requise: verificationRequise,
  });

  if (error) {
    // PS001 = booking_slots_no_overlap violation (via RAISE dans la RPC)
    // 23P01 = exclusion_violation brute (bookings_no_overlap ou booking_slots)
    if (error.code === "PS001" || error.code === "23P01" || error.message?.includes("Slot occupé")) {
      return { success: false, reason: "slot_expired" };
    }
    console.error("[create-booking] RPC error:", JSON.stringify(error));
    return { success: false, reason: "db_error" };
  }

  const bookingId = data as string;

  if (verificationRequise) {
    try {
      await sendVerificationAlert({
        bookingId,
        serviceId,
        startAt,
        endAt,
        clientId,
      });
    } catch (err) {
      console.error("[create-booking] Erreur envoi email alerte vérification:", err);
    }
  }

  return { success: true, bookingId, verificationRequise };
}

/**
 * Fallback pour l'override admin : trouve N slots libres sans limite nb_salles.
 * Lit bookings ET external_bookings pour ne pas attribuer une salle occupée par Planity.
 */
async function firstFreeSlotNumbers(
  slotStart: Date,
  slotEnd: Date,
  sallesRequises: number
): Promise<number[]> {
  const [{ data: overlappingSlots }, { data: externals }] = await Promise.all([
    supabaseAdmin
      .from("booking_slots")
      .select("slot_number, booking:bookings(start_at, end_at, statut)")
      .eq("actif", true),
    supabaseAdmin
      .from("external_bookings")
      .select("start_at, end_at, calendar_source")
      .lt("start_at", slotEnd.toISOString())
      .gt("end_at", slotStart.toISOString()),
  ]);

  const usedSlots = new Set<number>();

  // Slots internes qui chevauchent (filtre statut + fenêtre côté applicatif)
  for (const s of overlappingSlots ?? []) {
    const b = s.booking as unknown as { start_at: string; end_at: string; statut: string } | null;
    if (!b || b.statut === "cancelled") continue;
    if (b.start_at < slotEnd.toISOString() && b.end_at > slotStart.toISOString()) {
      usedSlots.add(s.slot_number);
    }
  }

  // Slots externes qui chevauchent
  const allMappedSlots = getAllMappedSlots();
  for (const e of externals ?? []) {
    const slot = getSlotForCalendarSource(e.calendar_source);
    if (slot === null) {
      allMappedSlots.forEach((s) => usedSlots.add(s));
    } else {
      usedSlots.add(slot);
    }
  }

  const freeSlots: number[] = [];
  let slot = 1;
  while (freeSlots.length < sallesRequises) {
    if (!usedSlots.has(slot)) {
      freeSlots.push(slot);
    }
    slot++;
  }
  return freeSlots;
}
