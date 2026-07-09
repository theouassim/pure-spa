import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  const { bookingId } = await request.json();

  if (!bookingId) {
    return NextResponse.json({ error: "bookingId requis" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({ statut_paiement: "paye_sur_place" })
    .eq("id", bookingId)
    .eq("statut_paiement", "en_attente")
    .neq("statut", "cancelled");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
