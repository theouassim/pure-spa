import { CalendarDays } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { AdminSettings } from "@/lib/types";
import { CalendarGrid } from "./components/calendar-grid";

export default async function AdminCalendarPage() {
  const { data } = await supabaseAdmin.from("admin_settings").select("*").limit(1).single();
  const settings = data as AdminSettings | null;

  const joursOuverts = settings?.jours_travailles ?? [2, 3, 4, 5, 6];
  const horaires = settings?.horaires_ouverture ?? [];
  const nbRessources = settings?.nb_salles ?? 2;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <CalendarDays size={24} className="text-primary" />
        <h1 className="text-xl font-semibold text-text">Calendrier</h1>
      </div>
      <CalendarGrid
        joursOuverts={joursOuverts}
        horaires={horaires}
        nbRessources={nbRessources}
      />
    </div>
  );
}
