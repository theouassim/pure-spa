import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireOwner } from "@/lib/require-owner";

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
