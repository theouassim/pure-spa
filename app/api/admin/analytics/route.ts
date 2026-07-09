import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "Paramètres from/to requis" }, { status: 400 });
  }

  const [funnelResult, expiredResult, topServicesResult] = await Promise.all([
    supabaseAdmin.rpc("get_funnel_steps", { p_from: from, p_to: to }),
    supabaseAdmin.rpc("get_slot_expired_stats", { p_from: from, p_to: to }),
    supabaseAdmin.rpc("get_top_services_funnel", { p_from: from, p_to: to, p_limit: 10 }),
  ]);

  if (funnelResult.error) {
    return NextResponse.json({ error: funnelResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    funnel: funnelResult.data ?? [],
    slot_expired: expiredResult.data ?? [],
    top_services: topServicesResult.data ?? [],
  });
}
