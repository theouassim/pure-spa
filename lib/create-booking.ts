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
}

export type CreateBookingResult =
  | { success: true; bookingId: string }
  | { success: false; reason: "slot_expired" | "no_slot" | "db_error" | "service_not_found" };

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const { serviceId, clientId, startAt, endAt, stripePaymentId, statutPaiement } = input;

  const slotStart = new Date(startAt);
  const slotEnd = new Date(endAt);

  // Fetch le prix du service à ce moment précis (figé dans le booking)
  const { data: service } = await supabaseAdmin
    .from("services")
    .select("prix")
    .eq("id", serviceId)
    .single();

  if (!service) {
    return { success: false, reason: "service_not_found" };
  }

  // Refetch Planity + revérification live du créneau
  await syncAllSalles();
  const availableSlots = await getAvailableSlots(serviceId, slotStart);
  const stillAvailable = availableSlots.some(
    (s) => s.start.getTime() === slotStart.getTime()
  );

  if (!stillAvailable) {
    return { success: false, reason: "slot_expired" };
  }

  // Attribution du slot
  const slotNumber = await assignSlotNumber(slotStart, slotEnd);
  if (slotNumber === null) {
    return { success: false, reason: "no_slot" };
  }

  // Création du booking avec montant figé
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
