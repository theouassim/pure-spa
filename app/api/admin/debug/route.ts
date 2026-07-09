import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireOwner } from "@/lib/require-owner";
import { syncAllSalles } from "@/lib/planity-sync";

function isDebugAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_DEBUG === "true";
}

export async function GET() {
  if (!isDebugAllowed()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ownerCheck = await requireOwner();
  if (ownerCheck instanceof NextResponse) return ownerCheck;

  return NextResponse.json({ ok: true, debug_enabled: true });
}

export async function POST(request: NextRequest) {
  if (!isDebugAllowed()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ownerCheck = await requireOwner();
  if (ownerCheck instanceof NextResponse) return ownerCheck;

  const { action, params } = await request.json();

  switch (action) {
    case "sync_planity": {
      const results = await syncAllSalles();
      return NextResponse.json({ success: true, results, synced_at: new Date().toISOString() });
    }

    case "seed_bookings": {
      const date = params?.date || new Date().toISOString().split("T")[0];
      const count = Math.min(params?.count || 5, 20);
      const { data: services } = await supabaseAdmin
        .from("services")
        .select("id, duree_minutes, prix")
        .eq("actif", true)
        .limit(5);

      if (!services || services.length === 0) {
        return NextResponse.json({ error: "Aucun service actif." }, { status: 400 });
      }

      const { data: client } = await supabaseAdmin
        .from("clients")
        .select("id")
        .limit(1)
        .single();

      let clientId = client?.id;
      if (!clientId) {
        const { data: newClient } = await supabaseAdmin
          .from("clients")
          .insert({ nom: "Client Test", email: "test@test.local", telephone: "0600000000" })
          .select("id")
          .single();
        clientId = newClient?.id;
      }

      const inserts = [];
      for (let i = 0; i < count; i++) {
        const svc = services[i % services.length];
        const hour = 10 + i;
        const startAt = `${date}T${String(hour).padStart(2, "0")}:00:00+02:00`;
        const endAt = new Date(new Date(startAt).getTime() + svc.duree_minutes * 60_000).toISOString();
        inserts.push({
          service_id: svc.id,
          client_id: clientId,
          start_at: startAt,
          end_at: endAt,
          slot_number: i + 1,
          statut: "confirmed",
          montant: svc.prix,
          statut_paiement: "paye_sur_place",
          is_test: true,
        });
      }

      const { error } = await supabaseAdmin.from("bookings").insert(inserts);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ success: true, created: count });
    }

    case "seed_funnel": {
      const sessionCount = Math.min(params?.count || 50, 200);
      const { data: services } = await supabaseAdmin
        .from("services")
        .select("id, nom")
        .eq("actif", true)
        .limit(4);

      const serviceIds = services?.map((s) => s.id) ?? [];
      if (serviceIds.length === 0) {
        return NextResponse.json({ error: "Aucun service actif." }, { status: 400 });
      }

      const events: Array<Record<string, unknown>> = [];
      const steps = ["funnel_start", "service_selected", "calendar_viewed", "slot_selected", "details_started", "booking_submitted"];
      const dropRates = [0, 0.28, 0.24, 0.27, 0.30, 0.35];

      for (let i = 0; i < sessionCount; i++) {
        const sessId = `test_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`;
        const baseTime = new Date();
        baseTime.setDate(baseTime.getDate() - Math.floor(Math.random() * 5));
        baseTime.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60));

        const svcId = serviceIds[i % serviceIds.length];
        let currentTime = baseTime.getTime();
        let dropped = false;

        for (let s = 0; s < steps.length; s++) {
          if (s > 0 && Math.random() < dropRates[s]) {
            dropped = true;
            break;
          }
          currentTime += (15 + Math.floor(Math.random() * 30)) * 1000;
          events.push({
            session_id: sessId,
            event_name: steps[s],
            payload: {},
            service_id: s >= 1 ? svcId : null,
            created_at: new Date(currentTime).toISOString(),
            is_test: true,
          });
        }

        if (!dropped && Math.random() < 0.12) {
          currentTime += 30000;
          events.push({
            session_id: sessId,
            event_name: "slot_expired",
            payload: {},
            service_id: svcId,
            created_at: new Date(currentTime).toISOString(),
            is_test: true,
          });
        }
      }

      const { error } = await supabaseAdmin.from("funnel_events").insert(events);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ success: true, sessions: sessionCount, events_created: events.length });
    }

    case "purge_test": {
      const [bookingsResult, funnelResult] = await Promise.all([
        supabaseAdmin.from("bookings").delete().eq("is_test", true),
        supabaseAdmin.from("funnel_events").delete().eq("is_test", true),
      ]);

      return NextResponse.json({
        success: true,
        purged: {
          bookings_error: bookingsResult.error?.message ?? null,
          funnel_error: funnelResult.error?.message ?? null,
        },
      });
    }

    case "test_email": {
      const email = params?.email;
      if (!email) return NextResponse.json({ error: "Email requis." }, { status: 400 });

      const resendKey = process.env.RESEND_API_KEY;
      if (!resendKey) {
        return NextResponse.json({ error: "RESEND_API_KEY non configurée." }, { status: 500 });
      }

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Pure Spa <noreply@purespa.fr>",
            to: email,
            subject: "[TEST] Email de vérification Pure Spa",
            html: "<h2>Email de test Pure Spa</h2><p>Ce message confirme que l'envoi d'emails fonctionne correctement.</p>",
          }),
        });
        const data = await res.json();
        if (!res.ok) return NextResponse.json({ error: data.message ?? "Erreur Resend" }, { status: 500 });
        return NextResponse.json({ success: true, message: `Email envoyé à ${email}` });
      } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
      }
    }

    default:
      return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  }
}
