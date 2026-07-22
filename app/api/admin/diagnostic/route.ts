import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireOwner } from "@/lib/require-owner";
import { sendBookingConfirmation } from "@/lib/emails";

export async function GET() {
  const ownerCheck = await requireOwner();
  if (ownerCheck instanceof NextResponse) return ownerCheck;

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [planityResult, funnelResult, lastBookingResult] = await Promise.all([
    supabaseAdmin
      .from("external_bookings")
      .select("calendar_source, synced_at")
      .order("synced_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("funnel_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", twentyFourHoursAgo),
    supabaseAdmin
      .from("bookings")
      .select("created_at, statut_paiement")
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
  ]);

  // Planity stats per salle
  const planityBySource: Record<string, { last_sync: string; count: number }> = {};
  if (planityResult.data) {
    for (const row of planityResult.data) {
      const source = row.calendar_source || "default";
      if (!planityBySource[source]) {
        planityBySource[source] = { last_sync: row.synced_at, count: 0 };
      }
      planityBySource[source].count++;
    }
  }

  // Total external bookings count
  const { count: totalExternal } = await supabaseAdmin
    .from("external_bookings")
    .select("id", { count: "exact", head: true });

  const funnelLast24h = funnelResult.count ?? 0;

  // Stripe: check last booking with paye_en_ligne (proxy for webhook)
  const { data: lastStripeBooking } = await supabaseAdmin
    .from("bookings")
    .select("created_at")
    .eq("statut_paiement", "paye_en_ligne")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Health status
  const planityOk = Object.values(planityBySource).some((v) => {
    const syncAge = now.getTime() - new Date(v.last_sync).getTime();
    return syncAge < 30 * 60 * 1000; // < 30 min
  });
  const funnelOk = funnelLast24h > 0;

  let globalStatus: "ok" | "warning" | "error" = "ok";
  if (!planityOk && Object.keys(planityBySource).length > 0) globalStatus = "warning";
  if (!funnelOk) globalStatus = "warning";

  return NextResponse.json({
    global_status: globalStatus,
    planity: {
      sources: planityBySource,
      total_events: totalExternal ?? 0,
      status: Object.keys(planityBySource).length === 0 ? "no_data" : planityOk ? "ok" : "stale",
    },
    stripe: {
      last_payment: lastStripeBooking?.created_at ?? null,
    },
    funnel: {
      events_last_24h: funnelLast24h,
      status: funnelOk ? "ok" : "no_activity",
    },
    last_booking: lastBookingResult.data?.created_at ?? null,
  });
}

export async function POST(request: NextRequest) {
  const ownerCheck = await requireOwner();
  if (ownerCheck instanceof NextResponse) return ownerCheck;

  const { action, email } = await request.json();

  if (action === "test_email") {
    if (!email) {
      return NextResponse.json({ error: "Email requis" }, { status: 400 });
    }
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: "RESEND_API_KEY non configurée" }, { status: 500 });
    }

    try {
      await sendBookingConfirmation(
        { id: `test-${Date.now()}`, start_at: new Date().toISOString(), montant: 6500, statut_paiement: "paye_en_ligne" },
        { nom: "Cliente Test", email },
        { nom: "Soin Relaxant", duree_minutes: 60 }
      );
      return NextResponse.json({ success: true, message: `Email envoyé à ${email}` });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
