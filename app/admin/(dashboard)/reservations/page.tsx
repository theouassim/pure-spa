import { ClipboardList } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { AdminSettings, Service } from "@/lib/types";
import { ReservationsClient } from "./reservations-client";

export default async function AdminReservationsPage() {
  const [settingsResult, servicesResult] = await Promise.all([
    supabaseAdmin.from("admin_settings").select("*").limit(1).single(),
    supabaseAdmin.from("services").select("id, nom, duree_minutes, prix").eq("actif", true).order("nom"),
  ]);

  const settings = settingsResult.data as AdminSettings | null;
  const services = (servicesResult.data ?? []) as Pick<Service, "id" | "nom" | "duree_minutes" | "prix">[];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ClipboardList size={24} className="text-primary" />
        <h1 className="text-xl font-semibold text-text">Réservations</h1>
      </div>
      <ReservationsClient services={services} settings={settings} />
    </div>
  );
}
