import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export interface CalendarEvent {
  id: string;
  type: "booking" | "external";
  start: string;
  end: string;
  label: string;
  salle?: string;
  icalUid?: string;
  isDuo?: boolean;
  salles?: string[];
  slotNumbers?: number[];
  serviceNom?: string;
  serviceDuree?: number;
  clientNom?: string;
  clientTelephone?: string;
  clientEmail?: string;
  montant?: number | null;
  statutPaiement?: string;
  statut?: string;
  stripePaymentId?: string | null;
  verificationRequise?: boolean;
  slotNumber?: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "Paramètres from/to requis" }, { status: 400 });
  }

  const [bookingsResult, bookingSlotsResult, externalsResult] = await Promise.all([
    supabaseAdmin
      .from("bookings")
      .select("id, start_at, end_at, statut, montant, statut_paiement, stripe_payment_id, slot_number, service:services(nom, duree_minutes), client:clients(nom, email, telephone)")
      .neq("statut", "cancelled")
      .gte("start_at", from)
      .lte("start_at", to),
    supabaseAdmin
      .from("booking_slots")
      .select("booking_id, slot_number")
      .eq("actif", true),
    supabaseAdmin
      .from("external_bookings")
      .select("id, start_at, end_at, calendar_source, ical_uid, raw_uid")
      .gte("start_at", from)
      .lte("start_at", to),
  ]);

  const slotsByBooking = new Map<string, number[]>();
  for (const s of bookingSlotsResult.data ?? []) {
    const arr = slotsByBooking.get(s.booking_id) ?? [];
    arr.push(s.slot_number);
    slotsByBooking.set(s.booking_id, arr);
  }

  const events: CalendarEvent[] = [];

  for (const b of bookingsResult.data ?? []) {
    const service = b.service as unknown as { nom: string; duree_minutes: number } | null;
    const client = b.client as unknown as { nom: string; email: string; telephone: string | null } | null;
    const bookingSlotNumbers = (slotsByBooking.get(b.id) ?? [b.slot_number]).sort();
    const bookingIsDuo = bookingSlotNumbers.length > 1;
    events.push({
      id: b.id,
      type: "booking",
      start: b.start_at,
      end: b.end_at,
      label: service?.nom ?? "RDV",
      serviceNom: service?.nom ?? undefined,
      serviceDuree: service?.duree_minutes ?? undefined,
      clientNom: client?.nom ?? undefined,
      clientEmail: client?.email ?? undefined,
      clientTelephone: client?.telephone ?? undefined,
      montant: b.montant,
      statutPaiement: b.statut_paiement,
      statut: b.statut,
      stripePaymentId: b.stripe_payment_id,
      verificationRequise: (b as Record<string, unknown>).verification_requise ? true : undefined,
      slotNumber: b.slot_number,
      isDuo: bookingIsDuo || undefined,
      slotNumbers: bookingIsDuo ? bookingSlotNumbers : undefined,
      salles: bookingIsDuo ? bookingSlotNumbers.map((n) => `salle_${n}`) : undefined,
    });
  }

  const externalsRaw = externalsResult.data ?? [];
  const groupedByUid = new Map<string, typeof externalsRaw>();
  for (const e of externalsRaw) {
    const uid = e.ical_uid ?? e.raw_uid;
    const key = `${uid}__${e.start_at}__${e.end_at}`;
    if (!groupedByUid.has(key)) groupedByUid.set(key, []);
    groupedByUid.get(key)!.push(e);
  }

  for (const group of groupedByUid.values()) {
    const uid = group[0].ical_uid ?? group[0].raw_uid;
    if (group.length > 1) {
      const salles = group.map((g) => g.calendar_source).sort();
      events.push({
        id: group[0].id,
        type: "external",
        start: group[0].start_at,
        end: group[0].end_at,
        label: "Planity",
        salle: group[0].calendar_source,
        icalUid: uid,
        isDuo: true,
        salles,
      });
    } else {
      const e = group[0];
      events.push({
        id: e.id,
        type: "external",
        start: e.start_at,
        end: e.end_at,
        label: "Planity",
        salle: e.calendar_source,
        icalUid: uid,
      });
    }
  }

  return NextResponse.json({ events });
}
