import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export interface CalendarEvent {
  id: string;
  type: "booking" | "external";
  start: string;
  end: string;
  label: string;
  salle?: string;
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
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "Paramètres from/to requis" }, { status: 400 });
  }

  const [bookingsResult, externalsResult] = await Promise.all([
    supabaseAdmin
      .from("bookings")
      .select("id, start_at, end_at, statut, montant, statut_paiement, stripe_payment_id, verification_requise, service:services(nom, duree_minutes), client:clients(nom, email, telephone)")
      .neq("statut", "cancelled")
      .gte("start_at", from)
      .lte("start_at", to),
    supabaseAdmin
      .from("external_bookings")
      .select("id, start_at, end_at, calendar_source")
      .gte("start_at", from)
      .lte("start_at", to),
  ]);

  const events: CalendarEvent[] = [];

  for (const b of bookingsResult.data ?? []) {
    const service = b.service as unknown as { nom: string; duree_minutes: number } | null;
    const client = b.client as unknown as { nom: string; email: string; telephone: string | null } | null;
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
      verificationRequise: b.verification_requise || undefined,
    });
  }

  for (const e of externalsResult.data ?? []) {
    events.push({
      id: e.id,
      type: "external",
      start: e.start_at,
      end: e.end_at,
      label: "Planity",
      salle: e.calendar_source,
    });
  }

  return NextResponse.json({ events });
}
