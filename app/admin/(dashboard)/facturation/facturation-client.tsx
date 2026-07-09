"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar } from "lucide-react";
import { KpiCards } from "./kpi-cards";
import { EnAttenteList } from "./en-attente-list";
import { CaChart } from "./ca-chart";

export interface FacturationKpis {
  ca_encaisse: number;
  ca_en_ligne: number;
  ca_sur_place: number;
  montant_en_attente: number;
  nb_rdv: number;
}

export interface ChartPoint {
  semaine_debut: string;
  ca_en_ligne: number;
  ca_sur_place: number;
}

export interface BookingEnAttente {
  id: string;
  start_at: string;
  end_at: string;
  montant: number | null;
  client_nom: string | null;
  client_telephone: string | null;
  service_nom: string | null;
}

type PeriodPreset = "ce_mois" | "mois_precedent" | "custom";

function getMonthRange(offset: number): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + offset;
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function FacturationClient() {
  const [preset, setPreset] = useState<PeriodPreset>("ce_mois");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [kpis, setKpis] = useState<FacturationKpis | null>(null);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [enAttente, setEnAttente] = useState<BookingEnAttente[]>([]);
  const [loading, setLoading] = useState(true);

  const getRange = useCallback(() => {
    if (preset === "ce_mois") return getMonthRange(0);
    if (preset === "mois_precedent") return getMonthRange(-1);
    if (customFrom && customTo) {
      return {
        from: new Date(customFrom).toISOString(),
        to: new Date(customTo + "T23:59:59").toISOString(),
      };
    }
    return getMonthRange(0);
  }, [preset, customFrom, customTo]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { from, to } = getRange();
    const res = await fetch(`/api/admin/facturation?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    const data = await res.json();
    setKpis(data.kpis ?? null);
    setChart(data.chart ?? []);
    setEnAttente(data.en_attente ?? []);
    setLoading(false);
  }, [getRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleEncaisser(bookingId: string) {
    const res = await fetch("/api/admin/facturation/encaisser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId }),
    });
    if (res.ok) fetchData();
  }

  return (
    <div className="space-y-6">
      {/* Sélecteur période */}
      <div className="flex flex-wrap items-center gap-2">
        <Calendar size={14} className="text-text-muted" />
        <button
          onClick={() => setPreset("ce_mois")}
          className={`rounded-md border px-3 py-1.5 text-xs ${
            preset === "ce_mois"
              ? "border-primary bg-primary/10 font-medium text-primary"
              : "border-border text-text-muted hover:bg-accent-light"
          }`}
        >
          Ce mois
        </button>
        <button
          onClick={() => setPreset("mois_precedent")}
          className={`rounded-md border px-3 py-1.5 text-xs ${
            preset === "mois_precedent"
              ? "border-primary bg-primary/10 font-medium text-primary"
              : "border-border text-text-muted hover:bg-accent-light"
          }`}
        >
          Mois précédent
        </button>
        <button
          onClick={() => setPreset("custom")}
          className={`rounded-md border px-3 py-1.5 text-xs ${
            preset === "custom"
              ? "border-primary bg-primary/10 font-medium text-primary"
              : "border-border text-text-muted hover:bg-accent-light"
          }`}
        >
          Personnalisé
        </button>
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-md border border-border px-2 py-1.5 text-xs"
            />
            <span className="text-xs text-text-muted">→</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-md border border-border px-2 py-1.5 text-xs"
            />
          </div>
        )}
      </div>

      {/* KPIs */}
      <KpiCards kpis={kpis} loading={loading} />

      {/* Liste en attente */}
      <EnAttenteList items={enAttente} loading={loading} onEncaisser={handleEncaisser} />

      {/* Graphique */}
      <CaChart data={chart} loading={loading} />
    </div>
  );
}
