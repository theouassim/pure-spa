import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ALLOWED_EVENTS = new Set([
  "funnel_start",
  "service_selected",
  "calendar_viewed",
  "slot_selected",
  "details_started",
  "booking_submitted",
  "slot_expired",
]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, event_name, payload, service_id } = body;

    if (!session_id || !event_name || !ALLOWED_EVENTS.has(event_name)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    await supabaseAdmin.from("funnel_events").insert({
      session_id,
      event_name,
      payload: payload ?? {},
      service_id: service_id ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
