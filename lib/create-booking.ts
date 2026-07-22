import { supabaseAdmin } from "./supabase-admin";
import { getAvailableSlots, assignSlotNumber } from "./availability-service";
import { syncAllSalles } from "./planity-sync";
import type { StatutPaiement } from "./types";

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
  | { success: true; bookingId: string }
  | { success: false; reason: "slot_expired" | "no_slot" | "db_error" | "service_not_found" };

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const { serviceId, clientId, startAt, endAt, stripePaymentId, statutPaiement, allowOverride } = input;

  const slotStart = new Date(startAt);
  const slotEnd = new Date(endAt);

  const { data: service } = await supabaseAdmin
    .from("services")
    .select("prix")
    .eq("id", serviceId)
    .single();

  if (!service) {
    return { success: false, reason: "service_not_found" };
  }

  if (!allowOverride) {
    await syncAllSalles();
    const availableSlots = await getAvailableSlots(serviceId, slotStart, { skipDelayCheck: true });
    const stillAvailable = availableSlots.some(
      (s) => s.start.getTime() === slotStart.getTime()
    );

    if (!stillAvailable) {
      return { success: false, reason: "slot_expired" };
    }
  }

  let slotNumber = await assignSlotNumber(slotStart, slotEnd);
  if (slotNumber === null) {
    if (allowOverride) {
      slotNumber = await firstFreeSlotNumber(slotStart, slotEnd);
    } else {
      return { success: false, reason: "no_slot" };
    }
  }

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .insert({
      service_id: serviceId,
      client_id: clientId,
      start_at: startAt,
      end_at: endAt,
      slot_number: slotNumber,
      statut: "confirmed",
      montant: service.prix,
      statut_paiement: statutPaiement,
      stripe_payment_id: stripePaymentId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { success: false, reason: "db_error" };
  }

  return { success: true, bookingId: data.id };
}

async function firstFreeSlotNumber(slotStart: Date, slotEnd: Date): Promise<number> {
  const { data: overlapping } = await supabaseAdmin
    .from("bookings")
    .select("slot_number")
    .neq("statut", "cancelled")
    .lt("start_at", slotEnd.toISOString())
    .gt("end_at", slotStart.toISOString());

  const usedSlots = new Set((overlapping ?? []).map((b) => b.slot_number));

  let slot = 1;
  while (usedSlots.has(slot)) slot++;
  return slot;
}
