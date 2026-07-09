"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar } from "lucide-react";
import { FunnelChart } from "./funnel-chart";
import { SlotExpiredCard } from "./slot-expired-card";
import { TopServicesChart } from "./top-services-chart";
import { AnalyticsKpis } from "./analytics-kpis";

export interface FunnelStep {
  event_name: string;
  sessions_uniques: number;
}

export interface SlotExpiredRow {
  total_sessions: number;
  last_step_before: string;
  count_at_step: number;
}

export interface TopService {
  service_id: string;
  service_nom: string;
  selections: number;
}

const STEP_ORDER = [
  "funnel_start",
  "service_selected",
  "calendar_viewed",
  "slot_selected",
  "details_started",
  "booking_submitted",
] as const;

const STEP_LABELS: Record<string, string> = {
  funnel_start: "Début du tunnel",
  service_selected: "Service choisi",
  calendar_viewed: "Calendrier consulté",
  slot_selected: "Créneau sélectionné",
  details_started: "Coordonnées remplies",
  booking_submitted: "Réservation validée",
};

type PeriodPreset = "ce_mois" | "mois_precedent" | "custom";

function getMonthRange(offset: number): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + offset;
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function AnalyticsClient() {
  const [preset, setPreset] = useState<PeriodPreset>("ce_mois");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [slotExpired, setSlotExpired] = useState<SlotExpiredRow[]>([]);
  const [topServices, setTopServices] = useState<TopService[]>([]);
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
    const res = await fetch(`/api/admin/analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    const data = await res.json();
    setFunnel(data.funnel ?? []);
    setSlotExpired(data.slot_expired ?? []);
    setTopServices(data.top_services ?? []);
    setLoading(false);
  }, [getRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const orderedFunnel = STEP_ORDER.map((name) => {
    const found = funnel.find((f) => f.event_name === name);
    return {
      name,
      label: STEP_LABELS[name],
      count: found?.sessions_uniques ?? 0,
    };
  });

  const totalSessions = orderedFunnel[0]?.count ?? 0;
  const conversions = orderedFunnel[orderedFunnel.length - 1]?.count ?? 0;
  const conversionRate = totalSessions > 0 ? ((conversions / totalSessions) * 100).toFixed(1) : "0";

  const totalExpired = slotExpired.length > 0 ? slotExpired[0].total_sessions : 0;

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
      <AnalyticsKpis
        totalSessions={totalSessions}
        conversions={conversions}
        conversionRate={conversionRate}
        totalExpired={totalExpired}
        loading={loading}
      />

      {/* Entonnoir */}
      <FunnelChart steps={orderedFunnel} loading={loading} />

      {/* slot_expired séparé */}
      <SlotExpiredCard data={slotExpired} totalExpired={totalExpired} loading={loading} />

      {/* Top services */}
      <TopServicesChart services={topServices} loading={loading} />
    </div>
  );
}

export { STEP_LABELS };
