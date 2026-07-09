import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "Paramètres from/to requis" }, { status: 400 });
  }

  const [kpisResult, chartResult, enAttenteResult] = await Promise.all([
    supabaseAdmin.rpc("get_facturation_kpis", { p_from: from, p_to: to }),
    supabaseAdmin.rpc("get_facturation_par_semaine", { p_from: from, p_to: to }),
    supabaseAdmin.rpc("get_bookings_en_attente", { p_from: from, p_to: to }),
  ]);

  if (kpisResult.error) {
    return NextResponse.json({ error: kpisResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    kpis: kpisResult.data?.[0] ?? { ca_encaisse: 0, ca_en_ligne: 0, ca_sur_place: 0, montant_en_attente: 0, nb_rdv: 0 },
    chart: chartResult.data ?? [],
    en_attente: enAttenteResult.data ?? [],
  });
}
