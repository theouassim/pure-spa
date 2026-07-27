import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendBookingReminder } from "@/lib/emails";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60_000);

  const { data: bookings, error } = await supabaseAdmin
    .from("bookings")
    .select("id, start_at, montant, statut_paiement, client_id, service_id")
    .eq("statut", "confirmed")
    .eq("email_rappel_sent", false)
    .gte("start_at", now.toISOString())
    .lte("start_at", in24h.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;

  for (const booking of bookings ?? []) {
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("nom, email")
      .eq("id", booking.client_id)
      .single();

    const { data: service } = await supabaseAdmin
      .from("services")
      .select("nom, duree_minutes")
      .eq("id", booking.service_id)
      .single();

    if (!client || !service) continue;

    await sendBookingReminder(booking, client, service);
    sent++;
  }

  return NextResponse.json({
    ok: true,
    checked: bookings?.length ?? 0,
    sent,
  });
}
