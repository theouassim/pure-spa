"use client";

import { Activity, Zap, TrendingDown, AlertCircle } from "lucide-react";
import { InfoTooltip } from "../components/info-tooltip";

interface Props {
  totalSessions: number;
  conversions: number;
  conversionRate: string;
  totalExpired: number;
  loading: boolean;
}

export function AnalyticsKpis({ totalSessions, conversions, conversionRate, totalExpired, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-bg-card" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiCard
        icon={Activity}
        label="Sessions"
        tooltip="Nombre de visiteurs uniques ayant commencé une réservation."
        value={String(totalSessions)}
        sub="Visiteurs uniques du tunnel"
      />
      <KpiCard
        icon={Zap}
        label="Conversions"
        tooltip="Réservations réellement validées sur la période."
        value={String(conversions)}
        sub="Réservations validées"
        accent
      />
      <KpiCard
        icon={TrendingDown}
        label="Taux de conversion"
        tooltip="Part des visiteurs qui vont jusqu'à valider leur RDV."
        value={`${conversionRate} %`}
        sub="funnel_start → booking"
        accent
      />
      <KpiCard
        icon={AlertCircle}
        label="Créneaux expirés"
        tooltip="Créneaux pris par une autre cliente pendant la réservation."
        value={String(totalExpired)}
        sub="Sessions impactées"
        muted={totalExpired === 0}
      />
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  tooltip,
  value,
  sub,
  accent,
  muted,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  tooltip?: string;
  value: string;
  sub?: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-text-muted">
        <Icon size={14} />
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <p className={`mt-2 text-xl font-bold ${accent ? "text-primary" : muted ? "text-text-muted" : "text-text"}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-[11px] text-text-muted">{sub}</p>}
    </div>
  );
}
